from pathlib import Path

import numpy as np
import joblib


PROJECT_ROOT = Path(__file__).resolve().parents[1]
MODEL_PATH   = PROJECT_ROOT / "models" / "failure_prediction_xgboost.pkl"


def predict_failure(X_window: np.ndarray, model=None) -> dict:
    if model is None:
        model = joblib.load(MODEL_PATH)

    X_latest = np.asarray(X_window, dtype=np.float32)[:, -1, :]
    probability = float(model.predict_proba(X_latest)[0, 1])
    prediction  = int(probability >= 0.5)

    return {
        "failure_probability": round(probability, 4),
        "failure_prediction":  prediction,
        "failure_status":      "FAILURE" if prediction else "NORMAL",
    }
