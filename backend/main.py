from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from routes.auth  import router as auth_router
from routes.users import router as users_router
from routes.telemetry import router as telemetry_router

# ── App ────────────────────────────────────────────────────────────────────────

app = FastAPI(
    title="Industrial Maintenance System — Auth & ML Telemetry API",
    description="User management and real-time NASA C-MAPSS ML inference pipeline.",
    version="1.0.0",
)

# ── CORS ───────────────────────────────────────────────────────────────────────
# Allow requests from frontend (Live Server 5500, Vite 5173, Next 3000)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5500",
        "http://127.0.0.1:5500",
        "http://localhost:5173",
        "http://localhost:3000",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:3000",
        "http://localhost:8001",
        "http://127.0.0.1:8001",
        "http://localhost:8000",
        "http://127.0.0.1:8000",
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


# ── Health check ───────────────────────────────────────────────────────────────
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


# ── Frontend Dashboard Mount ──────────────────────────────────────────────────
from pathlib import Path
from fastapi.staticfiles import StaticFiles

FRONTEND_DIR = Path(__file__).resolve().parent.parent / "frontend"
if FRONTEND_DIR.exists():
    app.mount("/dashboard", StaticFiles(directory=str(FRONTEND_DIR), html=True), name="dashboard")

