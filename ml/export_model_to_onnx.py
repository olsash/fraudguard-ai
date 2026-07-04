from __future__ import annotations

from datetime import datetime, timezone
import json
from pathlib import Path
import sys
from typing import Any

import joblib
import numpy as np
import onnx
import onnxruntime as ort
import pandas as pd
from skl2onnx import convert_sklearn
from skl2onnx.common.data_types import FloatTensorType, StringTensorType

REPOSITORY_ROOT = Path(__file__).resolve().parents[1]
if str(REPOSITORY_ROOT) not in sys.path:
    sys.path.insert(0, str(REPOSITORY_ROOT))

from ml.paths import (
    BEST_MODEL_PATH,
    BEST_MODEL_REGISTRY_PATH,
    COLUMNS_PATH,
    FULL_PIPELINE_MODEL_PATH,
    ONNX_METADATA_PATH,
    ONNX_MODEL_PATH,
    SCALER_PATH,
    TRAINING_METADATA_PATH,
    repo_relative,
)
from ml.preprocessing import FEATURES, NUMERIC_COLUMNS, TARGET, TYPE_COLUMN, preprocess_prediction_data, validate_encoded_columns
from ml.train_model import TRANSACTION_TYPES, build_full_prediction_pipeline


MODEL_VERSION_FALLBACK = "onnx-local-1"
CLASSIFICATION_THRESHOLD = 0.5


def load_json(path: Path) -> dict[str, Any]:
    if not path.exists():
        return {}
    with path.open("r", encoding="utf-8") as file:
        return json.load(file)


def export_onnx() -> tuple[Path, dict[str, Any]]:
    if not BEST_MODEL_PATH.exists():
        raise FileNotFoundError(f"Expected trained model artifact at {BEST_MODEL_PATH}. Run python retrain_models.py first.")
    if not COLUMNS_PATH.exists():
        raise FileNotFoundError(f"Expected feature columns artifact at {COLUMNS_PATH}. Run python retrain_models.py first.")

    model = joblib.load(BEST_MODEL_PATH)
    columns = validate_encoded_columns(joblib.load(COLUMNS_PATH))
    scaler = joblib.load(SCALER_PATH) if SCALER_PATH.exists() else None
    pipeline = load_or_build_full_pipeline(model, scaler)
    classes = [int(value) for value in list(getattr(model, "classes_", [0, 1]))]
    if 1 not in classes:
        raise ValueError(f"Fraud class 1 is missing from model classes: {classes}")

    initial_types = [
        ("type", StringTensorType([None, 1])),
        ("amount", FloatTensorType([None, 1])),
        ("oldbalanceOrg", FloatTensorType([None, 1])),
        ("newbalanceOrig", FloatTensorType([None, 1])),
        ("oldbalanceDest", FloatTensorType([None, 1])),
        ("newbalanceDest", FloatTensorType([None, 1])),
    ]
    onnx_model = convert_sklearn(
        pipeline,
        initial_types=initial_types,
        target_opset=17,
        options={id(pipeline.named_steps["classifier"]): {"zipmap": False}},
    )

    ONNX_MODEL_PATH.parent.mkdir(parents=True, exist_ok=True)
    ONNX_MODEL_PATH.write_bytes(onnx_model.SerializeToString())
    onnx.checker.check_model(str(ONNX_MODEL_PATH))

    session = ort.InferenceSession(str(ONNX_MODEL_PATH), providers=["CPUExecutionProvider"])
    inputs = session.get_inputs()
    input_name = inputs[0].name
    input_tensors = [
        {
            "name": item.name,
            "feature": item.name,
            "type": item.type,
            "shape": [str(dimension) for dimension in item.shape],
        }
        for item in inputs
    ]
    output_names = [output.name for output in session.get_outputs()]
    probability_output_name = select_probability_output_name(session)

    training_metadata = load_json(TRAINING_METADATA_PATH)
    registry = load_json(BEST_MODEL_REGISTRY_PATH)
    model_name = registry.get("modelName") or training_metadata.get("metrics", {}).get("model") or model.__class__.__name__
    model_version = registry.get("version") or training_metadata.get("dataset", {}).get("sha256", MODEL_VERSION_FALLBACK)[:12]
    training_date = registry.get("trainingDateUtc")

    metadata = {
        "modelName": model_name,
        "modelVersion": model_version,
        "modelTrainingDate": training_date,
        "createdAtUtc": datetime.now(timezone.utc).isoformat(),
        "sourceModelArtifact": repo_relative(BEST_MODEL_PATH),
        "sourceColumnsArtifact": repo_relative(COLUMNS_PATH),
        "sourceScalerArtifact": repo_relative(SCALER_PATH) if SCALER_PATH.exists() else None,
        "inputFeatures": FEATURES,
        "numericFeatures": NUMERIC_COLUMNS,
        "transactionTypeFeature": TYPE_COLUMN,
        "transactionTypes": TRANSACTION_TYPES,
        "encodedFeatureColumns": columns,
        "columnOrder": columns,
        "inputTensorName": input_name,
        "inputTensorNames": [item["name"] for item in input_tensors],
        "inputTensors": input_tensors,
        "outputTensorNames": output_names,
        "labelOutputName": output_names[0],
        "probabilityOutputName": probability_output_name,
        "decisionUsesProbabilityThreshold": True,
        "classificationThreshold": CLASSIFICATION_THRESHOLD,
        "classes": classes,
        "fraudClass": 1,
        "probabilityClassIndex": classes.index(1),
        "usesExternalPreprocessing": False,
        "preprocessing": {
            "encoding": "ONNX ColumnTransformer one-hot encoding for transaction type",
            "scaleNumericFeatures": scaler is not None,
            "numericScaler": build_scaler_metadata(scaler),
        },
    }

    with ONNX_METADATA_PATH.open("w", encoding="utf-8") as file:
        json.dump(metadata, file, indent=2)

    verify_export(session, probability_output_name, metadata, pipeline, model, columns, scaler)
    return ONNX_MODEL_PATH, metadata


