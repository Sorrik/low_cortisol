import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('activitydata')
export class ActivityData {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'userid' })
  userId!: string;

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

  @Column({ type: 'text', nullable: true })
  notes!: string | null;

  @CreateDateColumn({ name: 'createdat' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updatedat' })
  updatedAt!: Date;
}
