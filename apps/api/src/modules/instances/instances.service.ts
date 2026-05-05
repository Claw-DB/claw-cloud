import {
  ConflictException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Instance, InstanceTier, WorkspacePlan } from '@prisma/client';
import {
  ConnectionInfo,
  CreateInstanceDtoType,
  HealthResult,
  InstanceStatusResponse,
  JOB_NAMES,
  PLAN_LIMITS,
  QUEUE_NAMES,
  ScaleInstanceDtoType,
  TIER_SPECS,
} from '@claw/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { KubeService } from './kube.service.js';
import { getQueue } from '../../common/infra/queue.js';

const TIER_ORDER: InstanceTier[] = ['NANO', 'MICRO', 'SMALL', 'MEDIUM', 'LARGE', 'XL'];

@Injectable()
export class InstancesService {
  private readonly provisionQueue = getQueue(QUEUE_NAMES.PROVISION);

  constructor(
    private readonly prisma: PrismaService,
    private readonly kubeService: KubeService,
  ) {}

  async create(workspaceId: string, dto: CreateInstanceDtoType): Promise<Instance> {
    const workspace = await this.prisma.workspace.findUnique({ where: { id: workspaceId } });
    if (!workspace) {
      throw new NotFoundException('Workspace not found');
    }

    await this.assertPlanAllowsInstance(workspaceId, workspace.plan, dto.tier);

    const slug = this.slugify(dto.name);
    const existing = await this.prisma.instance.findFirst({ where: { workspaceId, slug } });
    if (existing) {
      throw new ConflictException('Instance slug is already in use for this workspace');
    }

    const specs = TIER_SPECS[dto.tier];
    const instance = await this.prisma.instance.create({
      data: {
        workspaceId,
        name: dto.name,
        slug,
        region: dto.region,
        tier: dto.tier,
        version: dto.version,
        status: 'PROVISIONING',
        cpuMillicores: specs.cpu,
        memoryMb: specs.mem,
        storageGb: specs.storage,
      },
    });

    await this.provisionQueue.add(JOB_NAMES.PROVISION_INSTANCE, {
      workspaceId,
      instanceId: instance.id,
      region: dto.region,
      tier: dto.tier,
      version: dto.version,
    });

    return instance;
  }

