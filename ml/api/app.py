from pathlib import Path
import json
import logging
import math
import sys
from typing import Literal

import joblib
import pandas as pd
from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

# Support both documented startup forms:
# - from repository root: python -m uvicorn ml.api.app:app ...
# - from ml folder: python -m uvicorn api.app:app ...
REPOSITORY_ROOT = Path(__file__).resolve().parents[2]
if str(REPOSITORY_ROOT) not in sys.path:
    sys.path.insert(0, str(REPOSITORY_ROOT))

from ml.paths import (
    BEST_MODEL_REGISTRY_PATH,
    COLUMNS_PATH,
    COMPATIBILITY_MODEL_PATH,
    SCALER_PATH,
    resolve_repo_path,
)
from ml.preprocessing import preprocess_prediction_data, validate_encoded_columns
from ml.model_registry import (
    ModelRegistryError,
    active_artifact_path,
    activate_model,
    benchmark_model,
    disable_model,
    enable_model,
    get_model,
    get_models,
    retrain_model,
)


TRANSACTION_TYPES = ["CASH_IN", "CASH_OUT", "DEBIT", "PAYMENT", "TRANSFER"]
LOGGER = logging.getLogger("fraudguard.ml_api")

app = FastAPI(title="FraudGuard ML Prediction Service")


@app.exception_handler(ModelRegistryError)
async def model_registry_exception_handler(_: Request, exc: ModelRegistryError):
    LOGGER.warning("model registry request failed model_id=%s status=%s message=%s", exc.model_id, exc.status_code, exc.message)
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "message": exc.message,
            "modelId": exc.model_id,
        },
    )


@app.exception_handler(Exception)
async def unexpected_exception_handler(request: Request, exc: Exception):
    LOGGER.exception("unexpected ML service error path=%s", request.url.path)
    return JSONResponse(
        status_code=500,
        content={
            "message": "ML service failed while processing the model request. Check the Python service logs."
        },
    )


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
    riskBreakdown: list[dict[str, str]]
    suggestedAction: str


class HealthResponse(BaseModel):
    status: str
    service: str
    modelStatus: str
    modelArtifactExists: bool
    columnsArtifactExists: bool
    scalerArtifactExists: bool
    modelName: str | None = None


def load_artifacts():
    model_path, metadata = resolve_best_model_metadata()
    if not model_path.exists() or not COLUMNS_PATH.exists():
        raise HTTPException(status_code=503, detail="Model artifacts are not available. Run python retrain_models.py first.")

    scaler = joblib.load(SCALER_PATH) if SCALER_PATH.exists() else None
    model = joblib.load(model_path)
    columns = load_encoded_columns()
    validate_model_feature_alignment(model, columns)
    return model, columns, scaler, metadata


def load_encoded_columns() -> list[str]:
    try:
        columns = joblib.load(COLUMNS_PATH)
        return validate_encoded_columns(columns)
    except ValueError as exc:
        raise HTTPException(
            status_code=503,
            detail=f"Saved columns artifact is invalid: {exc}",
        ) from exc


def validate_model_feature_alignment(model, columns: list[str]) -> None:
    expected_feature_count = getattr(model, "n_features_in_", None)
    if expected_feature_count is not None and int(expected_feature_count) != len(columns):
        raise HTTPException(
            status_code=503,
            detail=(
                "Model artifact and saved columns artifact do not match: "
                f"model expects {expected_feature_count} features but columns artifact has {len(columns)}. "
                "Run python retrain_models.py to regenerate model artifacts together."
            ),
        )

    model_feature_names = getattr(model, "feature_names_in_", None)
    if model_feature_names is not None and list(model_feature_names) != columns:
        raise HTTPException(
            status_code=503,
            detail=(
                "Model artifact and saved columns artifact have different feature names or order. "
                "Run python retrain_models.py to regenerate model artifacts together."
            ),
        )


def resolve_best_model_metadata() -> tuple[Path, dict]:
    try:
        model_path, active_model = active_artifact_path()
        return model_path, {
            "modelName": active_model.get("displayName"),
            "trainingDateUtc": active_model.get("lastTrainedAt"),
            "modelId": active_model.get("id"),
            "version": active_model.get("version"),
        }
    except ModelRegistryError:
        pass

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
    if score >= 70:
        return "High"
    if score >= 40:
        return "Medium"
    return "Low"


def suggested_action(score: int) -> str:
    if score >= 70:
        return "Block transaction immediately"
    if score >= 40:
        return "Manual review required"
    return "Approve transaction"


def format_amount(value: float) -> str:
    return f"{value:,.2f}"


