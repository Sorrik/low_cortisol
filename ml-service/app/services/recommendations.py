# app/services/recommendations.py
from __future__ import annotations

import logging
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional

import numpy as np

from app.schemas.input import HealthData
from app.schemas.output import Recommendation          # ← новый импорт
from app.services.feature_engineering import build_features

logger = logging.getLogger(__name__)

DAYS_RU = ["понедельник", "вторник", "среда", "четверг", "пятница", "суббота", "воскресенье"]


# ══════════════════════════════════════════════════════════════
# Factor → Metric / Severity mapping
# ══════════════════════════════════════════════════════════════

FACTOR_TO_METRIC: Dict[str, str] = {
    **{k: "sleep" for k in [
        "sleep_duration_mean", "sleep_duration_t", "sleep_duration_t1", "sleep_duration_t2",
        "sleep_quality_mean",  "sleep_quality_t",  "sleep_quality_t1",  "sleep_quality_t2",
        "sleep_debt_hours_7d", "sleep_deficit_days_7d", "sleep_optimal_days_7d",
        "sleep_duration_trend", "sleep_quality_trend", "sleep_vs_norm",
        "interruptions_mean", "interruptions_t",
        "combo_sleep_x_low_stress", "combo_activity_when_sleep_debt",
        "missing_sleep_ratio",
    ]},
    **{k: "stress" for k in [
        "stress_mean", "stress_t", "stress_t1", "stress_t2",
        "stress_high_days_14d", "stress_critical_days_14d",
        "stress_trend", "stress_vs_norm",
        "combo_stress_x_dehydration", "missing_stress_ratio",
    ]},
    **{k: "water" for k in [
        "water_ml_mean", "water_ml_t", "water_ml_t1", "water_ml_t2",
        "net_hydration_ml_mean", "net_hydration_ml_t", "net_hydration_ml_t1",
        "water_low_days_14d", "water_critical_days_14d", "water_trend", "water_vs_norm",
        "combo_good_sleep_but_dehydrated", "missing_water_ratio",
    ]},
    **{k: "food" for k in [
        "calories_mean", "calories_t", "calories_t1", "calories_t2",
        "protein_mean",  "protein_t",  "protein_t1",  "protein_t2",
        "carbs_mean", "fat_mean",
        "calorie_deficit_days_14d", "low_protein_days_14d",
        "calories_trend", "protein_trend",
        "combo_well_rested_but_underfueled", "combo_triple_negative",
        "missing_nutrition_ratio",
    ]},
    **{k: "activity" for k in [
        "activity_minutes_mean", "activity_minutes_t", "activity_minutes_t1", "activity_minutes_t2",
        "activity_days_14d", "activity_overload_flag", "activity_minutes_trend",
        "calories_burned_mean",
        "combo_activity_x_sleep", "missing_activity_ratio",
    ]},
    **{k: "mood" for k in [
        "mood_mean", "mood_t", "mood_t1", "mood_t2",
        "mood_trend", "mood_std", "mood_min_7d",
        "combo_perfect_day",
    ]},
}

# Fallback: ищем метрику по ключевым словам в тексте
_TEXT_METRIC_RULES: List[tuple[List[str], str]] = [
    (["😴", "🌙", "сон", "спать", "засыпа", "сонный долг"],   "sleep"),
    (["🧘", "стресс", "кортизол", "тревог"],                   "stress"),
    (["💧", "вода", "гидрат", "обезвоживан"],                   "water"),
    (["🍽", "🥗", "калор", "белок", "питан", "триптофан"],     "food"),
    (["🏃", "активност", "трениров", "ходьб", "нагрузк"],      "activity"),
    (["прогноз настроения", "настроен", "корреляц", "📅"],      "mood"),
]


def _detect_metric(text: str) -> str:
    lower = text.lower()
    for markers, metric in _TEXT_METRIC_RULES:
        if any(m in lower or m in text for m in markers):
            return metric
    return "mood"


