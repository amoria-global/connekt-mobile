import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { Text, View } from 'react-native';

import '@/test/autoUnmount';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let mockLanguage = 'en';
const mockGet = jest.fn();
jest.mock('@/contexts/LanguageContext', () => ({ useLanguage: () => ({ language: mockLanguage }) }));
jest.mock('@/api/client', () => ({
  api: { get: (...a: unknown[]) => mockGet(...a), post: jest.fn().mockResolvedValue({ action: 1 }) },
  requireOk: (x: unknown) => x,
}));
jest.mock('expo-router', () => ({ useRouter: () => ({ push: jest.fn() }), Stack: { Screen: () => null } }));
jest.mock('@/utils/copyText', () => ({ copyText: jest.fn().mockResolvedValue('copied') }));
jest.mock('@/features/qr/BrandedQrView', () => ({ BrandedQr: () => null }));
jest.mock('@/features/wishes/saveQr', () => ({ saveQrToPhotos: jest.fn().mockResolvedValue(true) }));
jest.mock('@/features/wallet/api', () => ({
  getWallet: jest.fn().mockResolvedValue({ currency: 'RWF', balanceAvailable: 120000 }),
  listWalletMovementsPage: jest.fn().mockResolvedValue({ items: [], hasMore: false }),
}));
jest.mock('@/components/ui/IconTile', () => ({ IconTile: () => null }));
jest.mock('@/components/ui/Skeleton', () => ({ Skeleton: () => null }));
jest.mock('@/features/auth/role', () => ({ useRole: () => ({ isPhotographer: false }) }));
jest.mock('@/components/ui/Sheet', () => ({
  Sheet: ({ visible = true, title, children }: { visible?: boolean; title: string; children: React.ReactNode }) => {
    const { Text: T, View: V } = require('react-native');
    return visible ? (
      <V>
        <T>{title}</T>
        {children}
      </V>
    ) : null;
  },
}));

import { ThemeProvider } from '@/theme/ThemeProvider';
import { palettes } from '@/theme/palettes';
import { GrowYourStoreCard } from './GrowYourStoreCard';
import { HowItCountsSheet } from './HowReferralsCount';
import { MilestonesBody } from './MilestonesView';
import { MilestoneCongratsSheet } from './MilestoneCongratsSheet';
import { ReferralCodeField } from './ReferralCodeField';
import { ReferralSheet } from './ReferralSheet';
import { ReferralPolicyBody } from './ReferralPolicyBody';
import { ReferredChecklistCard } from './ReferredChecklistCard';
import { SaleDetailsSheet, saleOf } from './SaleDetailsSheet';
import { ShareInviteCard } from './ShareInviteCard';
import { ShareMenuSheet } from './ShareMenuSheet';
import type { ReferralRow, ReferralStats } from './referral';

const noop = () => {};

function stats(q: number, over: Partial<ReferralStats> = {}): ReferralStats {
  const share = q >= 40 ? 90 : q >= 30 ? 85 : q >= 20 ? 80 : q >= 10 ? 75 : 70;
  const next = q >= 40 ? null : q >= 30 ? 40 : q >= 20 ? 30 : q >= 10 ? 20 : 10;
  const nextShare = next == null ? null : next === 40 ? 90 : next === 30 ? 85 : next === 20 ? 80 : 75;
  return {
    code: q >= 40 ? null : 'ABCD2345',
    link: q >= 40 ? null : 'https://connekyt.com/join?ref=ABCD2345',
    qualifying: q,
    cap: 40,
    sharePercent: share,
    nextMilestone: next,
    nextSharePercent: nextShare,
    maxRate: q >= 40,
    complete: q >= 40,
    pending: 2,
    underReview: 1,
    minQualifyingUsd: 5,
    referrals: [],
    hasReferrer: false,
    referrerName: null,
    myReferral: null,
    unlocked: null,
    ...over,
  };
}

