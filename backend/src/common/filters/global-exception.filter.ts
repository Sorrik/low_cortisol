import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { PinoLogger, InjectPinoLogger } from 'nestjs-pino';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  constructor(
    @InjectPinoLogger(GlobalExceptionFilter.name)
    private readonly logger: PinoLogger,
  ) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request & { id?: string }>();

    const isHttp = exception instanceof HttpException;
    const status = isHttp
      ? exception.getStatus()
      : HttpStatus.INTERNAL_SERVER_ERROR;

    const httpBody = isHttp ? exception.getResponse() : null;

    let message: string | string[] = 'Internal server error';
    let errorCode: string | undefined;

    if (typeof httpBody === 'string') {
      message = httpBody;
    } else if (httpBody && typeof httpBody === 'object') {
      const body = httpBody as Record<string, unknown>;
      if (body.message !== undefined) message = body.message as string | string[];
      if (typeof body.error === 'string') errorCode = body.error;
    }

    const logCtx = {
      requestId: request.id,
      method: request.method,
      path: request.url,
      status,
    };

    if (!isHttp) {
      this.logger.error(
        { ...logCtx, err: exception },
        'Unhandled exception',
      );
    } else if (status >= 500) {
      this.logger.error({ ...logCtx, message }, 'HttpException 5xx');
    }

    response.status(status).json({
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
      method: request.method,
      requestId: request.id,
      error: errorCode ?? (isHttp ? exception.name : 'InternalServerError'),
      message,
    });
  }
}
