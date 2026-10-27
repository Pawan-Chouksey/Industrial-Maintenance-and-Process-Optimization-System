# Industrial Maintenance & Process Optimization System (IMAPOS)
### AI-Powered Turbofan Prognostics & Real-Time Health Monitoring Cockpit

[![Python](https://img.shields.io/badge/Python-3.11%20%7C%203.12%20%7C%203.13-3776AB?logo=python&logoColor=white)](https://python.org)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.115+-009688?logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com)
[![TensorFlow](https://img.shields.io/badge/TensorFlow-2.18%2B-FF6F00?logo=tensorflow&logoColor=white)](https://tensorflow.org)
[![XGBoost](https://img.shields.io/badge/XGBoost-2.1%2B-29B6F6)](https://xgboost.readthedocs.io)
[![Google Gemini](https://img.shields.io/badge/Google%20Gemini-2.0%20%2F%20Flash-8E75B2?logo=google&logoColor=white)](https://ai.google.dev)
[![MongoDB](https://img.shields.io/badge/MongoDB-Atlas%20%2F%20Community-47A248?logo=mongodb&logoColor=white)](https://mongodb.com)

An enterprise-grade predictive maintenance, health-monitoring, and diagnostics system for commercial aircraft turbofan engines built on the **NASA C-MAPSS (Commercial Modular Aero-Propulsion System Simulation)** dataset.

The system detects sensor anomalies, estimates Remaining Useful Life (RUL), and recommends corrective interventions in real time through an interactive mission-control cockpit.

---

## 🌟 Key Capabilities

* **Multi-Model Machine Learning Inference Pipeline**:
  * **LSTM Recurrent Neural Network**: Regresses Remaining Useful Life (RUL) across 30-cycle temporal sequence sliding windows.
  * **XGBoost Decision Tree Ensemble**: Classifies catastrophic failure risk within the critical $\le 30$ cycle horizon.
  * **Deep Autoencoder (Reconstruction Error)**: Identifies multi-sensor degradation anomalies exceeding a calibrated 99th-percentile reconstruction threshold ($0.2434$).
* **Composite Machine Health Index**:
  * Real-time 0–100 health score dynamically evaluated across anomaly severity ($40\%$), failure risk probability ($30\%$), and normalized RUL horizon ($30\%$).
* **RAG-Powered AI Maintenance Copilot**:
  * Conversational troubleshooting assistant powered by **Google Gemini** integrated with a local vector database indexing aerospace maintenance manuals, bearing inspection guides, and ISO 13374 standards.
  * Context-aware machine telemetry injection providing targeted corrective directives.
* **Realistic Commercial Fleet Mapping**:
  * Real-world aircraft turbofan designations (e.g., *Boeing 737 Turbofan #01*, *Airbus A320 Turbofan #03*, *Boeing 777 Turbofan #05*) mapped across all telemetry, prediction, and RAG context feeds.
* **Interactive Mission-Control Cockpit**:
  * **Live Cycle Scrubber & Streaming**: Smooth manual cycle scrubbing, step increments (`-10`, `-1`, `+1`, `+10`), and real-time playback streaming (1x, 2x, 5x).
  * **Real-Time Visual Inference Loaders**: Synchronized loading spinners, pulsed numeric updating states (`.value-updating`), and scanning bars providing instant visual feedback during ML inference.
  * **Interactive Multi-Horizon SVG Degradation Curves**: High-density vector chart rendering LSTM predicted RUL, ground-truth RUL, failure probability, and anomaly score trajectories with dynamic cursor tracking and tooltips.
  * **15-Channel Telemetry Matrix**: Categorized sensor monitoring (Temperature, Pressure, Speed, Bleed/Fuel) with delta-from-baseline tracking, search filtering, and tolerance alerts.
  * **Automated Directives & Root-Cause Attribution**: Ranked sensor drift contributions and prioritized work-order directives (Urgent, Preventive, Monitoring, Nominal).
  * **Dedicated Operator Workspaces**: Modular navigation between Fleet Telemetry Cockpit, Batch CSV Evaluation Studio, AI Maintenance Chatbot, and Operator User Account.
  * **Context-Aware Scrubber Visibility**: Scrubber bar and playback shortcuts automatically hide on non-telemetry views (CSV Upload, AI Chatbot, and User Account).
* **High-Throughput FastAPI REST Backend**:
  * Asynchronous backend with MongoDB authentication (JWT bearer tokens), LRU caching, resilient offline fallback simulator, and custom batch CSV telemetry uploads.

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
                        ┌─────────────────────────┴─────────────────────────┐
                        │                                                   │
                        ▼                                                   ▼
        ┌───────────────────────────────┐                   ┌───────────────────────────────┐
        │   FastAPI Real-Time Backend   │                   │    RAG Maintenance Pipeline   │
        │    (Port 8001 / JSON REST)    │◀──────────────────│    (Gemini + ChromaDB Store)  │
        └───────────────┬───────────────┘                   └───────────────────────────────┘
                        │ HTTP / REST & Web APIs                            ▲
                        ▼                                                   │
        ┌───────────────────────────────┐                                   │ Manuals & Guides
        │  Industrial Cockpit Dashboard │                                   │ (PDFs & Documents)
        │   (Live SVG Charts & Matrix)  │───────────────────────────────────┘
        └───────────────────────────────┘
```

---

## 📁 Project Structure

```
Industrial-Maintenance-and-Process-Optimization-System/
├── backend/
│   ├── routes/
│   │   ├── auth.py                  # User registration, login & JWT token generation
│   │   ├── rag.py                   # RAG AI Copilot endpoint (/api/rag/chat)
│   │   ├── telemetry.py             # Telemetry streaming, RUL prediction & trend curves
│   │   └── users.py                 # User profile & session management
│   ├── auth.py                      # Bcrypt password hashing & JWT handling
│   ├── database.py                  # MongoDB Atlas / local connection setup
│   ├── dependencies.py              # Auth guards & token dependencies
│   ├── main.py                      # FastAPI entrypoint, CORS & static file mounts
│   └── schemas.py                   # Pydantic request/response validation schemas
├── data/
│   ├── CMAPSSData/                  # Raw NASA C-MAPSS dataset (FD001–FD004 .txt files)
│   └── processed/                   # Preprocessed sequence arrays (.npy) & training splits
├── frontend/
│   ├── css/
│   │   └── styles.css               # Mission-control cockpit styling & animation keyframes
│   ├── js/
│   │   ├── api.js                   # Client API layer with dual-mode server/simulator support
│   │   ├── app.js                   # App lifecycle, routing & navigation controller
│   │   ├── auth.js                  # Authentication & session storage
│   │   ├── copilot.js               # AI Maintenance Assistant chat UI & context injector
│   │   └── dashboard.js             # Cockpit UI, live scrubber, SVG charts & telemetry matrix
│   └── index.html                   # High-density cockpit user interface
├── models/
│   ├── preprocessing_scaler.pkl     # Fitted scikit-learn StandardScaler (15 sensors)
│   ├── anomaly_autoencoder.keras    # Trained Keras Autoencoder (Sensor reconstruction)
│   ├── anomaly_threshold.pkl        # Baseline 99th-percentile anomaly threshold (0.2434)
│   ├── failure_prediction_xgboost.pkl # Trained XGBoost binary failure classifier
│   └── rul_prediction_lstm.keras    # Trained 2-layer LSTM RUL regression model
├── notebooks/
│   ├── processing.ipynb             # Sensor filtering, scaling & window generation
│   ├── anomaly_detection.ipynb      # Autoencoder model architecture & training
│   ├── failure_prediction.ipynb     # XGBoost hyperparameter tuning & evaluation
│   └── rul_prediction.ipynb         # LSTM model architecture & loss optimization
├── RAG/
│   ├── data/                        # Engineering handbooks & maintenance manual PDFs
│   ├── chunker.py                   # Text chunking & semantic section splitting
│   ├── cleaner.py                   # Text sanitation & unicode cleaning
│   ├── embeddings.py                # Embedding generator for vectorized indexing
│   ├── llm.py                       # Google Gemini API connector with fallback handling
│   ├── loader.py                    # PDF & document extraction loader
│   ├── pipeline.py                  # Consolidated retrieval-generation pipeline
│   ├── prompt.py                    # Domain-engineered turbofan maintenance prompts
│   ├── retriever.py                 # Similarity matching & context scoring
│   ├── test_pipeline.py             # RAG pipeline test verification
│   └── vector_store.py              # ChromaDB vector store wrapper
├── src/
│   ├── preprocessing.py             # Inference scaling & sequence windowing
│   ├── anomaly_detection.py         # Autoencoder anomaly inference helper
│   ├── failure_prediction.py        # XGBoost failure risk inference helper
│   ├── rul_prediction.py            # LSTM RUL regression helper
│   ├── health_score.py              # Composite machine health index calculation
│   └── inference_pipeline.py        # Unified multi-model inference pipeline
├── .env.example                     # Environment configuration template
├── requirements.txt                 # Python dependencies
└── README.md                        # Project documentation
```

---

## 🔬 Dataset & Preprocessing

The system utilizes the [NASA Turbofan Engine Degradation Simulation Dataset (C-MAPSS)](https://www.nasa.gov/content/prognostics-center-of-excellence-data-set-repository):

* Each operational record captures 21 turbofan sensor readings across consecutive operating cycles until system failure.
* **Feature Selection**: 6 constant sensor channels (`sensor_1, 5, 10, 16, 18, 19`) have invariant zero variance across cycles and are filtered out.
* **15 Active Sensor Channels**:
  * `sensor_2, 3, 4`: Total Temperatures (LPC Outlet, HPC Outlet, LPT Outlet)
  * `sensor_6, 7, 11`: Pressures (Bypass Duct, HPC Outlet, Static Pressure Ps30)
  * `sensor_8, 9, 13, 14`: Rotational Speeds (Fan Speed, Core Speed, Corrected Speeds)
  * `sensor_12, 15, 17, 20, 21`: Ratios & Bleeds (Fuel Flow Ratio, Bypass Ratio, Bleed Enthalpy, HPT/LPT Coolant Bleeds)
* **Temporal Windowing**: Sensor telemetry is transformed into sliding temporal sequences of length **$W = 30$ cycles** for sequence-aware LSTM regression and Autoencoder reconstruction.

---

## 🤖 Model Specifications

| Model | Architecture | Target / Objective | Evaluation Metric |
|---|---|---|---|
| **LSTM Network** | 2-Layer LSTM (64 $\to$ 32 units) + Dense(1) | Remaining Useful Life (RUL in cycles) | RMSE / Score Function |
| **XGBoost Classifier** | Gradient Boosted Trees (`n_estimators=100`, `max_depth=5`) | Catastrophic Failure Risk ($\text{RUL} \le 30$) | Precision-Recall AUC / F1 |
| **Deep Autoencoder** | Symmetric Bottleneck (15 $\to$ 16 $\to$ 8 $\to$ 16 $\to$ 15) | Sensor Reconstruction Anomaly Score | MSE vs 99th Percentile Threshold ($0.2434$) |
| **RAG Copilot** | Gemini 2.0 / Flash + ChromaDB Embeddings | Turbofan Troubleshooting & Maintenance Advisory | Domain Precision / Grounding Score |

---

## ⚡ API Endpoints Reference

### Authentication & User Management
| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/register` | Register a new user account (username, email, password, optional phone) |
| `POST` | `/api/login` | Authenticate with username/email + password and receive JWT token |
| `GET` | `/api/users/me` | Fetch authenticated user profile |

### ML Prognostics & Telemetry
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/engines?dataset=FD001&split=train` | List available engine units, realistic aircraft turbofan names, and total cycle counts |
| `GET` | `/api/engines/{id}/telemetry?cycle={c}` | Real-time 15-channel sensor readings with nominal deltas and aircraft identity |
| `GET` | `/api/engines/{id}/predict?cycle={c}` | **Full AI Inference**: Returns LSTM RUL, XGBoost risk, Autoencoder score, aircraft identity & directives |
| `GET` | `/api/engines/{id}/trend?step=6` | Historical degradation trajectory for SVG chart plotting |
| `POST` | `/api/predict/upload` | Upload custom engine CSV telemetry file for instant model evaluation |

### AI Maintenance Assistant (RAG)
| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/rag/chat` (or `/rag/chat`) | Query the RAG maintenance copilot with conversational history and live machine telemetry context |

### System Health
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/` | API root status & documentation links |
| `GET` | `/api/health` | Service health status check |

---

## ⚙️ Configuration & Environment Setup


```ini
PORT=8001

# MongoDB Connection (Atlas URI or local instance)
MONGO_URL=

# JWT Security
SECRET_KEY=
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=60

# Google Gemini API Key (Required for RAG AI Copilot)
GEMINI_API_KEY=
```

---

## 🚀 Quickstart Guide

### 1. Clone & Set Up Virtual Environment

```bash
git clone https://github.com/Pawan-Chouksey/Industrial-Maintenance-and-Process-Optimization-System.git
cd Industrial-Maintenance-and-Process-Optimization-System

# Create virtual environment
python -m venv .venv

# Activate virtual environment
.\.venv\Scripts\Activate.ps1

# Install dependencies
pip install -r requirements.txt
```

### 2. Launch the FastAPI Backend

From the project root:

```bash
cd backend
python -m uvicorn main:app --reload --port 8001
```

* Backend API runs on: `http://127.0.0.1:8001`
* Interactive Swagger Docs: `http://127.0.0.1:8001/docs`
* Built-in Mounted Dashboard: `http://127.0.0.1:8001/dashboard/`

### 3. Launch the Frontend

You can access the dashboard through the FastAPI mount or serve it via Live Server:

* **FastAPI Mount**: Open `http://127.0.0.1:8001/dashboard/` in your browser.
* **VS Code Live Server**: Right-click [`frontend/index.html`](frontend/index.html) and select **"Open with Live Server"** (runs on `http://127.0.0.1:5500`).
* **Python HTTP Server**:
  ```bash
  cd frontend
  python -m http.server 5500
  ```
  Open `http://localhost:5500` in your browser.

---
