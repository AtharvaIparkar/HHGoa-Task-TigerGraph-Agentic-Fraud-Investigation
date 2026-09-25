"""
api/main.py
===========
FastAPI application entry point for the Fraud Investigation System.

Routers:
  /health       - health check
  /api/v1/cases - fraud case CRUD
  /api/v1/investigate - trigger agent investigation
  /api/v1/actions     - action history
  /api/v1/graph       - graph query proxy
"""

from __future__ import annotations

import os
import logging
from contextlib import asynccontextmanager

import structlog
from fastapi import FastAPI, Request, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

# ─── Logging setup ────────────────────────────────────────────────────────────
logging.basicConfig(level=os.environ.get("LOG_LEVEL", "INFO").upper())
structlog.configure(
    processors=[
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.stdlib.add_log_level,
        structlog.dev.ConsoleRenderer(),
    ]
)
log = structlog.get_logger(__name__)


# ─── Lifespan ────────────────────────────────────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    log.info("api.startup", version="0.1.0")
    yield
    log.info("api.shutdown")


# ─── App factory ─────────────────────────────────────────────────────────────
app = FastAPI(
    title="Fraud Investigation API",
    description="Agentic fraud investigation backend powered by TigerGraph + LangGraph",
    version="0.1.0",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)

# ─── CORS ─────────────────────────────────────────────────────────────────────
ALLOWED_ORIGINS = os.environ.get(
    "ALLOWED_ORIGINS",
    "http://localhost:5173,http://localhost:3000,http://127.0.0.1:5173",
).split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ─── Global error handler ────────────────────────────────────────────────────
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    log.error("unhandled_exception", path=request.url.path, error=str(exc))
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal server error", "error": str(exc)},
    )


# ─── Health check ─────────────────────────────────────────────────────────────
@app.get("/health", tags=["System"], summary="Health check")
async def health_check():
    """Returns service health status. Checked by Docker Compose and load balancers."""
    return {
        "status": "healthy",
        "service": "fraud-investigation-api",
        "version": "0.1.0",
        "environment": os.environ.get("ENV", "development"),
    }


# ─── Routers ──────────────────────────────────────────────────────────────────
try:
    from api.routers import cases, investigate, actions, graph as graph_router
    app.include_router(cases.router,       prefix="/api/cases",          tags=["Cases"])
    app.include_router(cases.router,       prefix="/api/v1/cases",       tags=["Cases"])
    app.include_router(investigate.router, prefix="/api/investigate",    tags=["Investigation"])
    app.include_router(investigate.router, prefix="/api/v1/investigate", tags=["Investigation"])
    app.include_router(actions.router,     prefix="/api/actions",        tags=["Actions"])
    app.include_router(actions.router,     prefix="/api/v1/actions",     tags=["Actions"])
    app.include_router(graph_router.router,prefix="/api/graph",          tags=["Graph"])
    app.include_router(graph_router.router,prefix="/api/v1/graph",       tags=["Graph"])
except ImportError as exc:
    log.warning("routers_not_loaded", error=str(exc))


# ─── Frontend SPA Static Files (For 1-click deployment) ────────────────────────
from pathlib import Path
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

UI_DIST = Path(__file__).resolve().parent.parent / "ui" / "dist"

if UI_DIST.exists() and (UI_DIST / "index.html").exists():
    # Mount compiled frontend assets
    if (UI_DIST / "assets").exists():
        app.mount("/assets", StaticFiles(directory=str(UI_DIST / "assets")), name="assets")

    @app.get("/{full_path:path}", include_in_schema=False)
    async def serve_spa(full_path: str):
        # Allow API routes to pass through
        if full_path.startswith("api") or full_path.startswith("docs") or full_path.startswith("redoc") or full_path.startswith("health"):
            raise HTTPException(status_code=404, detail="Not Found")
        file_path = UI_DIST / full_path
        if file_path.is_file():
            return FileResponse(file_path)
        return FileResponse(UI_DIST / "index.html")
else:
    @app.get("/", include_in_schema=False)
    async def root():
        return {"message": "Fraud Investigation API — see /docs for Swagger UI"}

