from __future__ import annotations

from typing import List, Optional
from pydantic import BaseModel


# ══════════════════════════════════════════════════════════════
# Record models — одна запись за один день
# ══════════════════════════════════════════════════════════════

class SleepRecord(BaseModel):
    date: str
    duration_hours: float
    quality: float
    interruptions: Optional[int] = 0
    bed_time:  Optional[str] = None   # "23:30" ← добавить
    wake_time: Optional[str] = None   # "07:00" ← добавить


class MoodRecord(BaseModel):
    date: str
    mood_score: float                   # 1–10


class StressRecord(BaseModel):
    date: str
    level: float                        # 1–10


class ActivityRecord(BaseModel):
    date: str
    time: Optional[str] = None        # "20:30" ← добавить
    duration_minutes: float
    intensity: Optional[str] = "moderate"
    calories_burned: Optional[float] = 0.0


class WaterRecord(BaseModel):
    date: str
    amount_ml: float


class NutritionRecord(BaseModel):
    date: str
    time: Optional[str] = None        # "21:30" ← добавить
    calories: float
    protein_grams: float
    carbs_grams: Optional[float] = 0.0
    fat_grams: Optional[float] = 0.0


# ══════════════════════════════════════════════════════════════
# HealthData — главный контейнер данных пользователя
# ══════════════════════════════════════════════════════════════

class HealthData(BaseModel):
    user_id: str
    sleep:      Optional[List[SleepRecord]]     = []
    mood:       Optional[List[MoodRecord]]      = []
    stress:     Optional[List[StressRecord]]    = []
    activity:   Optional[List[ActivityRecord]]  = []
    water:      Optional[List[WaterRecord]]     = []
    nutrition:  Optional[List[NutritionRecord]] = []


# ══════════════════════════════════════════════════════════════
# Request schemas — входящие запросы от NestJS
# ══════════════════════════════════════════════════════════════

class PredictRequest(BaseModel):
    user_id: str
    health_data: HealthData


class TrainRequest(BaseModel):
    user_id: str
    health_data: HealthData
