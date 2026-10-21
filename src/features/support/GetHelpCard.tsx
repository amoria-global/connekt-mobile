/**
 * "Get help": the one way every role's Home reaches the existing support center. It adds no screen and no endpoint:
 * the Help Center (`/help-center`, articles by topic, with its own Contact us and Send feedback) and the Contact us
 * form (`/contact_us`) already exist for signed-in and signed-out users alike. Two clear targets, both at least 44dp,
 * no claim about response times.
 */
import { Text, View } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { ActionButton, Card, IconTile, SectionHeader } from '@/features/photographer/kit';
import { makeStyles, spacing } from '@/theme';
import { useSharedT } from '@/i18n/sharedStrings';

export const HELP_CENTER_ROUTE = '/help-center';
export const CONTACT_SUPPORT_ROUTE = '/contact_us';

export function GetHelpCard() {
  const router = useRouter();
  const styles = useStyles();
  const { tr } = useSharedT();
  return (
    <View>
      <SectionHeader title="Need help?" />
      <View style={styles.pad}>
        <Card style={styles.card}>
          <View style={styles.top}>
            <IconTile icon="help-buoy-outline" tone="primary" size={40} />
            <Text style={styles.body} maxFontSizeMultiplier={1.6}>
              {tr('Find answers in the Help Center, or message our support team.')}
            </Text>
          </View>
          <View style={styles.actions}>
            <ActionButton
              variant="primary"
              compact
              icon="help-circle-outline"
              label="Get help"
              onPress={() => router.push(HELP_CENTER_ROUTE as Href)}
              style={styles.action}
            />
            <ActionButton
              compact
              icon="mail-outline"
              label="Contact support"
              onPress={() => router.push(CONTACT_SUPPORT_ROUTE as Href)}
              style={styles.action}
            />
          </View>
        </Card>
      </View>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  pad: { paddingHorizontal: spacing.lg },
  card: { marginHorizontal: 0, gap: spacing.md },
  top: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  body: { flex: 1, minWidth: 0, color: c.text, fontSize: 14, lineHeight: 20 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  action: { flexGrow: 1, flexBasis: 140 },
}));
