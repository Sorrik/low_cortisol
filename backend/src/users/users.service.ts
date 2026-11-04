import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './user.entity';
import { UserResponseDto } from './dto/user-response.dto';
import { UpdateUserDto } from './dto/update-user.dto';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly usersRepo: Repository<User>,
  ) {}

  async updateById(id: string, dto: UpdateUserDto): Promise<UserResponseDto> {
    const user = await this.usersRepo.findOne({ where: { id } });
    if (!user) throw new NotFoundException('User not found');
    if (dto.firstName !== undefined) user.firstName = dto.firstName;
    if (dto.lastName  !== undefined) user.lastName  = dto.lastName;
    if (dto.dateOfBirth !== undefined) user.dateOfBirth = dto.dateOfBirth ? new Date(dto.dateOfBirth) : null;
    return this.toResponseDto(await this.usersRepo.save(user));
  }

  async findById(id: string): Promise<UserResponseDto> {
    const user = await this.usersRepo.findOne({ where: { id } });
    if (!user) throw new NotFoundException('User not found');
    return this.toResponseDto(user);
  }

  private toResponseDto(user: User): UserResponseDto {
    const dto = new UserResponseDto();
    dto.id = user.id;
    dto.email = user.email;
    dto.firstName = user.firstName;
    dto.lastName = user.lastName;
    dto.dateOfBirth = user.dateOfBirth;
    dto.isActive = user.isActive;
    dto.createdAt = user.createdAt;
    return dto;
  }
}
