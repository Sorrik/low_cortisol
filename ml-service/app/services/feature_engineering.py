from __future__ import annotations

from dataclasses import dataclass
from datetime import date, datetime, timedelta
from typing import Any, Dict, Iterable, List, Optional, Tuple

import numpy as np

from app.schemas.input import HealthData


# ─────────────────────────────────────────────────────────────
# Domain constants (можешь потом вынести в config)
# ─────────────────────────────────────────────────────────────

LOOKBACK_DAYS_MAIN = 14          # окно для "средних" и трендов
LOOKBACK_DAYS_DEBT = 7           # окно для sleep debt / коротких эффектов
NORM_DAYS = 30                   # окно для личных норм (медиана)

SLEEP_TARGET_HOURS = 8.0
SLEEP_OPTIMAL_MIN = 7.0
SLEEP_OPTIMAL_MAX = 9.0
SLEEP_QUALITY_GOOD = 7.0

STRESS_LOW = 3.0
STRESS_HIGH = 7.0
STRESS_CRITICAL = 8.5

WATER_OPTIMAL_ML = 2000.0
WATER_LOW_ML = 1500.0
WATER_CRITICAL_ML = 1200.0

CALORIES_MIN = 1400.0
CALORIES_OPTIMAL = 2000.0
PROTEIN_MIN = 40.0
PROTEIN_GOOD = 80.0

# Упрощённая оценка потерь воды от активности:
# базовая потеря на минуту × коэффициент интенсивности.
BASE_SWEAT_ML_PER_MIN = 10.0
INTENSITY_FACTOR = {"light": 0.8, "moderate": 1.0, "vigorous": 1.3}


# ─────────────────────────────────────────────────────────────
# Utilities: dates, safe stats
# ─────────────────────────────────────────────────────────────

def _parse_date(value: Any) -> Optional[date]:
    if value is None:
        return None
    if isinstance(value, date) and not isinstance(value, datetime):
        return value
    if isinstance(value, datetime):
        return value.date()
    if isinstance(value, str):
        # ожидаем "YYYY-MM-DD"
        try:
            return datetime.strptime(value, "%Y-%m-%d").date()
        except ValueError:
            return None
    return None


def _nanmean(x: Iterable[float]) -> float:
    arr = np.array(list(x), dtype=float)
    if arr.size == 0:
        return 0.0
    m = np.nanmean(arr)
    return float(m) if np.isfinite(m) else 0.0


def _nanstd(x: Iterable[float]) -> float:
    arr = np.array(list(x), dtype=float)
    if arr.size <= 1:
        return 0.0
    s = np.nanstd(arr)
    return float(s) if np.isfinite(s) else 0.0


def _clip01(v: float) -> float:
    return float(max(0.0, min(1.0, v)))


def _trend_last3_vs_prev3(values: List[float]) -> float:
    """
    values: список длины >= 6, где nan допустим.
    Возвращает (mean(last3) - mean(prev3)).
    """
    arr = np.array(values, dtype=float)
    if arr.size < 6:
        return 0.0
    prev3 = arr[-6:-3]
    last3 = arr[-3:]
    a = np.nanmean(last3) - np.nanmean(prev3)
    return float(a) if np.isfinite(a) else 0.0


def _median_norm(values: List[float]) -> float:
    arr = np.array(values, dtype=float)
    arr = arr[np.isfinite(arr)]
    if arr.size == 0:
        return 0.0
    return float(np.median(arr))


def _as_float(v: Any, default: float = 0.0) -> float:
    try:
        if v is None:
            return float(default)
        return float(v)
    except Exception:
        return float(default)


# ─────────────────────────────────────────────────────────────
# Daily aggregation containers
# ─────────────────────────────────────────────────────────────

@dataclass
class DayAgg:
    sleep_duration_h: float = np.nan
    sleep_quality: float = np.nan
    sleep_interruptions: float = np.nan

    stress_level: float = np.nan

    activity_minutes: float = np.nan
    activity_calories: float = np.nan
    activity_intensity_avg: float = np.nan  # 1=light,2=moderate,3=vigorous

    water_ml: float = np.nan

    calories: float = np.nan
    protein_g: float = np.nan
    carbs_g: float = np.nan
    fat_g: float = np.nan

    mood: float = np.nan


