import { buildRecommendationPrompt, copiesPolishExample } from './prompt-builder'
import { LlmService } from './llm.service'
import { computeSeverityBounds, criticalMetrics } from './severity-bounds'
import { buildRagTopics, decodeHtmlEntities } from '../rag/rag.service'

const day = (n: number) => `2026-10-${String(n).padStart(2, '0')}`
const lastWeek = [1, 2, 3, 4, 5, 6, 7]

// Сон, настроение и вода в норме, а калорий примерно на 35% меньше нормы.
const healthData = (calories = 1398.6): any => ({
  sleep: lastWeek.map((d) => ({ date: day(d), duration_hours: 8.6, quality: 8 })),
  mood: lastWeek.map((d) => ({ date: day(d), mood_score: 7.6 })),
  stress: lastWeek.map((d) => ({ date: day(d), level: 3 })),
  activity: lastWeek.map((d) => ({ date: day(d), duration_minutes: 40, intensity: 'moderate' })),
  water: lastWeek.map((d) => ({ date: day(d), amount_ml: 2200 })),
  nutrition: lastWeek.map((d) => ({
    date: day(d),
    calories,
    protein_grams: 90,
    carbs_grams: 150,
    fat_grams: 50,
  })),
  _user_profile: {
    primary_goal: 'general',
    sleep_goal_hours: 8,
    chronotype: 'intermediate',
    activity_level: 'moderate',
    baseline_stress: 5,
    weekly_training_min: 0,
    sport_goal: null,
    target_calories: 2168,
    target_protein_g: 60,
    target_water_ml: 1800,
  },
})

const article = (pmid: string, metric: string) => ({
  pmid,
  metric,
  title: `Article ${pmid}`,
  abstract: 'abstract',
  year: '2020',
  url: '',
  relevance: 0.9,
})

const rec = (metric: string, severity: string, description = 'Текст', extra = {}) => ({
  metric,
  severity,
  title: 'Заголовок',
  description,
  ...extra,
})

const service = (): any =>
  new LlmService(
    { get: (key: string, fallback?: unknown) => (key === 'OPENAI_API_KEY' ? 'test-key' : fallback) } as any,
    {} as any,
  )

/** Сервис, который на каждый запрос к LLM отдаёт следующий ответ из списка. */
const withReplies = (...contents: unknown[]) => {
  const svc = service()
  const create = jest.fn()
  for (const content of contents) {
    if (content instanceof Error) create.mockRejectedValueOnce(content)
    else create.mockResolvedValueOnce({ choices: [{ message: { content: JSON.stringify(content) } }] })
  }
  svc.client = { chat: { completions: { create } } }
  return { svc, create }
}

describe('Severity bounds', () => {
  it('считает средние только за последние 7 дней с данными', () => {
    const data = healthData()
    const oldDays = [20, 21, 22].map((d) => ({ date: `2026-09-${d}`, calories: 4000, protein_grams: 90 }))
    data.nutrition = [...oldDays, ...data.nutrition]
    expect(computeSeverityBounds(data).averages.calories).toBeCloseTo(1398.6)
  })

  it('суммирует несколько приёмов пищи за день', () => {
    const data = healthData()
    data.nutrition = data.nutrition.flatMap((r: any) => [
      { ...r, calories: 700 },
      { ...r, calories: 700 },
    ])
    expect(computeSeverityBounds(data).averages.calories).toBe(1400)
  })

  it('не даёт назвать хорошими повышенный стресс и короткий сон', () => {
    const data = healthData()
    data.stress = data.stress.map((r: any) => ({ ...r, level: 6.4 }))
    data.sleep = data.sleep.map((r: any) => ({ ...r, duration_hours: 6.5 }))
    const { floor } = computeSeverityBounds(data)
    expect(floor.stress).toBe('attention')
    expect(floor.sleep).toBe('attention')
  })

  it('отмечает критичной только метрику с большим отклонением', () => {
    expect(criticalMetrics(computeSeverityBounds(healthData()))).toEqual(['food'])
    expect(criticalMetrics(computeSeverityBounds(healthData(2100)))).toEqual([])
  })
})

