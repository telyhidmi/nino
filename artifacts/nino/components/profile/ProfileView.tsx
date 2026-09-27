import { Feather } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useVideoPlayer, VideoView } from 'expo-video';
import React, { useEffect, useState } from 'react';
import { Alert, ImageSourcePropType, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { EarthGlobe } from '@/components/EarthGlobe';
import { useInsets } from '@/components/ui';
import { useColors } from '@/hooks/useColors';
import { compact } from '@/components/feed/data';

export type ProfileItem = {
  id: string;
  kind: 'photo' | 'video';
  image?: ImageSourcePropType;
  video?: number | { uri: string };
  label: string;
  caption?: string;
  views?: number;
  pinned?: boolean;
  local?: boolean;
  tag?: string;
};
export type FollowedCreator = { id: string; name: string; handle: string; flag: string; image: ImageSourcePropType };
export type ProfileTabKey = 'posts' | 'private' | 'reposts' | 'liked';
export type ProfileTab = { items: ProfileItem[]; emptyTitle: string; emptyBody: string };

export function confirmAction(title: string, body: string, action: string, onYes: () => void) {
  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined' && window.confirm(`${title}\n\n${body}`)) onYes();
    return;
  }
  Alert.alert(title, body, [{ text: 'Cancel', style: 'cancel' }, { text: action, style: 'destructive', onPress: onYes }]);
}

function Initials({ name, size }: { name: string; size: number }) {
  const c = useColors();
  const i = name.trim().split(/\s+/).map((p) => p[0]).slice(0, 2).join('').toUpperCase();
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: c.card, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ color: c.accent, fontFamily: 'Poppins_600SemiBold', fontSize: size * 0.36 }}>{i || '?'}</Text>
    </View>
  );
}