def _detect_severity(text: str) -> str:
    if "🚨" in text:
        return "alert"
    if "✅" in text or "🌟" in text or "😊" in text:
        return "good"
    return "attention"


def _split_title(text: str) -> tuple[str, str]:
    import re
    # Ищем точку/!/? которая НЕ является десятичным разделителем (не окружена цифрами)
    for i, ch in enumerate(text):
        if ch in ".!?" and i < 80:
            # Пропускаем точку если она между цифрами (десятичное число)
            if ch == "." and i > 0 and i < len(text) - 1:
                if text[i - 1].isdigit() and text[i + 1].isdigit():
                    continue
            title = text[: i + 1].strip()
            desc  = text[i + 1 :].strip() or text
            return title, desc

    dash = text.find(" — ")
    if 0 < dash < 70:
        return text[:dash].strip(), text
    if len(text) > 70:
        return text[:70].rstrip() + "…", text
    return text, text


def _pack(texts: List[str], influencers: List[Dict]) -> List[Recommendation]:
    """
    Упаковываем list[str] → list[Recommendation].
    Для SHAP-рекомендаций ищем фактор через description influencer'а,
    для остальных — keyword fallback по тексту.
    """
    # description influencer'а[:60] → factor
    desc_to_factor: Dict[str, str] = {
        (inf.get("description") or "")[:60]: inf.get("factor", "")
        for inf in influencers
        if inf.get("description")
    }

    result: List[Recommendation] = []
    for text in texts:
        factor   = desc_to_factor.get(text[:60], "")
        metric   = FACTOR_TO_METRIC.get(factor) or _detect_metric(text)
        severity = _detect_severity(text)
        title, description = _split_title(text)
        result.append(Recommendation(
            metric=metric,
            severity=severity,
            title=title,
            description=description,
        ))
    return result


# ══════════════════════════════════════════════════════════════
# Main entry point
# ══════════════════════════════════════════════════════════════

def generate_recommendations(
    data: HealthData,
    phase_mode: str,
    top_influencers: List[Dict],
    predicted_mood: Optional[float],
) -> List[Recommendation]:                             # ← было List[str]
    """
    Логика по фазе:
      cold_start → только научные правила (данных мало)
      learning   → правила + первые паттерны + SHAP если есть
      personal   → SHAP + паттерны + долгосрочный анализ
    """
    feats = build_features(data)

    if phase_mode == "cold_start":
        raw = _cold_start_recommendations(data, feats)[:4]

    elif phase_mode == "learning":
        raw = _deduplicate(
            _mood_forecast_line(predicted_mood)
            + _shap_recommendations(top_influencers, feats)
            + _learning_correlations(data)
            + _cold_start_recommendations(data, feats)
        )[:5]

    else:  # personal
        raw = _deduplicate(
            _mood_forecast_line(predicted_mood)
            + _shap_recommendations(top_influencers, feats)
            + _pattern_recommendations(data)
            + _critical_alerts(feats)
        )[:6]

    return _pack(raw, top_influencers)


# ══════════════════════════════════════════════════════════════
# 1. Mood forecast line
# ══════════════════════════════════════════════════════════════

def _mood_forecast_line(predicted_mood: Optional[float]) -> List[str]:
    if predicted_mood is None:
        return []
    if predicted_mood >= 8.5:
        return [f"🌟 Прогноз настроения на завтра: {predicted_mood}/10 — отличный день впереди!"]
    if predicted_mood >= 7.0:
        return [f"😊 Прогноз настроения на завтра: {predicted_mood}/10 — хороший день"]
    if predicted_mood >= 5.0:
        return [f"😐 Прогноз настроения на завтра: {predicted_mood}/10 — средний день. Вот что поможет его улучшить:"]
    if predicted_mood >= 3.5:
        return [f"😔 Прогноз настроения на завтра: {predicted_mood}/10 — сложный день. Обрати особое внимание на советы ниже"]
    return [f"🚨 Прогноз настроения на завтра: {predicted_mood}/10 — тяжёлый день. Срочно нужен отдых и уход за собой"]


