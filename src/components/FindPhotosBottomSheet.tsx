import { View, Text, Pressable, StyleSheet, Modal } from 'react-native';
import { useRouter } from 'expo-router';

import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/store/auth';
import { makeStyles, useTheme } from '@/theme';
import { useSharedT } from '@/i18n/sharedStrings';
import { GlassScrim, GlassSheetHost } from '@/components/ui/GlassModal';
import { SheetCornerClose } from '@/components/ui/SheetCloseButton';
import { glassTile } from '@/components/ui/GlassCard';

interface Props {
  visible: boolean;
  onClose: () => void;
  // If the user selects "Get Your Photos", we push to this route.
  getPhotosRoute: string;
}

export function FindPhotosBottomSheet({ visible, onClose, getPhotosRoute }: Props) {
  const { colors } = useTheme();
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { tr } = useSharedT();
  const status = useAuth((s) => s.status);
  const isLoggedIn = status === 'authenticated';

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <GlassScrim onPress={onClose} style={StyleSheet.absoluteFill} accessibilityLabel={tr('Close')} />
      <View style={styles.sheetWrapper} pointerEvents="box-none">
        <GlassSheetHost style={[styles.bottomSheet, { paddingBottom: Math.max(insets.bottom, 16) + 16 }]}>
          <SheetCornerClose onPress={onClose} label={tr('Close')} />
          <View style={styles.sheetHandle} />
          <Text style={styles.sheetHeaderTitle}>{tr('What would you like to do?')}</Text>
          
          {/* Get Your Photos Option */}
          <Pressable 
            style={({ pressed }) => [styles.sheetOption, pressed && styles.sheetOptionPressed]}
            onPress={() => {
              onClose();
              router.push(getPhotosRoute as any);
            }}
          >
            <View style={[styles.sheetIconWrap, { backgroundColor: colors.tint }]}>
              <Ionicons name="scan-outline" size={28} color={colors.primary} />
            </View>
            <View style={styles.sheetTextWrap}>
              <Text style={styles.sheetTitle}>{tr('Get Your Photos')}</Text>
              <Text style={styles.sheetSub}>{tr('AI face scan from your events')}</Text>
            </View>
          </Pressable>

          {/* Browse Photos Option (only for logged-in users) */}
          {isLoggedIn && (
            <>
              <View style={styles.sheetDivider} />
              <Pressable 
                style={({ pressed }) => [styles.sheetOption, pressed && styles.sheetOptionPressed]}
                onPress={() => {
                  onClose();
                  router.push('/browse-photos');
                }}
              >
                <View style={[styles.sheetIconWrap, { backgroundColor: colors.tintAccent }]}>
                  <Ionicons name="apps" size={28} color={colors.accent} />
                </View>
                <View style={styles.sheetTextWrap}>
                  <Text style={styles.sheetTitle}>{tr('Browse Photos')}</Text>
                  <Text style={styles.sheetSub}>{tr('Stock photos by category, paid per photo')}</Text>
                </View>
              </Pressable>
            </>
          )}
        </GlassSheetHost>
      </View>
    </Modal>
  );
}

const useStyles = makeStyles((c, e) => ({
  backdrop: {
  },
  sheetWrapper: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  bottomSheet: {
    paddingTop: 16,
    ...e(4),
  },
  sheetHandle: {
    width: 40,
    height: 4,
    backgroundColor: c.border,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 16,
  },
  sheetHeaderTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: c.textMuted,
    textAlign: 'center',
    marginBottom: 12,
  },
  sheetOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 18,
    borderRadius: 16,
    marginHorizontal: 12,
  },
  sheetOptionPressed: {
    ...glassTile(c),
  },
  sheetIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  sheetTextWrap: {
    flex: 1,
  },
  sheetTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: c.text,
    marginBottom: 3,
  },
  sheetSub: {
    fontSize: 13,
    color: c.textMuted,
  },
  sheetDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: c.borderSoft,
    marginHorizontal: 24,
    marginVertical: 4,
  },
}));
