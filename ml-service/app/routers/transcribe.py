from __future__ import annotations

import logging
import os
import tempfile
from typing import Optional

from fastapi import APIRouter, File, Form, HTTPException, UploadFile

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/transcribe", tags=["Transcribe"])

# Ленивая инициализация модели — singleton на процесс.
# Первый запрос грузит модель (small ~460 MB) с диска/HuggingFace,
# далее все запросы используют один экземпляр.
_model = None
_model_name = os.getenv("WHISPER_MODEL_SIZE", "small")
_compute_type = os.getenv("WHISPER_COMPUTE_TYPE", "int8")
_device = os.getenv("WHISPER_DEVICE", "cpu")


def _get_model():
    global _model
    if _model is None:
        from faster_whisper import WhisperModel

        logger.info(
            "Loading faster-whisper model=%s device=%s compute=%s (first call, может занять 1-3 мин)",
            _model_name, _device, _compute_type,
        )
        _model = WhisperModel(
            _model_name,
            device=_device,
            compute_type=_compute_type,
        )
        logger.info("faster-whisper model loaded")
    return _model


@router.post("/")
async def transcribe(
    audio: UploadFile = File(..., description="Аудио-файл (m4a, webm, ogg, wav, mp3)"),
    language: Optional[str] = Form("ru"),
):
    """
    Транскрипция аудио в текст через локальный faster-whisper.
    Вызывается из backend (NestJS) вместо OpenAI Whisper API,
    когда TRANSCRIBE_BACKEND=ml_service.
    """
    if not audio.filename:
        raise HTTPException(status_code=400, detail="Empty filename")

    data = await audio.read()
    if not data:
        raise HTTPException(status_code=400, detail="Empty audio")
    if len(data) > 25 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="Audio too large (max 25MB)")

    # Пишем во временный файл — faster-whisper принимает путь.
    # Суффикс берём из присланного имени, чтобы ffmpeg правильно декодировал.
    suffix = os.path.splitext(audio.filename)[1] or ".m4a"
    tmp_path = None
    try:
        with tempfile.NamedTemporaryFile(
            delete=False, suffix=suffix
        ) as tmp:
            tmp.write(data)
            tmp_path = tmp.name

        model = _get_model()
        segments, info = model.transcribe(
            tmp_path,
            language=language or None,
            beam_size=5,
            vad_filter=True,
            vad_parameters={"min_silence_duration_ms": 300},
        )
        text = " ".join(seg.text.strip() for seg in segments).strip()
        logger.info(
            "Transcribed bytes=%d lang=%s chars=%d duration=%.1fs",
            len(data), info.language, len(text), info.duration,
        )
        return {
            "text": text,
            "language": info.language,
            "duration": info.duration,
        }
    except HTTPException:
        raise
    except Exception as err:
        logger.exception("Transcribe failed")
        raise HTTPException(status_code=500, detail=f"Transcribe failed: {err}")
    finally:
        if tmp_path and os.path.exists(tmp_path):
            try:
                os.unlink(tmp_path)
            except OSError:
                pass
