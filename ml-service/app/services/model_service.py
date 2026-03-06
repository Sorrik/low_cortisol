from __future__ import annotations

import logging
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import numpy as np
import joblib
import shap
from sklearn.ensemble import RandomForestRegressor
from sklearn.model_selection import cross_val_score, KFold
from sklearn.preprocessing import StandardScaler

from app.schemas.input import HealthData
from app.services.feature_engineering import (
    build_features,
    features_to_array,
    get_feature_names,
)
from app.services.model_storage import (
    get_model_path,
    get_meta_path,
    get_scaler_path,
    save_model_meta,
    get_model_meta,
)

logger = logging.getLogger(__name__)

# ─────────────────────────────────────────────────────────────
# Constants
# ─────────────────────────────────────────────────────────────

MIN_SAMPLES_TO_TRAIN = 5
MIN_SAMPLES_CV       = 10
RF_N_ESTIMATORS      = 200
RF_MAX_DEPTH         = 6
RF_MIN_SAMPLES_LEAF  = 2
RF_RANDOM_STATE      = 42


# ─────────────────────────────────────────────────────────────
# Dataset builder
# ─────────────────────────────────────────────────────────────

def _build_dataset(
    data: HealthData,
    feature_names: Optional[List[str]] = None,
) -> Tuple[Optional[np.ndarray], Optional[np.ndarray], List[str]]:
    if not data.mood or len(data.mood) < MIN_SAMPLES_TO_TRAIN:
        return None, None, feature_names or []

    mood_sorted = sorted(data.mood, key=lambda r: str(getattr(r, "date", "")))

    X_rows: List[np.ndarray] = []
    y_vals: List[float] = []

    for mood_record in mood_sorted:
        target_date = str(getattr(mood_record, "date", ""))
        mood_score  = float(getattr(mood_record, "mood_score", 0))

        data_slice = _slice_data_up_to(data, target_date)
        if data_slice is None:
            continue

        feats = build_features(data_slice)
        if not feats:
            continue

        if feature_names is None:
            feature_names = sorted(feats.keys())

        row = features_to_array(feats, feature_names)
        X_rows.append(row)
        y_vals.append(mood_score)

    if len(X_rows) < MIN_SAMPLES_TO_TRAIN:
        return None, None, feature_names or []

    X = np.nan_to_num(np.vstack(X_rows), nan=0.0, posinf=0.0, neginf=0.0)
    y = np.array(y_vals, dtype=float)

    return X, y, feature_names or []


def _slice_data_up_to(data: HealthData, cutoff_date_str: str) -> Optional[HealthData]:
    from app.schemas.input import HealthData as HD
    try:
        kwargs: Dict[str, Any] = {"user_id": data.user_id}
        for field in ["sleep", "stress", "activity", "water", "nutrition", "mood"]:
            records  = getattr(data, field, None) or []
            filtered = [r for r in records if str(getattr(r, "date", "9999")) <= cutoff_date_str]
            kwargs[field] = filtered
        return HD(**kwargs)
    except Exception as e:
        logger.warning(f"_slice_data_up_to error: {e}")
        return None


# ─────────────────────────────────────────────────────────────
# Train
# ─────────────────────────────────────────────────────────────

