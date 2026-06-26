from pathlib import Path
from datetime import datetime, timezone
import hashlib
import json

import joblib
import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
import sklearn
from sklearn.cluster import KMeans
from sklearn.decomposition import PCA
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import (
    accuracy_score,
    adjusted_rand_score,
    confusion_matrix,
    f1_score,
    precision_score,
    recall_score,
    roc_auc_score,
    silhouette_score,
)
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler

from ml.paths import (
    BEST_MODEL_PATH,
    BEST_MODEL_REGISTRY_PATH,
    CLUSTERING_RESULTS_CSV_PATH,
    CLUSTERING_RESULTS_JSON_PATH,
    COLUMNS_PATH,
    COMPATIBILITY_MODEL_PATH,
    DATASET_PATH,
    FEATURE_IMPORTANCE_CSV_PATH,
    FEATURE_IMPORTANCE_JSON_PATH,
    KMEANS_PCA_CLUSTERS_PATH,
    KMEANS_PCA_TRUE_LABELS_PATH,
    MODEL_DIR,
    MODEL_COMPARISON_CSV_PATH,
    MODEL_COMPARISON_JSON_PATH,
    RESULTS_DIR,
    SCALER_PATH,
    SHAP_FEATURE_IMPORTANCE_CSV_PATH,
    SHAP_FEATURE_IMPORTANCE_JSON_PATH,
    SHAP_FEATURE_IMPORTANCE_PLOT_PATH,
    TRAINING_METADATA_PATH,
    repo_relative,
)
from ml.preprocessing import FEATURES, TARGET, preprocess_training_data, validate_dataset


RANDOM_SEED = 42
MAX_NON_FRAUD_ROWS = 250_000
NON_FRAUD_TO_FRAUD_RATIO = 20
SCALE_NUMERIC_FEATURES = False
CLUSTERING_K_VALUES = [2, 3, 4, 5, 6, 8, 10]
CLUSTERING_INIT_METHODS = ["k-means++", "random"]
CLUSTERING_N_INIT_VALUES = [10]
CLUSTERING_SAMPLE_SIZE = 50_000
CLUSTERING_SILHOUETTE_SAMPLE_SIZE = 10_000
PCA_PLOT_SAMPLE_SIZE = 10_000
SHAP_SAMPLE_SIZE = 1_000


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
    print(f"Training classifier: {model_name}")
    model.fit(x_train, y_train)
    print(f"Evaluating classifier: {model_name}")
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


def select_best_model(evaluated_models: list[tuple[dict, object]], selected_metric: str = "f1") -> tuple[dict, object]:
    if not evaluated_models:
        raise ValueError("No evaluated models are available for best model selection.")

    return max(evaluated_models, key=lambda item: item[0].get(selected_metric, 0))


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


def export_model_comparison_results(
    evaluated_models: list[tuple[dict, object]],
    best_metrics: dict,
) -> None:
    RESULTS_DIR.mkdir(parents=True, exist_ok=True)
    models = [
        build_model_comparison_item(metrics, model, metrics["model"] == best_metrics["model"])
        for metrics, model in evaluated_models
    ]
    payload = {
        "datasetName": "PaySim-style online payment fraud dataset",
        "problemType": "Binary classification",
        "targetVariable": TARGET,
        "bestModelName": best_metrics["model"],
        "bestModelReason": (
            f"{best_metrics['model']} was selected by the retraining command because it had the "
            f"highest F1-score ({best_metrics['f1']:.4f}) among the trained classifiers."
        ),
        "evaluationSource": {
            "source": "ml/train_model.py",
            "datasetPath": repo_relative(DATASET_PATH),
            "randomSeed": RANDOM_SEED,
            "selectionMetric": "f1",
        },
        "models": models,
    }

    with MODEL_COMPARISON_JSON_PATH.open("w", encoding="utf-8") as file:
        json.dump(payload, file, indent=2, default=str)

    comparison_rows = []
    for model in models:
        cm = model["confusionMatrix"]
        comparison_rows.append(
            {
                "modelName": model["modelName"],
                "modelType": model["modelType"],
                "accuracy": model["accuracy"],
                "precision": model["precision"],
                "recall": model["recall"],
                "f1Score": model["f1Score"],
                "rocAuc": model["rocAuc"],
                "trueNegatives": cm["trueNegatives"],
                "falsePositives": cm["falsePositives"],
                "falseNegatives": cm["falseNegatives"],
                "truePositives": cm["truePositives"],
                "status": model["status"],
                "isBestModel": model["isBestModel"],
                "selectedHyperparameters": json.dumps(model["hyperparameters"]["selected"], default=str),
            }
        )

    pd.DataFrame(comparison_rows).to_csv(MODEL_COMPARISON_CSV_PATH, index=False)
    print(f"Saved model comparison results to {MODEL_COMPARISON_JSON_PATH}")
    print(f"Saved model comparison CSV to {MODEL_COMPARISON_CSV_PATH}")


