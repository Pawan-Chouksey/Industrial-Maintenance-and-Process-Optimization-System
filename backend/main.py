import os
import sys
from pathlib import Path
from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = BASE_DIR.parent
for p in (str(PROJECT_ROOT), str(BASE_DIR)):
    if p not in sys.path:
        sys.path.insert(0, p)

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from routes.auth import router as auth_router
from routes.users import router as users_router
from routes.telemetry import router as telemetry_router
from routes.rag import router as rag_router


# ── App ────────────────────────────────────────────────────────────────────────

load_dotenv()

app = FastAPI(
    title="Industrial Maintenance System — Auth & ML Telemetry API",
    description="User management and real-time NASA C-MAPSS ML inference pipeline.",
    version="1.0.0",
)


# ── CORS ───────────────────────────────────────────────────────────────────────

configured_origins = [
    origin.strip()
    for origin in os.getenv("CORS_ORIGINS", "").split(",")
    if origin.strip()
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=configured_origins + [
        # Live Server
        "http://localhost:5500",
        "http://127.0.0.1:5500",

        # Vite
        "http://localhost:5173",
        "http://127.0.0.1:5173",

        # Next.js
        "http://localhost:3000",
        "http://127.0.0.1:3000",

        # Backend ports
        "http://localhost:8000",
        "http://127.0.0.1:8000",
        "http://localhost:8001",
        "http://127.0.0.1:8001",
    ],
    allow_origin_regex=r"^https?://(localhost|127\.0\.0\.1)(:\d+)?$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Routes ─────────────────────────────────────────────────────────────────────

app.include_router(auth_router)
app.include_router(users_router)
app.include_router(telemetry_router)
app.include_router(rag_router)


# ── Health Check ───────────────────────────────────────────────────────────────

@app.get("/", tags=["Health"])
def root():
    return {
        "message": "Industrial Maintenance Auth & ML Telemetry API is running ✅",
        "docs": "/docs",
        "dashboard": "/dashboard/",
    }


@app.get("/api/health", tags=["Health"])
def health():
    return {"status": "ok"}


# ── Frontend Dashboard Mount ───────────────────────────────────────────────────

FRONTEND_DIR = Path(__file__).resolve().parent.parent / "frontend"

if FRONTEND_DIR.exists():
    app.mount(
        "/dashboard",
        StaticFiles(directory=str(FRONTEND_DIR), html=True),
        name="dashboard",
    )