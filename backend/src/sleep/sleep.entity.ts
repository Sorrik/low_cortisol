import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('sleepdata')
export class SleepData {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'userid' })
  userId!: string;

  @Column({ type: 'date' })
  date!: string;

  @Column({ name: 'bedtime', type: 'time' })
  bedTime!: string;

  @Column({ name: 'waketime', type: 'time' })
  wakeTime!: string;

  // GENERATED ALWAYS колонка в PostgreSQL — только читаем, не пишем
  @Column({
    name: 'durationhours',
    type: 'decimal',
    precision: 4,
    scale: 2,
    nullable: true,
    insert: false,
    update: false,
  })
  durationHours!: number | null;

  @Column({ type: 'int' })
  quality!: number;

  @Column({ type: 'int', default: 0 })
  interruptions!: number;

  @Column({ type: 'text', nullable: true })
  notes!: string | null;

  @CreateDateColumn({ name: 'createdat' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updatedat' })
  updatedAt!: Date;
}
