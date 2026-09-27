import { Feather } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useMemo, useState } from 'react';
import { FlatList, Pressable, Share, StyleSheet, Text, TextInput, View } from 'react-native';
import { EarthGlobe } from '@/components/EarthGlobe';
import { useInsets } from '@/components/ui';
import { useColors } from '@/hooks/useColors';
import { compact, FEED_IMAGE, SampleComment, SAMPLE_POSTS, SamplePost } from './data';
import { CommentsSheet, PreviewTag, Sheet, SoonSheet, TranslateSheet } from './Sheets';

type Tab = 'foryou' | 'following';
type Open = null | 'comments' | 'translate' | 'search' | 'create' | 'messages' | 'more';

export type FeedViewer = { name?: string; imageUrl?: string | null } | null;

function Initials({ name, size }: { name?: string; size: number }) {
  const c = useColors();
  const i = (name ?? '').trim().split(/\s+/).map((p) => p[0]).slice(0, 2).join('').toUpperCase();
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: c.card, alignItems: 'center', justifyContent: 'center' }}>
      {i ? <Text style={{ color: c.accent, fontFamily: 'Poppins_600SemiBold', fontSize: size * 0.38 }}>{i}</Text> : <Feather name="user" size={size * 0.5} color={c.secondary} />}
    </View>
  );
}

function RailButton({ icon, label, onPress, active, testID, a11y }: { icon: keyof typeof Feather.glyphMap; label?: string; onPress: () => void; active?: boolean; testID: string; a11y: string }) {
  const c = useColors();
  return (
    <Pressable testID={testID} onPress={onPress} accessibilityRole="button" accessibilityLabel={a11y} accessibilityState={{ selected: !!active }} style={st.railItem}>
      <View style={[st.railCircle, { borderColor: active ? c.accent : 'rgba(255,255,255,0.12)' }]}>
        <Feather name={icon} size={22} color={active ? c.danger : c.text} />
      </View>
      {label ? <Text style={st.railLabel}>{label}</Text> : null}
    </Pressable>
  );
}

