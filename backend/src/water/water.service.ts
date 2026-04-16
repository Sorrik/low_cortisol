import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { WaterData }                from './water.entity';
import { CreateWaterDto }           from './dto/create-water.dto';
import { UpdateWaterDto }           from './dto/update-water.dto';
import { CacheInvalidationService } from '../insights/cache-invalidation.service';  // в†ђ РґРѕР±Р°РІРёС‚СЊ

@Injectable()
export class WaterService {
  constructor(
    @InjectRepository(WaterData)
    private readonly waterRepo: Repository<WaterData>,

    private readonly cacheInvalidation: CacheInvalidationService,  // в†ђ РґРѕР±Р°РІРёС‚СЊ
  ) {}

  async create(userId: string, dto: CreateWaterDto): Promise<WaterData> {
    const record: WaterData = this.waterRepo.create({
      userId,
      date:     dto.date,
      time:     dto.time,
      amountMl: dto.amountMl,
    });

    const saved = await this.waterRepo.save(record);
    await this.cacheInvalidation.invalidateWithMetric(userId, saved.date)
    return saved;
  }

  async update(userId: string, id: string, dto: UpdateWaterDto): Promise<WaterData> {
    const record = await this.findOne(userId, id);

    const updates = Object.fromEntries(
      Object.entries(dto).filter(([, v]) => v !== undefined),
    );
    Object.assign(record, updates);

    const saved = await this.waterRepo.save(record);
    await this.cacheInvalidation.invalidateWithMetric(userId, saved.date) // в†ђ РґРѕР±Р°РІРёС‚СЊ
    return saved;
  }

  async remove(userId: string, id: string): Promise<void> {
    const record = await this.findOne(userId, id);
    await this.waterRepo.remove(record);
    await this.cacheInvalidation.invalidate(userId);  // в†ђ РґРѕР±Р°РІРёС‚СЊ
  }

  async findAll(
    userId: string,
    limit: number,
    offset: number,
  ): Promise<{ data: WaterData[]; total: number }> {
    const [data, total] = await this.waterRepo.findAndCount({
      where: { userId },
      order: { date: 'DESC', time: 'ASC' },
      take: limit,
      skip: offset,
    });
    return { data, total };
  }

  async findOne(userId: string, id: string): Promise<WaterData> {
    const record = await this.waterRepo.findOne({ where: { id, userId } });
    if (!record) throw new NotFoundException('Water record not found');
    return record;
  }
}
