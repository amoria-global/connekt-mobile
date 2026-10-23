import React from 'react';
import TestRenderer, { act, type ReactTestInstance } from 'react-test-renderer';
import { Text } from 'react-native';

import JoinInviteScreen from '@/app/(app)/collaborate/join/[token]';

/**
 * The invite landing screen, rendered with react-test-renderer over a FAKE collaboration API and a controlled token.
 * Covers every invite state and a failed or repeated join. It never talks to a backend.
 */
import '@/test/autoUnmount';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const mockPreview = jest.fn();
const mockAccept = jest.fn();
jest.mock('./api', () => ({
  previewInvite: (...a: unknown[]) => mockPreview(...a),
  acceptInvite: (...a: unknown[]) => mockAccept(...a),
}));
jest.mock('./components', () => {
  const { Text: RNText } = jest.requireActual('react-native');
  const { createElement } = jest.requireActual('react');
  return {
    AlbumCover: () => null,
    PersonRow: ({ caption }: { caption: string }) => createElement(RNText, null, caption),
  };
});

const mockReplace = jest.fn();
let mockToken = 'TEST-TOKEN';
jest.mock('expo-router', () => ({
  useLocalSearchParams: () => ({ token: mockToken }),
  useRouter: () => ({ replace: mockReplace, push: jest.fn(), back: jest.fn() }),
}));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));
jest.mock('@/components/ui/Screen', () => ({ Screen: ({ children }: { children: React.ReactNode }) => children }));
jest.mock('@/features/auth/role', () => ({ useRole: () => ({ isPhotographer: true, role: 'Photographer' }) }));
jest.mock('@/store/auth', () => ({
  useAuth: Object.assign((sel: (s: unknown) => unknown) => sel({ user: { customerType: 'PHOTOGRAPHER' } }), {
    getState: () => ({ user: { customerType: 'PHOTOGRAPHER' } }),
  }),
  isApiError: (e: unknown) => !!e && typeof e === 'object' && 'message' in (e as object),
}));

const preview = (state: string) => ({
  state,
  album: { id: 'ca1', title: 'Kigali Wedding Expo' },
  owner: { id: 'o1', name: 'Aline Mukamana' },
});

const text = (n: ReactTestInstance) =>
  n.findAllByType(Text).map((t) => [t.props.children].flat().join('')).filter(Boolean).join(' | ');
const pressable = (r: TestRenderer.ReactTestRenderer, label: string) =>
  r.root.findAll((n) => typeof n.props?.onPress === 'function' && n.findAllByType(Text).length > 0 && text(n) === label)[0];

async function mount() {
  let r!: TestRenderer.ReactTestRenderer;
  await act(async () => {
    r = TestRenderer.create(<JoinInviteScreen />);
  });
  return r;
}

beforeEach(() => {
  mockPreview.mockReset();
  mockAccept.mockReset();
  mockReplace.mockReset();
  mockToken = 'TEST-TOKEN';
});

