import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('mooddata')
export class MoodData {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'userid' })
  userId!: string;

  @Column({ type: 'date' })
  date!: string;

  @Column({ name: 'time', type: 'time' })
  time!: string; // HH:MM когда записал

  @Column({ type: 'int' })
  moodScore!: number; // 1-10

  @Column({ type: 'text', nullable: true })
  emotions!: string | null; // "happy, anxious"

  @Column({ type: 'text', nullable: true })
  triggers!: string | null; // "work, weather"

  @Column({ type: 'text', nullable: true })
  notes!: string | null;

  @CreateDateColumn({ name: 'createdat' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updatedat' })
  updatedAt!: Date;
}
