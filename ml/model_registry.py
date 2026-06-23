from __future__ import annotations

from datetime import datetime, timezone
from pathlib import Path
import json
import logging
import shutil
from typing import Any

import joblib
import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import accuracy_score, confusion_matrix, f1_score, precision_score, recall_score, roc_auc_score
from sklearn.model_selection import train_test_split
from sklearn.neighbors import KNeighborsClassifier
from sklearn.neural_network import MLPClassifier
from sklearn.tree import DecisionTreeClassifier

from ml.paths import (
    BEST_MODEL_PATH,
    COLUMNS_PATH,
    COMPATIBILITY_MODEL_PATH,
    DATASET_PATH,
    MODEL_COMPARISON_JSON_PATH,
    MODEL_DIR,
    RESULTS_DIR,
    SCALER_PATH,
    repo_relative,
    resolve_repo_path,
)
from ml.preprocessing import TARGET, preprocess_training_data, validate_dataset


MODEL_REGISTRY_PATH = RESULTS_DIR / "model_registry.json"
TRAINING_SEED = 42
TRAINING_SAMPLE_SIZE = 50_000
LOGGER = logging.getLogger("fraudguard.model_registry")

MODEL_DEFINITIONS: dict[str, dict[str, Any]] = {
    "random_forest": {
        "displayName": "Random Forest",
        "artifactPath": "ml/models/random_forest.pkl",
        "description": "Tree ensemble that reduces variance and models non-linear transaction interactions.",
    },
    "decision_tree": {
        "displayName": "Decision Tree",
        "artifactPath": "ml/models/decision_tree.pkl",
        "description": "Rule-based tree classifier for non-linear thresholds.",
    },
    "knn": {
        "displayName": "KNN",
        "artifactPath": "ml/models/knn.pkl",
        "description": "Distance-based classifier for local transaction similarity.",
    },
    "neural_network": {
        "displayName": "Neural Network / MLPClassifier",
        "artifactPath": "ml/models/neural_network.pkl",
        "description": "Multilayer perceptron for non-linear decision boundaries.",
    },
    "logistic_regression": {
        "displayName": "Logistic Regression",
        "artifactPath": "ml/models/logistic_regression.pkl",
        "description": "Interpretable linear baseline with balanced class weights.",
    },
}

NAME_TO_ID = {
    "random forest": "random_forest",
    "decision tree": "decision_tree",
    "knn": "knn",
    "neural network": "neural_network",
    "neural network / mlpclassifier": "neural_network",
    "logistic regression": "logistic_regression",
}


class ModelRegistryError(RuntimeError):
    status_code = 409

    def __init__(self, message: str, *, model_id: str | None = None):
        super().__init__(message)
        self.message = message
        self.model_id = model_id


class UnknownModelError(ModelRegistryError):
    status_code = 404


class MissingArtifactError(ModelRegistryError):
    status_code = 409


class MissingDatasetError(ModelRegistryError):
    status_code = 409


class InvalidModelActionError(ModelRegistryError):
    status_code = 409


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def normalize_metric(value: Any) -> float | None:
    if value is None:
        return None
    try:
        numeric = float(value)
    except (TypeError, ValueError):
        return None
    return round(numeric * 100 if numeric <= 1 else numeric, 2)


def normalize_model_name(name: str) -> str:
    return " ".join(name.strip().lower().split())


def read_json(path: Path) -> Any:
    with path.open("r", encoding="utf-8") as file:
        return json.load(file)


def write_registry(models: list[dict[str, Any]]) -> None:
    RESULTS_DIR.mkdir(parents=True, exist_ok=True)
    with MODEL_REGISTRY_PATH.open("w", encoding="utf-8") as file:
        json.dump({"models": models, "updatedAt": now_iso()}, file, indent=2)


def standard_artifact_path(model_id: str) -> str:
    definition = MODEL_DEFINITIONS.get(model_id)
    if definition is None:
        raise UnknownModelError(f"Unknown model id '{model_id}'.", model_id=model_id)
    return definition["artifactPath"]


def ensure_random_forest_standard_artifact() -> None:
    standard_path = resolve_repo_path(standard_artifact_path("random_forest"))
    if standard_path.exists():
        return

    source = BEST_MODEL_PATH if BEST_MODEL_PATH.exists() else COMPATIBILITY_MODEL_PATH
    if source.exists():
        standard_path.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(source, standard_path)