  async findAll(workspaceId: string): Promise<Instance[]> {
    return this.prisma.instance.findMany({
      where: {
        workspaceId,
        status: { not: 'TERMINATED' },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  async findById(id: string, workspaceId: string): Promise<Instance> {
    const instance = await this.prisma.instance.findFirst({
      where: { id, workspaceId },
    });
    if (!instance) {
      throw new NotFoundException('Instance not found');
    }

    return instance;
  }

  async getStatus(id: string, workspaceId: string): Promise<InstanceStatusResponse> {
    const instance = await this.findById(id, workspaceId);
    if (!instance.podName || !instance.kubeNamespace) {
      return {
        id: instance.id,
        status: instance.status,
        podStatus: 'Unavailable',
        podPhase: null,
        message: 'Pod metadata is not available yet',
        endpoint: instance.endpoint,
        podName: instance.podName,
        namespace: instance.kubeNamespace,
        updatedAt: instance.updatedAt,
      };
    }

    const podStatus = await this.kubeService.getPodStatus(instance.podName, instance.kubeNamespace);
    return {
      id: instance.id,
      status: instance.status,
      podStatus: podStatus.ready ? 'Ready' : 'NotReady',
      podPhase: podStatus.phase,
      message: podStatus.message ?? podStatus.reason,
      endpoint: instance.endpoint,
      podName: instance.podName,
      namespace: instance.kubeNamespace,
      updatedAt: instance.updatedAt,
    };
  }

  async scale(id: string, workspaceId: string, dto: ScaleInstanceDtoType): Promise<Instance> {
    const instance = await this.findById(id, workspaceId);
    const workspace = await this.prisma.workspace.findUnique({ where: { id: workspaceId } });
    if (!workspace) {
      throw new NotFoundException('Workspace not found');
    }

    await this.assertPlanAllowsInstance(workspaceId, workspace.plan, dto.tier);

    await this.prisma.instance.update({
      where: { id },
      data: { status: 'SCALING', tier: dto.tier },
    });

    await this.provisionQueue.add(JOB_NAMES.SCALE_INSTANCE, {
      workspaceId,
      instanceId: id,
      tier: dto.tier,
      previousTier: instance.tier,
    });

    return this.findById(id, workspaceId);
  }

  async pause(id: string, workspaceId: string): Promise<Instance> {
    await this.findById(id, workspaceId);
    await this.prisma.instance.update({ where: { id }, data: { status: 'PAUSED' } });
    await this.provisionQueue.add(JOB_NAMES.PAUSE_INSTANCE, { workspaceId, instanceId: id });
    return this.findById(id, workspaceId);
  }

  async resume(id: string, workspaceId: string): Promise<Instance> {
    await this.findById(id, workspaceId);
    await this.provisionQueue.add(JOB_NAMES.RESUME_INSTANCE, { workspaceId, instanceId: id });
    return this.findById(id, workspaceId);
  }

  async terminate(id: string, workspaceId: string): Promise<void> {
    await this.findById(id, workspaceId);
    await this.prisma.instance.update({ where: { id }, data: { status: 'TERMINATING' } });
    await this.provisionQueue.add(JOB_NAMES.TERMINATE_INSTANCE, { workspaceId, instanceId: id });
  }

  async getConnectionInfo(id: string, workspaceId: string): Promise<ConnectionInfo> {
    const instance = await this.findById(id, workspaceId);
    if (!instance.endpoint) {
      throw new ServiceUnavailableException('Instance endpoint is not ready yet');
    }

    return {
      grpcEndpoint: instance.endpoint?.replace(/^http/, 'grpc').replace(':8080', ':50050'),
      httpEndpoint: instance.endpoint,
      apiKeyHint: `Create or rotate a workspace API key for ${instance.name}`,
      region: instance.region,
      tlsCert: process.env.CLAW_TLS_CERT ?? null,
    };
  }

  async healthCheck(id: string, workspaceId?: string): Promise<HealthResult> {
    const instance = workspaceId
      ? await this.findById(id, workspaceId)
      : await this.prisma.instance.findUnique({ where: { id } });

    if (!instance) {
      throw new NotFoundException('Instance not found');
    }
    if (!instance.endpoint) {
      throw new ServiceUnavailableException('Instance endpoint is not available');
    }

    const startedAt = Date.now();
    const response = await fetch(`${instance.endpoint}/health`);
    const latencyMs = Date.now() - startedAt;
    const body = await response.json().catch(() => null);

    await this.prisma.instance.update({
      where: { id: instance.id },
      data: { lastHealthCheckAt: new Date() },
    });

    return {
      ok: response.ok,
      status: response.status,
      latencyMs,
      checkedAt: new Date(),
      body,
    };
  }

  private async assertPlanAllowsInstance(
    workspaceId: string,
    plan: WorkspacePlan,
    tier: InstanceTier,
  ): Promise<void> {
    const limits = PLAN_LIMITS[plan as keyof typeof PLAN_LIMITS];
    const count = await this.prisma.instance.count({
      where: { workspaceId, status: { not: 'TERMINATED' } },
    });
    if (count >= limits.maxInstances) {
      throw new ConflictException('Workspace plan does not allow more instances');
    }

    if (TIER_ORDER.indexOf(tier) > TIER_ORDER.indexOf(limits.maxTier as InstanceTier)) {
      throw new ConflictException('Requested instance tier exceeds workspace plan limits');
    }
  }

  private slugify(input: string): string {
    return input
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 63);
  }
}