describe('Критичные карточки', () => {
  it('добавляет карточку, если LLM пропустила критичную метрику', () => {
    const result = service()._ensureCriticalCards([rec('sleep', 'good')], healthData())
    const food = result.find((r: any) => r.metric === 'food')
    expect(food.severity).toBe('alert')
    expect(food.description).toContain('1400')
    expect(food.description).not.toContain('1398.6')
  })

  it('заменяет похвалу критичной метрики', () => {
    const result = service()._ensureCriticalCards([rec('food', 'good', 'Отлично!')], healthData())
    expect(result).toHaveLength(1)
    expect(result[0].severity).toBe('alert')
    expect(result[0].description).not.toContain('Отлично')
  })

  it('оставляет текст LLM, если проблема уже описана', () => {
    const own = rec('food', 'attention', 'Текст модели')
    expect(service()._ensureCriticalCards([own], healthData())).toEqual([own])
  })

  it('ничего не добавляет, когда критичных метрик нет', () => {
    expect(service()._ensureCriticalCards([rec('sleep', 'good')], healthData(2100))).toHaveLength(1)
  })

  it('ставит критичные карточки первыми', () => {
    const sorted = service()._sortBySeverity([
      rec('sleep', 'good'),
      rec('water', 'attention'),
      rec('food', 'alert'),
    ])
    expect(sorted.map((r: any) => r.severity)).toEqual(['alert', 'attention', 'good'])
  })
})

describe('Подбор статей', () => {
  const context = (overrides = {}) => ({
    avgSleepHours: 8.5,
    avgStress: 3,
    avgMood: 7.5,
    avgActivityMinutes: 40,
    avgWaterGlasses: 9,
    avgCalories: 2100,
    avgProteinGrams: 80,
    calorieDeficit: 0,
    proteinDeficit: 0,
    waterDeficit: 0,
    sleepGoalHours: 8,
    ...overrides,
  })

  it('ищет статьи о питании по личной норме, даже если калорий много в абсолютных числах', () => {
    const [first] = buildRagTopics(context({ avgCalories: 1880, calorieDeficit: 0.37 }))
    expect(first.metric).toBe('food')
    expect(first.query).toContain('low energy')
  })

  it('ставит самую серьёзную проблему первой и не теряет остальные', () => {
    const topics = buildRagTopics(
      context({ calorieDeficit: 0.4, waterDeficit: 0.5, avgSleepHours: 6, avgStress: 6 }),
    )
    expect(topics.map((t) => t.metric)).toEqual(['water', 'food', 'sleep', 'stress'])
  })

  it('берёт темы о поддержании привычек, когда всё в норме', () => {
    expect(buildRagTopics(context()).map((t) => t.metric)).toEqual(['sleep', 'activity', 'mood'])
  })

  it('декодирует HTML-сущности в заголовках', () => {
    expect(decodeHtmlEntities('hippocampal A&#x3b2;-42 &amp; sleep')).toBe('hippocampal Aβ-42 & sleep')
    expect(decodeHtmlEntities('A&#946;')).toBe('Aβ')
    expect(decodeHtmlEntities('no entities')).toBe('no entities')
  })
})

