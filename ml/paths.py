from pathlib import Path


ML_ROOT = Path(__file__).resolve().parent
REPOSITORY_ROOT = ML_ROOT.parent

DATASET_PATH = ML_ROOT / "dataset" / "fraud.csv"

MODEL_DIR = ML_ROOT / "models"
BEST_MODEL_PATH = MODEL_DIR / "best_model.pkl"
FULL_PIPELINE_MODEL_PATH = MODEL_DIR / "fraud_model_pipeline.pkl"
COMPATIBILITY_MODEL_PATH = MODEL_DIR / "fraud_model.pkl"
COLUMNS_PATH = MODEL_DIR / "columns.pkl"
SCALER_PATH = MODEL_DIR / "scaler.pkl"
TRAINING_METADATA_PATH = MODEL_DIR / "training_metadata.json"
NOTEBOOK_EXPERIMENT_MODEL_DIR = MODEL_DIR / "notebook_experiments"
NOTEBOOK_STANDARD_SCALER_PATH = NOTEBOOK_EXPERIMENT_MODEL_DIR / "standard_scaler.joblib"
NOTEBOOK_FEATURE_COLUMNS_PATH = NOTEBOOK_EXPERIMENT_MODEL_DIR / "feature_columns.joblib"
NOTEBOOK_EXPERIMENT_METADATA_PATH = NOTEBOOK_EXPERIMENT_MODEL_DIR / "experiment_metadata.json"

RESULTS_DIR = ML_ROOT / "results"
BACKEND_ML_MODEL_DIR = REPOSITORY_ROOT / "backend" / "FraudGuard.Api" / "MLModels"
ONNX_MODEL_PATH = BACKEND_ML_MODEL_DIR / "fraud_model.onnx"
ONNX_METADATA_PATH = BACKEND_ML_MODEL_DIR / "fraud_model.metadata.json"
MODEL_COMPARISON_JSON_PATH = RESULTS_DIR / "model_comparison_results.json"
MODEL_COMPARISON_CSV_PATH = RESULTS_DIR / "model_comparison_results.csv"
BEST_MODEL_REGISTRY_PATH = RESULTS_DIR / "best_model_registry.json"
FEATURE_IMPORTANCE_JSON_PATH = RESULTS_DIR / "feature_importance_results.json"
FEATURE_IMPORTANCE_CSV_PATH = RESULTS_DIR / "feature_importance_results.csv"
SHAP_FEATURE_IMPORTANCE_JSON_PATH = RESULTS_DIR / "shap_feature_importance_results.json"
SHAP_FEATURE_IMPORTANCE_CSV_PATH = RESULTS_DIR / "shap_feature_importance_results.csv"
SHAP_FEATURE_IMPORTANCE_PLOT_PATH = RESULTS_DIR / "shap_feature_importance.png"
CLUSTERING_RESULTS_JSON_PATH = RESULTS_DIR / "clustering_results.json"
CLUSTERING_RESULTS_CSV_PATH = RESULTS_DIR / "clustering_results.csv"
KMEANS_PCA_CLUSTERS_PATH = RESULTS_DIR / "kmeans_pca_clusters.png"
KMEANS_PCA_TRUE_LABELS_PATH = RESULTS_DIR / "kmeans_pca_true_labels.png"


def repo_relative(path: Path) -> str:
    return path.resolve().relative_to(REPOSITORY_ROOT.resolve()).as_posix()


def resolve_repo_path(path_value: str) -> Path:
    path = Path(path_value)
    return path if path.is_absolute() else REPOSITORY_ROOT / path
