"""RegCheck FastAPI app entrypoint."""
from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app import config
from app.api.routes import router

app = FastAPI(
    title="RegCheck API",
    description="Turns SEBI circular clauses into executable, auditable compliance checks.",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=config.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router)


@app.get("/")
def root() -> dict:
    return {"service": "RegCheck API", "status": "ok", "docs": "/docs"}


@app.get("/api/health")
def health() -> dict:
    return {"status": "ok"}