const ROWS: ReferralRow[] = [
  { name: 'Jane D.', status: 'pending', date: '2026-11-01', signedUp: true, verifiedPublished: false, firstSale: false, hint: 'waiting_verified_published' },
  { name: 'Ben K.', status: 'pending', date: '2026-11-02', signedUp: true, verifiedPublished: true, firstSale: false, hint: 'waiting_first_sale' },
  { name: 'Aline U.', status: 'under_review', date: '2026-11-03', signedUp: true, verifiedPublished: true, firstSale: true, hint: 'under_review' },
  { name: 'Eric N.', status: 'qualified', date: '2026-11-04', signedUp: true, verifiedPublished: true, firstSale: true, hint: 'qualified' },
  { name: 'Sam T.', status: 'revoked', date: '2026-11-05', signedUp: true, verifiedPublished: true, firstSale: true, hint: 'revoked' },
];

const texts = (r: TestRenderer.ReactTestRenderer) =>
  r.root.findAllByType(Text).map((t) => [t.props.children].flat(Infinity).join('')).filter((s) => /[A-Za-z0-9]/.test(s));
const joined = (r: TestRenderer.ReactTestRenderer) => texts(r).join(' | ');

function mount(node: React.ReactElement, opts: { dark?: boolean; width?: number } = {}) {
  let r!: TestRenderer.ReactTestRenderer;
  act(() => {
    r = TestRenderer.create(
      <ThemeProvider preference={opts.dark ? 'dark' : 'light'}>
        <View style={{ width: opts.width ?? 390 }}>{node}</View>
      </ThemeProvider>,
    );
  });
  return r;
}
const press = (r: TestRenderer.ReactTestRenderer, testID: string) => {
  const n = r.root.findAll((x) => x.props.testID === testID && typeof x.props.onPress === 'function')[0];
  act(() => n.props.onPress());
};
const flush = async () => {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
};

beforeEach(() => {
  mockLanguage = 'en';
  mockGet.mockReset();
});

describe('Grow your store card, every state in light and dark at 360 and 390', () => {
  const cases: Array<[number, string[]]> = [
    [0, ['70%', '0 of 10 referrals']],
    [11, ['75%', '11 of 20 referrals']],
    [39, ['85%', '39 of 40 referrals']],
  ];
  for (const dark of [false, true]) {
    for (const width of [360, 390]) {
      for (const [q, expected] of cases) {
        it(`${q} referrals (${dark ? 'dark' : 'light'}, ${width})`, () => {
          const r = mount(<GrowYourStoreCard stats={stats(q)} status="ready" onInvite={noop} onMilestones={noop} onViewEarnings={noop} onRetry={noop} />, { dark, width });
          const t = joined(r);
          for (const e of expected) expect(t).toContain(e);
          expect(t).toContain('Grow your store');
          expect(t).not.toContain('Invite a photographer');
          expect(t).toContain('Milestones');
        });
      }
      it(`40 referrals: maximum state, no invite (${dark ? 'dark' : 'light'}, ${width})`, () => {
        const r = mount(<GrowYourStoreCard stats={stats(40)} status="ready" onInvite={noop} onMilestones={noop} onViewEarnings={noop} onRetry={noop} />, { dark, width });
        const t = joined(r);
        expect(t).toContain('90% unlocked · Maximum rate active');
        expect(t).toContain('View sale earnings');
        expect(texts(r)).not.toContain('Invite a photographer');
      });
    }
  }

  it('loading and error states are designed', () => {
    const loading = mount(<GrowYourStoreCard stats={null} status="loading" onInvite={noop} onMilestones={noop} onViewEarnings={noop} onRetry={noop} />);
    expect(loading.root.findAll((n) => n.props.testID === 'grow-loading').length).toBeGreaterThan(0);
    const failed = mount(<GrowYourStoreCard stats={null} status="error" onInvite={noop} onMilestones={noop} onViewEarnings={noop} onRetry={noop} />);
    expect(joined(failed)).toContain("We couldn't load your referrals. Try again.");
    expect(joined(failed)).toContain('Try again');
  });

});

describe('How referrals count explainer', () => {
  it('shows the three steps with the minimum in the viewer currency and the suspicious-referrals line', () => {
    const r = mount(<HowItCountsSheet visible onClose={noop} minUsd={5} />);
    const t = joined(r);
    expect(t).toContain('Your friend signs up with your link or code.');
    expect(t).toContain('Their account is verified and they publish their first photo for sale.');
    expect(t).toMatch(/They make their first real sale or paid job \(from a client, at least .*\)\./);
    expect(t).toContain('Referrals that look suspicious are reviewed first.');
  });
  it('speaks the other four languages', () => {
    for (const [lang, word] of [['sw', 'Rafiki yako'], ['rw', 'Inshuti yawe'], ['fr', 'Votre ami'], ['es', 'Tu amigo']]) {
      mockLanguage = lang;
      expect(joined(mount(<HowItCountsSheet visible onClose={noop} />))).toContain(word);
    }
  });
});

