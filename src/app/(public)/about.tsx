import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Screen } from '@/components/ui/Screen';
import { spacing, fontSize, makeStyles } from '@/theme';

const values = [
  { title: 'Innovation', desc: 'Pioneering creative tools and smart solutions for the photography industry.' },
  { title: 'Trust', desc: 'Building confidence through verified professionals and secure transactions.' },
  { title: 'Excellence', desc: 'Setting the highest standards in creative quality and client satisfaction.' },
  { title: 'Wellness', desc: 'Supporting the well-being and growth of our creative community.' },
  { title: 'Growth', desc: 'Empowering photographers to expand their reach and build lasting careers.' },
];

export default function AboutScreen() {
  const styles = useStyles();
  return (
    <Screen padded={false}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>About Amoria Connekyt</Text>
          <Text style={styles.subtitle}>The Smart Way to Capture Life</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Our Mission</Text>
          <Text style={styles.bodyText}>
            To empower creators and communities through technology that connects people, promotes emotional wellness, and transforms creative work into meaningful global opportunities.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Our Vision</Text>
          <Text style={styles.bodyText}>
            To become Africa's leading creative connection platform; a space where every memory matters, creativity meets opportunity, and technology fosters global emotional wellbeing.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Our Journey</Text>
          <Text style={styles.bodyText}>
            <Text style={styles.bold}>The Birth of Our Vision:</Text> What started as an idea has blossomed into a platform that addresses the obstacles and setbacks creators face in the industry, providing them with the right tools to promote themselves properly.{'\n\n'}
            <Text style={styles.bold}>Scaling Our Impact:</Text> What began as a passion for supporting event creators and storytellers has heavily shaped our growth. We listen to our customers and use their feedback to drive developments.{'\n\n'}
            <Text style={styles.bold}>Expanding Horizons:</Text> With a strong foundation built on trust and innovation, we are expanding into new markets and empowering creators across continents.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Core Values</Text>
          {values.map((v, i) => (
            <View key={i} style={styles.valueCard}>
              <Text style={styles.valueTitle}>{v.title}</Text>
              <Text style={styles.valueDesc}>{v.desc}</Text>
            </View>
          ))}
        </View>
      </ScrollView>
    </Screen>
  );
}

const useStyles = makeStyles((c) => ({
  container: {
    padding: spacing.xl,
    paddingBottom: spacing.xxxl,
  },
  header: {
    marginBottom: spacing.xxl,
    alignItems: 'center',
  },
  title: {
    fontSize: fontSize.xxl,
    fontWeight: '800',
    color: c.text,
    marginBottom: spacing.xs,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: fontSize.md,
    color: c.primary,
    fontWeight: '600',
    textAlign: 'center',
  },
  section: {
    marginBottom: spacing.xl,
  },
  sectionTitle: {
    fontSize: fontSize.xl,
    fontWeight: '700',
    color: c.text,
    marginBottom: spacing.md,
  },
  bodyText: {
    fontSize: fontSize.md,
    color: c.textMuted,
    lineHeight: 24,
  },
  bold: {
    fontWeight: '700',
    color: c.text,
  },
  valueCard: {
    backgroundColor: c.card,
    padding: spacing.md,
    borderRadius: 12,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: c.border,
  },
  valueTitle: {
    fontSize: fontSize.md,
    fontWeight: '700',
    color: c.text,
    marginBottom: spacing.xs,
  },
  valueDesc: {
    fontSize: fontSize.sm,
    color: c.textMuted,
    lineHeight: 20,
  },
}));
