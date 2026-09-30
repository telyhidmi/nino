import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect, useMemo, useState } from 'react';
import { BackHandler, FlatList, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import type { Post } from '@workspace/api-client-react';
import { EarthGlobe } from '@/components/EarthGlobe';
import { useInsets } from '@/components/ui';
import { useColors } from '@/hooks/useColors';
import { usePostCopy } from '@/lib/postTranslations';
import { postError } from '@/lib/posts';
import { useDiscoverCopy } from './copy';
import { countryFlag, countryName, groupRecordedVideos } from './publishedDiscovery';
import { EmptyState, FlagChip } from './parts';
import { LiveList } from '@/components/LiveList';
import { useLiveCopy } from '@/lib/liveCopy';

export type PublishedDiscoverProps = {
  posts: readonly Post[]; loading?: boolean; refreshing?: boolean; error?: unknown;
  onRetry: () => void; onOpenPost: (postId: string) => void; active?: boolean;
};

export function PublishedDiscover({ posts, loading, refreshing, error, onRetry, onOpenPost, active = true }: PublishedDiscoverProps) {
  const c = useColors();
  const ins = useInsets();
  const copy = useDiscoverCopy();
  const postCopy = usePostCopy();
  const liveCopy = useLiveCopy();
  const [showLive, setShowLive] = useState(false);
  const [query, setQuery] = useState('');
  const [chip, setChip] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const countries = useMemo(() => groupRecordedVideos(posts, copy.lang), [posts, copy.lang]);
  const matches = useMemo(() => groupRecordedVideos(posts, copy.lang, query), [posts, copy.lang, query]);
  const visible = matches.filter((country) => !chip || country.code === chip);
  const selectedCountry = matches.find((country) => country.code === selected);
  const videos = selectedCountry?.posts ?? [];
  const videoCount = countries.reduce((sum, country) => sum + country.posts.length, 0);
  const count = (n: number, label: string) => `${n.toLocaleString(copy.lang)} · ${label}`;

  useEffect(() => {
    if (!active || !selected) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => { setSelected(null); return true; });
    return () => sub.remove();
  }, [active, selected]);

  const retry = (
    <Pressable testID="discover-retry" onPress={onRetry} accessibilityRole="button" style={[s.retry, { borderColor: c.accent }]}>
      <Text style={[s.body, { color: c.accent }]}>{postCopy.retry}</Text>
    </Pressable>
  );
  const header = (
    <View style={{ paddingTop: ins.top + 6 }}>
      {selected ? (
        <View style={s.header}>
          <Pressable testID="country-back" onPress={() => setSelected(null)} accessibilityRole="button" accessibilityLabel={copy.back} style={s.back}>
            <Feather name="arrow-left" size={24} color={c.text} />
          </Pressable>
          <Text style={{ fontSize: 28 }}>{countryFlag(selected)}</Text>
          <View style={{ flex: 1 }}>
            <Text style={[s.title, { color: c.text }]}>{countryName(selected, copy.lang)}</Text>
            <Text testID="discover-country-video-count" style={[s.body, { color: c.secondary }]}>{count(videos.length, copy.videos)}</Text>
          </View>
        </View>
      ) : (
        <View style={s.header}>
          <View style={s.brand}><Text style={[s.brandText, { color: c.accent }]}>Nin</Text><EarthGlobe size={28} /></View>
          <Pressable testID="discover-live-tab" onPress={() => setShowLive(true)} accessibilityRole="button" style={s.back}>
            <Text style={[s.body, { color: c.accent }]}>{liveCopy.live}</Text>
          </Pressable>
        </View>
      )}
      <View style={[s.search, { borderColor: c.border, backgroundColor: c.cardSoft }]}>
        <Feather name="search" size={18} color={c.secondary} />
        <TextInput testID="discover-search" value={query} onChangeText={setQuery} placeholder={copy.search} placeholderTextColor={c.muted}
          style={[s.input, { color: c.text }]} accessibilityLabel={copy.search} />
        {query ? <Pressable testID="discover-clear-search" onPress={() => setQuery('')} hitSlop={8} accessibilityRole="button" accessibilityLabel={copy.all} style={s.back}>
          <Feather name="x" size={18} color={c.secondary} />
        </Pressable> : null}
      </View>
      {!selected ? <>
        <Text testID="discover-total-counts" style={[s.note, { color: c.secondary }]}>
          {count(countries.length, copy.countries)}{'   '}{count(videoCount, copy.videos)}
        </Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chips}>
          <FlagChip label={copy.all} on={!chip} onPress={() => setChip(null)} />
          {countries.map((country) => <FlagChip key={country.code} flag={country.flag} label={country.name} on={chip === country.code}
            onPress={() => setChip(chip === country.code ? null : country.code)} />)}
        </ScrollView>
      </> : null}
      <Text style={[s.note, { color: c.muted }]}>{copy.note}</Text>
      {error ? <View testID="discover-error" style={s.status}>
        <Text style={[s.body, { color: c.danger }]}>{postCopy.loadFailed}: {postError(error)}</Text>
        {retry}
      </View> : null}
    </View>
  );
  const empty = loading ? <View testID="discover-loading"><EmptyState icon="loader" title={postCopy.loading} body="" /></View> :
    error ? null : <View testID="discover-empty"><EmptyState icon="film" title={query || chip ? copy.noMatches : copy.empty}
      body={query || chip ? copy.noMatchesBody : copy.emptyBody} /></View>;

  if (showLive) return <View style={{ flex: 1, backgroundColor: c.bgTop, paddingTop: ins.top + 6 }}>
    <View style={s.header}>
      <Pressable testID="discover-live-back" onPress={() => setShowLive(false)} accessibilityRole="button" accessibilityLabel={copy.back} style={s.back}>
        <Feather name="arrow-left" size={24} color={c.text} />
      </Pressable>
      <Text style={[s.title, { color: c.text }]}>{liveCopy.live}</Text>
      <Pressable testID="discover-countries-tab" onPress={() => setShowLive(false)} accessibilityRole="button" style={s.back}>
        <Text style={[s.body, { color: c.secondary }]}>{copy.countries}</Text>
      </Pressable>
    </View>
    <ScrollView><LiveList active={active} /></ScrollView>
  </View>;

  return (
    <View style={{ flex: 1, backgroundColor: c.bgTop }}>
      {selected ? <FlatList key="videos" testID="discover-video-grid" data={videos} numColumns={2} keyExtractor={(post) => post.id}
        ListHeaderComponent={header} ListEmptyComponent={empty} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}
        refreshing={!!refreshing} onRefresh={onRetry} contentContainerStyle={s.list} columnWrapperStyle={s.row}
        renderItem={({ item }) => (
          <Pressable testID={`discover-post-${item.id}`} onPress={() => onOpenPost(item.id)} accessibilityRole="button"
            accessibilityLabel={`${copy.videos}: ${item.caption || item.authorName}`} style={[s.tile, { borderColor: c.border, backgroundColor: c.card }]}>
            <LinearGradient colors={[c.accentWash, c.cardSoft]} style={StyleSheet.absoluteFill} />
            <View style={s.videoIcon}><Feather name="play-circle" size={42} color={c.accent} /></View>
            <View style={s.tileText}>
              <Text style={[s.body, { color: c.text }]} numberOfLines={3}>{item.caption || copy.videos}</Text>
              <Text style={[s.small, { color: c.secondary }]} numberOfLines={1}>{item.authorName}</Text>
            </View>
          </Pressable>
        )} /> :
        <FlatList key="countries" testID="discover-country-grid" data={visible} numColumns={2} keyExtractor={(country) => country.code}
          ListHeaderComponent={header} ListEmptyComponent={empty} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}
          refreshing={!!refreshing} onRefresh={onRetry} contentContainerStyle={s.list} columnWrapperStyle={s.row}
          renderItem={({ item }) => (
            <Pressable testID={`country-${item.code}`} onPress={() => setSelected(item.code)} accessibilityRole="button"
              accessibilityLabel={`${item.name}, ${count(item.posts.length, copy.videos)}`} style={[s.card, { borderColor: c.border, backgroundColor: c.card }]}>
              <LinearGradient colors={[c.accentWash, c.card]} style={StyleSheet.absoluteFill} />
              <Text style={{ fontSize: 32 }}>{item.flag}</Text>
              <Text style={[s.countryTitle, { color: c.text }]} numberOfLines={2}>{item.name}</Text>
              <View style={s.meta}><Feather name="video" size={14} color={c.accent} />
                <Text style={[s.small, { color: c.accent }]}>{count(item.posts.length, copy.videos)}</Text>
              </View>
            </Pressable>
          )} />}
    </View>
  );
}

