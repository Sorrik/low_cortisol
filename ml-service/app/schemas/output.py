from __future__ import annotations

from typing import Optional
from pydantic import BaseModel

from typing import Literal

MetricType  = Literal["sleep", "food", "mood", "stress", "activity", "water"]
SeverityType = Literal["good", "attention", "alert"]

# ══════════════════════════════════════════════════════════════
# PhaseInfo — фаза пользователя
# ══════════════════════════════════════════════════════════════

class PhaseInfo(BaseModel):
    mode: str                    # cold_start | learning | personal
    total_records: int  = 0
    records_needed: int = 0
    accuracy_percent: int = 0
    message: str        = ""


# ══════════════════════════════════════════════════════════════
# Influencer — один SHAP фактор
# ══════════════════════════════════════════════════════════════

class Influencer(BaseModel):
    factor: str
    impact: float                        # abs(SHAP) — сила влияния
    raw_shap: Optional[float]  = None    # знак: + улучшает, - снижает
    direction: str             = "positive"   # "positive" | "negative"
    description: str           = ""
    feature_value: Optional[float] = None    # реальное значение фичи


# ══════════════════════════════════════════════════════════════
# DataCompleteness — заполненность данных 0–100%
# ══════════════════════════════════════════════════════════════

class DataCompleteness(BaseModel):
    sleep:     int = 0
    mood:      int = 0
    stress:    int = 0
    activity:  int = 0
    nutrition: int = 0
    water:     int = 0


# ══════════════════════════════════════════════════════════════
# PredictionResult — ответ /predict
# ══════════════════════════════════════════════════════════════

class PredictionResult(BaseModel):
    user_id:           str
    phase:             PhaseInfo
    predicted_mood:    Optional[float]  = None
    confidence_lower:  Optional[float]  = None
    confidence_upper:  Optional[float]  = None
    top_influencers:   list[Influencer] = []
    recommendations:   list['Recommendation'] = []   # используем строку для forward reference
    model_version:     str = "rule_based"
    data_completeness: DataCompleteness

class Recommendation(BaseModel):      # ← строка 64
    metric:      MetricType           # ← строка 65 (с отступом в 4 пробела)
    severity:    SeverityType
    title:       str
    description: str