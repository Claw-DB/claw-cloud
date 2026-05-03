import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import {
  AppsV1Api,
  CoreV1Api,
  KubeConfig,
  Log,
  NetworkingV1Api,
  V1ConfigMap,
  V1Deployment,
  V1Namespace,
  V1PersistentVolumeClaim,
  V1Service,
} from '@kubernetes/client-node';
import { Instance, InstanceTier } from '@prisma/client';
import { PassThrough } from 'node:stream';
import {
  KUBE_READY_POLL_MS,
  KUBE_READY_TIMEOUT_MS,
  PERSISTENT_VOLUME_RETENTION_HOURS,
  PodStatus,
  TIER_SPECS,
} from '@claw/common';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class KubeService {
  private readonly logger = new Logger(KubeService.name);
  private readonly kubeConfig = new KubeConfig();
  private readonly coreApi: CoreV1Api;
  private readonly appsApi: AppsV1Api;
  private readonly networkingApi: NetworkingV1Api;
  private readonly logClient: Log;

  constructor(private readonly prisma: PrismaService) {
    if (process.env.KUBERNETES_SERVICE_HOST) {
      this.kubeConfig.loadFromCluster();
    } else {
      this.kubeConfig.loadFromDefault();
    }

    this.coreApi = this.kubeConfig.makeApiClient(CoreV1Api);
    this.appsApi = this.kubeConfig.makeApiClient(AppsV1Api);
    this.networkingApi = this.kubeConfig.makeApiClient(NetworkingV1Api);
    this.logClient = new Log(this.kubeConfig);
  }

  async provisionInstance(instance: Instance): Promise<{ podName: string; namespace: string }> {
    const namespace = this.namespaceName(instance.workspaceId);
    const deploymentName = this.deploymentName(instance.id);
    const serviceName = deploymentName;
    const pvcName = `${instance.id}-pvc`;
    const configMapName = `clawdb-config-${instance.id}`;
    const specs = TIER_SPECS[instance.tier as keyof typeof TIER_SPECS];

    await this.ensureNamespace(namespace, instance.workspaceId);
    await this.ensureConfigMap(namespace, configMapName, instance.workspaceId);
    await this.ensurePvc(namespace, pvcName, specs.storage);
    await this.ensureDeployment(namespace, deploymentName, pvcName, configMapName, instance);
    await this.ensureService(namespace, serviceName, deploymentName);
    await this.ensureNetworkPolicy(namespace, deploymentName, instance.workspaceId);

    const pod = await this.waitForPodRunning(namespace, deploymentName);
    const podName = pod.metadata?.name;
    if (!podName) {
      throw new ServiceUnavailableException('Instance pod failed to receive a name');
    }

    await this.prisma.instance.update({
      where: { id: instance.id },
      data: {
        podName,
        kubeNamespace: namespace,
        endpoint: `http://${serviceName}.${namespace}.svc.cluster.local:8080`,
        grpcPort: 50050,
        httpPort: 8080,
        status: 'RUNNING',
      },
    });

    return { podName, namespace };
  }

  async scaleInstance(instance: Instance, newTier: InstanceTier): Promise<void> {
    const namespace = this.requireNamespace(instance);
    const deploymentName = this.deploymentName(instance.id);
    const specs = TIER_SPECS[newTier as keyof typeof TIER_SPECS];

    await this.appsApi.patchNamespacedDeployment(
      {
        name: deploymentName,
        namespace,
        body: {
          spec: {
            template: {
              spec: {
                containers: [
                  {
                    name: 'clawdb',
                    resources: this.buildResources(specs.cpu, specs.mem),
                  },
                ],
              },
            },
          },
        },
      },
    );
  }

  async pauseInstance(instance: Instance): Promise<void> {
    await this.scaleReplicas(instance, 0);
  }

  async resumeInstance(instance: Instance): Promise<void> {
    await this.scaleReplicas(instance, 1);
    await this.waitForPodRunning(this.requireNamespace(instance), this.deploymentName(instance.id));
  }

  async terminateInstance(instance: Instance): Promise<void> {
    const namespace = this.requireNamespace(instance);
    const deploymentName = this.deploymentName(instance.id);
    const pvcName = `${instance.id}-pvc`;

    await Promise.allSettled([
      this.appsApi.deleteNamespacedDeployment({ name: deploymentName, namespace }),
      this.coreApi.deleteNamespacedService({ name: deploymentName, namespace }),
      this.coreApi.patchNamespacedPersistentVolumeClaim(
        {
          name: pvcName,
          namespace,
          body: {
            metadata: {
              annotations: {
                'claw-cloud.io/retain-until': new Date(
                  Date.now() + PERSISTENT_VOLUME_RETENTION_HOURS * 60 * 60 * 1000,
                ).toISOString(),
              },
            },
          },
        },
      ),
    ]);
  }

  async getPodStatus(podName: string, namespace: string): Promise<PodStatus> {
    const pod = await this.coreApi.readNamespacedPod({ name: podName, namespace });
    const condition = pod.status?.conditions?.find((item) => item.type === 'Ready');

    return {
      phase: pod.status?.phase ?? 'Unknown',
      reason: pod.status?.reason ?? null,
      message: pod.status?.message ?? null,
      ready: condition?.status === 'True',
      podIp: pod.status?.podIP ?? null,
    };
  }

  async streamLogs(podName: string, namespace: string): Promise<NodeJS.ReadableStream> {
    const stream = new PassThrough();
    await this.logClient.log(namespace, podName, 'clawdb', stream, { follow: true, pretty: false });
    return stream;
  }

  private namespaceName(workspaceId: string): string {
    return `clawcloud-${workspaceId.replace(/-/g, '').slice(0, 8)}`;
  }

  private deploymentName(instanceId: string): string {
    return `clawdb-${instanceId}`;
  }

  private buildResources(cpu: number, memoryMb: number) {
    const cpuValue = `${cpu}m`;
    const memoryValue = `${memoryMb}Mi`;
    return {
      requests: { cpu: cpuValue, memory: memoryValue },
      limits: { cpu: cpuValue, memory: memoryValue },
    };
  }

  private requireNamespace(instance: Instance): string {
    if (!instance.kubeNamespace) {
      throw new ServiceUnavailableException('Instance is missing Kubernetes namespace metadata');
    }

    return instance.kubeNamespace;
  }

  private async ensureNamespace(namespace: string, workspaceId: string) {
    try {
      await this.coreApi.readNamespace({ name: namespace });
    } catch {
      const body: V1Namespace = {
        metadata: {
          name: namespace,
          labels: { workspace: workspaceId },
        },
      };
      await this.coreApi.createNamespace({ body });
    }
  }

  private async ensureConfigMap(namespace: string, name: string, workspaceId: string) {
    const body: V1ConfigMap = {
      metadata: { name, namespace },
      data: {
        CLAW_WORKSPACE_ID: workspaceId,
        CLAW_DATA_DIR: '/data',
        CLAW_LOG_LEVEL: 'info',
      },
    };

    await this.applyOrCreateConfigMap(namespace, name, body);
  }

  private async ensurePvc(namespace: string, name: string, storageGi: number) {
    try {
      await this.coreApi.readNamespacedPersistentVolumeClaim({ name, namespace });
    } catch {
      const pvc: V1PersistentVolumeClaim = {
        metadata: { name, namespace },
        spec: {
          accessModes: ['ReadWriteOnce'],
          storageClassName: 'fast-ssd',
          resources: {
            requests: {
              storage: `${storageGi}Gi`,
            },
          },
        },
      };
      await this.coreApi.createNamespacedPersistentVolumeClaim({ namespace, body: pvc });
    }
  }

  private async ensureDeployment(
    namespace: string,
    name: string,
    pvcName: string,
    configMapName: string,
    instance: Instance,
  ) {
    const specs = TIER_SPECS[instance.tier as keyof typeof TIER_SPECS];
    const deployment: V1Deployment = {
      metadata: {
        name,
        namespace,
        labels: { app: name, instanceId: instance.id, workspaceId: instance.workspaceId },
      },
      spec: {
        replicas: 1,
        selector: { matchLabels: { app: name } },
        template: {
          metadata: {
            labels: { app: name, workspaceId: instance.workspaceId },
          },
          spec: {
            containers: [
              {
                name: 'clawdb',
                image: `ghcr.io/claw-db/clawdb-server:${instance.version}`,
                ports: [
                  { containerPort: 50050, name: 'grpc' },
                  { containerPort: 8080, name: 'http' },
                ],
                resources: this.buildResources(specs.cpu, specs.mem),
                envFrom: [{ configMapRef: { name: configMapName } }],
                volumeMounts: [{ mountPath: '/data', name: 'data' }],
                livenessProbe: {
                  tcpSocket: { port: 50050 },
                  initialDelaySeconds: 10,
                  periodSeconds: 10,
                },
                readinessProbe: {
                  httpGet: { path: '/health', port: 8080 },
                  initialDelaySeconds: 5,
                  periodSeconds: 5,
                },
              },
            ],
            volumes: [
              {
                name: 'data',
                persistentVolumeClaim: { claimName: pvcName },
              },
            ],
          },
        },
      },
    };

    try {
      await this.appsApi.readNamespacedDeployment({ name, namespace });
      await this.appsApi.replaceNamespacedDeployment({ name, namespace, body: deployment });
    } catch {
      await this.appsApi.createNamespacedDeployment({ namespace, body: deployment });
    }
  }

  private async ensureService(namespace: string, name: string, selector: string) {
    const service: V1Service = {
      metadata: { name, namespace },
      spec: {
        selector: { app: selector },
        ports: [
          { name: 'grpc', port: 50050, targetPort: 50050 },
          { name: 'http', port: 8080, targetPort: 8080 },
        ],
        type: 'ClusterIP',
      },
    };

    try {
      await this.coreApi.readNamespacedService({ name, namespace });
      await this.coreApi.replaceNamespacedService({ name, namespace, body: service });
    } catch {
      await this.coreApi.createNamespacedService({ namespace, body: service });
    }
  }

  private async ensureNetworkPolicy(namespace: string, appName: string, workspaceId: string) {
    try {
      await this.networkingApi.readNamespacedNetworkPolicy({ name: appName, namespace });
    } catch {
      await this.networkingApi.createNamespacedNetworkPolicy({
        namespace,
        body: {
          metadata: { name: appName, namespace },
          spec: {
            podSelector: { matchLabels: { app: appName, workspaceId } },
            policyTypes: ['Ingress'],
            ingress: [
              {
                _from: [
                  {
                    namespaceSelector: {
                      matchLabels: { name: 'claw-cloud-gateway' },
                    },
                  },
                ],
              },
            ],
          },
        },
      });
    }
  }

  private async waitForPodRunning(namespace: string, deploymentName: string) {
    const deadline = Date.now() + KUBE_READY_TIMEOUT_MS;

    while (Date.now() < deadline) {
      const pods = await this.coreApi.listNamespacedPod({
        namespace,
        labelSelector: `app=${deploymentName}`,
      });
      const running = pods.items.find((item) => item.status?.phase === 'Running');
      if (running) {
        return running;
      }

      await new Promise((resolve) => setTimeout(resolve, KUBE_READY_POLL_MS));
    }

    throw new ServiceUnavailableException(`Timed out waiting for pod ${deploymentName}`);
  }

  private async scaleReplicas(instance: Instance, replicas: number) {
    const namespace = this.requireNamespace(instance);
    const deploymentName = this.deploymentName(instance.id);
    await this.appsApi.patchNamespacedDeploymentScale(
      {
        name: deploymentName,
        namespace,
        body: { spec: { replicas } },
      },
    );
  }

  private async applyOrCreateConfigMap(namespace: string, name: string, body: V1ConfigMap) {
    try {
      await this.coreApi.replaceNamespacedConfigMap({ name, namespace, body });
    } catch (error) {
      this.logger.debug(`Creating config map ${namespace}/${name}: ${String(error)}`);
      await this.coreApi.createNamespacedConfigMap({ namespace, body });
    }
  }
}