export function ProfileView(props: {
  name: string; handle: string; imageUrl?: string | null; flag?: string; countryCode?: string;
  badge?: string; speaks?: string; understands?: string[]; bio: string;
  stats: { following: number; followers: number | null; likes: number | null };
  statsNote?: string;
  tabs: Record<ProfileTabKey, ProfileTab>;
  following: FollowedCreator[]; followingEmpty: string;
  onUnfollow?: (id: string) => void;
  onEdit?: () => void; onShare: () => void; onMenu?: () => void; onBack?: () => void;
  onAdd?: () => void; addLabel?: string; uploadNote?: string;
  onRemove?: (item: ProfileItem) => void;
  topInset?: boolean; bottomPad?: number; testID?: string; active?: boolean;
}) {
  const c = useColors();
  const ins = useInsets();
  const [tab, setTab] = useState<ProfileTabKey>('posts');
  const [showFollowing, setShowFollowing] = useState(false);
  const [openItem, setOpenItem] = useState<ProfileItem | null>(null);
  useEffect(() => {
    if (!props.active && props.active !== undefined) { setShowFollowing(false); setOpenItem(null); }
  }, [props.active]);
  const current = props.tabs[tab];
  const icons: Record<ProfileTabKey, keyof typeof Feather.glyphMap> = { posts: 'grid', private: 'lock', reposts: 'repeat', liked: 'heart' };
  const fmt = (n: number | null) => (n === null ? '—' : compact(n));

  return (
    <View testID={props.testID} style={{ flex: 1, backgroundColor: c.bgTop }}>
      <ScrollView contentContainerStyle={{ paddingTop: ins.top, paddingBottom: (props.bottomPad ?? ins.bottom) + 24 }} showsVerticalScrollIndicator={false}>
        <View style={s.top}>
          {props.onBack ? (
            <Pressable testID="profile-back" onPress={props.onBack} accessibilityRole="button" accessibilityLabel="Back" style={s.iconBtn}>
              <Feather name="chevron-left" size={24} color={c.text} />
            </Pressable>
          ) : (
            <View style={[s.brand]} accessibilityLabel="Nino"><Text style={s.brandText}>Nin</Text><EarthGlobe size={18} /></View>
          )}
          <Text style={[s.handleTop, { color: c.text }]} numberOfLines={1}>@{props.handle}</Text>
          {props.onMenu ? (
            <Pressable testID="profile-menu" onPress={props.onMenu} accessibilityRole="button" accessibilityLabel="Profile menu" style={[s.iconBtn, { backgroundColor: c.cardSoft, borderColor: c.border }]}>
              <Feather name="menu" size={20} color={c.text} />
            </Pressable>
          ) : <View style={{ width: 44 }} />}
        </View>

        <View style={{ alignItems: 'center', marginTop: 0 }}>
          <View style={[s.ring, { borderColor: c.accent, shadowColor: c.accent }]}>
            {props.imageUrl ? <Image source={{ uri: props.imageUrl }} style={{ width: 88, height: 88, borderRadius: 44 }} contentFit="cover" accessibilityLabel="Profile photo" /> : <Initials name={props.name} size={88} />}
          </View>
          {props.flag ? (
            <View style={[s.flagPill, { backgroundColor: c.card, borderColor: c.border }]}>
              <Text style={{ fontSize: 11 }}>{props.flag}</Text>
              {props.countryCode ? <Text style={[s.small, { color: c.text }]}>{props.countryCode}</Text> : null}
            </View>
          ) : null}
          <View style={s.nameRow}>
            <Text style={[s.name, { color: c.text }]} numberOfLines={1}>{props.name}</Text>
            {props.badge ? <View style={[s.badge, { backgroundColor: c.accentWash, borderColor: c.border }]}><Text style={[s.badgeText, { color: c.accent }]}>{props.badge}</Text></View> : null}
          </View>
          <Text style={[s.small, { color: c.secondary, marginTop: 2 }]}>@{props.handle}</Text>
          {props.speaks ? (
            <View style={[s.langs, { backgroundColor: c.cardSoft, borderColor: c.border }]}>
              <Feather name="mic" size={12} color={c.accent} />
              <Text style={[s.small, { color: c.text }]}>{props.speaks}</Text>
              {props.understands?.length ? <><View style={[s.dot, { backgroundColor: c.muted }]} /><Feather name="headphones" size={12} color={c.accent} /><Text style={[s.small, { color: c.text, flexShrink: 1 }]} numberOfLines={1}>{props.understands.join(', ')}</Text></> : null}
            </View>
          ) : null}
        </View>

        <View style={s.stats}>
          <Pressable testID="open-following" onPress={() => setShowFollowing(true)} accessibilityRole="button" accessibilityLabel={`Following ${props.stats.following}. Show list`} style={s.stat}>
            <Text style={[s.statNum, { color: c.text }]}>{fmt(props.stats.following)}</Text>
            <Text style={[s.statLabel, { color: c.accent }]}>Following</Text>
          </Pressable>
          <View style={[s.sep, { backgroundColor: c.border }]} />
          <View style={s.stat}><Text style={[s.statNum, { color: c.text }]}>{fmt(props.stats.followers)}</Text><Text style={[s.statLabel, { color: c.secondary }]}>Followers</Text></View>
          <View style={[s.sep, { backgroundColor: c.border }]} />
          <View style={s.stat}><Text style={[s.statNum, { color: c.text }]}>{fmt(props.stats.likes)}</Text><Text style={[s.statLabel, { color: c.secondary }]}>Likes</Text></View>
        </View>
        {props.statsNote ? <Text numberOfLines={1} style={[s.note, { color: c.muted }]}>{props.statsNote}</Text> : null}

        <View style={s.actions}>
          {props.onEdit ? (
            <Pressable testID="edit-profile" onPress={props.onEdit} accessibilityRole="button" style={[s.action, { backgroundColor: c.card, borderColor: c.border }]}>
              <Text style={[s.actionText, { color: c.text }]}>Edit Profile</Text>
            </Pressable>
          ) : null}
          <Pressable testID="share-profile" onPress={props.onShare} accessibilityRole="button" style={[s.action, { backgroundColor: c.card, borderColor: c.border }]}>
            <Text style={[s.actionText, { color: c.text }]}>Share Profile</Text>
          </Pressable>
          {props.onAdd ? (
            <Pressable testID="profile-add-upload" onPress={props.onAdd} accessibilityRole="button" accessibilityLabel={props.addLabel ?? 'Add upload'} style={[s.square, { borderColor: c.accent, backgroundColor: c.accentWash }]}>
              <Feather name="upload" size={18} color={c.accent} />
            </Pressable>
          ) : null}
        </View>

        <Text numberOfLines={2} style={[s.bio, { color: c.text }]}>{props.bio}</Text>
        {props.uploadNote ? (
          <View style={s.notice}>
            <Feather name="info" size={12} color={c.accent} />
            <Text numberOfLines={1} style={[s.small, { color: c.secondary, flexShrink: 1, fontSize: 11 }]}>{props.uploadNote}</Text>
          </View>
        ) : null}

        <View style={[s.tabs, { borderBottomColor: c.border }]}>
          {(Object.keys(icons) as ProfileTabKey[]).map((k) => (
            <Pressable key={k} testID={`profile-tab-${k}`} onPress={() => setTab(k)} accessibilityRole="tab" accessibilityLabel={k} accessibilityState={{ selected: tab === k }} style={s.tab}>
              <Feather name={icons[k]} size={20} color={tab === k ? c.text : c.muted} />
              <View style={[s.tabBar, { backgroundColor: tab === k ? c.accent : 'transparent' }]} />
            </Pressable>
          ))}
        </View>

        {current.items.length === 0 ? (
          <View style={s.empty}>
            <Feather name={icons[tab]} size={30} color={c.accent} />
            <Text style={[s.emptyTitle, { color: c.text }]}>{current.emptyTitle}</Text>
            <Text style={[s.emptyBody, { color: c.secondary }]}>{current.emptyBody}</Text>
          </View>
        ) : (
          <View style={s.grid}>
            {current.items.map((it) => (
              <Pressable key={it.id} testID={`tile-${it.id}`} onPress={() => setOpenItem(it)} accessibilityRole="button" accessibilityLabel={`Open ${it.label}`} style={s.tile}>
                {it.image ? <Image source={it.image} style={StyleSheet.absoluteFill} contentFit="cover" /> : <View style={[StyleSheet.absoluteFill, { backgroundColor: c.card, alignItems: 'center', justifyContent: 'center' }]}><Feather name="film" size={24} color={c.accent} /></View>}
                <View style={s.tileTop}>
                  {it.pinned ? <View style={[s.chip, { backgroundColor: c.danger }]}><Text style={s.chipText}>PINNED</Text></View> : null}
                  <View style={[s.chip, { backgroundColor: 'rgba(8,20,24,0.78)' }]}><Text style={s.chipText}>{it.local ? 'THIS SESSION' : it.tag ?? 'SAMPLE'}</Text></View>
                </View>
                <View style={s.tileBottom}>
                  <Feather name={it.kind === 'video' ? 'play' : 'image'} size={11} color="#FFF" />
                  {it.views !== undefined ? <Text style={s.chipText}>{compact(it.views)}</Text> : null}
                </View>
              </Pressable>
            ))}
          </View>
        )}
      </ScrollView>

      <Modal visible={props.active !== false && showFollowing} animationType="slide" transparent onRequestClose={() => setShowFollowing(false)}>
        <Pressable style={[StyleSheet.absoluteFill, { backgroundColor: c.overlay }]} onPress={() => setShowFollowing(false)} accessibilityLabel="Close" />
        <View testID="following-list" style={[s.sheet, { backgroundColor: c.card, borderColor: c.border, paddingBottom: ins.bottom + 16 }]}>
          <View style={s.sheetHead}>
            <Text style={[s.sheetTitle, { color: c.text }]}>Following · {props.following.length}</Text>
            <Pressable testID="following-close" onPress={() => setShowFollowing(false)} accessibilityRole="button" accessibilityLabel="Close" style={s.iconBtn}><Feather name="x" size={20} color={c.secondary} /></Pressable>
          </View>
          <ScrollView style={{ maxHeight: 420 }}>
            {props.following.length === 0 ? (
              <View style={s.empty}><Feather name="users" size={28} color={c.accent} /><Text style={[s.emptyBody, { color: c.secondary }]}>{props.followingEmpty}</Text></View>
            ) : props.following.map((f) => (
              <View key={f.id} style={[s.followRow, { borderTopColor: c.border }]}>
                <Image source={f.image} style={{ width: 48, height: 48, borderRadius: 24 }} contentFit="cover" contentPosition={{ top: '32%', left: '50%' }} />
                <View style={{ flex: 1 }}>
                  <Text style={[s.actionText, { color: c.text }]} numberOfLines={1}>{f.flag} {f.name}</Text>
                  <Text style={[s.small, { color: c.secondary }]}>@{f.handle} · sample creator</Text>
                </View>
                {props.onUnfollow ? (
                  <Pressable testID={`unfollow-${f.id}`} onPress={() => props.onUnfollow?.(f.id)} accessibilityRole="button" accessibilityLabel={`Unfollow ${f.name}`} style={[s.unfollow, { borderColor: c.border }]}>
                    <Text style={[s.small, { color: c.text, fontFamily: 'Poppins_600SemiBold' }]}>Unfollow</Text>
                  </Pressable>
                ) : null}
              </View>
            ))}
          </ScrollView>
        </View>
      </Modal>

      <MediaViewer item={props.active === false ? null : openItem} onClose={() => setOpenItem(null)} onRemove={props.onRemove && openItem?.local ? () => {
        const it = openItem;
        confirmAction('Remove this upload?', 'It only exists in this session and will be removed from your demo profile.', 'Remove', () => { props.onRemove?.(it); setOpenItem(null); });
      } : undefined} />
    </View>
  );
}