# ══════════════════════════════════════════════════════════════
# 2. Cold Start — научные правила
# ══════════════════════════════════════════════════════════════

def _cold_start_recommendations(data: HealthData, feats: Dict) -> List[str]:
    recs: List[str] = []

    # ── Сон
    dur  = feats.get("sleep_duration_mean", 0)
    q    = feats.get("sleep_quality_mean", 0)
    debt = feats.get("sleep_debt_hours_7d", 0)

    if dur > 0:
        if dur < 5.5:
            recs.append(
                "😴 Критически мало сна — меньше 5.5ч. "
                "Мозг не успевает очиститься от токсинов. "
                "Ляг на 1–1.5ч раньше сегодня — это приоритет №1"
            )
        elif dur < 7.0:
            recs.append(
                f"😴 Ты спишь {round(dur, 1)}ч — немного меньше нормы (7–9ч). "
                "Добавь 30–45 минут: ляг раньше, не раньше вставай"
            )
        elif dur <= 9.0:
            recs.append(f"✅ Продолжительность сна {round(dur, 1)}ч — отлично, продолжай!")

        if q > 0 and q < 5.0:
            recs.append(
                "🌙 Качество сна низкое. Попробуй: убери экраны за час до сна, "
                "проветри комнату (18–20°C идеально), темнота и тишина"
            )

    if debt > 3.0:
        recs.append(
            f"⚠️ Накопленный сонный долг за неделю: {round(debt, 1)}ч. "
            "Одной ночью не компенсируешь — нужно 3–4 дня хорошего сна подряд"
        )

    # ── Стресс
    stress = feats.get("stress_mean", 0)
    if stress >= 8.5:
        recs.append(
            "🚨 Очень высокий стресс. Кортизол разрушает сон и иммунитет. "
            "Сегодня: 20 минут прогулки + убери все уведомления на 2 часа"
        )
    elif stress >= 7.0:
        recs.append(
            f"🧘 Стресс {round(stress, 1)}/10 — высокий. "
            "Наука: 20 минут ходьбы снижают кортизол на ~30%. Попробуй сегодня"
        )
    elif stress >= 5.0:
        recs.append(
            "🧘 Умеренный стресс. 5–10 минут глубокого дыхания "
            "снижают тревогу и улучшают концентрацию"
        )

    # ── Гидратация
    net_hyd   = feats.get("net_hydration_ml_mean", 0)
    water_avg = feats.get("water_ml_mean", 0)

    if water_avg > 0:
        if net_hyd > 0 and net_hyd < 1200:
            recs.append(
                f"💧 Нетто-гидратация всего {int(net_hyd)} мл "
                f"(вода {int(water_avg)} мл минус потери от активности). "
                "Мозг на 73% вода: обезвоживание снижает настроение и память. "
                "Выпей 2 стакана прямо сейчас"
            )
        elif water_avg < 1500:
            recs.append(
                f"💧 Воды мало: {int(water_avg)} мл. "
                "Норма — 2000+ мл. Уже 2% обезвоживания ухудшают настроение и концентрацию"
            )
        elif water_avg >= 2000:
            recs.append("💧 Гидратация отличная! Это напрямую поддерживает настроение")

    # ── Питание
    cal  = feats.get("calories_mean", 0)
    prot = feats.get("protein_mean", 0)

    if cal > 0:
        if cal < 1400:
            recs.append(
                f"🍽️ Критический дефицит калорий: {int(cal)} ккал/день. "
                "Мозг воспринимает это как угрозу выживания — кортизол растёт, "
                "настроение падает даже при хорошем сне"
            )
        elif cal < 1700:
            recs.append(
                f"🍽️ Маловато калорий: {int(cal)} ккал. "
                "Добавь здоровые жиры и белок для стабильной энергии"
            )

    if prot > 0 and prot < 40:
        recs.append(
            f"🥗 Очень мало белка: {int(prot)} г/день. "
            "90% серотонина синтезируется в кишечнике из триптофана (белок). "
            "Добавь яйца, орехи, бобовые или мясо"
        )
    elif prot > 0 and prot < 60:
        recs.append(
            f"🥗 Белка немного мало: {int(prot)} г. Норма — 60–80+ г. "
            "Белок — строительный материал для всех нейромедиаторов настроения"
        )

    # ── Активность
    act      = feats.get("activity_minutes_mean", 0)
    act_days = feats.get("activity_days_14d", 0)

    if act_days == 0:
        recs.append(
            "🏃 Нет данных об активности. Физическая нагрузка — "
            "самый быстрый способ поднять серотонин и дофамин. "
            "Начни с 20 минут ходьбы сегодня"
        )
    elif act < 20:
        recs.append(
            f"🏃 Среднее время активности: {round(act, 0)} мин/день. "
            "ВОЗ: минимум 150 мин/неделю. Даже 15–20 мин в день меняют всё"
        )
    elif act >= 60 and feats.get("activity_overload_flag", 0) == 1.0:
        recs.append(
            "⚠️ Перегруз от активности. Слишком интенсивные тренировки "
            "поднимают кортизол и ухудшают сон. Добавь день отдыха"
        )

    if not recs:
        recs = [
            "📊 Введи данные о сне, стрессе и воде — и получишь персональные советы",
            "😴 Сон 7–9ч — главный фактор настроения. Введи сегодняшний сон",
            "💧 2 литра воды в день снижают усталость и раздражительность",
            "🏃 30 минут активности сегодня → лучшее настроение завтра",
        ]

    return recs