def train_model(user_id: str, data: HealthData) -> Dict[str, Any]:
    meta                   = get_model_meta(user_id)
    existing_feature_names = meta.get("feature_names") if meta else None

    X, y, feature_names = _build_dataset(data, feature_names=existing_feature_names)

    if X is None or y is None or len(y) < MIN_SAMPLES_TO_TRAIN:
        return {
            "status": "skipped",
            "reason": "not_enough_labeled_data",
            "samples": len(y) if y is not None else 0,
        }

    samples_count  = len(y)
    features_count = X.shape[1]

    scaler   = StandardScaler()
    X_scaled = scaler.fit_transform(X)

    model = RandomForestRegressor(
        n_estimators=RF_N_ESTIMATORS,
        max_depth=RF_MAX_DEPTH,
        min_samples_leaf=RF_MIN_SAMPLES_LEAF,
        max_features="sqrt",
        bootstrap=True,
        oob_score=True,
        random_state=RF_RANDOM_STATE,
        n_jobs=-1,
    )
    model.fit(X_scaled, y)

    cv_mae: Optional[float] = None
    if samples_count >= MIN_SAMPLES_CV:
        n_splits  = min(5, samples_count // 2)
        kf        = KFold(n_splits=n_splits, shuffle=True, random_state=RF_RANDOM_STATE)
        cv_scores = cross_val_score(model, X_scaled, y, cv=kf,
                                    scoring="neg_mean_absolute_error", n_jobs=-1)
        cv_mae = round(float(-cv_scores.mean()), 3)

    oob_r2 = round(float(model.oob_score_), 3) if model.oob_score_ is not None else None

    model_path  = get_model_path(user_id)
    scaler_path = get_scaler_path(user_id)
    Path(model_path).parent.mkdir(parents=True, exist_ok=True)
    joblib.dump(model, model_path)
    joblib.dump(scaler, scaler_path)

    version = _bump_version(meta.get("version", "v0") if meta else "v0")
    save_model_meta(user_id, {
        "version":       version,
        "trained_at":    datetime.now(timezone.utc).isoformat(),
        "samples":       samples_count,
        "features":      features_count,
        "feature_names": feature_names,
        "cv_mae":        cv_mae,
        "oob_r2":        oob_r2,
    })

    logger.info(
        f"[{user_id}] Trained: {samples_count} samples, "
        f"{features_count} features, cv_mae={cv_mae}, oob_r2={oob_r2}"
    )

    return {
        "status":   "trained",
        "version":  version,
        "samples":  samples_count,
        "features": features_count,
        "cv_mae":   cv_mae,
        "oob_r2":   oob_r2,
    }


# ─────────────────────────────────────────────────────────────
# Predict
# ─────────────────────────────────────────────────────────────

def predict_mood(
    user_id: str,
    data: HealthData,
) -> Tuple[Optional[float], Optional[float], Optional[float], List[Dict]]:

    meta = get_model_meta(user_id)
    if meta is None:
        logger.warning(f"[{user_id}] No model meta found")
        return None, None, None, []

    feature_names: Optional[List[str]] = meta.get("feature_names")
    if not feature_names:
        logger.warning(f"[{user_id}] feature_names missing in meta")
        return None, None, None, []

    model_path  = get_model_path(user_id)
    scaler_path = get_scaler_path(user_id)

    if not Path(model_path).exists() or not Path(scaler_path).exists():
        logger.warning(f"[{user_id}] Model files not found")
        return None, None, None, []

    try:
        model: RandomForestRegressor = joblib.load(model_path)
        scaler: StandardScaler       = joblib.load(scaler_path)
    except Exception as e:
        logger.error(f"[{user_id}] Failed to load model: {e}")
        return None, None, None, []

    feats = build_features(data)
    if not feats:
        return None, None, None, []

    x_raw    = np.nan_to_num(features_to_array(feats, feature_names).reshape(1, -1),
                              nan=0.0, posinf=0.0, neginf=0.0)
    x_scaled = scaler.transform(x_raw)

    tree_predictions = np.array([t.predict(x_scaled)[0] for t in model.estimators_])

    predicted_mood = round(max(1.0, min(10.0, float(np.mean(tree_predictions)))), 1)
    lower          = round(max(1.0, float(np.percentile(tree_predictions, 10))), 1)
    upper          = round(min(10.0, float(np.percentile(tree_predictions, 90))), 1)

    top_influencers = _calculate_shap(
        model=model, scaler=scaler,
        x_raw=x_raw, x_scaled=x_scaled,
        feature_names=feature_names,
        feats_dict=feats, top_n=5,
    )

    logger.info(
        f"[{user_id}] mood={predicted_mood} [{lower}–{upper}], "
        f"top={top_influencers[0]['factor'] if top_influencers else 'n/a'}"
    )

    return predicted_mood, lower, upper, top_influencers


# ─────────────────────────────────────────────────────────────
# SHAP
# ─────────────────────────────────────────────────────────────

def _calculate_shap(
    model: RandomForestRegressor,
    scaler: StandardScaler,
    x_raw: np.ndarray,
    x_scaled: np.ndarray,
    feature_names: List[str],
    feats_dict: Dict[str, float],
    top_n: int = 5,
) -> List[Dict]:
    try:
        explainer   = shap.TreeExplainer(model)
        shap_values = explainer.shap_values(x_scaled)

        if shap_values is None or len(shap_values[0]) == 0:
            return []

        shap_arr    = np.abs(shap_values[0])
        top_indices = np.argsort(shap_arr)[::-1][:top_n]

        influencers: List[Dict] = []
        for idx in top_indices:
            if idx >= len(feature_names):
                continue

            factor        = feature_names[idx]
            raw_shap      = float(shap_values[0][idx])
            abs_shap      = abs(raw_shap)
            feature_value = float(feats_dict.get(factor, 0.0))
            direction     = "positive" if raw_shap >= 0 else "negative"
            description   = _factor_description(factor, raw_shap, feature_value)

            influencers.append({
                "factor":        factor,
                "impact":        round(abs_shap, 3),
                "raw_shap":      round(raw_shap, 3),
                "direction":     direction,
                "description":   description,
                "feature_value": round(feature_value, 2),
            })

        return influencers

    except Exception as e:
        logger.error(f"SHAP calculation failed: {e}")
        return []


def _factor_description(factor: str, raw_shap: float, value: float) -> str:
    """
    Человекочитаемое описание для каждого фактора.
    Охватываем все 85 фичей включая _t1, _t2 лаги.
    """
    dw     = "улучшает" if raw_shap >= 0 else "снижает"
    impact = round(abs(raw_shap), 2)
    val    = round(value, 1)
    sign   = "+" if val >= 0 else ""

    descriptions: Dict[str, str] = {

        # ── Сон (все лаги и агрегаты)
        "sleep_duration_mean":      f"Средний сон {val}ч за 14 дней {dw} настроение на {impact}",
        "sleep_duration_t":         f"Вчера сон {val}ч {dw} настроение на {impact}",
        "sleep_duration_t1":        f"Позавчера сон {val}ч {dw} настроение на {impact}",
        "sleep_duration_t2":        f"3 дня назад сон {val}ч {dw} настроение на {impact}",
        "sleep_quality_mean":       f"Качество сна {val}/10 (среднее) {dw} настроение на {impact}",
        "sleep_quality_t":          f"Вчерашнее качество сна {val}/10 {dw} настроение на {impact}",
        "sleep_quality_t1":         f"Позавчерашнее качество сна {val}/10 {dw} настроение на {impact}",
        "sleep_quality_t2":         f"Качество сна 3 дня назад: {val}/10 {dw} настроение на {impact}",
        "sleep_debt_hours_7d":      f"Сонный долг за неделю: {val}ч — {dw} настроение на {impact}",
        "sleep_deficit_days_7d":    f"Дней с недосыпом за неделю: {int(val)} — {dw} настроение на {impact}",
        "sleep_optimal_days_7d":    f"Дней с оптимальным сном за неделю: {int(val)} — {dw} настроение на {impact}",
        "sleep_duration_trend":     f"Тренд сна (last3 vs prev3): {sign}{val}ч — {dw} настроение на {impact}",
        "sleep_quality_trend":      f"Тренд качества сна: {sign}{val} — {dw} настроение на {impact}",
        "sleep_vs_norm":            f"Сон {'выше' if val >= 0 else 'ниже'} нормы на {abs(val)}ч — {dw} настроение на {impact}",
        "interruptions_mean":       f"Среднее прерываний сна: {val} — {dw} настроение на {impact}",
        "interruptions_t":          f"Прерываний сна вчера: {int(val)} — {dw} настроение на {impact}",

        # ── Стресс
        "stress_mean":              f"Средний стресс {val}/10 (14 дней) {dw} настроение на {impact}",
        "stress_t":                 f"Стресс вчера {val}/10 {dw} настроение на {impact}",
        "stress_t1":                f"Стресс позавчера {val}/10 {dw} настроение на {impact}",
        "stress_t2":                f"Стресс 3 дня назад: {val}/10 {dw} настроение на {impact}",
        "stress_high_days_14d":     f"Высокострессовых дней за 2 недели: {int(val)} — {dw} настроение на {impact}",
        "stress_critical_days_14d": f"Критических по стрессу дней за 2 недели: {int(val)} — {dw} настроение на {impact}",
        "stress_trend":             f"Тренд стресса: {sign}{val} — {dw} настроение на {impact}",
        "stress_vs_norm":           f"Стресс {'выше' if val >= 0 else 'ниже'} нормы на {abs(val)} — {dw} настроение на {impact}",

        # ── Активность
        "activity_minutes_mean":    f"Средняя активность {val} мин/день (14 дней) {dw} настроение на {impact}",
        "activity_minutes_t":       f"Активность вчера: {val} мин — {dw} настроение на {impact}",
        "activity_minutes_t1":      f"Активность позавчера: {val} мин — {dw} настроение на {impact}",
        "activity_minutes_t2":      f"Активность 3 дня назад: {val} мин — {dw} настроение на {impact}",
        "activity_days_14d":        f"Активных дней за 2 недели: {int(val)} — {dw} настроение на {impact}",
        "activity_minutes_trend":   f"Тренд активности: {sign}{val} мин — {dw} настроение на {impact}",
        "activity_overload_flag":   f"{'Перегруз от активности' if val > 0 else 'Нагрузка в норме'} — {dw} настроение на {impact}",
        "calories_burned_mean":     f"Среднее сожжённых ккал: {val} — {dw} настроение на {impact}",

        # ── Вода
        "water_ml_mean":            f"Среднее потребление воды {val} мл (14 дней) {dw} настроение на {impact}",
        "water_ml_t":               f"Вода вчера: {val} мл — {dw} настроение на {impact}",
        "water_ml_t1":              f"Вода позавчера: {val} мл — {dw} настроение на {impact}",
        "water_ml_t2":              f"Вода 3 дня назад: {val} мл — {dw} настроение на {impact}",
        "net_hydration_ml_mean":    f"Нетто-гидратация: {val} мл (вода−потери) — {dw} настроение на {impact}",
        "net_hydration_ml_t":       f"Нетто-гидратация вчера: {val} мл — {dw} настроение на {impact}",
        "net_hydration_ml_t1":      f"Нетто-гидратация позавчера: {val} мл — {dw} настроение на {impact}",
        "water_low_days_14d":       f"Дней с недостаточной водой: {int(val)} — {dw} настроение на {impact}",
        "water_critical_days_14d":  f"Дней с критическим обезвоживанием: {int(val)} — {dw} настроение на {impact}",
        "water_trend":              f"Тренд потребления воды: {sign}{val} мл — {dw} настроение на {impact}",
        "water_vs_norm":            f"Вода {'выше' if val >= 0 else 'ниже'} нормы на {abs(val)} мл — {dw} настроение на {impact}",

        # ── Питание (все лаги и агрегаты)
        "calories_mean":            f"Среднее ккал/день: {val} — {dw} настроение на {impact}",
        "calories_t":               f"Калорий вчера: {val} ккал — {dw} настроение на {impact}",
        "calories_t1":              f"Калорий позавчера: {val} ккал — {dw} настроение на {impact}",
        "calories_t2":              f"Калорий 3 дня назад: {val} ккал — {dw} настроение на {impact}",
        "protein_mean":             f"Средний белок: {val} г/день — {dw} настроение на {impact}",
        "protein_t":                f"Белок вчера: {val} г — {dw} настроение на {impact}",
        "protein_t1":               f"Белок позавчера: {val} г — {dw} настроение на {impact}",
        "protein_t2":               f"Белок 3 дня назад: {val} г — {dw} настроение на {impact}",
        "carbs_mean":               f"Средние углеводы: {val} г/день — {dw} настроение на {impact}",
        "fat_mean":                 f"Средние жиры: {val} г/день — {dw} настроение на {impact}",
        "calorie_deficit_days_14d": f"Дней с дефицитом калорий: {int(val)} — {dw} настроение на {impact}",
        "low_protein_days_14d":     f"Дней с низким белком: {int(val)} — {dw} настроение на {impact}",
        "calories_trend":           f"Тренд калорийности: {sign}{val} ккал — {dw} настроение на {impact}",
        "protein_trend":            f"Тренд белка: {sign}{val} г — {dw} настроение на {impact}",

        # ── История настроения
        "mood_mean":                f"Среднее настроение за 14 дней: {val}/10 — {dw} прогнозу на {impact}",
        "mood_t":                   f"Настроение вчера: {val}/10 — {dw} прогнозу на {impact}",
        "mood_t1":                  f"Настроение позавчера: {val}/10 — {dw} прогнозу на {impact}",
        "mood_t2":                  f"Настроение 3 дня назад: {val}/10 — {dw} прогнозу на {impact}",
        "mood_trend":               f"Тренд настроения: {sign}{val} — {dw} прогнозу на {impact}",
        "mood_std":                 f"Нестабильность настроения (σ={val}) — {dw} прогнозу на {impact}",
        "mood_min_7d":              f"Минимальное настроение за неделю: {val}/10 — {dw} прогнозу на {impact}",

        # ── Дата/временные паттерны
        "is_monday":                f"{'Понедельник' if val > 0 else 'Не понедельник'} — {dw} настроение на {impact}",
        "is_weekend":               f"{'Выходной день' if val > 0 else 'Рабочий день'} — {dw} настроение на {impact}",
        "day_of_week":              f"День недели ({int(val)}) — {dw} настроение на {impact}",

        # ── Комбо-факторы
        "combo_sleep_x_low_stress":         f"Комбо 'хороший сон + низкий стресс' {dw} настроение на {impact}",
        "combo_good_sleep_but_dehydrated":   f"⚠️ Выспался, но обезвожен — {dw} настроение на {impact}",
        "combo_well_rested_but_underfueled": f"⚠️ Отдохнул, но питание недостаточное — {dw} настроение на {impact}",
        "combo_stress_x_dehydration":        f"⚠️ Стресс + обезвоживание — {dw} настроение на {impact}",
        "combo_activity_x_sleep":            f"Активность × качество сна — {dw} настроение на {impact}",
        "combo_activity_when_sleep_debt":    f"⚠️ Активность при накопленном сонном долге — {dw} настроение на {impact}",
        "combo_triple_negative":             f"🚨 Тройной негатив (вода+еда+белок) — {dw} настроение на {impact}",
        "combo_perfect_day":                 f"✅ 'Идеальный день' (сон+стресс+вода+активность) {dw} настроение на {impact}",

        # ── Missingness
        "missing_nutrition_ratio":  f"Нет данных о питании — {dw} точности прогноза на {impact}",
        "missing_water_ratio":      f"Нет данных о воде — {dw} точности прогноза на {impact}",
        "missing_sleep_ratio":      f"Нет данных о сне — {dw} точности прогноза на {impact}",
        "missing_stress_ratio":     f"Нет данных о стрессе — {dw} точности прогноза на {impact}",
        "missing_activity_ratio":   f"Нет данных об активности — {dw} точности прогноза на {impact}",
    }

    return descriptions.get(
        factor,
        # Fallback: читаемый текст вместо "calories_t1 снижает..."
        f"{factor.replace('_', ' ').capitalize()} {dw} настроение на {impact}"
    )


# ─────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────

def _bump_version(current: str) -> str:
    try:
        return f"v{int(current.lstrip('v')) + 1}"
    except ValueError:
        return "v1"


def model_exists(user_id: str) -> bool:
    return Path(get_model_path(user_id)).exists()