def load_or_build_full_pipeline(model, scaler):
    if FULL_PIPELINE_MODEL_PATH.exists():
        return joblib.load(FULL_PIPELINE_MODEL_PATH)

    if scaler is not None:
        raise ValueError(
            "Current artifacts require numeric scaling but no full pipeline artifact exists. "
            "Run python retrain_models.py so ml/models/fraud_model_pipeline.pkl is generated, then rerun this export."
        )

    pipeline = build_full_prediction_pipeline(model, scale_numeric=False)
    fit_frame = pd.DataFrame(
        {
            "type": TRANSACTION_TYPES,
            "amount": [0.0] * len(TRANSACTION_TYPES),
            "oldbalanceOrg": [0.0] * len(TRANSACTION_TYPES),
            "newbalanceOrig": [0.0] * len(TRANSACTION_TYPES),
            "oldbalanceDest": [0.0] * len(TRANSACTION_TYPES),
            "newbalanceDest": [0.0] * len(TRANSACTION_TYPES),
        }
    )
    pipeline.named_steps["preprocessor"].fit(fit_frame)
    pipeline.steps[-1] = ("classifier", model)
    return pipeline


def build_scaler_metadata(scaler) -> dict[str, Any] | None:
    if scaler is None:
        return None

    means = getattr(scaler, "mean_", None)
    scales = getattr(scaler, "scale_", None)
    if means is None or scales is None:
        raise ValueError("Scaler artifact does not expose mean_ and scale_.")

    return {
        "features": NUMERIC_COLUMNS,
        "mean": [float(value) for value in means],
        "scale": [float(value) for value in scales],
    }


