import { useAuth } from '@clerk/expo';
import { Feather } from '@expo/vector-icons';
import { useQueryClient } from '@tanstack/react-query';
import * as Crypto from 'expo-crypto';
import { Redirect, router, useLocalSearchParams } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, TextInput, View, type ViewToken } from 'react-native';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import {
  getListMessagingMessagesQueryKey, listMessagingMessages, useGetMessagingProfile, useListMessagingMessages, useMarkMessagingRead,
  useSendMessagingMessage, type MessagingMessage, type MessagingMessageInput, type MessagingThread,
} from '@workspace/api-client-react';
import { PersonAvatar } from '@/components/MessagingParts';
import { useInsets } from '@/components/ui';
import { useColors } from '@/hooks/useColors';
import { useI18n } from '@/lib/i18n';
import { useMessagesCopy } from '@/lib/messagesCopy';
import { POLL_MS, invalidateInbox, invalidateThread, shortTime, useActive } from '@/lib/messaging';
import { postError } from '@/lib/posts';

type Pending = { nonce: string; text: string; status: 'sending' | 'failed' | 'sent'; error?: string; message?: MessagingMessage };
type Item = { kind: 'msg'; m: MessagingMessage } | { kind: 'pending'; p: Pending };
const MAX = 2000;

export default function Conversation() {
  const { isSignedIn } = useAuth();
  const { id } = useLocalSearchParams<{ id?: string }>();
  if (!isSignedIn) return <Redirect href="/" />;
  if (typeof id !== 'string' || !id) return <Redirect href={'/messages' as never} />;
  return <Thread key={id} id={id} />;
}

