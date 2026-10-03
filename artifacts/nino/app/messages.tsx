import { useAuth } from '@clerk/expo';
import { Feather } from '@expo/vector-icons';
import { useQueryClient } from '@tanstack/react-query';
import { Redirect, router } from 'expo-router';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import {
  getListMessagingConversationsQueryKey, getSearchMessagingPeopleQueryKey, listMessagingConversations, useCreateMessagingConversation,
  useGetMessagingProfile, useListMessagingConversations, useSearchMessagingPeople, type MessagingConversation,
} from '@workspace/api-client-react';
import { PersonAvatar, threadHref } from '@/components/MessagingParts';
import { useInsets } from '@/components/ui';
import { useColors } from '@/hooks/useColors';
import { useI18n } from '@/lib/i18n';
import { useMessagesCopy } from '@/lib/messagesCopy';
import { POLL_MS, invalidateInbox, shortTime, useActive } from '@/lib/messaging';
import { postError } from '@/lib/posts';

function Skeleton() {
  const c = useColors();
  return (
    <View style={{ paddingHorizontal: 20, gap: 22, paddingTop: 12 }}>
      {[0.7, 0.5, 0.62, 0.44, 0.56].map((w, i) => (
        <View key={i} style={{ flexDirection: 'row', gap: 14, alignItems: 'center', opacity: 1 - i * 0.15 }}>
          <View style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: c.card }} />
          <View style={{ flex: 1, gap: 8 }}>
            <View style={{ height: 12, width: `${w * 70}%`, borderRadius: 6, backgroundColor: c.card }} />
            <View style={{ height: 10, width: `${w * 100}%`, borderRadius: 5, backgroundColor: c.cardSoft }} />
          </View>
        </View>
      ))}
    </View>
  );
}

export default function Messages() {
  const { isSignedIn } = useAuth();
  if (!isSignedIn) return <Redirect href="/" />;
  return <Inbox />;
}

