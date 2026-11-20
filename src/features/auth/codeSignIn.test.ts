import fs from 'fs';
import path from 'path';

import { api } from '@/api/client';
import { completeWorkspaceSetup, verifyLoginCode } from './api';
import { codeSignInRemembered, rememberCodeSignIn } from './codeSignIn';

/**
 * "Sign in with an email code" is for invited team members only: for every other address the server sends nothing.
 * Offered to everyone under "Forgot your password?", people took it for a password reset and waited for a code that
 * never came. The sign-in screen now offers it only on a device where a team-member login has already signed in.
 */
const mockStore = new Map<string, string>();
jest.mock('@/services/storage', () => ({
  storage: {
    get: jest.fn(async (k: string) => mockStore.get(k) ?? null),
    set: jest.fn(async (k: string, v: string) => { mockStore.set(k, v); }),
    remove: jest.fn(async (k: string) => { mockStore.delete(k); }),
  },
  StorageKeys: {
    authToken: 'auth.token', refreshToken: 'auth.refreshToken', session: 'auth.session', activeWorkspace: 'workspace.active',
    codeSignIn: 'auth.codeSignIn',
  },
}));
jest.mock('@/api/client', () => ({ api: { post: jest.fn(), get: jest.fn() } }));

const signedIn = (customerType: string) => ({ action: 1, token: 't', refreshToken: 'r', customerId: 'c1', email: 'a@b.co', customerType });

beforeEach(() => { mockStore.clear(); jest.clearAllMocks(); });

describe('the device remembers a team-member sign-in', () => {
  it('starts without it, and keeps it once set', async () => {
    expect(await codeSignInRemembered()).toBe(false);
    expect(await rememberCodeSignIn()).toBe(true);
    expect(await codeSignInRemembered()).toBe(true);
  });

  it('is set by a team-member sign-in with an emailed code', async () => {
    (api.post as jest.Mock).mockResolvedValueOnce(signedIn('COLLABORATOR'));
    await verifyLoginCode('a@b.co', '123456');
    expect(await codeSignInRemembered()).toBe(true);
  });

  it('is set when a team member first sets up their access', async () => {
    (api.post as jest.Mock).mockResolvedValueOnce(signedIn('COLLABORATOR'));
    await completeWorkspaceSetup({ invitationId: 'i', token: 'k', password: 'Abcdef1@', confirmPassword: 'Abcdef1@' });
    expect(await codeSignInRemembered()).toBe(true);
  });

  it('is not set by anyone else, so an ordinary account never sees the link', async () => {
    for (const type of ['PHOTOGRAPHER', 'CLIENT', 'VIEWER']) {
      (api.post as jest.Mock).mockResolvedValueOnce(signedIn(type));
      await verifyLoginCode('a@b.co', '123456');
    }
    expect(await codeSignInRemembered()).toBe(false);
  });
});

describe('the sign-in screen', () => {
  const login = fs.readFileSync(path.join(__dirname, '../../app/(auth)/login.tsx'), 'utf8');

  it('no longer puts the emailed-code link next to "Forgot your password?"', () => {
    expect(login).not.toContain('Email me a code instead');
  });

  it('offers it only where a team-member login has signed in, with a label that says who it is for', () => {
    expect(login).toMatch(/codeSignInOffered\s*\?/);
    expect(login).toContain('Team member? Sign in with an email code');
  });
});
