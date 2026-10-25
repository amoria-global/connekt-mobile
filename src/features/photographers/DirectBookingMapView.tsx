import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';
import BottomSheet from '@gorhom/bottom-sheet';
import {
  fetchDirectBookingMap,
  type DirectBookingMapData,
  type NearbyPhotographerMapItem,
} from './mapApi';
import { BookingBottomSheet } from '@/features/booking/BookingBottomSheet';
import { formatPrice } from '@/utils/format';
import { fontSize, fontWeight, makeStyles, radii, spacing, useTheme, onFill } from '@/theme';
import { useSharedT } from '@/i18n/sharedStrings';

const RADIUS_OPTIONS = [5, 10, 25, 50] as const;

export type DirectBookingMapViewProps = {
  initialSearch?: string;
  initialSpecialty?: string;
  initialRadiusKm?: number;
  onPhotographerSelected?: (photographer: NearbyPhotographerMapItem) => void;
  style?: any;
};

export function DirectBookingMapView({
  initialSearch = '',
  initialSpecialty = 'All',
  initialRadiusKm = 25,
  onPhotographerSelected,
  style,
}: DirectBookingMapViewProps) {
  const { colors, isDark } = useTheme();
  const styles = useStyles();
  const router = useRouter();
  const { tr } = useSharedT();

  const webViewRef = useRef<WebView>(null);
  const bookingSheetRef = useRef<BottomSheet>(null);

  const [mapData, setMapData] = useState<DirectBookingMapData | null>(null);
  const [loading, setLoading] = useState(true);
  const [radiusKm, setRadiusKm] = useState<number>(initialRadiusKm);
  const [specialty, setSpecialty] = useState<string>(initialSpecialty);
  const [search, setSearch] = useState<string>(initialSearch);
  const [selectedPhotographer, setSelectedPhotographer] =
    useState<NearbyPhotographerMapItem | null>(null);
  const [bookingPhotographer, setBookingPhotographer] =
    useState<NearbyPhotographerMapItem | null>(null);

  // Sync props if changed from parent
  useEffect(() => {
    setSpecialty(initialSpecialty);
  }, [initialSpecialty]);

  useEffect(() => {
    setSearch(initialSearch);
  }, [initialSearch]);

  const loadMap = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchDirectBookingMap({
        radiusKm,
        specialty: specialty === 'All' ? undefined : specialty,
        search: search.trim() || undefined,
      });
      setMapData(data);
      if (data.photographers.length > 0 && !selectedPhotographer) {
        setSelectedPhotographer(data.photographers[0]);
      }
    } catch {
      // Retain existing state if network hiccup occurs
    } finally {
      setLoading(false);
    }
  }, [radiusKm, specialty, search]);

  useEffect(() => {
    loadMap();
  }, [loadMap]);

  const handleSelectPhotographer = (item: NearbyPhotographerMapItem) => {
    setSelectedPhotographer(item);
    onPhotographerSelected?.(item);
    // Pan Leaflet map to selected photographer
    const js = `window.focusPhotographer && window.focusPhotographer('${item.photographerId}'); true;`;
    webViewRef.current?.injectJavaScript(js);
  };

  const handleRecenter = () => {
    const js = `window.recenterToClient && window.recenterToClient(); true;`;
    webViewRef.current?.injectJavaScript(js);
  };

  const handleOpenBooking = (item: NearbyPhotographerMapItem) => {
    setBookingPhotographer(item);
    setTimeout(() => {
      bookingSheetRef.current?.snapToIndex(0);
    }, 50);
  };

  const onWebViewMessage = (event: WebViewMessageEvent) => {
    try {
      const msg = JSON.parse(event.nativeEvent.data);
      if (msg.type === 'SELECT_PHOTOGRAPHER') {
        const found = mapData?.photographers.find(
          (p) => p.photographerId === msg.photographerId,
        );
        if (found) {
          setSelectedPhotographer(found);
          onPhotographerSelected?.(found);
        }
      } else if (msg.type === 'DESELECT') {
        setSelectedPhotographer(null);
      }
    } catch {
      // Ignore unparseable messages
    }
  };

  // Build the self-contained HTML page using Leaflet + OpenStreetMap Carto tiles
  const htmlContent = useMemo(() => {
    const client = mapData?.clientLocation ?? {
      latitude: -1.9441,
      longitude: 30.0619,
      city: 'Kigali',
      country: 'Rwanda',
      message: 'You are here',
    };
    const photographers = mapData?.photographers ?? [];
    const tileTheme = isDark
      ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
      : 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png';
    const bgColor = isDark ? '#0A0F1D' : '#F8FAFC';
    const primaryColor = '#083A85';
    const accentColor = '#F20C8F';

    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" integrity="sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=" crossorigin="" />
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js" integrity="sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo=" crossorigin=""></script>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; -webkit-tap-highlight-color: transparent; }
    html, body, #map { width: 100%; height: 100%; background: ${bgColor}; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; overflow: hidden; }
    
    /* Radar Beacon "You are here" Marker */
    .radar-container {
      position: relative;
      width: 44px;
      height: 44px;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .radar-pulse {
      position: absolute;
      width: 44px;
      height: 44px;
      border-radius: 50%;
      background: rgba(37, 99, 235, 0.4);
      animation: radar-wave 2.2s ease-out infinite;
    }
    .radar-dot {
      width: 18px;
      height: 18px;
      border-radius: 50%;
      background: #2563EB;
      border: 3px solid #FFFFFF;
      box-shadow: 0 0 10px rgba(37, 99, 235, 0.8), 0 4px 8px rgba(0,0,0,0.3);
      z-index: 2;
    }
    .radar-label {
      position: absolute;
      top: -30px;
      left: 50%;
      transform: translateX(-50%);
      background: #083A85;
      color: #FFFFFF;
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.3px;
      padding: 4px 10px;
      border-radius: 12px;
      white-space: nowrap;
      box-shadow: 0 4px 12px rgba(8, 58, 133, 0.4);
      border: 1px solid rgba(255, 255, 255, 0.25);
      z-index: 3;
      display: flex;
      align-items: center;
      gap: 4px;
    }
    .radar-label::after {
      content: '';
      position: absolute;
      bottom: -4px;
      left: 50%;
      transform: translateX(-50%);
      border-width: 4px 4px 0 4px;
      border-style: solid;
      border-color: #083A85 transparent transparent transparent;
    }
    @keyframes radar-wave {
      0% { transform: scale(0.4); opacity: 1; }
      70% { transform: scale(1.6); opacity: 0.15; }
      100% { transform: scale(2.2); opacity: 0; }
    }

    /* Custom Photographer Pill Marker */
    .pro-marker {
      display: flex;
      flex-direction: column;
      align-items: center;
      cursor: pointer;
      transition: transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);
    }
    .pro-marker:active, .pro-marker.active {
      transform: scale(1.15) translateY(-4px);
      z-index: 9999 !important;
    }
    .pro-pill {
      background: ${isDark ? '#1E293B' : onFill};
      color: ${isDark ? '#F8FAFC' : '#0F172A'};
      padding: 5px 9px;
      border-radius: 20px;
      display: flex;
      align-items: center;
      gap: 6px;
      box-shadow: 0 6px 16px rgba(0,0,0,${isDark ? '0.6' : '0.18'});
      border: 2px solid ${isDark ? '#334155' : '#E2E8F0'};
      white-space: nowrap;
      transition: all 0.2s ease;
    }
    .pro-marker.active .pro-pill {
      border-color: ${accentColor};
      box-shadow: 0 0 14px rgba(242, 12, 143, 0.45);
    }
    .pro-avatar {
      width: 22px;
      height: 22px;
      border-radius: 50%;
      object-fit: cover;
      background: #64748B;
    }
    .pro-price {
      font-size: 11px;
      font-weight: 700;
      color: ${isDark ? '#38BDF8' : '#083A85'};
    }
    .pro-rating {
      font-size: 10px;
      font-weight: 700;
      color: #F59E0B;
      display: flex;
      align-items: center;
    }
    .pro-arrow {
      width: 0;
      height: 0;
      border-left: 6px solid transparent;
      border-right: 6px solid transparent;
      border-top: 6px solid ${isDark ? '#334155' : '#E2E8F0'};
      margin-top: -1px;
      transition: border-top-color 0.2s ease;
    }
    .pro-marker.active .pro-arrow {
      border-top-color: ${accentColor};
    }
  </style>
</head>
<body>
  <div id="map"></div>
  <script>
    var clientLat = ${client.latitude};
    var clientLng = ${client.longitude};
    var radiusKm = ${radiusKm};
    var photographers = ${JSON.stringify(photographers)};

    var map = L.map('map', {
      zoomControl: false,
      attributionControl: false
    }).setView([clientLat, clientLng], 13);

    L.tileLayer('${tileTheme}', {
      maxZoom: 19,
      subdomains: 'abcd'
    }).addTo(map);

    // Add Client "You are here" Radar Marker
    var radarIcon = L.divIcon({
      className: '',
      html: '<div class="radar-container">' +
              '<div class="radar-pulse"></div>' +
              '<div class="radar-dot"></div>' +
              '<div class="radar-label">📍 ' + ${JSON.stringify(client.message || 'You are here')} + '</div>' +
            '</div>',
      iconSize: [44, 44],
      iconAnchor: [22, 22]
    });
    var clientMarker = L.marker([clientLat, clientLng], { icon: radarIcon, zIndexOffset: 1000 }).addTo(map);

    // Radius Circle
    var circle = L.circle([clientLat, clientLng], {
      radius: radiusKm * 1000,
      color: '${isDark ? '#38BDF8' : '#2563EB'}',
      fillColor: '${isDark ? '#38BDF8' : '#2563EB'}',
      fillOpacity: 0.06,
      weight: 1.5,
      dashArray: '5, 5'
    }).addTo(map);

    // Photographer Markers
    var markersMap = {};
    var currentActiveId = null;

    photographers.forEach(function(p) {
      var priceLabel = 'from ' + (p.startingPrice ? p.startingPrice.toLocaleString() : '100,000') + ' ' + (p.currency || 'RWF');
      var avatarSrc = p.profilePicture || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=120&q=80';
      var ratingLabel = p.rating ? '★ ' + p.rating.toFixed(1) : '';

      var markerHtml = '<div class="pro-marker" id="marker-' + p.photographerId + '">' +
        '<div class="pro-pill">' +
          '<img class="pro-avatar" src="' + avatarSrc + '" onerror="this.src=\\'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=120&q=80\\'" />' +
          '<span class="pro-price">' + priceLabel + '</span>' +
          (ratingLabel ? '<span class="pro-rating">' + ratingLabel + '</span>' : '') +
        '</div>' +
        '<div class="pro-arrow"></div>' +
      '</div>';

      var pIcon = L.divIcon({
        className: '',
        html: markerHtml,
        iconSize: [140, 42],
        iconAnchor: [70, 42]
      });

      var m = L.marker([p.latitude, p.longitude], { icon: pIcon }).addTo(map);
      markersMap[p.photographerId] = m;

      m.on('click', function(e) {
        L.DomEvent.stopPropagation(e);
        focusPhotographer(p.photographerId);
        if (window.ReactNativeWebView) {
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'SELECT_PHOTOGRAPHER',
            photographerId: p.photographerId
          }));
        }
      });
    });

    map.on('click', function() {
      clearActiveMarker();
      if (window.ReactNativeWebView) {
        window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'DESELECT' }));
      }
    });

    function clearActiveMarker() {
      if (currentActiveId && document.getElementById('marker-' + currentActiveId)) {
        document.getElementById('marker-' + currentActiveId).classList.remove('active');
      }
      currentActiveId = null;
    }

    window.focusPhotographer = function(id) {
      clearActiveMarker();
      currentActiveId = id;
      var el = document.getElementById('marker-' + id);
      if (el) el.classList.add('active');
      var m = markersMap[id];
      if (m) {
        map.panTo(m.getLatLng(), { animate: true, duration: 0.6 });
      }
    };

    window.recenterToClient = function() {
      map.flyTo([clientLat, clientLng], 13, { duration: 0.8 });
    };

    // Auto-fit initial bounds to encompass client + nearest photographers
    if (photographers.length > 0) {
      var group = L.featureGroup([clientMarker].concat(Object.values(markersMap)));
      map.fitBounds(group.getBounds().pad(0.18));
    }
  </script>
