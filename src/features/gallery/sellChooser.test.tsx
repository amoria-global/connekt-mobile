import React from 'react';
import fs from 'fs';
import path from 'path';
import TestRenderer, { act, type ReactTestInstance } from 'react-test-renderer';
import { Text } from 'react-native';

import { SellChooserSheet, useSellChooser } from './SellChooserSheet';
import { ContentOutcomeView } from './ContentOutcomeView';
import { FadedChipRow, hasMoreToRight, FADE_STEPS } from '@/components/ui/FadedChipRow';
import { CONTENT_PHOTOS_ERROR, CONTENT_SAVED_DRAFT, CONTENT_SUBMITTED, SELL_CHOICES, SELL_CHOOSER_TITLE, SELL_CONTENT_HREF, SELL_PHOTOS_HREF, contentSubmitFailed, parseSellChoice } from './sellPhotos';
import { listContentAlbums, createContentAlbum } from './api';
import { FAB_SPACE } from '@/features/events/CreateFab';
import '@/test/autoUnmount';

/**
 * The Sell photos chooser: every entry opens it before any form, each option opens the right flow, the last choice is
 * remembered, content albums never touch face indexing or credits, the list counts photos from the field the server
 * sends, and the chip row / floating button leave nothing cut off or covered.
 */

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const mockPush = jest.fn();
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush, replace: jest.fn() }) }));
jest.mock('@/components/ui/Sheet', () => ({
  Sheet: ({ visible = true, title, children }: { visible?: boolean; title: string; children: React.ReactNode }) => {
    const { Text: T, View } = require('react-native');
    return visible ? (
      <View>
        <T>{title}</T>
        {children}
      </View>
    ) : null;
  },
}));
const mockStore: Record<string, string> = {};
jest.mock('@/services/storage', () => ({
  storage: {
    get: async (k: string) => mockStore[k] ?? null,
    set: async (k: string, v: string) => {
      mockStore[k] = v;
    },
    remove: async (k: string) => {
      delete mockStore[k];
    },
  },
}));
const mockApiGet = jest.fn();
const mockApiPost = jest.fn();
jest.mock('@/api/client', () => ({
  api: { get: (...a: unknown[]) => mockApiGet(...a), post: (...a: unknown[]) => mockApiPost(...a) },
  requireOk: (r: unknown) => jest.requireActual('@/api/client').requireOk(r),
}));
jest.mock('@/services/imagePicker', () => ({}));

const flat = (node: ReactTestInstance) =>
  node
    .findAllByType(Text)
    .map((t) => (Array.isArray(t.props.children) ? t.props.children.join('') : String(t.props.children ?? '')))
    .join(' | ');
const mount = async (el: React.ReactElement) => {
  let r!: TestRenderer.ReactTestRenderer;
  await act(async () => {
    r = TestRenderer.create(el);
  });
  return r;
};
const pressByTestId = async (r: TestRenderer.ReactTestRenderer, id: string) => {
  const node = r.root.findAll((n) => n.props?.testID === id && typeof n.props.onPress === 'function')[0];
  await act(async () => {
    node.props.onPress();
  });
};

beforeEach(() => {
  mockPush.mockReset();
  mockApiGet.mockReset();
  mockApiPost.mockReset();
  for (const k of Object.keys(mockStore)) delete mockStore[k];
});