def _collect_all_dates(data: HealthData) -> List[date]:
    dates: List[date] = []

    for seq in [getattr(data, "sleep", None), getattr(data, "stress", None),
                getattr(data, "activity", None), getattr(data, "water", None),
                getattr(data, "nutrition", None), getattr(data, "mood", None)]:
        if not seq:
            continue
        for r in seq:
            d = _parse_date(getattr(r, "date", None))
            if d:
                dates.append(d)

    return dates


def _date_range(end: date, days: int) -> List[date]:
    start = end - timedelta(days=days - 1)
    return [start + timedelta(days=i) for i in range(days)]


def _intensity_to_num(s: Any) -> float:
    if not s:
        return 1.0
    s = str(s).lower().strip()
    return {"light": 1.0, "moderate": 2.0, "vigorous": 3.0}.get(s, 1.0)


def _intensity_factor(s: Any) -> float:
    if not s:
        return 1.0
    s = str(s).lower().strip()
    return float(INTENSITY_FACTOR.get(s, 1.0))


def _build_daily_table(data: HealthData, window_dates: List[date]) -> Dict[date, DayAgg]:
    table = {d: DayAgg() for d in window_dates}

    # Sleep: обычно 1 запись/день → берём последнюю, если несколько
    if getattr(data, "sleep", None):
        for r in data.sleep:
            d = _parse_date(getattr(r, "date", None))
            if d in table:
                table[d].sleep_duration_h = _as_float(getattr(r, "duration_hours", None), np.nan)
                table[d].sleep_quality = _as_float(getattr(r, "quality", None), np.nan)
                table[d].sleep_interruptions = _as_float(getattr(r, "interruptions", None), np.nan)

    # Stress: 1 запись/день
    if getattr(data, "stress", None):
        for r in data.stress:
            d = _parse_date(getattr(r, "date", None))
            if d in table:
                table[d].stress_level = _as_float(getattr(r, "level", None), np.nan)

    # Water: 1 запись/день
    if getattr(data, "water", None):
        for r in data.water:
            d = _parse_date(getattr(r, "date", None))
            if d in table:
                table[d].water_ml = _as_float(getattr(r, "amount_ml", None), np.nan)

    # Nutrition: 1 запись/день
    if getattr(data, "nutrition", None):
        for r in data.nutrition:
            d = _parse_date(getattr(r, "date", None))
            if d in table:
                table[d].calories = _as_float(getattr(r, "calories", None), np.nan)
                table[d].protein_g = _as_float(getattr(r, "protein_grams", None), np.nan)
                table[d].carbs_g = _as_float(getattr(r, "carbs_grams", None), np.nan)
                table[d].fat_g = _as_float(getattr(r, "fat_grams", None), np.nan)

    # Mood: 1 запись/день
    if getattr(data, "mood", None):
        for r in data.mood:
            d = _parse_date(getattr(r, "date", None))
            if d in table:
                table[d].mood = _as_float(getattr(r, "mood_score", None), np.nan)

    # Activity: может быть несколько тренировок/день → суммируем минуты/калории, усредняем интенсивность
    if getattr(data, "activity", None):
        tmp: Dict[date, Dict[str, Any]] = {}
        for r in data.activity:
            d = _parse_date(getattr(r, "date", None))
            if d not in table:
                continue
            minutes = _as_float(getattr(r, "duration_minutes", None), 0.0)
            cals = _as_float(getattr(r, "calories_burned", None), 0.0)
            intens = getattr(r, "intensity", None)

            if d not in tmp:
                tmp[d] = {"minutes": 0.0, "cals": 0.0, "int_sum": 0.0, "int_cnt": 0.0}
            tmp[d]["minutes"] += minutes
            tmp[d]["cals"] += cals
            tmp[d]["int_sum"] += _intensity_to_num(intens)
            tmp[d]["int_cnt"] += 1.0

        for d, v in tmp.items():
            table[d].activity_minutes = float(v["minutes"]) if v["minutes"] > 0 else np.nan
            table[d].activity_calories = float(v["cals"]) if v["minutes"] > 0 else np.nan
            table[d].activity_intensity_avg = float(v["int_sum"] / max(v["int_cnt"], 1.0))

    return table


def _lag(values: List[float], k: int) -> float:
    """k=0 => last day, k=1 => previous day, etc."""
    if not values:
        return 0.0
    idx = len(values) - 1 - k
    if idx < 0:
        return 0.0
    v = values[idx]
    return float(v) if np.isfinite(v) else 0.0


# ─────────────────────────────────────────────────────────────
# Main API
# ─────────────────────────────────────────────────────────────

