// Shared constants for plans, limits, regions, and error codes
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

export const REGIONS = {
  US_EAST: { label: 'US East (N. Virginia)', flag: '🇺🇸' },
  US_WEST: { label: 'US West (Oregon)', flag: '🇺🇸' },
  EU_WEST: { label: 'EU West (Ireland)', flag: '🇮🇪' },
  EU_CENTRAL: { label: 'EU Central (Frankfurt)', flag: '🇩🇪' },
  APAC_EAST: { label: 'APAC East (Tokyo)', flag: '🇯🇵' },
} as const;

export const INSTANCE_TIERS = {
  NANO: { label: 'Nano', cpuMillicores: 250, memoryMb: 512, storageGb: 10 },
  MICRO: { label: 'Micro', cpuMillicores: 500, memoryMb: 1024, storageGb: 20 },
  SMALL: { label: 'Small', cpuMillicores: 1000, memoryMb: 2048, storageGb: 50 },
  MEDIUM: { label: 'Medium', cpuMillicores: 2000, memoryMb: 4096, storageGb: 100 },
  LARGE: { label: 'Large', cpuMillicores: 4000, memoryMb: 8192, storageGb: 250 },
  XL: { label: 'XL', cpuMillicores: 8000, memoryMb: 16384, storageGb: 500 },
} as const;

export const JWT_EXPIRY = '7d';
export const SESSION_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
export const MAGIC_LINK_TTL_SECONDS = 900; // 15 minutes
export const BCRYPT_ROUNDS = 12;
export const API_KEY_PREFIX_LENGTH = 8;
export const INVITATION_EXPIRY_DAYS = 7;
