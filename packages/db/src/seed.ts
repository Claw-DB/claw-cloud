// Dev database seed script — populates initial data for LOCAL DEVELOPMENT ONLY.
// The admin password is read from SEED_ADMIN_PASSWORD env var (with a dev-only fallback).
// Never run this seed against production without setting a strong SEED_ADMIN_PASSWORD.
import { prisma } from './index.js';
import * as bcrypt from 'bcrypt';

async function main() {
  console.log('🌱 Seeding database (LOCAL DEV ONLY)...');

  const devPassword = process.env.SEED_ADMIN_PASSWORD ?? 'dev-only-change-me-in-prod!';
  const passwordHash = await bcrypt.hash(devPassword, 12);
  const admin = await prisma.user.upsert({
    where: { email: 'admin@claw.cloud' },
    update: {},
    create: {
      email: 'admin@claw.cloud',
      name: 'Admin User',
      passwordHash,
      emailVerified: new Date(),
    },
  });

  // Create demo workspace
  const workspace = await prisma.workspace.upsert({
    where: { slug: 'demo' },
    update: {},
    create: {
      slug: 'demo',
      name: 'Demo Workspace',
      ownerId: admin.id,
      plan: 'FREE',
      status: 'ACTIVE',
      members: {
        create: {
          userId: admin.id,
          role: 'OWNER',
        },
      },
    },
  });

  console.log(`✅ Created workspace: ${workspace.slug}`);
  console.log(`✅ Created admin user: ${admin.email}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
