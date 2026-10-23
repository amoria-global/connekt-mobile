import React from 'react';
import TestRenderer, { act, type ReactTestInstance } from 'react-test-renderer';
import { Text } from 'react-native';

/**
 * The owner's Progress tab on the phone, on the real owner-album screen over a fake album: how each photographer who
 * accepted the invitation is getting on, who needs the owner first, a way from each card to that person's photos,
 * people who have left, the empty cases, and the languages the screen is translated into. It never talks to a backend.
 */
import '@/test/autoUnmount';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const mockApi = {
  getOwnedAlbum: jest.fn(),
  createInvite: jest.fn(),
  cancelInvite: jest.fn(),
  removeCollaborator: jest.fn(),
  reviewSubmissions: jest.fn(),
};
jest.mock('./api', () => ({
  getOwnedAlbum: (...a: unknown[]) => mockApi.getOwnedAlbum(...a),
  createInvite: (...a: unknown[]) => mockApi.createInvite(...a),
  cancelInvite: (...a: unknown[]) => mockApi.cancelInvite(...a),
  removeCollaborator: (...a: unknown[]) => mockApi.removeCollaborator(...a),
  reviewSubmissions: (...a: unknown[]) => mockApi.reviewSubmissions(...a),
}));
jest.mock('expo-router', () => {
  const R = require('react');
  return {
    useLocalSearchParams: () => ({ id: 'a1' }),
    useNavigation: () => ({ setOptions: jest.fn() }),
    useFocusEffect: (cb: () => void) => { R.useEffect(() => { cb(); }, []); },
  };
});
jest.mock('@/components/ui/Screen', () => ({ Screen: ({ children }: { children: React.ReactNode }) => children }));
jest.mock('expo-image', () => ({ Image: () => null }));
const mockLang = { language: 'en' };
jest.mock('@/hooks/useLanguage', () => ({ useLanguage: () => mockLang }));
jest.mock('@/features/auth/role', () => ({ useRole: () => ({ isPhotographer: true, role: 'Photographer' }) }));
jest.mock('@/store/auth', () => ({
  isApiError: () => false,
  useAuth: Object.assign((sel: (s: unknown) => unknown) => sel({ user: { customerType: 'PHOTOGRAPHER' } }), { getState: () => ({ user: {} }) }),
}));
const mockAlert = jest.fn();
jest.mock('@/components/ui/dialog', () => ({ Alert: { alert: (...a: unknown[]) => mockAlert(...a) } }));

import OwnerAlbumScreen from '@/app/(app)/collaborate/album/[id]';

const person = (id: string, name: string) => ({ id, name });
const collab = (id: string, name: string, joinedAt = '2026-10-01T09:00:00') => ({ ...person(id, name), membershipId: 'm-' + id, joinedAt });
let n = 0;
const sub = (by: { id: string; name: string }, status: string) => ({
  id: 's' + ++n, albumId: 'a1', imageUrl: 'https://img.test/' + n + '.jpg', thumbnailUrl: 'https://img.test/t' + n + '.jpg', status,
  submittedAt: '2026-10-10T10:00:00', reviewedAt: status === 'PENDING' ? undefined : '2026-10-11T10:00:00', collaborator: person(by.id, by.name),
});
const many = (by: { id: string; name: string }, status: string, count: number) => Array.from({ length: count }, () => sub(by, status));

const eric = collab('e', 'Eric Mugisha');
const chantal = collab('c', 'Chantal Ineza', '2026-10-02T09:00:00');
const olive = collab('o', 'Olive Kamali', '2026-10-03T09:00:00');
const gone = person('g', 'Gone Photographer');

function album(over: Record<string, unknown> = {}) {
  return {
    album: { id: 'a1', title: 'Wedding at the lake', coverImage: undefined, imageCount: 50, createdAt: '2026-09-01T00:00:00' },
    collaborators: [olive, eric, chantal],
    invites: [],
    submissions: [...many(eric, 'APPROVED', 8), ...many(eric, 'PENDING', 4), ...many(eric, 'REJECTED', 1), ...many(chantal, 'APPROVED', 3), ...many(gone, 'APPROVED', 2)],
    ...over,
  };
}

const text = (node: ReactTestInstance) => node.findAllByType(Text).map((t) => [t.props.children].flat().join('')).filter(Boolean).join(' | ');
async function mount(detail = album()) {
  mockApi.getOwnedAlbum.mockResolvedValue(detail);
  let r!: TestRenderer.ReactTestRenderer;
  await act(async () => { r = TestRenderer.create(<OwnerAlbumScreen />); });
  await act(async () => {});
  await act(async () => {});
  return r;
}
const press = (r: TestRenderer.ReactTestRenderer, label: string) =>
  r.root.findAll((x) => typeof x.props?.onPress === 'function' && (x.props.accessibilityLabel === label || (x.findAllByType(Text).length > 0 && text(x) === label)))[0];
