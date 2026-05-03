// Shared constants for plans, limits, regions, and error codes
export const WORKSPACE_TRIAL_DAYS = 14;
export const INVITATION_EXPIRY_DAYS = 7;
export const INVITATION_TOKEN_BYTES = 32;
export const API_KEY_PREFIX_LENGTH = 12;
export const API_KEY_ROTATION_GRACE_PERIOD_SECONDS = 15 * 60;
export const API_KEY_LAST_USED_DEBOUNCE_MS = 5 * 60 * 1000;
export const WEBHOOK_SECRET_BYTES = 32;
export const WEBHOOK_TIMEOUT_MS = 5000;
export const USAGE_FLUSH_INTERVAL_SECONDS = 60;
export const PERSISTENT_VOLUME_RETENTION_HOURS = 48;
export const KUBE_READY_TIMEOUT_MS = 120_000;
export const KUBE_READY_POLL_MS = 3_000;
export const BACKUP_SNAPSHOT_TIMEOUT_MS = 10 * 60 * 1000;
export const BACKUP_SNAPSHOT_POLL_MS = 5_000;

export const PLANS = {
  FREE: {
    name: 'Free',
    maxInstances: 1,
    maxMembers: 3,
    maxStorageGb: 5,
    maxBackupDays: 3,
  },
  STARTER: {
    name: 'Starter',
    maxInstances: 3,
    maxMembers: 10,
    maxStorageGb: 50,
    maxBackupDays: 7,
  },
  PRO: {
    name: 'Pro',
    maxInstances: 10,
    maxMembers: 50,
    maxStorageGb: 500,
    maxBackupDays: 30,
  },
  ENTERPRISE: {
    name: 'Enterprise',
    maxInstances: -1, // unlimited
    maxMembers: -1,
    maxStorageGb: -1,
    maxBackupDays: 90,
  },
} as const;

export const PLAN_LIMITS = {
  FREE: {
    rpmLimit: 60,
    maxInstances: 1,
    maxMembers: 3,
    maxTier: 'NANO',
  },
  STARTER: {
    rpmLimit: 300,
    maxInstances: 3,
    maxMembers: 10,
    maxTier: 'SMALL',
  },
  PRO: {
    rpmLimit: 2000,
    maxInstances: 10,
    maxMembers: 50,
    maxTier: 'XL',
  },
  ENTERPRISE: {
    rpmLimit: 10000,
    maxInstances: Number.MAX_SAFE_INTEGER,
    maxMembers: Number.MAX_SAFE_INTEGER,
    maxTier: 'XL',
  },
} as const;

export const REGIONS = {
  US_EAST: { label: 'US East (N. Virginia)', flag: '🇺🇸' },
  US_WEST: { label: 'US West (Oregon)', flag: '🇺🇸' },
  EU_WEST: { label: 'EU West (Ireland)', flag: '🇮🇪' },
  EU_CENTRAL: { label: 'EU Central (Frankfurt)', flag: '🇩🇪' },
  APAC_EAST: { label: 'APAC East (Tokyo)', flag: '🇯🇵' },
} as const;

export const INSTANCE_TIERS = {
  NANO: { label: 'Nano', cpuMillicores: 250, memoryMb: 512, storageGb: 5 },
  MICRO: { label: 'Micro', cpuMillicores: 500, memoryMb: 1024, storageGb: 20 },
  SMALL: { label: 'Small', cpuMillicores: 1000, memoryMb: 2048, storageGb: 50 },
  MEDIUM: { label: 'Medium', cpuMillicores: 2000, memoryMb: 4096, storageGb: 100 },
  LARGE: { label: 'Large', cpuMillicores: 4000, memoryMb: 8192, storageGb: 200 },
  XL: { label: 'XL', cpuMillicores: 8000, memoryMb: 16384, storageGb: 500 },
} as const;

