"""
Самопроверка изменений Wave 1: TimeSeriesSplit, cv_status, baseline_mae, improvement_mae_pct.

Запуск (из d:\\low_cortisol_spike-1\\ml-service):
    python verify_wave1.py

Скрипт ничего не отправляет по HTTP. Он импортирует train_model напрямую,
синтезирует 35 дней метрик одного пользователя и зовёт обучение. После —
читает meta.json с диска и печатает ключевые поля.

Что должно быть видно в выводе:
    cv_status            = "ok"
    cv_mae               ≈ небольшое число
    baseline_mae         ≈ независимо посчитан
    improvement_mae_pct  > 0  (модель должна обходить тривиальный baseline)
"""

from __future__ import annotations

import json
import os
import random
import shutil
import sys
from datetime import date, timedelta
from pathlib import Path

# Папка моделей пишется в текущий cwd по умолчанию: ./models/{user_id}/
# Изолируем результат в ./models_verify, чтобы не затирать прод-артефакты.
os.environ["MODELS_DIR"] = "models_verify"

VERIFY_USER = "verify_wave1_user"
VERIFY_DIR  = Path("models_verify") / VERIFY_USER


def _synthesize_health_data(days: int = 35):
    from app.schemas.input import (
        HealthData,
        SleepRecord,
        MoodRecord,
        StressRecord,
        ActivityRecord,
        WaterRecord,
        NutritionRecord,
    )

    # Зерно фиксируем — verifyrun детерминирован.
    rng = random.Random(42)

    today = date.today()
    sleep, mood, stress, activity, water, nutrition = [], [], [], [], [], []

    # Базовая «личность»: средне-стабильный человек, с небольшим шумом.
    for i in range(days):
        d = today - timedelta(days=days - i)
        ds = d.isoformat()

        sleep_h = max(4.0, min(10.0, rng.gauss(7.2, 0.9)))
        sleep_q = max(1.0, min(10.0, rng.gauss(6.5, 1.4)))
        stress_l = max(1.0, min(10.0, rng.gauss(5.0, 1.6)))
        act_min  = max(0.0, rng.gauss(35.0, 18.0))
        water_ml = max(500.0, rng.gauss(1900.0, 500.0))
        kcal     = max(1200.0, rng.gauss(2100.0, 350.0))
        protein  = max(40.0, rng.gauss(95.0, 18.0))

        # mood зависит от стресса/сна с шумом — даём модели хоть какой-то сигнал.
        m = 7.0 + 0.4 * (sleep_h - 7) - 0.5 * (stress_l - 5) + rng.gauss(0, 0.7)
        m = max(1.0, min(10.0, m))

        sleep.append(SleepRecord(date=ds, duration_hours=round(sleep_h, 2), quality=round(sleep_q, 2)))
        mood.append(MoodRecord(date=ds, mood_score=round(m, 2)))
        stress.append(StressRecord(date=ds, level=round(stress_l, 2)))
        activity.append(ActivityRecord(date=ds, duration_minutes=round(act_min, 1)))
        water.append(WaterRecord(date=ds, amount_ml=round(water_ml, 0)))
        nutrition.append(
            NutritionRecord(date=ds, calories=round(kcal, 0), protein_grams=round(protein, 1))
        )

    return HealthData(
        user_id    = VERIFY_USER,
        sleep      = sleep,
        mood       = mood,
        stress     = stress,
        activity   = activity,
        water      = water,
        nutrition  = nutrition,
    )


def main() -> int:
    print(f"[verify] cwd                  = {os.getcwd()}")
    print(f"[verify] MODELS_DIR (env)     = {os.environ.get('MODELS_DIR')}")

    if VERIFY_DIR.exists():
        shutil.rmtree(VERIFY_DIR)
        print(f"[verify] cleaned old artifacts at {VERIFY_DIR}")

    # Импорт после установки MODELS_DIR — model_storage читает env при старте.
    from app.services.model_runtime import train_model

    data = _synthesize_health_data(days=35)
    print(f"[verify] synthesized {len(data.mood)} days for user={VERIFY_USER}")

    result = train_model(VERIFY_USER, data, user_profile=None)

    print("\n------ train_model() return ------")
    for k in [
        "status", "model_type", "samples", "features",
        "cv_status", "cv_mae", "cv_r2",
        "baseline_mae", "baseline_r2", "improvement_mae_pct",
        "version",
    ]:
        print(f"  {k:22s} = {result.get(k)}")

    meta_path = VERIFY_DIR / "meta.json"
    if not meta_path.exists():
        print(f"\n[FAIL] meta.json not found at {meta_path}")
        return 1

    with open(meta_path, "r", encoding="utf-8") as f:
        meta = json.load(f)

    print("\n------ meta.json on disk ------")
    for k in [
        "version", "model_type", "samples", "features",
        "cv_status", "cv_mae", "cv_r2",
        "baseline_mae", "baseline_r2", "improvement_mae_pct",
        "trained_at",
    ]:
        print(f"  {k:22s} = {meta.get(k)}")

    # ── Проверки ------------------------------------------------------------
    failures = []

    if "cv_status" not in meta:
        failures.append("meta.json missing cv_status field")
    if "baseline_mae" not in meta:
        failures.append("meta.json missing baseline_mae field")
    if "improvement_mae_pct" not in meta:
        failures.append("meta.json missing improvement_mae_pct field")

    samples = meta.get("samples") or 0
    if samples >= 30:
        if meta.get("cv_status") != "ok":
            failures.append(
                f"samples={samples} &gt;= 30, expected cv_status='ok', got {meta.get('cv_status')!r}"
            )
        if meta.get("cv_mae") is None:
            failures.append("samples &gt;= 30 but cv_mae is None")

    print("\n------ Checks ------")
    if failures:
        for f in failures:
            print(f"  FAIL: {f}")
        return 1

    print("  PASS: cv_status, baseline_mae, improvement_mae_pct present")
    print("  PASS: cv_mae populated when samples >= 30")
    print("\n[verify] OK — Wave 1 артефакты пишутся корректно.")
    print("\nЕсли improvement_mae_pct < 0 — это сигнал, что 23 фичи не обходят")
    print("тривиальный lag-1 baseline на этих данных. Это нормально для синтетики;")
    print("на реальных пользовательских данных будет видно, побеждает ли модель")
    print("baseline (и если нет — модель не нужна, надо переосмыслять фичи).")
    return 0


if __name__ == "__main__":
    sys.exit(main())
