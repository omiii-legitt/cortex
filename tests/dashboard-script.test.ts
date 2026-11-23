import { describe, it, expect, vi } from 'vitest';
import { execSync } from 'child_process';
import { readFileSync } from 'fs';
import { resolve } from 'path';

// Mocks must be at top level — they are hoisted by vitest
vi.mock('../src/auth.js', () => ({
  getUserFromRequest: vi.fn().mockResolvedValue({
    id: 'user-test-1',
    github_id: '12345',
    username: 'testuser',
    email: null,
    avatar_url: null,
    created_at: new Date().toISOString(),
  }),
}));

vi.mock('../src/auth-db.js', () => ({
  initAuthDb: vi.fn().mockResolvedValue(undefined),
  getMcpToken: vi.fn().mockResolvedValue(null),
  createMcpToken: vi.fn().mockResolvedValue('mcp_newtoken'),
  getUserFromMcpToken: vi.fn().mockResolvedValue(null),
}));

// ---- Test 1: node --check syntax ----
describe('public/dashboard.js', () => {
  it('passes node --check (no syntax errors)', () => {
    const filePath = resolve('public/dashboard.js');
    expect(() => {
      execSync(`node --check "${filePath}"`, { stdio: 'pipe' });
    }).not.toThrow();
  });

  it('contains only ASCII characters (no non-ASCII bytes)', () => {
    const filePath = resolve('public/dashboard.js');
    const content = readFileSync(filePath, 'utf8');
    for (let i = 0; i < content.length; i++) {
      expect(content.charCodeAt(i)).toBeLessThanOrEqual(127);
    }
  });
});

// ---- Test 3: dashboard handler renders <script src> ----
describe('dashboard handler', () => {
  it('serves HTML with <script src="/public/dashboard.js">', async () => {
    const { default: dashboardHandler } = await import('../src/api/dashboard.js');

    const req = { headers: { cookie: 'session=fake-session-id' }, method: 'GET' } as any;
    let capturedHtml = '';
    const res = {
      setHeader: vi.fn(),
      status: vi.fn().mockReturnThis(),
      send: vi.fn().mockImplementation((body: string) => { capturedHtml = body; }),
    } as any;

    await dashboardHandler(req, res);

    expect(capturedHtml).toContain('<script src="/public/dashboard.js">');
    expect(capturedHtml).not.toContain('<script>');
  });
});

// ---- Tests 4 & 5: /api/auth/token returns 401 without session ----
describe('/api/auth/token', () => {
  it('GET returns 401 without a session cookie', async () => {
    const { getUserFromRequest } = await import('../src/auth.js');
    (getUserFromRequest as ReturnType<typeof vi.fn>).mockResolvedValueOnce(null);

    const { default: tokenHandler } = await import('../src/api/auth/token.js');

    const req = { headers: {}, method: 'GET' } as any;
    let statusCode = 0;
    let jsonBody: unknown = null;
    const res = {
      setHeader: vi.fn(),
      status: vi.fn().mockImplementation((code: number) => { statusCode = code; return res; }),
      json: vi.fn().mockImplementation((body: unknown) => { jsonBody = body; return res; }),
    } as any;

    await tokenHandler(req, res);

    expect(statusCode).toBe(401);
    expect((jsonBody as any).error).toBe('Unauthorized');
  });

  it('POST returns 401 without a session cookie', async () => {
    const { getUserFromRequest } = await import('../src/auth.js');
    (getUserFromRequest as ReturnType<typeof vi.fn>).mockResolvedValueOnce(null);

    const { default: tokenHandler } = await import('../src/api/auth/token.js');

    const req = { headers: {}, method: 'POST' } as any;
    let statusCode = 0;
    let jsonBody: unknown = null;
    const res = {
      setHeader: vi.fn(),
      status: vi.fn().mockImplementation((code: number) => { statusCode = code; return res; }),
      json: vi.fn().mockImplementation((body: unknown) => { jsonBody = body; return res; }),
    } as any;

    await tokenHandler(req, res);

    expect(statusCode).toBe(401);
    expect((jsonBody as any).error).toBe('Unauthorized');
  });
});
