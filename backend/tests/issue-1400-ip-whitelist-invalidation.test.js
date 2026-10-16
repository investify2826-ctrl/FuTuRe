import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const publishMock = vi.fn();
const subscribeMock = vi.fn();
const subscriberHandlers = new Map();

vi.mock('../src/cache/redis.js', () => ({
  createRedisBackend: () => ({
    connect: vi.fn().mockResolvedValue(undefined),
    client: {
      status: 'ready',
      publish: publishMock,
      duplicate: () => ({
        on: (event, handler) => subscriberHandlers.set(event, handler),
        connect: vi.fn().mockResolvedValue(undefined),
        subscribe: subscribeMock,
      }),
    },
  }),
}));

vi.mock('../src/db/client.js', () => ({
  default: {
    iPWhitelist: {
      findMany: vi.fn().mockResolvedValue([]),
      create: vi.fn(),
      delete: vi.fn(),
      deleteMany: vi.fn(),
    },
  },
}));
vi.mock('../src/db/adminAuditLog.js', () => ({ logAdminAction: vi.fn().mockResolvedValue({}) }));
vi.mock('../src/config/logger.js', () => ({
  default: { info: vi.fn(), error: vi.fn(), warn: vi.fn() },
}));

const { addToWhitelist, getWhitelist, initializeCache, removeFromWhitelist } = await import(
  '../src/security/ipWhitelist.js'
);
const prisma = (await import('../src/db/client.js')).default;

const CHANNEL = 'channel:ip_whitelist_updates';

describe('IP whitelist distributed invalidation', () => {
  beforeAll(async () => {
    vi.clearAllMocks();
    await initializeCache();
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('publishes additions and removals for other ECS tasks', async () => {
    prisma.iPWhitelist.create.mockResolvedValue({ ipAddress: '10.0.0.7', reason: 'office' });
    prisma.iPWhitelist.delete.mockResolvedValue({});

    await addToWhitelist('10.0.0.7', 'office');
    expect(publishMock).toHaveBeenCalledWith(
      CHANNEL,
      JSON.stringify({ action: 'add', entry: { ipAddress: '10.0.0.7', reason: 'office' } }),
    );

    await removeFromWhitelist('10.0.0.7');
    expect(publishMock).toHaveBeenCalledWith(
      CHANNEL,
      JSON.stringify({ action: 'remove', ipAddress: '10.0.0.7' }),
    );
  });

  it('applies a remote invalidation message to the local cache', async () => {
    const handler = subscriberHandlers.get('message');
    expect(handler).toBeTypeOf('function');

    handler(CHANNEL, JSON.stringify({ action: 'add', entry: { ipAddress: '10.0.0.8' } }));
    expect(getWhitelist()).toContain('10.0.0.8');

    handler(CHANNEL, JSON.stringify({ action: 'remove', ipAddress: '10.0.0.8' }));
    expect(getWhitelist()).not.toContain('10.0.0.8');
  });
});
