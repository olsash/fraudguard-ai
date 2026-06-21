from __future__ import annotations

import argparse
import json
import sys
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen


DEFAULT_BASE_URL = "http://127.0.0.1:8000"
PREDICTED_CLASS_KEYS = ("predictedClass", "predicted_class")
PROBABILITY_OR_SCORE_KEYS = ("fraudProbability", "fraud_probability", "riskScore", "risk_score")
MODEL_NAME_KEYS = ("modelName", "model_name")

SAMPLES = {
    "low-risk": {
        "transactionType": "PAYMENT",
        "amount": 24.50,
        "oldBalanceOrigin": 500.00,
        "newBalanceOrigin": 475.50,
        "oldBalanceDestination": 1200.00,
        "newBalanceDestination": 1224.50,
    },
    "high-risk": {
        "transactionType": "TRANSFER",
        "amount": 750000.00,
        "oldBalanceOrigin": 750000.00,
        "newBalanceOrigin": 0.00,
        "oldBalanceDestination": 0.00,
        "newBalanceDestination": 0.00,
    },
}


def post_prediction(base_url: str, sample: dict[str, Any], timeout_seconds: float) -> dict[str, Any]:
    url = f"{base_url.rstrip('/')}/predict"
    body = json.dumps(sample).encode("utf-8")
    request = Request(
        url,
        data=body,
        headers={"Content-Type": "application/json"},
        method="POST",
    )

    with urlopen(request, timeout=timeout_seconds) as response:
        return json.loads(response.read().decode("utf-8"))


def read_first(response: dict[str, Any], keys: tuple[str, ...]) -> Any:
    for key in keys:
        if key in response:
            return response[key]
    return None


def validate_response(name: str, response: dict[str, Any]) -> None:
    predicted_class = read_first(response, PREDICTED_CLASS_KEYS)
    probability_or_score = read_first(response, PROBABILITY_OR_SCORE_KEYS)

    missing_fields = []
    if predicted_class in (None, ""):
        missing_fields.append("predictedClass")
    if probability_or_score is None:
        missing_fields.append("fraudProbability or riskScore")

    if missing_fields:
        raise ValueError(f"{name} response is missing required field(s): {', '.join(missing_fields)}")


def run_smoke_test(base_url: str, timeout_seconds: float) -> int:
    print(f"Running ML prediction smoke test against {base_url.rstrip('/')}/predict", flush=True)

    for name, sample in SAMPLES.items():
        try:
            response = post_prediction(base_url, sample, timeout_seconds)
            validate_response(name, response)
        except HTTPError as error:
            detail = error.read().decode("utf-8", errors="replace")
            print(f"FAIL {name}: API returned HTTP {error.code}. {detail}", file=sys.stderr)
            return 1
        except URLError as error:
            print(
                f"FAIL {name}: could not reach the ML prediction API. "
                "Start it from the ml folder with `python -m uvicorn api.app:app --host 127.0.0.1 --port 8000`.",
                file=sys.stderr,
            )
            print(f"Connection detail: {error.reason}", file=sys.stderr)
            return 1
        except (TimeoutError, json.JSONDecodeError, ValueError) as error:
            print(f"FAIL {name}: {error}", file=sys.stderr)
            return 1

        predicted_class = read_first(response, PREDICTED_CLASS_KEYS)
        probability = read_first(response, ("fraudProbability", "fraud_probability"))
        risk_score = read_first(response, ("riskScore", "risk_score"))
        model_name = read_first(response, MODEL_NAME_KEYS) or "not provided"

        score_text = f"riskScore={risk_score}" if risk_score is not None else f"fraudProbability={probability}"
        print(f"PASS {name}: predictedClass={predicted_class}, {score_text}, modelName={model_name}")

    print("Smoke test completed successfully.")
    return 0


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Smoke test the FraudGuard ML prediction API.")
    parser.add_argument(
        "--base-url",
        default=DEFAULT_BASE_URL,
        help=f"Base URL for the ML API. Default: {DEFAULT_BASE_URL}",
    )
    parser.add_argument(
        "--timeout",
        type=float,
        default=10.0,
        help="Request timeout in seconds. Default: 10",
    )
    return parser.parse_args()


if __name__ == "__main__":
    args = parse_args()
    raise SystemExit(run_smoke_test(args.base_url, args.timeout))
