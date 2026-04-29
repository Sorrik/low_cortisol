# Block Diagram Of Recommendation Pipeline

Ниже приведена блок-схема работы системы рекомендаций. Ее можно вставлять в курсовую как описание технического контура формирования персональных рекомендаций.

```mermaid
flowchart TD
    A["Web / Mobile client"] --> B["GET /insights/me"]
    B --> C["NestJS backend: InsightsService"]

    C --> D["Load health history<br/>sleep, mood, stress, activity, water, nutrition"]
    C --> E["Load user profile<br/>goals, sleep norm, stress baseline, activity level"]

    D --> F["Aggregate last 35 days<br/>for ML and trend analysis"]
    E --> F

    F --> G["Anomaly detection<br/>critical gaps, abnormal values, data quality"]
    F --> H["MetricsAdapter + Rule Engine<br/>deterministic recommendations"]

    H --> I{"Predict cache hit?"}
    I -- "Yes" --> Q["Return cached response<br/>+ fresh rule alerts + anomalies"]
    I -- "No" --> J{"Train cache hit?"}

    J -- "No" --> K["POST /train -> FastAPI ml-service"]
    J -- "Yes" --> L["POST /predict -> FastAPI ml-service"]
    K --> L

    L --> M["Feature engineering<br/>time-series features, behavior patterns"]
    M --> N["Mood prediction model<br/>Ridge or Gradient Boosting"]
    N --> O["Explainability<br/>top influencers / SHAP-style factors"]

    O --> P["Compose ML result<br/>prediction, confidence, phase, factors"]

    H --> R["Build LLM context<br/>7-day metrics + rules + anomalies + user profile"]
    P --> R

    R --> S["RAG service"]
    S --> T["ChromaDB search"]
    T --> U["Relevant scientific articles"]

    R --> V["OpenAI LLM"]
    U --> V
    V --> W["Structured JSON recommendations"]

    W --> X{"LLM available?"}
    X -- "Yes" --> Y["LLM recommendations"]
    X -- "No" --> Z["Fallback to ML or rule-based recommendations"]

    Y --> AA["Merge final response<br/>recommendations + sources + ML + rules + anomalies"]
    Z --> AA

    AA --> AB["Cache response"]
    AB --> AC["Return to client"]
```

Короткое пояснение для текста отчета:

1. Клиент запрашивает `GET /insights/me`.
2. Backend собирает историю данных пользователя и его профиль.
3. На backend рассчитываются аномалии и rule-based рекомендации.
4. Далее backend обращается к `ml-service` для обучения при необходимости и для предсказания настроения.
5. ML-слой строит признаки, вычисляет прогноз и факторы влияния.
6. Backend формирует расширенный контекст для LLM, включая правила, метрики, профиль и ML-факторы.
7. RAG-слой при наличии получает релевантные научные статьи из `ChromaDB`.
8. LLM формирует персональные рекомендации в структурированном JSON.
9. Если LLM или ML недоступны, система деградирует в fallback-режим и использует rule-based или ML-советы.
10. Итоговый ответ кэшируется и возвращается в web/mobile клиент.
