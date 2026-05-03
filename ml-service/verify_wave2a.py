"""
Самопроверка Wave 2A: личные baseline-30d, z-score, chronic-флаги
для субъективных метрик (mood / sleep_quality / stress).

Запуск (из d:\\low_cortisol_spike-1\\ml-service):
    python verify_wave2a.py

Проверяем три ключевых сценария:
  1. Стабильно-нормальный пользователь (stress~5, mood~7) на 35 днях.
     Ожидаем: z-score'ы около нуля, никаких chronic-флагов.

  2. Резкий скачок: те же 35 дней, но stress последние 3 дня = 9.
     Ожидаем: stress_z_t >= +1.5 (личная норма пробита), chronic_high_stress_3d=1.
     chronic_baseline_stress_high остаётся 0 (норма пользователя ещё ~5).

  3. Хронически высокий стресс: 35 дней stress=9.
     Ожидаем: stress_z_t ~ 0 (z-ось МОЛЧИТ), chronic_high_stress_3d=1,
     chronic_baseline_stress_high=1 (личная норма САМА в опасной зоне).
     Это и есть кейс «человек привык к плохому» — z-score один не сработает,
     второй ось его ловит.

  4. Cold start: 5 дней. Ожидаем: все z=0, baseline samples малы,
     chronic_baseline_*=0 (порог samples >= 7).
"""

from __future__ import annotations

import sys
from datetime import date, timedelta


def _make_records(days: int, gen):
    """gen(i, ds) -> dict с метриками за день i (date string ds)."""
    from app.schemas.input import (
        HealthData, SleepRecord, MoodRecord, StressRecord,
        ActivityRecord, WaterRecord, NutritionRecord,
    )
    today = date.today()
    sleep, mood, stress, activity, water, nutrition = [], [], [], [], [], []
    for i in range(days):
        d = today - timedelta(days=days - 1 - i)
        ds = d.isoformat()
        v = gen(i, ds)
        sleep.append(SleepRecord(
            date=ds, duration_hours=v.get("sleep_h", 7.5),
            quality=v.get("sleep_q", 7.0),
        ))
        mood.append(MoodRecord(date=ds, mood_score=v.get("mood", 7.0)))
        stress.append(StressRecord(date=ds, level=v.get("stress", 5.0)))
        activity.append(ActivityRecord(date=ds, duration_minutes=30.0))
        water.append(WaterRecord(date=ds, amount_ml=2000.0))
        nutrition.append(NutritionRecord(date=ds, calories=2000.0, protein_grams=80.0))
    return HealthData(
        user_id="verify_w2a", sleep=sleep, mood=mood, stress=stress,
        activity=activity, water=water, nutrition=nutrition,
    )


def _run_case(label, data, expected):
    from app.services.feature_engineering import build_features
    f = build_features(data)
    print(f"\n------ {label} ------")
    interesting = [
        "stress_t", "stress_baseline_30d_mean", "stress_baseline_30d_std",
        "stress_baseline_30d_samples", "stress_z_t",
        "mood_t", "mood_baseline_30d_mean", "mood_baseline_30d_std", "mood_z_t",
        "sleep_quality_t", "sleep_q_baseline_30d_mean", "sleep_q_baseline_30d_std",
        "sleep_q_z_t",
        "chronic_high_stress_3d", "chronic_low_mood_3d",
        "chronic_low_sleep_q_4d", "chronic_short_sleep_2d",
        "chronic_baseline_stress_high", "chronic_baseline_mood_low",
        "chronic_baseline_sleep_q_low",
    ]
    for k in interesting:
        v = f.get(k, "<missing>")
        if isinstance(v, float):
            print(f"  {k:34s} = {v:7.3f}")
        else:
            print(f"  {k:34s} = {v}")

    fails = []
    for k, predicate, hint in expected:
        actual = f.get(k)
        if not predicate(actual):
            fails.append(f"{k} = {actual} ({hint})")
    if fails:
        print("  FAIL:")
        for line in fails:
            print(f"    - {line}")
        return False
    print("  PASS")
    return True


def main() -> int:
    # ── Случай 1: стабильно-нормальный
    data1 = _make_records(35, lambda i, ds: {
        "stress": 5.0, "mood": 7.0, "sleep_q": 7.0, "sleep_h": 7.5,
    })
    ok1 = _run_case("Case 1: stable normal (stress=5, mood=7)", data1, [
        ("stress_z_t",                     lambda v: abs(v) < 0.5,   "z должен быть около 0"),
        ("mood_z_t",                       lambda v: abs(v) < 0.5,   "z должен быть около 0"),
        ("chronic_high_stress_3d",         lambda v: v == 0.0,       "не должен срабатывать"),
        ("chronic_baseline_stress_high",   lambda v: v == 0.0,       "норма не в опасной зоне"),
        ("stress_baseline_30d_samples",    lambda v: v >= 30,        "должно быть много baseline-точек"),
    ])

    # ── Случай 2: скачок (z должен пробить, абс не для baseline)
    def jump_gen(i, ds):
        if i >= 32:  # последние 3 дня
            return {"stress": 9.0, "mood": 7.0, "sleep_q": 7.0, "sleep_h": 7.5}
        return {"stress": 5.0, "mood": 7.0, "sleep_q": 7.0, "sleep_h": 7.5}
    data2 = _make_records(35, jump_gen)
    ok2 = _run_case("Case 2: stress spike last 3 days (5->9)", data2, [
        ("stress_z_t",                     lambda v: v >= 1.5,
         "z должен показать резкий скачок (>= +1.5)"),
        ("chronic_high_stress_3d",         lambda v: v == 1.0,
         "последние 3 дня stress=9 >= 8 — флаг должен быть"),
        ("chronic_baseline_stress_high",   lambda v: v == 0.0,
         "норма пользователя всё ещё ~5, не в опасной зоне"),
    ])

    # ── Случай 3: хронически высокий (z=0, абс работает)
    data3 = _make_records(35, lambda i, ds: {
        "stress": 9.0, "mood": 7.0, "sleep_q": 7.0, "sleep_h": 7.5,
    })
    ok3 = _run_case("Case 3: chronic stress=9 (35 days)", data3, [
        ("stress_z_t",                     lambda v: abs(v) < 0.5,
         "z должен молчать — это его норма"),
        ("chronic_high_stress_3d",         lambda v: v == 1.0,
         "последние 3 дня в опасной зоне"),
        ("chronic_baseline_stress_high",   lambda v: v == 1.0,
         "СРАБАТЫВАЕТ: личная норма в danger-зоне (>= 7.5) — это и есть кейс «привык к плохому»"),
    ])

    # ── Случай 4: cold start (5 дней)
    data4 = _make_records(5, lambda i, ds: {
        "stress": 5.0, "mood": 7.0, "sleep_q": 7.0, "sleep_h": 7.5,
    })
    ok4 = _run_case("Case 4: cold start (5 days only)", data4, [
        ("stress_z_t",                     lambda v: v == 0.0,
         "недостаточно baseline-точек -> z должен быть 0"),
        ("mood_z_t",                       lambda v: v == 0.0,
         "то же для mood"),
        ("chronic_baseline_stress_high",   lambda v: v == 0.0,
         "недостаточно baseline-точек"),
        ("chronic_baseline_mood_low",      lambda v: v == 0.0,
         "то же"),
    ])

    print("\n================ SUMMARY ================")
    if all([ok1, ok2, ok3, ok4]):
        print("ALL CASES PASS")
        return 0
    print("SOME CASES FAILED")
    return 1


if __name__ == "__main__":
    sys.exit(main())
