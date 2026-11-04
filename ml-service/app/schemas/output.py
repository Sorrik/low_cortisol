from __future__ import annotations

from typing import Optional
from pydantic import BaseModel

from typing import Literal

MetricType  = Literal["sleep", "food", "mood", "stress", "activity", "water"]
SeverityType = Literal["good", "attention", "alert"]
TriggerSourceType = Literal["rule", "ml_shap", "llm", "consistency", "fallback"]
ConfidenceType    = Literal["low", "medium", "high"]

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

class ModelMeta(BaseModel):
    version:             Optional[str]   = None
    samples_used:        Optional[int]   = None
    cv_status:           Optional[str]   = None    # "ok" | "insufficient_data"
    cv_mae:              Optional[float] = None
    cv_r2:               Optional[float] = None
    baseline_mae:        Optional[float] = None
    baseline_r2:         Optional[float] = None
    improvement_mae_pct: Optional[float] = None


class PredictionResult(BaseModel):
    user_id:           str
    phase:             PhaseInfo
    predicted_mood:    Optional[float]  = None
    confidence_lower:  Optional[float]  = None
    confidence_upper:  Optional[float]  = None
    top_influencers:   list[Influencer] = []
    recommendations:   list['Recommendation'] = []   # используем строку для forward reference
    model_version:     str = "rule_based"
    model_meta:        Optional[ModelMeta] = None
    data_completeness: DataCompleteness

class TriggerSignal(BaseModel):
    """
    Что именно зажгло рекомендацию. Прямой ответ комиссии на вопрос
    «как метрика влияет на рекомендацию» — числа, baseline, источник.

    Все поля опциональные, чтобы не ломать обратную совместимость:
    старые правила, которые ещё не размечены rule_id, могут заполнять
    только source + metric + current_value.
    """
    source:            TriggerSourceType
    metric:            Optional[MetricType]   = None
    current_value:     Optional[float]        = None
    personal_baseline: Optional[float]        = None
    z_score:           Optional[float]        = None
    delta_7d:          Optional[float]        = None
    shap_contribution: Optional[float]        = None
    confidence:        Optional[ConfidenceType] = None


class Recommendation(BaseModel):
    metric:         MetricType
    severity:       SeverityType
    title:          str
    description:    str
    rule_id:        Optional[str]           = None
    trigger_signal: Optional[TriggerSignal] = None