const s = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: 10, justifyContent: 'space-between', paddingHorizontal: 16, marginBottom: 10 },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  brandText: { fontFamily: 'Poppins_700Bold', fontSize: 30 },
  title: { fontFamily: 'Poppins_700Bold', fontSize: 22 },
  countryTitle: { fontFamily: 'Poppins_700Bold', fontSize: 18 },
  body: { fontFamily: 'Poppins_400Regular', fontSize: 13 },
  small: { fontFamily: 'Poppins_500Medium', fontSize: 11, flexShrink: 1 },
  search: { flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: 14, borderWidth: 1, borderRadius: 999, paddingHorizontal: 16, marginBottom: 12 },
  input: { flex: 1, minHeight: 46, fontFamily: 'Poppins_400Regular', fontSize: 14 },
  back: { minWidth: 36, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  note: { fontFamily: 'Poppins_400Regular', fontSize: 11, textAlign: 'center', marginHorizontal: 16, marginBottom: 12 },
  chips: { paddingHorizontal: 10, gap: 4, paddingBottom: 12 },
  list: { paddingBottom: 24 },
  row: { paddingHorizontal: 12, gap: 8, marginBottom: 8 },
  card: { flex: 1, maxWidth: '50%', minHeight: 168, borderWidth: 1, borderRadius: 16, overflow: 'hidden', padding: 14, justifyContent: 'space-between', gap: 8 },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  tile: { flex: 1, maxWidth: '50%', aspectRatio: 3 / 4, borderRadius: 14, borderWidth: 1, overflow: 'hidden' },
  videoIcon: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  tileText: { padding: 12, gap: 6 },
  status: { paddingHorizontal: 16, paddingBottom: 16, gap: 8 },
  retry: { alignSelf: 'center', borderWidth: 1, borderRadius: 999, paddingHorizontal: 20, minHeight: 44, justifyContent: 'center' },
});