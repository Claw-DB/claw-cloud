// MetricsInterceptor — records request duration and count to Prometheus metrics
import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import { Counter, Histogram } from 'prom-client';

const httpRequestsTotal = new Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'path', 'status'],
});

const httpRequestDuration = new Histogram({
  name: 'http_request_duration_seconds',
  help: 'HTTP request duration in seconds',
  labelNames: ['method', 'path'],
  buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
});

@Injectable()
export class MetricsInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<{ method: string; url: string }>();
    const { method, url } = request;
    const timer = httpRequestDuration.startTimer({ method, path: url });

    return next.handle().pipe(
      tap(() => {
        const response = context.switchToHttp().getResponse<{ statusCode: number }>();
        timer();
        httpRequestsTotal.inc({ method, path: url, status: String(response.statusCode) });
      }),
    );
  }
}
