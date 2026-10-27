import { memo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { fonts } from '@/theme';
import { V } from '@/features/streams/viewer/viewerTheme';

/** Section 7: what public and private mean, before anything is sent. Same wording on web. */
export const PRIVACY_NOTE_TEXT =
  'You choose before sending. Public wishes appear in the feed once the host approves them. Private wishes are seen only by the host.';

export const PrivacyNote = memo(function PrivacyNote() {
  return (
    <View style={s.root} accessible accessibilityLabel={`Privacy. ${PRIVACY_NOTE_TEXT}`}>
      <Ionicons name="shield-checkmark-outline" size={16} color={V.textMuted} />
      <Text style={s.text}>{PRIVACY_NOTE_TEXT}</Text>
    </View>
  );
});

const s = StyleSheet.create({
  root: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, paddingHorizontal: 4 },
  text: { flex: 1, fontFamily: fonts.regular, fontSize: 12.5, lineHeight: 18, color: V.textMuted },
});
