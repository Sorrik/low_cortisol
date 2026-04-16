import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { SleepData }               from './sleep.entity';
import { CreateSleepDto }          from './dto/create-sleep.dto';
import { UpdateSleepDto }          from './dto/update-sleep.dto';
import { CacheInvalidationService } from '../insights/cache-invalidation.service';

@Injectable()
export class SleepService {
  constructor(
    @InjectRepository(SleepData)
    private readonly sleepRepo: Repository<SleepData>,

    private readonly cacheInvalidation: CacheInvalidationService,  // ← добавить
  ) {}

  async create(userId: string, dto: CreateSleepDto): Promise<SleepData> {
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
