# Industrial Maintenance & Process Optimization System
### AI-Powered Turbofan Prognostics & Real-Time Health Monitoring Cockpit

[![Python](https://img.shields.io/badge/Python-3.11%20%7C%203.12%20%7C%203.13-3776AB?logo=python&logoColor=white)](https://python.org)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.115+-009688?logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com)
[![TensorFlow](https://img.shields.io/badge/TensorFlow-2.18%2B-FF6F00?logo=tensorflow&logoColor=white)](https://tensorflow.org)
[![XGBoost](https://img.shields.io/badge/XGBoost-2.1%2B-29B6F6)](https://xgboost.readthedocs.io)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

An enterprise-grade predictive maintenance and health-monitoring system for aircraft turbofan engines built on the **NASA C-MAPSS (Commercial Modular Aero-Propulsion System Simulation)** dataset. The system integrates deep learning and gradient boosted ensembles to detect early sensor drift, estimate Remaining Useful Life (RUL), and predict failure cutoffs in real-time through an interactive industrial cockpit.

---

## 🌟 Key Capabilities

* **Multi-Model Inference Pipeline**:
  * **LSTM Recurrent Neural Network**: Regresses Remaining Useful Life (RUL) across 30-cycle temporal sequence windows.
  * **XGBoost Decision Tree Ensemble**: Classifies binary catastrophic failure risk within the critical $\le 30$ cycle horizon.
  * **Deep Autoencoder (Reconstruction Error)**: Detects subtle sensor anomalies and unmodeled drift against a 99th-percentile reconstruction threshold ($0.2434$).
* **Composite Machine Health Index**: Real-time 0–100 health index weighted across anomaly severity ($40\%$), failure probability ($30\%$), and normalized RUL ($30\%$).
* **Sub-20ms FastAPI Backend**: Asynchronous REST API serving real-time predictions, telemetry matrices, degradation trajectories, and CSV file uploads with LRU-cached model weights.
* **Mission-Control Industrial Cockpit**: Vanilla JavaScript, Tailwind CSS, and SVG degradation charts featuring 15-channel sensor matrices, live cycle scrubbing/streaming, and automated root-cause diagnostics.

---

## 🏛️ System Architecture

```
                                  ┌───────────────────────────────┐
                                  │      NASA C-MAPSS Dataset     │
                                  │   (FD001 Turbofan Telemetry)  │
                                  └───────────────┬───────────────┘
                                                  │
                                                  ▼
                                  ┌───────────────────────────────┐
                                  │  Preprocessing & Windowing    │
                                  │   (StandardScaler, 30 Cycles) │
                                  └───────────────┬───────────────┘
                                                  │
                ┌─────────────────────────────────┼─────────────────────────────────┐
                ▼                                 ▼                                 ▼
    ┌───────────────────────┐         ┌───────────────────────┐         ┌───────────────────────┐
    │     Deep Autoencoder  │         │   XGBoost Classifier  │         │       LSTM Network    │
    │  (Anomaly Detection)  │         │  (Failure Risk Prob)  │         │     (RUL Regression)  │
    └───────────┬───────────┘         └───────────┬───────────┘         └───────────┬───────────┘
                │                                 │                                 │
                └─────────────────────────────────┼─────────────────────────────────┘
                                                  │
                                                  ▼
                                  ┌───────────────────────────────┐
                                  │  Composite Health Evaluator   │
                                  │    & Root-Cause Attribution   │
                                  └───────────────┬───────────────┘
                                                  │
                                                  ▼
                                  ┌───────────────────────────────┐
                                  │   FastAPI Real-Time Backend   │
                                  │    (Port 8001 / JSON REST)    │
                                  └───────────────┬───────────────┘
                                                  │ HTTP / Fetch
                                                  ▼
                                  ┌───────────────────────────────┐
                                  │  Industrial Cockpit Dashboard │
                                  │   (Live SVG Charts & Matrix)  │
                                  └───────────────────────────────┘
```

---

## 📁 Project Structure

```
Industrial-Maintenance-and-Process-Optimization-System/
├── backend/
│   ├── routes/
│   │   ├── auth.py                  # JWT user registration & authentication
│   │   ├── users.py                 # User profile & session management
│   │   └── telemetry.py             # NASA C-MAPSS ML inference & telemetry REST routes
│   ├── auth.py                      # Password hashing & JWT token verification
│   ├── database.py                  # MongoDB Atlas connection setup
│   ├── dependencies.py              # Security & auth dependencies
│   ├── main.py                      # FastAPI app entry point & CORS configuration
│   └── schemas.py                   # Pydantic models for validation
├── data/
│   ├── CMAPSSData/                  # Raw NASA dataset (FD001–FD004 .txt files)
│   └── processed/                   # Preprocessed sequence arrays (.npy) & CSVs
├── frontend/
│   ├── css/                         # Custom styling
│   ├── js/
│   │   ├── api.js                   # API connector (with intelligent local fallback)
│   │   ├── app.js                   # App shell & router controller
│   │   ├── auth.js                  # Authentication & session store
│   │   ├── dashboard.js             # Cockpit UI, SVG chart rendering & matrix logic
│   │   └── validation.js            # Input validation routines
│   └── index.html                   # High-performance industrial cockpit UI
├── models/
│   ├── preprocessing_scaler.pkl     # Fitted scikit-learn StandardScaler (15 sensors)
│   ├── anomaly_autoencoder.keras    # Trained Keras Autoencoder (Reconstruction)
│   ├── anomaly_threshold.pkl        # Baseline 99th-percentile anomaly threshold (0.2434)
│   ├── failure_prediction_xgboost.pkl # Trained XGBoost binary failure classifier
│   └── rul_prediction_lstm.keras    # Trained 2-layer LSTM RUL regression model
├── notebooks/
│   ├── processing.ipynb             # Sensor filtering, scaling & window generation
│   ├── anomaly_detection.ipynb      # Autoencoder model architecture & training
│   ├── failure_prediction.ipynb     # XGBoost hyperparameter tuning & evaluation
│   └── rul_prediction.ipynb         # LSTM model architecture & loss optimization
├── src/
│   ├── preprocessing.py             # Inference-time scaling & temporal windowing
│   ├── anomaly_detection.py         # Autoencoder inference helper
│   ├── failure_prediction.py        # XGBoost inference helper
│   ├── rul_prediction.py            # LSTM inference helper
│   ├── health_score.py              # Multi-criteria health score calculation
│   └── inference_pipeline.py       # Single consolidated inference entry point
├── requirements.txt                 # Python dependencies
└── README.md
```

---

## 🔬 Dataset & Preprocessing

The system utilizes the [NASA Turbofan Engine Degradation Simulation Dataset (C-MAPSS)](https://www.nasa.gov/content/prognostics-center-of-excellence-data-set-repository):
* Each record captures operational cycle readings across 21 turbofan sensors.
* 6 constant sensors (`sensor_1, 5, 10, 16, 18, 19`) have zero variance and are excluded.
* **15 Active Sensors Retained**:
  * `sensor_2, 3, 4` (LPC, HPC, LPT Outlet Temperatures)
  * `sensor_6, 7, 11` (Bypass, HPC Outlet, and Static Pressures)
  * `sensor_8, 9, 13, 14` (Physical and Corrected Fan/Core Speeds)
  * `sensor_12, 15, 17, 20, 21` (Fuel Flow Ratio, Bypass Ratio, Bleed Enthalpy, and Coolant Bleeds)
* **Temporal Windowing**: Sensor streams are preprocessed into sliding temporal windows of length **$W = 30$ cycles** for sequence-aware LSTM and Autoencoder inference.

---

## 🤖 Model Specifications

| Model | Architecture | Target / Objective | Evaluation Metric |
|---|---|---|---|
| **LSTM Network** | 2-Layer LSTM (64 $\to$ 32 units) + Dense(1) | Remaining Useful Life (Cycles) | RMSE / Score Function |
| **XGBoost Classifier** | Gradient Boosted Trees (`n_estimators=100`, `max_depth=5`) | Catastrophic Failure Risk ($\text{RUL} \le 30$) | Precision-Recall AUC / F1 |
| **Deep Autoencoder** | Dense Symmetric Bottleneck (15 $\to$ 16 $\to$ 8 $\to$ 16 $\to$ 15) | Sensor Reconstruction Anomaly Score | MSE vs 99th Percentile Threshold ($0.2434$) |

---

## ⚡ FastAPI Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/engines?dataset=FD001&split=train` | List all available engine units and total cycle durations |
| `GET` | `/api/engines/{id}/telemetry?cycle={c}` | Real-time 15-channel sensor readings with nominal delta |
| `GET` | `/api/engines/{id}/predict?cycle={c}` | **Full AI Inference**: Returns LSTM RUL, XGBoost risk, and Autoencoder anomaly score |
| `GET` | `/api/engines/{id}/trend?step=4` | Complete historical degradation trajectory for SVG chart plotting |
| `POST` | `/api/predict/upload` | Upload custom engine CSV telemetry file for instant model evaluation |
| `POST` | `/api/register` & `/api/login` | User authentication & JWT session management |

---

## 🚀 Quickstart Guide

### 1. Environment Setup

Clone the repository and install the dependencies:

```bash
git clone https://github.com/your-username/Industrial-Maintenance-and-Process-Optimization-System.git
cd Industrial-Maintenance-and-Process-Optimization-System

# Create and activate virtual environment
python -m venv .venv
.venv\Scripts\activate      # Windows
# source .venv/bin/activate # Linux / macOS

# Install dependencies
pip install -r requirements.txt
```

### 2. Launch the FastAPI Backend

Navigate to the `backend/` directory and run Uvicorn:

```bash
cd backend
uvicorn main:app --reload --port 8001
```

Verify backend interactive Swagger docs at [http://localhost:8001/docs](http://localhost:8001/docs).

### 3. Launch the Frontend

You can serve the `frontend/` directory using any local web server:

* **VS Code**: Right-click [`frontend/index.html`](frontend/index.html) and select **"Open with Live Server"** (port 5500).
* **Python Built-in HTTP Server**:
  ```bash
  cd frontend
  python -m http.server 5500
  ```
* Open your browser and navigate to: `http://localhost:5500`

---

