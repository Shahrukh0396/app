import { PrismaClient } from '@prisma/client';
import * as argon2 from 'argon2';

const prisma = new PrismaClient();

async function main(): Promise<void> {
  if (process.env.SEED_DEMO !== 'true') {
    console.log('SEED_DEMO is not true; demo user was not created');
    return;
  }
  const email = 'demo@scanflow.app';
  const password = process.env.SEED_DEMO_PASSWORD ?? 'scanflow-demo-password';
  const passwordHash = await argon2.hash(password);
  const user = await prisma.user.upsert({
    where: { email },
    update: {},
    create: {
      name: 'Scanflow Demo',
      email,
      passwordHash,
      provider: 'EMAIL',
      role: 'USER',
      subscription: { create: { plan: 'FREE', status: 'ACTIVE' } },
      notifications: { create: {} },
    },
  });
  console.log(`Demo user ready: ${user.email}`);
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
