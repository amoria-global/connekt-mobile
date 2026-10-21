import { axisLabel, chartSeries, seriesState } from './chartSeries';

const pt = (day: string, value1 = 0, value2 = 0) => ({ day, value1, value2 });

describe('chartSeries keeps exactly what the feed sent', () => {
  it.each([
    ['today (six 4-hour blocks)', ['12AM', '4AM', '8AM', '12PM', '4PM', '8PM']],
    ['month (four weeks)', ['Week 1', 'Week 2', 'Week 3', 'Week 4']],
    ['week (Sun to Sat)', ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']],
  ])('%s: same length, same order, same labels, same values', (_name, labels) => {
    const feed = labels.map((l, i) => pt(l, i * 10, i));
    const out = chartSeries(feed);
    expect(out.map((p) => p.day)).toEqual(labels);
    expect(out.map((p) => p.value1)).toEqual(labels.map((_, i) => i * 10));
    expect(out.map((p) => p.value2)).toEqual(labels.map((_, i) => i));
  });

  it('a partial week is not padded with invented days', () => {
    expect(chartSeries([pt('Mon', 5), pt('Wed', 7)]).map((p) => p.day)).toEqual(['Mon', 'Wed']);
  });

  it('no feed is an empty series, never seven placeholder zeros', () => {
    expect(chartSeries([])).toEqual([]);
    expect(chartSeries(null)).toEqual([]);
    expect(chartSeries(undefined)).toEqual([]);
  });

  it('a non-numeric value is a zero rather than NaN on the axis', () => {
    expect(chartSeries([{ day: 'Mon', value1: NaN, value2: undefined as unknown as number }])).toEqual([pt('Mon', 0, 0)]);
  });
});

describe('axis labels', () => {
  it('shortens weekdays only', () => {
    expect(axisLabel('Sunday')).toBe('Sun');
    expect(axisLabel('Sun')).toBe('Sun');
    expect(axisLabel('12AM')).toBe('12AM');
    expect(axisLabel('Week 3')).toBe('Week 3');
  });
});

describe('seriesState separates the four situations', () => {
  it('failed beats everything, even stale data', () => {
    expect(seriesState([pt('Mon', 5)], true)).toBe('unavailable');
  });
  it('empty, genuinely zero, and real activity', () => {
    expect(seriesState([], false)).toBe('empty');
    expect(seriesState([pt('Mon'), pt('Tue')], false)).toBe('zero');
    expect(seriesState([pt('12AM'), pt('4AM', 0, 2)], false)).toBe('data');
  });
});
