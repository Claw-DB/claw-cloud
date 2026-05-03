// Shared TypeScript interfaces for User entities
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
