from pathlib import Path

import numpy as np
import pandas as pd
import joblib


PROJECT_ROOT = Path(__file__).resolve().parents[1]
SCALER_PATH  = PROJECT_ROOT / "models" / "preprocessing_scaler.pkl"

SENSOR_COLUMNS = [
    "sensor_2",  "sensor_3",  "sensor_4",  "sensor_6",  "sensor_7",
    "sensor_8",  "sensor_9",  "sensor_11", "sensor_12", "sensor_13",
    "sensor_14", "sensor_15", "sensor_17", "sensor_20", "sensor_21",
]

WINDOW_SIZE = 30


def prepare_inference_data(data: pd.DataFrame, scaler=None):
    working = data.copy()

    if "cycle" in working.columns:
        working = working.sort_values("cycle").reset_index(drop=True)

    if scaler is None:
        scaler = joblib.load(SCALER_PATH)

    working[SENSOR_COLUMNS] = scaler.transform(working[SENSOR_COLUMNS])

    X = working[SENSOR_COLUMNS].to_numpy(dtype=np.float32)

    X_latest = X[-1].reshape(1, -1)                            # (1, 15)
    X_window = X[-WINDOW_SIZE:].reshape(1, WINDOW_SIZE, -1)   # (1, 30, 15)

    return working, X_latest, X_window
