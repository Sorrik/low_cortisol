import {
  Entity, PrimaryGeneratedColumn, Column,
  CreateDateColumn, UpdateDateColumn, Index,
  ManyToOne, JoinColumn,
} from 'typeorm';
import { User } from '../users/user.entity';

const decimalTransformer = {
  to:   (value: number) => value,
  from: (value: string) => parseFloat(value),
};

@Entity('nutritiondata')
@Index('idx_nutrition_user_date', ['userId', 'date'])
export class NutritionData {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'userid' })
  userId!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userid' })
  user!: User;

  @Column({ type: 'date' })
  date!: string;

  @Column({ name: 'time', type: 'time' })
  time!: string;

  @Column({ name: 'mealType' })
  mealType!: string;

  @Column()
  description!: string;

  @Column({ type: 'int' })
  calories!: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, transformer: decimalTransformer })
  proteinGrams!: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, transformer: decimalTransformer })
  carbsGrams!: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, transformer: decimalTransformer })
  fatGrams!: number;

  @CreateDateColumn({ name: 'createdat' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updatedat' })
  updatedAt!: Date;
}