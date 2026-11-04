from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date, datetime, timedelta
from typing import Any, Dict, Iterable, List, Optional

import numpy as np

from app.schemas.input import HealthData


# ─────────────────────────────────────────────────────────────
# Domain constants
# ─────────────────────────────────────────────────────────────

LOOKBACK_DAYS_MAIN = 14
LOOKBACK_DAYS_DEBT = 7
NORM_DAYS          = 30

SLEEP_TARGET_HOURS = 8.0
SLEEP_OPTIMAL_MIN  = 7.0
SLEEP_OPTIMAL_MAX  = 9.0
SLEEP_QUALITY_GOOD = 7.0

# Циркадные константы
LATE_MEAL_HOUR       = 21    # приём пищи после 21:00 = поздний
EVENING_EXERCISE_HOUR = 20   # тренировка после 20:00 = вечерняя
LATE_BEDTIME_HOUR    = 24    # отход ко сну после полуночи = поздно
OPTIMAL_BEDTIME_HOUR = 23    # 23:00 — граница нормы

STRESS_LOW      = 3.0
STRESS_HIGH     = 7.0
STRESS_CRITICAL = 8.5

WATER_OPTIMAL_ML  = 2000.0
WATER_LOW_ML      = 1500.0
WATER_CRITICAL_ML = 1200.0

CALORIES_MIN     = 1400.0
CALORIES_OPTIMAL = 2000.0
PROTEIN_MIN      = 40.0
PROTEIN_GOOD     = 80.0
FAT_HIGH_RATIO   = 0.40   # жиры > 40% калорий = жирная еда

BASE_SWEAT_ML_PER_MIN = 10.0
INTENSITY_FACTOR = {"light": 0.8, "moderate": 1.0, "vigorous": 1.3}


# ─────────────────────────────────────────────────────────────
# Utilities
# ─────────────────────────────────────────────────────────────

def _parse_date(value: Any) -> Optional[date]:
    if value is None:
        return None
    if isinstance(value, date) and not isinstance(value, datetime):
        return value
    if isinstance(value, datetime):
        return value.date()
    if isinstance(value, str):
        try:
            return datetime.strptime(value, "%Y-%m-%d").date()
        except ValueError:
            return None
    return None


def _parse_time_to_hour(value: Any) -> Optional[float]:
    """
    Парсит строку времени "HH:MM" в десятичный час.
    "23:30" → 23.5, "00:30" → 0.5 (после полуночи), None если нет данных.
    """
    if value is None:
        return None
    s = str(value).strip()
    try:
        parts = s.split(":")
        h = int(parts[0])
        m = int(parts[1]) if len(parts) > 1 else 0
        return h + m / 60.0
    except Exception:
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


def _nanmedian(x: Iterable[float]) -> float:
    arr = np.array(list(x), dtype=float)
    arr = arr[np.isfinite(arr)]
    if arr.size == 0:
        return 0.0
    return float(np.median(arr))


def _nanmad(x: Iterable[float]) -> float:
    """
    Median Absolute Deviation: MAD = median(|x_i - median(x)|).

    Используется как робастная альтернатива std для baseline'а:
      - не «съезжает» от одного выброса (один тяжёлый день не сдвигает норму),
      - симметрично работает по обе стороны от центра.

    Возвращает 0.0 на пустом или константном входе.
    """
    arr = np.array(list(x), dtype=float)
    arr = arr[np.isfinite(arr)]
    if arr.size <= 1:
        return 0.0
    med = float(np.median(arr))
    deviations = np.abs(arr - med)
    mad = float(np.median(deviations))
    return mad if np.isfinite(mad) else 0.0


def _clip01(v: float) -> float:
    return float(max(0.0, min(1.0, v)))


def _trend_last3_vs_prev3(values: List[float]) -> float:
    arr = np.array(values, dtype=float)
    if arr.size < 6:
        return 0.0
    last3 = arr[-3:]
    prev3 = arr[-6:-3]
    # Если все значения в срезе NaN — np.nanmean даёт RuntimeWarning
    if not np.any(np.isfinite(last3)) or not np.any(np.isfinite(prev3)):
        return 0.0
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
        return float(default) if v is None else float(v)
    except Exception:
        return float(default)


# ─────────────────────────────────────────────────────────────
# Daily aggregation container — расширенный
# ─────────────────────────────────────────────────────────────

@dataclass
class DayAgg:
    # Сон — количество
    sleep_duration_h:       float = np.nan
    sleep_quality:          float = np.nan
    sleep_interruptions:    float = np.nan
    # Сон — ВРЕМЯ (новое)
    bed_hour:               float = np.nan   # час отхода ко сну (23.5 = 23:30)
    wake_hour:              float = np.nan   # час подъёма
    # Стресс
    stress_level:           float = np.nan
    # Активность — количество
    activity_minutes:       float = np.nan
    activity_calories:      float = np.nan
    activity_intensity_avg: float = np.nan
    # Активность — ВРЕМЯ (новое)
    evening_exercise_minutes:    float = 0.0      # минуты тренировок после 20:00
    evening_exercise_intensity:  float = np.nan   # интенсивность вечерней тренировки
    evening_exercise_start_hour: float = np.nan   # час начала последней вечерней тренировки
    # Вода
    water_ml:               float = np.nan
    # Питание — макронутриенты
    calories:               float = np.nan
    protein_g:              float = np.nan
    carbs_g:                float = np.nan
    fat_g:                  float = np.nan
    # Питание — ВРЕМЯ (новое)
    late_meal_calories:     float = 0.0    # калории после 21:00
    late_meal_fat_g:        float = 0.0    # жиры после 21:00
    # Настроение
    mood:                   float = np.nan
    # День недели (новое)
    day_of_week:            float = np.nan  # 0=пн, 6=вс


def _collect_all_dates(data: HealthData) -> List[date]:
    dates: List[date] = []
    for seq in [
        getattr(data, "sleep",     None),
        getattr(data, "stress",    None),
        getattr(data, "activity",  None),
        getattr(data, "water",     None),
        getattr(data, "nutrition", None),
        getattr(data, "mood",      None),
    ]:
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
    return {"light": 1.0, "moderate": 2.0, "vigorous": 3.0}.get(
        str(s).lower().strip(), 1.0
    )