describe('the chooser', () => {
  it('asks what you want to sell and names both options with their one-line descriptions', async () => {
    const r = await mount(<SellChooserSheet visible onClose={() => {}} onPick={() => {}} />);
    const t = flat(r.root);
    expect(t).toContain(SELL_CHOOSER_TITLE);
    expect(SELL_CHOOSER_TITLE).toBe('What do you want to sell?');
    expect(t).toContain('Event photos');
    expect(t).toContain('People at an event find and buy their photos with face search on Find my photos.');
    expect(t).toContain('Stock & content');
    expect(t).toContain('Nature, portraits and other work to sell or showcase. Reviewed before going live.');
  });

  it('Event photos opens the standalone PAID album form and Stock & content opens the content album form', () => {
    expect(SELL_CHOICES.find((c) => c.key === 'event')?.href).toBe(SELL_PHOTOS_HREF);
    expect(SELL_PHOTOS_HREF).toBe('/album/new?sell=1');
    expect(SELL_CHOICES.find((c) => c.key === 'content')?.href).toBe(SELL_CONTENT_HREF);
    expect(SELL_CONTENT_HREF).toBe('/content-album/new');
  });

  function Host() {
    const sell = useSellChooser();
    return (
      <>
        <Text onPress={sell.open} testID="entry">
          Sell photos
        </Text>
        {sell.chooser}
      </>
    );
  }

  it('is closed until an entry point opens it, then each option routes to its own flow', async () => {
    const r = await mount(<Host />);
    expect(flat(r.root)).not.toContain(SELL_CHOOSER_TITLE);
    expect(mockPush).not.toHaveBeenCalled();
    await pressByTestId(r, 'entry');
    expect(flat(r.root)).toContain(SELL_CHOOSER_TITLE);
    await pressByTestId(r, 'sell-choice-content');
    expect(mockPush).toHaveBeenLastCalledWith('/content-album/new');
    await pressByTestId(r, 'entry');
    await pressByTestId(r, 'sell-choice-event');
    expect(mockPush).toHaveBeenLastCalledWith('/album/new?sell=1');
  });

  it('remembers the last choice, highlights it next time, and still shows the chooser', async () => {
    const r = await mount(<Host />);
    await pressByTestId(r, 'entry');
    await pressByTestId(r, 'sell-choice-content');
    expect(mockStore['sell.lastChoice']).toBe('content');
    await pressByTestId(r, 'entry');
    expect(flat(r.root)).toContain(SELL_CHOOSER_TITLE);
    const content = r.root.findAll((n) => n.props?.testID === 'sell-choice-content' && n.props.accessibilityState)[0];
    const event = r.root.findAll((n) => n.props?.testID === 'sell-choice-event' && n.props.accessibilityState)[0];
    expect(content.props.accessibilityState.selected).toBe(true);
    expect(event.props.accessibilityState.selected).toBe(false);
    expect(flat(r.root)).toContain('Last used');
  });

  it('ignores a stored value it does not know', () => {
    expect(parseSellChoice('event')).toBe('event');
    expect(parseSellChoice('content')).toBe('content');
    expect(parseSellChoice('nonsense')).toBeNull();
    expect(parseSellChoice(null)).toBeNull();
  });
});

describe('every Sell photos entry opens the chooser, never a form directly', () => {
  const read = (p: string) => fs.readFileSync(path.join(__dirname, '..', '..', '..', p), 'utf8');
  it('the Home button and the Get started row go through useSellChooser', () => {
    const home = read('src/features/dashboard/PhotographerHome.tsx');
    expect(home).toContain('useSellChooser');
    expect(home).toContain('onPress={sell.open}');
    expect(home).not.toMatch(/open\(SELL_PHOTOS_HREF\)/);
    const events = read('src/features/events/PhotographerEventsDashboard.tsx');
    expect(events).toContain("if (key === 'new-album') sell.open();");
    expect(events).not.toMatch(/'new-album':\s*SELL_PHOTOS_HREF/);
  });
});

describe('content albums are not face-scanned and need no face credits', () => {
  const read = (p: string) => fs.readFileSync(path.join(__dirname, '..', '..', '..', p), 'utf8');
  it('the content form and its result screen never reach face indexing or credits', () => {
    for (const f of ['src/app/(app)/content-album/new.tsx', 'src/features/gallery/ContentOutcomeView.tsx']) {
      const src = read(f);
      expect(src).not.toMatch(/publishAlbumToFaceSearch|face-status|getAlbumFaceStatus|faceRecognition|bcredits?b|Find my photos/i);
    }
  });

  it('creating one posts to the content endpoint only, and nothing calls publish', async () => {
    mockApiPost.mockResolvedValue({ action: 1, data: { id: 'c1' } });
    const id = await createContentAlbum({ title: 'T', category: 'NATURE', pricePerImage: 500, currencyId: 'c', images: [] });
    expect(id).toBe('c1');
    expect(mockApiPost.mock.calls.map((c) => c[0])).toEqual(['/photographer/albums/content']);
  });
});

