import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { StressData } from './stress.entity';
import { CreateStressDto } from './dto/create-stress.dto';
import { UpdateStressDto } from './dto/update-stress.dto';

@Injectable()
export class StressService {
  constructor(
    @InjectRepository(StressData)
    private readonly stressRepo: Repository<StressData>,
  ) {}

  async create(userId: string, dto: CreateStressDto): Promise<StressData> {
    const record: StressData = this.stressRepo.create({
      userId,
      date: dto.date,
      time: dto.time,
      level: dto.level,
      cause: dto.cause ?? null,
      copingStrategy: dto.copingStrategy ?? null,
    });

    return this.stressRepo.save(record);
  }

  async findAll(
    userId: string,
    limit: number,
    offset: number,
  ): Promise<{ data: StressData[]; total: number }> {
    const [data, total] = await this.stressRepo.findAndCount({
      where: { userId },
      order: { date: 'DESC', time: 'ASC' },
      take: limit,
      skip: offset,
    });
    return { data, total };
  }

  async findOne(userId: string, id: string): Promise<StressData> {
    const record = await this.stressRepo.findOne({
      where: { id, userId },
    });
    if (!record) throw new NotFoundException('Stress record not found');
    return record;
  }

  async update(
    userId: string,
    id: string,
    dto: UpdateStressDto,
  ): Promise<StressData> {
    const record = await this.findOne(userId, id);

    const updates = Object.fromEntries(
      Object.entries(dto).filter(([, v]) => v !== undefined),
    );
    Object.assign(record, updates);

    return this.stressRepo.save(record);
  }

  async remove(userId: string, id: string): Promise<void> {
    const record = await this.findOne(userId, id);
    await this.stressRepo.remove(record);
  }
}
