#!/usr/bin/env bash
# Sync the dev API/media host to this Mac's current LAN IP.
# Updates BOTH:
#   - connekt-mobile/.env                       (EXPO_PUBLIC_API_BASE_URL  → app calls)
#   - amoria-connect application-dev.properties (base-url                  → media URLs)
# Run this whenever login breaks or images go blank after your Mac's IP changes.
#
#   ./scripts/set-dev-ip.sh
#
# Then restart the backend (./mvnw spring-boot:run) and the app (npx expo start -c).
set -euo pipefail

IP="$(ipconfig getifaddr en0 2>/dev/null || true)"
[ -z "$IP" ] && IP="$(ipconfig getifaddr en1 2>/dev/null || true)"
if [ -z "$IP" ]; then
  echo "❌ Could not detect a LAN IP (are you on Wi-Fi?)."
  exit 1
fi

ROOT="$(cd "$(dirname "$0")/.." && pwd)"            # connekt-mobile
ENV_FILE="$ROOT/.env"
PROPS="$ROOT/../amoria-connect/src/main/resources/application-dev.properties"

# 1) Mobile app .env
printf 'EXPO_PUBLIC_API_BASE_URL=http://%s:8080/api/remote\n' "$IP" > "$ENV_FILE"
echo "✓ .env            → http://$IP:8080/api/remote"

# 2) Backend base-url (media URLs)
if [ -f "$PROPS" ]; then
  /usr/bin/sed -i '' -E "s|^base-url=.*|base-url=http://$IP:8080|" "$PROPS"
  echo "✓ base-url        → http://$IP:8080  (in application-dev.properties)"
else
  echo "⚠ backend props not found at $PROPS (skipped)"
fi

echo ""
echo "Next:"
echo "  1) restart backend:  cd $ROOT/../amoria-connect && ./mvnw spring-boot:run"
echo "  2) restart app:      cd $ROOT && npx expo start -c"
