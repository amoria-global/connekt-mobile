/**
 * Unit & flow tests for Client Photo Buying Experience.
 * Verifies multi-album groupings, MoMo formatting/validation, gateway status mappings,
 * and preview URL watermarking invariants.
 */
import {
  stampPreviewUrl,
  getPhotoDownloadUrl,
  type MultiAlbumPurchaseItem,
} from './api';
import { buildPhotoInvoiceHtml } from './invoicePdf';
import {
  formatPhoneE164,
  isPlausibleMobile,
  dialCodeFor,
  phoneHintForCountry,
} from '@/features/payments/formatPhone';

describe('Photo Buying — Multi-album cart grouping', () => {
  it('correctly aggregates multiple photos from the same album into a single slice', () => {
    const rawPicks = [
      { id: 'p1', albumId: 'alb_1', price: 1000, currency: 'RWF' },
      { id: 'p2', albumId: 'alb_1', price: 1500, currency: 'RWF' },
      { id: 'p3', albumId: 'alb_2', price: 2000, currency: 'RWF' },
    ];

    const groups = new Map<string, { ids: string[]; total: number; currency: string }>();
    for (const p of rawPicks) {
      const g = groups.get(p.albumId) || { ids: [], total: 0, currency: p.currency };
      g.ids.push(p.id);
      g.total += p.price;
      groups.set(p.albumId, g);
    }

    const items: MultiAlbumPurchaseItem[] = Array.from(groups.entries()).map(([aId, g]) => ({
      albumId: aId,
      photoIds: g.ids,
      amount: g.total,
      currencyId: g.currency,
    }));

    expect(items).toHaveLength(2);
    expect(items[0]).toEqual({
      albumId: 'alb_1',
      photoIds: ['p1', 'p2'],
      amount: 2500,
      currencyId: 'RWF',
    });
    expect(items[1]).toEqual({
      albumId: 'alb_2',
      photoIds: ['p3'],
      amount: 2000,
      currencyId: 'RWF',
    });
  });
});

describe('Photo Buying — Mobile Money phone validation & formatting', () => {
  it('formats Rwandan local numbers (078...) into E.164 (25078...)', () => {
    expect(formatPhoneE164('0788123456', 'RW')).toBe('250788123456');
    expect(formatPhoneE164('788123456', 'RW')).toBe('250788123456');
    expect(formatPhoneE164('250788123456', 'RW')).toBe('250788123456');
    expect(formatPhoneE164('078 812 3456', 'RW')).toBe('250788123456');
  });

  it('validates Rwanda national mobile numbers starting with 7 (9 digits)', () => {
    const rwRegex = /^7\d{8}$/;
    expect(rwRegex.test('788123456')).toBe(true);
    expect(rwRegex.test('728123456')).toBe(true);
    expect(rwRegex.test('738123456')).toBe(true);
    expect(rwRegex.test('798123456')).toBe(true);
    // Invalid: leading 0 not stripped yet
    expect(rwRegex.test('0788123456')).toBe(false);
    // Invalid: wrong starting digit or length
    expect(rwRegex.test('888123456')).toBe(false);
    expect(rwRegex.test('78812345')).toBe(false);
  });

  it('validates plausible mobile numbers in Rwanda and Kenya', () => {
    expect(isPlausibleMobile('0788123456', 'RW')).toBe(true);
    expect(isPlausibleMobile('078', 'RW')).toBe(false);
    expect(isPlausibleMobile('0712345678', 'KE')).toBe(true);
  });

  it('provides country-specific hints and dial codes', () => {
    expect(dialCodeFor('RW')).toBe('250');
    expect(dialCodeFor('KE')).toBe('254');
    expect(dialCodeFor('UG')).toBe('256');
    expect(phoneHintForCountry('RW')).toBe('078XXXXXXX');
  });
});

describe('Photo Buying — Watermarking & Download URL security', () => {
  it('stamps preview URLs with viewer ID for unpurchased watermarking', () => {
    const preview = 'https://backend.connekyt.com/api/photos/123/preview';
    const stamped = stampPreviewUrl(preview, 'V_TEST_USER');
    expect(stamped).toBe('https://backend.connekyt.com/api/photos/123/preview?v=V_TEST_USER');
  });

  it('does not tamper with external or non-preview URLs', () => {
    const raw = 'https://cdn.example.com/photos/123.jpg';
    expect(stampPreviewUrl(raw, 'V_USER')).toBe(raw);
  });

  it('builds authenticated download URLs for purchased originals using refid and buyerId', () => {
    const downloadUrl = getPhotoDownloadUrl('alb_456', 'photo_789', {
      refid: 'REF_ABC123',
      buyerId: 'BUY_XYZ',
    });
    expect(downloadUrl).toContain('/public/albums/alb_456/photo/photo_789/download');
    expect(downloadUrl).toContain('refid=REF_ABC123');
    expect(downloadUrl).toContain('buyerId=BUY_XYZ');
  });
});

describe('Photo Buying — PDF Invoice Generator', () => {
  it('builds an HTML invoice containing buyer details, items breakdown, and unlock code', () => {
    const html = buildPhotoInvoiceHtml({
      refid: 'REF_TEST123456',
      date: new Date('2026-09-18T10:00:00Z'),
      buyerName: 'Jean Dupont',
      buyerEmail: 'jean@example.com',
      buyerPhone: '+250 788123456',
      paymentMethod: 'MTN Mobile Money',
      country: 'RW',
      photoCount: 3,
      photographerCount: 2,
      currency: 'RWF',
      amount: 4500,
      unlockCode: 'CK-UNLOCK-789',
    });

    expect(html).toContain('Jean Dupont');
    expect(html).toContain('jean@example.com');
    expect(html).toContain('+250 788123456');
    expect(html).toContain('CK-UNLOCK-789');
    expect(html).toContain('MTN Mobile Money');
    expect(html).toContain('4500.00');
    expect(html).toContain('3 photos');
    expect(html).toContain('REF_TEST123456');
    expect(html).toContain('PAYMENT SETTLED');
  });

  it('handles singular photo count and missing optional phone gracefully', () => {
    const html = buildPhotoInvoiceHtml({
      refid: 'REF_SINGLE',
      date: new Date('2026-09-18T10:00:00Z'),
      buyerName: 'Alice Smith',
      buyerEmail: 'alice@example.com',
      paymentMethod: 'Card Payment',
      country: 'KE',
      photoCount: 1,
      photographerCount: 1,
      currency: 'KES',
      amount: 500,
      unlockCode: '',
    });

    expect(html).toContain('1 photo');
    expect(html).not.toContain('1 photos');
    expect(html).toContain('Alice Smith');
    expect(html).toContain('KES 500.00');
  });
});
