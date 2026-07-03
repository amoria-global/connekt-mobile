import type { ID } from '@/types';

/**
 * Roles in the Connekyt platform.
 *
 * `User` is a mobile-app / smart-TV consumer role (buy streams & photos, book
 * photographers, manage & pay pending payments). It is deliberately not offered
 * on the web sign-up.
 */
export type CustomerType = 'Photographer' | 'Client' | 'Coordinator' | 'Viewer' | 'User';

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
  /** Optional — mobile/TV users may register with a phone number only, in
   *  which case the OTP is delivered by SMS. */
  email?: string;
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
