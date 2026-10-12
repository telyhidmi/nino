import { Feather } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { LocalVideo } from '@/components/video/LocalVideo';
import { PublishedVideo } from '@/components/PublishedVideo';
import React, { useEffect, useState } from 'react';
import { Alert, ImageSourcePropType, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { EarthGlobe } from '@/components/EarthGlobe';
import { useInsets } from '@/components/ui';
import { useColors } from '@/hooks/useColors';
import { compact } from '@/components/feed/data';
import { usePostCopy } from '@/lib/postTranslations';
import { resetProfileTab, type ProfileTabState } from '@/lib/profileTabReset';
import type { ProfileTabKey } from '@/lib/profileTabReset';
export type { ProfileTabKey } from '@/lib/profileTabReset';
import { LANGS, useI18n } from '@/lib/i18n';

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
  published?: boolean;
  tag?: string;
};
export type FollowedCreator = { id: string; name: string; handle: string; flag: string; image: ImageSourcePropType };
export type ProfileTab = { items: ProfileItem[]; emptyTitle: string; emptyBody: string };

export function confirmAction(title: string, body: string, action: string, onYes: () => void, cancelLabel: string) {
  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined' && window.confirm(`${title}\n\n${body}`)) onYes();
    return;
  }
  Alert.alert(title, body, [{ text: cancelLabel, style: 'cancel' }, { text: action, style: 'destructive', onPress: onYes }]);
}

// Close the profile modal before navigating, so it cannot cover the language selector.
export function ProfileLanguageButton({ onNavigate }: { onNavigate: () => void }) {
  const c = useColors();
  const { t, lang, font, row, align, rtl } = useI18n();
  return (
    <Pressable testID="language-pill" accessibilityRole="button" onPress={() => {
      onNavigate();
      router.push('/language?from=switch');
    }} style={{ flexDirection: row, gap: 10, alignItems: 'center', minHeight: 44, paddingVertical: 8 }}>
      <Feather name="globe" size={18} color={c.accent} />
      <Text style={{ color: c.text, fontFamily: font('medium'), fontSize: 14, textAlign: align, flex: 1 }}>
        {t('appLanguage')} · {LANGS.find((language) => language.code === lang)?.native}
      </Text>
      <Feather name={rtl ? 'chevron-left' : 'chevron-right'} size={18} color={c.secondary} />
    </Pressable>
  );
}

function Initials({ name, size }: { name: string; size: number }) {
  const c = useColors();
  const { font } = useI18n();
  const i = name.trim().split(/\s+/).map((p) => p[0]).slice(0, 2).join('').toUpperCase();
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: c.card, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ color: c.accent, fontFamily: font('semibold'), fontSize: size * 0.36 }}>{i || '?'}</Text>
    </View>
  );
}

