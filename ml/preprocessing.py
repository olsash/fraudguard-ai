from dataclasses import dataclass

import pandas as pd
from sklearn.preprocessing import StandardScaler


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
TYPE_COLUMN = "type"


@dataclass
class PreprocessingArtifacts:
    columns: list[str]
    scaler: StandardScaler | None
    scale_numeric: bool


def validate_dataset(data: pd.DataFrame) -> pd.DataFrame:
    missing_columns = [column for column in REQUIRED_COLUMNS if column not in data.columns]
    if missing_columns:
        raise ValueError(
            "Dataset is missing required columns: "
            f"{', '.join(missing_columns)}. "
            f"Expected columns: {', '.join(REQUIRED_COLUMNS)}"
        )

    data = data[REQUIRED_COLUMNS].dropna()
    validate_model_inputs(data, context="training")

    invalid_target_values = (
        data.loc[~data[TARGET].isin([0, 1]), TARGET].drop_duplicates().astype(str).tolist()
    )
    if invalid_target_values:
        raise ValueError(
            f"Dataset column '{TARGET}' must contain only binary values 0 and 1. "
            f"Invalid values found: {invalid_target_values}"
        )

    return data


def validate_model_inputs(data: pd.DataFrame, context: str = "modeling") -> None:
    missing_columns = [column for column in FEATURES if column not in data.columns]
    if missing_columns:
        raise ValueError(
            "Dataset is missing required model input columns: "
            f"{', '.join(missing_columns)}. "
            f"Expected columns: {', '.join(FEATURES)}"
        )

    non_numeric_columns = [
        column for column in NUMERIC_COLUMNS if not pd.api.types.is_numeric_dtype(data[column])
    ]
    if non_numeric_columns:
        raise ValueError(
            f"Dataset columns must be numeric for {context}: "
            f"{', '.join(non_numeric_columns)}"
        )


def split_features_target(data: pd.DataFrame) -> tuple[pd.DataFrame, pd.Series]:
    return data[FEATURES].copy(), data[TARGET].astype(int)


def encode_features(data: pd.DataFrame, columns: list[str] | None = None) -> pd.DataFrame:
    validate_model_inputs(data)
    encoded = pd.get_dummies(data[FEATURES], columns=[TYPE_COLUMN])
    if columns is not None:
        encoded = encoded.reindex(columns=columns, fill_value=0)
    return encoded


def scale_numeric_features(
    features: pd.DataFrame,
    *,
    fit: bool,
    scaler: StandardScaler | None = None,
) -> tuple[pd.DataFrame, StandardScaler]:
    scaled = features.copy()
    if fit:
        scaler = StandardScaler()
        scaled[NUMERIC_COLUMNS] = scaler.fit_transform(scaled[NUMERIC_COLUMNS])
        return scaled, scaler

    if scaler is None:
        raise ValueError("A fitted scaler is required when fit=False.")

    scaled[NUMERIC_COLUMNS] = scaler.transform(scaled[NUMERIC_COLUMNS])
    return scaled, scaler


def preprocess_training_data(
    data: pd.DataFrame,
    *,
    scale_numeric: bool = False,
) -> tuple[pd.DataFrame, pd.Series, PreprocessingArtifacts]:
    features, target = split_features_target(data)
    encoded = encode_features(features)
    scaler = None

    if scale_numeric:
        encoded, scaler = scale_numeric_features(encoded, fit=True)

    artifacts = PreprocessingArtifacts(
        columns=list(encoded.columns),
        scaler=scaler,
        scale_numeric=scale_numeric,
    )
    return encoded, target, artifacts


def preprocess_prediction_data(
    data: pd.DataFrame,
    *,
    columns: list[str],
    scaler: StandardScaler | None = None,
    scale_numeric: bool = False,
) -> pd.DataFrame:
    encoded = encode_features(data, columns=columns)
    if scale_numeric:
        encoded, _ = scale_numeric_features(encoded, fit=False, scaler=scaler)
    return encoded
