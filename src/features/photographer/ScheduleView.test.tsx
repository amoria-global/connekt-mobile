import React from 'react';
import TestRenderer, { act, type ReactTestInstance } from 'react-test-renderer';
import { Text } from 'react-native';

import type { EventItem } from '@/features/events/types';
import { ScheduleView } from './ScheduleView';
import { dayKey, shiftDays, weekOf } from './schedule';

import '@/test/autoUnmount';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const today = dayKey(new Date());
const ev = (o: Partial<EventItem> & { id: string }): EventItem => ({ title: o.id, ...o }) as EventItem;

const flat = (node: ReactTestInstance): string =>
  node
    .findAllByType(Text)
    .map((t) => (Array.isArray(t.props.children) ? t.props.children.join('') : String(t.props.children ?? '')))
    .join(' | ');

function mount(events: EventItem[], handlers: Partial<Record<'onOpen' | 'onAccept' | 'onDecline' | 'onCreate', jest.Mock>> = {}) {
  let r!: TestRenderer.ReactTestRenderer;
  act(() => {
    r = TestRenderer.create(
      <ScheduleView
        events={events}
        allEvents={events}
        busyId={null}
        onOpen={handlers.onOpen ?? jest.fn()}
        onAccept={handlers.onAccept ?? jest.fn()}
        onDecline={handlers.onDecline ?? jest.fn()}
        onCreate={handlers.onCreate ?? jest.fn()}
      />,
    );
  });
  return r;
}

const press = (r: TestRenderer.ReactTestRenderer, match: (n: ReactTestInstance) => boolean) => {
  const node = r.root.findAll((n) => match(n) && typeof n.props.onPress === 'function')[0];
  act(() => node.props.onPress());
};
const byLabel = (label: string) => (n: ReactTestInstance) => n.props?.accessibilityLabel === label;
const tab = (label: string) => (n: ReactTestInstance) =>
  n.props?.accessibilityRole === 'tab' && n.findAllByType(Text).some((t) => t.props.children === label);

describe('ScheduleView', () => {
  it('titles the week with a month on the left, never a bare day number', () => {
    // Found in dark-mode review: the header read "12 to Oct 18, 2026".
    const title = flat(mount([]).root)
      .split(' | ')
      .find((t) => / to /.test(t) && /\d{4}$/.test(t));
    expect(title).toMatch(/^[A-Z][a-z]{2} \d{1,2} to (\d{1,2}|[A-Z][a-z]{2} \d{1,2}), \d{4}$/);
  });

  it('opens on the current week with today selected and lists today in time order', () => {
    const r = mount([
      ev({ id: 'pm', title: 'Graduation', eventDate: today, startTime: '15:00', endTime: '16:00' }),
      ev({ id: 'am', title: 'Wedding', eventDate: today, startTime: '09:00', endTime: '10:00' }),
    ]);
    const text = flat(r.root);
    expect(text.indexOf('Wedding')).toBeGreaterThan(-1);
    expect(text.indexOf('Wedding')).toBeLessThan(text.indexOf('Graduation'));
    expect(text).toContain('9:00 AM');
  });

  it('shows an empty day with a way to create an event, not a blank gap', () => {
    const onCreate = jest.fn();
    const r = mount([], { onCreate });
    expect(flat(r.root)).toContain('Nothing scheduled');
    press(r, (n) => n.props?.accessibilityLabel === 'Create event');
    expect(onCreate).toHaveBeenCalled();
  });

  it('selecting another day in the strip changes the list', () => {
    // Any other day of the current week, so this never depends on the weekday it runs on.
    const other = weekOf(today).find((d) => d !== today)!;
    const r = mount([ev({ id: 't', title: 'Other day shoot', eventDate: other, startTime: '10:00' })]);
    // The day's own list, not Coming up beneath it, which may already name a later shoot.
    const dayList = () => {
      const day = r.root.findByProps({ testID: 'schedule-day' });
      const coming = day.findAll((n) => n.props?.testID === 'schedule-coming-up')[0];
      const all = flat(day);
      const rest = coming ? all.replace(flat(coming), '') : all;
      // An empty day names the next shoot in a hint ("Your next shoot is X on Tue"), which is not the day's list.
      return rest.replace(/Your next shoot is .*? on [A-Za-z]{3}, [A-Za-z]{3} \d+\./, '');
    };
    expect(dayList()).not.toContain('Other day shoot');
    press(r, (n) => n.props?.accessibilityRole === 'button' && String(n.props.accessibilityLabel).includes('1 event'));
    expect(dayList()).toContain('Other day shoot');
  });

  it('flags a genuine overlap and offers a review; no flag without one', () => {
    const clash = [
      ev({ id: 'a', title: 'Alpha', eventDate: today, startTime: '09:00', endTime: '11:00' }),
      ev({ id: 'b', title: 'Beta', eventDate: today, startTime: '10:00', endTime: '12:00' }),
    ];
    expect(flat(mount(clash).root)).toContain('1 possible schedule conflict');
    const fine = [
      ev({ id: 'a', title: 'Alpha', eventDate: today, startTime: '09:00', endTime: '10:00' }),
      ev({ id: 'b', title: 'Beta', eventDate: today, startTime: '10:00', endTime: '11:00' }),
    ];
    expect(flat(mount(fine).root)).not.toContain('schedule conflict');
  });

  it('a pending request shows Accept and Decline that call back with that event', () => {
    const onAccept = jest.fn();
    const onDecline = jest.fn();
    const pending = ev({ id: 'p', title: 'Request', eventDate: today, startTime: '12:00', bookingStatus: 'PENDING' });
    const r = mount([pending], { onAccept, onDecline });
    expect(flat(r.root)).toContain('Awaiting your reply');
    press(r, byLabel('Accept'));
    press(r, byLabel('Decline'));
    expect(onAccept).toHaveBeenCalledWith(pending);
    expect(onDecline).toHaveBeenCalledWith(pending);
  });

  it('agenda lists what is ahead by day and leaves past events out', () => {
    const r = mount([
      ev({ id: 'past', title: 'Old shoot', eventDate: shiftDays(today, -3) }),
      ev({ id: 'next', title: 'Next shoot', eventDate: shiftDays(today, 2) }),
    ]);
    press(r, tab('Agenda'));
    const text = flat(r.root);
    expect(text).toContain('Next shoot');
    expect(text).not.toContain('Old shoot');
  });

  it('month view moves between months', () => {
    const r = mount([]);
    press(r, tab('Month'));
    const before = flat(r.root);
    press(r, byLabel('Next month'));
    expect(flat(r.root)).not.toBe(before);
  });
});

