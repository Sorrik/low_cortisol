from __future__ import annotations

import logging
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import joblib
import numpy as np
from sklearn.base import clone
from sklearn.ensemble import GradientBoostingRegressor
from sklearn.linear_model import RidgeCV
from sklearn.model_selection import TimeSeriesSplit, cross_val_score
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler

from app.schemas.input import HealthData
from app.services.feature_engineering import build_features, features_to_array
from app.services.model_artifacts import atomic_joblib_dump, user_model_lock
from app.services.model_service import (
    MIN_SAMPLES_CV,
    MIN_SAMPLES_GBR,
    MIN_SAMPLES_TO_TRAIN,
    RF_RANDOM_STATE,
    _build_dataset,
    _bump_version,
    _calculate_shap,
    _lag1_baseline_metrics,
)
from app.services.model_storage import (
    get_model_meta,
    get_model_path,
    get_scaler_path,
    save_model_meta,
)

logger = logging.getLogger(__name__)

_MODEL_CACHE: Dict[str, Tuple[str, Any, StandardScaler]] = {}


def _build_estimator(samples_count: int):
    if samples_count < MIN_SAMPLES_GBR:
        estimator = RidgeCV(
            alphas=[0.01, 0.1, 1.0, 10.0, 100.0],
            cv=max(2, min(5, samples_count // 3)),
        )
        return estimator, "ridge"

    n_estimators = min(200, samples_count * 4)
    estimator = GradientBoostingRegressor(
        n_estimators=n_estimators,
        learning_rate=0.05,
        max_depth=3,
        subsample=0.8,
        min_samples_leaf=max(3, samples_count // 15),
        random_state=RF_RANDOM_STATE,
    )
    return estimator, "gradient_boosting"


def _build_cv_pipeline(estimator) -> Pipeline:
    return Pipeline(
        [
            ("scaler", StandardScaler()),
            ("model", clone(estimator)),
        ]
    )


def _get_cached_model(user_id: str, version: str):
    cached = _MODEL_CACHE.get(user_id)
    if cached and cached[0] == version:
        return cached[1], cached[2]
    return None, None


def _set_cached_model(
    user_id: str,
    version: str,
    model: Any,
    scaler: StandardScaler,
) -> None:
    _MODEL_CACHE[user_id] = (version, model, scaler)


def train_model(
    user_id: str,
    data: HealthData,
    user_profile: Optional[Any] = None,
) -> Dict[str, Any]:
    meta = get_model_meta(user_id)
    existing_feature_names = meta.get("feature_names") if meta else None

    X, y, feature_names = _build_dataset(
        data,
        feature_names=existing_feature_names,
        user_profile=user_profile,
    )

    if X is None or y is None or len(y) < MIN_SAMPLES_TO_TRAIN:
        return {
            "status": "skipped",
            "reason": "not_enough_labeled_data",
            "samples": len(y) if y is not None else 0,
        }

    samples_count = len(y)
    features_count = X.shape[1]

    scaler = StandardScaler()
    X_scaled = scaler.fit_transform(X)
    model, model_type_name = _build_estimator(samples_count)
    model.fit(X_scaled, y)

    if model_type_name == "ridge" and hasattr(model, "alpha_"):
        logger.info(
            f"[{user_id}] RidgeCV alpha={model.alpha_:.3f} (n={samples_count} < {MIN_SAMPLES_GBR})"
        )
    elif model_type_name == "gradient_boosting":
        logger.info(
            f"[{user_id}] GBR (n={samples_count}, "
            f"n_estimators={getattr(model, 'n_estimators', 'n/a')})"
        )

    # ── Кросс-валидация (TimeSeriesSplit, без shuffle) ───────────────────────
    cv_mae:    Optional[float] = None
    cv_r2:     Optional[float] = None
    cv_status: str             = "insufficient_data"

    if samples_count >= MIN_SAMPLES_CV:
        n_splits = min(5, max(2, samples_count // 5))
        tscv = TimeSeriesSplit(n_splits=n_splits)
        cv_pipeline = _build_cv_pipeline(model)

        cv_scores_mae = cross_val_score(
            cv_pipeline,
            X,
            y,
            cv=tscv,
            scoring="neg_mean_absolute_error",
        )
        cv_scores_r2 = cross_val_score(
            cv_pipeline,
            X,
            y,
            cv=tscv,
            scoring="r2",
        )
        cv_mae    = round(float(-cv_scores_mae.mean()), 3)
        cv_r2     = round(float(cv_scores_r2.mean()), 3)
        cv_status = "ok"

    oob_r2: Optional[float] = None
    if hasattr(model, "oob_score_") and model.oob_score_ is not None:
        oob_r2 = round(float(model.oob_score_), 3)

    # ── Baseline lag-1: «mood завтра = mood вчера» ───────────────────────────
    # Без сравнения с этим baseline нельзя сказать, добавляют ли 23 фичи реальный
    # сигнал поверх простой авторегрессии. Если improvement_mae_pct ≈ 0 (или
    # отрицательный) — модель не нужна и фронту лучше показать честный «модель
    # ещё калибруется, пока работают правила».
    baseline_mae, baseline_r2 = _lag1_baseline_metrics(y)

    improvement_mae_pct: Optional[float] = None
    if cv_mae is not None and baseline_mae and baseline_mae > 0:
        improvement_mae_pct = round((1.0 - cv_mae / baseline_mae) * 100, 1)

    version = _bump_version(meta.get("version", "v0") if meta else "v0")
    model_meta = {
        "version":             version,
        "model_type":          model_type_name,
        "trained_at":          datetime.now(timezone.utc).isoformat(),
        "samples":             samples_count,
        "features":            features_count,
        "feature_names":       feature_names,
        "cv_status":           cv_status,
        "cv_mae":              cv_mae,
        "cv_r2":               cv_r2,
        "oob_r2":              oob_r2,
        "baseline_mae":        baseline_mae,
        "baseline_r2":         baseline_r2,
        "improvement_mae_pct": improvement_mae_pct,
    }

    model_path = get_model_path(user_id)
    scaler_path = get_scaler_path(user_id)
    with user_model_lock(user_id):
        Path(model_path).parent.mkdir(parents=True, exist_ok=True)
        atomic_joblib_dump(model, model_path)
        atomic_joblib_dump(scaler, scaler_path)
        save_model_meta(user_id, model_meta)

    _set_cached_model(user_id, version, model, scaler)

    logger.info(
        f"[{user_id}] Trained [{model_type_name}]: {samples_count} samples, "
        f"{features_count} features, cv_status={cv_status}, "
        f"cv_mae={cv_mae}, baseline_mae={baseline_mae}, "
        f"improvement={improvement_mae_pct}%"
    )

    return {
        "status":              "trained",
        "version":             version,
        "model_type":          model_type_name,
        "samples":             samples_count,
        "features":            features_count,
        "cv_status":           cv_status,
        "cv_mae":              cv_mae,
        "cv_r2":               cv_r2,
        "oob_r2":              oob_r2,
        "baseline_mae":        baseline_mae,
        "baseline_r2":         baseline_r2,
        "improvement_mae_pct": improvement_mae_pct,
    }


def predict_mood(
    user_id: str,
    data: HealthData,
    user_profile: Optional[Any] = None,
) -> Tuple[Optional[float], Optional[float], Optional[float], List[Dict]]:
    meta = get_model_meta(user_id)
    if meta is None:
        logger.warning(f"[{user_id}] No model meta found")
        return None, None, None, []

    feature_names: Optional[List[str]] = meta.get("feature_names")
    if not feature_names:
        logger.warning(f"[{user_id}] feature_names missing in meta")
        return None, None, None, []

    model_path = get_model_path(user_id)
    scaler_path = get_scaler_path(user_id)
    if not Path(model_path).exists() or not Path(scaler_path).exists():
        logger.warning(f"[{user_id}] Model files not found")
        return None, None, None, []

    version = str(meta.get("version", "v0"))
    model, scaler = _get_cached_model(user_id, version)
    if model is None or scaler is None:
        try:
            with user_model_lock(user_id):
                model = joblib.load(model_path)
                scaler = joblib.load(scaler_path)
            _set_cached_model(user_id, version, model, scaler)
        except Exception as e:
            logger.error(f"[{user_id}] Failed to load model: {e}")
            return None, None, None, []

    feats = build_features(data, user_profile=user_profile)
    if not feats:
        return None, None, None, []

    x_raw = np.nan_to_num(
        features_to_array(feats, feature_names).reshape(1, -1),
        nan=0.0,
        posinf=0.0,
        neginf=0.0,
    )
    x_scaled = scaler.transform(x_raw)

    raw_pred = float(model.predict(x_scaled)[0])
    predicted_mood = round(max(1.0, min(10.0, raw_pred)), 1)

    model_type = meta.get("model_type", "unknown")
    cv_mae = float(meta.get("cv_mae") or 0.8)

    if model_type in {"gradient_boosting", "ridge"}:
        lower = round(max(1.0, predicted_mood - cv_mae), 1)
        upper = round(min(10.0, predicted_mood + cv_mae), 1)
    elif hasattr(model, "estimators_"):
        tree_preds = np.array([t.predict(x_scaled)[0] for t in model.estimators_])
        lower = round(max(1.0, float(np.percentile(tree_preds, 10))), 1)
        upper = round(min(10.0, float(np.percentile(tree_preds, 90))), 1)
    else:
        lower = round(max(1.0, predicted_mood - cv_mae), 1)
        upper = round(min(10.0, predicted_mood + cv_mae), 1)

    top_influencers = _calculate_shap(
        model=model,
        scaler=scaler,
        x_raw=x_raw,
        x_scaled=x_scaled,
        feature_names=feature_names,
        feats_dict=feats,
        top_n=5,
        model_type=model_type,
    )

    logger.info(
        f"[{user_id}] mood={predicted_mood} [{lower}-{upper}] "
        f"model={model_type}, "
        f"top={top_influencers[0]['factor'] if top_influencers else 'n/a'}"
    )

    return predicted_mood, lower, upper, top_influencers
