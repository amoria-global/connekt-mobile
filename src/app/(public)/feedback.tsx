import { ScrollView } from 'react-native';
import { Screen } from '@/components/ui/Screen';
import { ContactForm } from '@/components/ContactForm';

/**
 * Feedback screen. There is no separate feedback endpoint — feedback goes
 * through the same /public/contact-us channel as Contact, with the
 * subject locked to "Feedback" so the team can triage it.
 */
export default function FeedbackScreen() {
  return (
    <Screen padded={false}>
      <ScrollView>
        <ContactForm
          eyebrow="Help us improve"
          title="Share your feedback"
          subtitle="Found a bug, have an idea, or something didn't feel right? Tell us — every bit of feedback shapes Connekyt."
          defaultSubject="Feedback"
          lockSubject
          submitLabel="Send feedback"
          formTitle="Your feedback"
        />
      </ScrollView>
    </Screen>
  );
}