def build_model_comparison_item(metrics: dict, model, is_best_model: bool) -> dict:
    cm = metrics["confusion_matrix"]
    return {
        "modelName": metrics["model"],
        "modelType": model.__class__.__name__,
        "accuracy": metrics["accuracy"],
        "precision": metrics["precision"],
        "recall": metrics["recall"],
        "f1Score": metrics["f1"],
        "rocAuc": metrics.get("roc_auc"),
        "confusionMatrix": {
            "trueNegatives": cm["true_negatives"],
            "falsePositives": cm["false_positives"],
            "falseNegatives": cm["false_negatives"],
            "truePositives": cm["true_positives"],
        },
        "status": "Best Model" if is_best_model else "Tested",
        "shortDescription": (
            "Selected by the retraining command as the best available classifier."
            if is_best_model
            else "Evaluated by the retraining command for comparison with the selected model."
        ),
        "isBestModel": is_best_model,
        "hyperparameters": {
            "tested": {},
            "selected": model.get_params(),
        },
    }


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

    with FEATURE_IMPORTANCE_JSON_PATH.open("w", encoding="utf-8") as file:
        json.dump(payload, file, indent=2, default=float)

    feature_importance.to_csv(FEATURE_IMPORTANCE_CSV_PATH, index=False)
    print(f"Saved feature importance results to {FEATURE_IMPORTANCE_JSON_PATH}")


def export_shap_feature_importance(
    model,
    model_name: str,
    x_sample_source: pd.DataFrame,
    feature_columns: list[str],
) -> dict | None:
    if model.__class__.__name__ != "RandomForestClassifier":
        print(f"Skipping SHAP export: {model.__class__.__name__} is not configured for TreeExplainer export.")
        return None

    try:
        import shap
    except ImportError:
        print("Skipping SHAP export: shap is not installed in the active environment.")
        return None

    if x_sample_source.empty:
        print("Skipping SHAP export: no feature rows are available.")
        return None

    RESULTS_DIR.mkdir(parents=True, exist_ok=True)
    sample_size = min(SHAP_SAMPLE_SIZE, len(x_sample_source))
    shap_sample = x_sample_source.sample(n=sample_size, random_state=RANDOM_SEED)

    try:
        explainer = shap.TreeExplainer(model)
        shap_values = explainer.shap_values(shap_sample)
        shap_values_for_fraud = select_positive_class_shap_values(shap_values)
    except Exception as exc:
        print(f"Skipping SHAP export: SHAP could not explain the selected model ({exc}).")
        return None

    mean_abs_shap = np.abs(shap_values_for_fraud).mean(axis=0)
    if len(mean_abs_shap) != len(feature_columns):
        print(
            "Skipping SHAP export: SHAP feature count "
            f"({len(mean_abs_shap)}) does not match encoded feature columns ({len(feature_columns)})."
        )
        return None

    shap_importance = (
        pd.DataFrame(
            {
                "featureName": feature_columns,
                "meanAbsoluteShapValue": mean_abs_shap,
            }
        )
        .sort_values(by="meanAbsoluteShapValue", ascending=False)
        .reset_index(drop=True)
    )

    payload = {
        "source": "ml/train_model.py",
        "modelName": model_name,
        "modelType": model.__class__.__name__,
        "method": "shap.TreeExplainer",
        "targetClass": "fraud",
        "sampleSize": int(sample_size),
        "randomSeed": RANDOM_SEED,
        "results": shap_importance.to_dict(orient="records"),
    }

    with SHAP_FEATURE_IMPORTANCE_JSON_PATH.open("w", encoding="utf-8") as file:
        json.dump(payload, file, indent=2, default=float)

    shap_importance.to_csv(SHAP_FEATURE_IMPORTANCE_CSV_PATH, index=False)
    save_shap_feature_importance_plot(shap_importance)
    print(f"Saved SHAP feature importance results to {SHAP_FEATURE_IMPORTANCE_JSON_PATH}")
    return {
        "json": repo_relative(SHAP_FEATURE_IMPORTANCE_JSON_PATH),
        "csv": repo_relative(SHAP_FEATURE_IMPORTANCE_CSV_PATH),
        "plot": repo_relative(SHAP_FEATURE_IMPORTANCE_PLOT_PATH),
        "sampleSize": int(sample_size),
    }


