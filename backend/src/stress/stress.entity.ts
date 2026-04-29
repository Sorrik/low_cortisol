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

@Entity('stressdata')
@Index('idx_stress_user_date', ['userId', 'date'])
export class StressData {
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
  level!: number; // 1-10

  @Column({ type: 'varchar', length: 500, nullable: true })
  cause!: string | null; // "work deadline"

  @Column({ type: 'varchar', length: 500, nullable: true })
  copingStrategy!: string | null; // "walked, meditated"

  @CreateDateColumn({ name: 'createdat' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updatedat' })
  updatedAt!: Date;
}
