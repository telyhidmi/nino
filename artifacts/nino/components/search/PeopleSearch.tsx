import { Feather } from '@expo/vector-icons';
import { useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import {
  getGetMessagingRelationshipQueryKey, getSearchMessagingPeopleQueryKey, useCreateMessagingConversation,
  useGetMessagingRelationship, useSearchMessagingPeople, type MessagingProfile,
} from '@workspace/api-client-react';
import { FollowButton, PersonAvatar, RelationChip, threadHref } from '@/components/MessagingParts';
import { useColors } from '@/hooks/useColors';
import { useI18n } from '@/lib/i18n';
import { invalidateInbox } from '@/lib/messaging';
import { useMessagesCopy } from '@/lib/messagesCopy';
import { isSearchablePeopleQuery, normalizePeopleQuery } from '@/lib/peopleQuery';
import { postError } from '@/lib/posts';

/** Real people search (display name or username, "@name" allowed). Tapping a result opens a public profile card, not a chat. */
export function PeopleSearch({ onOpened }: { onOpened?: () => void }) {
  const c = useColors();
  const t = useMessagesCopy();
  const { t: tr, font, row, align } = useI18n();
  const [q, setQ] = useState('');
  const [dq, setDq] = useState('');
  const [selected, setSelected] = useState<MessagingProfile | null>(null);
  const norm = normalizePeopleQuery(q);
  useEffect(() => { const h = setTimeout(() => setDq(norm), 300); return () => clearTimeout(h); }, [norm]);
  const searchable = isSearchablePeopleQuery(dq);
  const settled = dq === norm; // no stale results while the debounce is pending
  const search = useSearchMessagingPeople({ q: dq }, { query: { queryKey: getSearchMessagingPeopleQueryKey({ q: dq }), enabled: searchable, staleTime: 15_000, retry: false } });
  const txt = (w: 'regular' | 'medium' | 'semibold' | 'bold', size: number, color = c.text) => ({ fontFamily: font(w), fontSize: size, color, textAlign: align });

  if (selected) return <PublicProfileCard person={selected} onBack={() => setSelected(null)} onOpened={onOpened} />;

  const people = search.data ?? [];
  let body: React.ReactNode;
  if (!isSearchablePeopleQuery(norm)) {
    body = <State icon="at-sign" text={t.searchHint} testID="people-hint" />;
  } else if (!settled || search.isPending || search.isFetching && !search.data) {
    body = <View testID="people-loading" style={{ gap: 10, paddingTop: 4 }}>{[0, 1, 2].map((i) => (
      <View key={i} style={{ flexDirection: row, alignItems: 'center', gap: 12, opacity: 1 - i * 0.25 }}>
        <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: c.card }} />
        <View style={{ flex: 1, gap: 6 }}><View style={{ width: '55%', height: 12, borderRadius: 6, backgroundColor: c.card }} /><View style={{ width: '35%', height: 10, borderRadius: 5, backgroundColor: c.cardSoft }} /></View>
      </View>))}</View>;
  } else if (search.isError) {
    body = <View style={{ alignItems: 'center', gap: 10, paddingVertical: 20 }} testID="people-error">
      <Feather name="wifi-off" size={22} color={c.danger} />
      <Text style={[txt('medium', 13, c.secondary), { textAlign: 'center' }]}>{postError(search.error)}</Text>
      <Pressable testID="people-retry" onPress={() => void search.refetch()} accessibilityRole="button" style={[s.pill, { borderColor: c.accent }]}>
        <Feather name="rotate-cw" size={13} color={c.accent} /><Text style={txt('semibold', 13, c.accent)}>{t.retry}</Text>
      </Pressable>
    </View>;
  } else if (people.length === 0) {
    body = <State icon="user-x" text={t.noPeople} testID="people-empty" />;
  } else {
    body = people.map((p) => (
      <Pressable key={p.id} testID={`person-${p.id}`} onPress={() => setSelected(p)} accessibilityRole="button"
        accessibilityLabel={p.username ? `${p.displayName}, @${p.username}` : p.displayName}
        style={({ pressed }) => [s.row, { flexDirection: row, backgroundColor: pressed ? c.cardSoft : 'transparent' }]}>
        <PersonAvatar p={p} size={44} />
        <View style={{ flex: 1, gap: 1 }}>
          <Text numberOfLines={1} style={txt('semibold', 14.5)}>{p.displayName}</Text>
          {p.username ? <Text numberOfLines={1} style={txt('regular', 12.5, c.secondary)}>@{p.username}</Text> : null}
        </View>
        <Feather name={align === 'right' ? 'chevron-left' : 'chevron-right'} size={18} color={c.muted} />
      </Pressable>
    ));
  }

  return (
    <View>
      <View style={[s.input, { flexDirection: row, borderColor: c.border, backgroundColor: c.cardSoft }]}>
        <Feather name="search" size={16} color={c.secondary} />
        <TextInput testID="people-search-input" value={q} onChangeText={setQ} placeholder={t.searchPh} placeholderTextColor={c.muted}
          autoCapitalize="none" autoCorrect={false} autoFocus returnKeyType="search" accessibilityLabel={tr('search')}
          style={{ flex: 1, color: c.text, fontFamily: font('regular'), fontSize: 14, minHeight: 44, textAlign: align }} />
        {q ? <Pressable onPress={() => setQ('')} hitSlop={8} accessibilityRole="button" accessibilityLabel={t.close}><Feather name="x-circle" size={16} color={c.muted} /></Pressable> : null}
      </View>
      {body}
    </View>
  );
}

