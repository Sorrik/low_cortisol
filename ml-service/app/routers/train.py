from __future__ import annotations

import logging

from fastapi import APIRouter

from app.schemas.input import TrainRequest
from app.services.model_runtime import train_model
from app.services.model_storage import get_model_meta
from app.services.user_phase import get_total_records, get_user_phase

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/train", tags=["Train"])

MIN_RECORDS = 14


@router.post("/")
async def train(request: TrainRequest):
    user_id = request.user_id
    data = request.health_data

    phase = get_user_phase(data)
    total = get_total_records(data)

    logger.info(f"[{user_id}] Train request: {total} records, phase={phase.mode}")

    if total < MIN_RECORDS:
        logger.info(f"[{user_id}] Skipped: need {MIN_RECORDS - total} more records")
        return {
            "status": "skipped",
            "reason": "not_enough_data",
            "user_id": user_id,
            "phase": phase.mode,
            "total_records": total,
            "records_needed": MIN_RECORDS - total,
            "message": (
                f"Need {MIN_RECORDS - total} more mood days before model training can start"
            ),
        }

    result = train_model(user_id, data, user_profile=request.user_profile)

    if result.get("status") == "skipped":
        logger.warning(f"[{user_id}] train_model skipped: {result.get('reason')}")
        return {
            "status": "skipped",
            "reason": result.get("reason"),
            "user_id": user_id,
            "phase": phase.mode,
            "total_records": total,
            "message": f"Training skipped: {result.get('reason')}",
        }

    meta = get_model_meta(user_id)

    cv_mae              = result.get("cv_mae")
    cv_r2               = result.get("cv_r2")
    cv_status           = result.get("cv_status", "insufficient_data")
    baseline_mae        = result.get("baseline_mae")
    baseline_r2         = result.get("baseline_r2")
    improvement_mae_pct = result.get("improvement_mae_pct")
    version             = result.get("version", meta.get("version") if meta else "v1")

    quality_parts: list[str] = []
    if cv_mae is not None:
        quality_parts.append(f"MAE={cv_mae}")
    if cv_r2 is not None:
        quality_parts.append(f"R2={cv_r2}")
    if baseline_mae is not None:
        quality_parts.append(f"baseline_MAE={baseline_mae}")
    if improvement_mae_pct is not None:
        quality_parts.append(f"improvement={improvement_mae_pct}%")

    message = f"Model {version} trained on {result.get('samples')} samples"
    if quality_parts:
        message += f" ({', '.join(quality_parts)})"
    if cv_status == "insufficient_data":
        message += " — CV not run (need ≥30 samples)"

    logger.info(f"[{user_id}] Trained: {message}")

    return {
        "status":              result.get("status"),
        "user_id":             user_id,
        "phase":               phase.mode,
        "total_records":       total,
        "samples_used":        result.get("samples"),
        "features_count":      result.get("features"),
        "cv_status":           cv_status,
        "cv_mae":              cv_mae,
        "cv_r2":               cv_r2,
        "oob_r2":              result.get("oob_r2"),
        "baseline_mae":        baseline_mae,
        "baseline_r2":         baseline_r2,
        "improvement_mae_pct": improvement_mae_pct,
        "model_version":       version,
        "trained_at":          meta.get("trained_at") if meta else None,
        "message":             message,
    }
