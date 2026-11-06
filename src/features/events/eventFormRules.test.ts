import {
  attendanceFromSaved,
  firstInvalidField,
  hasRealVenue,
  locationPayload,
  maxGuestsPayload,
  validateEventForm,
  type EventFormInput,
} from './eventFormRules';

const ok: EventFormInput = {
  hasCover: true,
  title: 'Gala',
  category: 'Music',
  eventDate: '2026-12-01',
  startTime: '18:00',
  attendance: 'IN_PERSON',
  venueName: 'Kigali Arena',
  city: 'Kigali',
  wishInvites: true,
};

describe('validateEventForm', () => {
  it('passes a complete in-person event', () => {
    expect(validateEventForm(ok)).toEqual({});
  });

  it('needs an explicit attendance choice: there is no default', () => {
    expect(validateEventForm({ ...ok, attendance: null }).attendance).toBe('Choose how guests can attend');
  });

  it('asks for venue and city only when guests attend in person', () => {
    const inPerson = validateEventForm({ ...ok, venueName: '', city: '' });
    expect(inPerson.venueName).toBeDefined();
    expect(inPerson.city).toBeDefined();
    expect(validateEventForm({ ...ok, attendance: 'STREAM_ONLY', venueName: '', city: '' })).toEqual({});
  });

  it('rejects a venue the server would downgrade to stream-only', () => {
    expect(validateEventForm({ ...ok, venueName: 'Online' }).venueName).toMatch(/real venue/);
    expect(validateEventForm({ ...ok, venueName: 'Zoom' }).venueName).toMatch(/real venue/);
    expect(validateEventForm({ ...ok, venueName: 'ab' }).venueName).toBeDefined();
  });

  it('lets an edit of an old event with one joined location save without a city', () => {
    expect(validateEventForm({ ...ok, city: '' }, { legacyLocation: true })).toEqual({});
  });

  it('blocks on cover, title, category, date, start time and wish invites', () => {
    const e = validateEventForm({ ...ok, hasCover: false, title: ' ', category: '', eventDate: '', startTime: '', wishInvites: null });
    expect(Object.keys(e).sort()).toEqual(['category', 'cover', 'eventDate', 'startTime', 'title', 'wishInvites']);
  });

  it('carries a fee problem from the caller', () => {
    expect(validateEventForm(ok, { priceError: 'Too low' }).price).toBe('Too low');
  });
});

describe('firstInvalidField', () => {
  it('follows the order of the form, top to bottom', () => {
    const e = validateEventForm({ ...ok, wishInvites: null, startTime: '', hasCover: false });
    expect(firstInvalidField(e)).toBe('cover');
    expect(firstInvalidField({ wishInvites: 'x', startTime: 'y' })).toBe('startTime');
    expect(firstInvalidField({})).toBeNull();
  });
});

describe('maxGuestsPayload', () => {
  it('sends nothing when empty or zero, a number otherwise', () => {
    expect(maxGuestsPayload('')).toBeUndefined();
    expect(maxGuestsPayload(undefined)).toBeUndefined();
    expect(maxGuestsPayload('0')).toBeUndefined();
    expect(maxGuestsPayload('1,200')).toBe(1200);
  });
});

describe('attendanceFromSaved', () => {
  it('preselects the saved mode, else what the venue implies', () => {
    expect(attendanceFromSaved('STREAM_ONLY', 'Kigali Arena')).toBe('STREAM_ONLY');
    expect(attendanceFromSaved('IN_PERSON', '')).toBe('IN_PERSON');
    expect(attendanceFromSaved('HYBRID', '')).toBe('IN_PERSON');
    expect(attendanceFromSaved(undefined, 'Kigali Arena, Kigali')).toBe('IN_PERSON');
    expect(attendanceFromSaved(null, 'Online')).toBe('STREAM_ONLY');
  });
});

describe('locationPayload', () => {
  const parts = { venueName: ' Arena ', address: '', city: 'Kigali', country: 'Rwanda' };
  it('joins the parts for in-person and sends nothing for stream-only', () => {
    expect(locationPayload('IN_PERSON', parts)).toBe('Arena, Kigali, Rwanda');
    expect(locationPayload('STREAM_ONLY', parts)).toBeUndefined();
    expect(locationPayload(null, parts)).toBeUndefined();
  });
  it('knows a real venue', () => {
    expect(hasRealVenue('Kigali Arena')).toBe(true);
    expect(hasRealVenue('Live stream')).toBe(false);
  });
});
