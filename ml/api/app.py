from pathlib import Path
import json
import math
from typing import Literal

import joblib
import pandas as pd
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

from ml.paths import (
    BEST_MODEL_REGISTRY_PATH,
    COLUMNS_PATH,
    COMPATIBILITY_MODEL_PATH,
    SCALER_PATH,
    resolve_repo_path,
)
from ml.preprocessing import preprocess_prediction_data


TRANSACTION_TYPES = ["CASH_IN", "CASH_OUT", "DEBIT", "PAYMENT", "TRANSFER"]

app = FastAPI(title="FraudGuard ML Prediction Service")


class PredictionRequest(BaseModel):
    transactionType: Literal["CASH_IN", "CASH_OUT", "DEBIT", "PAYMENT", "TRANSFER"]
    amount: float = Field(..., ge=0)
    oldBalanceOrigin: float = Field(..., ge=0)
    newBalanceOrigin: float = Field(..., ge=0)
    oldBalanceDestination: float = Field(..., ge=0)
    newBalanceDestination: float = Field(..., ge=0)


class PredictionResponse(BaseModel):
    fraudProbability: float
    riskScore: int
    riskLevel: str
    isFraud: bool
    predictedClass: str
    confidence: float
    modelName: str | None = None
    modelTrainingDate: str | None = None
    reasons: list[str]
    explanationFactors: list[str]
    suggestedAction: str


def load_artifacts():
    model_path, metadata = resolve_best_model_metadata()
    if not model_path.exists() or not COLUMNS_PATH.exists():
        raise HTTPException(status_code=503, detail="Model artifacts are not available. Run train_model.py first.")

    scaler = joblib.load(SCALER_PATH) if SCALER_PATH.exists() else None
    return joblib.load(model_path), joblib.load(COLUMNS_PATH), scaler, metadata


def resolve_best_model_metadata() -> tuple[Path, dict]:
    if not BEST_MODEL_REGISTRY_PATH.exists():
        return COMPATIBILITY_MODEL_PATH, {}

    try:
        with BEST_MODEL_REGISTRY_PATH.open("r", encoding="utf-8") as file:
            registry = json.load(file)
    except (OSError, json.JSONDecodeError):
        return COMPATIBILITY_MODEL_PATH, {}

    artifact = registry.get("modelArtifact")
    if not isinstance(artifact, str) or not artifact.strip():
        return COMPATIBILITY_MODEL_PATH, registry

    return resolve_repo_path(artifact), registry


def validate_prediction_input(request: PredictionRequest) -> None:
    numeric_fields = {
        "amount": request.amount,
        "oldBalanceOrigin": request.oldBalanceOrigin,
        "newBalanceOrigin": request.newBalanceOrigin,
        "oldBalanceDestination": request.oldBalanceDestination,
        "newBalanceDestination": request.newBalanceDestination,
    }
    invalid_fields = [
        field_name
        for field_name, value in numeric_fields.items()
        if not math.isfinite(value) or value < 0
    ]
    if invalid_fields:
        raise HTTPException(
            status_code=422,
            detail=f"Prediction inputs must be numeric and non-negative: {', '.join(invalid_fields)}",
        )


def risk_level(score: int) -> str:
    if score >= 76:
        return "Critical"
    if score >= 51:
        return "High"
    if score >= 21:
        return "Medium"
    return "Low"


def suggested_action(score: int) -> str:
    if score >= 76:
        return "Block transaction immediately"
    if score >= 51:
        return "Manual review required"
    if score >= 21:
        return "Allow with enhanced monitoring"
    return "Approve transaction"


def format_amount(value: float) -> str:
    return f"{value:,.2f}"


