# Low Cortisol

Система собирает данные о сне, настроении, стрессе, активности, воде и питании и находит связи между ними. На этой основе она строит личный прогноз настроения и объясняет, какие факторы на него повлияли. Рекомендации опираются на правила, персональную ML-модель и LLM со ссылками на научные статьи PubMed.

Это выпускная квалификационная работа, МГТУ им. Н. Э. Баумана, 2026.

*English summary: a multimodal health-tracking system with a NestJS API, a FastAPI ML service, personal mood models with SHAP explanations, and LLM recommendations backed by RAG over PubMed. It runs with one Docker Compose command and works without paid API keys in demo mode.*






<img width="2199" height="1286" alt="{A95A97D1-EB4F-4020-91A2-151A32061183}" src="https://github.com/user-attachments/assets/0fcaeb39-bdfa-437b-9591-e33c67b389cb" />

<img width="2036" height="1285" alt="{F1D647A1-1EE4-4616-94EB-D304E68C204D}" src="https://github.com/user-attachments/assets/bb745afd-3341-4d31-9819-ee0227078cdb" />

<img width="2002" height="1278" alt="{CB393852-AD29-4C91-B2E6-D1D608E9AD3E}" src="https://github.com/user-attachments/assets/db74c8d1-ca35-460c-978b-780179f01411" />

<img width="1941" height="1286" alt="{4DA263EB-7BE3-44FA-850C-F1308229DB7C}" src="https://github.com/user-attachments/assets/607fdd12-81e9-462e-a913-c210083d8578" />


## Архитектура

```mermaid
flowchart LR
    Web["Веб-клиент<br/>Next.js"] -->|REST + JWT| API
    Mobile["Мобильное приложение<br/>Expo"] -->|REST + JWT| API

    subgraph Server["Серверная часть"]
        API["Основной сервер<br/>NestJS"]
        ML["ML-сервис<br/>FastAPI"]
        DB[("PostgreSQL<br/>пользователи и метрики")]
        Vector[("ChromaDB<br/>статьи PubMed")]
        Models[("Файлы<br/>личные модели")]
    end

    API --> DB
    API --> Vector
    API -->|REST| ML
    ML --> Models
    API -->|OpenAI-совместимый API| LLM["LLM и эмбеддинги"]
    API --> Food["FatSecret и Open Food Facts"]
```

Как формируется рекомендация:

1. Основной сервер собирает метрики пользователя из PostgreSQL.
2. Правила и детектор причинно-следственных цепочек находят проблемы и закономерности.
3. ML-сервис обучает личную модель и возвращает прогноз настроения с вкладом факторов по SHAP.
4. RAG подбирает подходящие статьи PubMed.
5. LLM формирует текст рекомендаций, а сервер проверяет ссылки на статьи и опасные формулировки.

Если ML-сервис или LLM недоступны, пользователь всё равно получает рекомендации по правилам.

Подробный разбор с числовым примером находится в [docs/recommendation-flow-diagram.md](docs/recommendation-flow-diagram.md).

## Стек

| Часть | Технологии |
|---|---|
| Основной сервер | NestJS, TypeScript, TypeORM, ts-rest, JWT, Pino |
| ML-сервис | Python, FastAPI, scikit-learn (Ridge, Gradient Boosting), SHAP, faster-whisper |
| Данные | PostgreSQL 16, ChromaDB |
| Веб-клиент | Next.js, React, TypeScript |
| Мобильное приложение | Expo, React Native |
| LLM | OpenAI-совместимый API, Structured Outputs, RAG |
| Инфраструктура | Docker Compose, pnpm workspaces |

## Запуск

Нужен Docker с Docker Compose. Для первой сборки требуется несколько гигабайт на диске.

```bash
git clone https://github.com/Sorrik/low_cortisol.git
cd low_cortisol
cp .env.example .env
docker compose up -d --build
docker compose exec backend pnpm seed:demo
```

| Адрес | Что открывается |
|---|---|
| http://localhost:3001 | Веб-клиент |
| http://localhost:3000/api/docs | Swagger основного сервера |
| http://localhost:8000/docs | Swagger ML-сервиса |

Демо-пользователи синтетические, у всех пароль `Test1234!`. Попробуйте `masha@test.local`, `andrey@test.local` или `dima@test.local`, всего их десять, список есть в [seed-test-users.ts](backend/src/seed/seed-test-users.ts).

### Демо-режим и полный режим

Без `OPENAI_API_KEY` работают метрики, правила, ML-прогноз и SHAP. Текст от LLM, RAG, распознавание еды по фото и голосовое заполнение форм отключены.

Чтобы включить всё, укажите ключ в `.env` и загрузите статьи. Скрипт скачивает их из PubMed и считает эмбеддинги, это платный вызов API.

```bash
docker compose up -d backend
docker compose exec backend pnpm seed:rag
docker compose restart backend
```

### Мобильное приложение

Телефон должен быть в одной сети с компьютером. В `mobile/.env` укажите адрес компьютера в локальной сети.

```bash
cd mobile
cp .env.example .env
npm ci
npm start
```

## Примеры запросов

```bash
# Вход
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"masha@test.local","password":"Test1234!"}'

# Прогноз, факторы и рекомендации
curl http://localhost:3000/insights/me \
  -H "Authorization: Bearer <access_token>"
```

Сокращённый ответ `GET /insights/me`:

```json
{
  "phase": { "mode": "learning", "total_records": 14, "records_needed": 36 },
  "predicted_mood": 8.1,
  "confidence_lower": 7.3,
  "confidence_upper": 8.9,
  "top_influencers": [
    { "factor": "dow_cos", "impact": 0.04, "direction": "positive", "description": "День недели улучшает настроение на 0.04" }
  ],
  "recommendations": [ "..." ]
}
```

## Тесты

```bash
# Основной сервер: юнит-тесты и e2e авторизации
corepack enable
pnpm install
pnpm test

# ML-сервис
docker compose exec ml-service pytest
```

## Данные и лицензия

Все пользователи и метрики в проекте синтетические. Обученные модели и тексты статей PubMed не хранятся в репозитории. Модели создаются во время работы, а статьи скачиваются скриптом.

Лицензия не указана: код открыт для просмотра, но все права на него сохраняются за автором.
