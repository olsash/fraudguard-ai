from pathlib import Path
from typing import Literal

import joblib
import pandas as pd
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field


ROOT = Path(__file__).resolve().parents[1]
MODEL_PATH = ROOT / "models" / "fraud_model.pkl"
COLUMNS_PATH = ROOT / "models" / "columns.pkl"
TRANSACTION_TYPES = ["CASH_IN", "CASH_OUT", "DEBIT", "PAYMENT", "TRANSFER"]

app = FastAPI(title="FraudGuard ML Prediction Service")


class PredictionRequest(BaseModel):
    transactionType: Literal["CASH_IN", "CASH_OUT", "DEBIT", "PAYMENT", "TRANSFER"]
    amount: float = Field(ge=0)
    oldBalanceOrigin: float = Field(ge=0)
    newBalanceOrigin: float = Field(ge=0)
    oldBalanceDestination: float = Field(ge=0)
    newBalanceDestination: float = Field(ge=0)


class PredictionResponse(BaseModel):
    fraudProbability: float
    riskScore: int
    riskLevel: str
    isFraud: bool
    confidence: float
    reasons: list[str]
    suggestedAction: str


def load_artifacts():
    if not MODEL_PATH.exists() or not COLUMNS_PATH.exists():
        raise HTTPException(status_code=503, detail="Model artifacts are not available. Run train_model.py first.")

    return joblib.load(MODEL_PATH), joblib.load(COLUMNS_PATH)


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


def rule_based_score(request: PredictionRequest) -> tuple[int, list[str]]:
    score = 0
    reasons: list[str] = []

    if request.amount > 500000:
        score += 20
        reasons.append("Rule +20: amount is greater than 500,000.")
    if request.amount > 1000000:
        score += 35
        reasons.append("Rule +35: amount is greater than 1,000,000.")
    if request.transactionType == "TRANSFER":
        score += 15
        reasons.append("Rule +15: transaction type is TRANSFER.")
    if request.transactionType == "CASH_OUT":
        score += 20
        reasons.append("Rule +20: transaction type is CASH_OUT.")
    if request.oldBalanceDestination == 0 and request.amount > 100000:
        score += 15
        reasons.append("Rule +15: destination had zero previous balance and amount is greater than 100,000.")

    origin_delta = request.oldBalanceOrigin - request.newBalanceOrigin
    if abs(origin_delta - request.amount) > request.amount * 0.25:
        score += 15
        reasons.append("Rule +15: origin balance movement differs from amount by more than 25%.")

    return score, reasons


def clamp_score(score: float) -> int:
    return max(0, min(100, int(round(score))))


def build_reasons(ml_score: int, rules_score: int, rule_reasons: list[str], final_score: int) -> list[str]:
    reasons = [
        f"ML model probability contributed {ml_score}/100 risk points.",
        f"Rule-based checks contributed {min(rules_score, 100)}/100 risk points.",
    ]

    if rule_reasons:
        reasons.extend(rule_reasons)
    else:
        reasons.append("No rule-based risk checks were triggered.")

    if final_score >= 51:
        reasons.append("Final hybrid score is 51 or higher, so the transaction is flagged as fraud.")

    return reasons


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/predict", response_model=PredictionResponse)
def predict(request: PredictionRequest):
    model, columns = load_artifacts()

    row = {
        "type": request.transactionType,
        "amount": request.amount,
        "oldbalanceOrg": request.oldBalanceOrigin,
        "newbalanceOrig": request.newBalanceOrigin,
        "oldbalanceDest": request.oldBalanceDestination,
        "newbalanceDest": request.newBalanceDestination,
    }
    frame = pd.get_dummies(pd.DataFrame([row]), columns=["type"])
    frame = frame.reindex(columns=columns, fill_value=0)

    probability = float(model.predict_proba(frame)[0][1])
    ml_score = clamp_score(probability * 100)
    rules_score, rule_reasons = rule_based_score(request)
    score = clamp_score(max(probability * 100, rules_score))
    level = risk_level(score)

    return PredictionResponse(
        fraudProbability=round(probability, 4),
        riskScore=score,
        riskLevel=level,
        isFraud=score >= 51,
        confidence=round(max(probability, 1 - probability), 4),
        reasons=build_reasons(ml_score, rules_score, rule_reasons, score),
        suggestedAction=suggested_action(score),
    )