async function tap(r: TestRenderer.ReactTestRenderer, label: string) {
  const el = press(r, label);
  if (!el) throw new Error('control not found: ' + label);
  await act(async () => { el.props.onPress(); });
}
const tabLabels = (r: TestRenderer.ReactTestRenderer) => r.root.findAll((x) => x.props?.accessibilityRole === 'button' && x.props.accessibilityState && 'selected' in x.props.accessibilityState && typeof x.props.onPress === 'function').map((x) => text(x)).filter(Boolean);
const cards = (r: TestRenderer.ReactTestRenderer) => r.root.findAll((x) => x.props?.testID === 'contributor-card' && typeof x.type === 'string');
const cardOf = (r: TestRenderer.ReactTestRenderer, name: string) => cards(r).find((c) => (c.props.accessibilityLabel as string).startsWith(name))!;
const openProgress = async (r: TestRenderer.ReactTestRenderer) => tap(r, 'Progress (3)');

beforeEach(() => {
  Object.values(mockApi).forEach((m) => m.mockReset());
  mockAlert.mockReset();
  mockLang.language = 'en';
});

describe('the Progress tab on the phone', () => {
  it('is its own tab, between Review and History', async () => {
    const r = await mount();
    expect(tabLabels(r)).toEqual(['Review (4)', 'Progress (3)', 'History']);
  });

  it('summarises the whole album and says who is waiting', async () => {
    const r = await mount();
    await openProgress(r);
    const summary = text(r.root.findAll((x) => x.props?.testID === 'progress-summary' && typeof x.type === 'string')[0]);
    expect(summary).toContain('Collaboration progress');
    expect(summary).toContain('2 of 3 collaborator(s) submitted photos. 1 waiting for you.');
    expect(summary).toContain('Submitted | 18');
    expect(summary).toContain('Added to album | 13');
    expect(summary).toContain('Waiting for you | 4');
    expect(summary).toContain('Not accepted | 1');
  });

  it('shows a card for each collaborator, those who need the owner first and those who have not started last', async () => {
    const r = await mount();
    await openProgress(r);
    expect(cards(r).map((c) => (c.props.accessibilityLabel as string).split(',')[0])).toEqual(['Eric Mugisha', 'Chantal Ineza', 'Olive Kamali', 'Gone Photographer']);
    expect(cards(r).map((c) => (c.props.accessibilityLabel as string).split(', ')[1])).toEqual(['4 to review', 'Up to date', 'No photos yet', 'Up to date']);
  });

  it('breaks a collaborator down in words and numbers, with their share of the album', async () => {
    const r = await mount();
    await openProgress(r);
    const e = text(cardOf(r, 'Eric Mugisha'));
    expect(e).toContain('4 to review');
    expect(e).toContain('8 added');
    expect(e).toContain('4 waiting');
    expect(e).toContain('1 not accepted');
    expect(e).toContain('Accounts for 16% of this album. 89% of reviewed photos were added.');
    const bar = cardOf(r, 'Eric Mugisha').findAll((x) => x.props?.accessibilityRole === 'image')[0];
    expect(bar.props.accessibilityLabel).toBe('8 added, 4 waiting, 1 not accepted');
  });

  it('says plainly that a collaborator who has not sent anything has not started', async () => {
    const r = await mount();
    await openProgress(r);
    const o = cardOf(r, 'Olive Kamali');
    expect(text(o)).toContain('Accepted your invitation but has not sent a photo yet.');
    expect(o.findAll((x) => x.props?.accessibilityRole === 'image')).toHaveLength(0);
    expect(press(r, 'Remove Olive Kamali')).toBeDefined();
  });

  it('lists people who left apart, with nothing to manage', async () => {
    const r = await mount();
    await openProgress(r);
    const past = r.root.findAll((x) => x.props?.testID === 'former-contributors' && typeof x.type === 'string')[0];
    expect(text(past)).toContain('Past collaborators (1)');
    expect(text(past)).toContain('Gone Photographer');
    expect(text(past)).toContain('Their photos stay in the album and are counted above.');
    expect(past.findAll((x) => (x.props?.accessibilityLabel as string | undefined)?.startsWith('Remove') === true)).toHaveLength(0);
  });

  it('asks before removing, and removes only after confirming', async () => {
    mockApi.removeCollaborator.mockResolvedValue(undefined);
    const r = await mount();
    await openProgress(r);
    await tap(r, 'Remove Chantal Ineza');
    expect(mockAlert).toHaveBeenCalledTimes(1);
    expect(mockAlert.mock.calls[0][0]).toBe('Remove Chantal Ineza?');
    expect(mockApi.removeCollaborator).not.toHaveBeenCalled();
    const confirm = (mockAlert.mock.calls[0][2] as { text: string; onPress?: () => Promise<void> }[]).find((b) => b.text === 'Remove')!;
    await act(async () => { await confirm.onPress!(); });
    expect(mockApi.removeCollaborator).toHaveBeenCalledWith('m-c');
  });
});

