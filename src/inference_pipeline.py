from functools import lru_cache
from pathlib import Path

import joblib
import pandas as pd
from tensorflow.keras.models import load_model

from preprocessing import prepare_inference_data
from anomaly_detection import predict_anomaly
from failure_prediction import predict_failure
from rul_prediction import predict_rul
from health_score import calculate_health_score, get_health_status


PROJECT_ROOT = Path(__file__).resolve().parents[1]


@lru_cache(maxsize=1)
def _load_models():
    
    models_dir = PROJECT_ROOT / "models"

    return {
        "anomaly_model":     load_model(models_dir / "anomaly_autoencoder.keras"),
        "anomaly_threshold": float(joblib.load(models_dir / "anomaly_threshold.pkl")),
        "failure_model":     joblib.load(models_dir / "failure_prediction_xgboost.pkl"),
        "rul_model":         load_model(models_dir / "rul_prediction_lstm.keras"),
    }


def predict_machine_health(sensor_data: pd.DataFrame) -> dict:
    
    m = _load_models()

    processed_df, X_latest, X_window = prepare_inference_data(sensor_data)

    anomaly = predict_anomaly(X_latest,  model=m["anomaly_model"], threshold=m["anomaly_threshold"])
    failure = predict_failure(X_window,  model=m["failure_model"])
    rul     = predict_rul(X_window,      model=m["rul_model"])

    score  = calculate_health_score(anomaly["anomaly_score"], failure["failure_probability"], rul)
    status = get_health_status(score)

    latest = processed_df.iloc[-1]

    return {
        "engine_id": int(latest["engine_id"]) if "engine_id" in latest.index else None,
        "cycle":     int(latest["cycle"])     if "cycle"     in latest.index else None,
        **anomaly,
        **failure,
        "predicted_rul": round(rul, 2),
        "health_score":  score,
        "health_status": status,
    }
