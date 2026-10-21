/**
 * Complete analytics payloads, shaped like the backend's DTOs (CustomerAnalyticsDTO, PhotographerAnalyticsDTO,
 * CoordinatorAnalyticsDTO). The backend always sends every one of these fields, and the app treats a missing figure as
 * an error rather than a zero, so a test that wants a specific figure overrides it on top of a complete payload.
 * The values here are only there to make the payload complete.
 */
export const customerAnalytics = (over: Record<string, unknown> = {}) => ({
  totalEvents: 0,
  upcomingEvents: 0,
  completedEvents: 0,
  cancelledEvents: 0,
  totalBookings: 0,
  totalSpent: 0,
  pendingAmount: 0,
  gifts: 0,
  totalPhotos: 0,
  totalVideos: 0,
  bookmarkedPhotographers: 0,
  unreadNotifications: 0,
  ...over,
});

export const photographerAnalytics = (over: Record<string, unknown> = {}) => ({
  totalEvents: 0,
  upcomingEvents: 0,
  completedEvents: 0,
  totalClients: 0,
  totalBookings: 0,
  totalEarnings: 0,
  totalTips: 0,
  pendingPayments: 0,
  bonuses: 0,
  averageRating: 0,
  totalPhotosUploaded: 0,
  unreadNotifications: 0,
  ...over,
});

export const coordinatorAnalytics = (over: Record<string, unknown> = {}) => ({
  totalCustomers: 0,
  totalPhotographers: 0,
  totalEvents: 0,
  totalRevenue: 0,
  totalPaid: 0,
  totalPending: 0,
  pendingProfileReviews: 0,
  activeStreams: 0,
  totalNotifications: 0,
  unreadContactMessages: 0,
  ...over,
});
