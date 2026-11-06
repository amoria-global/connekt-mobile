import { getStartedActions, shouldAutoOpen } from './getStarted';

describe('Get started shortcuts by role', () => {
  it('shows only what the role can do', () => {
    expect(getStartedActions('Client').map((a) => a.key)).toEqual(['create-event']);
    expect(getStartedActions('Coordinator').map((a) => a.key)).toEqual(['create-event', 'photobook']);
    expect(getStartedActions('Photographer').map((a) => a.key)).toEqual(['go-live', 'new-album', 'photobook']);
    expect(getStartedActions('Viewer')).toEqual([]);
    expect(getStartedActions(undefined)).toEqual([]);
  });

  it('shows nothing to a workspace collaborator', () => {
    expect(getStartedActions('Photographer', true)).toEqual([]);
  });
});

describe('when the sheet opens by itself', () => {
  const ready = { actions: 2, listLoaded: true, hasItems: false, dismissed: false, shownThisSession: false };
  it('opens for a user with nothing yet, once per session', () => {
    expect(shouldAutoOpen(ready)).toBe(true);
    expect(shouldAutoOpen({ ...ready, shownThisSession: true })).toBe(false);
  });
  it('stays closed once they have items, ticked "don\'t show again", or while anything is still unknown', () => {
    expect(shouldAutoOpen({ ...ready, hasItems: true })).toBe(false);
    expect(shouldAutoOpen({ ...ready, dismissed: true })).toBe(false);
    expect(shouldAutoOpen({ ...ready, dismissed: null })).toBe(false);
    expect(shouldAutoOpen({ ...ready, listLoaded: false })).toBe(false);
    expect(shouldAutoOpen({ ...ready, actions: 0 })).toBe(false);
  });
});