function Inbox() {
  const c = useColors();
  const ins = useInsets();
  const t = useMessagesCopy();
  const { font, row, align, lang } = useI18n();
  const qc = useQueryClient();
  const active = useActive();
  const me = useGetMessagingProfile();
  const first = useListMessagingConversations(undefined, {
    query: { queryKey: getListMessagingConversationsQueryKey(), refetchInterval: active ? POLL_MS : false, refetchIntervalInBackground: false },
  });
  const [older, setOlder] = useState<MessagingConversation[]>([]);
  const [cursor, setCursor] = useState<string | null | undefined>(undefined);
  const [loadingMore, setLoadingMore] = useState(false);
  const [moreError, setMoreError] = useState(false);
  const [searching, setSearching] = useState(false);
  const [q, setQ] = useState('');
  const [dq, setDq] = useState('');
  const [openErr, setOpenErr] = useState<string | null>(null);
  const create = useCreateMessagingConversation();
  const creatingFor = useRef<string | null>(null);

  useEffect(() => { const h = setTimeout(() => setDq(q.trim()), 300); return () => clearTimeout(h); }, [q]);
  const search = useSearchMessagingPeople({ q: dq }, { query: { queryKey: getSearchMessagingPeopleQueryKey({ q: dq }), enabled: searching && dq.length >= 2, staleTime: 15_000 } });

  const nextCursor = cursor === undefined ? first.data?.nextCursor ?? null : cursor;
  const meId = me.data?.id;

  const list = useMemo(() => {
    const map = new Map<string, MessagingConversation>();
    for (const cv of older) map.set(cv.id, cv);
    for (const cv of first.data?.conversations ?? []) map.set(cv.id, cv);
    return [...map.values()].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }, [older, first.data]);
  const others = list;
  const totalUnread = others.reduce((s, cv) => s + cv.unreadCount, 0);

  const loadMore = async () => {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true); setMoreError(false);
    try {
      const page = await listMessagingConversations({ cursor: nextCursor });
      setOlder((o) => [...o, ...page.conversations]);
      setCursor(page.nextCursor);
    } catch { setMoreError(true); } finally { setLoadingMore(false); }
  };

  const openWith = (peerId: string) => {
    if (creatingFor.current || peerId === meId) return; // server forbids self conversations
    const existing = list.find((cv) => cv.peer.id === peerId);
    if (existing) { router.push(threadHref(existing.id)); return; }
    creatingFor.current = peerId; setOpenErr(null);
    create.mutate({ data: { peerId } }, {
      onSuccess: (cv) => { void invalidateInbox(qc); setSearching(false); setQ(''); router.push(threadHref(cv.id)); },
      onError: (e) => setOpenErr(postError(e)),
      onSettled: () => { creatingFor.current = null; },
    });
  };

  const back = () => (router.canGoBack() ? router.back() : router.replace('/feed'));
  const txt = (w: 'regular' | 'medium' | 'semibold' | 'bold', size: number, color = c.text) => ({ fontFamily: font(w), fontSize: size, color, textAlign: align });

  const Row = ({ cv }: { cv: MessagingConversation }) => {
    const unread = cv.unreadCount;
    const last = cv.lastMessage;
    const preview = last ? `${last.senderId === meId ? `${t.you}: ` : ''}${last.text}` : t.threadEmpty;
    return (
      <Pressable testID={`conversation-${cv.id}`} accessibilityRole="button"
        accessibilityLabel={`${cv.peer.displayName}${unread ? `, ${unread} ${t.unread}` : ''}`}
        onPress={() => router.push(threadHref(cv.id))}
        style={({ pressed }) => [s.row, { flexDirection: row, backgroundColor: pressed ? c.cardSoft : 'transparent' }]}>
        <PersonAvatar p={cv.peer} size={52} />
        <View style={{ flex: 1, gap: 3 }}>
          <View style={{ flexDirection: row, alignItems: 'center', gap: 8 }}>
            <Text numberOfLines={1} style={[txt(unread ? 'bold' : 'semibold', 15), { flex: 1 }]}>{cv.peer.displayName}</Text>
            <Text style={txt('regular', 12, unread ? c.accent : c.muted)}>{shortTime(cv.updatedAt, lang)}</Text>
          </View>
          <View style={{ flexDirection: row, alignItems: 'center', gap: 8 }}>
            <Text numberOfLines={1} style={[txt(unread ? 'medium' : 'regular', 13, unread ? c.text : c.secondary), { flex: 1 }]}>
              {cv.peer.username && !last ? `@${cv.peer.username}` : preview}
            </Text>
            {unread > 0 ? <View style={[s.badge, { backgroundColor: c.accent }]}><Text style={{ color: c.onAccent, fontFamily: 'Poppins_600SemiBold', fontSize: 11 }}>{unread > 99 ? '99+' : unread}</Text></View> : null}
          </View>
        </View>
      </Pressable>
    );
  };

  const header = (
    <View style={{ paddingTop: ins.top + 6, paddingHorizontal: 16, paddingBottom: 10, gap: 14 }}>
      <View style={{ flexDirection: row, alignItems: 'center', gap: 8 }}>
        <Pressable testID="messages-back" onPress={back} accessibilityRole="button" accessibilityLabel={t.back} style={s.iconBtn} hitSlop={6}>
          <Feather name={align === 'right' ? 'chevron-right' : 'chevron-left'} size={26} color={c.text} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={txt('bold', 24)}>{t.title}</Text>
          <Text style={txt('regular', 12, c.muted)}>{t.privateNote}{totalUnread ? `  ·  ${totalUnread} ${t.unread}` : ''}</Text>
        </View>
        <Pressable testID="new-message" onPress={() => { setSearching((v) => !v); setQ(''); setOpenErr(null); }} accessibilityRole="button"
          accessibilityLabel={searching ? t.close : t.newChat} style={[s.newBtn, { backgroundColor: searching ? c.card : c.accent }]}>
          <Feather name={searching ? 'x' : 'edit-3'} size={18} color={searching ? c.text : c.onAccent} />
        </Pressable>
      </View>
      {searching ? (
        <View style={[s.search, { flexDirection: row, borderColor: c.borderStrong, backgroundColor: c.cardSoft }]}>
          <Feather name="search" size={16} color={c.secondary} />
          <TextInput testID="messages-search" autoFocus value={q} onChangeText={setQ} placeholder={t.searchPh} placeholderTextColor={c.muted}
            autoCapitalize="none" autoCorrect={false} maxLength={80} accessibilityLabel={t.searchPh}
            style={{ flex: 1, minHeight: 44, color: c.text, fontFamily: font('regular'), fontSize: 14, textAlign: align }} />
          {search.isFetching ? <ActivityIndicator size="small" color={c.accent} /> : null}
        </View>
      ) : null}
      {openErr ? <Text style={txt('regular', 13, c.danger)}>{openErr}</Text> : null}
    </View>
  );

  if (searching) {
    const people = (search.data ?? []).filter((p) => p.id !== meId);
    return (
      <View style={{ flex: 1, backgroundColor: c.bgTop }}>
        {header}
        <FlatList data={dq.length >= 2 ? people : []} keyExtractor={(p) => p.id} keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingBottom: ins.bottom + 24 }}
          renderItem={({ item }) => (
            <Pressable testID={`person-${item.id}`} onPress={() => openWith(item.id)} accessibilityRole="button" accessibilityLabel={item.displayName}
              style={({ pressed }) => [s.row, { flexDirection: row, backgroundColor: pressed ? c.cardSoft : 'transparent' }]}>
              <PersonAvatar p={item} size={46} />
              <View style={{ flex: 1 }}>
                <Text numberOfLines={1} style={txt('semibold', 15)}>{item.displayName}</Text>
                {item.username ? <Text numberOfLines={1} style={txt('regular', 13, c.secondary)}>@{item.username}</Text> : null}
              </View>
              {create.isPending && create.variables?.data.peerId === item.id ? <ActivityIndicator color={c.accent} /> : <Feather name="message-circle" size={18} color={c.secondary} />}
            </Pressable>
          )}
          ListEmptyComponent={
            <View style={s.empty}>
              {search.isError ? (
                <>
                  <Text style={txt('regular', 14, c.danger)}>{postError(search.error)}</Text>
                  <Pressable onPress={() => search.refetch()} style={[s.pill, { borderColor: c.borderStrong }]}><Text style={txt('semibold', 13)}>{t.retry}</Text></Pressable>
                </>
              ) : dq.length < 2 ? <Text style={[txt('regular', 14, c.secondary), { textAlign: 'center' }]}>{t.searchHint}</Text>
                : search.isPending ? <ActivityIndicator color={c.accent} />
                : <Text style={[txt('regular', 14, c.secondary), { textAlign: 'center' }]}>{t.noPeople}</Text>}
            </View>
          } />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: c.bgTop }}>
      {header}
      {first.isPending ? <Skeleton /> : first.isError && !first.data ? (
        <View style={s.empty}>
          <Feather name="wifi-off" size={28} color={c.muted} />
          <Text style={txt('regular', 14, c.secondary)}>{postError(first.error) || t.error}</Text>
          <Pressable testID="inbox-retry" onPress={() => first.refetch()} style={[s.pill, { borderColor: c.borderStrong }]}><Text style={txt('semibold', 13)}>{t.retry}</Text></Pressable>
        </View>
      ) : (
        <FlatList data={others} keyExtractor={(cv) => cv.id} contentContainerStyle={{ paddingBottom: ins.bottom + 24 }}
          renderItem={({ item }) => <Row cv={item} />}
          onEndReachedThreshold={0.4} onEndReached={() => { if (!moreError) void loadMore(); }}
          ListFooterComponent={nextCursor ? (
            <Pressable onPress={() => void loadMore()} style={[s.pill, { borderColor: c.border, alignSelf: 'center', marginTop: 12 }]} accessibilityRole="button">
              {loadingMore ? <ActivityIndicator size="small" color={c.accent} /> : <Text style={txt('medium', 13, moreError ? c.danger : c.secondary)}>{moreError ? t.retry : t.loadMore}</Text>}
            </Pressable>
          ) : null}
          ListEmptyComponent={
            <View style={[s.empty, { paddingTop: 48 }]}>
              <View style={[s.emptyMark, { borderColor: c.borderStrong }]}><Feather name="message-square" size={30} color={c.accent} /></View>
              <Text style={[txt('bold', 18), { textAlign: 'center' }]}>{t.inboxEmpty}</Text>
              <Text style={[txt('regular', 14, c.secondary), { textAlign: 'center', maxWidth: 300, lineHeight: 21 }]}>{t.inboxEmptyBody}</Text>
              <Pressable onPress={() => setSearching(true)} style={[s.cta, { backgroundColor: c.accent }]} accessibilityRole="button">
                <Text style={{ color: c.onAccent, fontFamily: font('semibold'), fontSize: 14 }}>{t.newChat}</Text>
              </Pressable>
            </View>
          } />
      )}
    </View>
  );
}

const s = StyleSheet.create({
  row: { alignItems: 'center', gap: 14, paddingHorizontal: 20, paddingVertical: 11, minHeight: 72 },
  badge: { minWidth: 20, height: 20, borderRadius: 10, paddingHorizontal: 6, alignItems: 'center', justifyContent: 'center' },
  iconBtn: { width: 40, height: 44, alignItems: 'center', justifyContent: 'center' },
  newBtn: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  search: { alignItems: 'center', gap: 10, borderWidth: 1, borderRadius: 12, paddingHorizontal: 12 },
  empty: { alignItems: 'center', justifyContent: 'center', gap: 14, padding: 32 },
  emptyMark: { width: 72, height: 72, borderRadius: 36, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  pill: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 18, minHeight: 40, justifyContent: 'center', alignItems: 'center' },
  cta: { borderRadius: 999, paddingHorizontal: 24, minHeight: 46, justifyContent: 'center', marginTop: 6 },
});