function VideoPlayer({ source }: { source: number | { uri: string } }) {
  const player = useVideoPlayer(source, (p) => { p.loop = true; p.muted = false; p.play(); });
  return <VideoView player={player} style={StyleSheet.absoluteFill} contentFit="contain" nativeControls />;
}

function MediaViewer({ item, onClose, onRemove }: { item: ProfileItem | null; onClose: () => void; onRemove?: () => void }) {
  const c = useColors();
  const ins = useInsets();
  return (
    <Modal visible={!!item} animationType="fade" onRequestClose={onClose}>
      <View testID="media-viewer" style={{ flex: 1, backgroundColor: '#050E11' }}>
        {item ? (item.kind === 'video' && item.video ? <VideoPlayer source={item.video} /> : item.image ? <Image source={item.image} style={StyleSheet.absoluteFill} contentFit="contain" /> : null) : null}
        <View style={[s.viewerTop, { top: ins.top + 6 }]}>
          <Pressable testID="media-close" onPress={onClose} accessibilityRole="button" accessibilityLabel="Close" style={[s.iconBtn, { backgroundColor: 'rgba(8,20,24,0.7)' }]}><Feather name="x" size={22} color={c.text} /></Pressable>
          {onRemove ? (
            <Pressable testID="media-remove" onPress={onRemove} accessibilityRole="button" accessibilityLabel="Remove upload" style={[s.iconBtn, { backgroundColor: c.dangerWash }]}><Feather name="trash-2" size={20} color={c.danger} /></Pressable>
          ) : null}
        </View>
        {item ? (
          <View style={[s.viewerCap, { bottom: ins.bottom + 90, borderColor: c.border }]} pointerEvents="none">
            <Text style={[s.badgeText, { color: c.accent }]}>{item.local ? 'LOCAL · THIS SESSION ONLY · NOT PUBLISHED' : 'SAMPLE UPLOAD · DEMO'}</Text>
            <Text style={[s.actionText, { color: c.text }]}>{item.label}</Text>
            {item.caption ? <Text style={[s.small, { color: c.secondary }]}>{item.caption}</Text> : null}
          </View>
        ) : null}
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, minHeight: 48 },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 2, width: 44 },
  brandText: { color: '#E9FEFF', fontFamily: 'Poppins_700Bold', fontSize: 14 },
  handleTop: { flex: 1, textAlign: 'center', fontFamily: 'Poppins_700Bold', fontSize: 17, marginHorizontal: 8 },
  iconBtn: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', borderWidth: 0 },
  ring: { width: 96, height: 96, borderRadius: 48, borderWidth: 3, alignItems: 'center', justifyContent: 'center', shadowOpacity: 0.5, shadowRadius: 16, shadowOffset: { width: 0, height: 0 } },
  flagPill: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, height: 20, borderRadius: 999, borderWidth: 1, marginTop: -12 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4, paddingHorizontal: 20 },
  name: { fontFamily: 'Poppins_700Bold', fontSize: 21, flexShrink: 1 },
  badge: { paddingHorizontal: 8, height: 22, borderRadius: 6, borderWidth: 1, justifyContent: 'center' },
  badgeText: { fontFamily: 'Poppins_600SemiBold', fontSize: 10, letterSpacing: 0.6 },
  small: { fontFamily: 'Poppins_400Regular', fontSize: 12 },
  langs: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6, paddingHorizontal: 12, height: 28, borderRadius: 999, borderWidth: 1, maxWidth: '90%' },
  dot: { width: 3, height: 3, borderRadius: 2 },
  stats: { flexDirection: 'row', alignItems: 'center', marginTop: 8, paddingHorizontal: 20 },
  stat: { flex: 1, alignItems: 'center', minHeight: 44, justifyContent: 'center' },
  statNum: { fontFamily: 'Poppins_700Bold', fontSize: 18, lineHeight: 22 },
  statLabel: { fontFamily: 'Poppins_500Medium', fontSize: 12, lineHeight: 16 },
  sep: { width: 1, height: 26 },
  note: { fontFamily: 'Poppins_400Regular', fontSize: 11, textAlign: 'center', marginTop: 0, paddingHorizontal: 24 },
  actions: { flexDirection: 'row', gap: 8, paddingHorizontal: 14, marginTop: 10 },
  action: { flex: 1, height: 44, borderRadius: 12, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  actionText: { fontFamily: 'Poppins_600SemiBold', fontSize: 14 },
  square: { width: 44, height: 44, borderRadius: 22, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  bio: { fontFamily: 'Poppins_400Regular', fontSize: 13, lineHeight: 19, textAlign: 'center', paddingHorizontal: 24, marginTop: 8 },
  notice: { flexDirection: 'row', gap: 6, alignItems: 'center', justifyContent: 'center', marginHorizontal: 14, marginTop: 6 },
  tabs: { flexDirection: 'row', marginTop: 8, borderBottomWidth: 1 },
  tab: { flex: 1, minHeight: 48, alignItems: 'center', justifyContent: 'flex-end', gap: 8 },
  tabBar: { height: 3, width: 40, borderRadius: 2 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 2, paddingTop: 2 },
  tile: { width: '33%', aspectRatio: 0.72, overflow: 'hidden', flexGrow: 1, maxWidth: '33.2%' },
  tileTop: { position: 'absolute', top: 5, left: 5, gap: 3, alignItems: 'flex-start' },
  tileBottom: { position: 'absolute', bottom: 6, left: 6, flexDirection: 'row', alignItems: 'center', gap: 4 },
  chip: { paddingHorizontal: 5, height: 17, borderRadius: 4, justifyContent: 'center' },
  chipText: { color: '#FFF', fontFamily: 'Poppins_600SemiBold', fontSize: 9, letterSpacing: 0.3 },
  empty: { alignItems: 'center', gap: 10, paddingVertical: 36, paddingHorizontal: 36 },
  emptyTitle: { fontFamily: 'Poppins_600SemiBold', fontSize: 16, textAlign: 'center' },
  emptyBody: { fontFamily: 'Poppins_400Regular', fontSize: 13, lineHeight: 20, textAlign: 'center' },
  sheet: { position: 'absolute', left: 0, right: 0, bottom: 0, borderTopLeftRadius: 24, borderTopRightRadius: 24, borderWidth: 1, paddingHorizontal: 16, paddingTop: 10 },
  sheetHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sheetTitle: { fontFamily: 'Poppins_700Bold', fontSize: 17 },
  followRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, borderTopWidth: 1 },
  unfollow: { minHeight: 44, paddingHorizontal: 14, borderRadius: 12, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  viewerTop: { position: 'absolute', left: 14, right: 14, flexDirection: 'row', justifyContent: 'space-between' },
  viewerCap: { position: 'absolute', left: 14, right: 14, gap: 4, padding: 12, borderRadius: 14, borderWidth: 1, backgroundColor: 'rgba(8,20,24,0.8)' },
});