def select_positive_class_shap_values(shap_values):
    if isinstance(shap_values, list):
        if len(shap_values) < 2:
            raise ValueError("expected SHAP values for at least two classes")
        return np.asarray(shap_values[1])

    shap_array = np.asarray(shap_values)
    if shap_array.ndim == 3:
        if shap_array.shape[2] >= 2:
            return shap_array[:, :, 1]
        if shap_array.shape[0] >= 2:
            return shap_array[1]
        raise ValueError("expected a binary-class SHAP array")

    if shap_array.ndim != 2:
        raise ValueError(f"expected a 2D SHAP array, got shape {shap_array.shape}")

    return shap_array


def save_shap_feature_importance_plot(shap_importance: pd.DataFrame) -> None:
    plot_data = shap_importance.head(15).sort_values(by="meanAbsoluteShapValue")
    fig, ax = plt.subplots(figsize=(9, 6))
    ax.barh(plot_data["featureName"], plot_data["meanAbsoluteShapValue"], color="#2563eb")
    ax.set_title("Global SHAP Feature Importance for Fraud Prediction")
    ax.set_xlabel("Mean absolute SHAP value")
    ax.set_ylabel("Feature")
    ax.grid(axis="x", alpha=0.2)
    fig.tight_layout()
    fig.savefig(SHAP_FEATURE_IMPORTANCE_PLOT_PATH, dpi=150)
    plt.close(fig)


def export_best_model_registry(
    best_metrics: dict,
    best_model,
    feature_columns: list[str],
    shap_artifacts: dict | None,
) -> None:
    RESULTS_DIR.mkdir(parents=True, exist_ok=True)
    selected_metric = "f1"
    registry = {
        "source": "ml/train_model.py",
        "modelName": best_metrics["model"],
        "selectedMetric": selected_metric,
        "metricScore": float(best_metrics[selected_metric]),
        "selectedHyperparameters": best_model.get_params(),
        "trainingDateUtc": datetime.now(timezone.utc).isoformat(),
        "featureColumns": feature_columns,
        "modelArtifact": repo_relative(BEST_MODEL_PATH),
        "compatibilityModelArtifact": repo_relative(COMPATIBILITY_MODEL_PATH),
        "columnsArtifact": repo_relative(COLUMNS_PATH),
        "scalerArtifact": repo_relative(SCALER_PATH),
        "shapFeatureImportance": shap_artifacts,
    }

    with BEST_MODEL_REGISTRY_PATH.open("w", encoding="utf-8") as file:
        json.dump(registry, file, indent=2, default=str)

    print(f"Saved best model registry to {BEST_MODEL_REGISTRY_PATH}")