def select_probability_output_name(session: ort.InferenceSession) -> str:
    outputs = session.get_outputs()
    for output in outputs:
        shape = output.shape
        if len(shape) == 2 and (shape[-1] in (2, "N") or isinstance(shape[-1], str)):
            return output.name
    if len(outputs) < 2:
        raise ValueError(f"Expected an ONNX probability output. Outputs found: {[output.name for output in outputs]}")
    return outputs[1].name


def verify_export(session, probability_output_name: str, metadata: dict[str, Any], pipeline, model, columns: list[str], scaler) -> None:
    samples = [
        {
            "type": "PAYMENT",
            "amount": 42.75,
            "oldbalanceOrg": 1000.0,
            "newbalanceOrig": 957.25,
            "oldbalanceDest": 500.0,
            "newbalanceDest": 542.75,
        },
        {
            "type": "TRANSFER",
            "amount": 250000.0,
            "oldbalanceOrg": 250000.0,
            "newbalanceOrig": 0.0,
            "oldbalanceDest": 0.0,
            "newbalanceDest": 250000.0,
        },
        {
            "type": "CASH_OUT",
            "amount": 1000000.0,
            "oldbalanceOrg": 1000000.0,
            "newbalanceOrig": 0.0,
            "oldbalanceDest": 0.0,
            "newbalanceDest": 1000000.0,
        },
    ]

    sample_frame = pd.DataFrame(samples)
    frame = preprocess_prediction_data(
        sample_frame,
        columns=columns,
        scaler=scaler,
        scale_numeric=scaler is not None,
    ).astype(np.float32)
    expected_probabilities = model.predict_proba(frame)[:, metadata["probabilityClassIndex"]]
    pipeline_probabilities = pipeline.predict_proba(sample_frame)[:, metadata["probabilityClassIndex"]]
    pipeline_delta = float(np.max(np.abs(expected_probabilities - pipeline_probabilities)))
    if pipeline_delta > 1e-5:
        raise ValueError(f"Pipeline probability verification failed. Max delta {pipeline_delta:.8f} exceeds tolerance.")

    onnx_inputs = build_onnx_inputs(sample_frame)
    outputs = session.run([probability_output_name], onnx_inputs)[0]
    actual_probabilities = np.asarray(outputs)[:, metadata["probabilityClassIndex"]]

    max_delta = float(np.max(np.abs(expected_probabilities - actual_probabilities)))
    if max_delta > 1e-5:
        raise ValueError(f"ONNX probability verification failed. Max delta {max_delta:.8f} exceeds tolerance.")

    metadata["verification"] = {
        "sampleCount": len(samples),
        "maxProbabilityDelta": max_delta,
        "maxPipelineProbabilityDelta": pipeline_delta,
        "verifiedAtUtc": datetime.now(timezone.utc).isoformat(),
    }
    with ONNX_METADATA_PATH.open("w", encoding="utf-8") as file:
        json.dump(metadata, file, indent=2)


def build_onnx_inputs(frame: pd.DataFrame) -> dict[str, np.ndarray]:
    return {
        "type": frame[["type"]].astype(str).to_numpy(),
        "amount": frame[["amount"]].to_numpy(dtype=np.float32),
        "oldbalanceOrg": frame[["oldbalanceOrg"]].to_numpy(dtype=np.float32),
        "newbalanceOrig": frame[["newbalanceOrig"]].to_numpy(dtype=np.float32),
        "oldbalanceDest": frame[["oldbalanceDest"]].to_numpy(dtype=np.float32),
        "newbalanceDest": frame[["newbalanceDest"]].to_numpy(dtype=np.float32),
    }


def main() -> None:
    model_path, metadata = export_onnx()
    print(f"Exported ONNX model to {model_path}")
    print(f"Exported ONNX metadata to {ONNX_METADATA_PATH}")
    print(f"Input tensor: {metadata['inputTensorName']}")
    print(f"Probability output: {metadata['probabilityOutputName']}")
    print(f"Classes: {metadata['classes']}; fraud class index: {metadata['probabilityClassIndex']}")


if __name__ == "__main__":
    main()
