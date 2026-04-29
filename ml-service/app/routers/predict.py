from __future__ import annotations

import logging

from fastapi import APIRouter

from app.schemas.input import PredictRequest
from app.schemas.output import PredictionResult, Influencer
from app.services.model_runtime import predict_mood
from app.services.model_storage import get_model_meta
from app.services.recommendations import generate_recommendations
from app.services.user_phase import get_data_completeness, get_user_phase

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/predict", tags=["Predict"])


@router.post("/", response_model=PredictionResult)
async def predict(request: PredictRequest):
    user_id = request.user_id
    data = request.health_data

    phase = get_user_phase(data)
    logger.info(f"[{user_id}] Phase: {phase.mode} ({phase.total_records} records)")

    completeness = get_data_completeness(data)

    if phase.mode == "cold_start":
        recommendations = generate_recommendations(
            data=data,
            phase_mode="cold_start",
            top_influencers=[],
            predicted_mood=None,
        )
        return PredictionResult(
            user_id=user_id,
            phase=phase,
            predicted_mood=None,
            confidence_lower=None,
            confidence_upper=None,
            top_influencers=[],
            recommendations=recommendations,
            model_version="rule_based",
            data_completeness=completeness,
        )

    user_profile = request.user_profile
    predicted_mood, lower, upper, influencers_raw = predict_mood(
        user_id,
        data,
        user_profile=user_profile,
    )

    if predicted_mood is None:
        logger.warning(f"[{user_id}] predict_mood returned None - falling back to rules")
        recommendations = generate_recommendations(
            data=data,
            phase_mode=phase.mode,
            top_influencers=[],
            predicted_mood=None,
        )
        return PredictionResult(
            user_id=user_id,
            phase=phase,
            predicted_mood=None,
            confidence_lower=None,
            confidence_upper=None,
            top_influencers=[],
            recommendations=recommendations,
            model_version="unavailable",
            data_completeness=completeness,
        )

    influencers: list[Influencer] = [
        Influencer(
            factor=i.get("factor", "unknown"),
            impact=round(float(i.get("impact", 0.0)), 3),
            raw_shap=i.get("raw_shap"),
            direction=i.get("direction", "positive"),
            description=i.get("description", ""),
            feature_value=i.get("feature_value"),
        )
        for i in (influencers_raw or [])
    ]

    recommendations = generate_recommendations(
        data=data,
        phase_mode=phase.mode,
        top_influencers=influencers_raw or [],
        predicted_mood=predicted_mood,
    )

    meta = get_model_meta(user_id)
    model_version = meta.get("version", "v1") if meta else "v1"

    logger.info(
        f"[{user_id}] -> mood={predicted_mood} [{lower}-{upper}], "
        f"version={model_version}, recs={len(recommendations)}"
    )

    return PredictionResult(
        user_id=user_id,
        phase=phase,
        predicted_mood=predicted_mood,
        confidence_lower=lower,
        confidence_upper=upper,
        top_influencers=influencers,
        recommendations=recommendations,
        model_version=model_version,
        data_completeness=completeness,
    )
