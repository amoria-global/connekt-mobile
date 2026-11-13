import React from 'react';
import TestRenderer, { act, type ReactTestInstance } from 'react-test-renderer';
import { Text } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import ServiceAreaScreen from '@/app/(app)/service-area';
import { ServiceAreaPrompt } from './ServiceAreaPrompt';
import * as api from './api';
import { showToast } from '@/features/errors/store';

/** The service-area picker: what a photographer sees at each step, and what it refuses to claim. */
import '@/test/autoUnmount';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const mockPush = jest.fn();
const mockBack = jest.fn();
jest.mock('expo-router', () => {
  const React = require('react');
  return {
    useRouter: () => ({ push: mockPush, back: mockBack }),
    useFocusEffect: (cb: () => void) => React.useEffect(() => cb(), []),
  };
});
jest.mock('react-native-webview', () => ({ WebView: () => null }));
jest.mock('./api');
jest.mock('@/features/errors/store', () => ({ showToast: jest.fn() }));

const m = api as jest.Mocked<typeof api>;

const NOT_SET: api.ServiceArea = { set: false, name: null, context: null, country: null, setAt: null, latitude: null, longitude: null };
const SAVED: api.ServiceArea = { set: true, name: 'Gishushu', context: 'Gasabo, Kigali', country: 'RW', setAt: '2026-11-13T10:00:00', latitude: -1.954, longitude: 30.091 };
const GISHUSHU: api.AreaDetails = { placeId: 'a1', name: 'Gishushu', context: 'Gasabo, Kigali', country: 'RW', isArea: true, supported: true, latitude: -1.954, longitude: 30.091 };
const RESULTS: api.AreaSuggestion[] = [
  { placeId: 'a1', name: 'Gishushu', secondary: 'Kigali, Rwanda' },
  { placeId: 'a2', name: 'Gisozi', secondary: 'Gasabo, Kigali' },
];

/** All the words a Text shows, nested bold segments included. */
const words = (n: ReactTestInstance | string): string =>
  typeof n === 'string' ? n : n.children.map((c) => words(c as ReactTestInstance | string)).join('');
const text = (node: ReactTestInstance) =>
  node
    .findAllByType(Text)
    .map((t) => words(t))
    .join(' | ');

const flush = async () => {
  await act(async () => {
    await Promise.resolve();
  });
};
const press = async (r: TestRenderer.ReactTestRenderer, label: RegExp | string) => {
  const hit = r.root.findAll((n) => {
    const l = n.props?.accessibilityLabel ?? n.props?.title;
    return typeof l === 'string' && (typeof label === 'string' ? l === label : label.test(l)) && typeof n.props.onPress === 'function';
  })[0];
  expect(hit).toBeDefined();
  await act(async () => {
    hit.props.onPress();
  });
  await flush();
};
const type = async (r: TestRenderer.ReactTestRenderer, value: string) => {
  const input = r.root.findAll((n) => typeof n.props?.onChangeText === 'function' && n.props?.placeholder)[0];
  await act(async () => {
    input.props.onChangeText(value);
  });
  await act(async () => {
    jest.advanceTimersByTime(400);
  });
  await flush();
};
const mount = async (el: React.ReactElement) => {
  let r!: TestRenderer.ReactTestRenderer;
  await act(async () => {
    r = TestRenderer.create(
      <SafeAreaProvider initialMetrics={{ frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } }}>{el}</SafeAreaProvider>,
    );
  });
  await flush();
  return r;
};

beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
  m.getServiceArea.mockResolvedValue(NOT_SET);
  m.searchAreas.mockResolvedValue(RESULTS);
  m.getAreaDetails.mockResolvedValue(GISHUSHU);
  m.saveServiceArea.mockResolvedValue(SAVED);
  m.removeServiceArea.mockResolvedValue(NOT_SET);
});
afterEach(() => jest.useRealTimers());

describe('Home prompt', () => {
  it('asks a photographer with no area to set one, and opens the picker', async () => {
    const r = await mount(<ServiceAreaPrompt />);
    const t = text(r.root);
    expect(t).toContain('Set your service area');
    expect(t).toContain('never your address');
    await press(r, 'Set area');
    expect(mockPush).toHaveBeenCalledWith('/service-area');
  });

  it('goes away for the session on "Later" and on the close button', async () => {
    const r = await mount(<ServiceAreaPrompt />);
    await press(r, 'Later');
    expect(text(r.root)).not.toContain('Set your service area');
    const r2 = await mount(<ServiceAreaPrompt />);
    await press(r2, 'Dismiss');
    expect(text(r2.root)).not.toContain('Set your service area');
  });

  it('is not shown once an area is set', async () => {
    m.getServiceArea.mockResolvedValue(SAVED);
    expect(text((await mount(<ServiceAreaPrompt />)).root)).not.toContain('Set your service area');
  });

  it('says nothing when the area could not be read, rather than claiming "not on the map"', async () => {
    m.getServiceArea.mockRejectedValue({ status: 503, message: 'down' });
    expect(text((await mount(<ServiceAreaPrompt />)).root)).not.toContain('Set your service area');
  });
});

