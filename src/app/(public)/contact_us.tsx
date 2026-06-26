import { ScrollView } from 'react-native';
import { Screen } from '@/components/ui/Screen';
import { ContactForm } from '@/components/ContactForm';

export default function ContactUsScreen() {
  return (
    <Screen padded={false}>
      <ScrollView>
        <ContactForm
          eyebrow="We're listening"
          title="Let's connect."
          subtitle="Whether you're booking a photographer, planning a livestream, or just curious about Connekyt, drop us a line and we'll be in touch."
          submitLabel="Send message"
        />
      </ScrollView>
    </Screen>
  );
}