function PostView({ post, height, onOpen, viewerComments }: { post: SamplePost; height: number; onOpen: (o: Open) => void; viewerComments: number }) {
  const c = useColors();
  const [liked, setLiked] = useState(false);
  const [following, setFollowing] = useState(post.following);
  const [translated, setTranslated] = useState(false);
  const share = () => {
    Share.share({ message: `${post.author} on Nino (preview): ${post.translation}` }).catch(() => undefined);
  };
  return (
    <View style={{ height, width: '100%' }}>
      <Image source={FEED_IMAGE} style={StyleSheet.absoluteFill} contentFit="cover" accessibilityLabel={`${post.author} in ${post.location}`} />
      <LinearGradient colors={['rgba(6,18,22,0.55)', 'transparent', 'transparent', 'rgba(6,18,22,0.92)']} locations={[0, 0.22, 0.5, 1]} style={StyleSheet.absoluteFill} pointerEvents="none" />

      <View style={st.rail}>
        <Pressable testID="rail-follow" onPress={() => setFollowing((f) => !f)} accessibilityRole="button" accessibilityLabel={following ? `Unfollow ${post.author}` : `Follow ${post.author}`} style={st.railItem}>
          <View style={[st.railAvatar, { borderColor: c.accent }]}>
            <Image source={FEED_IMAGE} style={{ width: 50, height: 50, borderRadius: 25 }} contentFit="cover" contentPosition={{ top: '32%', left: '50%' }} />
          </View>
          <View style={[st.plus, { backgroundColor: following ? c.accent : c.danger }]}>
            <Feather name={following ? 'check' : 'plus'} size={12} color={following ? c.onAccent : '#FFF'} />
          </View>
        </Pressable>
        <RailButton testID="rail-like" icon="heart" active={liked} a11y={liked ? 'Unlike' : 'Like'} label={compact(post.likes + (liked ? 1 : 0))} onPress={() => setLiked((l) => !l)} />
        <RailButton testID="rail-comments" icon="message-square" a11y="Comments" label={compact(post.commentCount + viewerComments)} onPress={() => onOpen('comments')} />
        <RailButton testID="rail-share" icon="corner-up-left" a11y="Share" label={compact(post.shares)} onPress={share} />
        <RailButton testID="rail-more" icon="more-horizontal" a11y="More options" onPress={() => onOpen('more')} />
        <View style={[st.disc, { borderColor: c.accent }]}><View style={[st.discDot, { backgroundColor: c.bgTop }]} /></View>
      </View>

      <View style={st.caption}>
        <View style={st.authorRow}>
          <View style={st.cc}><Text style={{ fontSize: 11 }}>{post.flag}</Text><Text style={st.ccText}>{post.countryCode}</Text></View>
          <Text style={st.author} numberOfLines={1}>{post.author}</Text>
          <Pressable testID="caption-follow" onPress={() => setFollowing((f) => !f)} accessibilityRole="button" accessibilityLabel={following ? 'Following' : 'Follow'} hitSlop={8}
            style={[st.follow, { borderColor: c.accent, backgroundColor: following ? c.accent : 'rgba(31,224,232,0.12)' }]}>
            <Text style={{ color: following ? c.onAccent : c.accent, fontFamily: 'Poppins_600SemiBold', fontSize: 12 }}>{following ? 'Following' : 'Follow'}</Text>
          </Pressable>
        </View>
        <View style={st.row6}><Feather name="map-pin" size={13} color={c.danger} /><Text style={[st.loc, { color: c.accent }]}>{post.location}</Text></View>
        <Text style={st.captionText}>{translated ? post.translation : post.caption}</Text>
        <Pressable testID="toggle-translation" onPress={() => setTranslated((t) => !t)} accessibilityRole="button" accessibilityLabel={translated ? 'See original' : 'See translation'} style={[st.row6, { minHeight: 32 }]}>
          <Feather name="type" size={14} color={c.accent} />
          <Text style={{ color: c.accent, fontFamily: 'Poppins_600SemiBold', fontSize: 13 }}>{translated ? 'See original' : 'See translation'}</Text>
        </Pressable>
        <View style={st.music}>
          <Feather name="music" size={13} color={c.accent} />
          <Text style={st.musicText} numberOfLines={1}>{post.music}</Text>
        </View>
      </View>
    </View>
  );
}

