import React from 'react';
import TestRenderer, { act, type ReactTestInstance } from 'react-test-renderer';
import { Alert, Text, TextInput } from 'react-native';

import { GoalsSection } from './GoalsSection';
import { emptyDraft, toPlan, validateDraft } from './plans';

import '@/test/autoUnmount';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const mockGetOk = jest.fn();
const mockPost = jest.fn();
const mockPut = jest.fn();
const mockDelete = jest.fn();
jest.mock('@/api/client', () => ({
  api: {
    getOk: async (...a: unknown[]) => jest.requireActual('@/api/client').requireOk(await mockGetOk(...a)),
    post: (...a: unknown[]) => mockPost(...a),
    put: (...a: unknown[]) => mockPut(...a),
    delete: (...a: unknown[]) => mockDelete(...a),
  },
  requireOk: (r: unknown) => jest.requireActual('@/api/client').requireOk(r),
}));
jest.mock('@/store/auth', () => ({
  isApiError: (e: unknown) => !!e && typeof e === 'object' && 'message' in (e as object),
}));

const server = (o: Record<string, unknown>) => ({
  id: 'p1',
  name: 'October earnings',
  timePeriod: 'month',
  customStartDate: null,
  customEndDate: null,
  targetEarnings: '5000.00',
  targetPending: '0',
  targetClients: '10',
  targetBonuses: '0',
  targetRatings: '4.5',
  ...o,
});
const ok = (data: unknown) => ({ action: 1, message: 'ok', data });

const text = (r: TestRenderer.ReactTestRenderer) =>
  r.root.findAllByType(Text).map((t) => [t.props.children].flat().join('')).join(' | ');
const press = async (n: ReactTestInstance) => {
  await act(async () => {
    await n.props.onPress();
  });
};
const byLabel = (r: TestRenderer.ReactTestRenderer, label: string) =>
  r.root.findAll((n) => n.props?.accessibilityLabel === label && typeof n.props?.onPress === 'function')[0];
const btn = (r: TestRenderer.ReactTestRenderer, label: RegExp) =>
  r.root.find(
    (n) =>
      typeof n.props?.onPress === 'function' &&
      n.findAllByType(Text).some((t) => label.test([t.props.children].flat().join(''))),
  );
const settle = () => act(async () => {});

async function mount(rating: number | null = 4.0) {
  let r!: TestRenderer.ReactTestRenderer;
  await act(async () => {
    r = TestRenderer.create(<GoalsSection rating={rating} />);
  });
  return r;
}
const fill = (r: TestRenderer.ReactTestRenderer, label: string, value: string) => {
  const input = r.root.findAllByType(TextInput).find((i) => i.props.accessibilityLabel === label)!;
  act(() => input.props.onChangeText(value));
};

beforeEach(() => {
  mockGetOk.mockReset();
  mockPost.mockReset();
  mockPut.mockReset();
  mockDelete.mockReset();
});

describe('plans validation', () => {
  it('requires a name and an earnings target above zero, as the web does', () => {
    const e = validateDraft(emptyDraft());
    expect(e.name).toBeTruthy();
    expect(e.targetEarnings).toBeTruthy();
    expect(validateDraft({ ...emptyDraft(), name: 'x', targetEarnings: '0' }).targetEarnings).toBeTruthy();
    expect(validateDraft({ ...emptyDraft(), name: 'x', targetEarnings: '100' })).toEqual({});
  });
  it('refuses what the server would reject (fractional clients, rating above 5, bad or reversed custom dates)', () => {
    const base = { ...emptyDraft(), name: 'x', targetEarnings: '100' };
    expect(validateDraft({ ...base, targetClients: '2.5' }).targetClients).toBeTruthy();
    expect(validateDraft({ ...base, targetRatings: '5.5' }).targetRatings).toBeTruthy();
    expect(validateDraft({ ...base, timePeriod: 'custom', customStartDate: '2026-02-30', customEndDate: '2026-03-01' }).customStartDate).toBeTruthy();
    expect(validateDraft({ ...base, timePeriod: 'custom', customStartDate: '2026-03-05', customEndDate: '2026-03-01' }).customEndDate).toBeTruthy();
    expect(validateDraft({ ...base, timePeriod: 'custom', customStartDate: '2026-03-01', customEndDate: '2026-03-05' })).toEqual({});
  });
  it('reads server strings, treating a missing or "0" target as not set', () => {
    const p = toPlan(server({ targetClients: '0', targetRatings: null }))!;
    expect(p.targetEarnings).toBe(5000);
    expect(p.targetClients).toBe(0);
    expect(p.targetRatings).toBe(0);
    expect(toPlan({ name: 'no id' })).toBeNull();
  });
});