</body>
</html>`;
  }, [mapData, isDark, radiusKm]);

  return (
    <View style={[styles.container, style]}>
      {/* Interactive Map WebView */}
      <WebView
        ref={webViewRef}
        originWhitelist={['*']}
        source={{ html: htmlContent }}
        style={styles.webview}
        javaScriptEnabled
        domStorageEnabled
        scrollEnabled={false}
        onMessage={onWebViewMessage}
        renderLoading={() => (
          <View style={styles.loaderCenter}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        )}
      />

      {/* Floating Header Control Bar */}
      <View style={styles.floatingHeader}>
        <View style={styles.locationPill}>
          <View style={styles.radarDotMini} />
          <Text style={styles.locationPillText} numberOfLines={1}>
            {mapData?.clientLocation?.message || 'You are here'} •{' '}
            {mapData?.clientLocation?.city || 'Kigali'} (
            {mapData?.totalNearby ?? mapData?.photographers?.length ?? 0} pros)
          </Text>
        </View>

        <Pressable
          style={styles.recenterBtn}
          onPress={handleRecenter}
          accessibilityLabel="Center on your location"
        >
          <Ionicons name="locate" size={18} color={colors.primary} />
        </Pressable>
      </View>

      {/* Radius Filter Rail */}
      <View style={styles.radiusBar}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.radiusScroll}
        >
          {RADIUS_OPTIONS.map((r) => {
            const active = r === radiusKm;
            return (
              <Pressable
                key={r}
                style={[styles.radiusChip, active && styles.radiusChipActive]}
                onPress={() => setRadiusKm(r)}
              >
                <Text style={[styles.radiusChipText, active && styles.radiusChipTextActive]}>
                  {r} km radius
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {/* Loading Overlay */}
      {loading && !mapData && (
        <View style={styles.loaderOverlay}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loaderText}>{tr('Finding nearby direct booking pros...')}</Text>
        </View>
      )}

      {/* Floating Selected Photographer Card */}
      {selectedPhotographer && (
        <View style={styles.floatingCard}>
          <Pressable
            style={styles.closeCardBtn}
            onPress={() => setSelectedPhotographer(null)}
            hitSlop={8}
          >
            <Ionicons name="close" size={16} color={colors.textMuted} />
          </Pressable>

          <View style={styles.cardHeader}>
            <Image
              source={{
                uri:
                  selectedPhotographer.profilePicture ||
                  'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80',
              }}
              style={styles.cardAvatar}
            />
            <View style={styles.cardInfo}>
              <View style={styles.nameRow}>
                <Text style={styles.cardName} numberOfLines={2}>
                  {selectedPhotographer.fullName}
                </Text>
                {selectedPhotographer.verified && (
                  <Ionicons name="checkmark-circle" size={16} color={colors.primary} />
                )}
              </View>
              <Text style={styles.cardBiz} numberOfLines={2}>
                {selectedPhotographer.businessName || 'Verified Creative Studio'}
              </Text>
              <View style={styles.metaRow}>
                <View style={styles.distanceBadge}>
                  <Ionicons name="location" size={11} color="#0284C7" />
                  <Text style={styles.distanceText}>
                    {selectedPhotographer.distanceFormatted ||
                      `${selectedPhotographer.distanceKm} km away`}
                  </Text>
                </View>
                <View style={styles.ratingBadge}>
                  <Ionicons name="star" size={11} color="#F59E0B" />
                  <Text style={styles.ratingText}>
                    {selectedPhotographer.rating.toFixed(1)} (
                    {selectedPhotographer.reviewCount})
                  </Text>
                </View>
              </View>
            </View>
          </View>

          {/* Specialties Chips */}
          {selectedPhotographer.specialties?.length > 0 && (
            <View style={styles.specChipsRow}>
              {selectedPhotographer.specialties.slice(0, 3).map((s) => (
                <View key={s} style={styles.specChip}>
                  <Text style={styles.specChipText}>{s}</Text>
                </View>
              ))}
            </View>
          )}

          {/* Price & Actions Row */}
          <View style={styles.cardFooter}>
            <View>
              <Text style={styles.priceLabel}>{tr('Starting from')}</Text>
              <Text style={styles.priceVal}>
                {formatPrice(
                  selectedPhotographer.startingPrice,
                  selectedPhotographer.currency,
                )}
              </Text>
            </View>

            <View style={styles.actionsGroup}>
              <Pressable
                style={styles.viewProfileBtn}
                onPress={() =>
                  router.push(`/photographer/${selectedPhotographer.photographerId}` as never)
                }
              >
                <Text style={styles.viewProfileText}>{tr('Profile')}</Text>
              </Pressable>

              <Pressable
                style={styles.bookNowBtn}
                onPress={() => handleOpenBooking(selectedPhotographer)}
              >
                <Ionicons name="flash" size={14} color={onFill} />
                <Text style={styles.bookNowText}>{tr('Book Now')}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      )}

      {/* Direct Booking Bottom Sheet */}
      <BookingBottomSheet
        ref={bookingSheetRef}
        photographerId={bookingPhotographer?.photographerId}
        photographerName={bookingPhotographer?.fullName}
        photographerImage={bookingPhotographer?.profilePicture}
        packages={bookingPhotographer?.packages || []}
      />
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  container: {
    flex: 1,
    position: 'relative',
    backgroundColor: colors.background,
  },
  webview: {
    flex: 1,
    backgroundColor: colors.background,
  },
  loaderCenter: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
  floatingHeader: {
    position: 'absolute',
    top: 12,
    left: 12,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    zIndex: 10,
    gap: 8,
  },
  locationPill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 8,
    shadowColor: colors.shadow,
    shadowOpacity: 0.1,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  radarDotMini: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.primary,
    borderWidth: 2,
    borderColor: colors.textOnPrimary,
  },
  locationPillText: {
    fontSize: 12,
    fontWeight: fontWeight.bold,
    color: colors.text,
  },
  recenterBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: colors.shadow,
    shadowOpacity: 0.12,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  radiusBar: {
    position: 'absolute',
    top: 58,
    left: 0,
    right: 0,
    zIndex: 9,
  },
  radiusScroll: {
    paddingHorizontal: 12,
    gap: 8,
  },
  radiusChip: {
    paddingVertical: 5,
    paddingHorizontal: 12,
    borderRadius: radii.full,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  radiusChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  radiusChipText: {
    fontSize: 12,
    fontWeight: fontWeight.medium,
    color: colors.textMuted,
  },
  radiusChipTextActive: {
    color: colors.textOnPrimary,
    fontWeight: fontWeight.bold,
  },
  loaderOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0,0,0,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 20,
    gap: 10,
  },
  loaderText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    color: colors.textOnPrimary,
  },
  floatingCard: {
    position: 'absolute',
    bottom: 20,
    left: 14,
    right: 14,
    backgroundColor: colors.card,
    borderRadius: radii.xl,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: colors.shadow,
    shadowOpacity: 0.2,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
    zIndex: 50,
  },
  closeCardBtn: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  cardAvatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.surfaceMuted,
  },
  cardInfo: {
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  cardName: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.bold,
    color: colors.text,
  },
  cardBiz: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 1,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 4,
  },
  distanceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  distanceText: {
    fontSize: 12,
    fontWeight: fontWeight.semibold,
    color: '#0284C7',
  },
  ratingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  ratingText: {
    fontSize: 12,
    fontWeight: fontWeight.bold,
    color: colors.pending,
  },
  specChipsRow: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 10,
  },
  specChip: {
    paddingVertical: 2,
    paddingHorizontal: 8,
    borderRadius: radii.sm,
    backgroundColor: colors.surfaceMuted,
  },
  specChipText: {
    fontSize: 10,
    fontWeight: fontWeight.medium,
    color: colors.textMuted,
    textTransform: 'uppercase',
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: colors.borderSoft,
  },
  priceLabel: {
    fontSize: 10,
    color: colors.textMuted,
  },
  priceVal: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.bold,
    color: colors.primary,
  },
  actionsGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  viewProfileBtn: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: colors.border,
  },
  viewProfileText: {
    fontSize: 12,
    fontWeight: fontWeight.semibold,
    color: colors.text,
  },
  bookNowBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: radii.full,
    backgroundColor: colors.accent,
  },
  bookNowText: {
    fontSize: 12,
    fontWeight: fontWeight.bold,
    color: colors.textOnPrimary,
  },
}));
