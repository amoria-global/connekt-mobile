import { canSend, formatClock, remainingChars, sentNotice, validateDraft, type ComposerDraft } from './composer';

const base: ComposerDraft = { kind: 'text', name: 'Aline', message: 'Congratulations', visibility: 'public', durationSeconds: null, hasVideo: false };
const account = { name: 'Aline M', email: 'a@b.co' };

describe('validateDraft', () => {
  it('accepts a complete text wish', () => {
    expect(canSend(validateDraft(base, null))).toBe(true);
  });

  it('makes the sender choose visibility, with no default', () => {
    expect(validateDraft({ ...base, visibility: null }, null).visibility).toBeDefined();
  });

  it('asks a guest for a name only, and never a signed-in person', () => {
    const e = validateDraft({ ...base, name: ' ' }, null);
    expect(e.name).toBeDefined();
    expect(Object.keys(e)).toEqual(['name']);
    expect(canSend(validateDraft({ ...base, name: '' }, account))).toBe(true);
  });

  it('needs no email: a guest with a name and a message can send', () => {
    expect(canSend(validateDraft({ ...base, name: 'Aline' }, null))).toBe(true);
  });

  it('requires a message under the limit for a text wish', () => {
    expect(validateDraft({ ...base, message: '  ' }, null).message).toBeDefined();
    expect(validateDraft({ ...base, message: 'x'.repeat(501) }, null).message).toContain('500');
    expect(canSend(validateDraft({ ...base, message: 'x'.repeat(500) }, null))).toBe(true);
  });

  it('requires a clip of at most 60 seconds for a video wish, and the caption is optional', () => {
    const v: ComposerDraft = { ...base, kind: 'video', message: '', hasVideo: true, durationSeconds: 42 };
    expect(canSend(validateDraft(v, null))).toBe(true);
    expect(validateDraft({ ...v, hasVideo: false }, null).video).toBeDefined();
    expect(validateDraft({ ...v, durationSeconds: 61 }, null).video).toContain('60');
    expect(canSend(validateDraft({ ...v, durationSeconds: 60 }, null))).toBe(true);
    expect(canSend(validateDraft({ ...v, durationSeconds: null }, null))).toBe(true);
  });
});

describe('wording', () => {
  it('formats clock and counters', () => {
    expect(formatClock(7)).toBe('0:07');
    expect(formatClock(60)).toBe('1:00');
    expect(formatClock(-3)).toBe('0:00');
    expect(remainingChars('abc')).toBe(497);
  });
  it('tells a public sender about approval and a private sender it stayed private', () => {
    expect(sentNotice('public')).toContain('approves');
    expect(sentNotice('private')).toContain('privately');
  });
});