describe('picker: search', () => {
  it('lists matching areas with where they are, and explains it takes areas only', async () => {
    const r = await mount(<ServiceAreaScreen />);
    await type(r, 'Gis');
    const t = text(r.root);
    expect(m.searchAreas).toHaveBeenCalledWith('Gis', expect.anything());
    expect(t).toContain('Gishushu');
    expect(t).toContain('Kigali, Rwanda');
    expect(t).toContain('Gisozi');
    expect(t).toContain('Areas only, no street addresses');
  });

  it('does not search for one letter', async () => {
    const r = await mount(<ServiceAreaScreen />);
    await type(r, 'G');
    expect(m.searchAreas).not.toHaveBeenCalled();
  });

  it('has a "no results" state that suggests a way forward', async () => {
    m.searchAreas.mockResolvedValue([]);
    const r = await mount(<ServiceAreaScreen />);
    await type(r, 'Gisxx');
    const t = text(r.root);
    expect(t).toContain('No areas match "Gisxx"');
    expect(t).toContain('Try a nearby neighbourhood or district.');
  });

  it('shows an error with "Try again" when search fails, not "no results", and retries', async () => {
    m.searchAreas.mockRejectedValueOnce({ status: 503, message: 'down' });
    const r = await mount(<ServiceAreaScreen />);
    await type(r, 'Gis');
    expect(text(r.root)).toContain('Area search is unavailable right now.');
    expect(text(r.root)).not.toContain('No areas match');
    await press(r, 'Try again');
    await act(async () => {
      jest.advanceTimersByTime(400);
    });
    await flush();
    expect(text(r.root)).toContain('Gishushu');
  });
});

describe('picker: confirm and save', () => {
  const choose = async (r: TestRenderer.ReactTestRenderer) => {
    await type(r, 'Gis');
    await press(r, /^Gishushu, Kigali, Rwanda$/);
  };

  it('shows the chosen area, that it is approximate, and the privacy note, without needing map tiles', async () => {
    const r = await mount(<ServiceAreaScreen />);
    await choose(r);
    const t = text(r.root);
    expect(m.getAreaDetails).toHaveBeenCalledWith('a1');
    expect(t).toContain('Gishushu');
    expect(t).toContain('Gasabo, Kigali');
    expect(t).toContain('approximate area');
    expect(t).toContain('Clients see this approximate area and a rounded distance. Your address is never shown.');
    // No tiles key in tests: no preview and no error.
    expect(r.root.findAll((n) => n.props?.testID === 'area-preview')).toHaveLength(0);
    expect(t).not.toMatch(/could not|error/i);
  });

  it('saves with only the place id, says so, and goes back', async () => {
    const r = await mount(<ServiceAreaScreen />);
    await choose(r);
    await press(r, 'Save service area');
    expect(m.saveServiceArea).toHaveBeenCalledWith('a1');
    expect(showToast).toHaveBeenCalledWith(expect.objectContaining({ message: "You're on the map in Gishushu" }));
    expect(mockBack).toHaveBeenCalled();
  });

  it('shows an inline error with "Try again" when saving fails, and stays on the screen', async () => {
    m.saveServiceArea.mockRejectedValueOnce({ status: 503, message: 'The service is temporarily unavailable. Please try again shortly.' });
    const r = await mount(<ServiceAreaScreen />);
    await choose(r);
    await press(r, 'Save service area');
    expect(text(r.root)).toContain('temporarily unavailable');
    expect(mockBack).not.toHaveBeenCalled();
    await press(r, 'Try again');
    expect(m.saveServiceArea).toHaveBeenCalledTimes(2);
    expect(mockBack).toHaveBeenCalled();
  });

  it('refuses a street or a business with a plain message and stays on the search', async () => {
    m.getAreaDetails.mockResolvedValue({ ...GISHUSHU, isArea: false });
    const r = await mount(<ServiceAreaScreen />);
    await choose(r);
    expect(text(r.root)).toContain('Choose an area or neighbourhood, not a street address.');
    expect(text(r.root)).toContain('Areas only, no street addresses');
    expect(m.saveServiceArea).not.toHaveBeenCalled();
  });

  it('refuses a country Connekyt does not support', async () => {
    m.getAreaDetails.mockResolvedValue({ ...GISHUSHU, supported: false });
    const r = await mount(<ServiceAreaScreen />);
    await choose(r);
    expect(text(r.root)).toContain('Connekyt is not available in that country yet.');
    expect(m.saveServiceArea).not.toHaveBeenCalled();
  });

  it('shows an error with "Try again" when the area cannot be checked', async () => {
    m.getAreaDetails.mockRejectedValueOnce({ status: 503, message: 'down' });
    const r = await mount(<ServiceAreaScreen />);
    await choose(r);
    expect(text(r.root)).toContain('We could not check that area right now.');
    await press(r, 'Try again');
    expect(text(r.root)).toContain('Clients see this approximate area');
  });
});

describe('picker: an area already saved', () => {
  beforeEach(() => m.getServiceArea.mockResolvedValue(SAVED));

  it('opens on the saved area, with Change and "Remove my area"', async () => {
    const r = await mount(<ServiceAreaScreen />);
    const t = text(r.root);
    expect(t).toContain('Gishushu');
    expect(t).toContain('Gasabo, Kigali');
    expect(t).toContain('Remove my area');
    expect(t).toContain('Removing takes you off the map straight away.');
  });

  it('removes the area at once and says so', async () => {
    const r = await mount(<ServiceAreaScreen />);
    await press(r, 'Remove my area');
    expect(m.removeServiceArea).toHaveBeenCalledTimes(1);
    expect(showToast).toHaveBeenCalledWith(expect.objectContaining({ message: "You're off the map" }));
    expect(mockBack).toHaveBeenCalled();
  });

  it('"Change" goes back to the search', async () => {
    const r = await mount(<ServiceAreaScreen />);
    await press(r, 'Change');
    expect(text(r.root)).toContain('Choose the area or neighbourhood where you usually work.');
  });
});
