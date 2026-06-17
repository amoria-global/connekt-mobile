import { api } from '../client';
import type { ApiEnvelope } from '@/types';

export type CreateBookingPayload = {
  photographerId: string;
  packageId: string;
  eventName: string;
  location: string;
  date: string;
  startTime: string;
  endTime: string;
  guests: number;
  notes?: string;
  paymentMilestone: 'full' | 'half' | 'seventy';
  currency: string;
};

export const bookingsApi = {
  /**
   * Submits a new booking request to the backend.
   */
  create: (payload: CreateBookingPayload) => 
    api.post<ApiEnvelope<{ bookingId: string }>>('/bookings', payload),
};
