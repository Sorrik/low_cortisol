import { Controller, Post, Body, Get } from '@nestjs/common';

import { MlService } from './ml.service';
import { MlPredictDto } from './dto/ml-predict.dto';
import { MlTrainDto } from './dto/ml-train.dto';
import { MlPredictResponseDto, MlTrainResponseDto } from './dto/ml-response.dto';

@Controller('ml')
export class MlController {
  constructor(private readonly mlService: MlService) {}

  // POST /ml/predict
  @Post('predict')
  async predict(@Body() dto: MlPredictDto): Promise<MlPredictResponseDto> {
    return this.mlService.predict(dto);
  }

  // POST /ml/train
  @Post('train')
  async train(@Body() dto: MlTrainDto): Promise<MlTrainResponseDto> {
    return this.mlService.train(dto);
  }

  // GET /ml/health
  @Get('health')
  async health(): Promise<{ status: string; ml_service: string }> {
    return this.mlService.healthCheck();
  }
}
