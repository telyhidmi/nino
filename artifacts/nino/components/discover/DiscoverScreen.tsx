import { Feather } from '@expo/vector-icons';
import { Image } from 'expo-image';
import React, { useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { EarthGlobe } from '@/components/EarthGlobe';
import { useInsets } from '@/components/ui';
import { useColors } from '@/hooks/useColors';
import { useI18n } from '@/lib/i18n';
import { CountryDetail } from './CountryDetail';
import { COUNTRIES, countryLabelKey, countryMatches, DiscoverMedia } from './data';
import { CountryCard, DemoPill, EmptyState, FeaturedCountry, FlagChip, Segments } from './parts';
import { PublishedDiscover, type PublishedDiscoverProps } from './PublishedDiscover';

type Filter = 'foryou' | 'countries' | 'live' | 'nearby';

export function DiscoverScreen({ preview = false, ...props }: PublishedDiscoverProps & { preview?: boolean }) {
  return preview ? <DemoDiscoverScreen onOpenPost={props.onOpenPost} active={props.active} /> : <PublishedDiscover {...props} />;
}

function DemoDiscoverScreen({ onOpenPost, active = true }: { onOpenPost: (postId: string) => void; active?: boolean }) {
  const c = useColors();
  const { t, font, row, align, rtl } = useI18n();
  const filters: { key: Filter; label: string }[] = [
    { key: 'foryou', label: t('discoverForYou') }, { key: 'countries', label: t('discoverCountries') },
    { key: 'live', label: t('discoverLiveNow') }, { key: 'nearby', label: t('discoverNearby') },
  ];
  const ins = useInsets();
  const [filter, setFilter] = useState<Filter>('countries');
  const [query, setQuery] = useState('');
  const [chip, setChip] = useState<string>('all');
  const [openId, setOpenId] = useState<string | null>(null);
  const [follows, setFollows] = useState<Record<string, boolean>>({});
  const [preview, setPreview] = useState<DiscoverMedia | null>(null);
  useEffect(() => { if (!active) setPreview(null); }, [active]);

  const list = useMemo(() => COUNTRIES.filter((x) => (chip === 'all' || x.id === chip) && countryMatches(x, query, t(countryLabelKey(x)))), [chip, query, t]);
  const ordered = filter === 'foryou' ? [...list].sort((a, b) => Number(!!follows[b.id]) - Number(!!follows[a.id])) : list;
  const [featured, ...rest] = ordered;
  const rows = [];
  for (let i = 0; i < rest.length; i += 2) rows.push(rest.slice(i, i + 2));
  const country = COUNTRIES.find((x) => x.id === openId);

  const previewModal = (
    <Modal visible={active && !!preview} transparent animationType="fade" onRequestClose={() => setPreview(null)}>
      <Pressable testID="preview-close" onPress={() => setPreview(null)} style={[st.modal, { backgroundColor: c.overlay }]}>
        {preview ? (
          <View style={{ width: '100%', gap: 10 }}>
            <Image source={preview.image} style={st.modalImg} contentFit="cover" accessibilityLabel={preview.title} />
            <Text style={[st.modalTitle, { color: c.text, fontFamily: font('bold'), textAlign: align }]}>{preview.title}</Text>
            <Text style={{ color: c.secondary, fontFamily: font(), fontSize: 13, textAlign: align }}>{preview.place} · {t('discoverSamplePhoto')}</Text>
          </View>
        ) : null}
        <Pressable accessibilityRole="button" accessibilityLabel={t('discoverClosePreview')} onPress={() => setPreview(null)}
          style={[st.closeBtn, { borderColor: c.border, right: rtl ? undefined : 20, left: rtl ? 20 : undefined }]}><Feather name="x" size={20} color={c.text} /></Pressable>
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
        <View style={[st.header, { flexDirection: row }]}>
          <View style={st.brand}><Text style={[st.brandText, { color: c.accent }]}>Nin</Text><EarthGlobe size={28} /></View>
          <DemoPill text={t('discoverDemoData')} />
        </View>
        <View style={[st.search, { borderColor: c.border, backgroundColor: c.cardSoft, flexDirection: row }]}>
          <Feather name="search" size={18} color={c.secondary} />
          <TextInput testID="discover-search" value={query} onChangeText={setQuery} placeholder={t('discoverSearchPlaceholder')} placeholderTextColor={c.muted}
            style={[st.input, { color: c.text, fontFamily: font(), textAlign: align, writingDirection: rtl ? 'rtl' : 'ltr' }]} accessibilityLabel={t('discoverSearch')} />
          {query ? <Pressable onPress={() => setQuery('')} hitSlop={8} accessibilityLabel={t('discoverClearSearch')}><Feather name="x" size={16} color={c.secondary} /></Pressable> : null}
        </View>
        <View style={{ paddingHorizontal: 14, marginBottom: 12 }}><Segments prefix="dfilter" items={filters} value={filter} onChange={setFilter} /></View>

        {filter === 'live' ? (
          <EmptyState icon="radio" title={t('discoverLiveTitle')} body={t('discoverLiveBody')} />
        ) : filter === 'nearby' ? (
          <EmptyState icon="map-pin" title={t('discoverNearbyTitle')} body={t('discoverNearbyBody')} />
        ) : (
          <>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ flexDirection: row, paddingHorizontal: 10, gap: 4, paddingBottom: 12 }}>
              <FlagChip label={t('discoverAll')} on={chip === 'all'} onPress={() => setChip('all')} />
              {COUNTRIES.map((x) => <FlagChip key={x.id} flag={x.flag} label={t(countryLabelKey(x))} on={chip === x.id} onPress={() => setChip(chip === x.id ? 'all' : x.id)} />)}
            </ScrollView>
            {!featured ? (
              <EmptyState icon="compass" title={t('discoverNoMatches')} body={t('discoverNoMatchesBody').replace('{query}', query)} />
            ) : (
              <View style={{ paddingHorizontal: 12, gap: 8 }}>
                <FeaturedCountry country={featured} onPress={() => setOpenId(featured.id)} />
                {rows.map((r, i) => (
                  <View key={i} style={{ flexDirection: row, gap: 8 }}>
                    {r.map((x) => <CountryCard key={x.id} country={x} onPress={() => setOpenId(x.id)} />)}
                    {r.length === 1 ? <View style={{ flex: 1 }} /> : null}
                  </View>
                ))}
                <Text style={[st.note, { color: c.muted, fontFamily: font() }]}>{t('discoverCountsNote')}</Text>
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
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, paddingHorizontal: 16, marginBottom: 10 },
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
