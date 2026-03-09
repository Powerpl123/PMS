"""Train a baseline failure prediction model from historical asset telemetry data.

Expected CSV columns:
- vibration
- temperature
- pressure
- asset_age_years
- recent_failures_90d
- failed_next_30d (target: 0/1)
"""

from pathlib import Path

import joblib
import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.ensemble import RandomForestClassifier
from sklearn.impute import SimpleImputer
from sklearn.metrics import classification_report
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline

DATA_PATH = Path("ml/data/historical_telemetry.csv")
MODEL_PATH = Path("ml/models/failure_model.joblib")

FEATURES = [
    "vibration",
    "temperature",
    "pressure",
    "asset_age_years",
    "recent_failures_90d",
]
TARGET = "failed_next_30d"


def train_model() -> None:
    if not DATA_PATH.exists():
        raise FileNotFoundError(
            f"Training data not found at {DATA_PATH}. Add telemetry data before training."
        )

    df = pd.read_csv(DATA_PATH)
    missing_columns = set(FEATURES + [TARGET]) - set(df.columns)
    if missing_columns:
        raise ValueError(f"Missing required columns: {sorted(missing_columns)}")

    x = df[FEATURES]
    y = df[TARGET]

    x_train, x_test, y_train, y_test = train_test_split(
        x, y, test_size=0.2, random_state=42, stratify=y
    )

    preprocessor = ColumnTransformer(
        transformers=[
            (
                "numeric",
                Pipeline(steps=[("imputer", SimpleImputer(strategy="median"))]),
                FEATURES,
            )
        ],
        remainder="drop",
    )

    model = RandomForestClassifier(
        n_estimators=250,
        max_depth=12,
        random_state=42,
        class_weight="balanced",
    )

    pipeline = Pipeline(steps=[("prep", preprocessor), ("model", model)])
    pipeline.fit(x_train, y_train)

    y_pred = pipeline.predict(x_test)
    print(classification_report(y_test, y_pred))

    MODEL_PATH.parent.mkdir(parents=True, exist_ok=True)
    joblib.dump(pipeline, MODEL_PATH)
    print(f"Saved model to {MODEL_PATH}")


if __name__ == "__main__":
    train_model()