def approximately_equal(left: float, right: float, tolerance_ratio: float = 0.02, minimum_tolerance: float = 1.0) -> bool:
    tolerance = max(abs(right) * tolerance_ratio, minimum_tolerance)
    return abs(left - right) <= tolerance


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
    elif (
        request.transactionType in {"TRANSFER", "CASH_OUT"}
        and request.oldBalanceOrigin > 0
        and request.newBalanceOrigin == 0
        and approximately_equal(request.amount, request.oldBalanceOrigin)
    ):
        factors.append("Risk Factors|Full origin balance was moved and the origin account became zero.")
    else:
        factors.append("Protective Factors|Origin balance movement is consistent with the transaction amount.")

    if destination_delta < 0:
        factors.append("Risk Factors|Destination balance decreased during an incoming transaction.")
    elif request.amount > 0 and destination_delta == 0:
        factors.append("Risk Factors|Destination balance did not change despite a positive amount.")
    else:
        factors.append("Protective Factors|Destination balance movement is consistent with an incoming transfer.")

    return factors


def build_risk_breakdown(request: PredictionRequest) -> list[dict[str, str]]:
    origin_delta = request.oldBalanceOrigin - request.newBalanceOrigin
    destination_delta = request.newBalanceDestination - request.oldBalanceDestination
    sensitive_type = request.transactionType in {"TRANSFER", "CASH_OUT"}

    high_amount = request.amount >= 100000
    if request.amount >= 1000000:
        amount_factor = "High transaction amount"
        amount_explanation = f"Amount is {format_amount(request.amount)}, above the very-high-value threshold."
        amount_impact = "High risk"
    elif high_amount:
        amount_factor = "High transaction amount"
        amount_explanation = f"Amount is {format_amount(request.amount)}, above the high-value threshold."
        amount_impact = "Risk"
    else:
        amount_factor = "Transaction amount"
        amount_explanation = f"Amount is {format_amount(request.amount)}, below the high-value threshold."
        amount_impact = "Neutral"

    if sensitive_type:
        type_explanation = f"{request.transactionType} is treated as fraud-sensitive because money leaves or moves between accounts."
        type_impact = "Risk"
    else:
        type_explanation = f"{request.transactionType} is not one of the higher-risk transfer or cash-out types."
        type_impact = "Protective"

    if origin_delta <= 0 and request.amount > 0:
        origin_explanation = "Origin balance did not decrease even though the transaction amount is positive."
        origin_impact = "Risk"
    elif (
        sensitive_type
        and request.oldBalanceOrigin > 0
        and request.newBalanceOrigin == 0
        and approximately_equal(request.amount, request.oldBalanceOrigin)
    ):
        origin_explanation = "Full origin balance was transferred and the origin account became zero."
        origin_impact = "Risk"
    elif request.amount > 0 and abs(origin_delta - request.amount) > request.amount * 0.25:
        origin_explanation = (
            f"Origin balance dropped by {format_amount(origin_delta)}, which differs from the amount by more than 25%."
        )
        origin_impact = "Risk"
    else:
        origin_explanation = f"Origin balance dropped by {format_amount(origin_delta)}, broadly matching the amount."
        origin_impact = "Protective"

    if destination_delta < 0:
        destination_explanation = "Destination balance decreased during a transaction that should move funds in."
        destination_impact = "Risk"
    elif request.amount > 0 and destination_delta == 0:
        destination_explanation = "Destination balance did not change despite a positive transaction amount."
        destination_impact = "Risk"
    elif request.oldBalanceDestination == 0 and request.amount >= 100000:
        destination_explanation = "Destination started at zero and received a high-value amount."
        destination_impact = "Risk"
    else:
        destination_explanation = f"Destination balance changed by {format_amount(destination_delta)}, consistent with receiving funds."
        destination_impact = "Protective"

    if request.newBalanceOrigin == 0 or request.newBalanceDestination == 0:
        zero_explanation = "At least one account has a zero balance after the transaction."
        zero_impact = "Risk"
    else:
        zero_explanation = "Neither account has a zero balance after the transaction."
        zero_impact = "Protective"

    return [
        {
            "factor": amount_factor,
            "impact": amount_impact,
            "explanation": amount_explanation,
        },
        {
            "factor": "Transfer or cash-out transaction type",
            "impact": type_impact,
            "explanation": type_explanation,
        },
        {
            "factor": "Origin account balance drop",
            "impact": origin_impact,
            "explanation": origin_explanation,
        },
        {
            "factor": "Destination account balance behavior",
            "impact": destination_impact,
            "explanation": destination_explanation,
        },
        {
            "factor": "Zero balance after transaction",
            "impact": zero_impact,
            "explanation": zero_explanation,
        },
    ]


