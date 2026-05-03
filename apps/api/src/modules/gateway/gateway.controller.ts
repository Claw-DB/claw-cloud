import {
  All,
  Controller,
  HttpException,
  HttpStatus,
  Req,
  Res,
} from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import crypto from 'node:crypto';
import { createProxyMiddleware, responseInterceptor } from 'http-proxy-middleware';
import { Request, Response } from 'express';
import { GatewayService } from './gateway.service.js';

@ApiExcludeController()
@Controller()
export class GatewayController {
  constructor(private readonly gatewayService: GatewayService) {}

  @All('gateway/*')
  async route(@Req() req: Request, @Res() res: Response) {
    const authorization = req.headers.authorization;
    if (!authorization?.startsWith('Bearer ')) {
      throw new HttpException({ error: 'invalid_api_key' }, HttpStatus.UNAUTHORIZED);
    }

    const rawKey = authorization.slice('Bearer '.length).trim();
    const resolution = await this.gatewayService.resolveInstance(rawKey);
    if (resolution.instance.status !== 'RUNNING' || !resolution.instance.endpoint) {
      throw new HttpException(
        { error: 'instance_unavailable', status: resolution.instance.status },
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }

    const requestId = req.headers['x-request-id']?.toString() ?? crypto.randomUUID();
    const path = req.originalUrl.replace(/^\/gateway/, '') || '/';
    const requestBytes = Number(req.headers['content-length'] ?? 0);
    const isGrpc = path.startsWith('/grpc');
    const target = isGrpc
      ? resolution.instance.endpoint.replace(':8080', ':50050')
      : resolution.instance.endpoint;

    const proxy = createProxyMiddleware({
      target,
      changeOrigin: true,
      pathRewrite: () => path,
      proxyTimeout: 5000,
      selfHandleResponse: true,
      on: {
        proxyReq: (proxyReq) => {
          proxyReq.setHeader('x-request-id', requestId);
          proxyReq.setHeader('x-workspace-id', resolution.workspace.id);
          proxyReq.setHeader('x-api-key-id', resolution.keyRecord.id);
        },
        proxyRes: responseInterceptor(async (buffer, proxyRes) => {
          res.setHeader('X-ClawDB-Instance', resolution.instance.id);
          res.setHeader('X-ClawDB-Region', resolution.instance.region);
          res.setHeader('X-Request-Id', requestId);

          await this.gatewayService.recordUsage(resolution.instance.id, resolution.workspace.id, {
            bandwidthGb:
              (requestBytes + Number(proxyRes.headers['content-length'] ?? 0)) /
              (1024 * 1024 * 1024),
            memoryOpsCount: /(remember|search|recall)/i.test(path) ? 1 : 0,
            vectorOpsCount: /vector/i.test(path) ? 1 : 0,
            syncOpsCount: /sync/i.test(path) ? 1 : 0,
          });

          return buffer;
        }),
        error: () => {
          throw new HttpException(
            { error: 'instance_unavailable', status: resolution.instance.status },
            HttpStatus.SERVICE_UNAVAILABLE,
          );
        },
      },
    });

    return proxy(req, res, () => undefined);
  }
}