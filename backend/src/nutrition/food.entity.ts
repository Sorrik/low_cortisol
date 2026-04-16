// backend/src/nutrition/food.entity.ts

import { Entity, PrimaryGeneratedColumn, Column, Index } from 'typeorm'

@Entity('foods')
export class Food {
  @PrimaryGeneratedColumn()
  id!: number

  @Index()
  @Column({ name: 'name_ru' })
  nameRu!: string

  @Column({ name: 'name_en', nullable: true })
  nameEn?: string

  @Column()
  category!: string

  @Column({ type: 'int' })
  kcal!: number

  @Column({ type: 'decimal', precision: 10, scale: 1 })
  protein!: number

  @Column({ type: 'decimal', precision: 10, scale: 1 })
  fat!: number

  @Column({ type: 'decimal', precision: 10, scale: 1 })
  carbs!: number

  @Column({ nullable: true })
  barcode?: string
}