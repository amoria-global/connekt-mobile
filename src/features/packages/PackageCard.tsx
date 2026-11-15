import React from "react";
import { Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { Button } from "@/components/ui/Button";
import { glassTile } from "@/components/ui/GlassCard";
import { Skeleton } from "@/components/ui/Skeleton";
import { StatusChip } from "@/components/ui/StatusChip";
import {
  alpha,
  fonts,
  fontSize,
  makeStyles,
  radii,
  spacing,
  useTheme,
} from "@/theme";
import { useLanguage } from "@/store/language";
import { tp } from "@/i18n/plural";
import type { Package } from "./api";
import { cardRows, isIndoor, packagePrice, statParts } from "./listModel";

/** Rows shown on the card before "+N more"; the rest is on the detail page. */
const MAX_ROWS = 3;

type Props = {
  pkg: Package;
  topTier: boolean;
  dimmed?: boolean;
  onEdit: () => void;
  onGeo: () => void;
  onMore: () => void;
};

/** One package: cover placeholder, name, tier and type, own-currency price, two-line description, stats, add-on rows, actions. */
export function PackageCard({
  pkg,
  topTier,
  dimmed,
  onEdit,
  onGeo,
  onMore,
}: Props) {
  const styles = useStyles();
  const { colors } = useTheme();
  const { t } = useLanguage();
  const indoor = isIndoor(pkg);
  const price = packagePrice(pkg);
  const rows = cardRows(pkg);
  const stats = statParts(pkg);

  const statText = (s: (typeof stats)[number]): string =>
    s.key === "hours"
      ? t("b2_pkgl_session", { count: s.count })
      : tp(t as never, `b2_pkgl_${s.key}`, s.count);
  const statLine = [
    ...stats.map(statText),
    ...(pkg.hasLiveStream ? [t("b2_packagesLiveStream")] : []),
  ].join(" · ");

  return (
    <View style={[styles.card, dimmed && styles.dim]}>
      {/* Only the title block opens the editor: a button inside a pressable card is invalid on web and doubles the tap target. */}
      <Pressable
        onPress={onEdit}
        accessibilityRole="button"
        accessibilityLabel={`${t("b2_pkgl_edit")} ${pkg.name}`}
        style={({ pressed }) => [styles.head, pressed && styles.pressed]}
      >
        <View style={styles.top}>
          <View style={styles.cover}>
            <LinearGradient
              colors={[
                alpha(colors.primary, 0.32),
                alpha(colors.primaryLight, 0.06),
              ]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.coverFill}
            />
            <Ionicons
              name={indoor ? "home-outline" : "sunny-outline"}
              size={20}
              color={colors.link}
            />
          </View>
          <View style={styles.titleCol}>
            <View style={styles.nameRow}>
              <Text style={styles.name} numberOfLines={1}>
                {pkg.name}
              </Text>
              {topTier ? (
                <StatusChip
                  label={t("b2_pkgl_topTier")}
                  tone="accent"
                  compact
                />
              ) : null}
            </View>
            <Text style={styles.type} numberOfLines={1}>
              {indoor ? t("b2_pkgl_typeIndoor") : t("b2_pkgl_typeOutdoor")}
            </Text>
          </View>
          {price ? (
            <View style={styles.priceCol}>
              <Text style={styles.price}>{price}</Text>
              {pkg.priceUnit ? (
                <Text style={styles.unit}>{pkg.priceUnit}</Text>
              ) : null}
            </View>
          ) : null}
        </View>

        {pkg.description ? (
          <Text style={styles.desc} numberOfLines={2}>
            {pkg.description}
          </Text>
        ) : null}
      </Pressable>

      {statLine ? <Text style={styles.stats}>{statLine}</Text> : null}

      {rows.length > 0 ? (
        <View style={styles.rows}>
          {rows.slice(0, MAX_ROWS).map((r) => (
            <View key={r.key} style={styles.row}>
              <Text style={styles.rowLabel} numberOfLines={1}>
                {r.label}
              </Text>
              {r.price ? <Text style={styles.rowPrice}>{r.price}</Text> : null}
            </View>
          ))}
          {rows.length > MAX_ROWS ? (
            <Text style={styles.more}>
              {t("b2_pkgl_moreRows", { count: rows.length - MAX_ROWS })}
            </Text>
          ) : null}
        </View>
      ) : null}

      <View style={styles.actions}>
        <View style={styles.actionMain}>
          <Button
            title={t("b2_pkgl_edit")}
            variant="primary"
            onPress={onEdit}
          />
        </View>
        <View style={styles.actionMain}>
          <Button
            title={t("b2_packagesGeoPricing")}
            variant="ghost"
            onPress={onGeo}
          />
        </View>
        <Pressable
          onPress={onMore}
          hitSlop={6}
          accessibilityRole="button"
          accessibilityLabel={t("b2_pkgl_moreActions", { name: pkg.name })}
          style={({ pressed }) => [styles.moreBtn, pressed && styles.pressed]}
        >
          <Ionicons name="ellipsis-horizontal" size={18} color={colors.link} />
        </Pressable>
      </View>
    </View>
  );
}

/** Loading placeholders shaped like the card, so the list does not jump when it arrives. */
export function PackageCardSkeleton() {
  const styles = useStyles();
  return (
    <View
      style={styles.card}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <View style={styles.top}>
        <Skeleton width={44} height={44} radius={radii.md} />
        <View style={styles.titleCol}>
          <Skeleton width="55%" height={16} />
          <Skeleton width="35%" height={12} />
        </View>
        <Skeleton width={84} height={16} />
      </View>
      <Skeleton height={12} />
      <Skeleton width="80%" height={12} />
      <Skeleton width="60%" height={12} />
      <View style={styles.actions}>
        <Skeleton height={44} radius={radii.md} style={styles.actionMain} />
        <Skeleton height={44} radius={radii.md} style={styles.actionMain} />
      </View>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  card: {
    ...glassTile(c),
    borderWidth: 1,
    borderRadius: radii.lg,
    padding: spacing.md,
    gap: spacing.sm,
  },
  head: { gap: spacing.sm },
  dim: { opacity: 0.5 },
  pressed: { opacity: 0.88 },
  top: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  cover: {
    width: 44,
    height: 44,
    borderRadius: radii.md,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: c.borderSoft,
  },
  coverFill: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0 },
  titleCol: { flex: 1, gap: 2 },
  nameRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  name: {
    flexShrink: 1,
    fontFamily: fonts.display,
    fontSize: fontSize.md,
    color: c.text,
  },
  type: {
    fontFamily: fonts.regular,
    fontSize: fontSize.xs,
    color: c.textMuted,
  },
  priceCol: { alignItems: "flex-end", gap: 2 },
  price: { fontFamily: fonts.display, fontSize: fontSize.md, color: c.text },
  unit: {
    fontFamily: fonts.regular,
    fontSize: fontSize.xs,
    color: c.textMuted,
  },
  desc: {
    fontFamily: fonts.regular,
    fontSize: fontSize.sm,
    lineHeight: 20,
    color: c.textSoft,
  },
  stats: {
    fontFamily: fonts.medium,
    fontSize: fontSize.xs,
    color: c.textMuted,
  },
  rows: {
    gap: spacing.xs,
    paddingVertical: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: c.borderSoft,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
    paddingTop: spacing.xs,
  },
  rowLabel: {
    flex: 1,
    fontFamily: fonts.regular,
    fontSize: fontSize.sm,
    color: c.textSoft,
  },
  rowPrice: { fontFamily: fonts.display, fontSize: fontSize.sm, color: c.text },
  more: {
    fontFamily: fonts.medium,
    fontSize: fontSize.xs,
    color: c.textMuted,
    paddingTop: spacing.xs,
  },
  actions: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  actionMain: { flex: 1 },
  moreBtn: {
    width: 44,
    height: 44,
    borderRadius: radii.md,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: c.borderSoft,
  },
}));
