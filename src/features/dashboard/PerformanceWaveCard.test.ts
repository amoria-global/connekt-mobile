import {
  catmullRomToBezier,
  METRICS_META,
  PERIOD_LABELS,
  type MetricKey,
} from './PerformanceWaveCard';

describe('PerformanceWaveCard Unit Tests', () => {
  describe('catmullRomToBezier', () => {
    it('returns empty string if fewer than 2 points are provided', () => {
      expect(catmullRomToBezier([])).toBe('');
      expect(catmullRomToBezier([{ x: 10, y: 20 }])).toBe('');
    });

    it('generates a valid SVG cubic bezier path string for 2 points', () => {
      const pts = [
        { x: 10, y: 100 },
        { x: 100, y: 50 },
      ];
      const d = catmullRomToBezier(pts);
      expect(d.startsWith('M 10.0 100.0')).toBe(true);
      expect(d).toContain('C');
      expect(d.endsWith('100.0 50.0')).toBe(true);
    });

    it('generates continuous cubic bezier curve for 6 temporal points', () => {
      const pts = [
        { x: 24, y: 135 },
        { x: 82, y: 90 },
        { x: 140, y: 45 },
        { x: 198, y: 70 },
        { x: 256, y: 110 },
        { x: 316, y: 135 },
      ];
      const d = catmullRomToBezier(pts);

      // Verify path commands
      expect(d.startsWith('M 24.0 135.0')).toBe(true);
      const bezierSegments = d.split(' C ');
      // 6 points create 5 cubic bezier curve segments
      expect(bezierSegments.length).toBe(6);
      expect(d.endsWith('316.0 135.0')).toBe(true);
    });
  });

  describe('METRICS_META', () => {
    const requiredKeys: MetricKey[] = [
      'totalRevenue',
      'totalEvents',
      'totalCustomers',
      'totalPhotographers',
      'totalPending',
    ];

    it('defines metadata for all 5 coordinator metrics', () => {
      requiredKeys.forEach((key) => {
        const meta = METRICS_META[key];
        expect(meta).toBeDefined();
        expect(meta.title).toBeTruthy();
        expect(meta.shortTitle).toBeTruthy();
        expect(meta.unit).toBeTruthy();
        expect(meta.icon).toBeTruthy();
        expect(meta.color).toMatch(/^#[0-9A-Fa-f]{6}$/);
      });
    });

    it('correctly classifies monetary vs count metrics', () => {
      expect(METRICS_META.totalRevenue.isMoney).toBe(true);
      expect(METRICS_META.totalPending.isMoney).toBe(true);
      expect(METRICS_META.totalEvents.isMoney).toBe(false);
      expect(METRICS_META.totalCustomers.isMoney).toBe(false);
      expect(METRICS_META.totalPhotographers.isMoney).toBe(false);
    });
  });

  describe('PERIOD_LABELS', () => {
    it('provides options for Today, Week, and Month', () => {
      const values = PERIOD_LABELS.map((p) => p.value);
      expect(values).toEqual(['today', 'week', 'month']);
    });
  });
});
