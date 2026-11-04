// backend/src/nutrition/nutrition.service.ts

import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DeepPartial, Repository } from 'typeorm';

import { NutritionData }            from './nutrition.entity';
import { CreateNutritionDto }       from './dto/create-nutrition.dto';
import { UpdateNutritionDto }       from './dto/update-nutrition.dto';
import { CacheInvalidationService } from '../insights/cache-invalidation.service';

@Injectable()
export class NutritionService {
  constructor(
    @InjectRepository(NutritionData)
    private readonly nutritionRepo: Repository<NutritionData>,
    private readonly cacheInvalidation: CacheInvalidationService,
  ) {}

  async create(userId: string, dto: CreateNutritionDto): Promise<NutritionData> {
    const record = this.nutritionRepo.create({ userId, ...dto } as DeepPartial<NutritionData>);
    const saved  = await this.nutritionRepo.save(record);
    await this.cacheInvalidation.invalidateWithMetric(userId, saved.date)
    return saved;
  }

  async update(userId: string, id: string, dto: UpdateNutritionDto): Promise<NutritionData> {
    const record = await this.findOne(userId, id);
    Object.assign(record, dto);
    const saved = await this.nutritionRepo.save(record);
    await this.cacheInvalidation.invalidate(userId);
    return saved;
  }

  async remove(userId: string, id: string): Promise<void> {
    const record = await this.findOne(userId, id);
    await this.nutritionRepo.remove(record);
    await this.cacheInvalidation.invalidate(userId);
  }

  async findAll(
    userId: string,
    limit: number,
    offset: number,
  ): Promise<{ data: NutritionData[]; total: number }> {
    const [data, total] = await this.nutritionRepo.findAndCount({
      where: { userId },
      order: { date: 'DESC', time: 'ASC' },
      take:  limit,
      skip:  offset,
    });
    return { data, total };
  }

  async findOne(userId: string, id: string): Promise<NutritionData> {
    const record = await this.nutritionRepo.findOne({ where: { id, userId } });
    if (!record) throw new NotFoundException('Nutrition record not found');
    return record;
  }
}