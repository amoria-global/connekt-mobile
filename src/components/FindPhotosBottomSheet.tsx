import { View, Text, Pressable, StyleSheet, Modal } from 'react-native';
import { useRouter } from 'expo-router';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { colors, makeStyles, useTheme } from '@/theme';

interface Props {
  visible: boolean;
  onClose: () => void;
  // If the user selects "Get Your Photos", we push to this route.
  getPhotosRoute: string;
}

export function FindPhotosBottomSheet({ visible, onClose, getPhotosRoute }: Props) {
  const { colors } = useTheme();
  const styles = useStyles();
  const router = useRouter();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <BlurView intensity={30} tint="dark" style={StyleSheet.absoluteFill} />
      <Pressable 
        style={StyleSheet.absoluteFill} 
        onPress={onClose}
      />
      <View style={{ flex: 1, justifyContent: 'flex-end' }} pointerEvents="box-none">
        <View style={styles.bottomSheet}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetHeaderTitle}>What would you like to do?</Text>
            
            {/* Get Your Photos Option */}
            <Pressable 
              style={({pressed}) => [styles.sheetOption, pressed && { backgroundColor: '#f8fafc' }]}
              onPress={() => {
                onClose();
                router.push(getPhotosRoute as any);
              }}
            >
              <View style={styles.sheetIconWrap}>
                <Ionicons name="scan-outline" size={32} color={colors.primary} />
              </View>
              <View style={styles.sheetTextWrap}>
                <Text style={styles.sheetTitle}>Get Your Photos</Text>
                <Text style={styles.sheetSub}>AI face scan from your events</Text>
              </View>
            </Pressable>

            <View style={styles.sheetDivider} />

            {/* Browse Photos Option */}
            <Pressable 
              style={({pressed}) => [styles.sheetOption, pressed && { backgroundColor: '#f8fafc' }]}
              onPress={() => {
                onClose();
                // Both public and app can try to route to gallery. 
                // If public, might need to be login redirected, but that's fine.
                router.push('/gallery');
              }}
            >
              <View style={styles.sheetIconWrap}>
                <Ionicons name="apps" size={32} color="#e11d48" />
              </View>
              <View style={styles.sheetTextWrap}>
                <Text style={styles.sheetTitle}>Browse Photos</Text>
                <Text style={styles.sheetSub}>Stock photos by category, paid per photo</Text>
              </View>
            </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const useStyles = makeStyles((c, e) => ({
  bottomSheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 16,
    paddingBottom: 40,
    ...e(3),
  },
  sheetHandle: {
    width: 40,
    height: 4,
    backgroundColor: '#cbd5e1',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 16,
  },
  sheetHeaderTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#64748b',
    textAlign: 'center',
    marginBottom: 8,
  },
  sheetOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    paddingHorizontal: 24,
  },
  sheetIconWrap: {
    width: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  sheetTextWrap: {
    flex: 1,
  },
  sheetTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 4,
  },
  sheetSub: {
    fontSize: 14,
    color: '#64748b',
  },
  sheetDivider: {
    height: 1,
    backgroundColor: '#f1f5f9',
    marginHorizontal: 24,
  },
}));
