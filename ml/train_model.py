from pathlib import Path

import joblib
import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import accuracy_score, f1_score, precision_score, recall_score, roc_auc_score
from sklearn.model_selection import train_test_split


ROOT = Path(__file__).resolve().parent
DATASET_PATH = ROOT / "dataset" / "fraud.csv"
FALLBACK_DATASET_PATH = ROOT / "dataset" / "fraud.csv.csv"
MODEL_DIR = ROOT / "models"
FEATURES = [
    "type",
    "amount",
    "oldbalanceOrg",
    "newbalanceOrig",
    "oldbalanceDest",
    "newbalanceDest",
]
TARGET = "isFraud"
MAX_NON_FRAUD_ROWS = 250_000
NON_FRAUD_TO_FRAUD_RATIO = 20


def load_dataset() -> pd.DataFrame:
    dataset_path = DATASET_PATH if DATASET_PATH.exists() else FALLBACK_DATASET_PATH
    if not dataset_path.exists():
        raise FileNotFoundError(f"Dataset not found at {DATASET_PATH}")

    data = pd.read_csv(dataset_path)
    required_columns = FEATURES + [TARGET]
    missing_columns = [column for column in required_columns if column not in data.columns]
    if missing_columns:
        raise ValueError(f"Dataset is missing required columns: {', '.join(missing_columns)}")

    return data[required_columns].dropna()


def main() -> None:
    data = load_dataset()
    fraud = data[data[TARGET] == 1]
    non_fraud = data[data[TARGET] == 0]
    non_fraud_rows = min(len(non_fraud), max(MAX_NON_FRAUD_ROWS, len(fraud) * NON_FRAUD_TO_FRAUD_RATIO))

    if len(fraud) > 0 and len(non_fraud) > non_fraud_rows:
        non_fraud = non_fraud.sample(n=non_fraud_rows, random_state=42)
        data = pd.concat([fraud, non_fraud], ignore_index=True).sample(frac=1, random_state=42)

    x = pd.get_dummies(data[FEATURES], columns=["type"])
    y = data[TARGET].astype(int)

    x_train, x_test, y_train, y_test = train_test_split(
        x,
        y,
        test_size=0.2,
        random_state=42,
        stratify=y if y.nunique() > 1 else None,
    )

    model = RandomForestClassifier(
        n_estimators=80,
        max_depth=10,
        class_weight="balanced",
        random_state=42,
        n_jobs=-1,
    )
    model.fit(x_train, y_train)

    predictions = model.predict(x_test)
    probabilities = model.predict_proba(x_test)[:, 1]

    print(f"accuracy: {accuracy_score(y_test, predictions):.4f}")
    print(f"precision: {precision_score(y_test, predictions, zero_division=0):.4f}")
    print(f"recall: {recall_score(y_test, predictions, zero_division=0):.4f}")
    print(f"f1: {f1_score(y_test, predictions, zero_division=0):.4f}")
    print(f"roc_auc: {roc_auc_score(y_test, probabilities):.4f}")

    MODEL_DIR.mkdir(parents=True, exist_ok=True)
    joblib.dump(model, MODEL_DIR / "fraud_model.pkl")
    joblib.dump(list(x.columns), MODEL_DIR / "columns.pkl")


if __name__ == "__main__":
    main()