export function FeedScreen({ viewer, onProfile, preview }: { viewer: FeedViewer; onProfile: () => void; preview?: boolean }) {
  const c = useColors();
  const ins = useInsets();
  const [tab, setTab] = useState<Tab>('foryou');
  const [open, setOpen] = useState<Open>(null);
  const [h, setH] = useState(0);
  const [index, setIndex] = useState(0);
  const [query, setQuery] = useState('');
  const [local, setLocal] = useState<Record<string, SampleComment[]>>({});

  const posts = useMemo(() => (tab === 'following' ? SAMPLE_POSTS.filter((p) => p.following) : SAMPLE_POSTS), [tab]);
  const current = posts[Math.min(index, posts.length - 1)] ?? SAMPLE_POSTS[0];
  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    return SAMPLE_POSTS.filter((p) => !q || [p.author, p.location, p.caption, p.translation, ...p.tags].join(' ').toLowerCase().includes(q));
  }, [query]);

  const addComment = (text: string) => setLocal((m) => ({ ...m, [current.id]: [...(m[current.id] ?? []), { id: `me-${Date.now()}`, author: viewer?.name ? `${viewer.name} (you)` : 'You', flag: '💬', text }] }));

  const NAV_H = 64;
  return (
    <View style={{ flex: 1, backgroundColor: c.bgTop }}>
      <View style={{ flex: 1 }} onLayout={(e) => setH(e.nativeEvent.layout.height)}>
        {h > 0 ? (
          <FlatList
            key={tab}
            data={posts}
            keyExtractor={(p) => p.id}
            pagingEnabled
            showsVerticalScrollIndicator={false}
            getItemLayout={(_, i) => ({ length: h, offset: h * i, index: i })}
            onMomentumScrollEnd={(e) => setIndex(Math.round(e.nativeEvent.contentOffset.y / h))}
            renderItem={({ item }) => <PostView post={item} height={h} onOpen={setOpen} viewerComments={(local[item.id] ?? []).length} />}
          />
        ) : null}

        <View style={[st.top, { top: ins.top }]} pointerEvents="box-none">
          <View style={st.brand} accessibilityLabel="Nino">
            <Text style={st.brandText}>Nin</Text>
            <EarthGlobe size={20} />
          </View>
          <View style={st.tabs}>
            {(['foryou', 'following'] as Tab[]).map((k) => {
              const on = tab === k;
              return (
                <Pressable key={k} testID={`tab-${k}`} onPress={() => { setTab(k); setIndex(0); }} accessibilityRole="tab" accessibilityState={{ selected: on }} style={st.tab}>
                  <Text style={[st.tabText, { color: on ? c.text : 'rgba(255,255,255,0.65)' }]}>{k === 'foryou' ? 'For You' : 'Following'}</Text>
                  <View style={[st.tabBar, { backgroundColor: on ? c.accent : 'transparent' }]} />
                </Pressable>
              );
            })}
          </View>
          <Pressable testID="open-search" onPress={() => setOpen('search')} accessibilityRole="button" accessibilityLabel="Search posts" style={st.searchBtn}>
            <Feather name="search" size={20} color={c.text} />
          </Pressable>
        </View>
        <View style={[st.badgeRow, { top: ins.top + 52 }]} pointerEvents="none">
          <View style={[st.badge, { borderColor: c.border }]}>
            <View style={[st.liveDot, { backgroundColor: c.accent }]} />
            <Text style={st.badgeText}>{current.langPair} LIVE FEED</Text>
          </View>
          <View style={[st.badge, { borderColor: 'rgba(255,255,255,0.12)' }]}>
            <Text style={[st.badgeText, { color: c.secondary }]}>{preview ? 'PREVIEW' : 'SAMPLE'}</Text>
          </View>
        </View>

        <Pressable testID="translate-bar" onPress={() => setOpen('translate')} accessibilityRole="button" accessibilityLabel="Translate with Nino"
          style={[st.tbar, { borderColor: c.borderStrong, bottom: 10 }]}>
          <EarthGlobe size={26} />
          <Text style={st.tbarText}>Translate with Nino</Text>
          <View style={[st.ai, { borderColor: c.border }]}><Text style={{ color: c.accent, fontFamily: 'Poppins_600SemiBold', fontSize: 11, letterSpacing: 0.5 }}>PREVIEW</Text></View>
          <Feather name="chevron-right" size={18} color={c.accent} />
        </Pressable>
      </View>

      <View style={[st.nav, { height: NAV_H + ins.bottom, paddingBottom: ins.bottom, borderTopColor: 'rgba(31,224,232,0.12)' }]}>
        <NavItem testID="nav-home" icon="home" label="Home" active onPress={() => setTab('foryou')} />
        <NavItem testID="nav-discover" icon="globe" label="Discover" onPress={() => setOpen('search')} />
        <Pressable testID="nav-create" onPress={() => setOpen('create')} accessibilityRole="button" accessibilityLabel="Create post" style={st.navItem}>
          <View style={[st.create, { borderColor: c.accent }]}><Feather name="plus" size={26} color={c.text} /></View>
        </Pressable>
        <NavItem testID="nav-messages" icon="message-square" label="Messages" onPress={() => setOpen('messages')} />
        <Pressable testID="nav-profile" onPress={onProfile} accessibilityRole="button" accessibilityLabel="Profile" style={st.navItem}>
          <View style={[st.navAv, { borderColor: c.border }]}>
            {viewer?.imageUrl ? <Image source={{ uri: viewer.imageUrl }} style={{ width: 26, height: 26, borderRadius: 13 }} /> : <Initials name={viewer?.name} size={26} />}
          </View>
          <Text style={[st.navLabel, { color: c.secondary }]}>Profile</Text>
        </Pressable>
      </View>

      <CommentsSheet post={current} visible={open === 'comments'} onClose={() => setOpen(null)} extra={local[current.id] ?? []} onAdd={addComment} />
      <TranslateSheet key={current.id} post={current} visible={open === 'translate'} onClose={() => setOpen(null)} />
      <SoonSheet visible={open === 'create'} onClose={() => setOpen(null)} icon="video" title="Create" body="Posting stories with built-in subtitles in every language is on its way. Nothing is uploaded from this preview." />
      <SoonSheet visible={open === 'messages'} onClose={() => setOpen(null)} icon="message-circle" title="Messages" body="Chat across languages with auto-translated messages is coming soon. There are no messages yet." />
      <SoonSheet visible={open === 'more'} onClose={() => setOpen(null)} icon="sliders" title="More options" body="Save, report and 'not interested' controls arrive with the live feed. This post is curated sample content." />
      <Sheet visible={open === 'search'} onClose={() => setOpen(null)} title="Discover" testID="search-sheet">
        <PreviewTag text="Browsing curated sample posts" />
        <View style={[st.searchInput, { borderColor: c.border, backgroundColor: c.cardSoft }]}>
          <Feather name="search" size={16} color={c.secondary} />
          <TextInput testID="search-input" value={query} onChangeText={setQuery} placeholder="Places, people, cultures" placeholderTextColor={c.muted}
            style={{ flex: 1, color: c.text, fontFamily: 'Poppins_400Regular', fontSize: 14, minHeight: 44 }} accessibilityLabel="Search" />
        </View>
        {results.length === 0 ? (
          <View style={{ alignItems: 'center', paddingVertical: 24, gap: 6 }}>
            <Feather name="compass" size={24} color={c.muted} />
            <Text style={{ color: c.secondary, fontFamily: 'Poppins_400Regular', fontSize: 13 }}>No sample posts match "{query}"</Text>
          </View>
        ) : results.map((p) => (
          <Pressable key={p.id} testID={`result-${p.id}`} accessibilityRole="button" accessibilityLabel={`Open ${p.location}`}
            onPress={() => { setTab('foryou'); setIndex(0); setOpen(null); }}
            style={[st.result, { borderColor: c.border }]}>
            <Image source={FEED_IMAGE} style={{ width: 52, height: 68, borderRadius: 10 }} contentFit="cover" />
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={{ color: c.text, fontFamily: 'Poppins_600SemiBold', fontSize: 14 }}>{p.flag} {p.location}</Text>
              <Text style={{ color: c.secondary, fontFamily: 'Poppins_400Regular', fontSize: 12 }} numberOfLines={2}>{p.translation}</Text>
            </View>
          </Pressable>
        ))}
      </Sheet>
    </View>
  );
}

