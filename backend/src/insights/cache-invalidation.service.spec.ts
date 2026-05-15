// backend/src/insights/cache-invalidation.service.spec.ts
//
// Юнит-тесты CacheInvalidationService.invalidate() — фокус на новой
// логике retrain-throttle:
//   • predict-кэш всегда удаляется при любом обновлении метрики;
//   • train-кэш НЕ удаляется на каждый POST — копится счётчик
//     retrain_pending; train сбрасывается только когда счётчик
//     достигает RETRAIN_RECORDS_THRESHOLD (5).
//
// Гамификацию и репозитории не трогаем — invalidate() их не вызывает.

import { CacheInvalidationService } from './cache-invalidation.service'

/** In-memory мок cache-manager Cache: поддерживает get/set/del. */
function buildMockCache() {
  const store = new Map<string, unknown>()
  return {
    store,
    cache: {
      get:  jest.fn(async (key: string) => store.get(key)),
      set:  jest.fn(async (key: string, value: unknown) => { store.set(key, value) }),
      del:  jest.fn(async (key: string) => { store.delete(key) }),
    } as unknown as import('cache-manager').Cache,
  }
}

function buildService(cache: import('cache-manager').Cache): CacheInvalidationService {
  // Конструктор требует Repository<...> и GamificationService,
  // но invalidate() их не использует — передаём заглушки.
  const noop = {} as unknown
  return new CacheInvalidationService(
    cache,
    noop as never,  // gamification
    noop as never, noop as never, noop as never,  // sleep/stress/mood
    noop as never, noop as never, noop as never,  // activity/water/nutrition
  )
}

describe('CacheInvalidationService.invalidate (retrain throttle)', () => {
  const userId = 'u1'

  it('удаляет predict-кэш при каждой инвалидации', async () => {
    const { cache, store } = buildMockCache()
    store.set(`predict:${userId}`, { fake: true })
    store.set(`train:${userId}`,   { fake: true })

    const svc = buildService(cache)
    await svc.invalidate(userId)

    expect(store.has(`predict:${userId}`)).toBe(false)
  })

  it('сохраняет train-кэш на 1–4 инвалидации, копит retrain_pending', async () => {
    const { cache, store } = buildMockCache()
    store.set(`train:${userId}`, { fake: true })

    const svc = buildService(cache)

    for (let i = 0; i < 4; i++) {
      await svc.invalidate(userId)
    }

    expect(store.has(`train:${userId}`)).toBe(true)
    expect(store.get(`retrain_pending:${userId}`)).toBe(4)
  })

  it('форсирует retrain на 5-й инвалидации и обнуляет счётчик', async () => {
    const { cache, store } = buildMockCache()
    store.set(`train:${userId}`, { fake: true })

    const svc = buildService(cache)

    for (let i = 0; i < 5; i++) {
      await svc.invalidate(userId)
    }

    expect(store.has(`train:${userId}`)).toBe(false)
    expect(store.has(`retrain_pending:${userId}`)).toBe(false)
  })

  it('после форсирования retrain счётчик копится заново', async () => {
    const { cache, store } = buildMockCache()
    store.set(`train:${userId}`, { fake: true })
    const svc = buildService(cache)

    // 5 инвалидаций → train очищен
    for (let i = 0; i < 5; i++) await svc.invalidate(userId)
    // Симулируем что после next getInsights train-кэш заполнился снова
    store.set(`train:${userId}`, { fake: true })

    // Ещё одна инвалидация — train должен остаться, счётчик = 1
    await svc.invalidate(userId)
    expect(store.has(`train:${userId}`)).toBe(true)
    expect(store.get(`retrain_pending:${userId}`)).toBe(1)
  })

  it('rotates metric_updated_at timestamp при каждой инвалидации', async () => {
    const { cache, store } = buildMockCache()
    const svc = buildService(cache)

    const before = Date.now()
    await svc.invalidate(userId)
    const ts = store.get(`metric_updated_at:${userId}`) as number
    expect(typeof ts).toBe('number')
    expect(ts).toBeGreaterThanOrEqual(before)
  })
})
