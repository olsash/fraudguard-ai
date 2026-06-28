from __future__ import annotations

import json
from pathlib import Path

from paths import (
    BEST_MODEL_PATH,
    BEST_MODEL_REGISTRY_PATH,
    CLUSTERING_RESULTS_CSV_PATH,
    CLUSTERING_RESULTS_JSON_PATH,
    COLUMNS_PATH,
    COMPATIBILITY_MODEL_PATH,
    FEATURE_IMPORTANCE_CSV_PATH,
    FEATURE_IMPORTANCE_JSON_PATH,
    KMEANS_PCA_CLUSTERS_PATH,
    KMEANS_PCA_TRUE_LABELS_PATH,
    MODEL_COMPARISON_CSV_PATH,
    MODEL_COMPARISON_JSON_PATH,
    SCALER_PATH,
    TRAINING_METADATA_PATH,
)


EXPECTED_FILES = [
    MODEL_COMPARISON_JSON_PATH,
    MODEL_COMPARISON_CSV_PATH,
    Path(__file__).resolve().parent / "results" / "confusion_matrices.json",
    Path(__file__).resolve().parent / "results" / "confusion_matrices.csv",
    FEATURE_IMPORTANCE_JSON_PATH,
    FEATURE_IMPORTANCE_CSV_PATH,
    CLUSTERING_RESULTS_JSON_PATH,
    CLUSTERING_RESULTS_CSV_PATH,
    KMEANS_PCA_CLUSTERS_PATH,
    KMEANS_PCA_TRUE_LABELS_PATH,
    BEST_MODEL_PATH,
    COMPATIBILITY_MODEL_PATH,
    COLUMNS_PATH,
    SCALER_PATH,
    BEST_MODEL_REGISTRY_PATH,
    TRAINING_METADATA_PATH,
]

JSON_FILES = [
    MODEL_COMPARISON_JSON_PATH,
    Path(__file__).resolve().parent / "results" / "confusion_matrices.json",
    FEATURE_IMPORTANCE_JSON_PATH,
    CLUSTERING_RESULTS_JSON_PATH,
    BEST_MODEL_REGISTRY_PATH,
    TRAINING_METADATA_PATH,
]


def main() -> None:
    missing_or_empty = [path for path in EXPECTED_FILES if not path.exists() or path.stat().st_size == 0]
    if missing_or_empty:
        formatted = "\n".join(f"- {path}" for path in missing_or_empty)
        raise SystemExit(f"Missing or empty notebook output files:\n{formatted}")

    for path in JSON_FILES:
        with path.open("r", encoding="utf-8") as file:
            json.load(file)

    print(f"Validated {len(EXPECTED_FILES)} notebook output files.")


if __name__ == "__main__":
    main()
