import IORedis from 'ioredis';

let client: IORedis | null = null;

export function getRedis() {
  if (!client) {
    client = new IORedis(process.env.REDIS_URL ?? 'redis://localhost:6379', {
      maxRetriesPerRequest: null,
      lazyConnect: true,
    });
  }

  return client;
}