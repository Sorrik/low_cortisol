import { validate } from 'class-validator'
import { IsRecentDate } from './is-recent-date'

class Sample {
  @IsRecentDate()
  date!: string
}

class SampleShortWindow {
  @IsRecentDate({ maxDaysInPast: 7 })
  date!: string
}

const today = (): string => new Date().toISOString().slice(0, 10)
const ago = (days: number): string => {
  const d = new Date()
  d.setDate(d.getDate() - days)
  return d.toISOString().slice(0, 10)
}
const future = (days: number): string => {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

describe('IsRecentDate', () => {
  it('пропускает сегодняшнюю дату', async () => {
    const o = new Sample(); o.date = today()
    expect(await validate(o)).toHaveLength(0)
  })

  it('пропускает дату 30 дней назад', async () => {
    const o = new Sample(); o.date = ago(30)
    expect(await validate(o)).toHaveLength(0)
  })

  it('отклоняет завтрашнюю дату', async () => {
    const o = new Sample(); o.date = future(1)
    expect(await validate(o)).toHaveLength(1)
  })

  it('отклоняет дату 5 лет вперёд', async () => {
    const o = new Sample(); o.date = '2099-12-31'
    expect(await validate(o)).toHaveLength(1)
  })

  it('отклоняет дату старше 365 дней', async () => {
    const o = new Sample(); o.date = ago(400)
    expect(await validate(o)).toHaveLength(1)
  })

  it('отклоняет 1900-01-01', async () => {
    const o = new Sample(); o.date = '1900-01-01'
    expect(await validate(o)).toHaveLength(1)
  })

  it('отклоняет невалидный формат YYYY-MM-DD', async () => {
    for (const bad of ['2026/02/19', '02-19-2026', '2026-2-19', '20260219', 'today']) {
      const o = new Sample(); o.date = bad
      expect((await validate(o)).length).toBeGreaterThan(0)
    }
  })

  it('кастомный maxDaysInPast=7 отклоняет дату 10 дней назад', async () => {
    const o = new SampleShortWindow(); o.date = ago(10)
    expect(await validate(o)).toHaveLength(1)
  })

  it('кастомный maxDaysInPast=7 пропускает дату 5 дней назад', async () => {
    const o = new SampleShortWindow(); o.date = ago(5)
    expect(await validate(o)).toHaveLength(0)
  })
})
