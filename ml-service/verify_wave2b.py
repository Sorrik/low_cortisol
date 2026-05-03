"""
Самопроверка Wave 2B: dual-axis alerts с rule_id и trigger_signal.

Запуск:
    python verify_wave2b.py
"""
from __future__ import annotations

import io
import sys
from datetime import date, timedelta

# Force UTF-8 stdout — иначе Windows cp1251 падает на emoji в текстах рекомендаций.
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")


def _make_records(days, gen):
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
        sleep.append(SleepRecord(date=ds, duration_hours=v.get("sleep_h", 7.5),
                                  quality=v.get("sleep_q", 7.0)))
        mood.append(MoodRecord(date=ds, mood_score=v.get("mood", 7.0)))
        stress.append(StressRecord(date=ds, level=v.get("stress", 5.0)))
        activity.append(ActivityRecord(date=ds, duration_minutes=30.0))
        water.append(WaterRecord(date=ds, amount_ml=2000.0))
        nutrition.append(NutritionRecord(date=ds, calories=2000.0, protein_grams=80.0))
    return HealthData(user_id="w2b", sleep=sleep, mood=mood, stress=stress,
                      activity=activity, water=water, nutrition=nutrition)


def _print_recs(label, recs):
    print(f"\n------ {label} ------")
    for r in recs:
        ts = r.trigger_signal
        ts_repr = (f"src={ts.source} metric={ts.metric} cur={ts.current_value} "
                   f"baseline={ts.personal_baseline} z={ts.z_score} conf={ts.confidence}"
                   if ts else "None")
        print(f"  [{r.severity}] {r.metric:7s} rule_id={r.rule_id}")
        print(f"    title : {r.title}")
        print(f"    desc  : {r.description[:90]}{'...' if len(r.description) > 90 else ''}")
        print(f"    trig  : {ts_repr}")


def _expect(label, recs, predicate, hint):
    if predicate(recs):
        print(f"  PASS  {label}")
        return True
    print(f"  FAIL  {label} ({hint})")
    return False


def _has_rule(recs, rule_id):
    return any(r.rule_id == rule_id for r in recs)


def _has_metric(recs, metric):
    return any(r.metric == metric for r in recs)


def main() -> int:
    from app.services.recommendations import generate_recommendations

    all_pass = True

    # ── Случай 1: стабильно нормальный — dual-axis должен МОЛЧАТЬ
    data1 = _make_records(35, lambda i, ds: {"stress": 5, "mood": 7, "sleep_q": 7, "sleep_h": 7.5})
    recs1 = generate_recommendations(data1, "personal", top_influencers=[], predicted_mood=7.0)
    _print_recs("Case 1: stable normal", recs1)
    all_pass &= _expect("no stress/mood/sleep_q rule_id", recs1,
                         lambda rs: not any(r.rule_id and (r.rule_id.startswith(("stress_", "mood_", "sleep_q_"))) for r in rs),
                         "не должны срабатывать триггеры по субъективным")

    # ── Случай 2: скачок stress — z-trigger
    def jump(i, ds):
        if i >= 32: return {"stress": 9, "mood": 7, "sleep_q": 7, "sleep_h": 7.5}
        return {"stress": 5, "mood": 7, "sleep_q": 7, "sleep_h": 7.5}
    data2 = _make_records(35, jump)
    recs2 = generate_recommendations(data2, "personal", top_influencers=[], predicted_mood=6.5)
    _print_recs("Case 2: stress spike (5->9 last 3d)", recs2)
    all_pass &= _expect("rule stress_chronic_3d", recs2,
                         lambda rs: _has_rule(rs, "stress_chronic_3d"),
                         "должно сработать chronic_3d (stress>=8 три дня подряд)")
    all_pass &= _expect("trigger_signal z >= 1.5", recs2,
                         lambda rs: any(r.metric == "stress" and r.trigger_signal
                                         and r.trigger_signal.z_score is not None
                                         and r.trigger_signal.z_score >= 1.5 for r in rs),
                         "z-score должен быть пробит")

    # ── Случай 3: хронический stress=9 — baseline_concern, z=0
    data3 = _make_records(35, lambda i, ds: {"stress": 9, "mood": 7, "sleep_q": 7, "sleep_h": 7.5})
    recs3 = generate_recommendations(data3, "personal", top_influencers=[], predicted_mood=6.5)
    _print_recs("Case 3: chronic stress=9 (35d)", recs3)
    all_pass &= _expect("rule stress_chronic_baseline", recs3,
                         lambda rs: _has_rule(rs, "stress_chronic_baseline"),
                         "ось B по baseline-concern должна сработать (z молчит)")
    all_pass &= _expect("z_score близок к 0", recs3,
                         lambda rs: any(r.metric == "stress" and r.trigger_signal
                                         and r.trigger_signal.z_score is not None
                                         and abs(r.trigger_signal.z_score) < 0.5 for r in rs),
                         "при хроническом z должен молчать")

    # ── Случай 4: хронически низкое настроение
    data4 = _make_records(35, lambda i, ds: {"stress": 5, "mood": 4, "sleep_q": 7, "sleep_h": 7.5})
    recs4 = generate_recommendations(data4, "personal", top_influencers=[], predicted_mood=4.0)
    _print_recs("Case 4: chronic low mood=4 (35d)", recs4)
    all_pass &= _expect("rule mood_chronic_baseline", recs4,
                         lambda rs: _has_rule(rs, "mood_chronic_baseline"),
                         "должно быть распознано как хронический паттерн, не разовое падение")
    all_pass &= _expect("severity=alert", recs4,
                         lambda rs: any(r.metric == "mood" and r.severity == "alert" for r in rs),
                         "хроническое низкое настроение -> alert")

    # ── Случай 5: cold start (5 дней) — структурированные не должны срабатывать
    data5 = _make_records(5, lambda i, ds: {"stress": 9, "mood": 4, "sleep_q": 4, "sleep_h": 4})
    recs5 = generate_recommendations(data5, "personal", top_influencers=[], predicted_mood=5)
    _print_recs("Case 5: cold start 5d (всё плохо, но baseline не построен)", recs5)
    all_pass &= _expect("нет stress_chronic_baseline (мало baseline-точек)", recs5,
                         lambda rs: not _has_rule(rs, "stress_chronic_baseline"),
                         "при <7 baseline-точек ось B по baseline_concern молчит")
    all_pass &= _expect("нет mood_chronic_baseline (мало baseline-точек)", recs5,
                         lambda rs: not _has_rule(rs, "mood_chronic_baseline"),
                         "то же для mood")
    # Но chronic_3d может срабатывать (это просто 3 последних дня).
    # На 5 днях с stress=9 chronic_high_stress_3d должен быть = 1, и тут срабатывает stress_chronic_3d.
    all_pass &= _expect("stress_chronic_3d при коротком cold start всё равно работает", recs5,
                         lambda rs: _has_rule(rs, "stress_chronic_3d"),
                         "абсолютный chronic-флаг не зависит от baseline samples")

    print("\n================ SUMMARY ================")
    print("ALL CASES PASS" if all_pass else "SOME CASES FAILED")
    return 0 if all_pass else 1


if __name__ == "__main__":
    sys.exit(main())