def build_features(data: HealthData) -> Dict[str, float]:
    """
    100% новая версия:
    - собирает ежедневные ряды за последние LOOKBACK_DAYS_MAIN
    - считает лаги (t, t-1, t-2)
    - считает сонный долг (LOOKBACK_DAYS_DEBT)
    - считает нетто-гидратацию (учёт активности)
    - считает тренды last3 vs prev3
    - считает взаимодействия (combo)
    - добавляет missingness (важно для реальных данных)
    """
    all_dates = _collect_all_dates(data)
    if not all_dates:
        return _empty_feature_vector()

    ref = max(all_dates)
    window_main = _date_range(ref, LOOKBACK_DAYS_MAIN)
    window_norm = _date_range(ref, min(NORM_DAYS, max(LOOKBACK_DAYS_MAIN, 7) + 23))  # чуть шире main
    window_debt = _date_range(ref, LOOKBACK_DAYS_DEBT)

    daily_main = _build_daily_table(data, window_main)
    daily_norm = _build_daily_table(data, window_norm)
    daily_debt = _build_daily_table(data, window_debt)

    # Extract series (main)
    sleep_dur = [daily_main[d].sleep_duration_h for d in window_main]
    sleep_q = [daily_main[d].sleep_quality for d in window_main]
    sleep_int = [daily_main[d].sleep_interruptions for d in window_main]

    stress = [daily_main[d].stress_level for d in window_main]

    act_min = [daily_main[d].activity_minutes for d in window_main]
    act_cal = [daily_main[d].activity_calories for d in window_main]
    act_int = [daily_main[d].activity_intensity_avg for d in window_main]

    water = [daily_main[d].water_ml for d in window_main]

    calories = [daily_main[d].calories for d in window_main]
    protein = [daily_main[d].protein_g for d in window_main]
    carbs = [daily_main[d].carbs_g for d in window_main]
    fat = [daily_main[d].fat_g for d in window_main]

    mood = [daily_main[d].mood for d in window_main]

    # Norm series (30-ish days)
    sleep_dur_norm = [daily_norm[d].sleep_duration_h for d in window_norm]
    stress_norm = [daily_norm[d].stress_level for d in window_norm]
    act_min_norm = [daily_norm[d].activity_minutes for d in window_norm]
    water_norm = [daily_norm[d].water_ml for d in window_norm]
    calories_norm = [daily_norm[d].calories for d in window_norm]
    protein_norm = [daily_norm[d].protein_g for d in window_norm]

    # Missingness (share of days with data)
    f: Dict[str, float] = {}
    f["missing_sleep_ratio"] = _clip01(1.0 - _present_ratio(sleep_dur))
    f["missing_stress_ratio"] = _clip01(1.0 - _present_ratio(stress))
    f["missing_activity_ratio"] = _clip01(1.0 - _present_ratio(act_min))
    f["missing_water_ratio"] = _clip01(1.0 - _present_ratio(water))
    f["missing_nutrition_ratio"] = _clip01(1.0 - _present_ratio(calories))
    f["missing_mood_ratio"] = _clip01(1.0 - _present_ratio(mood))

    # ── Sleep aggregates + lags
    f["sleep_duration_mean"] = _nanmean(sleep_dur)
    f["sleep_duration_std"] = _nanstd(sleep_dur)
    f["sleep_quality_mean"] = _nanmean(sleep_q)
    f["sleep_quality_std"] = _nanstd(sleep_q)
    f["sleep_interruptions_mean"] = _nanmean(sleep_int)

    f["sleep_duration_t"] = _lag(sleep_dur, 0)
    f["sleep_duration_t1"] = _lag(sleep_dur, 1)
    f["sleep_duration_t2"] = _lag(sleep_dur, 2)

    f["sleep_quality_t"] = _lag(sleep_q, 0)
    f["sleep_quality_t1"] = _lag(sleep_q, 1)
    f["sleep_quality_t2"] = _lag(sleep_q, 2)

    # Sleep debt (last 7 days)
    sleep_dur_debt = [daily_debt[d].sleep_duration_h for d in window_debt]
    f["sleep_debt_hours_7d"] = _sleep_debt_hours(sleep_dur_debt, target=SLEEP_TARGET_HOURS)
    f["sleep_deficit_days_7d"] = float(sum(1 for v in sleep_dur_debt if np.isfinite(v) and v < SLEEP_OPTIMAL_MIN))
    f["sleep_optimal_days_7d"] = float(sum(1 for v, q in zip(
        [daily_debt[d].sleep_duration_h for d in window_debt],
        [daily_debt[d].sleep_quality for d in window_debt]
    ) if np.isfinite(v) and np.isfinite(q) and (SLEEP_OPTIMAL_MIN <= v <= SLEEP_OPTIMAL_MAX) and (q >= SLEEP_QUALITY_GOOD)))

    # ── Stress aggregates + lags
    f["stress_mean"] = _nanmean(stress)
    f["stress_std"] = _nanstd(stress)
    f["stress_t"] = _lag(stress, 0)
    f["stress_t1"] = _lag(stress, 1)
    f["stress_t2"] = _lag(stress, 2)
    f["stress_high_days_14d"] = float(sum(1 for v in stress if np.isfinite(v) and v >= STRESS_HIGH))
    f["stress_critical_days_14d"] = float(sum(1 for v in stress if np.isfinite(v) and v >= STRESS_CRITICAL))

    # ── Activity aggregates + lags
    f["activity_minutes_mean"] = _nanmean(act_min)
    f["activity_minutes_std"] = _nanstd(act_min)
    f["activity_minutes_t"] = _lag(act_min, 0)
    f["activity_minutes_t1"] = _lag(act_min, 1)
    f["activity_minutes_t2"] = _lag(act_min, 2)

    f["activity_intensity_mean"] = _nanmean(act_int)
    f["activity_calories_mean"] = _nanmean(act_cal)
    f["activity_days_14d"] = float(sum(1 for v in act_min if np.isfinite(v) and v > 0))

    # Простая оценка "перегруза": много минут и высокая интенсивность
    f["activity_overload_flag"] = 1.0 if (f["activity_minutes_mean"] >= 75.0 and f["activity_intensity_mean"] >= 2.3) else 0.0

    # ── Water aggregates + lags
    f["water_ml_mean"] = _nanmean(water)
    f["water_ml_std"] = _nanstd(water)
    f["water_ml_t"] = _lag(water, 0)
    f["water_ml_t1"] = _lag(water, 1)
    f["water_ml_t2"] = _lag(water, 2)

    f["water_low_days_14d"] = float(sum(1 for v in water if np.isfinite(v) and v < WATER_LOW_ML))
    f["water_critical_days_14d"] = float(sum(1 for v in water if np.isfinite(v) and v < WATER_CRITICAL_ML))

    # Net hydration: вода минус оценка потерь от активности
    net_hyd = _net_hydration_series(water, act_min, act_int)
    f["net_hydration_ml_mean"] = _nanmean(net_hyd)
    f["net_hydration_ml_t"] = _lag(net_hyd, 0)
    f["net_hydration_low_days_14d"] = float(sum(1 for v in net_hyd if np.isfinite(v) and v < (WATER_LOW_ML - 300)))

    # ── Nutrition aggregates + lags
    f["calories_mean"] = _nanmean(calories)
    f["protein_mean"] = _nanmean(protein)
    f["carbs_mean"] = _nanmean(carbs)
    f["fat_mean"] = _nanmean(fat)

    f["calories_t"] = _lag(calories, 0)
    f["calories_t1"] = _lag(calories, 1)
    f["protein_t"] = _lag(protein, 0)
    f["protein_t1"] = _lag(protein, 1)

    f["calorie_deficit_days_14d"] = float(sum(1 for v in calories if np.isfinite(v) and v < CALORIES_MIN))
    f["low_protein_days_14d"] = float(sum(1 for v in protein if np.isfinite(v) and v < PROTEIN_MIN))

    # Макросы: доля белка в калориях (очень грубо, но полезно)
    f["protein_ratio_proxy"] = _safe_div(f["protein_mean"], max(f["calories_mean"], 1.0))

    # ── Mood aggregates + lags (история настроения как инерция)
    f["mood_mean"] = _nanmean(mood)
    f["mood_std"] = _nanstd(mood)
    f["mood_t"] = _lag(mood, 0)
    f["mood_t1"] = _lag(mood, 1)
    f["mood_t2"] = _lag(mood, 2)

    # ─────────────────────────────────────────────
    # Trends (last3 vs prev3) on main window
    # ─────────────────────────────────────────────
    f["sleep_duration_trend"] = _trend_last3_vs_prev3(_ensure_len(sleep_dur, 6))
    f["sleep_quality_trend"] = _trend_last3_vs_prev3(_ensure_len(sleep_q, 6))
    f["stress_trend"] = _trend_last3_vs_prev3(_ensure_len(stress, 6))
    f["activity_minutes_trend"] = _trend_last3_vs_prev3(_ensure_len(act_min, 6))
    f["water_trend"] = _trend_last3_vs_prev3(_ensure_len(water, 6))
    f["net_hydration_trend"] = _trend_last3_vs_prev3(_ensure_len(net_hyd, 6))
    f["calories_trend"] = _trend_last3_vs_prev3(_ensure_len(calories, 6))
    f["protein_trend"] = _trend_last3_vs_prev3(_ensure_len(protein, 6))
    f["mood_trend"] = _trend_last3_vs_prev3(_ensure_len(mood, 6))

    # ─────────────────────────────────────────────
    # Personal norms (median) and deviations
    # ─────────────────────────────────────────────
    sleep_norm = _median_norm(sleep_dur_norm)
    stress_n = _median_norm(stress_norm)
    act_norm = _median_norm(act_min_norm)
    water_n = _median_norm(water_norm)
    cal_n = _median_norm(calories_norm)
    prot_n = _median_norm(protein_norm)

    # Если нормы пустые (0), подставляем разумные базовые
    if sleep_norm <= 0:
        sleep_norm = SLEEP_TARGET_HOURS
    if stress_n <= 0:
        stress_n = 5.0
    if act_norm <= 0:
        act_norm = 30.0
    if water_n <= 0:
        water_n = WATER_OPTIMAL_ML
    if cal_n <= 0:
        cal_n = CALORIES_OPTIMAL
    if prot_n <= 0:
        prot_n = PROTEIN_GOOD

    f["sleep_vs_norm"] = f["sleep_duration_mean"] - sleep_norm
    f["stress_vs_norm"] = f["stress_mean"] - stress_n
    f["activity_vs_norm"] = f["activity_minutes_mean"] - act_norm
    f["water_vs_norm"] = f["water_ml_mean"] - water_n
    f["calories_vs_norm"] = f["calories_mean"] - cal_n
    f["protein_vs_norm"] = f["protein_mean"] - prot_n

    # ─────────────────────────────────────────────
    # Interaction (combo) features
    # ─────────────────────────────────────────────
    sleep_ok = 1.0 if (f["sleep_duration_t"] >= SLEEP_OPTIMAL_MIN and f["sleep_quality_t"] >= SLEEP_QUALITY_GOOD) else 0.0
    stress_low = 1.0 if (f["stress_t"] > 0 and f["stress_t"] <= STRESS_LOW) else 0.0
    stress_high = 1.0 if (f["stress_t"] >= STRESS_HIGH) else 0.0
    water_low = 1.0 if (f["water_ml_t"] > 0 and f["water_ml_t"] < WATER_LOW_ML) else 0.0
    water_critical = 1.0 if (f["water_ml_t"] > 0 and f["water_ml_t"] < WATER_CRITICAL_ML) else 0.0
    under_cal = 1.0 if (f["calories_t"] > 0 and f["calories_t"] < CALORIES_MIN) else 0.0
    under_prot = 1.0 if (f["protein_t"] > 0 and f["protein_t"] < PROTEIN_MIN) else 0.0
    underfueled = 1.0 if (under_cal == 1.0 or under_prot == 1.0) else 0.0

    # Сон буферит стресс: высокий сон×низкий стресс — синергия
    f["combo_sleep_x_low_stress"] = (f["sleep_quality_t"] / 10.0) * (1.0 - min(f["stress_t"], 10.0) / 10.0)

    # "Выспался, но обезвожен"
    f["combo_good_sleep_but_dehydrated"] = 1.0 if (sleep_ok == 1.0 and water_low == 1.0) else 0.0

    # "Выспался, нет стресса, но не поел/не добрал белок"
    f["combo_well_rested_but_underfueled"] = (f["sleep_quality_t"] / 10.0) * (1.0 - min(f["stress_t"], 10.0) / 10.0) * underfueled

    # Стресс + обезвоживание — часто “плохой день”, даже если сон норм
    f["combo_stress_x_dehydration"] = (min(f["stress_t"], 10.0) / 10.0) * water_low

    # Активность помогает, но при недосыпе может “добить”
    f["combo_activity_x_sleep"] = (min(f["activity_minutes_t"], 120.0) / 120.0) * (f["sleep_quality_t"] / 10.0)
    f["combo_activity_when_sleep_debt"] = (min(f["activity_minutes_t"], 120.0) / 120.0) * _clip01(f["sleep_debt_hours_7d"] / 10.0)

    # Тройной негатив: критически мало воды + мало еды + мало белка
    f["combo_triple_negative"] = 1.0 if (water_critical == 1.0 and under_cal == 1.0 and under_prot == 1.0) else 0.0

    # “Идеальный день” (упрощённо)
    f["combo_perfect_day"] = 1.0 if (sleep_ok == 1.0 and stress_low == 1.0 and water_low == 0.0 and f["activity_minutes_t"] >= 30.0) else 0.0

    # ─────────────────────────────────────────────
    # Final cleanup
    # ─────────────────────────────────────────────
    for k, v in list(f.items()):
        if v is None or not np.isfinite(float(v)):
            f[k] = 0.0
        else:
            f[k] = float(v)

    return f


