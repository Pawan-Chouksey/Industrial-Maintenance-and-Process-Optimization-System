from pathlib import Path

import numpy as np
import joblib
from tensorflow.keras.models import load_model


PROJECT_ROOT   = Path(__file__).resolve().parents[1]
MODEL_PATH     = PROJECT_ROOT / "models" / "anomaly_autoencoder.keras"
THRESHOLD_PATH = PROJECT_ROOT / "models" / "anomaly_threshold.pkl"


def predict_anomaly(X_latest: np.ndarray, model=None, threshold=None) -> dict:

    if model is None:
        model = load_model(MODEL_PATH)
    if threshold is None:
        threshold = float(joblib.load(THRESHOLD_PATH))

    X = np.asarray(X_latest, dtype=np.float32)
    reconstructed = model.predict(X, verbose=0)
    score = float(np.mean(np.square(X - reconstructed), axis=1)[0])

    is_anomaly = score > threshold

    return {
        "anomaly_score":     round(score, 6),
        "anomaly_threshold": round(threshold, 6),
        "is_anomaly":        int(is_anomaly),
        "anomaly_status":    "ANOMALY" if is_anomaly else "NORMAL",
    }