describe('collaboration invite landing', () => {
  it('shows the album, the owner and what joining means for an open invite', async () => {
    mockPreview.mockResolvedValue(preview('OPEN'));
    const r = await mount();
    expect(mockPreview).toHaveBeenCalledWith('TEST-TOKEN');
    expect(text(r.root)).toContain('Kigali Wedding Expo');
    expect(text(r.root)).toContain('Aline Mukamana reviews each one and decides what is added.');
    expect(pressable(r, 'Join album')).toBeTruthy();
  });

  it.each([
    ['OWNER', 'This is your own album'],
    ['REMOVED', 'You were removed from this album'],
    ['REVOKED', 'This link was cancelled'],
    ['EXPIRED', 'This link has expired'],
  ])('blocks a %s invite with its own explanation and no Join button', async (state, title) => {
    mockPreview.mockResolvedValue(preview(state));
    const r = await mount();
    expect(text(r.root)).toContain(title);
    expect(pressable(r, 'Join album')).toBeUndefined();
    await act(async () => pressable(r, 'Go to Collaborate').props.onPress());
    expect(mockReplace).toHaveBeenCalledWith('/collaborate?tab=joined');
  });

  it('offers Open album, not Join, to someone who is already a member', async () => {
    mockPreview.mockResolvedValue(preview('ALREADY_MEMBER'));
    const r = await mount();
    expect(pressable(r, 'Join album')).toBeUndefined();
    await act(async () => pressable(r, 'Open album').props.onPress());
    expect(mockReplace).toHaveBeenCalledWith('/collaborate/joined/ca1');
  });

  it('says the link does not work, with a way out, when the invite cannot be read', async () => {
    mockPreview.mockRejectedValue({ status: 404, message: 'This invite link is not valid.' });
    const r = await mount();
    expect(text(r.root)).toContain('This invite link does not work');
    expect(text(r.root)).toContain('This invite link is not valid.');
    expect(pressable(r, 'Go to Collaborate')).toBeTruthy();
  });

  it('joins once and opens the album it joined', async () => {
    mockPreview.mockResolvedValue(preview('OPEN'));
    mockAccept.mockResolvedValue('ca1');
    const r = await mount();
    await act(async () => pressable(r, 'Join album').props.onPress());
    expect(mockAccept).toHaveBeenCalledTimes(1);
    expect(mockAccept).toHaveBeenCalledWith('TEST-TOKEN');
    expect(mockReplace).toHaveBeenCalledWith('/collaborate/joined/ca1');
  });

  it('keeps the invite and shows the reason when joining fails, and lets the user try again', async () => {
    mockPreview.mockResolvedValue(preview('OPEN'));
    mockAccept.mockRejectedValueOnce({ status: 409, message: 'This album is full.' });
    const r = await mount();
    await act(async () => pressable(r, 'Join album').props.onPress());
    expect(text(r.root)).toContain('This album is full.');
    expect(mockReplace).not.toHaveBeenCalled();
    mockAccept.mockResolvedValueOnce('ca1');
    await act(async () => pressable(r, 'Join album').props.onPress());
    expect(mockReplace).toHaveBeenCalledWith('/collaborate/joined/ca1');
  });

  it('does not send a second join while the first is in flight', async () => {
    mockPreview.mockResolvedValue(preview('OPEN'));
    let release!: (v: unknown) => void;
    mockAccept.mockReturnValueOnce(new Promise((res) => (release = res)));
    const r = await mount();
    const join = pressable(r, 'Join album');
    await act(async () => {
      join.props.onPress();
    });
    const inert = r.root.findAll((n) => typeof n.props?.onPress === 'function' && n.props?.disabled === true);
    expect(inert.length).toBeGreaterThan(0);
    expect(mockAccept).toHaveBeenCalledTimes(1);
    await act(async () => release('ca1'));
  });

  it('drops the previous album and error when the link changes, so nothing stale shows under the new token', async () => {
    mockPreview.mockResolvedValueOnce(preview('EXPIRED'));
    const r = await mount();
    expect(text(r.root)).toContain('This link has expired');

    mockToken = 'OTHER-TOKEN';
    mockPreview.mockRejectedValueOnce({ status: 404, message: 'This invite link is not valid.' });
    await act(async () => r.update(<JoinInviteScreen />));
    expect(mockPreview).toHaveBeenLastCalledWith('OTHER-TOKEN');
    expect(text(r.root)).toContain('This invite link does not work');
    expect(text(r.root)).not.toContain('This link has expired');

    mockToken = 'THIRD-TOKEN';
    mockPreview.mockResolvedValueOnce(preview('OPEN'));
    await act(async () => r.update(<JoinInviteScreen />));
    expect(text(r.root)).toContain('Kigali Wedding Expo');
    expect(text(r.root)).not.toContain('This invite link is not valid.');
  });
});
