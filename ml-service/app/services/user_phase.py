from __future__ import annotations

from datetime import datetime, timedelta
from typing import Any, List

from app.schemas.input import HealthData
from app.schemas.output import PhaseInfo, DataCompleteness

# Пороги фаз
COLD_START_THRESHOLD = 5     # меньше — cold_start
LEARNING_THRESHOLD   = 20    # меньше — learning
WINDOW_DAYS          = 14    # окно для completeness


def get_user_phase(data: HealthData) -> PhaseInfo:
    """
    Определяем фазу пользователя по количеству дней с настроением.
    Настроение — целевая переменная, от него зависит можно ли обучить модель.
    """
    mood_days = _count_days_with_data(data.mood, "mood_score")

    if mood_days < COLD_START_THRESHOLD:
        return PhaseInfo(
            mode="cold_start",
            total_records=mood_days,
            records_needed=COLD_START_THRESHOLD - mood_days,
            accuracy_percent=0,
            message=(
                f"Нужно ещё {COLD_START_THRESHOLD - mood_days} дней с данными "
                f"для начала обучения модели"
            )
        )

    if mood_days < LEARNING_THRESHOLD:
        accuracy = 40 + int((mood_days / LEARNING_THRESHOLD) * 25)
        return PhaseInfo(
            mode="learning",
            total_records=mood_days,
            records_needed=LEARNING_THRESHOLD - mood_days,
            accuracy_percent=accuracy,
            message=(
                f"Модель обучается — {mood_days} дней данных. "
                f"Ещё {LEARNING_THRESHOLD - mood_days} дней до персональной модели"
            )
        )

    # personal — полная модель, точность растёт с данными, но не больше 85%
    accuracy = min(85, 60 + int((mood_days - LEARNING_THRESHOLD) / 5) * 3)
    return PhaseInfo(
        mode="personal",
        total_records=mood_days,
        records_needed=0,
        accuracy_percent=accuracy,
        message=f"Персональная модель активна — точность ~{accuracy}%"
    )


def get_data_completeness(data: HealthData) -> DataCompleteness:
    """
    Считаем заполненность данных за последние WINDOW_DAYS дней.
    0–100% для каждого модуля.
    """
    all_dates = _collect_all_dates(data)
    if not all_dates:
        return DataCompleteness()

    today = datetime.now() 
    ref = min(max(all_dates), today)

    # ← ИСПРАВЛЕНО: strftime вместо isoformat
    # isoformat() давал "2026-02-19T00:00:00" — не совпадало с "2026-02-19"
    window = {
        (ref - timedelta(days=i)).strftime("%Y-%m-%d")
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
    """
    Общее количество дней с настроением.
    Используется в routers/train.py для проверки минимума.
    """
    return _count_days_with_data(data.mood, "mood_score")


# ──────────────────────────────────────────────
# Helpers
# ──────────────────────────────────────────────

def _count_days_with_data(records: List[Any] | None, value_field: str) -> int:
    """Считаем уникальные дни с непустым значением."""
    if not records:
        return 0
    dates = set()
    for r in records:
        d = str(getattr(r, "date", ""))
        v = getattr(r, value_field, None)
        if d and v is not None:
            dates.add(d)
    return len(dates)


def _collect_all_dates(data: HealthData) -> List[datetime]:
    """Все даты из всех модулей для определения окна."""
    dates = []
    for field in ["sleep", "mood", "stress", "activity", "water", "nutrition"]:
        records = getattr(data, field, None) or []
        for r in records:
            d = getattr(r, "date", None)
            if d:
                try:
                    dates.append(datetime.strptime(str(d), "%Y-%m-%d"))
                except ValueError:
                    continue
    return dates
