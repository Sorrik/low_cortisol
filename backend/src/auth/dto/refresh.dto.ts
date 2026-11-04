import { IsOptional, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

// refresh-токен может прийти в HTTP-only cookie (frontend, browser)
// или в body (mobile, RN — cookies на нём ненадёжны)
export class RefreshDto {
  @ApiPropertyOptional({ description: 'Refresh token (mobile clients only — frontend uses HTTP-only cookie)' })
  @IsOptional()
  @IsString()
  refresh_token?: string;
}