function Thread({ id }: { id: string }) {
  const c = useColors();
  const ins = useInsets();
  const t = useMessagesCopy();
  const { font, row, align, lang } = useI18n();
  const qc = useQueryClient();
  const active = useActive();
  const me = useGetMessagingProfile();
  const meId = me.data?.id;
  const first = useListMessagingMessages(id, undefined, {
    query: { queryKey: getListMessagingMessagesQueryKey(id), refetchInterval: active ? POLL_MS : false, refetchIntervalInBackground: false },
  });
  const [older, setOlder] = useState<MessagingMessage[]>([]);
  const [cursor, setCursor] = useState<string | null | undefined>(undefined);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [olderErr, setOlderErr] = useState(false);
  const [pending, setPending] = useState<Pending[]>([]);
  const [text, setText] = useState('');
  const send = useSendMessagingMessage();
  const mark = useMarkMessagingRead();
  const sendRef = useRef(send.mutate); sendRef.current = send.mutate;
  const markRef = useRef(mark.mutate); markRef.current = mark.mutate;
  const inFlight = useRef(new Set<string>());

  const conv = first.data?.conversation;
  const nextCursor = cursor === undefined ? first.data?.nextCursor ?? null : cursor;

  const messages = useMemo(() => {
    const map = new Map<string, MessagingMessage>();
    for (const m of older) map.set(m.id, m);
    for (const m of first.data?.messages ?? []) map.set(m.id, m);
    return [...map.values()].sort((a, b) => b.sequence - a.sequence);
  }, [older, first.data]);
  const known = useMemo(() => new Set(messages.map((m) => m.clientNonce)), [messages]);

  // Drop local copies once the server list contains them (deduped by clientNonce).
  useEffect(() => { setPending((p) => (p.some((x) => known.has(x.nonce)) ? p.filter((x) => !known.has(x.nonce)) : p)); }, [known]);

  const items: Item[] = useMemo(() => {
    const local = pending.filter((p) => !known.has(p.nonce)).reverse().map<Item>((p) => ({ kind: 'pending', p }));
    return [...local, ...messages.map<Item>((m) => ({ kind: 'msg', m }))];
  }, [pending, messages, known]);

  const deliver = useCallback((nonce: string, body: string) => {
    if (inFlight.current.has(nonce)) return; // never two concurrent requests for one nonce
    inFlight.current.add(nonce);
    setPending((p) => p.map((x) => (x.nonce === nonce ? { ...x, status: 'sending', error: undefined } : x)));
    const data: MessagingMessageInput = { text: body, clientNonce: nonce }; // nonce is a crypto UUID, reused verbatim on retry
    sendRef.current({ id, data }, {
      onSuccess: (m) => {
        setPending((p) => p.map((x) => (x.nonce === nonce ? { ...x, status: 'sent', message: m } : x)));
        void invalidateThread(qc, id); void invalidateInbox(qc);
      },
      onError: (e) => setPending((p) => p.map((x) => (x.nonce === nonce ? { ...x, status: 'failed', error: postError(e) } : x))),
      onSettled: () => { inFlight.current.delete(nonce); },
    });
  }, [id, qc]);

  const submit = () => {
    const body = text.trim();
    if (!body) return;
    const nonce = Crypto.randomUUID();
    setPending((p) => [...p, { nonce, text: body, status: 'sending' }]);
    setText('');
    deliver(nonce, body);
  };

  const loadOlder = async () => {
    if (!nextCursor || loadingOlder) return;
    setLoadingOlder(true); setOlderErr(false);
    try {
      const page = await listMessagingMessages(id, { cursor: nextCursor });
      setOlder((o) => [...o, ...page.messages]);
      setCursor(page.nextCursor);
    } catch { setOlderErr(true); } finally { setLoadingOlder(false); }
  };

  // Read handling: only the newest server message actually on screen counts.
  const [visibleTop, setVisibleTop] = useState<MessagingMessage | null>(null);
  const onViewable = useRef(({ viewableItems }: { viewableItems: ViewToken<Item>[] }) => {
    let best: MessagingMessage | null = null;
    for (const v of viewableItems) {
      const it = v.item;
      if (v.isViewable && it?.kind === 'msg' && (!best || it.m.sequence > best.sequence)) best = it.m;
    }
    setVisibleTop((prev) => (prev?.id === best?.id ? prev : best));
  }).current;
  const viewCfg = useRef({ itemVisiblePercentThreshold: 60, minimumViewTime: 250 }).current;
  const markedSeq = useRef(0);
  const unread = conv?.unreadCount ?? 0;
  useEffect(() => {
    if (!active || !visibleTop || unread <= 0 || visibleTop.sequence <= markedSeq.current) return;
    const seq = visibleTop.sequence;
    markedSeq.current = seq;
    markRef.current({ id, data: { messageId: visibleTop.id } }, {
      onSuccess: (r) => {
        qc.setQueryData<MessagingThread>(getListMessagingMessagesQueryKey(id), (old) => (old ? { ...old, conversation: { ...old.conversation, unreadCount: r.unreadCount } } : old));
        void invalidateInbox(qc);
      },
      onError: () => { if (markedSeq.current === seq) markedSeq.current = seq - 1; },
    });
  }, [active, visibleTop, unread, id, qc]);

  const back = () => (router.canGoBack() ? router.back() : router.replace('/messages' as never));
  const title = conv?.peer.displayName ?? '';
  const sub = conv?.peer.username ? `@${conv.peer.username}` : t.privateNote;

  const Bubble = ({ mine, body, time, status, onRetry, error }: { mine: boolean; body: string; time?: string; status?: Pending['status']; onRetry?: () => void; error?: string }) => {
    const side = mine === (align === 'left') ? 'flex-end' : 'flex-start';
    return (
      <View style={{ alignItems: side, paddingHorizontal: 14, marginVertical: 3 }}>
        <Pressable disabled={status !== 'failed'} onPress={onRetry} accessibilityRole={status === 'failed' ? 'button' : undefined}
          accessibilityLabel={status === 'failed' ? `${t.failed} ${body}` : undefined}
          style={[s.bubble, mine ? { backgroundColor: status === 'failed' ? c.dangerWash : c.accent, borderBottomRightRadius: align === 'left' ? 6 : 20, borderBottomLeftRadius: align === 'left' ? 20 : 6 }
            : { backgroundColor: c.card, borderWidth: 1, borderColor: c.border, borderBottomLeftRadius: align === 'left' ? 6 : 20, borderBottomRightRadius: align === 'left' ? 20 : 6 },
            status === 'sending' && { opacity: 0.65 }]}>
          <Text selectable style={{ color: mine && status !== 'failed' ? c.onAccent : c.text, fontFamily: font('regular'), fontSize: 15, lineHeight: 21, textAlign: align }}>{body}</Text>
        </Pressable>
        <View style={{ flexDirection: row, alignItems: 'center', gap: 5, marginTop: 3, paddingHorizontal: 4 }}>
          {status === 'sending' ? <Text style={[s.meta, { color: c.muted, fontFamily: font('regular') }]}>{t.sending}</Text> : null}
          {status === 'failed' ? <><Feather name="alert-circle" size={12} color={c.danger} /><Text style={[s.meta, { color: c.danger, fontFamily: font('medium') }]}>{error ? `${error} · ` : ''}{t.failed}</Text></> : null}
          {time && status !== 'failed' && status !== 'sending' ? <Text style={[s.meta, { color: c.muted, fontFamily: font('regular') }]}>{time}</Text> : null}
        </View>
      </View>
    );
  };

  const renderItem = ({ item }: { item: Item }) => {
    if (item.kind === 'msg') return <Bubble mine={item.m.senderId === meId} body={item.m.text} time={shortTime(item.m.createdAt, lang)} />;
    const p = item.p;
    return <Bubble mine body={p.text} status={p.status} error={p.error} time={p.message ? shortTime(p.message.createdAt, lang) : undefined}
      onRetry={() => deliver(p.nonce, p.text)} />;
  };

  return (
    <View style={{ flex: 1, backgroundColor: c.bgTop }}>
      <View style={[s.header, { paddingTop: ins.top + 4, flexDirection: row, borderBottomColor: c.border }]}>
        <Pressable testID="thread-back" onPress={back} accessibilityRole="button" accessibilityLabel={t.back} style={s.iconBtn} hitSlop={6}>
          <Feather name={align === 'right' ? 'chevron-right' : 'chevron-left'} size={26} color={c.text} />
        </Pressable>
        {conv ? <PersonAvatar p={conv.peer} size={38} /> : <View style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: c.card }} />}
        <View style={{ flex: 1 }}>
          {conv ? <Text numberOfLines={1} style={{ color: c.text, fontFamily: font('semibold'), fontSize: 16, textAlign: align }}>{title}</Text>
            : <View style={{ height: 12, width: 120, borderRadius: 6, backgroundColor: c.card, marginBottom: 6 }} />}
          <Text numberOfLines={1} style={{ color: c.muted, fontFamily: font('regular'), fontSize: 12, textAlign: align }}>{conv ? sub : ''}</Text>
        </View>
      </View>

      <KeyboardAvoidingView behavior="padding" style={{ flex: 1 }}>
        {first.isPending ? (
          <View style={{ flex: 1, justifyContent: 'flex-end', padding: 16, gap: 10 }}>
            {[0.5, 0.35, 0.62, 0.42].map((w, i) => (
              <View key={i} style={{ alignSelf: i % 2 ? 'flex-end' : 'flex-start', width: `${w * 100}%`, height: 40, borderRadius: 18, backgroundColor: i % 2 ? c.accentWash : c.card }} />
            ))}
          </View>
        ) : first.isError && !first.data ? (
          <View style={s.center}>
            <Feather name="wifi-off" size={28} color={c.muted} />
            <Text style={{ color: c.secondary, fontFamily: font('regular'), fontSize: 14, textAlign: 'center' }}>{postError(first.error) || t.error}</Text>
            <Pressable testID="thread-retry" onPress={() => first.refetch()} style={[s.pill, { borderColor: c.borderStrong }]}>
              <Text style={{ color: c.text, fontFamily: font('semibold'), fontSize: 13 }}>{t.retry}</Text>
            </Pressable>
          </View>
        ) : (
          <FlatList inverted data={items} renderItem={renderItem} keyboardShouldPersistTaps="handled" keyboardDismissMode="interactive"
            keyExtractor={(it) => (it.kind === 'msg' ? it.m.id : `p-${it.p.nonce}`)}
            onViewableItemsChanged={onViewable} viewabilityConfig={viewCfg}
            contentContainerStyle={{ paddingVertical: 12, flexGrow: 1 }}
            onEndReachedThreshold={0.3} onEndReached={() => { if (!olderErr) void loadOlder(); }}
            ListFooterComponent={nextCursor ? (
              <Pressable onPress={() => void loadOlder()} style={[s.pill, { borderColor: c.border, alignSelf: 'center', marginVertical: 10 }]} accessibilityRole="button">
                {loadingOlder ? <ActivityIndicator size="small" color={c.accent} />
                  : <Text style={{ color: olderErr ? c.danger : c.secondary, fontFamily: font('medium'), fontSize: 13 }}>{olderErr ? t.retry : t.loadOlder}</Text>}
              </Pressable>
            ) : null}
            ListEmptyComponent={
              <View style={[s.center, { transform: [{ scaleY: -1 }] }]}>
                {conv ? <PersonAvatar p={conv.peer} size={72} /> : null}
                <Text style={{ color: c.text, fontFamily: font('semibold'), fontSize: 17, textAlign: 'center' }}>{title}</Text>
                <Text style={{ color: c.secondary, fontFamily: font('regular'), fontSize: 14, textAlign: 'center' }}>{t.threadEmpty}</Text>
              </View>
            } />
        )}
        <View style={[s.composer, { flexDirection: row, paddingBottom: Math.max(ins.bottom, 10), borderTopColor: c.border, backgroundColor: c.bgBottom }]}>
          <TextInput testID="composer" value={text} onChangeText={setText} placeholder={t.composer} placeholderTextColor={c.muted} multiline maxLength={MAX}
            accessibilityLabel={t.composer} editable={!first.isPending && !(first.isError && !first.data)}
            style={[s.input, { color: c.text, backgroundColor: c.cardSoft, borderColor: c.border, fontFamily: font('regular'), textAlign: align }]} />
          <Pressable testID="send" onPress={submit} disabled={!text.trim()} accessibilityRole="button" accessibilityLabel={t.send}
            style={[s.send, { backgroundColor: text.trim() ? c.accent : c.card }]}>
            <Feather name="arrow-up" size={20} color={text.trim() ? c.onAccent : c.muted} style={align === 'right' ? { transform: [{ scaleX: -1 }] } : undefined} />
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const s = StyleSheet.create({
  header: { alignItems: 'center', gap: 10, paddingHorizontal: 10, paddingBottom: 10, borderBottomWidth: StyleSheet.hairlineWidth },
  iconBtn: { width: 40, height: 44, alignItems: 'center', justifyContent: 'center' },
  bubble: { maxWidth: '80%', paddingHorizontal: 14, paddingVertical: 9, borderRadius: 20 },
  meta: { fontSize: 11 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 32 },
  pill: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 18, minHeight: 40, justifyContent: 'center', alignItems: 'center' },
  composer: { alignItems: 'flex-end', gap: 10, paddingHorizontal: 12, paddingTop: 10, borderTopWidth: StyleSheet.hairlineWidth },
  input: { flex: 1, minHeight: 44, maxHeight: 140, borderWidth: 1, borderRadius: 22, paddingHorizontal: 16, paddingTop: 11, paddingBottom: 11, fontSize: 15 },
  send: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
});
