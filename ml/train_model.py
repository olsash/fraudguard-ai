from pathlib import Path
import hashlib
import json

import joblib
import pandas as pd
import sklearn
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import accuracy_score, f1_score, precision_score, recall_score, roc_auc_score
from sklearn.model_selection import train_test_split


ROOT = Path(__file__).resolve().parent
DATASET_PATH = ROOT / "dataset" / "fraud.csv"
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
REQUIRED_COLUMNS = FEATURES + [TARGET]
NUMERIC_COLUMNS = [
    "amount",
    "oldbalanceOrg",
    "newbalanceOrig",
    "oldbalanceDest",
    "newbalanceDest",
]
RANDOM_SEED = 42
MAX_NON_FRAUD_ROWS = 250_000
NON_FRAUD_TO_FRAUD_RATIO = 20


def sha256_file(path: Path, chunk_size: int = 1024 * 1024) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as file:
        for chunk in iter(lambda: file.read(chunk_size), b""):
            digest.update(chunk)
    return digest.hexdigest()


def dataset_metadata() -> dict:
    stat = DATASET_PATH.stat()
    return {
        "path": str(DATASET_PATH),
        "file_name": DATASET_PATH.name,
        "file_size_bytes": stat.st_size,
        "last_modified_utc": pd.Timestamp(stat.st_mtime, unit="s", tz="UTC").isoformat(),
        "sha256": sha256_file(DATASET_PATH),
        "random_seed": RANDOM_SEED,
    }


def validate_dataset(data: pd.DataFrame) -> pd.DataFrame:
    missing_columns = [column for column in REQUIRED_COLUMNS if column not in data.columns]
    if missing_columns:
        raise ValueError(
            "Dataset is missing required columns: "
            f"{', '.join(missing_columns)}. "
            f"Expected columns: {', '.join(REQUIRED_COLUMNS)}"
        )

    data = data[REQUIRED_COLUMNS].dropna()

    non_numeric_columns = [
        column for column in NUMERIC_COLUMNS if not pd.api.types.is_numeric_dtype(data[column])
    ]
    if non_numeric_columns:
        raise ValueError(
            "Dataset columns must be numeric for training: "
            f"{', '.join(non_numeric_columns)}"
        )

    invalid_target_values = (
        data.loc[~data[TARGET].isin([0, 1]), TARGET].drop_duplicates().astype(str).tolist()
    )
    if invalid_target_values:
        raise ValueError(
            f"Dataset column '{TARGET}' must contain only binary values 0 and 1. "
            f"Invalid values found: {invalid_target_values}"
        )

    return data


def load_dataset() -> pd.DataFrame:
    if not DATASET_PATH.exists():
        raise FileNotFoundError(
            "Dataset not found. Place the full fraud dataset at "
            f"{DATASET_PATH} before running training. The file is intentionally "
            "not committed because of its size."
        )

    data = pd.read_csv(DATASET_PATH)
    return validate_dataset(data)


def main() -> None:
    data = load_dataset()
    fraud = data[data[TARGET] == 1]
    non_fraud = data[data[TARGET] == 0]
    non_fraud_rows = min(len(non_fraud), max(MAX_NON_FRAUD_ROWS, len(fraud) * NON_FRAUD_TO_FRAUD_RATIO))

    if len(fraud) > 0 and len(non_fraud) > non_fraud_rows:
        non_fraud = non_fraud.sample(n=non_fraud_rows, random_state=RANDOM_SEED)
        data = pd.concat([fraud, non_fraud], ignore_index=True).sample(frac=1, random_state=RANDOM_SEED)

    x = pd.get_dummies(data[FEATURES], columns=["type"])
    y = data[TARGET].astype(int)

    x_train, x_test, y_train, y_test = train_test_split(
        x,
        y,
        test_size=0.2,
        random_state=RANDOM_SEED,
        stratify=y if y.nunique() > 1 else None,
    )

    model = RandomForestClassifier(
        n_estimators=80,
        max_depth=10,
        class_weight="balanced",
        random_state=RANDOM_SEED,
        n_jobs=-1,
    )
    model.fit(x_train, y_train)

    predictions = model.predict(x_test)
    probabilities = model.predict_proba(x_test)[:, 1]

    metrics = {
        "accuracy": float(accuracy_score(y_test, predictions)),
        "precision": float(precision_score(y_test, predictions, zero_division=0)),
        "recall": float(recall_score(y_test, predictions, zero_division=0)),
        "f1": float(f1_score(y_test, predictions, zero_division=0)),
        "roc_auc": float(roc_auc_score(y_test, probabilities)),
    }

    for metric_name, metric_value in metrics.items():
        print(f"{metric_name}: {metric_value:.4f}")

    MODEL_DIR.mkdir(parents=True, exist_ok=True)
    joblib.dump(model, MODEL_DIR / "fraud_model.pkl")
    joblib.dump(list(x.columns), MODEL_DIR / "columns.pkl")

    metadata = {
        "random_seed": RANDOM_SEED,
        "dataset": dataset_metadata(),
        "sklearn_version": sklearn.__version__,
        "features": FEATURES,
        "encoded_columns": list(x.columns),
        "target": TARGET,
        "model": {
            "type": "RandomForestClassifier",
            "parameters": model.get_params(),
        },
        "metrics": metrics,
    }

    with (MODEL_DIR / "training_metadata.json").open("w", encoding="utf-8") as metadata_file:
        json.dump(metadata, metadata_file, indent=2)


if __name__ == "__main__":
    main()
