from fastapi import APIRouter
from app.schemas.input import PredictRequest
from app.services.user_phase import get_user_phase, get_data_completeness
from app.services.model_storage import get_model_meta
import numpy as np

router = APIRouter(prefix="/insights", tags=["Insights"])


@router.post("/{user_id}")
async def get_insights(user_id: str, request: PredictRequest):
    """
    Аналитика и статистика по данным пользователя.
    Без предсказания — просто паттерны и тренды.
    """
    data = request.health_data
    phase = get_user_phase(data)
    completeness = get_data_completeness(data)
    meta = get_model_meta(user_id)

    # Статистика по каждому модулю
    stats = {}

    if data.sleep:
        durations = [r.duration_hours for r in data.sleep]
        qualities = [r.quality for r in data.sleep]
        stats["sleep"] = {
            "avg_duration": round(float(np.mean(durations)), 1),
            "avg_quality": round(float(np.mean(qualities)), 1),
            "min_duration": round(float(np.min(durations)), 1),
            "max_duration": round(float(np.max(durations)), 1),
            "records_count": len(data.sleep)
        }

    if data.mood:
        scores = [r.mood_score for r in data.mood]
        stats["mood"] = {
            "avg_score": round(float(np.mean(scores)), 1),
            "min_score": int(np.min(scores)),
            "max_score": int(np.max(scores)),
            "trend": _calculate_trend(scores),
            "records_count": len(data.mood)
        }

    if data.stress:
        levels = [r.level for r in data.stress]
        stats["stress"] = {
            "avg_level": round(float(np.mean(levels)), 1),
            "high_stress_days": int(sum(1 for l in levels if l >= 7)),
            "trend": _calculate_trend(levels),
            "records_count": len(data.stress)
        }

    if data.activity:
        minutes = [r.duration_minutes for r in data.activity]
        stats["activity"] = {
            "avg_minutes": round(float(np.mean(minutes)), 1),
            "total_minutes": int(np.sum(minutes)),
            "active_days": len(data.activity),
            "records_count": len(data.activity)
        }

    if data.water:
        amounts = [r.amount_ml for r in data.water]
        stats["water"] = {
            "avg_ml": round(float(np.mean(amounts)), 0),
            "days_above_2000ml": int(sum(1 for a in amounts if a >= 2000)),
            "records_count": len(data.water)
        }

    return {
        "user_id": user_id,
        "phase": phase.model_dump(),
        "data_completeness": completeness,
        "statistics": stats,
        "model_meta": meta,
    }


def _calculate_trend(values: list) -> str:
    """Определяем тренд: improving / declining / stable"""
    if len(values) < 3:
        return "stable"
    recent = np.mean(values[-3:])
    older = np.mean(values[:-3]) if len(values) > 3 else values[0]
    diff = recent - older
    if diff > 0.5:
        return "improving"
    elif diff < -0.5:
        return "declining"
    return "stable"