def get_feature_names(data: HealthData) -> List[str]:
    """
    ВАЖНО: возвращаем детерминированный порядок, чтобы train/predict совпадали.
    """
    feats = build_features(data)
    return sorted(feats.keys())


def features_to_array(features: Dict[str, float], feature_names: Optional[List[str]] = None) -> np.ndarray:
    """
    feature_names можно передать извне (например, сохранённые при обучении).
    """
    if feature_names is None:
        feature_names = sorted(features.keys())
    arr = [float(features.get(name, 0.0)) for name in feature_names]
    return np.array(arr, dtype=float)


# ─────────────────────────────────────────────────────────────
# Helpers (missingness, debt, net hydration, safe div)
# ─────────────────────────────────────────────────────────────

def _present_ratio(values: List[float]) -> float:
    if not values:
        return 0.0
    present = sum(1 for v in values if np.isfinite(float(v)))
    return float(present / len(values))


def _sleep_debt_hours(values: List[float], target: float) -> float:
    """
    Сонный долг: сумма недобора относительно target.
    """
    debt = 0.0
    for v in values:
        if not np.isfinite(float(v)):
            continue
        deficit = max(0.0, target - float(v))
        debt += deficit
    return float(debt)


def _net_hydration_series(water_ml: List[float], activity_min: List[float], activity_int: List[float]) -> List[float]:
    """
    Нетто-гидратация = вода - оценка потерь воды от активности.
    Это приближение, но оно важно для “скрытой связи” вода×активность.
    """
    out: List[float] = []
    n = max(len(water_ml), len(activity_min), len(activity_int))
    for i in range(n):
        w = water_ml[i] if i < len(water_ml) else np.nan
        m = activity_min[i] if i < len(activity_min) else np.nan
        inten = activity_int[i] if i < len(activity_int) else np.nan

        if not np.isfinite(float(w)):
            out.append(np.nan)
            continue

        minutes = float(m) if np.isfinite(float(m)) else 0.0
        inten_num = float(inten) if np.isfinite(float(inten)) else 2.0  # default moderate

        # 1..3 => 0.8..1.3 примерно
        factor = 0.8 + (min(max(inten_num, 1.0), 3.0) - 1.0) * 0.25  # 1->0.8, 2->1.05, 3->1.3
        loss = minutes * BASE_SWEAT_ML_PER_MIN * factor

        out.append(float(w) - float(loss))

    return out


def _safe_div(a: float, b: float) -> float:
    try:
        if b == 0:
            return 0.0
        return float(a) / float(b)
    except Exception:
        return 0.0


def _ensure_len(values: List[float], n: int) -> List[float]:
    """
    Для тренда last3 vs prev3 нужно хотя бы 6 значений.
    Если короче — вернём как есть (trend=0 уже обработается).
    """
    return values if len(values) >= n else values


def _empty_feature_vector() -> Dict[str, float]:
    # Минимальный “скелет” — чтобы модель не падала
    # (порядок не важен, get_feature_names сортирует)
    keys = [
        "missing_sleep_ratio", "missing_stress_ratio", "missing_activity_ratio",
        "missing_water_ratio", "missing_nutrition_ratio", "missing_mood_ratio",
        "sleep_duration_mean", "sleep_quality_mean", "stress_mean",
        "activity_minutes_mean", "water_ml_mean", "calories_mean", "protein_mean",
        "mood_mean"
    ]
    return {k: 0.0 for k in keys}