# ══════════════════════════════════════════════════════════════
# 3. SHAP recommendations
# ══════════════════════════════════════════════════════════════

def _shap_recommendations(influencers: List[Dict], feats: Dict) -> List[str]:
    recs: List[str] = []

    negative = sorted(
        [i for i in influencers if i.get("direction") == "negative" and i.get("impact", 0) > 0.05],
        key=lambda x: x.get("impact", 0),
        reverse=True,
    )
    positive = sorted(
        [i for i in influencers if i.get("direction") == "positive" and i.get("impact", 0) > 0.15],
        key=lambda x: x.get("impact", 0),
        reverse=True,
    )

    for inf in negative[:3]:
        rec = _factor_to_action(inf, feats)
        if rec:
            recs.append(rec)

    if positive:
        top  = positive[0]
        desc = _positive_reinforcement(
            top.get("factor", ""),
            round(top.get("feature_value", 0), 1),
            round(top.get("impact", 0), 2),
        )
        if desc:
            recs.append(desc)

    return recs


def _factor_to_action(inf: Dict, feats: Dict) -> Optional[str]:
    factor = inf.get("factor", "")
    impact = round(inf.get("impact", 0), 1)
    val    = round(inf.get("feature_value", 0), 1)

    # ── Сон
    if factor in ("sleep_duration_mean", "sleep_duration_t", "sleep_duration_t1"):
        if val < 6:
            return (f"😴 Сон {val}ч — критически мало (влияние -{impact}). "
                    "Ляг на 1.5ч раньше сегодня")
        return (f"😴 Короткий сон {val}ч снижает настроение на {impact}. "
                "Добавь 30–60 минут: ляг раньше")

    if factor in ("sleep_quality_mean", "sleep_quality_t", "sleep_quality_t1"):
        return (f"🌙 Качество сна {val}/10 снижает настроение на {impact}. "
                "Убери экраны за час до сна, проветри комнату (18–20°C)")

    if factor == "sleep_debt_hours_7d":
        return (f"⚠️ Сонный долг за неделю: {val}ч — это снижает настроение на {impact}. "
                "Нужно 3–4 ночи хорошего сна подряд чтобы восстановиться")

    if factor == "sleep_deficit_days_7d":
        return (f"⚠️ {int(val)} дней с недосыпом за неделю — снижает настроение на {impact}. "
                "Приоритет: стабильный сон 7–8ч каждую ночь")

    if factor in ("sleep_duration_trend", "sleep_quality_trend"):
        return (f"📉 Качество/продолжительность сна ухудшаются (тренд {val}) — "
                f"влияние -{impact}. Верни режим сна")

    if factor == "sleep_vs_norm":
        return (f"📊 Спишь {abs(val)}ч меньше своей нормы — снижает настроение на {impact}. "
                "Твоя норма важнее общих рекомендаций")

    # ── Стресс
    if factor in ("stress_mean", "stress_t", "stress_t1"):
        if val >= 8.5:
            return (f"🚨 Стресс {val}/10 — критический (влияние -{impact}). "
                    "Сегодня: прогулка 20 мин + убери уведомления на 2ч")
        return (f"🧘 Стресс {val}/10 снижает настроение на {impact}. "
                "20 минут ходьбы снижают кортизол на ~30%")

    if factor == "stress_high_days_14d":
        return (f"📅 {int(val)} высокострессовых дней за 2 недели — снижает настроение на {impact}. "
                "Нужна регулярная разгрузка: ежедневные 15 мин только для себя")

    if factor == "stress_trend":
        return (f"📈 Стресс нарастает (тренд +{val}) — влияние -{impact}. "
                "Разберись с источником стресса пока не стало хуже")

    if factor == "stress_vs_norm":
        return (f"📊 Стресс выше твоей нормы на {abs(val)} — снижает настроение на {impact}. "
                "Это сигнал: что изменилось за последние дни?")

    # ── Вода
    if factor in ("water_ml_mean", "water_ml_t", "water_ml_t1"):
        if val < 1200:
            return (f"🚨 Критическое обезвоживание: {int(val)} мл (влияние -{impact}). "
                    "Выпей 2 стакана воды прямо сейчас — мозгу нужна вода для серотонина")
        return (f"💧 Воды мало: {int(val)} мл — снижает настроение на {impact}. "
                "Норма 2000+ мл. Поставь стакан воды рядом с собой")

    if factor in ("net_hydration_ml_mean", "net_hydration_ml_t"):
        return (f"💧 Нетто-гидратация {int(val)} мл (вода − потери от тренировки) — "
                f"снижает настроение на {impact}. Пей больше в дни тренировок")

    if factor == "water_critical_days_14d":
        return (f"💧 {int(val)} дней с критическим обезвоживанием за 2 недели — "
                f"влияние -{impact}. Бутылка воды с собой на весь день")

    if factor == "water_trend":
        return (f"📉 Потребление воды снижается (тренд {val} мл) — влияние -{impact}. "
                "Установи напоминания пить каждые 2 часа")

    # ── Питание
    if factor in ("calories_mean", "calories_t", "calories_t1"):
        if val < 1400:
            return (f"🍽️ Критический дефицит: {int(val)} ккал (влияние -{impact}). "
                    "Мозг в режиме выживания — кортизол растёт. Поешь нормально сегодня")
        return (f"🍽️ Мало калорий: {int(val)} ккал — снижает настроение на {impact}. "
                "Добавь здоровые жиры: орехи, авокадо, оливковое масло")

    if factor in ("protein_mean", "protein_t", "protein_t1"):
        return (f"🥗 Мало белка: {val} г — снижает настроение на {impact}. "
                "Белок → триптофан → серотонин. Добавь яйца или бобовые")

    if factor == "calorie_deficit_days_14d":
        return (f"🍽️ {int(val)} дней с дефицитом калорий за 2 недели — "
                f"влияние -{impact}. Хроническое недоедание = хронически плохое настроение")

    if factor == "low_protein_days_14d":
        return (f"🥗 {int(val)} дней с низким белком за 2 недели — влияние -{impact}. "
                "Без белка мозг не может синтезировать серотонин и дофамин")

    if factor == "calories_trend":
        return (f"📉 Калорийность снижается (тренд {val} ккал) — влияние -{impact}. "
                "Следи чтобы не уйти в дефицит")

    # ── Активность
    if factor in ("activity_minutes_mean", "activity_minutes_t", "activity_minutes_t1"):
        if val == 0:
            return (f"🏃 Нет активности — снижает настроение на {impact}. "
                    "15 минут ходьбы сейчас → серотонин + дофамин")
        return (f"🏃 Мало активности: {int(val)} мин — снижает настроение на {impact}. "
                "Добавь хотя бы 20 минут движения сегодня")

    if factor == "activity_overload_flag":
        return (f"⚠️ Перегруз от тренировок снижает настроение на {impact}. "
                "Слишком много интенсивных нагрузок = рост кортизола. Возьми день отдыха")

    if factor == "activity_minutes_trend":
        return (f"📉 Активность снижается (тренд {val} мин) — влияние -{impact}. "
                "Не теряй темп — регулярность важнее интенсивности")

    # ── Комбо
    if factor == "combo_good_sleep_but_dehydrated":
        return (f"⚠️ Выспался, но обезвожен — снижает настроение на {impact}. "
                "Хороший сон не компенсирует нехватку воды. Выпей 2–3 стакана прямо сейчас")

    if factor == "combo_well_rested_but_underfueled":
        return (f"⚠️ Хороший отдых, но питание недостаточное — влияние -{impact}. "
                "Сон не заменит еду: мозгу нужны белок и калории для серотонина")

    if factor == "combo_stress_x_dehydration":
        return (f"🚨 Стресс + обезвоживание вместе — снижают настроение на {impact}. "
                "Двойной удар: выпей воды и сделай паузу от работы")

    if factor == "combo_activity_when_sleep_debt":
        return (f"⚠️ Тренировки при накопленном сонном долге — снижают настроение на {impact}. "
                "Сначала выспись несколько ночей, потом возобновляй интенсивные нагрузки")

    if factor == "combo_triple_negative":
        return (f"🚨 Тройной негатив: мало воды + мало еды + мало белка — "
                f"влияние -{impact}. Всё сразу: выпей воды, поешь нормально сегодня")

    # ── История настроения
    if factor in ("mood_t", "mood_t1", "mood_t2"):
        return (f"📉 Недавнее низкое настроение тянет прогноз вниз на {impact}. "
                "Прерви цикл: сделай одно приятное маленькое дело сегодня")

    if factor == "mood_trend":
        return (f"📉 Настроение падает последние дни (тренд {val}) — влияние -{impact}. "
                "Найди что изменилось: сон? стресс? питание?")

    # ── Нехватка данных
    if factor == "missing_nutrition_ratio":
        return ("📊 Нет данных о питании за многие дни — это снижает точность прогноза. "
                "Введи калории и белок хотя бы за 3–4 дня в неделю")

    if factor == "missing_water_ratio":
        return ("📊 Нет данных о воде за многие дни — трудно оценить гидратацию. "
                "Вводи воду ежедневно: это один из ключевых факторов")

    # Fallback
    desc = inf.get("description", "")
    return f"⚠️ {desc}" if desc else None