function NavItem({ icon, label, active, onPress, testID }: { icon: keyof typeof Feather.glyphMap; label: string; active?: boolean; onPress: () => void; testID: string }) {
  const c = useColors();
  return (
    <Pressable testID={testID} onPress={onPress} accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ selected: !!active }} style={st.navItem}>
      <Feather name={icon} size={22} color={active ? c.accent : c.secondary} />
      <Text style={[st.navLabel, { color: active ? c.accent : c.secondary }]}>{label}</Text>
    </Pressable>
  );
}

const st = StyleSheet.create({
  top: { position: 'absolute', left: 0, right: 0, height: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14 },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 2, width: 64 },
  brandText: { color: '#E9FEFF', fontFamily: 'Poppins_700Bold', fontSize: 15 },
  tabs: { flexDirection: 'row', gap: 6 },
  tab: { minHeight: 44, paddingHorizontal: 8, alignItems: 'center', justifyContent: 'center' },
  tabText: { fontFamily: 'Poppins_600SemiBold', fontSize: 17 },
  tabBar: { height: 3, width: 26, borderRadius: 2, marginTop: 2 },
  searchBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(8,20,24,0.55)', alignItems: 'center', justifyContent: 'center', marginLeft: 20 },
  badgeRow: { position: 'absolute', left: 16, flexDirection: 'row', gap: 6 },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, height: 26, borderRadius: 999, backgroundColor: 'rgba(8,20,24,0.72)', borderWidth: 1 },
  liveDot: { width: 7, height: 7, borderRadius: 4 },
  badgeText: { color: '#E9FEFF', fontFamily: 'Poppins_600SemiBold', fontSize: 11, letterSpacing: 0.4 },
  rail: { position: 'absolute', right: 10, bottom: 150, alignItems: 'center', gap: 10 },
  railItem: { alignItems: 'center', minWidth: 52, minHeight: 44 },
  railCircle: { width: 50, height: 50, borderRadius: 25, backgroundColor: 'rgba(8,20,24,0.6)', alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  railLabel: { color: '#FFF', fontFamily: 'Poppins_600SemiBold', fontSize: 12, marginTop: 3, textShadowColor: 'rgba(0,0,0,0.6)', textShadowRadius: 4 },
  railAvatar: { width: 56, height: 56, borderRadius: 28, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  plus: { width: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginTop: -10 },
  disc: { width: 40, height: 40, borderRadius: 20, borderWidth: 9, backgroundColor: '#0FB5BE', alignItems: 'center', justifyContent: 'center', marginTop: 4 },
  discDot: { width: 8, height: 8, borderRadius: 4 },
  caption: { position: 'absolute', left: 16, right: 84, bottom: 74, gap: 6 },
  authorRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  cc: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, height: 22, borderRadius: 6, backgroundColor: 'rgba(8,20,24,0.7)' },
  ccText: { color: '#E9FEFF', fontFamily: 'Poppins_600SemiBold', fontSize: 11 },
  author: { color: '#FFF', fontFamily: 'Poppins_700Bold', fontSize: 17, flexShrink: 1 },
  follow: { paddingHorizontal: 14, height: 30, borderRadius: 999, borderWidth: 1, justifyContent: 'center' },
  row6: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  loc: { fontFamily: 'Poppins_500Medium', fontSize: 13 },
  captionText: { color: '#FFF', fontFamily: 'Poppins_400Regular', fontSize: 15, lineHeight: 22, textShadowColor: 'rgba(0,0,0,0.5)', textShadowRadius: 4 },
  music: { flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: 'flex-start', maxWidth: '100%', paddingHorizontal: 12, height: 30, borderRadius: 999, backgroundColor: 'rgba(8,20,24,0.7)' },
  musicText: { color: '#E9FEFF', fontFamily: 'Poppins_400Regular', fontSize: 12, flexShrink: 1 },
  tbar: { position: 'absolute', left: 14, right: 14, height: 54, borderRadius: 27, borderWidth: 1.5, backgroundColor: 'rgba(8,24,28,0.88)', flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, shadowColor: '#1FE0E8', shadowOpacity: 0.35, shadowRadius: 12, shadowOffset: { width: 0, height: 0 } },
  tbarText: { flex: 1, color: '#FFF', fontFamily: 'Poppins_600SemiBold', fontSize: 16 },
  ai: { paddingHorizontal: 10, height: 26, borderRadius: 999, borderWidth: 1, justifyContent: 'center' },
  nav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', backgroundColor: '#08161A', borderTopWidth: 1 },
  navItem: { minWidth: 56, minHeight: 48, alignItems: 'center', justifyContent: 'center', gap: 2 },
  navLabel: { fontFamily: 'Poppins_500Medium', fontSize: 11 },
  navAv: { width: 30, height: 30, borderRadius: 15, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  create: { width: 54, height: 54, borderRadius: 27, borderWidth: 2.5, backgroundColor: '#0B1A1F', alignItems: 'center', justifyContent: 'center', shadowColor: '#1FE0E8', shadowOpacity: 0.5, shadowRadius: 10, shadowOffset: { width: 0, height: 0 } },
  searchInput: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderRadius: 14, paddingHorizontal: 12, marginVertical: 12 },
  result: { flexDirection: 'row', gap: 12, alignItems: 'center', paddingVertical: 10, borderTopWidth: 1 },
});
