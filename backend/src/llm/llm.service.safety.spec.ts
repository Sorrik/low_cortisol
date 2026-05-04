/**
 * Узкий тест на safety-постпроцессинг LlmService:
 *   - PMID validation: маркеры [N] для несуществующих в RAG индексов вырезаются.
 *   - Danger-pattern filter: опасные советы (лекарства/голодание/экстремальные
 *     тренировки/отказ от воды) подменяются безопасным шаблоном.
 *
 * Проверяем приватные методы через каст к any. Это компромисс: вытаскивать
 * их в отдельный модуль ради юнит-тестов — лишняя индирекция; для health-app
 * критично иметь работающий тест прямо здесь.
 */

import { LlmService } from './llm.service'
import { RecommendationDto } from '../ml/dto/ml-response.dto'

// Минимальная инстанциация: сервис принимает ConfigService и RagService через
// конструктор, но обе зависимости в тестируемых методах не используются.
function makeService(): LlmService {
  // OpenAI клиент при new создаётся в конструкторе и требует apiKey;
  // даём фейковый — реальный API не дёргаем, тестируем только приватные
  // safety-методы.
  const cfg: any = {
    get: (key: string, fallback?: any) => {
      if (key === 'OPENAI_API_KEY') return 'test-key'
      return fallback
    },
  }
  const rag: any = {}
  return new LlmService(cfg, rag)
}

const baseRec = (overrides: Partial<RecommendationDto> = {}): RecommendationDto => ({
  metric:      'sleep',
  severity:    'attention',
  title:       'Sample',
  description: 'Sample description',
  ...overrides,
})

describe('LlmService safety post-processing', () => {
  describe('_stripUnknownPmidRefs', () => {
    it('сохраняет валидные ссылки [1], [2] когда retrieved-список 2 статьи', () => {
      const svc = makeService() as any
      const allowed = new Set(['100', '200'])
      const recs = [
        baseRec({ description: 'См. исследование [1] и [2] про сон' }),
      ]
      const out = svc._stripUnknownPmidRefs(recs, allowed)
      expect(out[0].description).toContain('[1]')
      expect(out[0].description).toContain('[2]')
    })

    it('вырезает несуществующие [7] при retrieved=3', () => {
      const svc = makeService() as any
      const allowed = new Set(['100', '200', '300'])
      const recs = [
        baseRec({ description: 'Согласно [7] нужно больше воды.' }),
      ]
      const out = svc._stripUnknownPmidRefs(recs, allowed)
      expect(out[0].description).not.toContain('[7]')
      expect(out[0].description).toMatch(/Согласно\s+нужно/)
    })

    it('возвращает тот же объект без изменений если ссылок нет', () => {
      const svc = makeService() as any
      const allowed = new Set(['100'])
      const orig = baseRec({ description: 'Простой совет без ссылок' })
      const out = svc._stripUnknownPmidRefs([orig], allowed)
      expect(out[0]).toBe(orig)
    })
  })

  describe('_filterDangerousAdvice', () => {
    const cases: { name: string; bad: string }[] = [
      { name: 'голодание',       bad: 'Попробуй голодай 3 дня — это поможет' },
      { name: 'таблетки',        bad: 'Прими таблетки от стресса перед сном' },
      { name: 'витамины',        bad: 'Купи витамины группы B на ночь' },
      { name: 'отказ от воды',   bad: 'Прекрати пить воду после 18:00' },
      { name: 'тренировки 3ч',   bad: 'Тренируйся больше 3 часов каждый день' },
      { name: 'пропуск еды',     bad: 'Пропусти приём пищи вечером' },
      { name: 'отмена лекарств', bad: 'Прекрати принимать лекарства от давления' },
    ]

    it.each(cases)('блокирует: $name', ({ bad }) => {
      const svc = makeService() as any
      const out: RecommendationDto[] = svc._filterDangerousAdvice([baseRec({ description: bad })])
      expect(out[0].description).not.toEqual(bad)
      expect(out[0].title).toMatch(/специалист/i)
      expect(out[0].description).toMatch(/специалист|врач|консульт/i)
    })

    it('понижает severity с alert до attention при блокировке', () => {
      const svc = makeService() as any
      const out: RecommendationDto[] = svc._filterDangerousAdvice([
        baseRec({ severity: 'alert', description: 'Пропусти приём пищи' }),
      ])
      expect(out[0].severity).toBe('attention')
    })

    it('не трогает безопасные советы', () => {
      const svc = makeService() as any
      const safe = baseRec({
        description: 'Выпей 2 стакана воды до обеда — мозг получит топливо для серотонина.',
      })
      const out: RecommendationDto[] = svc._filterDangerousAdvice([safe])
      expect(out[0]).toBe(safe)
    })

    it('обнаруживает опасный текст в title, не только в description', () => {
      const svc = makeService() as any
      const out: RecommendationDto[] = svc._filterDangerousAdvice([
        baseRec({
          title: 'Прими витамин D перед сном',
          description: 'Полезно для иммунитета',
        }),
      ])
      expect(out[0].title).toMatch(/специалист/i)
    })
  })
})
