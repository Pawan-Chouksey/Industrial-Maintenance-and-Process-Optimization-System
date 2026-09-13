from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from routes.auth  import router as auth_router
from routes.users import router as users_router

# ── App ────────────────────────────────────────────────────────────────────────

app = FastAPI(
    title="Industrial Maintenance System — Auth API",
    description="User registration and login API backed by MongoDB Atlas.",
    version="1.0.0",
)

# ── CORS ───────────────────────────────────────────────────────────────────────
# Allow requests from the React frontend (adjust origin as needed)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://localhost:3000",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:3000",
    ],
    allow_origin_regex=r"http://.*:3000|http://.*:5173",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Routes ─────────────────────────────────────────────────────────────────────
app.include_router(auth_router)
app.include_router(users_router)


# ── Health check ───────────────────────────────────────────────────────────────
@app.get("/", tags=["Health"])
def root():
    return {"message": "Industrial Maintenance Auth API is running ✅"}


@app.get("/api/health", tags=["Health"])
def health():
    return {"status": "ok"}