def normalize_registry_model(model: dict[str, Any]) -> dict[str, Any]:
    model_id = str(model.get("id", ""))
    if model_id in MODEL_DEFINITIONS:
        model["artifactPath"] = standard_artifact_path(model_id)
        model.setdefault("displayName", MODEL_DEFINITIONS[model_id]["displayName"])
        model.setdefault("notes", MODEL_DEFINITIONS[model_id]["description"])
    return model


def public_model(model: dict[str, Any]) -> dict[str, Any]:
    normalized = dict(normalize_registry_model(dict(model)))
    normalized["artifactExists"] = artifact_exists(normalized)
    return normalized


def load_comparison_rows() -> dict[str, dict[str, Any]]:
    if not MODEL_COMPARISON_JSON_PATH.exists():
        return {}

    data = read_json(MODEL_COMPARISON_JSON_PATH)
    rows = data.get("models", []) if isinstance(data, dict) else []
    result: dict[str, dict[str, Any]] = {}
    for row in rows:
        if not isinstance(row, dict):
            continue
        model_id = NAME_TO_ID.get(normalize_model_name(str(row.get("modelName", ""))))
        if model_id:
            result[model_id] = row
    return result


def default_registry() -> list[dict[str, Any]]:
    ensure_random_forest_standard_artifact()
    comparison_rows = load_comparison_rows()
    generated_at = now_iso()
    best_id = "random_forest"

    models: list[dict[str, Any]] = []
    for model_id, definition in MODEL_DEFINITIONS.items():
        row = comparison_rows.get(model_id, {})
        is_active = model_id == best_id
        artifact_path = definition["artifactPath"]

        models.append(
            {
                "id": model_id,
                "displayName": definition["displayName"],
                "version": "v1.0.0",
                "status": "live" if is_active else "idle",
                "isActive": is_active,
                "isEnabled": True,
                "accuracy": normalize_metric(row.get("accuracy")),
                "precision": normalize_metric(row.get("precision")),
                "recall": normalize_metric(row.get("recall")),
                "f1Score": normalize_metric(row.get("f1Score")),
                "rocAuc": normalize_metric(row.get("rocAuc")),
                "lastTrainedAt": generated_at if resolve_repo_path(artifact_path).exists() else None,
                "lastBenchmarkedAt": generated_at if row else None,
                "artifactPath": artifact_path,
                "notes": row.get("shortDescription") or definition["description"],
                "confusionMatrix": row.get("confusionMatrix"),
            }
        )
    return models


def load_registry() -> list[dict[str, Any]]:
    ensure_random_forest_standard_artifact()
    if not MODEL_REGISTRY_PATH.exists():
        models = default_registry()
        write_registry(models)
        return models

    data = read_json(MODEL_REGISTRY_PATH)
    models = data.get("models", []) if isinstance(data, dict) else []
    if not isinstance(models, list) or not models:
        models = default_registry()
        write_registry(models)
    original_models = json.dumps(models, sort_keys=True, default=str)
    models = [normalize_registry_model(model) for model in models]
    if json.dumps(models, sort_keys=True, default=str) != original_models:
        write_registry(models)
    return models


def get_models() -> list[dict[str, Any]]:
    return [public_model(model) for model in ensure_active_model(load_registry())]


def get_model(model_id: str) -> dict[str, Any]:
    for model in get_models():
        if model["id"] == model_id:
            return model
    raise UnknownModelError(f"Unknown model id '{model_id}'.", model_id=model_id)


def save_models(models: list[dict[str, Any]]) -> list[dict[str, Any]]:
    models = ensure_active_model(models)
    write_registry(models)
    return models


def update_model(model_id: str, updates: dict[str, Any]) -> dict[str, Any]:
    models = load_registry()
    for model in models:
        if model["id"] == model_id:
            model.update(updates)
            save_models(models)
            return public_model(model)
    raise UnknownModelError(f"Unknown model id '{model_id}'.", model_id=model_id)


def best_enabled_model(models: list[dict[str, Any]]) -> dict[str, Any] | None:
    enabled = [model for model in models if model.get("isEnabled") and artifact_exists(model)]
    return max(enabled, key=lambda item: item.get("f1Score") or 0, default=None)


def ensure_active_model(models: list[dict[str, Any]]) -> list[dict[str, Any]]:
    active = next((model for model in models if model.get("isActive") and model.get("isEnabled") and artifact_exists(model)), None)
    if active is None:
        fallback = best_enabled_model(models)
        if fallback is not None:
            for model in models:
                model["isActive"] = model["id"] == fallback["id"]
                if not model.get("isEnabled"):
                    model["status"] = "disabled"
                else:
                    model["status"] = "live" if model["isActive"] else "idle"
            write_registry(models)
    return models


