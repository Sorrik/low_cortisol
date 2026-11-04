import os
import tempfile
from datetime import date, timedelta

import pytest

# Модели тестов не должны попадать в рабочий каталог. Переменная задаётся до импорта приложения.
os.environ["MODEL_PATH"] = tempfile.mkdtemp(prefix="ml-tests-")
os.environ["WHISPER_PRELOAD"] = "0"

from fastapi.testclient import TestClient  # noqa: E402

from app.main import app  # noqa: E402


@pytest.fixture()
def client():
    return TestClient(app)


@pytest.fixture()
def make_request():
    def build(user_id: str, days: int) -> dict:
        today = date.today()
        dates = [(today - timedelta(days=days - 1 - i)).isoformat() for i in range(days)]
        return {
            "user_id": user_id,
            "health_data": {
                "user_id": user_id,
                "sleep": [
                    {"date": d, "duration_hours": 6.5 + (i % 4) * 0.5, "quality": 5.0 + i % 4}
                    for i, d in enumerate(dates)
                ],
                "mood": [{"date": d, "mood_score": 5.0 + (i % 4)} for i, d in enumerate(dates)],
                "stress": [{"date": d, "level": 7.0 - (i % 4)} for i, d in enumerate(dates)],
                "activity": [{"date": d, "duration_minutes": 30.0} for d in dates],
                "water": [{"date": d, "amount_ml": 2000.0} for d in dates],
                "nutrition": [
                    {"date": d, "calories": 2000.0, "protein_grams": 80.0} for d in dates
                ],
            },
        }

    return build