describe('from a card to that person\'s photos', () => {
  it('"Review their photos" opens Review narrowed to them, and the tab counts stay whole', async () => {
    const r = await mount();
    await openProgress(r);
    await tap(r, 'Review their photos (4)');
    const chip = r.root.findAll((x) => x.props?.testID === 'contributor-filter' && typeof x.type === 'string')[0];
    expect(text(chip)).toContain('Showing only photos from Eric Mugisha');
    expect(tabLabels(r)[0]).toBe('Review (4)');
    expect(tabLabels(r)[2]).toBe('History');
  });

  it('"All their photos" opens History narrowed to them', async () => {
    const r = await mount();
    await openProgress(r);
    await tap(r, 'All their photos (3)');
    const chip = r.root.findAll((x) => x.props?.testID === 'contributor-filter' && typeof x.type === 'string')[0];
    expect(text(chip)).toContain('Chantal Ineza');
    const photos = r.root.findAll((x) => typeof x.props?.accessibilityLabel === 'string' && x.props.accessibilityLabel.startsWith('Photo from') && typeof x.props.onPress === 'function');
    expect(photos.length).toBeGreaterThan(0);
    expect(photos.every((p) => (p.props.accessibilityLabel as string).includes('Chantal'))).toBe(true);
  });

  it('shows everyone again from the filter, and says so when the person has nothing waiting', async () => {
    const r = await mount();
    await openProgress(r);
    await tap(r, 'All their photos (3)');
    await tap(r, 'Review (4)');
    expect(text(r.root)).toContain('Nothing from Chantal Ineza to review');
    expect(text(r.root)).toContain('Everything they sent has been decided.');
    await tap(r, 'Show everyone');
    expect(r.root.findAll((x) => x.props?.testID === 'contributor-filter')).toHaveLength(0);
  });

  it('has no filter without one', async () => {
    const r = await mount();
    expect(r.root.findAll((x) => x.props?.testID === 'contributor-filter')).toHaveLength(0);
  });
});

describe('when there is nothing to track yet', () => {
  it('invites someone when there are no collaborators and nobody has ever sent photos', async () => {
    const r = await mount(album({ collaborators: [], submissions: [] }));
    await tap(r, 'Progress (0)');
    expect(text(r.root)).toContain('Once they accept, you can follow their progress here.');
    expect(r.root.findAll((x) => x.props?.testID === 'progress-summary')).toHaveLength(0);
  });

  it('says nobody has submitted yet when collaborators have joined', async () => {
    const r = await mount(album({ collaborators: [eric, chantal], submissions: [] }));
    await tap(r, 'Progress (2)');
    expect(text(r.root)).toContain('2 photographer(s) joined. Nobody has submitted a photo yet.');
    const bar = r.root.findAll((x) => x.props?.accessibilityRole === 'image')[0];
    expect(bar.props.accessibilityLabel).toBe('No photos submitted yet');
  });

  it('says you are all caught up when everything is decided', async () => {
    const r = await mount(album({ collaborators: [chantal], submissions: many(chantal, 'APPROVED', 2) }));
    await tap(r, 'Progress (1)');
    expect(text(r.root)).toContain('You are all caught up.');
  });
});

describe('in the languages the screen is translated into', () => {
  it.each([
    ['fr', 'Progression (3)', 'Progression de la collaboration', '4 à examiner', 'Examiner ses photos (4)'],
    ['es', 'Progreso (3)', 'Progreso de la colaboración', '4 por revisar', 'Revisar sus fotos (4)'],
  ])('%s: the tab, the summary, the card and its action', async (lang, tabName, title, state, action) => {
    mockLang.language = lang;
    const r = await mount();
    await tap(r, tabName);
    expect(text(r.root)).toContain(title);
    expect(text(cardOf(r, 'Eric Mugisha'))).toContain(state);
    expect(press(r, action)).toBeDefined();
    // No placeholder is left unfilled, and nothing falls back to English for a string the screen translates.
    expect(text(r.root)).not.toMatch(/\{\w+\}/);
  });
});
