// Shared TypeScript interfaces for User entities
export type WorkspacePlan = 'FREE' | 'STARTER' | 'PRO' | 'ENTERPRISE';
export type WorkspaceStatus = 'ACTIVE' | 'SUSPENDED' | 'DELETED';
export type MemberRole = 'OWNER' | 'ADMIN' | 'DEVELOPER' | 'READONLY';
export type InstanceRegion = 'US_EAST' | 'US_WEST' | 'EU_WEST' | 'EU_CENTRAL' | 'APAC_EAST';
export type InstanceStatus =
  | 'PROVISIONING'
  | 'RUNNING'
  | 'SCALING'
  | 'PAUSED'
  | 'TERMINATING'
  | 'TERMINATED'
  | 'ERROR';
export type InstanceTier = 'NANO' | 'MICRO' | 'SMALL' | 'MEDIUM' | 'LARGE' | 'XL';
export type ActorType = 'USER' | 'API_KEY' | 'SYSTEM';
export type SubscriptionStatus = 'ACTIVE' | 'PAST_DUE' | 'CANCELED' | 'TRIALING';
export type BackupType = 'SCHEDULED' | 'MANUAL';
export type ReplicationStatus = 'ACTIVE' | 'PAUSED' | 'LAGGING' | 'BROKEN';
export type WebhookEventType =
  | 'instance.created'
  | 'instance.status_changed'
  | 'instance.terminated'
  | 'backup.completed'
  | 'backup.failed'
  | 'replication.lagging'
  | 'replication.broken'
  | 'billing.subscription_updated'
  | 'billing.payment_failed'
  | 'billing.invoice_created'
  | 'security.access_denied'
  | 'member.joined'
  | 'member.removed';

export interface UserDto {
  id: string;
  email: string;
  name: string;
  avatarUrl?: string | null;
  emailVerified?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface SessionDto {
  id: string;
  userId: string;
  expiresAt: Date;
  createdAt: Date;
}

export interface WorkspaceDto {
  id: string;
  slug: string;
  name: string;
  ownerId: string;
  plan: WorkspacePlan;
  status: WorkspaceStatus;
  trialEndsAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface UsageMetrics {
  memoryOpsCount: number;
  storageGbHours: number;
  vectorOpsCount: number;
  syncOpsCount: number;
  bandwidthGb: number;
  reflectJobsCount: number;
  computeMinutes: number;
}

export interface UsageLineItem {
  metric: keyof UsageMetrics;
  quantity: number;
  included: number;
  billableQuantity: number;
  unitPriceUsd: number;
  amountUsd: number;
}

export interface UsageBill {
  workspaceId: string;
  period: Date;
  currency: 'usd';
  lineItems: UsageLineItem[];
  totalUsd: number;
}

export interface InstanceStatusResponse {
  id: string;
  status: InstanceStatus;
  podStatus: string;
  podPhase?: string | null;
  message?: string | null;
  endpoint?: string | null;
  podName?: string | null;
  namespace?: string | null;
  updatedAt: Date;
}

export interface ConnectionInfo {
  grpcEndpoint?: string | null;
  httpEndpoint?: string | null;
  apiKeyHint?: string | null;
  region: InstanceRegion;
  tlsCert?: string | null;
}

export interface HealthResult {
  ok: boolean;
  status: number;
  latencyMs: number;
  checkedAt: Date;
  body?: unknown;
}

export interface PodStatus {
  phase: string;
  reason?: string | null;
  message?: string | null;
  ready: boolean;
  podIp?: string | null;
}

export interface QueueJobPayload {
  workspaceId: string;
  instanceId?: string;
  backupId?: string;
  invitationId?: string;
  webhookId?: string;
  deliveryId?: string;
  [key: string]: unknown;
}

export interface VectorRecord {
  id?: string;
  content?: string | null;
  metadata?: Record<string, unknown>;
  tags?: string[];
  embedding: number[];
}

export interface SearchResult {
  id: string;
  content: string | null;
  metadata: Record<string, unknown> | null;
  tags: string[];
  score: number;
}

export interface CollectionStat {
  name: string;
  rowCount: number;
  totalBytes: number;
  indexBytes: number;
}

export interface ScimPatchOp {
  op: 'add' | 'replace' | 'remove';
  path?: string;
  value?: unknown;
}

export interface ScimListResponse<T = unknown> {
  schemas: string[];
  totalResults: number;
  startIndex: number;
  itemsPerPage: number;
  Resources: T[];
}

export interface VerifyResult {
  ok: boolean;
  totalChecked: number;
  firstInvalidId: string | null;
}
