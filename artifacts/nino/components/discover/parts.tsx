import { Feather } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useColors } from '@/hooks/useColors';
import { useI18n } from '@/lib/i18n';
import { countryLabelKey } from './data';
import type { DiscoverCountry, DiscoverMedia, DiscoverPerson } from './data';

export function DemoPill({ text }: { text: string }) {
  const c = useColors();
  const { font, rtl } = useI18n();
  return (
    <View style={[s.demo, { borderColor: c.border, backgroundColor: c.accentWash, alignSelf: rtl ? 'flex-end' : 'flex-start' }]}>
      <Text style={[s.demoText, { color: c.accent, fontFamily: font('semibold'), textAlign: 'center' }]}>{text}</Text>
    </View>
  );
}

export function Segments<T extends string>({ items, value, onChange, prefix }: { items: { key: T; label: string }[]; value: T; onChange: (k: T) => void; prefix: string }) {
  const c = useColors();
  const { font, row } = useI18n();
  return (
    <View style={[s.segs, { flexDirection: row }]}>
      {items.map((it) => {
        const on = it.key === value;
        return (
          <Pressable key={it.key} testID={`${prefix}-${it.key}`} onPress={() => onChange(it.key)} accessibilityRole="tab" accessibilityState={{ selected: on }}
            style={[s.seg, on && { backgroundColor: c.accent }]}>
            <Text style={[s.segText, { color: on ? c.onAccent : c.secondary, fontFamily: font('medium'), textAlign: 'center' }]}>{it.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function FlagChip({ flag, label, on, onPress }: { flag?: string; label: string; on: boolean; onPress: () => void }) {
  const c = useColors();
  const { font } = useI18n();
  return (
    <Pressable testID={`chip-${label}`} onPress={onPress} accessibilityRole="button" accessibilityState={{ selected: on }} style={s.chip}>
      <View style={[s.chipCircle, { borderColor: on ? c.accent : c.border, backgroundColor: c.card }]}>
        {flag ? <Text style={{ fontSize: 26 }}>{flag}</Text> : <Feather name="globe" size={24} color={c.accent} />}
      </View>
      <Text style={[s.chipLabel, { color: on ? c.accent : c.text, fontFamily: font('medium'), textAlign: 'center' }]}>{label}</Text>
    </Pressable>
  );
}

export function FeaturedCountry({ country, onPress }: { country: DiscoverCountry; onPress: () => void }) {
  const c = useColors();
  const { t, font, row, align, rtl, lang } = useI18n();
  const name = t(countryLabelKey(country));
  return (
    <Pressable testID={`featured-${country.id}`} onPress={onPress} accessibilityRole="button" accessibilityLabel={t('discoverExploreCountry').replace('{country}', name)} style={[s.hero, { borderColor: c.border }]}>
      <Image source={country.image} style={StyleSheet.absoluteFill} contentFit="cover" />
      <LinearGradient colors={['transparent', 'rgba(12,12,14,0.9)']} locations={[0.4, 1]} style={StyleSheet.absoluteFill} />
      <View style={[s.heroBody, { flexDirection: row }]}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={[s.heroTitle, { fontFamily: font('bold'), textAlign: align }]}>{country.flag} {name}</Text>
          <Text style={[s.heroSub, { fontFamily: font(), textAlign: align }]}>{country.tagline}</Text>
          <Text style={[s.heroMeta, { color: c.accent, fontFamily: font('medium'), textAlign: align }]}>{t('discoverSampleMembers').replace('{count}', country.sampleMembers.toLocaleString(lang))}</Text>
        </View>
        <View style={[s.explore, { flexDirection: row }]}><Text style={[s.exploreText, { fontFamily: font('semibold'), flexShrink: 1 }]}>{t('discoverExplore')}</Text><Feather name={rtl ? 'chevron-left' : 'chevron-right'} size={16} color="#0B1A1F" /></View>
      </View>
    </Pressable>
  );
}

export function CountryCard({ country, onPress }: { country: DiscoverCountry; onPress: () => void }) {
  const c = useColors();
  const { t, font, row, align, lang } = useI18n();
  const name = t(countryLabelKey(country));
  return (
    <Pressable testID={`country-${country.id}`} onPress={onPress} accessibilityRole="button" accessibilityLabel={t('discoverOpenCountry').replace('{country}', name)} style={[s.card, { borderColor: c.border }]}>
      <Image source={country.image} style={StyleSheet.absoluteFill} contentFit="cover" />
      <LinearGradient colors={['rgba(12,12,14,0.75)', 'transparent']} locations={[0, 0.6]} style={StyleSheet.absoluteFill} />
      <View style={[s.cardHead, { flexDirection: row }]}>
        <Text style={{ fontSize: 20 }}>{country.flag}</Text>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={[s.cardTitle, { fontFamily: font('semibold'), textAlign: align }]}>{name}</Text>
          <Text style={[s.cardMeta, { fontFamily: font(), textAlign: align }]}>{t('discoverSampleCount').replace('{count}', country.sampleMembers.toLocaleString(lang))}</Text>
        </View>
      </View>
    </Pressable>
  );
}

export function PersonCircle({ person, onPress }: { person: DiscoverPerson; onPress?: () => void }) {
  const c = useColors();
  const { font } = useI18n();
  const initials = person.name.slice(0, 2).toUpperCase();
  return (
    <Pressable testID={`person-${person.id}`} onPress={onPress} disabled={!onPress} accessibilityRole="button" accessibilityLabel={person.name} style={s.person}>
      <View style={[s.personRing, { borderColor: onPress ? c.accent : c.border }]}>
        {person.image ? <Image source={person.image} style={s.personImg} contentFit="cover" /> :
          <View style={[s.personImg, { backgroundColor: c.card, alignItems: 'center', justifyContent: 'center' }]}>
            <Text style={{ color: c.accent, fontFamily: font('semibold'), fontSize: 20 }}>{initials}</Text>
          </View>}
      </View>
      <Text style={[s.personName, { color: c.text, fontFamily: font('semibold') }]} numberOfLines={1}>{person.name}</Text>
      <Text style={[s.personCity, { color: c.secondary, fontFamily: font() }]} numberOfLines={1}>{person.city}</Text>
    </Pressable>
  );
}

export function MediaTile({ item, flag, onPress }: { item: DiscoverMedia; flag: string; onPress: () => void }) {
  const c = useColors();
  const { t, font, row, align, rtl } = useI18n();
  return (
    <Pressable testID={`media-${item.id}`} onPress={onPress} accessibilityRole="button" accessibilityLabel={t(item.kind === 'video' ? 'discoverPlay' : 'discoverView').replace('{title}', item.title)} style={[s.tile, { borderColor: c.border }]}>
      <Image source={item.image} style={StyleSheet.absoluteFill} contentFit="cover" />
      <LinearGradient colors={['transparent', 'rgba(12,12,14,0.88)']} locations={[0.5, 1]} style={StyleSheet.absoluteFill} />
      <View style={[s.tileBadge, { flexDirection: row, right: rtl ? undefined : 8, left: rtl ? 8 : undefined }]}>
        <Feather name={item.kind === 'video' ? 'play' : 'image'} size={11} color="#FFF" />
        <Text style={[s.tileBadgeText, { fontFamily: font('medium') }]}>{t(item.kind === 'video' ? 'discoverVideo' : 'discoverPhoto')}</Text>
      </View>
      <View style={s.tileFoot}>
        <Text style={[s.tileTitle, { fontFamily: font('semibold'), textAlign: align }]} numberOfLines={1}>{item.title}</Text>
        <Text style={[s.tileMeta, { fontFamily: font(), textAlign: align }]} numberOfLines={1}>{flag} {item.place === 'Sample clip' ? t('discoverSampleClip') : item.place}</Text>
      </View>
    </Pressable>
  );
}

export function EmptyState({ icon, title, body }: { icon: keyof typeof Feather.glyphMap; title: string; body: string }) {
  const c = useColors();
  const { font, rtl } = useI18n();
  return (
    <View style={s.empty}>
      <View style={[s.emptyIcon, { borderColor: c.border, backgroundColor: c.accentWash }]}><Feather name={icon} size={26} color={c.accent} /></View>
      <Text style={[s.emptyTitle, { color: c.text, fontFamily: font('semibold'), writingDirection: rtl ? 'rtl' : 'ltr' }]}>{title}</Text>
      <Text style={[s.emptyBody, { color: c.secondary, fontFamily: font(), writingDirection: rtl ? 'rtl' : 'ltr' }]}>{body}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  demo: { alignSelf: 'flex-start', maxWidth: '100%', borderWidth: 1, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3, minHeight: 22, justifyContent: 'center', flexShrink: 1 },
  demoText: { fontFamily: 'Poppins_600SemiBold', fontSize: 10, letterSpacing: 0.5 },
  segs: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 4 },
  seg: { paddingHorizontal: 10, paddingVertical: 6, minHeight: 32, maxWidth: '100%', borderRadius: 999, justifyContent: 'center' },
  segText: { fontFamily: 'Poppins_500Medium', fontSize: 14 },
  chip: { alignItems: 'center', width: 64, gap: 4 },
  chipCircle: { width: 52, height: 52, borderRadius: 26, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  chipLabel: { fontFamily: 'Poppins_500Medium', fontSize: 11 },
  hero: { minHeight: 200, justifyContent: 'flex-end', borderRadius: 16, overflow: 'hidden', borderWidth: 1 },
  heroBody: { paddingHorizontal: 14, paddingTop: 36, paddingBottom: 12, flexDirection: 'row', alignItems: 'flex-end', gap: 10 },
  heroTitle: { color: '#FFF', fontFamily: 'Poppins_700Bold', fontSize: 26 },
  heroSub: { color: '#FFFFFF', fontFamily: 'Poppins_400Regular', fontSize: 13 },
  heroMeta: { fontFamily: 'Poppins_500Medium', fontSize: 12 },
  explore: { flexDirection: 'row', maxWidth: '45%', alignItems: 'center', gap: 4, backgroundColor: '#F2FEFF', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8, minHeight: 38 },
  exploreText: { color: '#0E0E10', fontFamily: 'Poppins_600SemiBold', fontSize: 14 },
  card: { flex: 1, minHeight: 120, borderRadius: 12, overflow: 'hidden', borderWidth: 1 },
  cardHead: { flexDirection: 'row', gap: 8, padding: 10, alignItems: 'center' },
  cardTitle: { color: '#FFF', fontFamily: 'Poppins_600SemiBold', fontSize: 14 },
  cardMeta: { color: 'rgba(255,255,255,0.82)', fontFamily: 'Poppins_400Regular', fontSize: 11 },
  person: { width: 76, alignItems: 'center' },
  personRing: { width: 70, height: 70, borderRadius: 35, borderWidth: 2, padding: 3 },
  personImg: { width: 60, height: 60, borderRadius: 30 },
  personName: { fontFamily: 'Poppins_600SemiBold', fontSize: 12, marginTop: 4 },
  personCity: { fontFamily: 'Poppins_400Regular', fontSize: 10 },
  tile: { flex: 1, height: 210, borderRadius: 12, overflow: 'hidden', borderWidth: 1 },
  tileBadge: { position: 'absolute', top: 8, right: 8, maxWidth: '90%', flexDirection: 'row', gap: 4, alignItems: 'center', backgroundColor: 'rgba(12,12,14,0.72)', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3, minHeight: 22 },
  tileBadgeText: { color: '#FFF', fontFamily: 'Poppins_500Medium', fontSize: 10 },
  tileFoot: { position: 'absolute', left: 10, right: 10, bottom: 10 },
  tileTitle: { color: '#FFF', fontFamily: 'Poppins_600SemiBold', fontSize: 13 },
  tileMeta: { color: 'rgba(255,255,255,0.82)', fontFamily: 'Poppins_400Regular', fontSize: 11 },
  empty: { alignItems: 'center', paddingVertical: 40, paddingHorizontal: 28, gap: 10 },
  emptyIcon: { width: 60, height: 60, borderRadius: 30, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { fontFamily: 'Poppins_600SemiBold', fontSize: 16, textAlign: 'center' },
  emptyBody: { fontFamily: 'Poppins_400Regular', fontSize: 13, lineHeight: 20, textAlign: 'center' },
});
