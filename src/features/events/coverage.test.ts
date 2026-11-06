import { showCoverageChoice, showSelfStreamLink } from './coverage';

describe('the create event wizard no longer asks who covers the event', () => {
  it('never offers the toggle on a new event, whatever the role or visibility', () => {
    expect(showCoverageChoice({ editing: false, visibility: 'PUBLIC' })).toBe(false);
    expect(showCoverageChoice({ editing: false, visibility: 'PRIVATE' })).toBe(false);
  });

  it('keeps it only on an old self-streamed event that is being edited', () => {
    expect(showCoverageChoice({ editing: true, visibility: 'PRIVATE' })).toBe(true);
    expect(showCoverageChoice({ editing: true, visibility: 'PUBLIC' })).toBe(false);
  });

  it('points a client or coordinator creating an event at Go live, and nobody else', () => {
    expect(showSelfStreamLink({ editing: false, isPhotographer: false })).toBe(true);
    expect(showSelfStreamLink({ editing: true, isPhotographer: false })).toBe(false);
    expect(showSelfStreamLink({ editing: false, isPhotographer: true })).toBe(false);
  });
});
