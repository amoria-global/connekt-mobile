import type { PickedImage } from '@/services/imagePicker';
import { bucketOf, runHostFlow, validateHostForm, type HostDeps } from './hostFlow';
import type { HostedEventInput } from './api';

const input: HostedEventInput = { title: 'Rooftop set', eventDate: '2026-11-10' };
const cover = { uri: 'file:///c.jpg' } as PickedImage;

function deps(over: Partial<HostDeps> = {}): jest.Mocked<HostDeps> {
  return {
    create: jest.fn().mockResolvedValue({ id: 'ev1' }),
    uploadCover: jest.fn().mockResolvedValue(undefined),
    publish: jest.fn().mockResolvedValue(undefined),
    ...over,
  } as jest.Mocked<HostDeps>;
}

describe('runHostFlow', () => {
  it('creates, uploads the cover, then publishes, and reports done only at the end', async () => {
    const d = deps();
    const r = await runHostFlow(d, input, cover);
    expect(r).toMatchObject({ status: 'done', eventId: 'ev1' });
    expect(d.create).toHaveBeenCalledWith(input);
    expect(d.uploadCover).toHaveBeenCalledWith('ev1', cover);
    expect(d.publish).toHaveBeenCalledWith('ev1');
  });

  it('a failed create stops there and nothing else runs', async () => {
    const d = deps({ create: jest.fn().mockRejectedValue({ message: 'Hosting is not available' }) });
    const r = await runHostFlow(d, input, cover);
    expect(r).toMatchObject({ status: 'failed', step: 'create', message: 'Hosting is not available' });
    expect(d.uploadCover).not.toHaveBeenCalled();
    expect(d.publish).not.toHaveBeenCalled();
  });

  it('a failed cover keeps the event, and the retry does not create a second one', async () => {
    const d = deps({ uploadCover: jest.fn().mockRejectedValueOnce({ message: 'Too large' }).mockResolvedValue(undefined) });
    const first = await runHostFlow(d, input, cover);
    expect(first).toMatchObject({ status: 'failed', step: 'cover', progress: { eventId: 'ev1' } });
    expect(d.publish).not.toHaveBeenCalled();

    const second = await runHostFlow(d, input, cover, first.progress);
    expect(second).toMatchObject({ status: 'done', eventId: 'ev1' });
    expect(d.create).toHaveBeenCalledTimes(1);
    expect(d.uploadCover).toHaveBeenCalledTimes(2);
  });

  it('a failed publish retries only the publish', async () => {
    const d = deps({ publish: jest.fn().mockRejectedValueOnce({ message: 'Not yet' }).mockResolvedValue(undefined) });
    const first = await runHostFlow(d, input, cover);
    expect(first).toMatchObject({ status: 'failed', step: 'publish', progress: { eventId: 'ev1', coverDone: true } });

    const second = await runHostFlow(d, input, cover, first.progress);
    expect(second.status).toBe('done');
    expect(d.create).toHaveBeenCalledTimes(1);
    expect(d.uploadCover).toHaveBeenCalledTimes(1);
    expect(d.publish).toHaveBeenCalledTimes(2);
  });

  it('falls back to a plain message when the error carries none', async () => {
    const r = await runHostFlow(deps({ create: jest.fn().mockRejectedValue(new Error('')) }), input, cover);
    expect(r).toMatchObject({ status: 'failed', message: 'Could not create the event.' });
  });
});

describe('validateHostForm', () => {
  const ok = { title: 'Rooftop set', date: '2026-11-10', startTime: '', paid: false, price: '' };

  it('accepts a free event with a cover', () => {
    expect(validateHostForm(ok, true, '2026-11-01')).toEqual({});
  });

  it('asks for what is missing', () => {
    const e = validateHostForm({ ...ok, title: 'ab', date: 'tomorrow' }, false, '2026-11-01');
    expect(Object.keys(e).sort()).toEqual(['cover', 'date', 'title']);
  });

  it('refuses a past date and a bad time', () => {
    expect(validateHostForm({ ...ok, date: '2026-10-01' }, true, '2026-11-01').date).toMatch(/past/);
    expect(validateHostForm({ ...ok, startTime: '25:00' }, true, '2026-11-01').startTime).toBeDefined();
    expect(validateHostForm({ ...ok, startTime: '18:30' }, true, '2026-11-01').startTime).toBeUndefined();
  });

  it('a paid event needs a price above zero', () => {
    expect(validateHostForm({ ...ok, paid: true, price: '' }, true, '2026-11-01').price).toBeDefined();
    expect(validateHostForm({ ...ok, paid: true, price: '0' }, true, '2026-11-01').price).toBeDefined();
    expect(validateHostForm({ ...ok, paid: true, price: '5000' }, true, '2026-11-01').price).toBeUndefined();
  });
});

describe('bucketOf', () => {
  it('sorts events by what the server says', () => {
    expect(bucketOf('ONGOING')).toBe('live');
    expect(bucketOf('COMPLETED')).toBe('ended');
    expect(bucketOf('PUBLISHED')).toBe('upcoming');
    expect(bucketOf('UPCOMING')).toBe('upcoming');
    expect(bucketOf(undefined)).toBe('upcoming');
  });
});
