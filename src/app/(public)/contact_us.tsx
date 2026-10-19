import { ScrollView } from 'react-native';
import { Screen } from '@/components/ui/Screen';
import { ContactForm } from '@/components/ContactForm';
import { useLanguage } from '@/hooks/useLanguage';

export default function ContactUsScreen() {
  const { t } = useLanguage();
  return (
    <Screen padded={false}>
      <ScrollView>
        <ContactForm
          eyebrow={t('b4_contactEyebrow')}
          title={t('b4_contactTitle')}
          subtitle={t('b4_contactSubtitle')}
          submitLabel={t('b4_contactSubmit')}
        />
      </ScrollView>
    </Screen>
  );
}
