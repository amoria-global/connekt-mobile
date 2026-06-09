import { useCallback } from 'react';
import { useRouter } from 'expo-router';
import { Pressable } from 'react-native';
import { DataList } from '@/components/ui/DataList';
import { Screen } from '@/components/ui/Screen';
import { TopBar, useTopBarHeight } from '@/components/topbar/TopBar';
import { listConversations } from '@/features/inbox/api';
import { ConversationRow } from '@/features/inbox/ConversationRow';
import { useAsync } from '@/hooks/useAsync';

export default function InboxScreen() {
  const router = useRouter();
  const topBarHeight = useTopBarHeight();
  const { data, loading, error, refresh } = useAsync(useCallback(() => listConversations(), []));

  return (
    <Screen padded={false} edges={['bottom']}>
      <DataList
        data={data}
        loading={loading}
        error={error}
        onRefresh={refresh}
        title="Inbox"
        subtitle="Conversations with clients and photographers"
        topInset={topBarHeight}
        keyExtractor={(c) => c.id}
        renderItem={({ item }) => (
          <Pressable onPress={() => router.push(`/conversation/${item.id}`)}>
            <ConversationRow conversation={item} />
          </Pressable>
        )}
        emptyIcon="chatbubbles-outline"
        emptyTitle="No messages yet"
        emptyMessage="Start a conversation from an event or photographer profile to see it here."
      />
      <TopBar />
    </Screen>
  );
}
