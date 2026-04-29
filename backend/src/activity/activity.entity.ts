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

@Entity('activitydata')
@Index('idx_activity_user_date', ['userId', 'date'])
export class ActivityData {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'userid' })
  userId!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userid' })
  user!: User;

  @Column({ type: 'date' })
  date!: string;

  @Column({ type: 'time', nullable: true })
  time!: string | null;
  
  @Column({ type: 'varchar', length: 20 })
  type!: string; // walk, run, yoga, gym, sport

  @Column({ type: 'int' })
  durationMinutes!: number;

  @Column({ type: 'varchar', length: 20 })
  intensity!: string; // light, moderate, vigorous

  @Column({ type: 'int', nullable: true })
  caloriesBurned!: number | null;

  @Column({ type: 'int', nullable: true })
  steps!: number | null;

  @Column({ type: 'text', nullable: true })
  notes!: string | null;

  @CreateDateColumn({ name: 'createdat' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updatedat' })
  updatedAt!: Date;
}