export const TIER_SPECS = {
  NANO: { cpu: 250, mem: 512, storage: 5 },
  MICRO: { cpu: 500, mem: 1024, storage: 20 },
  SMALL: { cpu: 1000, mem: 2048, storage: 50 },
  MEDIUM: { cpu: 2000, mem: 4096, storage: 100 },
  LARGE: { cpu: 4000, mem: 8192, storage: 200 },
  XL: { cpu: 8000, mem: 16384, storage: 500 },
} as const;

export const BACKUP_RETENTION_DAYS = {
  NANO: 3,
  MICRO: 3,
  SMALL: 7,
  MEDIUM: 7,
  LARGE: 30,
  XL: 30,
} as const;

export const QUEUE_NAMES = {
  PROVISION: 'provision',
  BILLING: 'billing',
  BACKUP: 'backup',
  REPLICATION: 'replication',
  EMAIL: 'email',
  CLEANUP: 'cleanup',
  WEBHOOK: 'webhooks',
} as const;

export const JOB_NAMES = {
  WELCOME_EMAIL: 'welcome-email',
  INVITATION_EMAIL: 'invitation-email',
  RECEIPT_EMAIL: 'receipt-email',
  DUNNING_EMAIL: 'dunning-email',
  PROVISION_INSTANCE: 'provision-instance',
  SCALE_INSTANCE: 'scale-instance',
  PAUSE_INSTANCE: 'pause-instance',
  RESUME_INSTANCE: 'resume-instance',
  TERMINATE_INSTANCE: 'terminate-instance',
  WORKSPACE_CLEANUP: 'workspace-cleanup',
  FLUSH_USAGE: 'flush-usage',
  STORAGE_SNAPSHOT: 'storage-snapshot',
  BILLING_PERIOD: 'billing-period',
  CREATE_BACKUP: 'create-backup',
  RESTORE_BACKUP: 'restore-backup',
  BACKUP_SCHEDULE: 'backup-schedule',
  CONFIGURE_SYNC: 'configure-sync',
  DECONFIGURE_SYNC: 'deconfigure-sync',
  WEBHOOK_DELIVERY: 'webhook-delivery',
} as const;

export const JWT_EXPIRY = '7d';
export const SESSION_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
export const MAGIC_LINK_TTL_SECONDS = 900; // 15 minutes
export const BCRYPT_ROUNDS = 12;

export const USAGE_INCLUDED_ALLOWANCES = {
  FREE: {
    memoryOpsCount: 10000,
    vectorOpsCount: 1000,
    syncOpsCount: 1000,
    bandwidthGb: 1,
    reflectJobsCount: 10,
    computeMinutes: 1440,
    storageGbHours: 120,
  },
  STARTER: {
    memoryOpsCount: 250000,
    vectorOpsCount: 25000,
    syncOpsCount: 25000,
    bandwidthGb: 50,
    reflectJobsCount: 1000,
    computeMinutes: 43200,
    storageGbHours: 2000,
  },
  PRO: {
    memoryOpsCount: 2000000,
    vectorOpsCount: 250000,
    syncOpsCount: 250000,
    bandwidthGb: 500,
    reflectJobsCount: 10000,
    computeMinutes: 216000,
    storageGbHours: 10000,
  },
  ENTERPRISE: {
    memoryOpsCount: Number.MAX_SAFE_INTEGER,
    vectorOpsCount: Number.MAX_SAFE_INTEGER,
    syncOpsCount: Number.MAX_SAFE_INTEGER,
    bandwidthGb: Number.MAX_SAFE_INTEGER,
    reflectJobsCount: Number.MAX_SAFE_INTEGER,
    computeMinutes: Number.MAX_SAFE_INTEGER,
    storageGbHours: Number.MAX_SAFE_INTEGER,
  },
} as const;

export const USAGE_RATES_USD = {
  memoryOpsCount: 0.000002,
  storageGbHours: 0.00015,
  vectorOpsCount: 0.00001,
  syncOpsCount: 0.00002,
  bandwidthGb: 0.12,
  reflectJobsCount: 0.01,
  computeMinutes: 0.0025,
} as const;
