import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { ActivityData }              from './activity.entity';
import { CreateActivityDto }         from './dto/create-activity.dto';
import { UpdateActivityDto }         from './dto/update-activity.dto';
import { CacheInvalidationService }  from '../insights/cache-invalidation.service';  // ← добавить

@Injectable()
export class ActivityService {
  constructor(
    @InjectRepository(ActivityData)
    private readonly activityRepo: Repository<ActivityData>,

    private readonly cacheInvalidation: CacheInvalidationService,  // ← добавить
  ) {}

  async create(userId: string, dto: CreateActivityDto): Promise<ActivityData> {
    const record: ActivityData = this.activityRepo.create({
      userId,
      date:            dto.date,
      type:            dto.type,
      durationMinutes: dto.durationMinutes,
      intensity:       dto.intensity,
      caloriesBurned:  dto.caloriesBurned ?? null,
      notes:           dto.notes ?? null,
    });

    const saved = await this.activityRepo.save(record);
    await this.cacheInvalidation.invalidate(userId);  // ← добавить
    return saved;
  }

  async update(userId: string, id: string, dto: UpdateActivityDto): Promise<ActivityData> {
    const record = await this.findOne(userId, id);

    const updates = Object.fromEntries(
      Object.entries(dto).filter(([, v]) => v !== undefined),
    );
    Object.assign(record, updates);

    const saved = await this.activityRepo.save(record);
    await this.cacheInvalidation.invalidate(userId);  // ← добавить
    return saved;
  }

  async remove(userId: string, id: string): Promise<void> {
    const record = await this.findOne(userId, id);
    await this.activityRepo.remove(record);
    await this.cacheInvalidation.invalidate(userId);  // ← добавить
  }

  async findAll(
    userId: string,
    limit: number,
    offset: number,
  ): Promise<{ data: ActivityData[]; total: number }> {
    const [data, total] = await this.activityRepo.findAndCount({
      where: { userId },
      order: { date: 'DESC', createdAt: 'DESC' },
      take: limit,
      skip: offset,
    });
    return { data, total };
  }

  async findOne(userId: string, id: string): Promise<ActivityData> {
    const record = await this.activityRepo.findOne({ where: { id, userId } });
    if (!record) throw new NotFoundException('Activity record not found');
    return record;
  }
}