def _positive_reinforcement(factor: str, val: float, impact: float) -> Optional[str]:
    reinforcements = {
        "sleep_duration_mean":      f"✅ Средний сон {val}ч — хорошо! Продолжай держать режим",
        "sleep_quality_mean":       f"✅ Качество сна {val}/10 — отлично, это твой главный плюс",
        "sleep_optimal_days_7d":    f"✅ {int(val)} дней с оптимальным сном за неделю — продолжай!",
        "stress_mean":              f"✅ Стресс {val}/10 — под контролем. Хорошо!",
        "activity_minutes_mean":    f"✅ Активность {int(val)} мин/день — отличный результат!",
        "activity_days_14d":        f"✅ {int(val)} активных дней за 2 недели — это влияет на настроение",
        "water_ml_mean":            f"✅ Вода {int(val)} мл — хорошая гидратация!",
        "net_hydration_ml_mean":    f"✅ Нетто-гидратация {int(val)} мл — мозг доволен!",
        "protein_mean":             f"✅ Белок {val} г/день — отлично для серотонина!",
        "combo_sleep_x_low_stress": f"✅ Комбо 'хороший сон + низкий стресс' работает — продолжай!",
        "combo_perfect_day":        f"✅ 'Идеальный день' — сон + активность + вода + стресс под контролем!",
        "mood_mean":                f"✅ Среднее настроение {val}/10 за 2 недели — хорошая база!",
    }
    return reinforcements.get(
        factor,
        f"✅ {factor.replace('_', ' ').capitalize()} помогает настроению ({impact}) — продолжай!"
    )


