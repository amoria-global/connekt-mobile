/**
 * The page behind the service-area preview: a small map with a dashed circle of about 1 km around the area's centre. Never a pin
 * on a street, because clients only ever see an approximate area.
 *
 * Tiles come from CARTO with our basemap key (a temporary stopgap until we serve our own). The page reports to the app when the
 * first tile has really loaded ('ready') and when it cannot get any ('failed'), and the app shows the map only on 'ready': with no
 * key, no network or CARTO refusing the request there is simply no preview, and no error. CARTO's keyless tiles carry an "API KEY
 * REQUIRED" watermark and still answer 200, so a page without a key is never built.
 *
 * Colours are passed in from the theme, so no colour is written into this file.
 */
export type PreviewColors = {
  background: string;
  circle: string;
  circleFill: string;
  centre: string;
  attribution: string;
  attributionBg: string;
};

export const PREVIEW_RADIUS_METERS = 1000;
/** How long the page waits for a first tile before it reports failure. */
export const PREVIEW_TIMEOUT_MS = 8000;

const esc = (s: string) => s.replace(/[<>"'&\\`$]/g, '');

export function buildAreaPreviewHtml(opts: { lat: number; lng: number; key: string; colors: PreviewColors }): string | null {
  const key = opts.key.trim();
  if (!key || !Number.isFinite(opts.lat) || !Number.isFinite(opts.lng)) return null;
  const c = opts.colors;
  // The key is a plain token; it is stripped of anything that could leave the quoted URL.
  const safeKey = encodeURIComponent(key);
  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" integrity="sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=" crossorigin="" />
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js" integrity="sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo=" crossorigin=""></script>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    html, body, #map { width: 100%; height: 100%; background: ${esc(c.background)}; overflow: hidden; }
    .credit { position: absolute; right: 6px; bottom: 6px; z-index: 1000; padding: 2px 6px; border-radius: 6px;
      font: 10px -apple-system, Roboto, Helvetica, Arial, sans-serif; color: ${esc(c.attribution)}; background: ${esc(c.attributionBg)}; }
  </style>
</head>
<body>
  <div id="map"></div>
  <div class="credit">&copy; OpenStreetMap contributors, &copy; CARTO</div>
  <script>
    (function () {
      function send(msg) { if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(msg); }
      var done = false;
      function finish(msg) { if (!done) { done = true; send(msg); } }
      // Any error in this script ends as "failed", never as a frame that waits for a message that will not come.
      window.onerror = function () { finish('failed'); return true; };
      if (typeof L === 'undefined') { finish('failed'); return; }
      var lat = ${Number(opts.lat)}, lng = ${Number(opts.lng)};
      var map = L.map('map', { zoomControl: false, attributionControl: false, dragging: false, scrollWheelZoom: false,
        touchZoom: false, doubleClickZoom: false, boxZoom: false, keyboard: false, tap: false });
      // Frame the area from its own size in metres, before any layer is added. A circle can only measure itself on a map that
      // already has a view, and asking it first throws, which silently ends this script.
      map.fitBounds(L.latLng(lat, lng).toBounds(${PREVIEW_RADIUS_METERS * 2}), { padding: [22, 22] });
      var errors = 0;
      var tiles = L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png?key=${safeKey}', { maxZoom: 18, subdomains: 'abcd' });
      tiles.on('tileload', function () { finish('ready'); });
      tiles.on('tileerror', function () { errors += 1; if (errors >= 3) finish('failed'); });
      tiles.addTo(map);
      var circle = L.circle([lat, lng], { radius: ${PREVIEW_RADIUS_METERS}, color: '${esc(c.circle)}', weight: 2, dashArray: '6 6',
        fillColor: '${esc(c.circleFill)}', fillOpacity: 0.18, interactive: false }).addTo(map);
      L.circleMarker([lat, lng], { radius: 4, color: '${esc(c.centre)}', fillColor: '${esc(c.centre)}', fillOpacity: 1, weight: 1, interactive: false }).addTo(map);
      setTimeout(function () { finish('failed'); }, ${PREVIEW_TIMEOUT_MS});
    })();
  </script>
</body>
</html>`;
}
