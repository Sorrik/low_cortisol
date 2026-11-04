from __future__ import annotations

from datetime import datetime, timedelta
from typing import Any, List

from app.schemas.input import HealthData
from app.schemas.output import DataCompleteness, PhaseInfo

COLD_START_THRESHOLD = 14
LEARNING_THRESHOLD = 50
WINDOW_DAYS = 14


def get_user_phase(data: HealthData) -> PhaseInfo:
    mood_days = _count_days_with_data(data.mood, "mood_score")

    if mood_days < COLD_START_THRESHOLD:
        remaining = COLD_START_THRESHOLD - mood_days
        return PhaseInfo(
            mode="cold_start",
            total_records=mood_days,
            records_needed=remaining,
            accuracy_percent=0,
            message=(
                f"Need {remaining} more mood days before model training can start"
            ),
        )

    if mood_days < LEARNING_THRESHOLD:
        remaining = LEARNING_THRESHOLD - mood_days
        return PhaseInfo(
            mode="learning",
            total_records=mood_days,
            records_needed=remaining,
            accuracy_percent=0,
            message=(
                f"Model is in learning phase with {mood_days} mood days. "
                f"Need {remaining} more days before the full personal model is enabled"
            ),
        )

    return PhaseInfo(
        mode="personal",
        total_records=mood_days,
        records_needed=0,
        accuracy_percent=0,
        message="Personal model is active. Use validation metrics instead of synthetic accuracy.",
    )


def get_data_completeness(data: HealthData) -> DataCompleteness:
    today = datetime.now()
    window = {
        (today - timedelta(days=i)).strftime("%Y-%m-%d")
        for i in range(WINDOW_DAYS)
    }
    total = len(window)

    def _pct(records: List[Any], date_field: str = "date") -> int:
        if not records:
            return 0
        present = {
            str(getattr(r, date_field, ""))
            for r in records
            if str(getattr(r, date_field, "")) in window
        }
        return int(len(present) / total * 100)

    return DataCompleteness(
        sleep=_pct(data.sleep or []),
        mood=_pct(data.mood or []),
        stress=_pct(data.stress or []),
        activity=_pct(data.activity or []),
        nutrition=_pct(data.nutrition or []),
        water=_pct(data.water or []),
    )


def get_total_records(data: HealthData) -> int:
    return _count_days_with_data(data.mood, "mood_score")


def _count_days_with_data(records: List[Any] | None, value_field: str) -> int:
    if not records:
        return 0
    dates = set()
    for r in records:
        d = str(getattr(r, "date", ""))
        v = getattr(r, value_field, None)
        if d and v is not None:
            dates.add(d)
    return len(dates)