describe('GoalsSection', () => {
  it('restores persisted goals from the server, with rating progress from the real rating only', async () => {
    mockGetOk.mockResolvedValue(ok([server({})]));
    const r = await mount(4.0);
    const t = text(r);
    expect(mockGetOk).toHaveBeenCalledWith('/photographer/plans');
    expect(t).toContain('October earnings');
    expect(t).toContain('This month');
    expect(t).toContain('Rating target 4.5, now 4.0');
    expect(t).toContain('Earnings progress needs per-period figures');
  });

  it('does not invent a rating when the photographer has no reviews', async () => {
    mockGetOk.mockResolvedValue(ok([server({})]));
    const r = await mount(null);
    expect(text(r)).toContain('no reviews yet');
    expect(r.root.findAll((n) => String(n.props?.accessibilityLabel).includes('percent of the target'))).toHaveLength(0);
  });

  it('shows an empty state, not a fake goal, when none are saved', async () => {
    mockGetOk.mockResolvedValue(ok([]));
    expect(text(await mount())).toContain('No goals yet');
  });

  it('shows a failed load as an error and recovers on retry', async () => {
    mockGetOk.mockRejectedValueOnce({ status: 500, message: 'Server is down' });
    const r = await mount();
    expect(text(r)).toContain('Server is down');
    expect(text(r)).not.toContain('No goals yet');
    mockGetOk.mockResolvedValueOnce(ok([server({})]));
    await press(byLabel(r, 'Try again'));
    expect(text(r)).toContain('October earnings');
  });

  it('treats HTTP 200 with action 0 as a failure, not as an empty list', async () => {
    mockGetOk.mockResolvedValue({ action: 0, message: 'Plans unavailable' });
    const r = await mount();
    expect(text(r)).toContain('Plans unavailable');
    expect(text(r)).not.toContain('No goals yet');
  });

  it('creates a goal on the server, then shows what the server returns', async () => {
    mockGetOk.mockResolvedValueOnce(ok([]));
    mockPost.mockResolvedValueOnce(ok({ id: 'new' }));
    const r = await mount();
    await press(btn(r, /Set a goal/));
    fill(r, 'Goal name', 'Wedding season');
    fill(r, 'Earnings target (USD)', '3000');
    mockGetOk.mockResolvedValueOnce(ok([server({ id: 'new', name: 'Wedding season', targetEarnings: '3000' })]));
    await press(btn(r, /Save goal/));
    expect(mockPost).toHaveBeenCalledWith(
      '/photographer/plans',
      expect.objectContaining({ name: 'Wedding season', timePeriod: 'month', targetEarnings: '3000', targetClients: '0', customStartDate: null }),
    );
    expect(text(r)).toContain('Wedding season');
    expect(r.root.findAllByType(TextInput)).toHaveLength(0); // form closed
  });

  it('keeps the form open and shows the error when the save fails, and never lists the unsaved goal', async () => {
    mockGetOk.mockResolvedValueOnce(ok([]));
    mockPost.mockRejectedValueOnce({ status: 500, message: 'Could not reach the server' });
    const r = await mount();
    await press(btn(r, /Set a goal/));
    fill(r, 'Goal name', 'Unsaved');
    fill(r, 'Earnings target (USD)', '100');
    await press(btn(r, /Save goal/));
    expect(text(r)).toContain('Could not reach the server');
    expect(r.root.findAllByType(TextInput).length).toBeGreaterThan(0);
    expect(mockGetOk).toHaveBeenCalledTimes(1); // no re-list, nothing pretended to be saved
    expect(text(r)).not.toContain('Unsaved |'); // only the form field holds it, no goal card
  });

  it('blocks an invalid goal before any request is sent', async () => {
    mockGetOk.mockResolvedValueOnce(ok([]));
    const r = await mount();
    await press(btn(r, /Set a goal/));
    await press(btn(r, /Save goal/));
    expect(mockPost).not.toHaveBeenCalled();
    expect(text(r)).toContain('Give the goal a name.');
    expect(text(r)).toContain('Enter a target amount.');
  });

  it('edits a saved goal with PUT, preloading its values', async () => {
    mockGetOk.mockResolvedValueOnce(ok([server({})]));
    mockPut.mockResolvedValueOnce(ok({ id: 'p1' }));
    const r = await mount();
    await press(byLabel(r, 'Goal October earnings, This month. Edit'));
    const name = r.root.findAllByType(TextInput).find((i) => i.props.accessibilityLabel === 'Goal name')!;
    expect(name.props.value).toBe('October earnings');
    fill(r, 'Earnings target (USD)', '6000');
    mockGetOk.mockResolvedValueOnce(ok([server({ targetEarnings: '6000' })]));
    await press(btn(r, /Save goal/));
    expect(mockPut).toHaveBeenCalledWith('/photographer/plans/p1', expect.objectContaining({ targetEarnings: '6000' }));
    await settle();
    expect(text(r)).toContain('6,000');
  });

  it('deletes only after confirmation', async () => {
    mockGetOk.mockResolvedValueOnce(ok([server({})]));
    mockDelete.mockResolvedValueOnce(ok(null));
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    const r = await mount();
    await press(byLabel(r, 'Goal October earnings, This month. Edit'));
    await press(btn(r, /Delete goal/));
    expect(mockDelete).not.toHaveBeenCalled();
    const buttons = alert.mock.calls[0][2]!;
    mockGetOk.mockResolvedValueOnce(ok([]));
    await act(async () => {
      await buttons.find((b) => b.text === 'Delete')!.onPress!();
    });
    expect(mockDelete).toHaveBeenCalledWith('/photographer/plans/p1');
    expect(text(r)).toContain('No goals yet');
    alert.mockRestore();
  });
});
