import asyncio
import logging
import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routers import insights, predict, train, transcribe

logger = logging.getLogger(__name__)

app = FastAPI(
    title="LowCortisol ML Service",
    description="AI health assistant - mood prediction & recommendations",
    version="1.0.0",
)


@app.on_event("startup")
async def preload_whisper() -> None:
    if os.getenv("WHISPER_PRELOAD", "1") != "1":
        return

    def _warm() -> None:
        try:
            logger.info("Whisper preload started")
            transcribe._get_model()
            logger.info("Whisper model is ready")
        except Exception:
            logger.exception("Whisper preload failed")

    asyncio.get_event_loop().run_in_executor(None, _warm)


def _parse_cors_origins() -> list[str]:
    raw = os.getenv("CORS_ORIGINS", "http://localhost:3000,http://localhost:3001")
    origins = [origin.strip() for origin in raw.split(",") if origin.strip()]
    return origins or ["http://localhost:3000", "http://localhost:3001"]


app.add_middleware(
    CORSMiddleware,
    allow_origins=_parse_cors_origins(),
    allow_methods=["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
)

app.include_router(predict.router)
app.include_router(train.router)
app.include_router(insights.router)
app.include_router(transcribe.router)


@app.get("/health")
def health():
    return {
        "status": "ok",
        "service": "ml-service",
        "version": "1.0.0",
    }


@app.get("/")
def root():
    return {
        "message": "LowCortisol ML Service",
        "endpoints": [
            "POST /predict",
            "POST /train",
            "POST /insights/{user_id}",
            "POST /transcribe",
            "GET /health",
            "GET /docs",
        ],
    }