def _build_daily_table(data: HealthData, window_dates: List[date]) -> Dict[date, DayAgg]:
    table: Dict[date, DayAgg] = {d: DayAgg() for d in window_dates}

    # ── Сон + время сна ──────────────────────────────────────
    if getattr(data, "sleep", None):
        for r in data.sleep:
            d = _parse_date(getattr(r, "date", None))
            if d in table:
                table[d].sleep_duration_h    = _as_float(getattr(r, "duration_hours", None), np.nan)
                table[d].sleep_quality       = _as_float(getattr(r, "quality",         None), np.nan)
                table[d].sleep_interruptions = _as_float(getattr(r, "interruptions",   None), np.nan)

                # Время сна — парсим bedTime и wakeTime
                bed_h  = _parse_time_to_hour(getattr(r, "bed_time",  None)
                                              or getattr(r, "bedTime", None))
                wake_h = _parse_time_to_hour(getattr(r, "wake_time", None)
                                              or getattr(r, "wakeTime", None))
                if bed_h is not None:
                    table[d].bed_hour  = bed_h
                if wake_h is not None:
                    table[d].wake_hour = wake_h

    # ── Стресс ───────────────────────────────────────────────
    if getattr(data, "stress", None):
        for r in data.stress:
            d = _parse_date(getattr(r, "date", None))
            if d in table:
                table[d].stress_level = _as_float(getattr(r, "level", None), np.nan)

    # ── День недели ───────────────────────────────────────────
    for d in window_dates:
        if d in table:
            table[d].day_of_week = float(d.weekday())  # 0=пн, 6=вс

    # ── Вода ─────────────────────────────────────────────────
    if getattr(data, "water", None):
        for r in data.water:
            d = _parse_date(getattr(r, "date", None))
            if d in table:
                # Суммируем воду за день (может быть несколько записей)
                cur = table[d].water_ml
                val = _as_float(getattr(r, "amount_ml", None), 0.0)
                table[d].water_ml = val if not np.isfinite(cur) else cur + val

    # ── Питание + поздний приём ───────────────────────────────
    if getattr(data, "nutrition", None):
        for r in data.nutrition:
            d = _parse_date(getattr(r, "date", None))
            if d not in table:
                continue

            cal   = _as_float(getattr(r, "calories",      None), 0.0)
            prot  = _as_float(getattr(r, "protein_grams", None), 0.0)
            carbs = _as_float(getattr(r, "carbs_grams",   None), 0.0)
            fat   = _as_float(getattr(r, "fat_grams",     None), 0.0)

            # Суммируем за день
            table[d].calories  = (0.0 if not np.isfinite(table[d].calories)  else table[d].calories)  + cal
            table[d].protein_g = (0.0 if not np.isfinite(table[d].protein_g) else table[d].protein_g) + prot
            table[d].carbs_g   = (0.0 if not np.isfinite(table[d].carbs_g)   else table[d].carbs_g)   + carbs
            table[d].fat_g     = (0.0 if not np.isfinite(table[d].fat_g)     else table[d].fat_g)     + fat

            # Поздний приём — проверяем время
            meal_hour = _parse_time_to_hour(
                getattr(r, "time", None) or getattr(r, "meal_time", None)
            )
            if meal_hour is not None and (meal_hour >= LATE_MEAL_HOUR or meal_hour < 3):
                # после 21:00 или до 3:00 ночи = поздний приём
                table[d].late_meal_calories += cal
                table[d].late_meal_fat_g    += fat

    # ── Настроение ────────────────────────────────────────────
    if getattr(data, "mood", None):
        for r in data.mood:
            d = _parse_date(getattr(r, "date", None))
            if d in table:
                table[d].mood = _as_float(getattr(r, "mood_score", None), np.nan)

    # ── Активность + вечерняя тренировка ─────────────────────
    if getattr(data, "activity", None):
        tmp: Dict[date, Dict[str, Any]] = {}
        for r in data.activity:
            d = _parse_date(getattr(r, "date", None))
            if d not in table:
                continue

            minutes = _as_float(getattr(r, "duration_minutes", None), 0.0)
            cals    = _as_float(getattr(r, "calories_burned",  None), 0.0)
            intens  = getattr(r, "intensity", None)
            act_hour = _parse_time_to_hour(getattr(r, "time", None))

            if d not in tmp:
                tmp[d] = {
                    "minutes": 0.0, "cals": 0.0,
                    "int_sum": 0.0, "int_cnt": 0.0,
                    "evening_minutes": 0.0,
                    "evening_int_sum": 0.0, "evening_int_cnt": 0.0,
                }

            tmp[d]["minutes"]  += minutes
            tmp[d]["cals"]     += cals
            tmp[d]["int_sum"]  += _intensity_to_num(intens)
            tmp[d]["int_cnt"]  += 1.0

            # Вечерняя тренировка (после 20:00)
            if act_hour is not None and (act_hour >= EVENING_EXERCISE_HOUR or act_hour < 2):
                tmp[d]["evening_minutes"]   += minutes
                tmp[d]["evening_int_sum"]   += _intensity_to_num(intens)
                tmp[d]["evening_int_cnt"]   += 1.0
                # Запоминаем час последней вечерней тренировки
                cur_start = tmp[d].get("evening_start_hour", np.nan)
                if not np.isfinite(cur_start) or act_hour > cur_start:
                    tmp[d]["evening_start_hour"] = act_hour

        for d, v in tmp.items():
            table[d].activity_minutes        = float(v["minutes"]) if v["minutes"] > 0 else np.nan
            table[d].activity_calories       = float(v["cals"])    if v["minutes"] > 0 else np.nan
            table[d].activity_intensity_avg  = float(v["int_sum"] / max(v["int_cnt"], 1.0))
            table[d].evening_exercise_minutes = float(v["evening_minutes"])
            if v["evening_int_cnt"] > 0:
                table[d].evening_exercise_intensity = float(
                    v["evening_int_sum"] / v["evening_int_cnt"]
                )
            if np.isfinite(v.get("evening_start_hour", np.nan)):
                table[d].evening_exercise_start_hour = float(v["evening_start_hour"])

    return table


def _lag(values: List[float], k: int) -> float:
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

