import asyncio
import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routers import insights, predict, train, transcribe

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
            print("[whisper-preload] started (model loading in background)", flush=True)
            transcribe._get_model()
            print("[whisper-preload] done - ready for transcription", flush=True)
        except Exception as e:
            print(f"[whisper-preload] FAILED: {e}", flush=True)

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
