import { buildAreaPreviewHtml, PREVIEW_RADIUS_METERS, type PreviewColors } from './areaPreviewHtml';

const colors: PreviewColors = {
  background: 'bg-token',
  circle: 'circle-token',
  circleFill: 'fill-token',
  centre: 'centre-token',
  attribution: 'attr-token',
  attributionBg: 'attrbg-token',
};

describe('area preview page', () => {
  it('is not built at all without a tiles key, so the keyless "API KEY REQUIRED" watermark is never requested', () => {
    expect(buildAreaPreviewHtml({ lat: -1.95, lng: 30.09, key: '', colors })).toBeNull();
    expect(buildAreaPreviewHtml({ lat: -1.95, lng: 30.09, key: '   ', colors })).toBeNull();
  });

  it('is not built without a usable centre', () => {
    expect(buildAreaPreviewHtml({ lat: NaN, lng: 30.09, key: 'k', colors })).toBeNull();
    expect(buildAreaPreviewHtml({ lat: -1.95, lng: Infinity, key: 'k', colors })).toBeNull();
  });

  it('draws a dashed circle of about 1 km around the centre, and never a pin', () => {
    const html = buildAreaPreviewHtml({ lat: -1.954, lng: 30.0913, key: 'abc123', colors })!;
    expect(PREVIEW_RADIUS_METERS).toBe(1000);
    expect(html).toContain('L.circle([lat, lng], { radius: 1000');
    expect(html).toContain("dashArray: '6 6'");
    expect(html).toContain('var lat = -1.954, lng = 30.0913');
    expect(html).not.toContain('L.marker');
  });

  it('keeps the CARTO attribution visible on the map', () => {
    const html = buildAreaPreviewHtml({ lat: -1.95, lng: 30.09, key: 'k', colors })!;
    expect(html).toContain('&copy; OpenStreetMap contributors, &copy; CARTO');
    expect(html).toContain('class="credit"');
  });

  it('puts the key in the tile URL, encoded, and reports a real tile load or a failure back to the app', () => {
    const html = buildAreaPreviewHtml({ lat: -1.95, lng: 30.09, key: 'a b&c', colors })!;
    expect(html).toContain('basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png?key=a%20b%26c');
    expect(html).toContain("tiles.on('tileload'");
    expect(html).toContain("finish('ready')");
    expect(html).toContain("finish('failed')");
    // A map nobody can see tiles on must not stay half-drawn: it gives up after a few seconds.
    expect(html).toMatch(/setTimeout\(function \(\) \{ finish\('failed'\); \}, \d+\)/);
  });

  it('takes every colour from the caller and strips anything that could leave a quoted value', () => {
    const html = buildAreaPreviewHtml({ lat: -1.95, lng: 30.09, key: 'k', colors: { ...colors, circle: "x'; alert(1); '" } })!;
    expect(html).toContain('bg-token');
    expect(html).toContain('fill-token');
    // The quotes are stripped, so the whole value stays inside its own string literal and cannot end it early.
    expect(html).toContain("color: 'x; alert(1); ',");
    expect(html).not.toContain("x'; alert(1)");
    expect(html).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
  });
});