describe('Milestones screen body', () => {
  const store = { currency: 'RWF', available: 120000, monthEarnings: 450000, photosSold: 18, topAlbum: null, loading: false };
  const body = (q: number, over: Partial<ReferralStats> = {}) => (
    <MilestonesBody stats={stats(q, over)} currency="RWF" store={store} onInvite={noop} onCopyCode={noop} onRules={noop} />
  );
  for (const dark of [false, true]) {
    for (const width of [360, 390]) {
      for (const q of [0, 11, 39]) {
        it(`${q} referrals renders the rate, example, five tiers, counts and stats (${dark ? 'dark' : 'light'}, ${width})`, () => {
          const r = mount(body(q), { dark, width });
          const t = joined(r);
          expect(t).toContain('Your rate');
          expect(t).toContain('How referrals count');
          expect(t).toContain('Earnings milestones');
          expect(t).toContain('2 pending · 1 under review');
          expect(t).toContain('Program rules');
          expect(t).toContain('Store stats');
          expect(t).toContain('Invite a photographer');
          for (const s of [70, 75, 80, 85, 90]) expect(r.root.findAll((n) => n.props.testID === `tier-${s}`).length).toBeGreaterThan(0);
        });
      }
      it(`40 referrals: maximum, no invite (${dark ? 'dark' : 'light'}, ${width})`, () => {
        const r = mount(body(40), { dark, width });
        const t = joined(r);
        expect(t).toContain('90% unlocked · Maximum rate active');
        expect(texts(r)).not.toContain('Invite a photographer');
        expect(r.root.findAll((n) => n.props.testID === 'ms-example')).toHaveLength(0);
      });
    }
  }

  it('computes the money example in RWF at 11 referrals', () => {
    const t = joined(mount(body(11)));
    expect(t).toContain('9 more referrals unlock 80%');
    expect(t).toMatch(/That's RWF 500 more on a RWF 10,000 sale\./);
  });

  it('marks the tier rows done, current and locked', () => {
    const r = mount(body(11));
    const label = (s: number) => r.root.findAll((n) => n.props.testID === `tier-${s}`)[0].props.accessibilityLabel as string;
    expect(label(70)).toContain('done');
    expect(label(75)).toContain('current');
    expect(label(80)).toContain('locked');
    expect(label(90)).toContain('locked');
  });

  it('shows each referral status with its checks and hint, and never a fraud signal', () => {
    const r = mount(body(3, { referrals: ROWS }));
    const t = joined(r);
    for (const s of ['Pending', 'Under review', 'Qualified', 'Revoked']) expect(t).toContain(s);
    expect(t).toContain('Waiting for verification and their first published photo');
    expect(t).toContain('Waiting for their first sale');
    expect(t).toContain("We're checking this referral (usually within 48 h)");
    expect(t).toContain("This referral didn't qualify");
    for (const c of ['Signed up', 'Verified & published', 'First sale']) expect(t).toContain(c);
    expect(t.toLowerCase()).not.toMatch(/shared phone|same device|payout account|alias|fraud/);
    const rows = r.root.findAll((n) => n.props.testID === 'referral-row' && typeof n.type === 'string');
    expect(rows).toHaveLength(5);
    const jane = rows[0].findAll((n) => typeof n.props.accessibilityLabel === 'string').map((n) => n.props.accessibilityLabel as string);
    expect(jane).toEqual(expect.arrayContaining(['Signed up: ✓', 'Verified & published: …', 'First sale: …']));
    const ben = rows[1].findAll((n) => typeof n.props.accessibilityLabel === 'string').map((n) => n.props.accessibilityLabel as string);
    expect(ben).toEqual(expect.arrayContaining(['Signed up: ✓', 'Verified & published: ✓', 'First sale: …']));
  });

  it('has an empty state', () => {
    const t = joined(mount(body(0, { referrals: [] })));
    expect(t).toContain('No referrals yet');
    expect(t).toContain('Invite a photographer. Their progress shows up here.');
  });

  it('store stats show a dash for an unknown figure and no top album tile without data', () => {
    const r = mount(<MilestonesBody stats={stats(5)} currency="RWF" store={{ ...store, monthEarnings: null, photosSold: null }} onInvite={noop} onCopyCode={noop} onRules={noop} />);
    const t = joined(r);
    expect(t).toContain('-');
    expect(t).not.toContain('Top-selling album');
    expect(t).toContain('This month');
  });
});

describe('invite share sheet', () => {
  it('shows the one-line rule, the code, the buttons and the explainer link', async () => {
    mockGet.mockResolvedValue({ action: 1, data: stats(11) });
    const r = mount(<ReferralSheet visible onClose={noop} />);
    expect(r.root.findAll((n) => n.props.testID === 'invite-loading').length).toBeGreaterThan(0);
    await flush();
    const t = joined(r);
    expect(t).toContain('A referral counts after your friend is verified, publishes a photo and makes their first sale.');
    expect(t).toContain('ABCD2345');
    for (const b of ['Copy', 'WhatsApp', 'More apps', 'Save QR']) expect(t).toContain(b);
    press(r, 'invite-how');
    expect(joined(r)).toContain('Your friend signs up with your link or code.');
  });
  it('shows an error state with retry', async () => {
    mockGet.mockRejectedValue(new Error('x'));
    const r = mount(<ReferralSheet visible onClose={noop} />);
    await flush();
    expect(joined(r)).toContain("We couldn't load your referrals. Try again.");
  });
});

describe('sign-up and add-a-code field', () => {
  it('shows the helper under the field and opens the explainer', () => {
    const r = mount(<ReferralCodeField value="" onChange={noop} />);
    expect(joined(r)).toContain("Your referrer earns more on their photo sales once you're verified and make your first sale.");
    press(r, 'referral-field-how');
    expect(r.root.findAll((n) => n.props.testID === 'how-it-counts').length).toBeGreaterThan(0);
  });
});

describe('referred photographer checklist', () => {
  it('ticks the steps as they happen and names only the referrer', () => {
    const a = mount(<ReferredChecklistCard referral={{ referrerName: 'Jane D.', status: 'pending', verifiedPublished: false, firstSale: false }} />);
    expect(joined(a)).toContain('Help Jane D. unlock rewards');
    expect(joined(a)).toContain('Verify your account · publish your first photo · make your first sale');
    const labels = (r: TestRenderer.ReactTestRenderer) => r.root.findAll((n) => typeof n.props.accessibilityLabel === 'string').map((n) => n.props.accessibilityLabel as string);
    expect(labels(a)).toEqual(expect.arrayContaining(['Signed up: ✓', 'Verified & published: …', 'First sale: …']));
    const b = mount(<ReferredChecklistCard referral={{ referrerName: 'Jane D.', status: 'pending', verifiedPublished: true, firstSale: false }} />);
    expect(labels(b)).toEqual(expect.arrayContaining(['Verified & published: ✓', 'First sale: …']));
  });
  it('disappears when the referral qualifies, is revoked or there is none', () => {
    for (const referral of [
      { referrerName: 'Jane D.', status: 'qualified' as const, verifiedPublished: true, firstSale: true },
      { referrerName: 'Jane D.', status: 'revoked' as const, verifiedPublished: true, firstSale: true },
      null,
    ]) {
      expect(mount(<ReferredChecklistCard referral={referral} />).root.findAll((n) => n.props.testID === 'referred-checklist')).toHaveLength(0);
    }
  });
});

describe('milestone congratulations sheet', () => {
  it('uses the newly unlocked rate, and the maximum wording at 40', () => {
    const a = mount(<MilestoneCongratsSheet unlocked={{ milestone: 10, sharePercent: 75 }} onInviteMore={noop} onViewMilestones={noop} onDismiss={noop} />);
    expect(joined(a)).toContain('You now earn 75% on every photo you sell');
    expect(joined(a)).toContain('Invite more photographers');
    const b = mount(<MilestoneCongratsSheet unlocked={{ milestone: 40, sharePercent: 90 }} onInviteMore={noop} onViewMilestones={noop} onDismiss={noop} />);
    expect(joined(b)).toContain('Maximum rate unlocked: you earn 90% on every photo you sell');
    expect(joined(b)).not.toContain('Invite more photographers');
    expect(mount(<MilestoneCongratsSheet unlocked={null} onInviteMore={noop} onViewMilestones={noop} onDismiss={noop} />).root.findAll((n) => n.props.testID === 'congrats-sheet')).toHaveLength(0);
  });
});

describe('Share and invite card and menu', () => {
  it('badge goes Earn 70% to Unlock 75% to Your share, and disappears at 40', () => {
    const t = (q: number) => joined(mount(<ShareInviteCard stats={stats(q)} onPress={noop} />));
    expect(t(0)).toContain('Earn 70%');
    expect(t(4)).toContain('Unlock 75%');
    expect(t(11)).toContain('Your share: 75%');
    const max = mount(<ShareInviteCard stats={stats(40)} onPress={noop} />);
    expect(max.root.findAll((n) => n.props.testID === 'share-invite-badge')).toHaveLength(0);
    expect(joined(max)).not.toContain('Referral');
  });
  it('menu shows the 11/20 chip and hides the referral item at 40', () => {
    const base = { visible: true, onClose: noop, onAlbum: noop, onProfile: noop, onReferral: noop, canAlbum: true, profileUrl: 'https://connekyt.com/p' };
    const a = mount(<ShareMenuSheet {...base} referralHidden={false} chip="11/20" />);
    expect(joined(a)).toContain('Share referral link or code');
    expect(joined(a)).toContain('11/20');
    const b = mount(<ShareMenuSheet {...base} referralHidden chip={null} />);
    expect(joined(b)).not.toContain('Share referral link or code');
  });
});

describe('wallet sale details', () => {
  const sale = saleOf({ amount: 7500, currency: 'RWF', sale: { sellingPrice: 10000, ratePercent: 75, platformShare: 2500, confirmedAt: '2026-11-20T14:32:00', title: 'Ben & Raya, Album 2' } });
  it('shows what was earned, the rate at sale and the split', () => {
    const t = joined(mount(<SaleDetailsSheet sale={sale} onClose={noop} />));
    expect(t).toContain('RWF 7,500');
    expect(t).toContain('75% of a RWF 10,000 photo sale');
    for (const k of ['Selling price', 'Your rate at sale', 'Platform share', 'Confirmed', 'RWF 2,500']) expect(t).toContain(k);
    expect(t).toContain('Refunds use this same split.');
  });
  it('opens nothing for a movement without a stored split', () => {
    expect(saleOf({ amount: 100, currency: 'RWF' })).toBeNull();
    expect(mount(<SaleDetailsSheet sale={null} onClose={noop} />).root.findAll((n) => n.props.testID === 'sale-details')).toHaveLength(0);
  });
});

describe('policy page', () => {
  it('has the tiers, the 3-step rule, fraud review, the 40 cap, permanence, grandfathering and contact', () => {
    const t = joined(mount(<ReferralPolicyBody />));
    for (const s of ['0-9 referrals', '10-19 referrals', '20-29 referrals', '30-39 referrals', '40 referrals', '70%', '90%',
      'Your friend signs up with your link or code.', 'Fraud review', 'The 40 referral limit', 'Rates are not retroactive', 'Earlier lower fees', 'support@connekyt.com']) {
      expect(t).toContain(s);
    }
  });
});

describe('contrast (WCAG AA 4.5:1) of the colours the milestone screens use', () => {
  const lum = (hex: string) => {
    const n = parseInt(hex.slice(1, 7), 16);
    const f = (v: number) => { const s = v / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; };
    return 0.2126 * f((n >> 16) & 255) + 0.7152 * f((n >> 8) & 255) + 0.0722 * f(n & 255);
  };
  const ratio = (a: string, b: string) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
  for (const scheme of ['light', 'dark'] as const) {
    const c = palettes[scheme];
    it(`${scheme}: text, muted text and link on the card surface, white on the primary button`, () => {
      expect(ratio(c.text, c.surface)).toBeGreaterThanOrEqual(4.5);
      expect(ratio(c.textMuted, c.surface)).toBeGreaterThanOrEqual(4.5);
      expect(ratio(c.link, c.surface)).toBeGreaterThanOrEqual(4.5);
      expect(ratio(c.textOnPrimary, c.primary)).toBeGreaterThanOrEqual(4.5);
    });
  }
});
