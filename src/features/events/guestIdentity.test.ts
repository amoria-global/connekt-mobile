import { accountIdentity, isEmail, loadGuestIdentity, saveGuestIdentity } from './guestIdentity';

const mockStore = new Map<string, string>();
jest.mock('@/services/storage', () => ({
  storage: {
    get: async (k: string) => mockStore.get(k) ?? null,
    set: async (k: string, v: string) => {
      mockStore.set(k, v);
    },
  },
}));

beforeEach(() => mockStore.clear());

describe('account identity', () => {
  it('is the account name and email when it has both', () => {
    expect(accountIdentity({ firstName: 'Joseph', lastName: 'Maranatha', email: 'joseph@example.test' })).toEqual({ name: 'Joseph Maranatha', email: 'joseph@example.test' });
    expect(accountIdentity({ firstName: 'Joseph', email: ' joseph@example.test ' })).toEqual({ name: 'Joseph', email: 'joseph@example.test' });
  });

  it('is nothing when the account lacks a name or a usable email, so the person is asked', () => {
    expect(accountIdentity(null)).toBeNull();
    expect(accountIdentity({ email: 'joseph@example.test' })).toBeNull();
    expect(accountIdentity({ firstName: 'Joseph', email: 'not-an-email' })).toBeNull();
  });

  it('checks an email the way the web does', () => {
    expect(isEmail('a@b.co')).toBe(true);
    expect(isEmail('a@b')).toBe(false);
    expect(isEmail('a b@c.com')).toBe(false);
  });
});

describe('a guest remembered on the device', () => {
  it('saves what was typed and gives it back, under the web key', async () => {
    await saveGuestIdentity({ name: 'Aline', email: 'aline@example.test' });
    expect(mockStore.get('eventWishIdentity')).toBe(JSON.stringify({ name: 'Aline', email: 'aline@example.test' }));
    await expect(loadGuestIdentity()).resolves.toEqual({ name: 'Aline', email: 'aline@example.test' });
  });

  it('gives nothing, and does not throw, when nothing or garbage was saved', async () => {
    await expect(loadGuestIdentity()).resolves.toEqual({});
    mockStore.set('eventWishIdentity', '{not json');
    await expect(loadGuestIdentity()).resolves.toEqual({});
  });
});
