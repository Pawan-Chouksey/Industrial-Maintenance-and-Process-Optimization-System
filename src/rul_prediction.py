from pathlib import Path

import numpy as np
from tensorflow.keras.models import load_model


PROJECT_ROOT = Path(__file__).resolve().parents[1]
MODEL_PATH   = PROJECT_ROOT / "models" / "rul_prediction_lstm.keras"


def predict_rul(X_window: np.ndarray, model=None) -> float:

    if model is None:
        model = load_model(MODEL_PATH)

    X = np.asarray(X_window, dtype=np.float32)
    rul = float(model.predict(X, verbose=0).flatten()[0])

    return max(0.0, rul)