def rule_based_score(request: PredictionRequest) -> tuple[int, list[str]]:
    score = 0
    reasons: list[str] = []
    origin_delta = request.oldBalanceOrigin - request.newBalanceOrigin
    destination_delta = request.newBalanceDestination - request.oldBalanceDestination
    sensitive_type = request.transactionType in {"TRANSFER", "CASH_OUT"}
    full_origin_balance_moved = (
        sensitive_type
        and request.oldBalanceOrigin > 0
        and request.newBalanceOrigin == 0
        and approximately_equal(request.amount, request.oldBalanceOrigin)
        and approximately_equal(origin_delta, request.amount)
    )
    destination_received_amount = request.amount > 0 and approximately_equal(destination_delta, request.amount)

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

    if request.amount > 0 and abs(origin_delta - request.amount) > request.amount * 0.25:
        score += 15
        reasons.append("Risk Factors|Rule +15: origin balance movement differs from amount by more than 25%.")

    if full_origin_balance_moved:
        score = max(score, 80)
        reasons.append(
            "Risk Factors|Rule floor 80: full origin balance was transferred and the origin account became zero."
        )

    if full_origin_balance_moved and destination_received_amount:
        score = max(score, 85)
        reasons.append(
            "Risk Factors|Rule floor 85: destination balance increased by approximately the transferred amount."
        )

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

    if final_score >= 70:
        reasons.append("Final Decision|Final hybrid score is 70 or higher, so the transaction is flagged as fraud.")
    elif final_score >= 40:
        reasons.append("Final Decision|Final hybrid score is 40 or higher, so the transaction needs review.")
    else:
        reasons.append("Final Decision|Final hybrid score is below 40, so the transaction is not flagged as fraud.")

    return reasons


@app.get("/health", response_model=HealthResponse)
@app.get("/api/health", response_model=HealthResponse)
def health():
    model_path, metadata = resolve_best_model_metadata()
    model_exists = model_path.exists()
    columns_exists = COLUMNS_PATH.exists()
    scaler_exists = SCALER_PATH.exists()

    return HealthResponse(
        status="ok",
        service="FraudGuard ML Prediction Service",
        modelStatus="ready" if model_exists and columns_exists else "degraded",
        modelArtifactExists=model_exists,
        columnsArtifactExists=columns_exists,
        scalerArtifactExists=scaler_exists,
        modelName=metadata.get("modelName"),
    )


@app.get("/models")
def list_models():
    LOGGER.info("model action=list")
    return get_models()


@app.get("/models/{model_id}")
def model_details(model_id: str):
    LOGGER.info("model action=details model_id=%s", model_id)
    return get_model(model_id)


@app.post("/models/{model_id}/benchmark")
def run_model_benchmark(model_id: str):
    LOGGER.info("model action=benchmark model_id=%s", model_id)
    return benchmark_model(model_id)


@app.post("/models/{model_id}/retrain")
def run_model_retrain(model_id: str):
    LOGGER.info("model action=retrain model_id=%s", model_id)
    return retrain_model(model_id)


@app.post("/models/{model_id}/enable")
def enable_registered_model(model_id: str):
    LOGGER.info("model action=enable model_id=%s", model_id)
    return enable_model(model_id)


@app.post("/models/{model_id}/disable")
def disable_registered_model(model_id: str):
    LOGGER.info("model action=disable model_id=%s", model_id)
    return disable_model(model_id)


@app.post("/models/{model_id}/activate")
def activate_registered_model(model_id: str):
    LOGGER.info("model action=activate model_id=%s", model_id)
    return activate_model(model_id)


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
    try:
        frame = preprocess_prediction_data(
            pd.DataFrame([row]),
            columns=columns,
            scaler=scaler,
            scale_numeric=scaler is not None,
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=422,
            detail=f"Prediction input does not match training feature schema: {exc}",
        ) from exc

    probability = float(model.predict_proba(frame)[0][1])
    ml_score = clamp_score(probability * 100)
    rules_score, rule_reasons = rule_based_score(request)
    score = clamp_score(max(probability * 100, rules_score))
    level = risk_level(score)
    is_fraud = score >= 70
    predicted_class = "Fraud" if is_fraud else "Review" if score >= 40 else "Not fraud"
    reasons = build_reasons(request, ml_score, rules_score, rule_reasons, score)

    return PredictionResponse(
        fraudProbability=round(probability, 4),
        riskScore=score,
        riskLevel=level,
        isFraud=is_fraud,
        predictedClass=predicted_class,
        confidence=round(max(probability, 1 - probability), 4),
        modelName=metadata.get("modelName"),
        modelTrainingDate=metadata.get("trainingDateUtc"),
        reasons=reasons,
        explanationFactors=reasons,
        riskBreakdown=build_risk_breakdown(request),
        suggestedAction=suggested_action(score),
    )