describe('the success states', () => {
  const view = async (outcome: Parameters<typeof ContentOutcomeView>[0]['outcome']) => {
    const onSubmit = jest.fn();
    const onView = jest.fn();
    const r = await mount(<ContentOutcomeView outcome={outcome} title="Luxury city" submitting={false} onSubmit={onSubmit} onView={onView} />);
    return { r, onSubmit, onView };
  };

  it('submitted says it is in review and offers View album, and never mentions Find my photos', async () => {
    const { r } = await view(CONTENT_SUBMITTED);
    const t = flat(r.root);
    expect(t).toContain('Submitted for review');
    expect(t).toContain("We'll notify you when it's live");
    expect(t).toContain('View album');
    expect(t).not.toContain('Submit for review');
    expect(t).not.toMatch(/Find my photos/i);
  });

  it('a draft says Saved as draft and offers Submit for review', async () => {
    const { r } = await view(CONTENT_SAVED_DRAFT);
    const t = flat(r.root);
    expect(t).toContain('Saved as draft');
    expect(t).toContain('Submit for review');
    expect(t).toContain('View album');
  });

  it('a draft whose submit failed says so and keeps the retry', async () => {
    const { r } = await view(contentSubmitFailed('Add at least 1 photo before this album goes for review.'));
    const t = flat(r.root);
    expect(t).toContain('Saved as draft, not yet submitted');
    expect(t).toContain('Add at least 1 photo before this album goes for review.');
    expect(t).toContain('Submit for review');
  });
});

describe('a content album with 0 photos', () => {
  it('the field error reads "Add at least 1 photo"', () => {
    expect(CONTENT_PHOTOS_ERROR).toBe('Add at least 1 photo');
  });
  it('the form and the viewer both block it', () => {
    const read = (p: string) => fs.readFileSync(path.join(__dirname, '..', '..', '..', p), 'utf8');
    expect(read('src/app/(app)/content-album/new.tsx')).toContain("errPhotos: 'Add at least 1 photo'");
    const viewer = read('src/app/(app)/album/[id].tsx');
    expect(viewer).toContain('const noPhotos = images.length === 0;');
    expect(viewer).toContain('disabled={busy === \'submit\' || noPhotos}');
  });
});

describe('the Content Albums list', () => {
  it('counts photos from imageCount, the field the server sends, not 0', async () => {
    mockApiGet.mockResolvedValue({
      action: 1,
      data: [{ id: 'a1', title: 'Luxury city', contentApprovalStatus: 'APPROVED', imageCount: 4 }],
    });
    const [a] = await listContentAlbums();
    expect(a.photoCount).toBe(4);
  });
  it('an album that really is empty still says 0', async () => {
    mockApiGet.mockResolvedValue({ action: 1, data: [{ id: 'a2', title: 'Empty', contentApprovalStatus: 'DRAFT', imageCount: 0 }] });
    expect((await listContentAlbums())[0].photoCount).toBe(0);
  });
});

describe('chips and the floating button', () => {
  it('the row fades only while more chips are hidden to the right', () => {
    expect(hasMoreToRight(520, 390, 0)).toBe(true);
    expect(hasMoreToRight(520, 390, 130)).toBe(false);
    expect(hasMoreToRight(300, 390, 0)).toBe(false);
    expect(hasMoreToRight(520, 0, 0)).toBe(false);
    expect(FADE_STEPS.length).toBeGreaterThan(2);
  });

  it('renders the fade edge when the chips overflow, and none when they fit', async () => {
    const r = await mount(
      <FadedChipRow>
        <Text>All</Text>
      </FadedChipRow>,
    );
    const scroll = r.root.findAll((n) => typeof n.props?.onContentSizeChange === 'function')[0];
    await act(async () => {
      scroll.props.onLayout({ nativeEvent: { layout: { width: 390 } } });
      scroll.props.onContentSizeChange(520, 40);
    });
    expect(r.root.findAll((n) => n.props?.testID === 'chip-fade').length).toBeGreaterThan(0);
    await act(async () => {
      scroll.props.onContentSizeChange(300, 40);
    });
    expect(r.root.findAll((n) => n.props?.testID === 'chip-fade').length).toBe(0);
  });

  it('the list reserves the floating button height (56) plus spacing under the last card', () => {
    expect(FAB_SPACE).toBeGreaterThanOrEqual(56 + 8);
    const src = fs.readFileSync(path.join(__dirname, '..', '..', '..', 'src/app/(app)/content-albums.tsx'), 'utf8');
    expect(src).toContain('paddingBottom: clearance + FAB_SPACE');
    expect(src).toContain('<FadedChipRow');
  });
});
