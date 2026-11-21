import { ScrollView } from 'react-native';
import { Screen } from '@/components/ui/Screen';
import { ReferralPolicyBody } from '@/features/referral/ReferralPolicyBody';
import { spacing, makeStyles } from '@/theme';

/** The milestone referral program policy and Help article, in the app's language (English where missing). */
export default function ReferralProgramScreen() {
  const styles = useStyles();
  return (
    <Screen padded={false}>
      <ScrollView contentContainerStyle={styles.container}>
        <ReferralPolicyBody />
      </ScrollView>
    </Screen>
  );
}

const useStyles = makeStyles(() => ({
  container: { padding: spacing.xl, paddingBottom: spacing.xxxl },
}));