describe('Ссылки на статьи', () => {
  const articles = [article('1', 'sleep'), article('2', 'food'), article('3', 'food')]

  it('убирает маркеры основной генерации', () => {
    const [card] = service()._removeCitations([rec('food', 'alert', 'Добавь перекус [1].')])
    expect(card.description).toBe('Добавь перекус.')
  })

  it('показывает модели только статьи той же темы', async () => {
    const { svc, create } = withReplies({ cards: [{ source: 2 }] })
    await svc._selectCitations([rec('food', 'alert')], articles)
    const { articles: offered } = JSON.parse(create.mock.calls[0][0].messages[1].content)[0]
    expect(offered.map((a: any) => a.id)).toEqual([2, 3])
  })

  it('отклоняет статью не из списка карточки', async () => {
    const { svc } = withReplies({ cards: [{ source: 1 }] })
    expect(await svc._selectCitations([rec('food', 'alert')], articles)).toEqual([null])
  })

  it('показывает все статьи для настроения и карточек с цепочкой', async () => {
    const { svc, create } = withReplies({ cards: [{ source: 1 }, { source: 1 }] })
    const result = await svc._selectCitations(
      [rec('mood', 'good'), rec('food', 'alert', 'Текст', { causal_chain: { chain_id: 'A1' } })],
      articles,
    )
    expect(result).toEqual([1, 1])
    expect(JSON.parse(create.mock.calls[0][0].messages[1].content)[0].articles).toHaveLength(3)
  })

  it('не вызывает модель, если для карточек нет статей', async () => {
    const { svc, create } = withReplies()
    expect(await svc._selectCitations([rec('water', 'alert')], articles)).toEqual([null])
    expect(create).not.toHaveBeenCalled()
  })

  it('работает без ссылок при сбое модели', async () => {
    const { svc } = withReplies(new Error('timeout'))
    expect(await svc._selectCitations([rec('food', 'alert')], articles)).toEqual([null])
  })

  it('ставит маркер после первого предложения и не ломает дробные числа', () => {
    const [card] = service()._attachCitations(
      [rec('sleep', 'alert', 'Около 5.8 ч вместо 8. Ложись раньше.')],
      [1],
    )
    expect(card.description).toBe('Около 5.8 ч вместо 8. [1] Ложись раньше.')
  })

  it('не ставит маркер на заблокированную карточку', () => {
    const blocked = { ...rec('sleep', 'alert'), title: 'Совет требует обсуждения со специалистом' }
    expect(service()._attachCitations([blocked], [1])).toEqual([blocked])
  })

  it('оставляет в источниках только процитированное и нумерует заново', () => {
    const result = service()._renumberCitations(
      [rec('food', 'alert', 'Первое [3]. Второе [2]. Снова [3].'), rec('sleep', 'attention')],
      articles,
    )
    expect(result.recommendations[0].description).toBe('Первое [1]. Второе [2]. Снова [1].')
    expect(result.articles.map((a: any) => a.pmid)).toEqual(['3', '2'])
  })

  it('возвращает пустые источники, если ссылок нет', () => {
    expect(service()._renumberCitations([rec('sleep', 'attention')], articles).articles).toEqual([])
  })
})

