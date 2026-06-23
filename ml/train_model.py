from pathlib import Path
import hashlib
import json

import joblib
import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt
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

from ml.preprocessing import FEATURES, TARGET, preprocess_training_data, validate_dataset


ROOT = Path(__file__).resolve().parent
DATASET_PATH = ROOT / "dataset" / "fraud.csv"
MODEL_DIR = ROOT / "models"
RESULTS_DIR = ROOT / "results"
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
        "pcaClusterPlotPath": "ml/results/kmeans_pca_clusters.png",
        "pcaTrueLabelPlotPath": "ml/results/kmeans_pca_true_labels.png",
        "clusteringResults": results,
    }

    json_path = RESULTS_DIR / "clustering_results.json"
    csv_path = RESULTS_DIR / "clustering_results.csv"
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

    cluster_plot_path = RESULTS_DIR / "kmeans_pca_clusters.png"
    true_label_plot_path = RESULTS_DIR / "kmeans_pca_true_labels.png"
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
    export_clustering_results(x, y)

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