function State({ icon, text, testID }: { icon: keyof typeof Feather.glyphMap; text: string; testID: string }) {
  const c = useColors();
  const { font } = useI18n();
  return <View testID={testID} style={{ alignItems: 'center', paddingVertical: 24, gap: 8 }}>
    <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: c.accentWash, alignItems: 'center', justifyContent: 'center' }}><Feather name={icon} size={20} color={c.accent} /></View>
    <Text style={{ color: c.secondary, fontFamily: font('regular'), fontSize: 13, textAlign: 'center' }}>{text}</Text>
  </View>;
}

function PublicProfileCard({ person, onBack, onOpened }: { person: MessagingProfile; onBack: () => void; onOpened?: () => void }) {
  const c = useColors();
  const t = useMessagesCopy();
  const { font, row, align } = useI18n();
  const qc = useQueryClient();
  const rel = useGetMessagingRelationship(person.id, { query: { queryKey: getGetMessagingRelationshipQueryKey(person.id), staleTime: 15_000, retry: false } });
  const create = useCreateMessagingConversation();
  const busy = useRef(false);
  const [err, setErr] = useState<string | null>(null);
  const message = () => {
    if (busy.current) return;
    busy.current = true; setErr(null);
    create.mutate({ data: { peerId: person.id } }, {
      onSuccess: (cv) => { void invalidateInbox(qc); onOpened?.(); router.push(threadHref(cv.id)); },
      onError: (e) => setErr(postError(e)),
      onSettled: () => { busy.current = false; },
    });
  };
  return (
    <View testID={`public-profile-${person.id}`} style={{ gap: 14, paddingBottom: 8 }}>
      <Pressable testID="public-profile-back" onPress={onBack} accessibilityRole="button" accessibilityLabel={t.back} hitSlop={8}
        style={{ flexDirection: row, alignItems: 'center', gap: 4, alignSelf: align === 'right' ? 'flex-end' : 'flex-start' }}>
        <Feather name={align === 'right' ? 'chevron-right' : 'chevron-left'} size={18} color={c.secondary} />
        <Text style={{ color: c.secondary, fontFamily: font('medium'), fontSize: 13 }}>{t.back}</Text>
      </Pressable>
      <View style={{ alignItems: 'center', gap: 6 }}>
        <View style={{ padding: 3, borderRadius: 48, borderWidth: 2, borderColor: c.accent }}><PersonAvatar p={person} size={84} /></View>
        <Text numberOfLines={1} style={{ color: c.text, fontFamily: font('bold'), fontSize: 19, marginTop: 4 }}>{person.displayName}</Text>
        {person.username ? <Text style={{ color: c.secondary, fontFamily: font('regular'), fontSize: 13.5 }}>@{person.username}</Text> : null}
        <RelationChip rel={rel.data} testID="public-profile-relation" />
      </View>
      {rel.isError ? (
        <Pressable onPress={() => void rel.refetch()} accessibilityRole="button" style={{ alignSelf: 'center' }}>
          <Text style={{ color: c.danger, fontFamily: font('medium'), fontSize: 12.5, textAlign: 'center' }}>{t.followFailed} · {t.retry}</Text>
        </Pressable>
      ) : null}
      <View style={{ flexDirection: row, justifyContent: 'center', alignItems: 'flex-start', gap: 10 }}>
        {!rel.isError ? <FollowButton peerId={person.id} name={person.displayName} rel={rel.data} testID="public-profile-follow" /> : null}
        <Pressable testID="public-profile-message" onPress={message} disabled={create.isPending} accessibilityRole="button" accessibilityState={{ busy: create.isPending }}
          style={({ pressed }) => [s.pill, { height: 32, borderColor: c.borderStrong, opacity: pressed || create.isPending ? 0.7 : 1 }]}>
          {create.isPending ? <ActivityIndicator size="small" color={c.text} /> : <Feather name="message-circle" size={13} color={c.text} />}
          <Text style={{ color: c.text, fontFamily: font('semibold'), fontSize: 12.5 }}>{create.isPending ? t.opening : t.composer}</Text>
        </Pressable>
      </View>
      {err ? <Text testID="public-profile-message-error" accessibilityLiveRegion="polite" style={{ color: c.danger, fontFamily: font('medium'), fontSize: 12.5, textAlign: 'center' }}>{err}</Text> : null}
    </View>
  );
}

const s = StyleSheet.create({
  input: { alignItems: 'center', gap: 8, borderWidth: 1, borderRadius: 14, paddingHorizontal: 12, marginVertical: 12 },
  row: { alignItems: 'center', gap: 12, paddingVertical: 8, paddingHorizontal: 6, borderRadius: 12 },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, height: 36, borderRadius: 18, borderWidth: 1 },
});
