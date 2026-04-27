import { mock } from "bun:test";

export const TEST_USER = {
  id: "user-test-123",
  name: "Test User",
  email: "test@example.com",
  emailVerified: true,
  image: null,
  createdAt: new Date("2025-01-01"),
  updatedAt: new Date("2025-01-01"),
};

export const TEST_SESSION = {
  user: TEST_USER,
  session: {
    id: "session-test-456",
    token: "test-token",
    userId: TEST_USER.id,
    expiresAt: new Date(Date.now() + 86400000),
    createdAt: new Date("2025-01-01"),
    updatedAt: new Date("2025-01-01"),
    ipAddress: null,
    userAgent: null,
  },
};

export const mockGetSession = mock(() => Promise.resolve(TEST_SESSION));

export const mockAuth = {
  api: {
    getSession: mockGetSession,
  },
  handler: mock((req: Request) => new Response("ok")),
};

export function authedRequest(path: string, init?: RequestInit): Request {
  return new Request(`http://localhost${path}`, {
    ...init,
    headers: {
      cookie: "better-auth.session_token=test-token",
      ...((init?.headers as Record<string, string>) ?? {}),
    },
  });
}