def build_features(data: HealthData, user_profile: Optional[Any] = None) -> Dict[str, float]:
    """
    Вектор фичей. Добавлены по сравнению с v1:
    - Временны́е фичи: bed_hour, wake_hour, sleep_regularity_std
    - Поздний приём пищи: late_meal_flag, late_meal_calories, late_meal_fat_ratio
    - Вечерняя тренировка: evening_exercise_flag, evening_exercise_intensity
    - День недели: day_of_week, is_weekend
    - Качество питания: fat_ratio, protein_ratio
    - Регулярность сна: bed_hour_std (нерегулярность режима)
    """
    all_dates = _collect_all_dates(data)
    if not all_dates:
        return _empty_feature_vector()

    ref         = max(all_dates)
    window_main = _date_range(ref, LOOKBACK_DAYS_MAIN)
    window_norm = _date_range(ref, min(NORM_DAYS, max(LOOKBACK_DAYS_MAIN, 7) + 23))
    window_debt = _date_range(ref, LOOKBACK_DAYS_DEBT)

    daily_main = _build_daily_table(data, window_main)
    daily_norm = _build_daily_table(data, window_norm)
    daily_debt = _build_daily_table(data, window_debt)

    # ── Временны́е ряды ───────────────────────────────────────
    sleep_dur = [daily_main[d].sleep_duration_h    for d in window_main]
    sleep_q   = [daily_main[d].sleep_quality       for d in window_main]
    sleep_int = [daily_main[d].sleep_interruptions for d in window_main]
    bed_hours = [daily_main[d].bed_hour            for d in window_main]
    wake_hours= [daily_main[d].wake_hour           for d in window_main]

    stress    = [daily_main[d].stress_level         for d in window_main]

    act_min   = [daily_main[d].activity_minutes       for d in window_main]
    act_cal   = [daily_main[d].activity_calories      for d in window_main]
    act_int   = [daily_main[d].activity_intensity_avg for d in window_main]
    eve_min   = [daily_main[d].evening_exercise_minutes    for d in window_main]
    eve_int   = [daily_main[d].evening_exercise_intensity  for d in window_main]
    eve_start = [daily_main[d].evening_exercise_start_hour for d in window_main]

    water     = [daily_main[d].water_ml for d in window_main]

    calories       = [daily_main[d].calories          for d in window_main]
    protein        = [daily_main[d].protein_g         for d in window_main]
    carbs          = [daily_main[d].carbs_g           for d in window_main]
    fat            = [daily_main[d].fat_g             for d in window_main]
    late_meal_cals = [daily_main[d].late_meal_calories for d in window_main]
    late_meal_fat  = [daily_main[d].late_meal_fat_g   for d in window_main]

    mood      = [daily_main[d].mood for d in window_main]
    dow       = [daily_main[d].day_of_week for d in window_main]

    # Нормы
    sleep_dur_norm = [daily_norm[d].sleep_duration_h  for d in window_norm]
    sleep_q_norm   = [daily_norm[d].sleep_quality     for d in window_norm]
    stress_norm    = [daily_norm[d].stress_level       for d in window_norm]
    mood_norm      = [daily_norm[d].mood               for d in window_norm]
    act_min_norm   = [daily_norm[d].activity_minutes   for d in window_norm]
    water_norm     = [daily_norm[d].water_ml           for d in window_norm]
    calories_norm  = [daily_norm[d].calories           for d in window_norm]
    protein_norm   = [daily_norm[d].protein_g          for d in window_norm]
    bed_hour_norm  = [daily_norm[d].bed_hour           for d in window_norm]

    f: Dict[str, float] = {}

    # ── Missingness ───────────────────────────────────────────
    f["missing_sleep_ratio"]     = _clip01(1.0 - _present_ratio(sleep_dur))
    f["missing_stress_ratio"]    = _clip01(1.0 - _present_ratio(stress))
    f["missing_activity_ratio"]  = _clip01(1.0 - _present_ratio(act_min))
    f["missing_water_ratio"]     = _clip01(1.0 - _present_ratio(water))
    f["missing_nutrition_ratio"] = _clip01(1.0 - _present_ratio(calories))
    f["missing_mood_ratio"]      = _clip01(1.0 - _present_ratio(mood))

    # ── Сон — количество ─────────────────────────────────────
    f["sleep_duration_mean"]      = _nanmean(sleep_dur)
    f["sleep_duration_std"]       = _nanstd(sleep_dur)
    f["sleep_quality_mean"]       = _nanmean(sleep_q)
    f["sleep_quality_std"]        = _nanstd(sleep_q)
    f["sleep_interruptions_mean"] = _nanmean(sleep_int)

    f["sleep_duration_t"]  = _lag(sleep_dur, 0)
    f["sleep_duration_t1"] = _lag(sleep_dur, 1)
    f["sleep_duration_t2"] = _lag(sleep_dur, 2)
    f["sleep_quality_t"]   = _lag(sleep_q, 0)
    f["sleep_quality_t1"]  = _lag(sleep_q, 1)
    f["sleep_quality_t2"]  = _lag(sleep_q, 2)

    # Сонный долг
    sleep_dur_debt = [daily_debt[d].sleep_duration_h for d in window_debt]
    sleep_q_debt   = [daily_debt[d].sleep_quality    for d in window_debt]

    f["sleep_debt_hours_7d"]   = _sleep_debt_hours(sleep_dur_debt, target=SLEEP_TARGET_HOURS)
    f["sleep_deficit_days_7d"] = float(sum(
        1 for v in sleep_dur_debt if np.isfinite(v) and v < SLEEP_OPTIMAL_MIN
    ))
    f["sleep_optimal_days_7d"] = float(sum(
        1 for v, q in zip(sleep_dur_debt, sleep_q_debt)
        if np.isfinite(v) and np.isfinite(q)
        and SLEEP_OPTIMAL_MIN <= v <= SLEEP_OPTIMAL_MAX
        and q >= SLEEP_QUALITY_GOOD
    ))

    # ── Сон — ВРЕМЯ (новые фичи) ──────────────────────────────
    valid_bed  = [v for v in bed_hours  if np.isfinite(v)]
    valid_wake = [v for v in wake_hours if np.isfinite(v)]

    f["bed_hour_mean"] = _nanmean(bed_hours)   # средний час отхода ко сну
    f["bed_hour_t"]    = _lag(bed_hours, 0)    # вчера
    f["bed_hour_t1"]   = _lag(bed_hours, 1)    # позавчера

    # Нерегулярность режима сна — ключевая фича для циркадных ритмов
    # Высокое std床_hour → непостоянный режим → плохое самочувствие
    f["bed_hour_std"]  = float(np.std(valid_bed))  if len(valid_bed)  >= 3 else 0.0
    f["wake_hour_std"] = float(np.std(valid_wake)) if len(valid_wake) >= 3 else 0.0

    # Поздний отход ко сну вчера (после 23:30)
    bed_t = f["bed_hour_t"]
    f["late_bedtime_flag"] = 1.0 if (
        np.isfinite(bed_t) and bed_t > 0 and
        (bed_t >= OPTIMAL_BEDTIME_HOUR + 0.5 or bed_t < 3.0)
    ) else 0.0

    # Отклонение времени сна от личной нормы
    bed_norm_val = _median_norm([v for v in bed_hour_norm if np.isfinite(v)])
    f["bed_hour_vs_norm"] = (bed_t - bed_norm_val) if (
        np.isfinite(bed_t) and bed_t > 0 and bed_norm_val > 0
    ) else 0.0

    # ── Стресс ───────────────────────────────────────────────
    f["stress_mean"] = _nanmean(stress)
    f["stress_std"]  = _nanstd(stress)
    f["stress_t"]    = _lag(stress, 0)
    f["stress_t1"]   = _lag(stress, 1)
    f["stress_t2"]   = _lag(stress, 2)
    f["stress_high_days_14d"]     = float(sum(1 for v in stress if np.isfinite(v) and v >= STRESS_HIGH))
    f["stress_critical_days_14d"] = float(sum(1 for v in stress if np.isfinite(v) and v >= STRESS_CRITICAL))

    # ── Активность — количество ───────────────────────────────
    f["activity_minutes_mean"]   = _nanmean(act_min)
    f["activity_minutes_std"]    = _nanstd(act_min)
    f["activity_minutes_t"]      = _lag(act_min, 0)
    f["activity_minutes_t1"]     = _lag(act_min, 1)
    f["activity_minutes_t2"]     = _lag(act_min, 2)
    f["activity_intensity_mean"] = _nanmean(act_int)
    f["activity_calories_mean"]  = _nanmean(act_cal)
    f["activity_days_14d"]       = float(sum(1 for v in act_min if np.isfinite(v) and v > 0))
    f["activity_overload_flag"]  = 1.0 if (
        f["activity_minutes_mean"] >= 75.0 and f["activity_intensity_mean"] >= 2.3
    ) else 0.0

    # ── Активность — ВРЕМЯ (новые фичи) ──────────────────────
    eve_min_t   = _lag(eve_min,   0)   # вечерняя тренировка вчера
    eve_min_t1  = _lag(eve_min,   1)   # позавчера
    eve_int_t   = _lag(eve_int,   0)
    eve_start_t = _lag(eve_start, 0)   # час начала последней вечерней тренировки вчера

    f["evening_exercise_minutes_t"]  = eve_min_t
    f["evening_exercise_minutes_t1"] = eve_min_t1

    # Флаг: вечерняя интенсивная тренировка вчера
    # vigorous вечером (intensity >= 2.5) → нарушение сна
    f["evening_vigorous_flag"] = 1.0 if (
        eve_min_t > 20 and np.isfinite(eve_int_t) and eve_int_t >= 2.5
    ) else 0.0

    # _t1 версия флага — для cross_lag_evening_vigorous_x_today_sleep.
    eve_int_t1 = _lag(eve_int, 1)
    f["evening_vigorous_flag_t1"] = 1.0 if (
        eve_min_t1 > 20 and np.isfinite(eve_int_t1) and eve_int_t1 >= 2.5
    ) else 0.0

    # Средняя вечерняя нагрузка за 14 дней
    f["evening_exercise_mean_14d"] = _nanmean([v for v in eve_min if v > 0] or [0.0])

    # Часов от окончания тренировки до отхода ко сну
    # Тренировка за < 2ч до сна → кортизол не успевает снизиться
    if (np.isfinite(eve_start_t) and eve_start_t > 0
            and np.isfinite(bed_t) and bed_t > 0
            and eve_min_t > 0):
        # Примерное время окончания = start_hour + duration/60
        eve_end_t = eve_start_t + eve_min_t / 60.0
        if bed_t >= eve_end_t:
            f["exercise_hours_before_bed"] = bed_t - eve_end_t
        else:
            # тренировка после полуночи или уснул до окончания — редкий случай
            f["exercise_hours_before_bed"] = max(0.0, (24.0 - eve_end_t) + bed_t)
    else:
        f["exercise_hours_before_bed"] = 0.0

    # Флаг: тренировка слишком близко ко сну (< 2 часов) и интенсивная
    f["vigorous_too_close_to_bed"] = 1.0 if (
        f["exercise_hours_before_bed"] > 0
        and f["exercise_hours_before_bed"] < 2.0
        and np.isfinite(eve_int_t) and eve_int_t >= 2.0
    ) else 0.0

    # ── Вода ─────────────────────────────────────────────────
    f["water_ml_mean"]           = _nanmean(water)
    f["water_ml_std"]            = _nanstd(water)
    f["water_ml_t"]              = _lag(water, 0)
    f["water_ml_t1"]             = _lag(water, 1)
    f["water_ml_t2"]             = _lag(water, 2)
    f["water_low_days_14d"]      = float(sum(1 for v in water if np.isfinite(v) and v < WATER_LOW_ML))
    f["water_critical_days_14d"] = float(sum(1 for v in water if np.isfinite(v) and v < WATER_CRITICAL_ML))

    net_hyd = _net_hydration_series(water, act_min, act_int)
    f["net_hydration_ml_mean"]      = _nanmean(net_hyd)
    f["net_hydration_ml_t"]         = _lag(net_hyd, 0)
    f["net_hydration_low_days_14d"] = float(sum(
        1 for v in net_hyd if np.isfinite(v) and v < (WATER_LOW_ML - 300)
    ))

    # ── Питание — макронутриенты ──────────────────────────────
    f["calories_mean"] = _nanmean(calories)
    f["protein_mean"]  = _nanmean(protein)
    f["carbs_mean"]    = _nanmean(carbs)
    f["fat_mean"]      = _nanmean(fat)

    f["calories_t"]  = _lag(calories, 0)
    f["calories_t1"] = _lag(calories, 1)
    f["protein_t"]   = _lag(protein,  0)
    f["protein_t1"]  = _lag(protein,  1)

    f["calorie_deficit_days_14d"] = float(sum(1 for v in calories if np.isfinite(v) and v < CALORIES_MIN))
    f["low_protein_days_14d"]     = float(sum(1 for v in protein  if np.isfinite(v) and v < PROTEIN_MIN))
    f["protein_ratio_proxy"]      = _safe_div(f["protein_mean"], max(f["calories_mean"], 1.0))

    # Качество питания — соотношения (новые фичи)
    cal_t  = f["calories_t"]
    fat_t  = _lag(fat, 0)
    prot_t = f["protein_t"]
    carb_t = _lag(carbs, 0)

    # Доля жиров вчера — высокая = >40% калорий из жира
    f["fat_ratio_t"] = _safe_div(fat_t * 9, max(cal_t, 1.0)) if cal_t > 0 else 0.0
    # Доля белка вчера
    f["protein_ratio_t"] = _safe_div(prot_t * 4, max(cal_t, 1.0)) if cal_t > 0 else 0.0
    # Флаг жирной еды вчера
    f["high_fat_meal_flag"] = 1.0 if f["fat_ratio_t"] > FAT_HIGH_RATIO else 0.0

    # ── Питание — ВРЕМЯ (новые фичи) ─────────────────────────
    late_cal_t  = _lag(late_meal_cals, 0)
    late_fat_t  = _lag(late_meal_fat,  0)
    # _t1 версии нужны для cross-lag фичей «вчера поздний ужин →
    # сегодня плохой сон» (см. блок cross_lag_* ниже).
    late_cal_t1 = _lag(late_meal_cals, 1)
    late_fat_t1 = _lag(late_meal_fat,  1)

    f["late_meal_calories_t"]  = late_cal_t
    f["late_meal_calories_t1"] = late_cal_t1
    f["late_meal_flag"]        = 1.0 if late_cal_t  > 200 else 0.0  # значимый поздний приём
    f["late_meal_flag_t1"]     = 1.0 if late_cal_t1 > 200 else 0.0

    # Соотношение жиров в позднем приёме — жирное на ночь = плохой сон
    f["late_meal_fat_ratio"]    = _safe_div(late_fat_t * 9, max(late_cal_t, 1.0)) \
                                  if late_cal_t > 100 else 0.0
    f["late_meal_fat_ratio_t1"] = _safe_div(late_fat_t1 * 9, max(late_cal_t1, 1.0)) \
                                  if late_cal_t1 > 100 else 0.0

    # Среднее количество поздних приёмов за 14 дней
    f["late_meal_days_14d"] = float(sum(1 for v in late_meal_cals if v > 200))

    # ── История настроения ────────────────────────────────────
    f["mood_mean"] = _nanmean(mood)
    f["mood_std"]  = _nanstd(mood)
    f["mood_t"]    = _lag(mood, 0)
    f["mood_t1"]   = _lag(mood, 1)
    f["mood_t2"]   = _lag(mood, 2)

    mood_last_7   = [daily_main[d].mood for d in window_main[-7:]]
    finite_mood_7 = [v for v in mood_last_7 if np.isfinite(v)]
    f["mood_min_7d"] = float(np.nanmin(finite_mood_7)) if finite_mood_7 else 0.0

    # ── День недели (новые фичи) ──────────────────────────────
    dow_t = _lag(dow, 0)
    f["day_of_week_t"] = dow_t if np.isfinite(dow_t) else 0.0
    f["is_weekend_t"]  = 1.0 if (np.isfinite(dow_t) and dow_t >= 5) else 0.0

    # Синус/косинус дня недели — цикличное кодирование (важно для ML)
    # Позволяет модели понять что воскресенье (6) близко к понедельнику (0)
    if np.isfinite(dow_t):
        f["dow_sin"] = float(np.sin(2 * np.pi * dow_t / 7))
        f["dow_cos"] = float(np.cos(2 * np.pi * dow_t / 7))
    else:
        f["dow_sin"] = 0.0
        f["dow_cos"] = 0.0

    # ── Тренды ───────────────────────────────────────────────
    f["sleep_duration_trend"]   = _trend_last3_vs_prev3(sleep_dur)
    f["sleep_quality_trend"]    = _trend_last3_vs_prev3(sleep_q)
    f["stress_trend"]           = _trend_last3_vs_prev3(stress)
    f["activity_minutes_trend"] = _trend_last3_vs_prev3(act_min)
    f["water_trend"]            = _trend_last3_vs_prev3(water)
    f["net_hydration_trend"]    = _trend_last3_vs_prev3(net_hyd)
    f["calories_trend"]         = _trend_last3_vs_prev3(calories)
    f["protein_trend"]          = _trend_last3_vs_prev3(protein)
    f["mood_trend"]             = _trend_last3_vs_prev3(mood)
    f["bed_hour_trend"]         = _trend_last3_vs_prev3(bed_hours)  # новый

    # ── Личные нормы ──────────────────────────────────────────
    sleep_norm_val = _median_norm(sleep_dur_norm) or SLEEP_TARGET_HOURS
    stress_n_val   = _median_norm(stress_norm)    or 5.0
    act_norm_val   = _median_norm(act_min_norm)   or 30.0
    water_n_val    = _median_norm(water_norm)     or WATER_OPTIMAL_ML
    cal_n_val      = _median_norm(calories_norm)  or CALORIES_OPTIMAL
    prot_n_val     = _median_norm(protein_norm)   or PROTEIN_GOOD

    f["sleep_vs_norm"]    = f["sleep_duration_mean"] - sleep_norm_val
    f["stress_vs_norm"]   = f["stress_mean"]          - stress_n_val
    f["activity_vs_norm"] = f["activity_minutes_mean"]- act_norm_val
    f["water_vs_norm"]    = f["water_ml_mean"]        - water_n_val
    f["calories_vs_norm"] = f["calories_mean"]        - cal_n_val
    f["protein_vs_norm"]  = f["protein_mean"]         - prot_n_val

    # ── Персональные цели (из user_profile) ──────────────────
    # Фичи vs ЗАЯВЛЕННАЯ ЦЕЛЬ пользователя, а не медиана истории.
    # Это отличает "человек спит меньше своего обычного" от
    # "человек спит меньше своей целевой нормы".
    if user_profile is not None:
        # Сон vs личная цель (sleepGoalHours)
        sleep_goal = _as_float(getattr(user_profile, "sleepGoalHours", None),
                                default=SLEEP_TARGET_HOURS)
        if sleep_goal > 0:
            f["sleep_vs_personal_goal"] = f["sleep_duration_mean"] - sleep_goal
        else:
            f["sleep_vs_personal_goal"] = 0.0

        # Стресс vs личный базовый уровень (baselineStress)
        stress_baseline = _as_float(getattr(user_profile, "baselineStress", None), default=5.0)
        if stress_baseline > 0:
            f["stress_vs_personal_baseline"] = f["stress_mean"] - stress_baseline
        else:
            f["stress_vs_personal_baseline"] = 0.0

        # Хронотип: сова = 1, жаворонок = -1, гибкий = 0
        chronotype = str(getattr(user_profile, "chronotype", "") or "").lower()
        f["chronotype_flag"] = (
            1.0  if "night_owl" in chronotype else
            -1.0 if "early_bird" in chronotype else
            0.0
        )

        # Неделя: целевые минуты тренировок пользователя / 7 → дневная цель
        weekly_min = _as_float(getattr(user_profile, "weeklyTrainingMinutes", None), default=0.0)
        daily_goal = weekly_min / 7.0
        f["activity_vs_personal_goal"] = (
            f["activity_minutes_mean"] - daily_goal if daily_goal > 0 else 0.0
        )
    else:
        f["sleep_vs_personal_goal"]     = 0.0
        f["stress_vs_personal_baseline"] = 0.0
        f["chronotype_flag"]             = 0.0
        f["activity_vs_personal_goal"]  = 0.0

    # ── Комбо-взаимодействия — расширенные ───────────────────
    sleep_ok   = 1.0 if (f["sleep_duration_t"] >= SLEEP_OPTIMAL_MIN
                         and f["sleep_quality_t"] >= SLEEP_QUALITY_GOOD) else 0.0
    stress_low = 1.0 if (f["stress_t"] > 0 and f["stress_t"] <= STRESS_LOW) else 0.0
    water_low  = 1.0 if (f["water_ml_t"] > 0 and f["water_ml_t"] < WATER_LOW_ML) else 0.0
    water_crit = 1.0 if (f["water_ml_t"] > 0 and f["water_ml_t"] < WATER_CRITICAL_ML) else 0.0
    under_cal  = 1.0 if (f["calories_t"] > 0 and f["calories_t"] < CALORIES_MIN) else 0.0
    under_prot = 1.0 if (f["protein_t"]  > 0 and f["protein_t"]  < PROTEIN_MIN)  else 0.0
    underfueled = 1.0 if (under_cal == 1.0 or under_prot == 1.0) else 0.0

    f["combo_sleep_x_low_stress"]         = (f["sleep_quality_t"] / 10.0) * (1.0 - min(f["stress_t"], 10.0) / 10.0)
    f["combo_good_sleep_but_dehydrated"]  = 1.0 if (sleep_ok == 1.0 and water_low == 1.0) else 0.0
    f["combo_well_rested_but_underfueled"]= (f["sleep_quality_t"] / 10.0) * (1.0 - min(f["stress_t"], 10.0) / 10.0) * underfueled
    f["combo_stress_x_dehydration"]       = (min(f["stress_t"], 10.0) / 10.0) * water_low
    f["combo_activity_x_sleep"]           = (min(f["activity_minutes_t"], 120.0) / 120.0) * (f["sleep_quality_t"] / 10.0)
    f["combo_activity_when_sleep_debt"]   = (min(f["activity_minutes_t"], 120.0) / 120.0) * _clip01(f["sleep_debt_hours_7d"] / 10.0)
    f["combo_triple_negative"]            = 1.0 if (water_crit == 1.0 and under_cal == 1.0 and under_prot == 1.0) else 0.0
    f["combo_perfect_day"]                = 1.0 if (sleep_ok == 1.0 and stress_low == 1.0 and water_low == 0.0 and f["activity_minutes_t"] >= 30.0) else 0.0

    # НОВЫЕ комбо — циркадные взаимодействия
    # Поздний жирный ужин вчера → плохой сон сегодня
    f["combo_late_fatty_meal"] = (
        f["late_meal_flag"] * f["late_meal_fat_ratio"]
    )
    # Интенсивная вечерняя тренировка + и так мало спит
    f["combo_evening_vigorous_x_sleep_debt"] = (
        f["evening_vigorous_flag"] * _clip01(f["sleep_debt_hours_7d"] / 10.0)
    )
    # Нерегулярный режим сна + стресс
    f["combo_irregular_sleep_x_stress"] = (
        _clip01(f["bed_hour_std"] / 3.0) * (min(f["stress_t"], 10.0) / 10.0)
    )

    # ── Cross-lag фичи (Level В из плана causal chains) ───────────────────
    #
    # Зеркалят правила CausalChainService на стороне ML: вчерашний триггер
    # умножается на сегодняшний исход. Модель учится для каждого юзера
    # индивидуально, насколько силён конкретный лаг — у одного
    # cross_lag_late_fatty_meal_x_today_sleep становится топ-SHAP-фактором,
    # у другого нет. Это персонализация цепочек через обучение, а не через
    # ручные правила.

    sleep_q_t_inv = (1.0 - min(f["sleep_quality_t"], 10.0) / 10.0) if f["sleep_quality_t"] > 0 else 0.0
    mood_t_inv    = (1.0 - min(f["mood_t"],    10.0) / 10.0) if f["mood_t"]    > 0 else 0.0
    stress_t_norm = min(f["stress_t"], 10.0) / 10.0 if f["stress_t"] > 0 else 0.0
    sleep_dur_t1_short = max(0.0, 1.0 - f["sleep_duration_t1"] / 8.0) if f["sleep_duration_t1"] > 0 else 0.0
    under_cal_t1  = 1.0 if (f["calories_t1"] > 0 and f["calories_t1"] < CALORIES_MIN) else 0.0

    # A1 на стороне ML: late meal вчера × плохой сон сегодня
    f["cross_lag_late_meal_x_today_sleep"] = f["late_meal_flag_t1"] * sleep_q_t_inv
    # A1+ с учётом доли жира — резче, если ужин жирный
    f["cross_lag_late_fatty_meal_x_today_sleep"] = (
        f["late_meal_flag_t1"] * f["late_meal_fat_ratio_t1"] * sleep_q_t_inv
    )
    # B1: вечерняя интенсивная вчера × плохой сон сегодня
    f["cross_lag_evening_vigorous_x_today_sleep"] = (
        f["evening_vigorous_flag_t1"] * sleep_q_t_inv
    )
    # C1: короткий сон вчера × высокий стресс сегодня
    f["cross_lag_sleep_debt_x_today_stress"] = sleep_dur_t1_short * stress_t_norm
    # E2/A3: недоедание вчера × плохое настроение сегодня
    f["cross_lag_undereat_x_today_mood"] = under_cal_t1 * mood_t_inv

    # ── Личные baseline'ы 30d + z-scores субъективных метрик ─────────────────
    # Зачем: абсолютный порог «stress >= 7» одинаков для всех, но у одного
    # человека «5/10 стресса» — норма, у другого — кризис. z-score по
    # личной истории отвечает на вопрос «сегодня хуже обычного?».
    #
    # При этом z-score один НЕ закрывает всё: у человека с хронически высоким
    # стрессом (baseline 9) z=0 будет всегда. Поэтому ниже ещё считаются
    # абсолютные chronic-флаги и chronic_baseline_concern — рекомендация по
    # ним идёт по другому правилу (см. recommendations.py / dual-axis alerts).
    mood_norm_finite     = [v for v in mood_norm     if np.isfinite(v)]
    stress_norm_finite   = [v for v in stress_norm   if np.isfinite(v)]
    sleep_q_norm_finite  = [v for v in sleep_q_norm  if np.isfinite(v)]

    f["mood_baseline_30d_mean"]        = _nanmean(mood_norm_finite)
    f["mood_baseline_30d_std"]         = _nanstd(mood_norm_finite)
    f["mood_baseline_30d_median"]      = _nanmedian(mood_norm_finite)
    f["mood_baseline_30d_mad"]         = _nanmad(mood_norm_finite)
    f["stress_baseline_30d_mean"]      = _nanmean(stress_norm_finite)
    f["stress_baseline_30d_std"]       = _nanstd(stress_norm_finite)
    f["stress_baseline_30d_median"]    = _nanmedian(stress_norm_finite)
    f["stress_baseline_30d_mad"]       = _nanmad(stress_norm_finite)
    f["sleep_q_baseline_30d_mean"]     = _nanmean(sleep_q_norm_finite)
    f["sleep_q_baseline_30d_std"]      = _nanstd(sleep_q_norm_finite)
    f["sleep_q_baseline_30d_median"]   = _nanmedian(sleep_q_norm_finite)
    f["sleep_q_baseline_30d_mad"]      = _nanmad(sleep_q_norm_finite)

    f["mood_baseline_30d_samples"]     = float(len(mood_norm_finite))
    f["stress_baseline_30d_samples"]   = float(len(stress_norm_finite))
    f["sleep_q_baseline_30d_samples"]  = float(len(sleep_q_norm_finite))

    # ── Классические z-scores (mean + std) ──
    f["mood_z_t"]      = _z_score(f["mood_t"],          f["mood_baseline_30d_mean"],    f["mood_baseline_30d_std"],   min_samples=int(f["mood_baseline_30d_samples"]))
    f["stress_z_t"]    = _z_score(f["stress_t"],        f["stress_baseline_30d_mean"],  f["stress_baseline_30d_std"], min_samples=int(f["stress_baseline_30d_samples"]))
    f["sleep_q_z_t"]   = _z_score(f["sleep_quality_t"], f["sleep_q_baseline_30d_mean"], f["sleep_q_baseline_30d_std"],min_samples=int(f["sleep_q_baseline_30d_samples"]))

    # ── Робастные z-scores (median + MAD) ──
    # На коротких пользовательских историях один экстремальный день
    # может составлять до 1/15 окна, что заметно сдвигает mean/std.
    # Робастная версия использует median и MAD — оба нечувствительны
    # к одиночным выбросам. Используется в downstream-правилах как
    # дополнительный сигнал; mean-версия сохранена для обратной
    # совместимости с уже обученными моделями.
    f["mood_z_robust_t"]    = _z_score_robust(f["mood_t"],          f["mood_baseline_30d_median"],    f["mood_baseline_30d_mad"],    min_samples=int(f["mood_baseline_30d_samples"]))
    f["stress_z_robust_t"]  = _z_score_robust(f["stress_t"],        f["stress_baseline_30d_median"],  f["stress_baseline_30d_mad"],  min_samples=int(f["stress_baseline_30d_samples"]))
    f["sleep_q_z_robust_t"] = _z_score_robust(f["sleep_quality_t"], f["sleep_q_baseline_30d_median"], f["sleep_q_baseline_30d_mad"], min_samples=int(f["sleep_q_baseline_30d_samples"]))

    # ── Хронические флаги: «давно держится в опасной зоне» ───────────────────
    # Срабатывают независимо от z-score. Закрывают кейс «человек привык к
    # плохому» — у него baseline уже сдвинут, но это не значит, что всё ок.
    f["chronic_high_stress_3d"]  = _chronic_streak_high(stress, threshold=8.0, min_days=3)
    f["chronic_low_mood_3d"]     = _chronic_streak_low (mood,   threshold=4.0, min_days=3)
    f["chronic_low_sleep_q_4d"]  = _chronic_streak_low (sleep_q, threshold=4.0, min_days=4)
    f["chronic_short_sleep_2d"]  = _chronic_streak_low (sleep_dur, threshold=5.0, min_days=2)

    # ── Chronic baseline concern: личная норма САМА в опасной зоне ───────────
    # Если средний mood за месяц = 4 — это не «у тебя плохой день», это
    # хронический паттерн. Подсказка LLM-промпту: рекомендация должна быть
    # «обсуди со специалистом», а не «попробуй дыхательное упражнение».
    enough_baseline = f["mood_baseline_30d_samples"] >= 7
    f["chronic_baseline_mood_low"] = (
        1.0 if (enough_baseline and 0 < f["mood_baseline_30d_mean"] <= 4.5) else 0.0
    )

    enough_stress_bl = f["stress_baseline_30d_samples"] >= 7
    f["chronic_baseline_stress_high"] = (
        1.0 if (enough_stress_bl and f["stress_baseline_30d_mean"] >= 7.5) else 0.0
    )

    enough_sleep_q_bl = f["sleep_q_baseline_30d_samples"] >= 7
    f["chronic_baseline_sleep_q_low"] = (
        1.0 if (enough_sleep_q_bl and 0 < f["sleep_q_baseline_30d_mean"] <= 4.5) else 0.0
    )

    # ── Финальная чистка ──────────────────────────────────────
    for k, v in list(f.items()):
        if v is None or not np.isfinite(float(v)):
            f[k] = 0.0
        else:
            f[k] = float(v)

    return f


