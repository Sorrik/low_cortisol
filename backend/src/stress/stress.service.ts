import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { StressData }               from './stress.entity';
import { CreateStressDto }          from './dto/create-stress.dto';
import { UpdateStressDto }          from './dto/update-stress.dto';
import { CacheInvalidationService } from '../insights/cache-invalidation.service'; // ← импорт

@Injectable()
export class StressService {
  constructor(
    @InjectRepository(StressData)
    private readonly stressRepo: Repository<StressData>,
    private readonly cacheInvalidation: CacheInvalidationService,
  ) {}

  async create(userId: string, dto: CreateStressDto): Promise<StressData> {
    const record: StressData = this.stressRepo.create({
      userId,
      date:           dto.date,
      time:           dto.time,
      level:          dto.level,
      cause:          dto.cause ?? null,
      copingStrategy: dto.copingStrategy ?? null,
    });

    const saved = await this.stressRepo.save(record)
    await this.cacheInvalidation.invalidateWithMetric(userId, saved.date)
    return saved // ← return в конце
  }

  async findAll(userId: string, limit: number, offset: number): Promise<{ data: StressData[]; total: number }> {
    const [data, total] = await this.stressRepo.findAndCount({
      where: { userId },
      order: { date: 'DESC', time: 'ASC' },
      take: limit,
      skip: offset,
    });
    return { data, total };
  }

  async findOne(userId: string, id: string): Promise<StressData> {
    const record = await this.stressRepo.findOne({ where: { id, userId } });
    if (!record) throw new NotFoundException('Stress record not found');
    return record;
  }

  async update(userId: string, id: string, dto: UpdateStressDto): Promise<StressData> {
    const record = await this.findOne(userId, id);
    const updates = Object.fromEntries(Object.entries(dto).filter(([, v]) => v !== undefined));
    Object.assign(record, updates);
    const saved = await this.stressRepo.save(record);
    await this.cacheInvalidation.invalidate(userId);
    return saved;
  }

  async remove(userId: string, id: string): Promise<void> {
    const record = await this.findOne(userId, id);
    await this.stressRepo.remove(record);
    await this.cacheInvalidation.invalidate(userId);
  }
}
