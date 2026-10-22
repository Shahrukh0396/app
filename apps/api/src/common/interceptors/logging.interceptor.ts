import { CallHandler, ExecutionContext, Injectable, Logger, NestInterceptor } from '@nestjs/common';
import { Request, Response } from 'express';
import { Observable, tap } from 'rxjs';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const http = context.switchToHttp();
    const request = http.getRequest<Request>();
    const started = Date.now();
    return next.handle().pipe(
      tap({
        next: () => {
          const response = http.getResponse<Response>();
          this.logger.log(
            JSON.stringify({
              method: request.method,
              path: request.originalUrl,
              status: response.statusCode,
              ms: Date.now() - started,
            }),
          );
        },
        error: () => {
          this.logger.warn(
            JSON.stringify({
              method: request.method,
              path: request.originalUrl,
              ms: Date.now() - started,
              failed: true,
            }),
          );
        },
      }),
    );
  }
}
