// backend/src/common/validators/is-recent-date.ts
//
// Кастомный class-validator decorator: дата строкой `YYYY-MM-DD`,
// не в будущем и не старше N дней назад. Используется во всех metric-DTO,
// чтобы валидация была однообразной (без него каждая DTO повторяла бы
// проверки в разных стилях).

import {
  registerDecorator,
  ValidationArguments,
  ValidationOptions,
} from 'class-validator'

const ONE_DAY_MS = 24 * 60 * 60 * 1000

export interface IsRecentDateOptions {
  /** Сколько дней назад максимум допустимо. По умолчанию 365. */
  maxDaysInPast?: number
}

export function IsRecentDate(
  options: IsRecentDateOptions = {},
  validationOptions?: ValidationOptions,
) {
  const maxDaysInPast = options.maxDaysInPast ?? 365
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'IsRecentDate',
      target: object.constructor,
      propertyName,
      constraints: [maxDaysInPast],
      options: validationOptions,
      validator: {
        validate(value: unknown, _args: ValidationArguments) {
          if (typeof value !== 'string') return false
          if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
          const d = new Date(value + 'T00:00:00')
          if (Number.isNaN(d.getTime())) return false

          const endOfToday = new Date()
          endOfToday.setHours(23, 59, 59, 999)
          if (d.getTime() > endOfToday.getTime()) return false

          const cutoffMs = Date.now() - maxDaysInPast * ONE_DAY_MS
          if (d.getTime() < cutoffMs) return false

          return true
        },
        defaultMessage(args: ValidationArguments) {
          const days = args.constraints[0] as number
          return (
            `${args.property} должна быть в формате YYYY-MM-DD, ` +
            `не в будущем и не старше ${days} дней`
          )
        },
      },
    })
  }
}
