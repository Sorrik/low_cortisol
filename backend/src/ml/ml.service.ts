import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom, timeout, catchError, retry } from 'rxjs';  // ← добавить retry
import { AxiosError, AxiosResponse } from 'axios';

import { MlPredictDto}              from './dto/ml-predict.dto';
import { MlTrainDto } from './dto/ml-train.dto';
import { MlPredictResponseDto, MlTrainResponseDto } from './dto/ml-response.dto';

@Injectable()
export class MlService {
  private readonly logger     = new Logger(MlService.name);
  private readonly mlBaseUrl: string;
  private readonly timeoutMs  = 30_000;

  constructor(
    private readonly httpService:    HttpService,
    private readonly configService:  ConfigService,
  ) {
    this.mlBaseUrl = this.configService.get<string>(
      'ML_SERVICE_URL',
      'http://ml-service:8000',
    );
  }

  // ─────────────────────────────────────────────
  // Predict
  // ─────────────────────────────────────────────

  async predict(dto: MlPredictDto): Promise<MlPredictResponseDto> {
    this.logger.log(`[predict] user_id=${dto.user_id}`);

    try {
      const response: AxiosResponse<MlPredictResponseDto> = await firstValueFrom(
        this.httpService
          .post<MlPredictResponseDto>(`${this.mlBaseUrl}/predict/`, dto)
          .pipe(
            timeout(this.timeoutMs),
            retry({ count: 1, delay: 500 }),  // ← добавить: одна попытка через 500ms
            catchError((err: AxiosError) => {
              throw this._handleAxiosError(err, 'predict');
            }),
          ),
      );

      this.logger.log(
        `[predict] user_id=${dto.user_id} → ` +
        `mood=${response.data.predicted_mood}, ` +
        `phase=${response.data.phase?.mode}`,
      );

      return response.data;

    } catch (err) {
      if (err instanceof HttpException) throw err;
      throw new HttpException(
        { message: 'ML сервис недоступен', detail: String(err) },
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
  }

  // ─────────────────────────────────────────────
  // Train
  // ─────────────────────────────────────────────

  async train(dto: MlTrainDto): Promise<MlTrainResponseDto> {
    this.logger.log(`[train] user_id=${dto.user_id}`);

    try {
      const response: AxiosResponse<MlTrainResponseDto> = await firstValueFrom(
        this.httpService
          .post<MlTrainResponseDto>(`${this.mlBaseUrl}/train/`, dto)
          .pipe(
            timeout(this.timeoutMs),
            // ← retry намеренно отсутствует: двойной запуск обучения нежелателен
            catchError((err: AxiosError) => {
              throw this._handleAxiosError(err, 'train');
            }),
          ),
      );

      this.logger.log(
        `[train] user_id=${dto.user_id} → ` +
        `status=${response.data.status}, ` +
        `version=${response.data.model_version}`,
      );

      return response.data;

    } catch (err) {
      if (err instanceof HttpException) throw err;
      throw new HttpException(
        { message: 'ML сервис недоступен', detail: String(err) },
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
  }

  // ─────────────────────────────────────────────
  // Health check
  // ─────────────────────────────────────────────

  async healthCheck(): Promise<{ status: string; ml_service: string }> {
    try {
      const response: AxiosResponse = await firstValueFrom(
        this.httpService
          .get(`${this.mlBaseUrl}/health`)
          .pipe(timeout(5_000)),
      );
      return { status: 'ok', ml_service: response.data?.status ?? 'ok' };
    } catch {
      return { status: 'degraded', ml_service: 'unavailable' };
    }
  }

  // ─────────────────────────────────────────────
  // Private helpers
  // ─────────────────────────────────────────────

  private _handleAxiosError(err: AxiosError, endpoint: string): never {
    const status = err.response?.status;
    const detail = (err.response?.data as any)?.detail ?? err.message;

    this.logger.error(`[${endpoint}] ML error ${status}: ${detail}`);

    if (status === 422) {
      throw new HttpException(
        { message: 'Неверный формат данных для ML сервиса', detail },
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }

    throw new HttpException(
      { message: 'Ошибка ML сервиса', detail },
      HttpStatus.BAD_GATEWAY,
    );
  }
}
