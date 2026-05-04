import { BadRequestException, Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { SleepData }               from './sleep.entity';
import { CreateSleepDto }          from './dto/create-sleep.dto';
import { UpdateSleepDto }          from './dto/update-sleep.dto';
import { CacheInvalidationService } from '../insights/cache-invalidation.service';

/**
 * Парсит "HH:MM" / "HH:MM:SS" в десятичные часы (23.5 = 23:30).
 */
function timeToHours(t: string): number {
  const [h, m = '0'] = t.split(':')
  return Number(h) + Number(m) / 60
}

/**
 * Длительность сна по bedTime/wakeTime с учётом перехода через полночь.
 * bed=23:00, wake=07:00 → 8.0; bed=01:00, wake=07:00 → 6.0.
 * Возвращает 0, если получилось <= 0 (физически невозможно — это означает,
 * что пользователь ввёл идентичные времена или проспал >24ч).
 */
function computeSleepHours(bedTime: string, wakeTime: string): number {
  const bed  = timeToHours(bedTime)
  const wake = timeToHours(wakeTime)
  let hours = wake - bed
  if (hours <= 0) hours += 24
  return hours
}

@Injectable()
export class SleepService {
  constructor(
    @InjectRepository(SleepData)
    private readonly sleepRepo: Repository<SleepData>,

    private readonly cacheInvalidation: CacheInvalidationService,
  ) {}

  /**
   * Логически валидирует пару bedTime/wakeTime: если получившаяся
   * длительность <= 0 или > 18ч — это ошибка ввода (а не legitimate
   * 18-часовой сон — тогда пусть пользователь введёт явно).
   * Допустимое окно совпадает с верхней границей schemа sleep.durationHours.
   */
  private _assertValidSleepInterval(bedTime: string, wakeTime: string): number {
    if (bedTime === wakeTime) {
      throw new BadRequestException('bedTime и wakeTime не могут совпадать')
    }
    const hours = computeSleepHours(bedTime, wakeTime)
    if (hours <= 0 || hours > 18) {
      throw new BadRequestException(
        `Некорректный интервал сна: ${hours.toFixed(1)}ч. ` +
        `Проверь bedTime и wakeTime.`,
      )
    }
    return hours
  }

  async create(userId: string, dto: CreateSleepDto): Promise<SleepData> {
    this._assertValidSleepInterval(dto.bedTime, dto.wakeTime)

    const exists = await this.sleepRepo.findOne({
      where: { userId, date: dto.date },
    });
    if (exists) {
      throw new ConflictException('Sleep record for this date already exists');
    }

    const record = this.sleepRepo.create({
      userId,
      date:         dto.date,
      bedTime:      dto.bedTime,
      wakeTime:     dto.wakeTime,
      quality:      dto.quality,
      interruptions: dto.interruptions ?? 0,
      notes:        dto.notes ?? null,
    });
    
    const saved = await this.sleepRepo.save(record)
    await this.cacheInvalidation.invalidateWithMetric(userId, saved.date)
    return saved
  }

  
  async update(userId: string, id: string, dto: UpdateSleepDto): Promise<SleepData> {
    const record = await this.findOne(userId, id);

    const updates = Object.fromEntries(
      Object.entries(dto).filter(([, v]) => v !== undefined),
    );
    Object.assign(record, updates);

    // Если в апдейте затрагиваются bedTime/wakeTime — пересчитываем интервал
    // и валидируем уже на финальном состоянии записи.
    if (updates.bedTime !== undefined || updates.wakeTime !== undefined) {
      this._assertValidSleepInterval(record.bedTime, record.wakeTime)
    }

    const saved = await this.sleepRepo.save(record);

    // ← Сбрасываем кэш при обновлении
    await this.cacheInvalidation.invalidate(userId);

    return saved;
  }

  async remove(userId: string, id: string): Promise<void> {
    const record = await this.findOne(userId, id);
    await this.sleepRepo.remove(record);

    // ← Сбрасываем кэш при удалении
    await this.cacheInvalidation.invalidate(userId);
  }

  async findAll(userId: string, limit: number, offset: number) {
    const [data, total] = await this.sleepRepo.findAndCount({
      where: { userId },
      order: { date: 'DESC' },
      take: limit,
      skip: offset,
    });
    return { data, total };
  }

  async findOne(userId: string, id: string): Promise<SleepData> {
    const record = await this.sleepRepo.findOne({ where: { id, userId } });
    if (!record) throw new NotFoundException('Sleep record not found');
    return record;
  }
}
