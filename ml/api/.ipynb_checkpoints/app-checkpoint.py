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
    if score >= 85:
        return "Critical"
    if score >= 60:
        return "High"
    if score >= 30:
        return "Medium"
    return "Low"


def suggested_action(score: int) -> str:
    if score >= 85:
        return "Block transaction and require manual review."
    if score >= 60:
        return "Challenge with additional verification before approval."
    if score >= 30:
        return "Allow with enhanced monitoring."
    return "Approve transaction."


def build_reasons(request: PredictionRequest, score: int) -> list[str]:
    reasons: list[str] = []
    origin_delta = request.oldBalanceOrigin - request.newBalanceOrigin
    destination_delta = request.newBalanceDestination - request.oldBalanceDestination

    if request.transactionType in {"TRANSFER", "CASH_OUT"}:
        reasons.append(f"{request.transactionType} transactions are common in fraud scenarios.")
    if request.amount >= 10000:
        reasons.append("Transaction amount is unusually high.")
    if abs(origin_delta - request.amount) > max(1.0, request.amount * 0.1):
        reasons.append("Origin balance movement does not closely match the transaction amount.")
    if request.transactionType == "TRANSFER" and destination_delta <= 0:
        reasons.append("Destination balance did not increase after transfer.")
    if score < 30:
        reasons.append("Model probability is low for the supplied balance and transaction pattern.")

    return reasons[:4] or ["Model found no dominant anomaly drivers for this transaction."]


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
    score = int(round(probability * 100))
    level = risk_level(score)

    return PredictionResponse(
        fraudProbability=round(probability, 4),
        riskScore=score,
        riskLevel=level,
        isFraud=probability >= 0.5,
        confidence=round(max(probability, 1 - probability), 4),
        reasons=build_reasons(request, score),
        suggestedAction=suggested_action(score),
    )
