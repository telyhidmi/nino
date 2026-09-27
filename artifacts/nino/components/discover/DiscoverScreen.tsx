import { Feather } from '@expo/vector-icons';
import { Image } from 'expo-image';
import React, { useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { EarthGlobe } from '@/components/EarthGlobe';
import { useInsets } from '@/components/ui';
import { useColors } from '@/hooks/useColors';
import { CountryDetail } from './CountryDetail';
import { COUNTRIES, countryMatches, DiscoverMedia } from './data';
import { CountryCard, DemoPill, EmptyState, FeaturedCountry, FlagChip, Segments } from './parts';

type Filter = 'foryou' | 'countries' | 'live' | 'nearby';
const FILTERS: { key: Filter; label: string }[] = [
  { key: 'foryou', label: 'For You' }, { key: 'countries', label: 'Countries' }, { key: 'live', label: 'Live Now' }, { key: 'nearby', label: 'Nearby' },
];

export function DiscoverScreen({ onOpenPost }: { onOpenPost: (postId: string) => void }) {
  const c = useColors();
  const ins = useInsets();
  const [filter, setFilter] = useState<Filter>('countries');
  const [query, setQuery] = useState('');
  const [chip, setChip] = useState<string>('all');
  const [openId, setOpenId] = useState<string | null>(null);
  const [follows, setFollows] = useState<Record<string, boolean>>({});
  const [preview, setPreview] = useState<DiscoverMedia | null>(null);

  const list = useMemo(() => COUNTRIES.filter((x) => (chip === 'all' || x.id === chip) && countryMatches(x, query)), [chip, query]);
  const ordered = filter === 'foryou' ? [...list].sort((a, b) => Number(!!follows[b.id]) - Number(!!follows[a.id])) : list;
  const [featured, ...rest] = ordered;
  const rows = [];
  for (let i = 0; i < rest.length; i += 2) rows.push(rest.slice(i, i + 2));
  const country = COUNTRIES.find((x) => x.id === openId);

  const previewModal = (
    <Modal visible={!!preview} transparent animationType="fade" onRequestClose={() => setPreview(null)}>
      <Pressable testID="preview-close" onPress={() => setPreview(null)} style={[st.modal, { backgroundColor: c.overlay }]}>
        {preview ? (
          <View style={{ width: '100%', gap: 10 }}>
            <Image source={preview.image} style={st.modalImg} contentFit="cover" accessibilityLabel={preview.title} />
            <Text style={[st.modalTitle, { color: c.text }]}>{preview.title}</Text>
            <Text style={{ color: c.secondary, fontFamily: 'Poppins_400Regular', fontSize: 13 }}>{preview.place} · Illustrative sample photo</Text>
          </View>
        ) : null}
        <View style={[st.closeBtn, { borderColor: c.border }]}><Feather name="x" size={20} color={c.text} /></View>
      </Pressable>
    </Modal>
  );

  if (country) {
    return (
      <View style={{ flex: 1, backgroundColor: c.bgTop }}>
        <CountryDetail country={country} topInset={ins.top} following={!!follows[country.id]}
          onToggleFollow={() => setFollows((f) => ({ ...f, [country.id]: !f[country.id] }))}
          onBack={() => setOpenId(null)} onOpenPost={onOpenPost} onPreview={setPreview} />
        {previewModal}
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: c.bgTop }}>
      <ScrollView contentContainerStyle={{ paddingTop: ins.top + 6, paddingBottom: 24 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <View style={st.header}>
          <View style={st.brand}><Text style={[st.brandText, { color: c.accent }]}>Nin</Text><EarthGlobe size={28} /></View>
          <DemoPill text="DEMO · SAMPLE DATA" />
        </View>
        <View style={[st.search, { borderColor: c.border, backgroundColor: c.cardSoft }]}>
          <Feather name="search" size={18} color={c.secondary} />
          <TextInput testID="discover-search" value={query} onChangeText={setQuery} placeholder="Search countries, people, or interests..." placeholderTextColor={c.muted}
            style={[st.input, { color: c.text }]} accessibilityLabel="Search Discover" />
          {query ? <Pressable onPress={() => setQuery('')} hitSlop={8} accessibilityLabel="Clear search"><Feather name="x" size={16} color={c.secondary} /></Pressable> : null}
        </View>
        <View style={{ paddingHorizontal: 14, marginBottom: 12 }}><Segments prefix="dfilter" items={FILTERS} value={filter} onChange={setFilter} /></View>

        {filter === 'live' ? (
          <EmptyState icon="radio" title="Nobody is live in this demo" body="Live broadcasting isn't built yet. When it is, real streams will appear here — we won't show pretend ones." />
        ) : filter === 'nearby' ? (
          <EmptyState icon="map-pin" title="Nearby isn't available yet" body="This preview doesn't use your location. Browse countries instead to explore sample stories from around the world." />
        ) : (
          <>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 10, gap: 4, paddingBottom: 12 }}>
              <FlagChip label="All" on={chip === 'all'} onPress={() => setChip('all')} />
              {COUNTRIES.map((x) => <FlagChip key={x.id} flag={x.flag} label={x.name} on={chip === x.id} onPress={() => setChip(chip === x.id ? 'all' : x.id)} />)}
            </ScrollView>
            {!featured ? (
              <EmptyState icon="compass" title="No matches" body={`No sample countries match "${query}".`} />
            ) : (
              <View style={{ paddingHorizontal: 12, gap: 8 }}>
                <FeaturedCountry country={featured} onPress={() => setOpenId(featured.id)} />
                {rows.map((r, i) => (
                  <View key={i} style={{ flexDirection: 'row', gap: 8 }}>
                    {r.map((x) => <CountryCard key={x.id} country={x} onPress={() => setOpenId(x.id)} />)}
                    {r.length === 1 ? <View style={{ flex: 1 }} /> : null}
                  </View>
                ))}
                <Text style={[st.note, { color: c.muted }]}>Member counts are sample figures for this demo, not real activity.</Text>
              </View>
            )}
          </>
        )}
      </ScrollView>
      {previewModal}
    </View>
  );
}

const st = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, marginBottom: 10 },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  brandText: { fontFamily: 'Poppins_700Bold', fontSize: 30 },
  search: { flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: 14, borderWidth: 1, borderRadius: 999, paddingHorizontal: 16, marginBottom: 12 },
  input: { flex: 1, minHeight: 46, fontFamily: 'Poppins_400Regular', fontSize: 14 },
  note: { fontFamily: 'Poppins_400Regular', fontSize: 11, textAlign: 'center', marginTop: 8 },
  modal: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20 },
  modalImg: { width: '100%', aspectRatio: 3 / 4, borderRadius: 16 },
  modalTitle: { fontFamily: 'Poppins_700Bold', fontSize: 18 },
  closeBtn: { position: 'absolute', top: 60, right: 20, width: 44, height: 44, borderRadius: 22, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
});