def get_feature_names(data: HealthData) -> List[str]:
    return sorted(build_features(data).keys())


def features_to_array(
    features: Dict[str, float],
    feature_names: Optional[List[str]] = None,
) -> np.ndarray:
    if feature_names is None:
        feature_names = sorted(features.keys())
    return np.array([float(features.get(name, 0.0)) for name in feature_names], dtype=float)


# ─────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────

def _present_ratio(values: List[float]) -> float:
    if not values:
        return 0.0
    present = sum(1 for v in values if np.isfinite(float(v)))
    return float(present / len(values))


def _sleep_debt_hours(values: List[float], target: float) -> float:
    debt = 0.0
    for v in values:
        if np.isfinite(float(v)):
            debt += max(0.0, target - float(v))
    return float(debt)


def _net_hydration_series(
    water_ml: List[float],
    activity_min: List[float],
    activity_int: List[float],
) -> List[float]:
    out: List[float] = []
    n = max(len(water_ml), len(activity_min), len(activity_int))
    for i in range(n):
        w     = water_ml[i]     if i < len(water_ml)     else np.nan
        m     = activity_min[i] if i < len(activity_min) else np.nan
        inten = activity_int[i] if i < len(activity_int) else np.nan

        if not np.isfinite(float(w)):
            out.append(np.nan)
            continue

        minutes   = float(m)     if np.isfinite(float(m))     else 0.0
        inten_num = float(inten) if np.isfinite(float(inten)) else 2.0
        factor    = 0.8 + (min(max(inten_num, 1.0), 3.0) - 1.0) * 0.25
        loss      = minutes * BASE_SWEAT_ML_PER_MIN * factor
        out.append(float(w) - float(loss))

    return out


