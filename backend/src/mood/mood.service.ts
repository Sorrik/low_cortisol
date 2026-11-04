import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { MoodData }                 from './mood.entity';
import { CreateMoodDto }            from './dto/create-mood.dto';
import { UpdateMoodDto }            from './dto/update-mood.dto';
import { CacheInvalidationService } from '../insights/cache-invalidation.service';  // ← добавить

@Injectable()
export class MoodService {
  constructor(
    @InjectRepository(MoodData)
    private readonly moodRepo: Repository<MoodData>,

    private readonly cacheInvalidation: CacheInvalidationService,  // ← добавить
  ) {}

  async create(userId: string, dto: CreateMoodDto): Promise<MoodData> {
    const exists = await this.moodRepo.findOne({
      where: { userId, date: dto.date },
    });
    if (exists) {
      throw new ConflictException('Mood record for this date already exists');
    }

    const record: MoodData = this.moodRepo.create({
      userId,
      date:      dto.date,
      time:      dto.time,
      moodScore: dto.moodScore,
      emotions:  dto.emotions  ?? null,
      triggers:  dto.triggers  ?? null,
      notes:     dto.notes     ?? null,
    });

    const saved = await this.moodRepo.save(record);
    await this.cacheInvalidation.invalidateWithMetric(userId, saved.date)// ← добавить
    return saved;
  }

  async update(userId: string, id: string, dto: UpdateMoodDto): Promise<MoodData> {
    const record = await this.findOne(userId, id);

    const updates = Object.fromEntries(
      Object.entries(dto).filter(([, v]) => v !== undefined),
    );
    Object.assign(record, updates);

    const saved = await this.moodRepo.save(record);
    await this.cacheInvalidation.invalidate(userId);  // ← добавить
    return saved;
  }

  async remove(userId: string, id: string): Promise<void> {
    const record = await this.findOne(userId, id);
    await this.moodRepo.remove(record);
    await this.cacheInvalidation.invalidate(userId);  // ← добавить
  }

  async findAll(
    userId: string,
    limit: number,
    offset: number,
  ): Promise<{ data: MoodData[]; total: number }> {
    const [data, total] = await this.moodRepo.findAndCount({
      where: { userId },
      order: { date: 'DESC', time: 'DESC' },
      take: limit,
      skip: offset,
    });
    return { data, total };
  }

  async findOne(userId: string, id: string): Promise<MoodData> {
    const record = await this.moodRepo.findOne({ where: { id, userId } });
    if (!record) throw new NotFoundException('Mood record not found');
    return record;
  }
}