def artifact_exists(model: dict[str, Any]) -> bool:
    return resolve_repo_path(str(model.get("artifactPath", ""))).exists()


def active_model() -> dict[str, Any]:
    models = get_models()
    active = next((model for model in models if model.get("isActive") and model.get("isEnabled") and artifact_exists(model)), None)
    if active is None:
        raise MissingArtifactError("No enabled model with an available artifact exists. Retrain or enable a model first.")
    return active


def active_artifact_path() -> tuple[Path, dict[str, Any]]:
    model = active_model()
    return resolve_repo_path(model["artifactPath"]), model


def activate_model(model_id: str) -> dict[str, Any]:
    models = load_registry()
    target = next((model for model in models if model["id"] == model_id), None)
    if target is None:
        raise UnknownModelError(f"Unknown model id '{model_id}'.", model_id=model_id)
    if not target.get("isEnabled"):
        raise InvalidModelActionError("Disabled models cannot be activated.", model_id=model_id)
    if not artifact_exists(target):
        artifact_path = resolve_repo_path(target["artifactPath"])
        LOGGER.info("activate model_id=%s artifact_path=%s exists=%s", model_id, artifact_path, artifact_path.exists())
        raise MissingArtifactError("Model artifact is missing. Retrain the model before activating it.", model_id=model_id)

    for model in models:
        model["isActive"] = model["id"] == model_id
        model["status"] = "live" if model["id"] == model_id else ("disabled" if not model.get("isEnabled") else "idle")
    save_models(models)
    return get_model(model_id)


def enable_model(model_id: str) -> dict[str, Any]:
    return update_model(model_id, {"isEnabled": True, "status": "idle"})


def disable_model(model_id: str) -> dict[str, Any]:
    models = load_registry()
    target = next((model for model in models if model["id"] == model_id), None)
    if target is None:
        raise UnknownModelError(f"Unknown model id '{model_id}'.", model_id=model_id)

    target["isEnabled"] = False
    target["isActive"] = False
    target["status"] = "disabled"
    save_models(models)
    return get_model(model_id)


def set_transient_status(model_id: str, status: str) -> None:
    try:
        update_model(model_id, {"status": status})
    except ModelRegistryError:
        pass


def classifier_for(model_id: str):
    if model_id == "random_forest":
        return RandomForestClassifier(n_estimators=80, max_depth=10, min_samples_split=5, class_weight="balanced", random_state=TRAINING_SEED, n_jobs=-1)
    if model_id == "decision_tree":
        return DecisionTreeClassifier(max_depth=15, min_samples_split=2, criterion="gini", class_weight="balanced", random_state=TRAINING_SEED)
    if model_id == "knn":
        return KNeighborsClassifier(n_neighbors=3, weights="distance")
    if model_id == "neural_network":
        return MLPClassifier(hidden_layer_sizes=(64, 32), activation="tanh", learning_rate_init=0.01, max_iter=250, random_state=TRAINING_SEED)
    if model_id == "logistic_regression":
        return LogisticRegression(C=10.0, solver="liblinear", class_weight="balanced", max_iter=1000, random_state=TRAINING_SEED)
    raise UnknownModelError(f"Unknown model id '{model_id}'.", model_id=model_id)


def load_training_frame() -> pd.DataFrame:
    if not DATASET_PATH.exists():
        raise MissingDatasetError("Training dataset is missing. Add the fraud dataset before retraining.")
    try:
        data = pd.read_csv(DATASET_PATH)
        validate_dataset(data)
    except ValueError as exc:
        raise MissingDatasetError(f"Training dataset is invalid: {exc}") from exc
    if len(data) > TRAINING_SAMPLE_SIZE:
        fraud = data[data[TARGET] == 1]
        non_fraud = data[data[TARGET] == 0]
        non_fraud_sample_size = min(max(TRAINING_SAMPLE_SIZE - len(fraud), 0), len(non_fraud))
        non_fraud_sample = non_fraud.sample(n=non_fraud_sample_size, random_state=TRAINING_SEED)
        data = pd.concat([fraud, non_fraud_sample], ignore_index=True).sample(frac=1, random_state=TRAINING_SEED)
    return data


def prepare_training_data():
    data = load_training_frame()
    features, labels, artifacts = preprocess_training_data(data, scale_numeric=False)
    x_train, x_test, y_train, y_test = train_test_split(
        features,
        labels,
        test_size=0.2,
        random_state=TRAINING_SEED,
        stratify=labels,
    )
    return x_train, x_test, y_train, y_test, artifacts.columns, artifacts.scaler


