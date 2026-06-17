import type { ID } from '@/types';

/** Roles in the Connekyt platform. */
export type CustomerType = 'Photographer' | 'Client' | 'Coordinator' | 'Viewer';

export type User = {
  customerId: ID;
  email: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  customerType?: CustomerType;
  profilePicture?: string;
  coverPicture?: string;
  profileCompletionPercentage?: number;
};

export type LoginCredentials = {
  email: string;
  password: string;
};

export type SignupPayload = {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phone: string;
  customerType: CustomerType;
};

/** Persisted session: tokens + the user profile. */
export type AuthSession = {
  token: string;
  refreshToken?: string;
  user: User;
};

/**
 * Raw login response from POST /auth/login.
 * action: 1 = success, 0 = OTP unverified / locked, 2 = 2FA required.
 */
export type LoginResponse = {
  action: number;
  message?: string;
  customerId?: ID;
  email?: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  customerType?: CustomerType;
  profilePicture?: string;
  profileCompletionPercentage?: number;
  token?: string;
  refreshToken?: string;
  token_expiry?: string;
  mustChangePassword?: boolean;
};
