import { LoggerService } from '@nestjs/common';

export class JsonLogger implements LoggerService {
  constructor(private readonly json: boolean) {}

  log(message: unknown, context?: string): void {
    this.write('info', message, context);
  }

  error(message: unknown, trace?: string, context?: string): void {
    this.write('error', message, context, trace);
  }

  warn(message: unknown, context?: string): void {
    this.write('warn', message, context);
  }

  debug(message: unknown, context?: string): void {
    this.write('debug', message, context);
  }

  verbose(message: unknown, context?: string): void {
    this.write('verbose', message, context);
  }

  private write(level: string, message: unknown, context?: string, trace?: string): void {
    if (!this.json) {
      const text = typeof message === 'string' ? message : JSON.stringify(message);
      const line = context ? `[${context}] ${text}` : text;
      if (level === 'error') {
        console.error(trace ? `${line} ${trace}` : line);
      } else if (level === 'warn') {
        console.warn(line);
      } else {
        console.log(line);
      }
      return;
    }
    console.log(
      JSON.stringify({
        time: new Date().toISOString(),
        level,
        context: context ?? null,
        message,
        trace: trace ?? null,
      }),
    );
  }
}