def export_clustering_results(features: pd.DataFrame, labels: pd.Series) -> None:
    if features.empty or labels.empty:
        print("Skipping clustering export: no feature rows available.")
        return

    RESULTS_DIR.mkdir(parents=True, exist_ok=True)
    sample_size = min(len(features), CLUSTERING_SAMPLE_SIZE)
    sampled_features = features.sample(n=sample_size, random_state=RANDOM_SEED)
    sampled_labels = labels.loc[sampled_features.index]

    scaled_features = StandardScaler().fit_transform(sampled_features)
    results = []
    cluster_assignments_by_config = {}

    for k_value in CLUSTERING_K_VALUES:
        if k_value >= sample_size:
            continue

        for init_method in CLUSTERING_INIT_METHODS:
            for n_init in CLUSTERING_N_INIT_VALUES:
                kmeans = KMeans(
                    n_clusters=k_value,
                    init=init_method,
                    n_init=n_init,
                    random_state=RANDOM_SEED,
                )
                clusters = kmeans.fit_predict(scaled_features)
                config_key = (k_value, init_method, n_init)
                cluster_assignments_by_config[config_key] = clusters

                results.append(
                    {
                        "algorithmName": "KMeans",
                        "k": int(k_value),
                        "initializationMethod": init_method,
                        "nInit": int(n_init),
                        "inertia": float(kmeans.inertia_),
                        "silhouetteScore": float(
                            silhouette_score(
                                scaled_features,
                                clusters,
                                sample_size=min(CLUSTERING_SILHOUETTE_SAMPLE_SIZE, sample_size),
                                random_state=RANDOM_SEED,
                            )
                        ),
                        # The target label is used only after clustering to compare cluster assignments.
                        "adjustedRandIndex": float(adjusted_rand_score(sampled_labels, clusters)),
                    }
                )

    if not results:
        print("Skipping clustering export: no valid KMeans configurations were evaluated.")
        return

    best_result = max(results, key=lambda item: item["silhouetteScore"])
    best_config_key = (
        best_result["k"],
        best_result["initializationMethod"],
        best_result["nInit"],
    )
    best_clusters = cluster_assignments_by_config[best_config_key]
    tested_k_values = sorted({item["k"] for item in results})
    for result in results:
        result["testedKValues"] = tested_k_values
        result["bestK"] = int(best_result["k"])
        result["isBest"] = (
            result["k"] == best_result["k"]
            and result["initializationMethod"] == best_result["initializationMethod"]
            and result["nInit"] == best_result["nInit"]
        )

    payload = {
        "source": "ml/train_model.py",
        "algorithmName": "KMeans",
        "targetExcludedDuringTraining": True,
        "targetUsedForComparisonOnly": TARGET,
        "sampleSize": int(sample_size),
        "randomSeed": RANDOM_SEED,
        "selectionMetric": "silhouetteScore",
        "testedKValues": tested_k_values,
        "bestK": int(best_result["k"]),
        "pcaClusterPlotPath": repo_relative(KMEANS_PCA_CLUSTERS_PATH),
        "pcaTrueLabelPlotPath": repo_relative(KMEANS_PCA_TRUE_LABELS_PATH),
        "clusteringResults": results,
    }

    json_path = CLUSTERING_RESULTS_JSON_PATH
    csv_path = CLUSTERING_RESULTS_CSV_PATH
    with json_path.open("w", encoding="utf-8") as file:
        json.dump(payload, file, indent=2, default=float)

    pd.DataFrame(results).to_csv(csv_path, index=False)
    export_pca_clustering_plots(scaled_features, sampled_labels, best_clusters, best_result)
    print(f"Saved clustering results to {json_path}")


def export_pca_clustering_plots(
    scaled_features,
    true_labels: pd.Series,
    clusters,
    best_result: dict,
) -> None:
    pca_coordinates = PCA(n_components=2, random_state=RANDOM_SEED).fit_transform(scaled_features)
    plot_data = pd.DataFrame(
        {
            "pca1": pca_coordinates[:, 0],
            "pca2": pca_coordinates[:, 1],
            "cluster": clusters,
            "isFraud": true_labels.astype(int).to_numpy(),
        }
    )

    if len(plot_data) > PCA_PLOT_SAMPLE_SIZE:
        plot_data = plot_data.sample(n=PCA_PLOT_SAMPLE_SIZE, random_state=RANDOM_SEED)

    cluster_plot_path = KMEANS_PCA_CLUSTERS_PATH
    true_label_plot_path = KMEANS_PCA_TRUE_LABELS_PATH
    title_suffix = (
        f"k={best_result['k']}, init={best_result['initializationMethod']}, "
        f"n_init={best_result['nInit']}"
    )

    save_pca_scatter_plot(
        plot_data,
        color_column="cluster",
        title=f"KMeans clusters projected with PCA ({title_suffix})",
        colorbar_label="Cluster",
        output_path=cluster_plot_path,
    )
    save_pca_scatter_plot(
        plot_data,
        color_column="isFraud",
        title="True fraud labels projected with PCA",
        colorbar_label="isFraud",
        output_path=true_label_plot_path,
    )
    print(f"Saved PCA clustering plots to {cluster_plot_path} and {true_label_plot_path}")


