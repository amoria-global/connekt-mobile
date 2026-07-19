import type { ID } from '@/types';

export type TvDevice = {
  id: ID;
  deviceLabel: string;
  pairedAt: string;
  lastSeenAt?: string;
};
