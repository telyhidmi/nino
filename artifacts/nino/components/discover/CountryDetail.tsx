import { Feather } from '@expo/vector-icons';
import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useColors } from '@/hooks/useColors';
import type { DiscoverCountry, DiscoverMedia } from './data';
import { DemoPill, EmptyState, MediaTile, PersonCircle, Segments } from './parts';

type DTab = 'top' | 'live' | 'people' | 'videos' | 'places';
const TABS: { key: DTab; label: string }[] = [
  { key: 'top', label: 'Top' }, { key: 'live', label: 'Live' }, { key: 'people', label: 'People' }, { key: 'videos', label: 'Videos' }, { key: 'places', label: 'Places' },
];

export function CountryDetail({ country, topInset, following, onToggleFollow, onBack, onOpenPost, onPreview }: {
  country: DiscoverCountry; topInset: number; following: boolean; onToggleFollow: () => void; onBack: () => void;
  onOpenPost: (postId: string) => void; onPreview: (m: DiscoverMedia) => void;
}) {
  const c = useColors();
  const [tab, setTab] = useState<DTab>('top');
  const media = tab === 'videos' ? country.media.filter((m) => m.kind === 'video') : tab === 'places' ? country.media.filter((m) => m.kind === 'image') : country.media;
  const open = (m: DiscoverMedia) => (m.kind === 'video' ? onOpenPost(m.postId) : onPreview(m));
  const rows: DiscoverMedia[][] = [];
  for (let i = 0; i < media.length; i += 2) rows.push(media.slice(i, i + 2));

  return (
    <View style={{ flex: 1 }}>
      <View style={[st.head, { paddingTop: topInset + 6 }]}>
        <Pressable testID="country-back" onPress={onBack} accessibilityRole="button" accessibilityLabel="Back to Discover" style={st.back}>
          <Feather name="arrow-left" size={24} color={c.text} />
        </Pressable>
        <View style={[st.flag, { borderColor: c.border }]}><Text style={{ fontSize: 26 }}>{country.flag}</Text></View>
        <View style={{ flex: 1 }}>
          <Text style={[st.name, { color: c.text }]}>{country.name}</Text>
          <Text style={[st.meta, { color: c.secondary }]}>{country.sampleMembers.toLocaleString()} sample members</Text>
        </View>
        <Pressable testID="country-follow" onPress={onToggleFollow} accessibilityRole="button" accessibilityState={{ selected: following }}
          style={[st.follow, { borderColor: c.accent, backgroundColor: following ? c.accent : 'transparent' }]}>
          <Text style={{ color: following ? c.onAccent : c.accent, fontFamily: 'Poppins_600SemiBold', fontSize: 14 }}>{following ? 'Following' : 'Follow'}</Text>
        </Pressable>
      </View>
      <View style={{ paddingHorizontal: 12, paddingBottom: 8 }}><Segments prefix="ctab" items={TABS} value={tab} onChange={setTab} /></View>
      <ScrollView contentContainerStyle={{ paddingBottom: 24 }} showsVerticalScrollIndicator={false}>
        <View style={{ paddingHorizontal: 14, marginBottom: 8 }}><DemoPill text="DEMO · SAMPLE PROFILES & MEDIA" /></View>
        {tab === 'live' ? (
          <EmptyState icon="radio" title="No live broadcasts in this demo" body={`Live streaming isn't available yet, so nothing is broadcasting from ${country.name}. We won't show pretend streams.`} />
        ) : tab === 'people' ? (
          <View style={st.peopleGrid}>{country.people.map((p) => <PersonCircle key={p.id} person={p} onPress={p.postId ? () => onOpenPost(p.postId!) : undefined} />)}</View>
        ) : (
          <>
            {tab === 'top' ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 10, gap: 4, paddingBottom: 10 }}>
                {country.people.map((p) => <PersonCircle key={p.id} person={p} onPress={p.postId ? () => onOpenPost(p.postId!) : undefined} />)}
              </ScrollView>
            ) : null}
            {media.length === 0 ? (
              <EmptyState icon={tab === 'videos' ? 'film' : 'map'} title={tab === 'videos' ? 'No sample videos yet' : 'No sample places yet'} body={`The demo doesn't include ${tab} for ${country.name} yet.`} />
            ) : (
              <View style={{ paddingHorizontal: 10, gap: 6 }}>
                {rows.map((r, i) => (
                  <View key={i} style={{ flexDirection: 'row', gap: 6 }}>
                    {r.map((m) => <MediaTile key={m.id} item={m} flag={country.flag} onPress={() => open(m)} />)}
                    {r.length === 1 ? <View style={{ flex: 1 }} /> : null}
                  </View>
                ))}
              </View>
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const st = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, paddingBottom: 10 },
  back: { width: 40, height: 44, justifyContent: 'center' },
  flag: { width: 48, height: 48, borderRadius: 24, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  name: { fontFamily: 'Poppins_700Bold', fontSize: 22 },
  meta: { fontFamily: 'Poppins_400Regular', fontSize: 12 },
  follow: { borderWidth: 1.5, borderRadius: 999, paddingHorizontal: 18, height: 38, justifyContent: 'center' },
  peopleGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, paddingHorizontal: 12, justifyContent: 'flex-start' },
});
