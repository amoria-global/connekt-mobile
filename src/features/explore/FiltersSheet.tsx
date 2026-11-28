/**
 * The Explore filters, in a bottom sheet: Type, Category (several), Price range and Orientation, with Reset and a
 * "Show N results" button. The count is live over the items already loaded, so it moves as the choices change.
 * Price is a store-build price feature, so that section only exists where prices are shown.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { PanResponder, Pressable, Text, View } from 'react-native';
import { Sheet } from '@/components/ui/Sheet';
import { PrimaryButton } from '@/components/ui/Button';
import { useLanguage } from '@/store/language';
import { fonts, fontSize, makeStyles, radii, spacing } from '@/theme';
import type { ExploreItem, Facets } from './api';

export type Orientation = 'any' | 'landscape' | 'portrait' | 'square';
export type Filters = { type: '' | 'PHOTO' | 'VIDEO'; cats: string[]; price: [number, number] | null; orient: Orientation };
export const NO_FILTERS: Filters = { type: '', cats: [], price: null, orient: 'any' };

export const orientationOf = (ratio: number): Orientation => (ratio > 1.15 ? 'landscape' : ratio < 0.87 ? 'portrait' : 'square');

/** The part of the filters the server cannot do (several categories, price, orientation), applied to loaded items. */
export function matches(it: ExploreItem, f: Filters, facets: Facets | null): boolean {
  if (f.type && it.mediaType !== f.type) return false;
  if (f.cats.length > 1) {
    const labels = (facets?.categories ?? []).filter(c => f.cats.includes(c.name)).map(c => c.label);
    if (!it.categoryLabel || !labels.includes(it.categoryLabel)) return false;
  }
  if (f.price && it.priceAmount != null && (it.priceAmount < f.price[0] || it.priceAmount > f.price[1])) return false;
  if (f.orient !== 'any' && orientationOf(it.aspectRatio) !== f.orient) return false;
  return true;
}

export function FiltersSheet({ initial, items, facets, showPrices, currency, onApply, onClose }: {
  initial: Filters; items: ExploreItem[]; facets: Facets | null; showPrices: boolean; currency: string;
  onApply: (f: Filters) => void; onClose: () => void;
}) {
  const { t } = useLanguage();
  const styles = useStyles();
  const [f, setF] = useState<Filters>(initial);

  const bounds = useMemo(() => {
    const p = items.map(i => i.priceAmount).filter((x): x is number => x != null);
    if (!p.length) return null;
    const lo = Math.floor(Math.min(...p));
    const hi = Math.ceil(Math.max(...p));
    return hi > lo ? ([lo, hi] as [number, number]) : null;
  }, [items]);
  const count = useMemo(() => items.filter(i => matches(i, f, facets)).length, [items, f, facets]);

  const seg = <T extends string>(value: T, options: { v: T; label: string }[], set: (v: T) => void) => (
    <View style={styles.seg} accessibilityRole="tablist">
      {options.map(o => (
        <Pressable key={o.v} onPress={() => set(o.v)} accessibilityRole="tab" accessibilityState={{ selected: value === o.v }}
          style={[styles.segItem, value === o.v && styles.segOn]}>
          <Text style={[styles.segText, value === o.v && styles.segTextOn]}>{o.label}</Text>
        </Pressable>
      ))}
    </View>
  );

  return (
    <Sheet title={t('explore_filters')} onClose={onClose}
      footer={<PrimaryButton title={t('explore_showResults').replace('{n}', String(count))} onPress={() => { onApply(f); onClose(); }} />}>
      <Pressable onPress={() => setF(NO_FILTERS)} hitSlop={10} accessibilityRole="button" style={styles.reset}>
        <Text style={styles.resetText}>{t('explore_reset')}</Text>
      </Pressable>

      <Text style={styles.label}>{t('explore_filterType')}</Text>
      {seg(f.type, [{ v: '', label: t('explore_all') }, { v: 'PHOTO', label: t('explore_photos') }, { v: 'VIDEO', label: t('explore_clips') }], v => setF({ ...f, type: v }))}

      {(facets?.categories.length ?? 0) > 0 && (
        <>
          <Text style={styles.label}>{t('explore_filterCategory')}</Text>
          <View style={styles.wrap}>
            {facets!.categories.map(c => {
              const on = f.cats.includes(c.name);
              return (
                <Pressable key={c.name} onPress={() => setF({ ...f, cats: on ? f.cats.filter(x => x !== c.name) : [...f.cats, c.name] })}
                  accessibilityRole="button" accessibilityState={{ selected: on }} hitSlop={4} style={[styles.chip, on && styles.chipOn]}>
                  <Text style={[styles.chipText, on && styles.chipTextOn]}>{c.label}</Text>
                </Pressable>
              );
            })}
          </View>
        </>
      )}

      {showPrices && bounds && (
        <>
          <Text style={styles.label}>{`${t('explore_filterPrice')} (${currency})`}</Text>
          <RangeSlider bounds={bounds} value={f.price ?? bounds} onChange={v => setF({ ...f, price: v[0] === bounds[0] && v[1] === bounds[1] ? null : v })} />
        </>
      )}

      <Text style={styles.label}>{t('explore_filterOrientation')}</Text>
      {seg<Orientation>(f.orient, [
        { v: 'any', label: t('explore_any') }, { v: 'landscape', label: t('explore_landscape') },
        { v: 'portrait', label: t('explore_portrait') }, { v: 'square', label: t('explore_square') },
      ], v => setF({ ...f, orient: v }))}
    </Sheet>
  );
}

