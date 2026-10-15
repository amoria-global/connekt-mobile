/**
 * Direct Booking Map API Client & Types.
 * Matches backend DirectBookingMapController (commit 1957e777).
 * Endpoint: GET /api/remote/direct-booking/map
 */
import { api } from '@/api/client';
import type { ApiEnvelope } from '@/types';

export interface ClientLocation {
  latitude: number;
  longitude: number;
  city?: string;
  country?: string;
  message?: string;
  detectedFrom?: string;
  isCurrentLocation?: boolean;
  currentLocation?: boolean;
}

export interface DirectBookingPackageItem {
  packageId: string;
  name: string;
  price: number;
  currency: string;
  durationHours?: number;
  deliveryDays?: number;
  features?: string[];
}

export interface NearbyPhotographerMapItem {
  photographerId: string;
  fullName: string;
  businessName?: string;
  profilePicture?: string;
  coverImage?: string;
  latitude: number;
  longitude: number;
  distanceKm: number;
  distanceFormatted: string;
  city?: string;
  country?: string;
  specialties: string[];
  rating: number;
  reviewCount: number;
  verified: boolean;
  startingPrice: number;
  currency: string;
  directBookingEnabled: boolean;
  packages: DirectBookingPackageItem[];
}

export interface DirectBookingMapData {
  clientLocation: ClientLocation;
  radiusKm: number;
  totalNearby?: number;
  totalFound?: number;
  photographers: NearbyPhotographerMapItem[];
}

export interface DirectBookingMapParams {
  lat?: number;
  lng?: number;
  radiusKm?: number;
  specialty?: string;
  eventDate?: string;
  search?: string;
}

export function calculateHaversineDistanceKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const R = 6371; // Earth's radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 100) / 100;
}

/**
 * Fetch nearby photographers eligible for direct booking on the interactive map.
 * Calls GET /api/remote/direct-booking/map
 */
export async function fetchDirectBookingMap(
  params: DirectBookingMapParams = {},
): Promise<DirectBookingMapData> {
  const q = new URLSearchParams();
  if (typeof params.lat === 'number') q.append('lat', params.lat.toString());
  if (typeof params.lng === 'number') q.append('lng', params.lng.toString());
  if (typeof params.radiusKm === 'number') q.append('radiusKm', params.radiusKm.toString());
  if (params.specialty && params.specialty !== 'All' && params.specialty !== 'All Categories') {
    q.append('specialty', params.specialty);
  }
  if (params.eventDate) q.append('eventDate', params.eventDate);
  if (params.search?.trim()) q.append('search', params.search.trim());

  const queryString = q.toString();
  const res = await api.get<ApiEnvelope<DirectBookingMapData>>(
    `/direct-booking/map?${queryString}`,
  );

  const rawData = res?.data;

  // Normalize clientLocation per backend specification
  const clientLat = rawData?.clientLocation?.latitude ?? params.lat ?? -1.9441;
  const clientLng = rawData?.clientLocation?.longitude ?? params.lng ?? 30.0619;
  const radiusKm = rawData?.radiusKm ?? params.radiusKm ?? 25.0;

  const clientLocation: ClientLocation = {
    latitude: clientLat,
    longitude: clientLng,
    city: rawData?.clientLocation?.city ?? 'Kigali',
    country: rawData?.clientLocation?.country ?? 'Rwanda',
    message: rawData?.clientLocation?.message ?? 'You are here',
    detectedFrom: rawData?.clientLocation?.detectedFrom ?? 'DEFAULT_LOCATION',
    isCurrentLocation:
      rawData?.clientLocation?.isCurrentLocation ??
      rawData?.clientLocation?.currentLocation ??
      true,
  };

  // No fallback. This used to fill an empty map with invented entries
  // (fake GPS offsets, "Standard" 120,000 RWF and "Premium" x1.5 packages
  // with ids pkg-<id>-1/2, a 4.8 rating, verified: true) that reached the
  // booking sheet. An empty map shows its empty state instead.
  const photographers = Array.isArray(rawData?.photographers) ? rawData.photographers : [];

  return {
    clientLocation,
    radiusKm,
    totalNearby: photographers.length,
    totalFound: rawData?.totalFound ?? rawData?.totalNearby ?? photographers.length,
    photographers,
  };
}