# ══════════════════════════════════════════════════════════════
# 4. Critical alerts
# ══════════════════════════════════════════════════════════════

def _critical_alerts(feats: Dict) -> List[str]:
    alerts: List[str] = []

    if feats.get("combo_triple_negative", 0) == 1.0:
        alerts.append(
            "🚨 КРИТИЧНО: мало воды + мало еды + мало белка одновременно. "
            "Это прямой путь к хроническому плохому самочувствию. "
            "Сегодня: 3 стакана воды, нормальный приём пищи с белком"
        )

    if feats.get("sleep_debt_hours_7d", 0) >= 8:
        alerts.append(
            f"🚨 Сонный долг {round(feats['sleep_debt_hours_7d'], 1)}ч за неделю — "
            "это серьёзно. Запланируй 3 ночи по 8–9ч подряд. "
            "Без этого никакие другие меры не дадут полного эффекта"
        )

    if feats.get("stress_critical_days_14d", 0) >= 5:
        alerts.append(
            f"🚨 {int(feats['stress_critical_days_14d'])} дней с критическим стрессом "
            "за 2 недели — хронический стресс. "
            "Поговори с кем-то или обратись к специалисту"
        )

    return alerts[:2]


# ══════════════════════════════════════════════════════════════
# 5. Learning correlations
# ══════════════════════════════════════════════════════════════

