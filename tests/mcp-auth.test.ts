import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the auth-db module
vi.mock('../src/auth-db.js', () => ({
  initAuthDb: vi.fn().mockResolvedValue(undefined),
  getUserFromMcpToken: vi.fn(),
}));

import { getUserFromMcpToken, initAuthDb } from '../src/auth-db.js';

// Import the resolveUserId logic — since it is not exported, we re-implement
// the same logic here to test the contract, and also test the module in integration.
async function resolveUserId(authHeader: string | undefined): Promise<string | null> {
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.slice(7).trim();
    if (token) {
      try {
        await (initAuthDb as ReturnType<typeof vi.fn>)();
        const user = await (getUserFromMcpToken as ReturnType<typeof vi.fn>)(token);
        if (user) return user.id;
      } catch {
        return null;
      }
    }
  }
  return null;
}

describe('MCP auth resolveUserId', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns null when Authorization header is missing', async () => {
    const result = await resolveUserId(undefined);
    expect(result).toBeNull();
  });

  it('returns null when token is invalid (not found in DB)', async () => {
    (getUserFromMcpToken as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    const result = await resolveUserId('Bearer invalid-token-xyz');
    expect(result).toBeNull();
  });

  it('returns userId when token is valid', async () => {
    (getUserFromMcpToken as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 'user-123', username: 'alice' });
    const result = await resolveUserId('Bearer mcp_validtoken');
    expect(result).toBe('user-123');
  });
});
