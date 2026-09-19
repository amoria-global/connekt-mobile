import { getKycBannerConfig } from './bannerConfig';
import { lightPalette } from '@/theme/palettes';

describe('getKycBannerConfig', () => {
  it('returns visible=false when status is APPROVED', () => {
    const config = getKycBannerConfig('APPROVED', 'Client', lightPalette);
    expect(config.visible).toBe(false);
  });

  it('returns visible=false for Viewer role regardless of status', () => {
    const config = getKycBannerConfig('NONE', 'Viewer', lightPalette);
    expect(config.visible).toBe(false);
  });

  it('marks KYC as Optional for Client role when not submitted', () => {
    const config = getKycBannerConfig('NONE', 'Client', lightPalette);
    expect(config.visible).toBe(true);
    expect(config.title).toBe('Complete KYC');
    expect(config.badge).toBe('Optional');
    expect(config.buttonText).toBe('Verify');
  });

  it('treats NOT_SUBMITTED status as not submitted', () => {
    const config = getKycBannerConfig('NOT_SUBMITTED', 'Client', lightPalette);
    expect(config.visible).toBe(true);
    expect(config.badge).toBe('Optional');
  });

  it('marks KYC as Optional for User role when not submitted', () => {
    const config = getKycBannerConfig(undefined, 'User', lightPalette);
    expect(config.visible).toBe(true);
    expect(config.badge).toBe('Optional');
  });

  it('marks KYC as Optional for Coordinator role when not submitted', () => {
    const config = getKycBannerConfig('NONE', 'Coordinator', lightPalette);
    expect(config.visible).toBe(true);
    expect(config.badge).toBe('Optional');
  });

  it('marks KYC as Recommended for Photographer role when not submitted', () => {
    const config = getKycBannerConfig('NONE', 'Photographer', lightPalette);
    expect(config.visible).toBe(true);
    expect(config.badge).toBe('Recommended');
  });

  it('handles PENDING status appropriately', () => {
    const config = getKycBannerConfig('PENDING', 'Client', lightPalette);
    expect(config.visible).toBe(true);
    expect(config.title).toBe('KYC Under Review');
    expect(config.badge).toBe('In Review');
    expect(config.buttonText).toBe('Check status');
  });

  it('handles REJECTED status appropriately with Action Required badge', () => {
    const config = getKycBannerConfig('REJECTED', 'Client', lightPalette);
    expect(config.visible).toBe(true);
    expect(config.title).toBe('KYC Needs Attention');
    expect(config.badge).toBe('Action Required');
    expect(config.buttonText).toBe('Resubmit');
    expect(config.accent).toBe(lightPalette.error);
  });
});