describe('Шаг стиля', () => {
  const original = rec('food', 'attention', 'Около 1500 ккал при норме 2170.')
  const reply = (description: string, title = 'Еды меньше нормы') => ({ cards: [{ title, description }] })
  const clean = reply('Выходит около 1500 ккал вместо 2170. Добавь перекус.')

  it('применяет новый текст, если он прошёл проверку', async () => {
    const { svc, create } = withReplies(clean)
    const [card] = await svc._polishCards([original])
    expect(card.title).toBe('Еды меньше нормы')
    expect(card.description).toContain('Добавь перекус')
    expect(card.severity).toBe('attention')
    expect(create).toHaveBeenCalledTimes(1)
  })

  it.each([
    ['новое число', 'Около 1500 ккал при норме 2170, это на 30 процентов меньше.', 'новое число 30'],
    ['потерю всех чисел', 'Еды маловато. Добавь перекус.', 'пропали все исходные числа'],
    ['штамп', 'Около 1500 ккал при норме 2170. Продолжай в том же духе!', 'в том же духе'],
    ['слово с указанием рода', 'Около 1500 ккал при норме 2170, как ты запланировал.', 'указанием рода'],
    ['род без местоимения', 'Около 1500 ккал при норме 2170, меньше, чем планировала.', 'указанием рода'],
    ['фразу из образца', 'Около 1500 ккал при норме 2170. Похоже, бутылка всегда под рукой.', 'образца'],
  ])('отправляет на второй проход за %s и передаёт причину', async (_name, description, reason) => {
    const { svc, create } = withReplies(reply(description), clean)
    const [card] = await svc._polishCards([original])
    expect(card.description).toContain('Добавь перекус')
    expect(create).toHaveBeenCalledTimes(2)
    const [retry] = JSON.parse(create.mock.calls[1][0].messages[1].content)
    expect(retry.previous_problem).toContain(reason)
  })

  it('отклоняет заголовок из образца', async () => {
    const { svc, create } = withReplies(reply('Выходит около 1500 ккал вместо 2170.', 'Тарелка пока пустовата'), clean)
    const [card] = await svc._polishCards([original])
    expect(card.title).toBe('Еды меньше нормы')
    expect(create).toHaveBeenCalledTimes(2)
  })

  it('повторяет только отклонённые карточки', async () => {
    const second = rec('sleep', 'attention', 'Около 7 ч при норме 8.')
    const first = reply('Около 1500 ккал при норме 2170. Так держать!').cards[0]
    const { svc, create } = withReplies(
      { cards: [first, { title: 'Ночи короче', description: 'Выходит 7 ч вместо 8.' }] },
      clean,
    )
    const cards = await svc._polishCards([original, second])
    expect(cards[1].title).toBe('Ночи короче')
    expect(cards[0].description).toContain('Добавь перекус')
    expect(JSON.parse(create.mock.calls[1][0].messages[1].content)).toHaveLength(1)
  })

  it('оставляет чистый исходный текст, если оба прохода отклонены или модель недоступна', async () => {
    const bad = reply('Около 1500 ккал. Так держать!')
    expect(await withReplies(bad, bad).svc._polishCards([original])).toEqual([original])
    expect(await withReplies(new Error('timeout')).svc._polishCards([original])).toEqual([original])
    expect(await withReplies({ cards: [] }).svc._polishCards([original])).toEqual([original])
  })

  it('заменяет хорошую карточку со штампом шаблоном', async () => {
    const stamped = rec('sleep', 'good', 'Около 8.6 ч. Продолжай в том же духе!')
    const { svc } = withReplies(new Error('timeout'))
    const [card] = await svc._polishCards([stamped], healthData())
    expect(card.description).not.toMatch(/в том же духе/)
    expect(card.description).toContain('8.6')
  })

  it('заменяет карточку «можно подтянуть» со штампом запасным текстом', async () => {
    const stamped = { ...rec('sleep', 'attention', 'В среднем 7 ч.'), title: 'Сон ниже нормы' }
    const data = healthData()
    data.sleep = data.sleep.map((r: any) => ({ ...r, duration_hours: 7 }))
    const { svc } = withReplies(new Error('timeout'))
    const [card] = await svc._polishCards([stamped], data)
    expect(card.description).not.toMatch(/в среднем/i)
    expect(card.description).toContain('7.0')
  })

  it('использует текст сервера для критичной карточки', async () => {
    const critical = { ...rec('food', 'alert', 'Около 1400 ккал при норме 2170.'), title: 'Недостаток калорий' }
    const bad = reply('Еды меньше на 35 процентов.')
    const { svc } = withReplies(bad, bad)
    const [card] = await svc._polishCards([critical], healthData())
    expect(card.title).toBe('Еды заметно меньше твоей нормы')
    expect(card.description).toContain('1400')
  })

  it('распознаёт копирование образца независимо от чисел', () => {
    expect(copiesPolishExample('Свой заголовок', 'До твоей нормы не хватает около 1110 ккал в день.')).toBe(true)
    expect(copiesPolishExample('Вода уже стала привычкой!', 'Свой текст.')).toBe(true)
    expect(copiesPolishExample('Свой заголовок', 'Свой текст про воду.')).toBe(false)
  })
})

describe('Промпт рекомендаций', () => {
  const build = (calories?: number) => JSON.parse(buildRecommendationPrompt(healthData(calories)))

  it('передаёт округлённые калории и обязательную тему', () => {
    const { user } = build()
    expect(user).toContain('около 1400 ккал/день')
    expect(user).toContain('около 2170 ккал/день')
    expect(user).toContain('ОБЯЗАТЕЛЬНЫЕ ТЕМЫ')
    expect(user).toContain('не хватает примерно 770')
    expect(user).not.toContain('1398.6')
  })

  it('не добавляет раздел, если критичных тем нет', () => {
    expect(build(2100).user).not.toContain('ОБЯЗАТЕЛЬНЫЕ ТЕМЫ')
  })

  it('не содержит примеров с указанием рода', () => {
    expect(build().system).not.toMatch(/Похоже, ты нашла|«ты нашла ритм/)
  })
})
