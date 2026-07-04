import json
import unittest

import joblib
import numpy as np
import onnxruntime as ort
import pandas as pd

from ml.paths import BEST_MODEL_PATH, COLUMNS_PATH, ONNX_METADATA_PATH, ONNX_MODEL_PATH, SCALER_PATH
from ml.preprocessing import preprocess_prediction_data


class OnnxExportParityTests(unittest.TestCase):
    def test_python_model_and_onnx_probabilities_match_for_reference_samples(self):
        self.assertTrue(ONNX_MODEL_PATH.exists(), f"ONNX model missing at {ONNX_MODEL_PATH}")
        self.assertTrue(ONNX_METADATA_PATH.exists(), f"ONNX metadata missing at {ONNX_METADATA_PATH}")

        model = joblib.load(BEST_MODEL_PATH)
        columns = joblib.load(COLUMNS_PATH)
        scaler = joblib.load(SCALER_PATH) if SCALER_PATH.exists() else None
        metadata = json.loads(ONNX_METADATA_PATH.read_text(encoding="utf-8"))

        samples = pd.DataFrame(
            [
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
        )

        frame = preprocess_prediction_data(
            samples,
            columns=columns,
            scaler=scaler,
            scale_numeric=scaler is not None,
        ).astype(np.float32)

        fraud_index = metadata["probabilityClassIndex"]
        expected_probabilities = model.predict_proba(frame)[:, fraud_index]
        expected_labels = model.predict(frame)

        session = ort.InferenceSession(str(ONNX_MODEL_PATH), providers=["CPUExecutionProvider"])
        outputs = session.run(
            [metadata["probabilityOutputName"]],
            build_onnx_inputs(samples, metadata),
        )
        actual_probabilities = np.asarray(outputs[0])[:, fraud_index]
        threshold_labels = (actual_probabilities >= metadata["classificationThreshold"]).astype(int)

        np.testing.assert_allclose(actual_probabilities, expected_probabilities, rtol=1e-5, atol=1e-5)
        np.testing.assert_array_equal(threshold_labels, expected_labels)


def build_onnx_inputs(samples: pd.DataFrame, metadata: dict) -> dict[str, np.ndarray]:
    if metadata.get("inputTensors"):
        inputs = {}
        for item in metadata["inputTensors"]:
            feature = item["feature"]
            if feature == "type":
                inputs[item["name"]] = samples[[feature]].astype(str).to_numpy()
            else:
                inputs[item["name"]] = samples[[feature]].to_numpy(dtype=np.float32)
        return inputs

    frame = preprocess_prediction_data(
        samples,
        columns=metadata["columnOrder"],
        scaler=joblib.load(SCALER_PATH) if SCALER_PATH.exists() else None,
        scale_numeric=SCALER_PATH.exists(),
    ).astype(np.float32)
    return {metadata["inputTensorName"]: frame.to_numpy(dtype=np.float32)}


if __name__ == "__main__":
    unittest.main()