def evaluate_model(model, x_test, y_test) -> dict[str, Any]:
    predictions = model.predict(x_test)
    tn, fp, fn, tp = confusion_matrix(y_test, predictions, labels=[0, 1]).ravel()
    metrics = {
        "accuracy": round(float(accuracy_score(y_test, predictions)) * 100, 2),
        "precision": round(float(precision_score(y_test, predictions, zero_division=0)) * 100, 2),
        "recall": round(float(recall_score(y_test, predictions, zero_division=0)) * 100, 2),
        "f1Score": round(float(f1_score(y_test, predictions, zero_division=0)) * 100, 2),
        "confusionMatrix": {
            "trueNegatives": int(tn),
            "falsePositives": int(fp),
            "falseNegatives": int(fn),
            "truePositives": int(tp),
        },
    }
    if hasattr(model, "predict_proba") and y_test.nunique() > 1:
        metrics["rocAuc"] = round(float(roc_auc_score(y_test, model.predict_proba(x_test)[:, 1])) * 100, 2)
    return metrics


def benchmark_model(model_id: str) -> dict[str, Any]:
    model = get_model(model_id)
    if not model.get("isEnabled"):
        raise InvalidModelActionError("Disabled models cannot be benchmarked. Enable the model first.", model_id=model_id)

    artifact_path = resolve_repo_path(model["artifactPath"])
    LOGGER.info("benchmark model_id=%s artifact_path=%s exists=%s", model_id, artifact_path, artifact_path.exists())
    if not artifact_path.exists():
        raise MissingArtifactError("Model artifact is missing. Retrain the model before benchmarking it.", model_id=model_id)

    set_transient_status(model_id, "benchmarking")
    try:
        _, x_test, _, y_test, _, _ = prepare_training_data()
        trained_model = joblib.load(artifact_path)
        metrics = evaluate_model(trained_model, x_test, y_test)
        updates = {**metrics, "lastBenchmarkedAt": now_iso(), "status": "live" if model.get("isActive") else "idle"}
    except MissingDatasetError:
        raise
    except Exception as exc:
        LOGGER.exception("benchmark failed model_id=%s artifact_path=%s", model_id, artifact_path)
        raise ModelRegistryError("ML service failed while benchmarking the model.", model_id=model_id) from exc
    return update_model(model_id, updates)


def retrain_model(model_id: str) -> dict[str, Any]:
    model = get_model(model_id)
    if not model.get("isEnabled"):
        raise InvalidModelActionError("Disabled models cannot be retrained. Enable the model first.", model_id=model_id)

    set_transient_status(model_id, "training")
    LOGGER.info("retrain model_id=%s artifact_path=%s", model_id, resolve_repo_path(model["artifactPath"]))
    try:
        metrics, _ = train_and_save_model(model_id, model)
    except MissingDatasetError:
        raise
    except Exception as exc:
        LOGGER.exception("retrain failed model_id=%s", model_id)
        raise ModelRegistryError("ML service failed while retraining the model.", model_id=model_id) from exc

    version = bump_version(str(model.get("version") or "v1.0.0"))
    updates = {
        **metrics,
        "version": version,
        "lastTrainedAt": now_iso(),
        "lastBenchmarkedAt": now_iso(),
        "status": "live" if model.get("isActive") else "idle",
    }
    return update_model(model_id, updates)


def train_and_save_model(model_id: str, model: dict[str, Any]) -> tuple[dict[str, Any], Any]:
    x_train, x_test, y_train, y_test, columns, scaler = prepare_training_data()
    classifier = classifier_for(model_id)
    classifier.fit(x_train, y_train)
    metrics = evaluate_model(classifier, x_test, y_test)

    artifact_path = resolve_repo_path(model["artifactPath"])
    artifact_path.parent.mkdir(parents=True, exist_ok=True)
    joblib.dump(classifier, artifact_path)

    if model_id == "random_forest":
        shutil.copyfile(artifact_path, BEST_MODEL_PATH)
        shutil.copyfile(artifact_path, COMPATIBILITY_MODEL_PATH)

    joblib.dump(columns, COLUMNS_PATH)
    joblib.dump(scaler, SCALER_PATH)
    return metrics, classifier


def bump_version(version: str) -> str:
    raw = version[1:] if version.startswith("v") else version
    parts = raw.split(".")
    try:
        major, minor, patch = (int(parts[0]), int(parts[1]), int(parts[2]))
    except (IndexError, ValueError):
        return "v1.0.1"
    return f"v{major}.{minor}.{patch + 1}"
