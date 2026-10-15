import { useCallback, useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { Button } from '@/components/ui/Button';
import { DataList } from '@/components/ui/DataList';
import { StatusPill } from '@/components/ui/StatusPill';
import { useAsync } from '@/hooks/useAsync';
import { spacing, radii, fontSize, fontWeight, makeStyles } from '@/theme';
import { formatDate, formatPrice } from '@/utils/format';
import { acceptBooking, listBookings, rejectBooking, type Booking } from './api';
import { useCurrency } from '@/store/currency';

type Props = { title?: string; subtitle?: string; topInset?: number };

export function BookingsList({ title, subtitle, topInset }: Props) {
  // Re-render when the display currency changes (formatPrice reads the store).
  useCurrency((s) => s.currency);
  const styles = useStyles();
  const { data, loading, error, refresh } = useAsync(useCallback(() => listBookings(), []));
  const [busyId, setBusyId] = useState<string | null>(null);

  const onAccept = async (b: Booking) => {
    setBusyId(b.id);
    try {
      await acceptBooking(b.id);
      await refresh();
    } catch {
      Alert.alert('Could not accept', 'Please try again.');
    } finally {
      setBusyId(null);
    }
  };

  const onReject = (b: Booking) => {
    Alert.alert('Decline booking?', 'This will notify the client.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Decline',
        style: 'destructive',
        onPress: async () => {
          setBusyId(b.id);
          try {
            await rejectBooking(b.id, 'Not available');
            await refresh();
          } catch {
            Alert.alert('Could not decline', 'Please try again.');
          } finally {
            setBusyId(null);
          }
        },
      },
    ]);
  };

  const isPending = (s?: string) => /pend|await|request/i.test(s ?? '');

  return (
    <DataList
      data={data}
      loading={loading}
      error={error}
      onRefresh={refresh}
      title={title}
      subtitle={subtitle}
      topInset={topInset}
      keyExtractor={(b) => b.id}
      renderItem={({ item }) => (
        <View style={styles.card}>
          <View style={styles.topRow}>
            <Text style={styles.title} numberOfLines={1}>
              {item.eventTitle}
            </Text>
            <StatusPill status={item.status} />
          </View>
          {item.clientName ? <Text style={styles.meta}>Client: {item.clientName}</Text> : null}
          {item.eventDate ? <Text style={styles.meta}>{formatDate(item.eventDate)}</Text> : null}
          {item.proposedPrice != null ? (
            <Text style={styles.price}>{formatPrice(item.proposedPrice, item.currency)}</Text>
          ) : null}

          {isPending(item.status) ? (
            <View style={styles.actions}>
              <Button
                title="Decline"
                variant="ghost"
                onPress={() => onReject(item)}
                disabled={busyId === item.id}
                style={styles.actionBtn}
              />
              <Button
                title="Accept"
                onPress={() => onAccept(item)}
                loading={busyId === item.id}
                style={styles.actionBtn}
              />
            </View>
          ) : null}
        </View>
      )}
      emptyIcon="briefcase-outline"
      emptyTitle="No bookings yet"
      emptyMessage="Booking requests from clients will appear here for you to accept or decline."
    />
  );
}

const useStyles = makeStyles((c) => ({
  card: {
    backgroundColor: c.surface,
    borderRadius: radii.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: c.borderSoft,
    gap: spacing.sm,
  },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  title: { flex: 1, fontSize: fontSize.md, fontWeight: fontWeight.bold, color: c.text },
  meta: { fontSize: fontSize.sm, color: c.textSoft },
  price: { fontSize: fontSize.md, fontWeight: fontWeight.bold, color: c.primary },
  actions: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.sm },
  actionBtn: { flex: 1, height: 44 },
}));
