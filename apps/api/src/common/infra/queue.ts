import { Queue } from 'bullmq';
import { getRedis } from './redis.js';

const queues = new Map<string, Queue>();

export function getQueue(name: string) {
  const existing = queues.get(name);
  if (existing) {
    return existing;
  }

  const queue = new Queue(name, { connection: getRedis() });
  queues.set(name, queue);
  return queue;
}