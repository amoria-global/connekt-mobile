import { ScrollView } from 'react-native';
import { Screen } from '@/components/ui/Screen';
import { ContactForm } from '@/components/ContactForm';
import { useLanguage } from '@/hooks/useLanguage';

/**
 * Feedback screen. There is no separate feedback endpoint — feedback goes
 * through the same /public/contact-us channel as Contact, with the
 * subject locked to "Feedback" so the team can triage it.
 */
export default function FeedbackScreen() {
  const { t } = useLanguage();
  return (
    <Screen padded={false}>
      <ScrollView>
        <ContactForm
          eyebrow={t('b4_feedbackEyebrow')}
          title={t('b4_feedbackTitle')}
          subtitle={t('b4_feedbackSubtitle')}
          defaultSubject="Feedback"
          lockSubject
          submitLabel={t('b4_feedbackSubmit')}
          formTitle={t('b4_feedbackFormTitle')}
        />
      </ScrollView>
    </Screen>
  );
}