def _safe_div(a: float, b: float) -> float:
    try:
        return 0.0 if b == 0 else float(a) / float(b)
    except Exception:
        return 0.0


def _z_score(value: float, mean: float, std: float, min_samples: int) -> float:
    """
    z-score значения относительно личной нормы. Возвращает 0.0, если:
      - текущее значение пустое/NaN/0 (нет записи за день),
      - данных в baseline'е < 7 дней (cold start — нельзя считать норму).

    Std клампится снизу до 0.5, чтобы у пользователя со стабильной метрикой
    (std≈0) маленький дрейф не давал гигантских z. На шкале 1–10 порог 0.5
    эквивалентен «полпункта» — естественный шум самооценки.
    """
    if min_samples < 7:
        return 0.0
    if not np.isfinite(value) or value <= 0:
        return 0.0
    if not np.isfinite(mean) or mean <= 0:
        return 0.0
    safe_std = max(float(std), 0.5)
    z = (float(value) - float(mean)) / safe_std
    return float(z) if np.isfinite(z) else 0.0


def _z_score_robust(value: float, median: float, mad: float, min_samples: int) -> float:
    """
    Modified z-score (Iglewicz & Hoaglin) на основе медианы и MAD:
        z_robust = 0.6745 * (x - median) / MAD

    Константа 0.6745 = 1/Φ⁻¹(0.75): для нормального распределения
    приводит MAD к шкале std, поэтому пороги |z| > 2 интерпретируются
    одинаково для обоих вариантов. Робастная версия не «портится» от
    выбросов, что критично для коротких пользовательских историй, где
    один аномальный день может составлять 1/15–1/30 окна.

    MAD клампится снизу до 0.5 по той же причине, что и std в _z_score
    (полпункта на шкале 1–10 — естественный шум самооценки).
    """
    if min_samples < 7:
        return 0.0
    if not np.isfinite(value) or value <= 0:
        return 0.0
    if not np.isfinite(median) or median <= 0:
        return 0.0
    safe_mad = max(float(mad), 0.5)
    z = 0.6745 * (float(value) - float(median)) / safe_mad
    return float(z) if np.isfinite(z) else 0.0


