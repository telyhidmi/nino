import { Feather } from '@expo/vector-icons';
import { useAuth } from '@clerk/expo';
import { router } from 'expo-router';
import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { getListLiveStreamsQueryKey, useListLiveStreams } from '@workspace/api-client-react';
import { useColors } from '@/hooks/useColors';
import { useI18n } from '@/lib/i18n';
import { useLiveCopy } from '@/lib/liveCopy';
import { postError } from '@/lib/posts';

export function LiveList({ active = true, preview = false }: { active?: boolean; preview?: boolean }) {
  const c = useColors();
  const { font, row, align } = useI18n();
  const copy = useLiveCopy();
  const { isSignedIn } = useAuth();
  const query = useListLiveStreams({ query: { queryKey: getListLiveStreamsQueryKey(), enabled: active && !!isSignedIn && !preview, refetchInterval: active ? 15000 : false } });
  const text = { color: c.text, fontFamily: font(), textAlign: align };
  return <View testID="live-list" style={s.root}>
    <View style={[s.row, { flexDirection: row }]}>
      <Feather name="radio" size={22} color={c.accent} />
      <Text style={[text, { flex: 1, fontFamily: font('semibold'), fontSize: 20 }]}>{copy.live}</Text>
      <Pressable testID="live-refresh" onPress={() => void query.refetch()} disabled={preview || query.isFetching}
        accessibilityRole="button" accessibilityLabel={copy.refresh} style={s.icon}>
        <Feather name="refresh-cw" size={19} color={c.secondary} />
      </Pressable>
    </View>
    <Pressable testID="go-live" accessibilityRole="button" onPress={() => router.push('/live')}
      style={[s.button, { backgroundColor: c.accent, flexDirection: row }]}>
      <Feather name="video" size={20} color={c.onAccent} /><Text style={[text, { color: c.onAccent, fontFamily: font('semibold') }]}>{copy.go}</Text>
    </Pressable>
    {preview ? <Text style={[text, { color: c.secondary }]}>{copy.buildBody}</Text> :
      query.isLoading ? <ActivityIndicator color={c.accent} /> :
      query.error ? <Text testID="live-list-error" style={[text, { color: c.danger }]}>{postError(query.error)}</Text> :
      !query.data?.streams.length ? <View style={s.empty}>
        <Text style={[text, { fontFamily: font('semibold') }]}>{copy.empty}</Text>
        <Text style={[text, { color: c.secondary }]}>{copy.emptyBody}</Text>
      </View> :
      query.data.streams.map((stream) => <Pressable key={stream.id} testID={`live-stream-${stream.id}`} accessibilityRole="button"
        onPress={() => router.push({ pathname: '/live', params: { id: stream.id } })}
        style={[s.card, { backgroundColor: c.card, borderColor: c.border, flexDirection: row }]}>
        <View style={[s.symbol, { backgroundColor: c.accentWash }]}><Feather name="radio" size={24} color={c.accent} /></View>
        <View style={{ flex: 1, gap: 3 }}>
          <Text style={[text, { fontFamily: font('semibold') }]} numberOfLines={2}>{stream.title}</Text>
          <Text style={[text, { color: c.secondary }]} numberOfLines={1}>{stream.hostName}</Text>
          <Text style={[text, { color: c.accent, fontSize: 12 }]}>{stream.viewerCount} · {copy.viewers}</Text>
        </View>
        <Feather name={row === 'row' ? 'chevron-right' : 'chevron-left'} size={20} color={c.secondary} />
      </Pressable>)}
  </View>;
}
const s = StyleSheet.create({
  root: { padding: 16, gap: 14 }, row: { alignItems: 'center', gap: 10 }, icon: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  button: { padding: 14, borderRadius: 12, alignItems: 'center', justifyContent: 'center', gap: 10 },
  card: { borderWidth: 1, borderRadius: 14, padding: 14, alignItems: 'center', gap: 12 },
  symbol: { width: 52, height: 64, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  empty: { paddingVertical: 22, gap: 8 },
});