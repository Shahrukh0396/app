import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const status =
      exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
    const payload = exception instanceof HttpException ? exception.getResponse() : null;
    let message: string | string[] = 'Internal server error';
    if (typeof payload === 'string') message = payload;
    else if (payload && typeof payload === 'object' && 'message' in payload) {
      const raw = (payload as { message?: string | string[] }).message;
      if (raw) message = raw;
    } else if (exception instanceof Error && status < 500) {
      message = exception.message;
    }
    if (status >= 500) {
      this.logger.error(
        exception instanceof Error ? exception.message : 'Unhandled error',
        exception instanceof Error ? exception.stack : undefined,
      );
    }
    response.status(status).json({
      statusCode: status,
      message,
      error: HttpStatus[status] ?? 'Error',
      path: request.url,
      timestamp: new Date().toISOString(),
    });
  }
}