def _chronic_streak_high(values: List[float], threshold: float, min_days: int) -> float:
    """
    1.0, если последние min_days подряд значение >= threshold (без NaN-разрывов
    среди этих min_days). Для «давно держится высоким» — стресс, и т.п.
    """
    return _chronic_streak(values, threshold, min_days, direction="high")


def _chronic_streak_low(values: List[float], threshold: float, min_days: int) -> float:
    """
    1.0, если последние min_days подряд значение <= threshold (без NaN-разрывов).
    Для «давно держится низким» — настроение, качество сна, длительность сна.
    """
    return _chronic_streak(values, threshold, min_days, direction="low")


def _chronic_streak(
    values: List[float],
    threshold: float,
    min_days: int,
    direction: str,
) -> float:
    if not values or len(values) < min_days:
        return 0.0
    tail = values[-min_days:]
    if any((not np.isfinite(v)) or v <= 0 for v in tail):
        return 0.0
    if direction == "high":
        return 1.0 if all(float(v) >= threshold for v in tail) else 0.0
    else:
        return 1.0 if all(float(v) <= threshold for v in tail) else 0.0


def _empty_feature_vector() -> Dict[str, float]:
    keys = [
        "missing_sleep_ratio", "missing_stress_ratio", "missing_activity_ratio",
        "missing_water_ratio", "missing_nutrition_ratio", "missing_mood_ratio",
        "sleep_duration_mean", "sleep_quality_mean", "stress_mean",
        "activity_minutes_mean", "water_ml_mean", "calories_mean",
        "protein_mean", "mood_mean", "mood_min_7d",
        "bed_hour_mean", "bed_hour_std", "late_meal_flag",
        "evening_vigorous_flag", "day_of_week_t", "is_weekend_t",
        "dow_sin", "dow_cos",
    ]
    return {k: 0.0 for k in keys}