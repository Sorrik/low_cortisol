import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from '../users/user.entity';

@Entity('waterdata')
@Index('idx_water_user_date', ['userId', 'date'])
export class WaterData {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'userid' })
  userId!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userid' })
  user!: User;

  @Column({ type: 'date' })
  date!: string;

  @Column({ type: 'time' })
  time!: string;

  @Column({ type: 'int' })
  amountMl!: number; // 250, 500, 1000 мл

  @CreateDateColumn({ name: 'createdat' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updatedat' })
  updatedAt!: Date;
}
