from __future__ import annotations

import logging

from fastapi import APIRouter

from app.schemas.input import TrainRequest
from app.services.model_service import train_model
from app.services.user_phase import get_user_phase, get_total_records
from app.services.model_storage import get_model_meta

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/train", tags=["Train"])

MIN_RECORDS = 5


@router.post("/")
async def train(request: TrainRequest):
    """
    Обучаем / дообучаем персональную модель пользователя.
    NestJS вызывает этот endpoint когда пользователь вводит новые данные.
    """
    user_id = request.user_id
    data    = request.health_data

    phase = get_user_phase(data)
    total = get_total_records(data)

    logger.info(f"[{user_id}] Train request: {total} records, phase={phase.mode}")

    # ── Недостаточно данных
    if total < MIN_RECORDS:
        logger.info(f"[{user_id}] Skipped: need {MIN_RECORDS - total} more records")
        return {
            "status":         "skipped",
            "reason":         "not_enough_data",
            "user_id":        user_id,
            "phase":          phase.mode,
            "total_records":  total,
            "records_needed": MIN_RECORDS - total,
            "message":        (
                f"Нужно ещё {MIN_RECORDS - total} дней с данными настроения "
                f"для начала обучения модели"
            ),
        }

    # ── Обучаем модель
    result = train_model(user_id, data)

    # ── Статус "skipped" может вернуть и сам train_model
    #    (например если данных стало меньше MIN_SAMPLES_TO_TRAIN)
    if result.get("status") == "skipped":
        logger.warning(f"[{user_id}] train_model skipped: {result.get('reason')}")
        return {
            "status":        "skipped",
            "reason":        result.get("reason"),
            "user_id":       user_id,
            "phase":         phase.mode,
            "total_records": total,
            "message":       f"Обучение пропущено: {result.get('reason')}",
        }

    # ── Актуальные метаданные после обучения
    meta = get_model_meta(user_id)

    cv_mae  = result.get("cv_mae")
    oob_r2  = result.get("oob_r2")
    version = result.get("version", meta.get("version") if meta else "v1")

    # Формируем человекочитаемое сообщение
    accuracy_note = ""
    if cv_mae is not None:
        accuracy_note += f"MAE={cv_mae}"
    if oob_r2 is not None:
        accuracy_note += f", R²={oob_r2}"

    message = (
        f"Модель {version} обучена на {result.get('samples')} примерах"
        + (f" ({accuracy_note})" if accuracy_note else "")
    )

    logger.info(f"[{user_id}] Trained: {message}")

    return {
        "status":         result.get("status"),          # "trained"
        "user_id":        user_id,
        "phase":          phase.mode,
        "total_records":  total,
        "samples_used":   result.get("samples"),
        "features_count": result.get("features"),
        "cv_mae":         cv_mae,
        "oob_r2":         oob_r2,                        # ← новое: R² out-of-bag
        "model_version":  version,                       # ← новое: из result, не из meta
        "trained_at":     meta.get("trained_at") if meta else None,
        "message":        message,
    }