def save_pca_scatter_plot(
    plot_data: pd.DataFrame,
    *,
    color_column: str,
    title: str,
    colorbar_label: str,
    output_path: Path,
) -> None:
    fig, ax = plt.subplots(figsize=(9, 6))
    scatter = ax.scatter(
        plot_data["pca1"],
        plot_data["pca2"],
        c=plot_data[color_column],
        cmap="tab10" if color_column == "cluster" else "coolwarm",
        s=8,
        alpha=0.7,
        linewidths=0,
    )
    ax.set_title(title)
    ax.set_xlabel("Principal component 1")
    ax.set_ylabel("Principal component 2")
    ax.grid(alpha=0.2)
    colorbar = fig.colorbar(scatter, ax=ax)
    colorbar.set_label(colorbar_label)
    fig.tight_layout()
    fig.savefig(output_path, dpi=150)
    plt.close(fig)


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
    print("Starting FraudGuard ML retraining pipeline.")
    print("[1/8] Loading dataset.")
    data = load_dataset()
    print_class_distribution(data[TARGET], "Original class distribution:")

    print("[2/8] Preparing class-balanced training sample.")
    fraud = data[data[TARGET] == 1]
    non_fraud = data[data[TARGET] == 0]
    non_fraud_rows = min(len(non_fraud), max(MAX_NON_FRAUD_ROWS, len(fraud) * NON_FRAUD_TO_FRAUD_RATIO))

    if len(fraud) > 0 and len(non_fraud) > non_fraud_rows:
        non_fraud = non_fraud.sample(n=non_fraud_rows, random_state=RANDOM_SEED)
        data = pd.concat([fraud, non_fraud], ignore_index=True).sample(frac=1, random_state=RANDOM_SEED)
        print_class_distribution(data[TARGET], "\nTraining sample class distribution:")

    print("[3/8] Preprocessing data.")
    x, y, preprocessing_artifacts = preprocess_training_data(
        data,
        scale_numeric=SCALE_NUMERIC_FEATURES,
    )

    print("[4/8] Splitting train/test data.")
    x_train, x_test, y_train, y_test = train_test_split(
        x,
        y,
        test_size=0.2,
        random_state=RANDOM_SEED,
        stratify=y if y.nunique() > 1 else None,
    )

    print("[5/8] Training and evaluating classifiers.")
    baseline_metrics, baseline_model = evaluate_classifier(
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
    balanced_metrics, balanced_model = evaluate_classifier(
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

    evaluated_models = [
        (baseline_metrics, baseline_model),
        (balanced_metrics, balanced_model),
    ]
    best_metrics, best_model = select_best_model(evaluated_models, selected_metric="f1")
    print(f"\nSelected best model by F1-score: {best_metrics['model']} ({best_metrics['f1']:.4f})")

    print("[6/8] Saving best model, scaler, columns, and comparison results.")
    MODEL_DIR.mkdir(parents=True, exist_ok=True)
    joblib.dump(best_model, BEST_MODEL_PATH)
    joblib.dump(best_model, COMPATIBILITY_MODEL_PATH)
    joblib.dump(preprocessing_artifacts.columns, COLUMNS_PATH)
    joblib.dump(preprocessing_artifacts.scaler, SCALER_PATH)
    print(f"Saved best model artifact to {BEST_MODEL_PATH}")
    print(f"Saved compatibility model artifact to {COMPATIBILITY_MODEL_PATH}")
    print(f"Saved encoded columns to {COLUMNS_PATH}")
    print(f"Saved scaler artifact to {SCALER_PATH}")
    export_model_comparison_results(evaluated_models, best_metrics)
    export_feature_importance(best_model, preprocessing_artifacts.columns)

    print("[7/8] Exporting optional explainability and clustering results.")
    shap_artifacts = export_shap_feature_importance(
        best_model,
        best_metrics["model"],
        x_test,
        preprocessing_artifacts.columns,
    )
    export_best_model_registry(best_metrics, best_model, preprocessing_artifacts.columns, shap_artifacts)
    export_clustering_results(x, y)

    print("[8/8] Writing training metadata.")
    metadata = {
        "random_seed": RANDOM_SEED,
        "dataset": dataset_metadata(),
        "sklearn_version": sklearn.__version__,
        "features": FEATURES,
        "encoded_columns": preprocessing_artifacts.columns,
        "scale_numeric_features": preprocessing_artifacts.scale_numeric,
        "scaler_artifact": repo_relative(SCALER_PATH),
        "target": TARGET,
        "model": {
            "type": "RandomForestClassifier",
            "parameters": best_model.get_params(),
        },
        "best_model_registry": repo_relative(BEST_MODEL_REGISTRY_PATH),
        "shap_feature_importance": shap_artifacts,
        "imbalance_handling": {
            "baseline_metrics": baseline_metrics,
            "balanced_metrics": balanced_metrics,
        },
        "metrics": best_metrics,
    }

    with TRAINING_METADATA_PATH.open("w", encoding="utf-8") as metadata_file:
        json.dump(metadata, metadata_file, indent=2)

    print(f"Saved training metadata to {TRAINING_METADATA_PATH}")
    print("FraudGuard ML retraining pipeline completed successfully.")


if __name__ == "__main__":
    main()