export function ProfileView(props: {
  name: string; handle?: string; imageUrl?: string | null; imageSource?: ImageSourcePropType; flag?: string; countryCode?: string;
  badge?: string; speaks?: string; understands?: string[]; bio: string;
  stats: { following: number | null; followers: number | null; likes: number | null };
  statsNote?: string;
  tabs: Record<ProfileTabKey, ProfileTab>;
  following: FollowedCreator[]; followingEmpty: string;
  onUnfollow?: (id: string) => void;
  onEdit?: () => void; onShare: () => void; onMenu?: () => void; onBack?: () => void;
  onFollow?: () => void; isFollowing?: boolean; postsOnly?: boolean; onOpenItem?: (item: ProfileItem) => void;
  onAdd?: () => void; addLabel?: string; uploadNote?: string;
  onRemove?: (item: ProfileItem) => void | Promise<void>;
  postsStatus?: React.ReactNode;
  removing?: boolean;
  postsResetToken?: number;
  removalError?: string | null;
  topInset?: boolean; bottomPad?: number; testID?: string; active?: boolean;
}) {
  const c = useColors();
  const copy = usePostCopy();
  const ins = useInsets();
  const { t, font, row, align, rtl } = useI18n();
  const s = profileStyles(font, row, align, rtl);
  const { width: windowWidth } = useWindowDimensions();
  const [gridWidth, setGridWidth] = useState(0);
  const tileWidth = Math.max(1, ((gridWidth || windowWidth) - 4) / 3);
  const [tabState, setTabState] = useState<ProfileTabState>({ tab: 'posts', resetToken: props.postsResetToken });
  const nextTabState = resetProfileTab(tabState, props.postsResetToken);
  // Reset during render so a retained/hidden profile never flashes the old tab.
  if (nextTabState !== tabState) setTabState(nextTabState);
  const tab = nextTabState.tab;
  const setTab = (tab: ProfileTabKey) => setTabState({ tab, resetToken: props.postsResetToken });
  const [showFollowing, setShowFollowing] = useState(false);
  const [openItem, setOpenItem] = useState<ProfileItem | null>(null);
  useEffect(() => {
    if (!props.active && props.active !== undefined) { setShowFollowing(false); setOpenItem(null); }
  }, [props.active]);
  const current = props.tabs[tab];
  const icons: Record<ProfileTabKey, keyof typeof Feather.glyphMap> = { posts: 'grid', private: 'lock', reposts: 'repeat', liked: 'heart' };
  const tabLabels: Record<ProfileTabKey, string> = { posts: t('profilePosts'), private: t('profilePrivate'), reposts: t('profileReposts'), liked: t('profileLiked') };
  const fmt = (n: number | null) => (n === null ? '—' : compact(n));

  return (
    <View testID={props.testID} style={{ flex: 1, backgroundColor: c.bgTop }}>
      <ScrollView contentContainerStyle={{ paddingTop: ins.top, paddingBottom: (props.bottomPad ?? ins.bottom) + 24 }} showsVerticalScrollIndicator={false}>
        <View style={s.top}>
          {props.onBack ? (
            <Pressable testID="profile-back" onPress={props.onBack} accessibilityRole="button" accessibilityLabel={t('profileBack')} style={s.iconBtn}>
              <Feather name={rtl ? 'chevron-right' : 'chevron-left'} size={24} color={c.text} />
            </Pressable>
          ) : (
            <View style={[s.brand]} accessibilityLabel="Nino"><Text style={s.brandText}>Nin</Text><EarthGlobe size={18} /></View>
          )}
          <Text style={[s.handleTop, { color: c.text }]} numberOfLines={1}>{props.handle ? `@${props.handle}` : ""}</Text>
          {props.onMenu ? (
            <Pressable testID="profile-menu" onPress={props.onMenu} accessibilityRole="button" accessibilityLabel={t('profileMenu')} style={[s.iconBtn, { backgroundColor: c.cardSoft, borderColor: c.border }]}>
              <Feather name="menu" size={20} color={c.text} />
            </Pressable>
          ) : <View style={{ width: 44 }} />}
        </View>

        <View style={{ alignItems: 'center', marginTop: 0 }}>
          <View style={[s.ring, { borderColor: c.accent, shadowColor: c.accent }]}>
             {props.imageUrl || props.imageSource ? <Image source={props.imageUrl ? { uri: props.imageUrl } : props.imageSource} style={{ width: 88, height: 88, borderRadius: 44 }} contentFit="cover" accessibilityLabel={t(props.imageSource ? 'profileSamplePhoto' : 'profilePhoto')} /> : <Initials name={props.name} size={88} />}
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
          <Text style={[s.small, { color: c.secondary, marginTop: 2 }]}>{props.handle ? `@${props.handle}` : ""}</Text>
          {props.speaks ? (
            <View style={[s.langs, { backgroundColor: c.cardSoft, borderColor: c.border }]}>
              <Feather name="mic" size={12} color={c.accent} />
              <Text style={[s.small, { color: c.text }]}>{props.speaks}</Text>
              {props.understands?.length ? <><View style={[s.dot, { backgroundColor: c.muted }]} /><Feather name="headphones" size={12} color={c.accent} /><Text style={[s.small, { color: c.text, flexShrink: 1 }]}>{props.understands.join(rtl ? '، ' : ', ')}</Text></> : null}
            </View>
          ) : null}
        </View>

        <View style={s.stats}>
          <Pressable testID="open-following" disabled={props.stats.following === null} onPress={() => setShowFollowing(true)} accessibilityRole="button" accessibilityLabel={props.stats.following === null ? t('profileFollowingUnavailable') : t('profileFollowingList').replace('{count}', String(props.stats.following))} style={s.stat}>
            <Text style={[s.statNum, { color: c.text }]}>{fmt(props.stats.following)}</Text>
            <Text style={[s.statLabel, { color: c.accent }]}>{t('profileFollowing')}</Text>
          </Pressable>
          <View style={[s.sep, { backgroundColor: c.border }]} />
          <View style={s.stat}><Text style={[s.statNum, { color: c.text }]}>{fmt(props.stats.followers)}</Text><Text style={[s.statLabel, { color: c.secondary }]}>{t('profileFollowers')}</Text></View>
          <View style={[s.sep, { backgroundColor: c.border }]} />
          <View style={s.stat}><Text style={[s.statNum, { color: c.text }]}>{fmt(props.stats.likes)}</Text><Text style={[s.statLabel, { color: c.secondary }]}>{t('profileLikes')}</Text></View>
        </View>
        {props.statsNote ? <Text style={[s.note, { color: c.muted }]}>{props.statsNote}</Text> : null}

        <View style={s.actions}>
          {props.onFollow ? (
            <Pressable testID="creator-follow" onPress={props.onFollow} accessibilityRole="button" accessibilityLabel={t(props.isFollowing ? 'profileUnfollowName' : 'profileFollowName').replace('{name}', props.name)} style={[s.action, { backgroundColor: props.isFollowing ? c.card : c.accent, borderColor: props.isFollowing ? c.border : c.accent }]}>
              <Text style={[s.actionText, { color: props.isFollowing ? c.text : c.onAccent, textAlign: 'center' }]}>{t(props.isFollowing ? 'profileFollowing' : 'profileFollow')}</Text>
            </Pressable>
          ) : null}
          {props.onEdit ? (
            <Pressable testID="edit-profile" onPress={props.onEdit} accessibilityRole="button" style={[s.action, { backgroundColor: c.card, borderColor: c.border }]}>
              <Text style={[s.actionText, { color: c.text, textAlign: 'center' }]}>{t('profileEdit')}</Text>
            </Pressable>
          ) : null}
          <Pressable testID="share-profile" onPress={props.onShare} accessibilityRole="button" style={[s.action, { backgroundColor: c.card, borderColor: c.border }]}>
            <Text style={[s.actionText, { color: c.text, textAlign: 'center' }]}>{t('profileShare')}</Text>
          </Pressable>
          {props.onAdd ? (
            <Pressable testID="profile-add-upload" onPress={props.onAdd} accessibilityRole="button" accessibilityLabel={props.addLabel ?? t('profileAddUpload')} style={[s.square, { borderColor: c.accent, backgroundColor: c.accentWash }]}>
              <Feather name="upload" size={18} color={c.accent} />
            </Pressable>
          ) : null}
        </View>

        <Text numberOfLines={2} style={[s.bio, { color: c.text }]}>{props.bio}</Text>
        {props.uploadNote ? (
          <View style={s.notice}>
            <Feather name="info" size={12} color={c.accent} />
            <Text style={[s.small, { color: c.secondary, flexShrink: 1, fontSize: 11 }]}>{props.uploadNote}</Text>
          </View>
        ) : null}

        <View style={[s.tabs, { borderBottomColor: c.border }]}>
          {(props.postsOnly ? ['posts'] as ProfileTabKey[] : Object.keys(icons) as ProfileTabKey[]).map((k) => (
            <Pressable key={k} testID={`profile-tab-${k}`} onPress={() => setTab(k)} accessibilityRole="tab" accessibilityLabel={tabLabels[k]} accessibilityState={{ selected: tab === k }} style={s.tab}>
              <Feather name={icons[k]} size={20} color={tab === k ? c.text : c.muted} />
              <View style={[s.tabBar, { backgroundColor: tab === k ? c.accent : 'transparent' }]} />
            </Pressable>
          ))}
        </View>
        {tab === 'posts' ? props.postsStatus : null}

        {current.items.length === 0 ? (
          <View style={s.empty}>
            <Feather name={icons[tab]} size={30} color={c.accent} />
            <Text style={[s.emptyTitle, { color: c.text }]}>{current.emptyTitle}</Text>
            <Text style={[s.emptyBody, { color: c.secondary }]}>{current.emptyBody}</Text>
          </View>
        ) : (
          <View style={s.grid} onLayout={({ nativeEvent }) => {
            if (nativeEvent.layout.width > 0) setGridWidth(nativeEvent.layout.width);
          }}>
            {current.items.map((it) => (
              <Pressable key={it.id} testID={`tile-${it.id}`} onPress={() => props.onOpenItem ? props.onOpenItem(it) : setOpenItem(it)} accessibilityRole="button" accessibilityLabel={t('profileOpen').replace('{name}', it.label)} style={[s.tile, { width: tileWidth, height: tileWidth / 0.72 }]}>
                {it.image ? <Image source={it.image} style={StyleSheet.absoluteFill} contentFit="cover" /> : <View style={[StyleSheet.absoluteFill, { backgroundColor: c.card, alignItems: 'center', justifyContent: 'center' }]}><Feather name="film" size={24} color={c.accent} /></View>}
                <View style={s.tileTop}>
                  {it.pinned ? <View style={[s.chip, { backgroundColor: c.danger }]}><Text style={s.chipText}>{t('profilePinned')}</Text></View> : null}
                   <View style={[s.chip, { backgroundColor: 'rgba(12,12,14,0.78)' }]}><Text style={s.chipText}>{it.local ? t('profileLocalTag') : !it.tag || it.tag === 'SAMPLE' ? t('profileSample') : it.tag}</Text></View>
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
        <Pressable style={[StyleSheet.absoluteFill, { backgroundColor: c.overlay }]} onPress={() => setShowFollowing(false)} accessibilityLabel={t('profileClose')} />
        <View testID="following-list" style={[s.sheet, { backgroundColor: c.card, borderColor: c.border, paddingBottom: ins.bottom + 16 }]}>
          <View style={s.sheetHead}>
            <Text style={[s.sheetTitle, { color: c.text }]}>{t('profileFollowing')} · {props.following.length}</Text>
            <Pressable testID="following-close" onPress={() => setShowFollowing(false)} accessibilityRole="button" accessibilityLabel={t('profileClose')} style={s.iconBtn}><Feather name="x" size={20} color={c.secondary} /></Pressable>
          </View>
          <ScrollView style={{ maxHeight: 420 }}>
            {props.following.length === 0 ? (
              <View style={s.empty}><Feather name="users" size={28} color={c.accent} /><Text style={[s.emptyBody, { color: c.secondary }]}>{props.followingEmpty}</Text></View>
            ) : props.following.map((f) => (
              <View key={f.id} style={[s.followRow, { borderTopColor: c.border }]}>
                <Image source={f.image} style={{ width: 48, height: 48, borderRadius: 24 }} contentFit="cover" contentPosition={{ top: '32%', left: '50%' }} />
                <View style={{ flex: 1 }}>
                  <Text style={[s.actionText, { color: c.text }]} numberOfLines={1}>{f.flag} {f.name}</Text>
                  <Text style={[s.small, { color: c.secondary }]}>@{f.handle} · {t('profileSampleCreator')}</Text>
                </View>
                {props.onUnfollow ? (
                  <Pressable testID={`unfollow-${f.id}`} onPress={() => props.onUnfollow?.(f.id)} accessibilityRole="button" accessibilityLabel={t('profileUnfollowName').replace('{name}', f.name)} style={[s.unfollow, { borderColor: c.border }]}>
                    <Text style={[s.small, { color: c.text, fontFamily: font('semibold'), textAlign: 'center' }]}>{t('profileUnfollow')}</Text>
                  </Pressable>
                ) : null}
              </View>
            ))}
          </ScrollView>
        </View>
      </Modal>

       <MediaViewer item={props.active === false ? null : openItem} removing={props.removing} removalError={props.removalError} onClose={() => { if (!props.removing) setOpenItem(null); }} onRemove={props.onRemove && (openItem?.local || openItem?.published) ? () => {
        if (props.removing) return;
        const it = openItem;
         confirmAction(it.published ? copy.deleteTitle : t('profileRemoveTitle'), it.published ? copy.deleteBody : t('profileRemoveBody'), copy.delete, () => {
           Promise.resolve(props.onRemove?.(it)).then(() => setOpenItem(null)).catch(() => undefined);
         }, t('profileCancel'));
      } : undefined} />
    </View>
  );
}

function VideoPlayer({ source }: { source: number | { uri: string } }) {
  return <LocalVideo source={source} />;
}

function MediaViewer({ item, onClose, onRemove, removing, removalError }: { item: ProfileItem | null; onClose: () => void; onRemove?: () => void; removing?: boolean; removalError?: string | null }) {
  const c = useColors();
  const copy = usePostCopy();
  const ins = useInsets();
  const { t, font, row, align, rtl } = useI18n();
  const s = profileStyles(font, row, align, rtl);
  return (
    <Modal visible={!!item} animationType="fade" onRequestClose={onClose}>
      <View testID="media-viewer" style={{ flex: 1, backgroundColor: '#0A0A0B' }}>
        {item ? (item.kind === 'video' && item.video
          ? item.published && typeof item.video === 'object'
            ? <PublishedVideo key={item.id} uri={item.video.uri} active muted={false} contentFit="cover" />
            : <VideoPlayer source={item.video} />
          : item.image ? <Image source={item.image} style={StyleSheet.absoluteFill} contentFit="contain" /> : null) : null}
        <View style={[s.viewerTop, { top: ins.top + 6 }]}>
          <Pressable testID="media-close" onPress={onClose} accessibilityRole="button" accessibilityLabel={t('profileClose')} style={[s.iconBtn, { backgroundColor: 'rgba(12,12,14,0.7)' }]}><Feather name="x" size={22} color={c.text} /></Pressable>
          {onRemove ? (
            <Pressable testID="media-remove" onPress={onRemove} disabled={removing} accessibilityRole="button" accessibilityLabel={removing ? copy.deleting : copy.delete} style={[s.iconBtn, { backgroundColor: c.dangerWash, opacity: removing ? 0.4 : 1 }]}><Feather name="trash-2" size={20} color={c.danger} /></Pressable>
          ) : null}
        </View>
        {item ? (
          <View style={[s.viewerCap, { bottom: ins.bottom + 90, borderColor: c.border }]} pointerEvents="none">
             <Text style={[s.badgeText, { color: c.accent }]}>{item.published ? copy.published : t(item.local ? 'profileLocalViewer' : 'profileSampleViewer')}</Text>
             {removalError ? <Text testID="post-delete-error" accessibilityLiveRegion="polite" style={[s.small, { color: c.danger }]}>{removalError}</Text> : null}
            <Text style={[s.actionText, { color: c.text }]}>{item.label}</Text>
            {item.caption ? <Text style={[s.small, { color: c.secondary }]}>{item.caption}</Text> : null}
          </View>
        ) : null}
      </View>
    </Modal>
  );
}

function profileStyles(font: ReturnType<typeof useI18n>['font'], row: 'row' | 'row-reverse', align: 'left' | 'right', rtl: boolean) {
  return StyleSheet.create({
  top: { flexDirection: row, alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, minHeight: 48 },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 2, width: 44 },
  brandText: { color: '#FFFFFF', fontFamily: 'Poppins_700Bold', fontSize: 14 },
  handleTop: { flex: 1, textAlign: 'center', writingDirection: 'ltr', fontFamily: font('bold'), fontSize: 17, marginHorizontal: 8 },
  iconBtn: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', borderWidth: 0 },
  ring: { width: 96, height: 96, borderRadius: 48, borderWidth: 2, alignItems: 'center', justifyContent: 'center', shadowOpacity: 0, shadowRadius: 0, shadowOffset: { width: 0, height: 0 } },
  flagPill: { flexDirection: row, alignItems: 'center', gap: 4, paddingHorizontal: 8, minHeight: 20, borderRadius: 999, borderWidth: 1, marginTop: -12 },
  nameRow: { flexDirection: row, flexWrap: 'wrap', justifyContent: 'center', alignItems: 'center', gap: 8, marginTop: 4, paddingHorizontal: 20 },
  name: { fontFamily: font('bold'), fontSize: 21, flexShrink: 1 },
  badge: { paddingHorizontal: 8, paddingVertical: 2, minHeight: 22, maxWidth: '100%', borderRadius: 6, borderWidth: 1, justifyContent: 'center' },
  badgeText: { fontFamily: font('semibold'), fontSize: 10, textAlign: align, letterSpacing: rtl ? 0 : 0.6 },
  small: { fontFamily: font(), fontSize: 12, textAlign: align },
  langs: { flexDirection: row, flexWrap: 'wrap', justifyContent: 'center', alignItems: 'center', gap: 6, marginTop: 6, paddingHorizontal: 12, paddingVertical: 4, minHeight: 28, borderRadius: 999, borderWidth: 1, maxWidth: '90%' },
  dot: { width: 3, height: 3, borderRadius: 2 },
  stats: { flexDirection: row, alignItems: 'center', marginTop: 8, paddingHorizontal: 20 },
  stat: { flex: 1, alignItems: 'center', minHeight: 44, justifyContent: 'center' },
  statNum: { fontFamily: font('bold'), fontSize: 18 },
  statLabel: { fontFamily: font('medium'), fontSize: 12, textAlign: 'center' },
  sep: { width: 1, height: 26 },
  note: { fontFamily: font(), fontSize: 11, textAlign: 'center', marginTop: 0, paddingHorizontal: 24 },
  actions: { flexDirection: row, gap: 8, paddingHorizontal: 14, marginTop: 10 },
  action: { flex: 1, minHeight: 44, paddingHorizontal: 8, paddingVertical: 8, borderRadius: 12, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  actionText: { fontFamily: font('semibold'), fontSize: 14, textAlign: align },
  square: { width: 44, height: 44, borderRadius: 22, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  bio: { fontFamily: font(), fontSize: 13, lineHeight: rtl ? 25 : 19, textAlign: 'center', paddingHorizontal: 24, marginTop: 8 },
  notice: { flexDirection: row, gap: 6, alignItems: 'center', justifyContent: 'center', marginHorizontal: 14, marginTop: 6 },
  tabs: { flexDirection: row, marginTop: 8, borderBottomWidth: 1 },
  tab: { flex: 1, minHeight: 48, alignItems: 'center', justifyContent: 'flex-end', gap: 8 },
  tabBar: { height: 3, width: 40, borderRadius: 2 },
  grid: { flexDirection: row, flexWrap: 'wrap', gap: 2, paddingTop: 2 },
  tile: { overflow: 'hidden', flexGrow: 0, flexShrink: 0 },
  tileTop: { position: 'absolute', top: 5, left: 5, right: 5, gap: 3, alignItems: rtl ? 'flex-end' : 'flex-start' },
  tileBottom: { position: 'absolute', bottom: 6, start: 6, flexDirection: row, alignItems: 'center', gap: 4 },
  chip: { paddingHorizontal: 5, paddingVertical: 2, minHeight: 17, maxWidth: '100%', borderRadius: 4, justifyContent: 'center' },
  chipText: { color: '#FFF', fontFamily: font('semibold'), fontSize: 9, textAlign: align, letterSpacing: rtl ? 0 : 0.3 },
  empty: { alignItems: 'center', gap: 10, paddingVertical: 36, paddingHorizontal: 36 },
  emptyTitle: { fontFamily: font('semibold'), fontSize: 16, textAlign: 'center' },
  emptyBody: { fontFamily: font(), fontSize: 13, lineHeight: rtl ? 26 : 20, textAlign: 'center' },
  sheet: { position: 'absolute', left: 0, right: 0, bottom: 0, borderTopLeftRadius: 24, borderTopRightRadius: 24, borderWidth: 1, paddingHorizontal: 16, paddingTop: 10 },
  sheetHead: { flexDirection: row, alignItems: 'center', justifyContent: 'space-between' },
  sheetTitle: { fontFamily: font('bold'), fontSize: 17, textAlign: align, flexShrink: 1 },
  followRow: { flexDirection: row, alignItems: 'center', gap: 12, paddingVertical: 10, borderTopWidth: 1 },
  unfollow: { minHeight: 44, maxWidth: '38%', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  viewerTop: { position: 'absolute', left: 14, right: 14, flexDirection: row, justifyContent: 'space-between' },
  viewerCap: { position: 'absolute', left: 14, right: 14, gap: 4, padding: 12, borderRadius: 14, borderWidth: 1, backgroundColor: 'rgba(12,12,14,0.8)' },
  });
}