def build_input_factors(request: PredictionRequest) -> list[str]:
    origin_delta = request.oldBalanceOrigin - request.newBalanceOrigin
    destination_delta = request.newBalanceDestination - request.oldBalanceDestination
    origin_difference = abs(origin_delta - request.amount)
    high_amount_type = request.transactionType in {"TRANSFER", "CASH_OUT"} and request.amount > 100000

    factors = [
        f"Input Values|Transaction amount is {format_amount(request.amount)}.",
        f"Input Values|Transaction type is {request.transactionType}.",
        (
            "Balance Movement|Origin balance changed from "
            f"{format_amount(request.oldBalanceOrigin)} to {format_amount(request.newBalanceOrigin)} "
            f"(decrease of {format_amount(origin_delta)})."
        ),
        (
            "Balance Movement|Destination balance changed from "
            f"{format_amount(request.oldBalanceDestination)} to {format_amount(request.newBalanceDestination)} "
            f"(increase of {format_amount(destination_delta)})."
        ),
    ]

    if request.oldBalanceDestination == 0:
        factors.append("Risk Factors|Destination account started with a zero balance.")
    else:
        factors.append("Protective Factors|Destination account had an existing balance before the transaction.")

    if request.newBalanceDestination == 0:
        factors.append("Risk Factors|Destination account still has a zero balance after the transaction.")

    if high_amount_type:
        factors.append(
            "Risk Factors|High amount transaction uses a fraud-sensitive type "
            f"({request.transactionType})."
        )
    elif request.transactionType in {"TRANSFER", "CASH_OUT"}:
        factors.append(f"Risk Factors|Transaction type {request.transactionType} has elevated fraud exposure.")
    else:
        factors.append(f"Protective Factors|Transaction type {request.transactionType} is lower risk in this rule set.")

    if request.amount > 0 and origin_difference > request.amount * 0.25:
        factors.append(
            "Risk Factors|Origin balance movement differs from the amount by "
            f"{format_amount(origin_difference)}."
        )
    else:
        factors.append("Protective Factors|Origin balance movement is consistent with the transaction amount.")

    if destination_delta < 0:
        factors.append("Risk Factors|Destination balance decreased during an incoming transaction.")
    elif request.amount > 0 and destination_delta == 0:
        factors.append("Risk Factors|Destination balance did not change despite a positive amount.")
    else:
        factors.append("Protective Factors|Destination balance movement is consistent with an incoming transfer.")

    return factors


def rule_based_score(request: PredictionRequest) -> tuple[int, list[str]]:
    score = 0
    reasons: list[str] = []

    if request.amount > 500000:
        score += 20
        reasons.append("Risk Factors|Rule +20: amount is greater than 500,000.")
    if request.amount > 1000000:
        score += 35
        reasons.append("Risk Factors|Rule +35: amount is greater than 1,000,000.")
    if request.transactionType == "TRANSFER":
        score += 15
        reasons.append("Risk Factors|Rule +15: transaction type is TRANSFER.")
    if request.transactionType == "CASH_OUT":
        score += 20
        reasons.append("Risk Factors|Rule +20: transaction type is CASH_OUT.")
    if request.oldBalanceDestination == 0 and request.amount > 100000:
        score += 15
        reasons.append("Risk Factors|Rule +15: destination had zero previous balance and amount is greater than 100,000.")

    origin_delta = request.oldBalanceOrigin - request.newBalanceOrigin
    if request.amount > 0 and abs(origin_delta - request.amount) > request.amount * 0.25:
        score += 15
        reasons.append("Risk Factors|Rule +15: origin balance movement differs from amount by more than 25%.")

    return score, reasons


def clamp_score(score: float) -> int:
    return max(0, min(100, int(round(score))))


def build_reasons(
    request: PredictionRequest,
    ml_score: int,
    rules_score: int,
    rule_reasons: list[str],
    final_score: int,
) -> list[str]:
    reasons = [
        *build_input_factors(request),
        f"Model Signals|ML model probability contributed {ml_score}/100 risk points.",
        f"Rule Signals|Rule-based checks contributed {min(rules_score, 100)}/100 risk points.",
    ]

    if rule_reasons:
        reasons.extend(rule_reasons)
    else:
        reasons.append("Protective Factors|No rule-based risk checks were triggered.")

    if final_score >= 51:
        reasons.append("Final Decision|Final hybrid score is 51 or higher, so the transaction is flagged as fraud.")
    else:
        reasons.append("Final Decision|Final hybrid score is below 51, so the transaction is not flagged as fraud.")

    return reasons


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/predict", response_model=PredictionResponse)
def predict(request: PredictionRequest):
    validate_prediction_input(request)
    model, columns, scaler, metadata = load_artifacts()

    row = {
        "type": request.transactionType,
        "amount": request.amount,
        "oldbalanceOrg": request.oldBalanceOrigin,
        "newbalanceOrig": request.newBalanceOrigin,
        "oldbalanceDest": request.oldBalanceDestination,
        "newbalanceDest": request.newBalanceDestination,
    }
    frame = preprocess_prediction_data(
        pd.DataFrame([row]),
        columns=columns,
        scaler=scaler,
        scale_numeric=scaler is not None,
    )

    probability = float(model.predict_proba(frame)[0][1])
    ml_score = clamp_score(probability * 100)
    rules_score, rule_reasons = rule_based_score(request)
    score = clamp_score(max(probability * 100, rules_score))
    level = risk_level(score)
    is_fraud = score >= 51
    reasons = build_reasons(request, ml_score, rules_score, rule_reasons, score)

    return PredictionResponse(
        fraudProbability=round(probability, 4),
        riskScore=score,
        riskLevel=level,
        isFraud=is_fraud,
        predictedClass="Fraud" if is_fraud else "Not fraud",
        confidence=round(max(probability, 1 - probability), 4),
        modelName=metadata.get("modelName"),
        modelTrainingDate=metadata.get("trainingDateUtc"),
        reasons=reasons,
        explanationFactors=reasons,
        suggestedAction=suggested_action(score),
    )