describe('ScheduleView controlled by the screen', () => {
  const clash = [
    ev({ id: 'a', title: 'Wedding', eventDate: today, startTime: '09:00', endTime: '11:00' }),
    ev({ id: 'b', title: 'Portraits', eventDate: today, startTime: '10:00', endTime: '12:00' }),
  ];
  function mountControlled(mode: 'month' | 'week' | 'agenda', onModeChange: jest.Mock, onCreate = jest.fn()) {
    let r!: TestRenderer.ReactTestRenderer;
    act(() => {
      r = TestRenderer.create(
        <ScheduleView mode={mode} onModeChange={onModeChange} events={clash} allEvents={clash} busyId={null}
          onOpen={jest.fn()} onAccept={jest.fn()} onDecline={jest.fn()} onCreate={onCreate} />,
      );
    });
    return r;
  }

  it('hides its own Month/Week/Agenda tabs when the screen owns the switch', () => {
    const r = mountControlled('week', jest.fn());
    expect(r.root.findAll(tab('Month'))).toHaveLength(0);
  });

  it('asks the screen to switch to Week when a conflict is reviewed from another mode', () => {
    const onModeChange = jest.fn();
    const r = mountControlled('month', onModeChange);
    press(r, (n) => String(n.props?.accessibilityLabel).includes('schedule conflict'));
    expect(onModeChange).toHaveBeenCalledWith('week');
  });

  it('an empty day points at the next shoot and jumps to it (design/events.png)', () => {
    const later = weekOf(today).map((d) => d).concat([]).sort().pop()!;
    const nextDay = later > today ? later : today.slice(0, 4) + '-12-31';
    const r = mount([ev({ id: 'n', title: 'Booking Testing', eventDate: nextDay, startTime: '13:00', location: 'Kabuga' })]);
    const text = flat(r.root);
    expect(text).toContain('A clear day');
    expect(text).toContain('Your next shoot is Booking Testing on');
    expect(text).toContain('Coming up');
    press(r, byLabel('Jump to next'));
    expect(flat(r.root.findByProps({ testID: 'schedule-day' }))).toContain('1:00 PM');
  });

  it('draws the week as seven equal columns with Sunday, never a scroller', () => {
    const r = mount([]);
    const days = r.root.findAll(
      (n) => typeof n.type === 'string' && n.props.accessibilityRole === 'button' && typeof n.props.accessibilityState?.selected === 'boolean' && / (no events|\d+ events?)$/.test(String(n.props.accessibilityLabel)),
    );
    expect(days).toHaveLength(7);
    expect(days.some((d) => String(d.props.accessibilityLabel).startsWith('Sunday'))).toBe(true);
  });
});
