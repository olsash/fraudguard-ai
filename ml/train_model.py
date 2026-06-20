from pathlib import Path
import hashlib
import json

import joblib
import pandas as pd
import sklearn
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import accuracy_score, confusion_matrix, f1_score, precision_score, recall_score, roc_auc_score
from sklearn.model_selection import train_test_split

from ml.preprocessing import FEATURES, TARGET, preprocess_training_data, validate_dataset


ROOT = Path(__file__).resolve().parent
DATASET_PATH = ROOT / "dataset" / "fraud.csv"
MODEL_DIR = ROOT / "models"
RESULTS_DIR = ROOT / "results"
RANDOM_SEED = 42
MAX_NON_FRAUD_ROWS = 250_000
NON_FRAUD_TO_FRAUD_RATIO = 20
SCALE_NUMERIC_FEATURES = False


def print_class_distribution(labels: pd.Series, title: str) -> None:
    counts = labels.value_counts().sort_index()
    total = counts.sum()

    print(title)
    for class_value in [0, 1]:
        count = int(counts.get(class_value, 0))
        percentage = (count / total * 100) if total else 0
        print(f"  isFraud={class_value}: {count} ({percentage:.4f}%)")

    non_fraud_count = counts.get(0, 0)
    fraud_count = counts.get(1, 0)
    ratio = non_fraud_count / max(fraud_count, 1)
    print(f"  non-fraud to fraud ratio: {ratio:.2f}:1")


def evaluate_classifier(model_name: str, model, x_train, y_train, x_test, y_test) -> tuple[dict, object]:
    model.fit(x_train, y_train)
    predictions = model.predict(x_test)
    cm = confusion_matrix(y_test, predictions, labels=[0, 1])
    tn, fp, fn, tp = cm.ravel()

    metrics = {
        "model": model_name,
        "accuracy": float(accuracy_score(y_test, predictions)),
        "precision": float(precision_score(y_test, predictions, zero_division=0)),
        "recall": float(recall_score(y_test, predictions, zero_division=0)),
        "f1": float(f1_score(y_test, predictions, zero_division=0)),
        "confusion_matrix": {
            "true_negatives": int(tn),
            "false_positives": int(fp),
            "false_negatives": int(fn),
            "true_positives": int(tp),
        },
    }

    if hasattr(model, "predict_proba") and y_test.nunique() > 1:
        probabilities = model.predict_proba(x_test)[:, 1]
        metrics["roc_auc"] = float(roc_auc_score(y_test, probabilities))

    return metrics, model


def print_metrics(metrics: dict) -> None:
    print(f"\n{metrics['model']}")
    for metric_name in ["accuracy", "precision", "recall", "f1", "roc_auc"]:
        if metric_name in metrics:
            print(f"{metric_name}: {metrics[metric_name]:.4f}")

    cm = metrics["confusion_matrix"]
    print("confusion_matrix [[TN, FP], [FN, TP]]:")
    print(
        [
            [cm["true_negatives"], cm["false_positives"]],
            [cm["false_negatives"], cm["true_positives"]],
        ]
    )


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


def export_feature_importance(model, feature_columns: list[str]) -> None:
    if not hasattr(model, "feature_importances_"):
        print("Skipping feature importance export: trained model does not expose feature_importances_.")
        return

    RESULTS_DIR.mkdir(parents=True, exist_ok=True)
    feature_importance = (
        pd.DataFrame(
            {
                "featureName": feature_columns,
                "importance": model.feature_importances_,
            }
        )
        .sort_values(by="importance", ascending=False)
        .reset_index(drop=True)
    )

    payload = {
        "source": "ml/train_model.py",
        "modelName": "Random Forest - class_weight=balanced",
        "modelType": "RandomForestClassifier",
        "results": feature_importance.to_dict(orient="records"),
    }

    with (RESULTS_DIR / "feature_importance_results.json").open("w", encoding="utf-8") as file:
        json.dump(payload, file, indent=2, default=float)

    feature_importance.to_csv(RESULTS_DIR / "feature_importance_results.csv", index=False)
    print(f"Saved feature importance results to {RESULTS_DIR / 'feature_importance_results.json'}")


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
    print_class_distribution(data[TARGET], "Original class distribution:")

    fraud = data[data[TARGET] == 1]
    non_fraud = data[data[TARGET] == 0]
    non_fraud_rows = min(len(non_fraud), max(MAX_NON_FRAUD_ROWS, len(fraud) * NON_FRAUD_TO_FRAUD_RATIO))

    if len(fraud) > 0 and len(non_fraud) > non_fraud_rows:
        non_fraud = non_fraud.sample(n=non_fraud_rows, random_state=RANDOM_SEED)
        data = pd.concat([fraud, non_fraud], ignore_index=True).sample(frac=1, random_state=RANDOM_SEED)
        print_class_distribution(data[TARGET], "\nTraining sample class distribution:")

    x, y, preprocessing_artifacts = preprocess_training_data(
        data,
        scale_numeric=SCALE_NUMERIC_FEATURES,
    )

    x_train, x_test, y_train, y_test = train_test_split(
        x,
        y,
        test_size=0.2,
        random_state=RANDOM_SEED,
        stratify=y if y.nunique() > 1 else None,
    )

    baseline_metrics, _ = evaluate_classifier(
        "Random Forest - baseline without class_weight",
        RandomForestClassifier(
            n_estimators=80,
            max_depth=10,
            random_state=RANDOM_SEED,
            n_jobs=-1,
        ),
        x_train,
        y_train,
        x_test,
        y_test,
    )
    balanced_metrics, model = evaluate_classifier(
        "Random Forest - class_weight=balanced",
        RandomForestClassifier(
            n_estimators=80,
            max_depth=10,
            class_weight="balanced",
            random_state=RANDOM_SEED,
            n_jobs=-1,
        ),
        x_train,
        y_train,
        x_test,
        y_test,
    )

    print("\nClass imbalance handling comparison:")
    print_metrics(baseline_metrics)
    print_metrics(balanced_metrics)

    MODEL_DIR.mkdir(parents=True, exist_ok=True)
    joblib.dump(model, MODEL_DIR / "fraud_model.pkl")
    joblib.dump(preprocessing_artifacts.columns, MODEL_DIR / "columns.pkl")
    joblib.dump(preprocessing_artifacts.scaler, MODEL_DIR / "scaler.pkl")
    export_feature_importance(model, preprocessing_artifacts.columns)

    metadata = {
        "random_seed": RANDOM_SEED,
        "dataset": dataset_metadata(),
        "sklearn_version": sklearn.__version__,
        "features": FEATURES,
        "encoded_columns": preprocessing_artifacts.columns,
        "scale_numeric_features": preprocessing_artifacts.scale_numeric,
        "scaler_artifact": "ml/models/scaler.pkl",
        "target": TARGET,
        "model": {
            "type": "RandomForestClassifier",
            "parameters": model.get_params(),
        },
        "imbalance_handling": {
            "baseline_metrics": baseline_metrics,
            "balanced_metrics": balanced_metrics,
        },
        "metrics": balanced_metrics,
    }

    with (MODEL_DIR / "training_metadata.json").open("w", encoding="utf-8") as metadata_file:
        json.dump(metadata, metadata_file, indent=2)


if __name__ == "__main__":
    main()
