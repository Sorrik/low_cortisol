// backend/src/nutrition/dto/analyze-photo.dto.ts

import { IsString, IsIn, MaxLength, MinLength } from 'class-validator'
import { ApiProperty } from '@nestjs/swagger'

export class AnalyzePhotoDto {
  @ApiProperty({ description: 'base64-кодированное содержимое фото (без data:… префикса)' })
  @IsString()
  @MinLength(100)
  // ~7 MB base64 ≈ 5 MB бинарного фото — верхняя граница UX-сжатия в expo-image-picker.
  @MaxLength(8_000_000)
  imageBase64!: string

  @ApiProperty({ enum: ['image/jpeg', 'image/png', 'image/webp'], default: 'image/jpeg' })
  @IsString()
  @IsIn(['image/jpeg', 'image/png', 'image/webp'])
  mimeType!: string
}