def _learning_correlations(data: HealthData) -> List[str]:
    recs: List[str] = []

    if data.sleep and data.mood and len(data.mood) >= 4:
        sleep_map = {str(getattr(r, "date", "")): _as_float(getattr(r, "duration_hours", 0)) for r in data.sleep}
        mood_map  = {str(getattr(r, "date", "")): _as_float(getattr(r, "mood_score", 0))    for r in data.mood}
        common    = sorted(set(sleep_map) & set(mood_map))

        if len(common) >= 4:
            corr = _safe_corr([sleep_map[d] for d in common], [mood_map[d] for d in common])
            if corr is not None:
                if corr > 0.5:
                    recs.append(
                        f"📈 Вижу сильную связь: твой сон напрямую влияет на настроение "
                        f"(корреляция {round(corr, 2)}). Сон — твой главный рычаг"
                    )
                elif corr > 0.3:
                    recs.append(
                        f"📈 Замечаю: когда спишь лучше — настроение выше "
                        f"(корреляция {round(corr, 2)})"
                    )

    if data.sleep and data.mood and len(data.mood) >= 5:
        sleep_map = {str(getattr(r, "date", "")): _as_float(getattr(r, "duration_hours", 0)) for r in data.sleep}
        mood_map  = {str(getattr(r, "date", "")): _as_float(getattr(r, "mood_score", 0))    for r in data.mood}

        pairs = []
        for d_str, sleep_val in sleep_map.items():
            try:
                next_d = (datetime.strptime(d_str, "%Y-%m-%d") + timedelta(days=1)).strftime("%Y-%m-%d")
                if next_d in mood_map:
                    pairs.append((sleep_val, mood_map[next_d]))
            except Exception:
                continue

        if len(pairs) >= 4:
            corr = _safe_corr([p[0] for p in pairs], [p[1] for p in pairs])
            if corr is not None and corr > 0.45:
                recs.append(
                    f"🔍 Сон влияет на настроение СЛЕДУЮЩЕГО дня "
                    f"(корреляция {round(corr, 2)}). "
                    "Ляжешь хорошо сегодня — завтра будет лучше"
                )

    if data.stress and data.mood and len(data.mood) >= 4:
        stress_map = {str(getattr(r, "date", "")): _as_float(getattr(r, "level", 0))     for r in data.stress}
        mood_map   = {str(getattr(r, "date", "")): _as_float(getattr(r, "mood_score", 0)) for r in data.mood}
        common     = sorted(set(stress_map) & set(mood_map))

        if len(common) >= 4:
            corr = _safe_corr([stress_map[d] for d in common], [mood_map[d] for d in common])
            if corr is not None and corr < -0.4:
                recs.append(
                    f"📉 Вижу закономерность: чем выше стресс — тем ниже настроение "
                    f"(корреляция {round(corr, 2)}). "
                    "Управление стрессом — твой приоритет"
                )

    return recs[:2]