const THUMB = 24;

/** Two thumbs on one track. Dragging moves the nearer thumb; the two never cross. */
function RangeSlider({ bounds, value, onChange }: { bounds: [number, number]; value: [number, number]; onChange: (v: [number, number]) => void }) {
  const styles = useStyles();
  const [w, setW] = useState(0);
  const live = useRef({ bounds, value, w, onChange });
  useEffect(() => { live.current = { bounds, value, w, onChange }; });
  const start = useRef<{ which: 0 | 1; x0: number } | null>(null);
  const span = Math.max(1, w - THUMB);
  const toX = (v: number) => ((v - bounds[0]) / (bounds[1] - bounds[0])) * span;

  const pan = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderTerminationRequest: () => false,
    onPanResponderGrant: e => {
      const L = live.current;
      const s = Math.max(1, L.w - THUMB);
      const x = e.nativeEvent.locationX - THUMB / 2;
      const x0 = ((L.value[0] - L.bounds[0]) / (L.bounds[1] - L.bounds[0])) * s;
      const x1 = ((L.value[1] - L.bounds[0]) / (L.bounds[1] - L.bounds[0])) * s;
      const which: 0 | 1 = Math.abs(x - x0) <= Math.abs(x - x1) ? 0 : 1;
      start.current = { which, x0: which === 0 ? x0 : x1 };
    },
    onPanResponderMove: (_e, g) => {
      const L = live.current; const st = start.current;
      if (!st) return;
      const s = Math.max(1, L.w - THUMB);
      const x = Math.min(s, Math.max(0, st.x0 + g.dx));
      const raw = Math.round(L.bounds[0] + (x / s) * (L.bounds[1] - L.bounds[0]));
      const next: [number, number] = st.which === 0 ? [Math.min(raw, L.value[1]), L.value[1]] : [L.value[0], Math.max(raw, L.value[0])];
      L.onChange(next);
    },
  })).current;

  return (
    <View>
      <View style={styles.track} onLayout={e => setW(e.nativeEvent.layout.width)} {...pan.panHandlers}>
        <View style={styles.rail} />
        <View style={[styles.railOn, { left: toX(value[0]) + THUMB / 2, width: Math.max(0, toX(value[1]) - toX(value[0])) }]} />
        <View pointerEvents="none" style={[styles.thumb, { left: toX(value[0]) }]} accessibilityLabel={String(value[0])} />
        <View pointerEvents="none" style={[styles.thumb, { left: toX(value[1]) }]} accessibilityLabel={String(value[1])} />
      </View>
      <View style={styles.ends}>
        <Text style={styles.endText}>{value[0].toLocaleString('en-US')}</Text>
        <Text style={styles.endText}>{value[1].toLocaleString('en-US')}</Text>
      </View>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  reset: { alignSelf: 'flex-end', minHeight: 32, justifyContent: 'center' },
  resetText: { color: c.link, fontFamily: fonts.semibold, fontSize: fontSize.sm },
  label: { color: c.textMuted, fontFamily: fonts.semibold, fontSize: fontSize.xs, letterSpacing: 0.8, textTransform: 'uppercase', marginTop: spacing.lg, marginBottom: spacing.sm },
  seg: { flexDirection: 'row', padding: 3, borderRadius: radii.md, backgroundColor: c.tint, borderWidth: 1, borderColor: c.borderSoft },
  segItem: { flex: 1, minHeight: 36, borderRadius: radii.md - 3, alignItems: 'center', justifyContent: 'center' },
  segOn: { backgroundColor: c.primary },
  segText: { color: c.textMuted, fontFamily: fonts.medium, fontSize: fontSize.sm },
  segTextOn: { color: c.textOnPrimary },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: { minHeight: 32, paddingHorizontal: 14, borderRadius: radii.full, justifyContent: 'center', backgroundColor: c.tint, borderWidth: 1, borderColor: c.borderSoft },
  chipOn: { backgroundColor: c.primary, borderColor: c.primary },
  chipText: { color: c.text, fontFamily: fonts.medium, fontSize: fontSize.sm },
  chipTextOn: { color: c.textOnPrimary },
  track: { height: 44, justifyContent: 'center' },
  rail: { height: 4, borderRadius: 2, backgroundColor: c.borderSoft },
  railOn: { position: 'absolute', height: 4, borderRadius: 2, backgroundColor: c.primary },
  thumb: { position: 'absolute', width: THUMB, height: THUMB, borderRadius: THUMB / 2, backgroundColor: c.text, top: 10 },
  ends: { flexDirection: 'row', justifyContent: 'space-between' },
  endText: { color: c.textMuted, fontFamily: fonts.regular, fontSize: fontSize.xs },
}));
