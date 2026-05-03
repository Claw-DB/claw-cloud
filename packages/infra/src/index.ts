// IaC helpers — Kubernetes manifest generation and Pulumi resource utilities for ClawDB instances
export interface InstanceManifestOptions {
  name: string;
  namespace: string;
  image: string;
  version: string;
  cpuMillicores: number;
  memoryMb: number;
  storageGb: number;
  region: string;
}

/**
 * Generate a minimal Kubernetes Deployment manifest for a ClawDB instance pod.
 */
export function generateInstanceManifest(opts: InstanceManifestOptions): object {
  return {
    apiVersion: 'apps/v1',
    kind: 'Deployment',
    metadata: {
      name: opts.name,
      namespace: opts.namespace,
      labels: { app: 'clawdb', instance: opts.name, region: opts.region },
    },
    spec: {
      replicas: 1,
      selector: { matchLabels: { app: 'clawdb', instance: opts.name } },
      template: {
        metadata: { labels: { app: 'clawdb', instance: opts.name } },
        spec: {
          containers: [
            {
              name: 'clawdb',
              image: `${opts.image}:${opts.version}`,
              resources: {
                requests: {
                  cpu: `${opts.cpuMillicores}m`,
                  memory: `${opts.memoryMb}Mi`,
                },
                limits: {
                  cpu: `${opts.cpuMillicores * 2}m`,
                  memory: `${opts.memoryMb * 2}Mi`,
                },
              },
            },
          ],
        },
      },
    },
  };
}