# ══════════════════════════════════════════════════════════════
# 6. Pattern recommendations
# ══════════════════════════════════════════════════════════════

def _pattern_recommendations(data: HealthData) -> List[str]:
    recs: List[str] = []

    if data.mood and len(data.mood) >= 14:
        weekday_moods: Dict[int, List[float]] = {}
        for record in data.mood:
            try:
                wd    = datetime.strptime(str(getattr(record, "date", "")), "%Y-%m-%d").weekday()
                score = _as_float(getattr(record, "mood_score", 0))
                weekday_moods.setdefault(wd, []).append(score)
            except Exception:
                continue

        if len(weekday_moods) >= 5:
            avg_by_day = {d: np.mean(v) for d, v in weekday_moods.items() if len(v) >= 2}
            if len(avg_by_day) >= 3:
                best  = max(avg_by_day, key=avg_by_day.get)
                worst = min(avg_by_day, key=avg_by_day.get)
                if avg_by_day[best] - avg_by_day[worst] >= 1.5:
                    recs.append(
                        f"📅 Твой лучший день — {DAYS_RU[best]} "
                        f"({round(avg_by_day[best], 1)}/10), "
                        f"сложнее всего — {DAYS_RU[worst]} "
                        f"({round(avg_by_day[worst], 1)}/10). "
                        f"Планируй важные задачи на {DAYS_RU[best]}"
                    )

    if data.mood and len(data.mood) >= 7:
        scores = sorted(data.mood, key=lambda r: str(getattr(r, "date", "")))
        recent = [_as_float(getattr(r, "mood_score", 0)) for r in scores[-7:]]
        older  = [_as_float(getattr(r, "mood_score", 0)) for r in scores[-14:-7]] if len(scores) >= 14 else []

        if older:
            delta = np.mean(recent) - np.mean(older)
            if delta >= 1.0:
                recs.append(
                    f"📈 Настроение за последние 7 дней выросло на {round(delta, 1)} пункта "
                    "по сравнению с предыдущей неделей. Ты на правильном пути!"
                )
            elif delta <= -1.0:
                recs.append(
                    f"📉 Настроение за последнюю неделю снизилось на {round(abs(delta), 1)} пункта. "
                    "Посмотри что изменилось: сон, стресс, активность?"
                )

    return recs[:2]


# ══════════════════════════════════════════════════════════════
# Utilities
# ══════════════════════════════════════════════════════════════

def _safe_corr(a: List[float], b: List[float]) -> Optional[float]:
    try:
        arr_a, arr_b = np.array(a, dtype=float), np.array(b, dtype=float)
        if np.std(arr_a) < 0.01 or np.std(arr_b) < 0.01:
            return None
        c = np.corrcoef(arr_a, arr_b)[0][1]
        return float(c) if np.isfinite(c) else None
    except Exception:
        return None


def _as_float(v: Any, default: float = 0.0) -> float:
    try:
        return float(v) if v is not None else default
    except Exception:
        return default


def _deduplicate(recs: List[str]) -> List[str]:
    seen: set[str] = set()
    result: List[str] = []
    for r in recs:
        key = r[:60]
        if key not in seen:
            seen.add(key)
            result.append(r)
    return result
