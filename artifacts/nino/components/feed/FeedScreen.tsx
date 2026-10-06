import { Feather } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, AppState, BackHandler, FlatList, Linking, Platform, Pressable, ScrollView, Share, StyleSheet, Text, TextInput, View } from 'react-native';
import { DiscoverScreen } from '@/components/discover/DiscoverScreen';
import { LiveList } from '@/components/LiveList';
import { useDiscoverCopy } from '@/components/discover/copy';
import { postIndexById } from '@/components/discover/publishedDiscovery';
import { EarthGlobe } from '@/components/EarthGlobe';
import { useInsets } from '@/components/ui';
import { DemoProfile } from '@/components/profile/DemoProfile';
import { CreatorProfile } from '@/components/profile/CreatorProfile';
import type { ProfileCtx } from '@/components/profile/profileCtx';
import { useColors } from '@/hooks/useColors';
import { useI18n } from '@/lib/i18n';
import { compact, SampleComment, SAMPLE_POSTS, SamplePost } from './data';
import { FeedVideo } from './FeedVideo';
import { CreatePost } from './CreatePost';
import { CommentsSheet, PreviewTag, Sheet, TranslateSheet } from './Sheets';
import { getListMyPostsQueryKey, getListPostsQueryKey, useListPosts, useListFollowingPosts, type Post } from '@workspace/api-client-react';
import { PublicProfileCard } from '@/components/search/PeopleSearch';
import { useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { getListMessagingConversationsQueryKey, useListMessagingConversations } from '@workspace/api-client-react';
import { useMessagesCopy } from '@/lib/messagesCopy';
import { PeopleSearch } from '@/components/search/PeopleSearch';
import { POLL_MS, useActive } from '@/lib/messaging';
import { usePostCopy } from '@/lib/postTranslations';
import { postError } from '@/lib/posts';
import { PublishedPost } from './PublishedPost';
import { cachePublishedPost } from '@/lib/publishedPostCache';

type FeedPost = SamplePost | Post;
const isPublished = (post: FeedPost): post is Post => 'mediaUrl' in post;

type Tab = 'foryou' | 'following' | 'live';
type Open = null | 'comments' | 'translate' | 'search' | 'create' | 'more';

export type FeedViewer = { id?: string; name?: string; imageUrl?: string | null } | null;

function Initials({ name, size }: { name?: string; size: number }) {
  const c = useColors();
  const { font } = useI18n();
  const i = (name ?? '').trim().split(/\s+/).map((p) => p[0]).slice(0, 2).join('').toUpperCase();
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: c.card, alignItems: 'center', justifyContent: 'center' }}>
      {i ? <Text style={{ color: c.accent, fontFamily: font('semibold'), fontSize: size * 0.38 }}>{i}</Text> : <Feather name="user" size={size * 0.5} color={c.secondary} />}
    </View>
  );
}

function RailButton({ icon, label, onPress, active, testID, a11y, compactLayout }: { icon: keyof typeof Feather.glyphMap; label?: string; onPress: () => void; active?: boolean; testID: string; a11y: string; compactLayout?: boolean }) {
  const c = useColors();
  const { font } = useI18n();
  return (
    <Pressable testID={testID} onPress={onPress} accessibilityRole="button" accessibilityLabel={a11y} accessibilityState={{ selected: !!active }} style={st.railItem}>
      <View style={[st.railCircle, compactLayout && st.smallRailCircle, { borderColor: active ? c.text : 'rgba(255,255,255,0.12)' }]}>
        <Feather name={icon} size={compactLayout ? 19 : 22} color={active ? c.danger : c.text} />
      </View>
      {label ? <Text style={[st.railLabel, { fontFamily: font('semibold') }]}>{label}</Text> : null}
    </Pressable>
  );
}

function PostView({ post, height, active, onOpen, onCreator, viewerComments, liked, following, onLike, onFollow }: {
  post: SamplePost; height: number; onOpen: (o: Open) => void; viewerComments: number;
  active: boolean; liked: boolean; following: boolean; onLike: () => void; onFollow: () => void; onCreator: () => void;
}) {
  const c = useColors();
  const { t, font, row, align, rtl, lang } = useI18n();
  const compactLayout = height < 600;
  const [translated, setTranslated] = useState(false);
  const share = () => {
    Share.share({ message: t('feedShareMessage').replace('{author}', post.author).replace('{caption}', post.translation) })
      .catch(() => Alert.alert(t('feedError'), t('feedShareError')));
  };
  return (
    <View style={{ height, width: '100%' }}>
      {post.video && active ? <FeedVideo post={post} active={active} /> :
        <Image source={post.image} style={StyleSheet.absoluteFill} contentFit="cover" accessibilityLabel={t('feedSamplePhoto').replace('{location}', post.location)} />}
      <LinearGradient colors={['rgba(12,12,14,0.55)', 'transparent', 'transparent', 'rgba(12,12,14,0.92)']} locations={[0, 0.22, 0.5, 1]} style={StyleSheet.absoluteFill} pointerEvents="none" />

      <View style={[st.rail, compactLayout && st.smallRail, rtl && { right: undefined, left: 10 }]}>
        <View style={st.railItem}>
          <Pressable testID="rail-author" onPress={onCreator} accessibilityRole="button" accessibilityLabel={t('feedViewProfile').replace('{author}', post.author)} style={[st.railAvatar, compactLayout && st.smallRailAvatar, { borderColor: c.accent }]}>
            <Image source={post.image} style={{ width: compactLayout ? 40 : 50, height: compactLayout ? 40 : 50, borderRadius: 25 }} contentFit="cover" contentPosition={{ top: '32%', left: '50%' }} />
          </Pressable>
          <Pressable testID="rail-follow" onPress={onFollow} accessibilityRole="button" accessibilityLabel={t(following ? 'feedUnfollowAuthor' : 'feedFollowAuthor').replace('{author}', post.author)} hitSlop={4} style={[st.plus, { backgroundColor: following ? c.accent : c.danger }]}>
            <Feather name={following ? 'check' : 'plus'} size={12} color={following ? c.onAccent : '#FFF'} />
          </Pressable>
        </View>
        <RailButton compactLayout={compactLayout} testID="rail-like" icon="heart" active={liked} a11y={t(liked ? 'feedUnlike' : 'feedLike')} label={compact(post.likes + (liked ? 1 : 0), lang)} onPress={onLike} />
        <RailButton compactLayout={compactLayout} testID="rail-comments" icon="message-square" a11y={t('feedComments')} label={compact(post.commentCount + viewerComments, lang)} onPress={() => onOpen('comments')} />
        <RailButton compactLayout={compactLayout} testID="rail-share" icon="corner-up-left" a11y={t('feedShare')} label={compact(post.shares, lang)} onPress={share} />
        <RailButton compactLayout={compactLayout} testID="rail-more" icon="more-horizontal" a11y={t('feedMore')} onPress={() => onOpen('more')} />
        <View style={[st.disc, compactLayout && st.smallDisc, { borderColor: '#2A2A2E' }]}><View style={[st.discDot, { backgroundColor: c.bgTop }]} /></View>
      </View>

      <View style={[st.caption, rtl && { left: 84, right: 16 }]}>
        <View style={[st.authorRow, { flexDirection: row, flexWrap: 'wrap' }]}>
          <View style={st.cc}><Text style={{ fontSize: 11 }}>{post.flag}</Text><Text style={st.ccText}>{post.countryCode}</Text></View>
          <Pressable testID="caption-author" onPress={onCreator} accessibilityRole="button" accessibilityLabel={t('feedViewProfile').replace('{author}', post.author)} style={{ flexShrink: 1, minHeight: 36, justifyContent: 'center' }}>
            <Text style={[st.author, { fontFamily: font('bold'), textAlign: align }]} numberOfLines={1}>{post.author}</Text>
          </Pressable>
          <Pressable testID="caption-follow" onPress={onFollow} accessibilityRole="button" accessibilityLabel={t(following ? 'feedFollowing' : 'feedFollow')} hitSlop={8}
            style={[st.follow, { borderColor: c.accent, backgroundColor: following ? c.accent : 'rgba(255,255,255,0.08)' }]}>
            <Text style={{ color: following ? c.onAccent : c.accent, fontFamily: font('semibold'), fontSize: 12 }}>{t(following ? 'feedFollowing' : 'feedFollow')}</Text>
          </Pressable>
        </View>
        <View style={[st.row6, { flexDirection: row }]}><Feather name="map-pin" size={13} color={'#FFFFFF'} /><Text style={[st.loc, { color: '#FFFFFF', fontFamily: font('medium'), textAlign: align, flexShrink: 1 }]}>{post.location}</Text></View>
        <Text style={[st.captionText, { fontFamily: font(), textAlign: align }]}>{translated ? post.translation : post.caption}</Text>
        <Pressable testID="toggle-translation" onPress={() => setTranslated((t) => !t)} accessibilityRole="button" accessibilityLabel={t(translated ? 'feedSeeOriginal' : 'feedSeeTranslation')} style={[st.row6, { minHeight: 32, flexDirection: row }]}>
          <Feather name="type" size={14} color={'#FFFFFF'} />
          <Text style={{ color: '#FFFFFF', fontFamily: font('semibold'), fontSize: 13, flexShrink: 1, textAlign: align }}>{t(translated ? 'feedSeeOriginal' : 'feedSeeTranslation')}</Text>
        </Pressable>
        <View style={[st.music, { flexDirection: row, alignSelf: rtl ? 'flex-end' : 'flex-start' }]}>
          <Feather name="music" size={13} color={'#FFFFFF'} />
          <Text style={[st.musicText, { fontFamily: font() }]} numberOfLines={1}>{post.music}</Text>
        </View>
      </View>
    </View>
  );
}

export function FeedScreen({ viewer, onProfile, preview, onExitDemo, initialSection = 'home', renderProfile }: { viewer: FeedViewer; onProfile: () => void; renderProfile?: (ctx: ProfileCtx, active: boolean, postsResetToken: number) => React.ReactNode; preview?: boolean; onExitDemo?: () => void; initialSection?: 'home' | 'discover' | 'profile' }) {
  const c = useColors();
  const copy = usePostCopy();
  const { t, font, row, align, rtl } = useI18n();
  const discoverCopy = useDiscoverCopy();
  const queryClient = useQueryClient();
  const persisted = useListPosts({ query: { queryKey: getListPostsQueryKey(), enabled: !preview, staleTime: 30_000, refetchOnMount: 'always', retry: false } });
  const ins = useInsets();
  const [tab, setTab] = useState<Tab>('foryou');
  const followingPosts = useListFollowingPosts({ query: { queryKey: ['/api/posts/following'], enabled: !preview && tab === 'following', staleTime: 0, refetchInterval: 15_000, refetchIntervalInBackground: false, retry: false } });
  const [publishedCreator, setPublishedCreator] = useState<Post | null>(null);
  const [open, setOpen] = useState<Open>(null);
  const [h, setH] = useState(0);
  const [index, setIndex] = useState(0);
  const [listStart, setListStart] = useState(0);
  const [listVersion, setListVersion] = useState(0);
  const [query, setQuery] = useState('');
  const [local, setLocal] = useState<Record<string, SampleComment[]>>({});
  const [likes, setLikes] = useState<Record<string, boolean>>({});
  const [follows, setFollows] = useState<Record<string, boolean>>({});
  const [focused, setFocused] = useState(false);
  const [foreground, setForeground] = useState(AppState.currentState === 'active');
  const [webVisible, setWebVisible] = useState(true);
  const [section, setSection] = useState<'home' | 'discover' | 'profile' | 'creator'>(initialSection);
  const [creatorHandle, setCreatorHandle] = useState<string | null>(null);
  const [postsResetToken, setPostsResetToken] = useState(0);

  useFocusEffect(useCallback(() => {
    setFocused(true);
    if (!preview) void persisted.refetch();
    return () => setFocused(false);
  }, [preview, persisted.refetch]));
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => setForeground(state === 'active'));
    return () => subscription.remove();
  }, []);
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;
    const update = () => setWebVisible(!document.hidden);
    update();
    document.addEventListener('visibilitychange', update);
    return () => document.removeEventListener('visibilitychange', update);
  }, []);
  useEffect(() => {
    if (section !== 'creator') return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => { setSection('home'); return true; });
    return () => sub.remove();
  }, [section]);

  const isFollowing = (post: SamplePost) => follows[post.handle] ?? SAMPLE_POSTS.find((p) => p.handle === post.handle)?.following ?? false;
  const allPosts: FeedPost[] = preview ? SAMPLE_POSTS : [...(persisted.data?.posts ?? []), ...SAMPLE_POSTS];
  const posts: FeedPost[] = tab === 'live' ? [] : tab === 'following'
    ? preview ? SAMPLE_POSTS.filter(isFollowing) : followingPosts.data?.posts ?? []
    : allPosts;
  const selectedPost = posts[Math.max(0, Math.min(index, posts.length - 1))];
  const current = selectedPost && !isPublished(selectedPost) ? selectedPost : SAMPLE_POSTS[0];
  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    return SAMPLE_POSTS.filter((p) => !q || [p.author, p.location, p.caption, p.translation, ...p.tags].join(' ').toLowerCase().includes(q));
  }, [query]);

  const addComment = (text: string) => setLocal((m) => ({ ...m, [current.id]: [...(m[current.id] ?? []), { id: `me-${Date.now()}`, author: viewer?.name ?? '', isViewer: true, flag: '💬', text }] }));
  const changeTab = (next: Tab) => { setOpen(null); setTab(next); setIndex(0); setListStart(0); setListVersion((v) => v + 1); };
  const toggleFollow = (post: SamplePost) => {
    setFollows((old) => ({ ...old, [post.handle]: !(old[post.handle] ?? SAMPLE_POSTS.find((p) => p.handle === post.handle)?.following ?? false) }));
    if (tab === 'following') {
      setOpen(null);
      if (section === 'creator' && isFollowing(post)) {
        // The current post leaves Following; keep it selected in For You on return.
        const target = allPosts.findIndex((p) => p.id === post.id);
        setTab('foryou'); setIndex(target); setListStart(target);
      } else if (section !== 'creator') {
        setIndex(0); setListStart(0);
      }
      setListVersion((v) => v + 1);
    }
  };
  const changeSection = (next: 'home' | 'discover' | 'profile') => {
    setOpen(null);
    if (section === 'home' && next !== 'home') setListStart(index);
    setSection(next);
    if ((next === 'home' || next === 'discover') && !preview) void persisted.refetch();
  };

  const openPost = (postId: string) => {
    const target = postIndexById(allPosts, postId);
    if (target < 0) {
      Alert.alert(discoverCopy.unavailable, discoverCopy.unavailableBody);
      return;
    }
    setTab('foryou'); setIndex(target); setListStart(target); setListVersion((v) => v + 1); setOpen(null); setSection('home');
  };
  const openCreator = (post: SamplePost) => {
    setOpen(null);
    setListStart(index);
    setCreatorHandle(post.handle);
    setSection('creator');
  };
  const openOwnerPosts = () => {
    setPostsResetToken((token) => token + 1);
    if (renderProfile && !preview) changeSection('profile');
    else onProfile();
  };
  const creator = SAMPLE_POSTS.find((post) => post.handle === creatorHandle);

  const profileCtx: ProfileCtx = {
    uploads: [],
    onAdd: () => setOpen('create'),
    onRemove: () => undefined,
    following: SAMPLE_POSTS.filter((p, i) => SAMPLE_POSTS.findIndex((other) => other.handle === p.handle) === i && isFollowing(p)).map((p) => ({ id: p.handle, name: p.author, handle: p.handle, flag: p.flag, image: p.image })),
    liked: SAMPLE_POSTS.filter((p) => likes[p.id]).map((p) => ({ id: `liked-${p.id}`, kind: p.video ? 'video' as const : 'photo' as const, image: p.image, video: p.video, label: `${p.author} · ${p.location}`, caption: p.translation, views: p.likes + 1, tag: t('feedLikedSample') })),
    onUnfollow: (handle) => { setFollows((old) => ({ ...old, [handle]: false })); if (tab === 'following') { setIndex(0); setListStart(0); setListVersion((v) => v + 1); } },
  };
  const hasProfile = preview || !!renderProfile;

  const NAV_H = 64;
  return (
    <View style={{ flex: 1, backgroundColor: c.bgTop }}>
      {section === 'home' && <View style={{ flex: 1 }} onLayout={(e) => { if (e.nativeEvent.layout.height > 0) setH(e.nativeEvent.layout.height); }}>
        {h > 0 && posts.length > 0 ? (
          <FlatList
            key={`${tab}-${listVersion}-${tab === 'following' ? posts.map((p) => p.id).join(',') : ''}`}
            data={posts}
            keyExtractor={(p) => p.id}
            initialScrollIndex={Math.min(listStart, posts.length - 1)}
            pagingEnabled
            showsVerticalScrollIndicator={false}
            refreshing={!preview && (tab === 'following' ? followingPosts.isFetching : persisted.isFetching)}
            onRefresh={() => { if (!preview) void (tab === 'following' ? followingPosts.refetch() : persisted.refetch()); }}
            getItemLayout={(_, i) => ({ length: h, offset: h * i, index: i })}
            onScroll={(e) => {
              // Read the pooled native event synchronously, not in a state updater.
              const next = Math.max(0, Math.min(posts.length - 1, Math.round(e.nativeEvent.contentOffset.y / h)));
              setIndex((previous) => previous === next ? previous : next);
            }}
            scrollEventThrottle={16}
            onMomentumScrollEnd={(e) => setIndex(Math.max(0, Math.min(posts.length - 1, Math.round(e.nativeEvent.contentOffset.y / h))))}
              renderItem={({ item, index: itemIndex }) => isPublished(item) ? <PublishedPost post={item} height={h} followable={!preview && !!viewer?.id && viewer.id !== item.ownerId} onAuthor={!preview ? viewer?.id === item.ownerId ? openOwnerPosts : () => setPublishedCreator(item) : undefined} active={itemIndex === index && focused && foreground && webVisible && open === null && !publishedCreator && section === 'home'} /> : <PostView post={item} height={h} active={itemIndex === index && focused && foreground && webVisible && open === null && section === 'home'}
              onOpen={setOpen} viewerComments={(local[item.id] ?? []).length}
               liked={!!likes[item.id]} following={isFollowing(item)} onCreator={() => openCreator(item)}
              onLike={() => setLikes((old) => ({ ...old, [item.id]: !old[item.id] }))}
              onFollow={() => toggleFollow(item)} />}
          />
        ) : tab === 'live' ? (
          <ScrollView contentContainerStyle={{ paddingTop: ins.top + 70 }}><LiveList active={focused && foreground && section === 'home'} preview={!!preview} /></ScrollView>
        ) : tab === 'following' ? (
          <View style={st.emptyFollowing}>
            <Feather name="users" size={32} color={c.accent} />
            <Text style={[st.emptyTitle, { color: c.text, fontFamily: font('semibold') }]}>{preview ? t('feedFollowingEmpty') : followingPosts.isPending ? copy.loading : followingPosts.isError ? copy.loadFailed : copy.empty}</Text>
            {preview ? <Text style={[st.emptyBody, { color: c.secondary, fontFamily: font() }]}>{t('feedFollowingBody')}</Text> : null}
            <Pressable onPress={() => { if (!preview && followingPosts.isError) void followingPosts.refetch(); else if (!preview) setOpen('search'); else changeTab('foryou'); }} accessibilityRole="button" style={[st.emptyButton, { borderColor: c.accent }]}>
              <Text style={{ color: c.accent, fontFamily: font('semibold'), textAlign: 'center' }}>{preview ? t('feedExploreSamples') : followingPosts.isError ? copy.retry : t('search')}</Text>
            </Pressable>
          </View>
        ) : null}

        <View style={[st.top, { top: ins.top, flexDirection: row }]} pointerEvents="box-none">
          <View style={st.brand} accessibilityLabel="Nino">
            <Text style={st.brandText}>Nin</Text>
            <EarthGlobe size={20} />
          </View>
          <View style={[st.tabs, { flexDirection: row }]}>
            {(['foryou', 'following', 'live'] as Tab[]).map((k) => {
              const on = tab === k;
              return (
                <Pressable key={k} testID={`tab-${k}`} onPress={() => changeTab(k)} accessibilityRole="tab" accessibilityState={{ selected: on }} style={st.tab}>
                  <Text style={[st.tabText, { color: on ? c.text : 'rgba(255,255,255,0.65)', fontFamily: font('semibold'), textAlign: 'center' }]}>{t(k === 'foryou' ? 'feedForYou' : k === 'live' ? 'feedLive' : 'feedFollowing')}</Text>
                  <View style={[st.tabBar, { backgroundColor: on ? c.text : 'transparent' }]} />
                </Pressable>
              );
            })}
          </View>
          <Pressable testID="open-search" onPress={() => setOpen('search')} accessibilityRole="button" accessibilityLabel={t('feedSearchPosts')} style={st.searchBtn}>
            <Feather name="search" size={20} color={c.text} />
          </Pressable>
        </View>
        <View style={[st.badgeRow, { top: ins.top + 64, maxWidth: preview && onExitDemo ? '58%' : '90%' }, rtl && { left: undefined, right: 16 }, !selectedPost && { display: 'none' }]} pointerEvents="none">
          <View style={[st.badge, { borderColor: c.border }]}>
            <Text style={[st.badgeText, { fontFamily: font('semibold'), textAlign: align, flexShrink: 1 }]}>{selectedPost && isPublished(selectedPost) ? copy.published : t(preview ? 'feedDemoSamples' : 'feedSamplePosts')}</Text>
          </View>
        </View>
        {!preview && (persisted.isError || persisted.isPending) ? <View style={{ position: 'absolute', top: ins.top + 90, left: 16, right: 16, padding: 12, backgroundColor: c.overlay, borderRadius: 12 }}>
          <Text testID="feed-posts-status" style={{ color: persisted.isError ? c.danger : c.text }}>{persisted.isError ? `${copy.loadFailed}: ${postError(persisted.error)}` : copy.loading}</Text>
          {persisted.isError ? <Pressable testID="feed-posts-retry" onPress={() => { void persisted.refetch(); }} accessibilityRole="button" style={{ minHeight: 44, justifyContent: 'center' }}><Text style={{ color: c.accent }}>{copy.retry}</Text></Pressable> : null}
        </View> : null}
        {preview && onExitDemo ? (
          <Pressable testID="exit-demo" onPress={onExitDemo} accessibilityRole="button" accessibilityLabel={t('feedExitDemoWelcome')}
            style={[st.exitDemo, { top: ins.top + 64, borderColor: c.border, flexDirection: row, maxWidth: '36%' }, rtl && { right: undefined, left: 14 }]}>
            <Text style={[st.badgeText, { fontFamily: font('semibold'), flexShrink: 1, textAlign: align }]}>{t('feedExitDemo')}</Text><Feather name="x" size={14} color={c.text} />
          </Pressable>
        ) : null}

        {tab !== 'live' && !(selectedPost && isPublished(selectedPost)) && <Pressable testID="translate-bar" onPress={() => setOpen('translate')} accessibilityRole="button" accessibilityLabel={t('feedTranslate')}
          style={[st.tbar, { borderColor: c.borderStrong, bottom: 10, flexDirection: row }]}>
          <EarthGlobe size={26} />
          <Text style={[st.tbarText, { fontFamily: font('semibold'), textAlign: align }]}>{t('feedTranslate')}</Text>
          <View style={[st.ai, { borderColor: c.border }]}><Text style={{ color: c.accent, fontFamily: font('semibold'), fontSize: 11, textAlign: 'center' }}>{t('feedPreview')}</Text></View>
          <Feather name={rtl ? 'chevron-left' : 'chevron-right'} size={18} color={c.accent} />
        </Pressable>}
      </View>}

      <View style={{ flex: 1, display: section === 'discover' ? 'flex' : 'none' }}><DiscoverScreen active={section === 'discover'} preview={!!preview}
        posts={persisted.data?.posts ?? []} loading={!preview && persisted.isPending} refreshing={!preview && persisted.isFetching}
        error={!preview && persisted.isError ? persisted.error : undefined} onRetry={() => { if (!preview) void persisted.refetch(); }} onOpenPost={openPost} /></View>
      {section === 'creator' && creator ? <CreatorProfile creator={creator} following={isFollowing(creator)}
        onFollow={() => toggleFollow(creator)} onBack={() => setSection('home')} onOpenPost={openPost} /> : null}
      {hasProfile ? (
        <View style={{ flex: 1, display: section === 'profile' ? 'flex' : 'none' }}>
          {preview ? <DemoProfile active={section === 'profile'} name={viewer?.name ?? 'Alex Morgan'} ctx={profileCtx} onExitDemo={onExitDemo} /> : renderProfile?.(profileCtx, section === 'profile', postsResetToken)}
        </View>
      ) : null}
      {section !== 'creator' && <View style={[st.nav, { minHeight: NAV_H + ins.bottom, paddingBottom: ins.bottom, borderTopColor: 'rgba(255,255,255,0.08)', flexDirection: row }]}>
        <NavItem testID="nav-home" icon="home" label={t('feedHome')} active={section === 'home'} onPress={() => { if (section === 'home') changeTab('foryou'); else changeSection('home'); }} />
        <NavItem testID="nav-discover" icon="globe" label={t('feedDiscover')} active={section === 'discover'} onPress={() => changeSection('discover')} />
        <Pressable testID="nav-create" onPress={() => setOpen('create')} accessibilityRole="button" accessibilityLabel={t('feedCreatePost')} style={st.navItem}>
          <View style={[st.create, { borderColor: c.accent, backgroundColor: c.accent }]}><Feather name="plus" size={26} color={c.onAccent} /></View>
        </Pressable>
        <MessagesNav preview={!!preview} />
        <Pressable testID="nav-profile" onPress={hasProfile ? () => changeSection('profile') : onProfile} accessibilityRole="button" accessibilityLabel={t('feedProfile')} style={st.navItem}>
          <View style={[st.navAv, { borderColor: section === 'profile' ? c.text : c.border }]}>
            {viewer?.imageUrl ? <Image source={{ uri: viewer.imageUrl }} style={{ width: 26, height: 26, borderRadius: 13 }} /> : <Initials name={viewer?.name} size={26} />}
          </View>
          <Text style={[st.navLabel, { color: section === 'profile' ? c.text : c.secondary, fontFamily: font('medium') }]}>{t('feedProfile')}</Text>
        </Pressable>
      </View>}

      <CommentsSheet key={`comments-${current.id}`} post={current} visible={open === 'comments'} onClose={() => setOpen(null)} extra={local[current.id] ?? []} onAdd={addComment} />
      <TranslateSheet key={`translate-${current.id}`} post={current} visible={open === 'translate'} onClose={() => setOpen(null)} />
      <CreatePost visible={open === 'create'} allowPublish={!preview} onClose={() => setOpen(null)} onSave={async (item) => {
        await cachePublishedPost(queryClient, item, getListPostsQueryKey(), getListMyPostsQueryKey());
        // A new post belongs at the top of For You, not the previously viewed
        // Following list or an old scroll offset retained behind the profile.
        setTab('foryou');
        setIndex(0);
        setListStart(0);
        setListVersion((version) => version + 1);
        openOwnerPosts();
      }} />
      <Sheet visible={open === 'more'} onClose={() => setOpen(null)} title={t('feedAboutPost')} testID="post-info-sheet">
        <PreviewTag text={t('feedCuratedSample')} />
        {current.videoCredit && current.videoSourceUrl ? (
          <Pressable onPress={() => Linking.openURL(current.videoSourceUrl!).catch(() => Alert.alert(t('feedError'), t('feedSourceError')))} accessibilityRole="link"
            accessibilityLabel={t('feedOpenSource')} style={{ padding: 16, minHeight: 44 }}>
            <Text style={{ color: c.text, fontFamily: font('medium'), textAlign: align, fontSize: 14 }}>{current.videoCredit}</Text>
            <Text style={{ color: c.secondary, fontFamily: font(), textAlign: align, marginTop: 8 }}>{t('feedAdaptedClip')}</Text>
            <Text style={{ color: c.accent, fontFamily: font(), textAlign: align, marginTop: 12 }}>{t('feedViewSource')}</Text>
          </Pressable>
        ) : null}
      </Sheet>
      <Sheet visible={!!publishedCreator} onClose={() => setPublishedCreator(null)} title={publishedCreator?.authorName ?? ''} testID="published-profile-sheet">
        {publishedCreator ? <PublicProfileCard
          person={{ id: publishedCreator.ownerId, displayName: publishedCreator.authorName, username: null, avatarUrl: publishedCreator.authorAvatar }}
          onBack={() => setPublishedCreator(null)} onOpened={() => setPublishedCreator(null)} /> : null}
      </Sheet>
      <Sheet visible={open === 'search'} onClose={() => setOpen(null)} title={preview ? t('feedDiscover') : t("search")} testID="search-sheet">
        {!preview ? <PeopleSearch onOpened={() => setOpen(null)} /> : <>
        <PreviewTag text={t('feedBrowsingSamples')} />
        <View style={[st.searchInput, { borderColor: c.border, backgroundColor: c.cardSoft, flexDirection: row }]}>
          <Feather name="search" size={16} color={c.secondary} />
          <TextInput testID="search-input" value={query} onChangeText={setQuery} placeholder={t('feedSearchPlaceholder')} placeholderTextColor={c.muted}
            style={{ flex: 1, color: c.text, fontFamily: font(), textAlign: align, fontSize: 14, minHeight: 44 }} accessibilityLabel={t('feedSearch')} />
        </View>
        {results.length === 0 ? (
          <View style={{ alignItems: 'center', paddingVertical: 24, gap: 6 }}>
            <Feather name="compass" size={24} color={c.muted} />
            <Text style={{ color: c.secondary, fontFamily: font(), textAlign: align, fontSize: 13 }}>{t('feedNoResults').replace('{query}', query)}</Text>
          </View>
        ) : results.map((p) => (
          <Pressable key={p.id} testID={`result-${p.id}`} accessibilityRole="button" accessibilityLabel={t('feedOpenLocation').replace('{location}', p.location)}
            onPress={() => openPost(p.id)}
            style={[st.result, { borderColor: c.border, flexDirection: row }]}>
            <Image source={p.image} style={{ width: 52, height: 68, borderRadius: 10 }} contentFit="cover" />
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={{ color: c.text, fontFamily: font('semibold'), textAlign: align, fontSize: 14 }}>{p.flag} {p.location}</Text>
              <Text style={{ color: c.secondary, fontFamily: font(), textAlign: align, fontSize: 12 }} numberOfLines={2}>{p.translation}</Text>
            </View>
          </Pressable>
        ))}
        </>}
      </Sheet>
    </View>
  );
}

function NavItem({ icon, label, active, onPress, testID }: { icon: keyof typeof Feather.glyphMap; label: string; active?: boolean; onPress: () => void; testID: string }) {
  const c = useColors();
  const { font } = useI18n();
  return (
    <Pressable testID={testID} onPress={onPress} accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ selected: !!active }} style={st.navItem}>
      <Feather name={icon} size={22} color={active ? c.text : c.secondary} />
      <Text style={[st.navLabel, { color: active ? c.text : c.secondary, fontFamily: font('medium') }]}>{label}</Text>
    </Pressable>
  );
}

function MessagesNav({ preview }: { preview: boolean }) {
  const c = useColors();
  const t = useMessagesCopy();
  const active = useActive();
  // Read-only badge poll: every 5s only while the feed is focused and the app is foregrounded. Never marks read.
  const inbox = useListMessagingConversations(undefined, { query: { queryKey: getListMessagingConversationsQueryKey(), enabled: !preview,
    refetchInterval: active && !preview ? POLL_MS : false, refetchIntervalInBackground: false } });
  const unread = (inbox.data?.conversations ?? []).reduce((n, cv) => n + cv.unreadCount, 0);
  return (
    <Pressable testID="nav-messages" disabled={preview} onPress={() => router.push('/messages' as never)} accessibilityRole="button"
      accessibilityLabel={unread ? `${t.title}, ${unread} ${t.unread}` : t.title} accessibilityState={{ disabled: preview }} style={[st.navItem, preview && { opacity: 0.4 }]}>
      <View>
        <Feather name="message-square" size={22} color={c.secondary} />
        {unread > 0 ? <View style={{ position: 'absolute', top: -5, right: -9, minWidth: 17, height: 17, borderRadius: 9, paddingHorizontal: 4, backgroundColor: c.accent, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: c.bgTop }}>
          <Text style={{ color: c.onAccent, fontFamily: 'Poppins_600SemiBold', fontSize: 9 }}>{unread > 99 ? '99+' : unread}</Text>
        </View> : null}
      </View>
      <Text numberOfLines={1} style={[st.navLabel, { color: c.secondary }]}>{t.title}</Text>
    </Pressable>
  );
}

const st = StyleSheet.create({
  top: { position: 'absolute', left: 0, right: 0, minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 10 },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 2, width: 64 },
  brandText: { color: '#FFFFFF', fontFamily: 'Poppins_700Bold', fontSize: 15 },
  tabs: { flex: 1, flexDirection: 'row', gap: 2 },
  tab: { flex: 1, minHeight: 44, paddingHorizontal: 3, alignItems: 'center', justifyContent: 'center' },
  tabText: { fontFamily: 'Poppins_600SemiBold', fontSize: 13 },
  tabBar: { height: 3, width: 26, borderRadius: 2, marginTop: 2 },
  searchBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(12,12,14,0.55)', alignItems: 'center', justifyContent: 'center' },
  badgeRow: { position: 'absolute', left: 16, flexDirection: 'row', gap: 6 },
  exitDemo: { position: 'absolute', right: 14, minHeight: 26, paddingVertical: 4, borderRadius: 999, borderWidth: 1, paddingHorizontal: 9, backgroundColor: 'rgba(12,12,14,0.72)', flexDirection: 'row', alignItems: 'center', gap: 4 },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, minHeight: 26, paddingVertical: 4, borderRadius: 999, backgroundColor: 'rgba(12,12,14,0.72)', borderWidth: 1 },
  liveDot: { width: 7, height: 7, borderRadius: 4 },
  badgeText: { color: '#FFFFFF', fontFamily: 'Poppins_600SemiBold', fontSize: 11, letterSpacing: 0.4 },
  rail: { position: 'absolute', right: 10, bottom: 150, alignItems: 'center', gap: 10 },
  smallRail: { bottom: 60, gap: 4 },
  railItem: { alignItems: 'center', minWidth: 52, minHeight: 44 },
  railCircle: { width: 50, height: 50, borderRadius: 25, backgroundColor: 'rgba(12,12,14,0.6)', alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  smallRailCircle: { width: 42, height: 42, borderRadius: 21 },
  railLabel: { color: '#FFF', fontFamily: 'Poppins_600SemiBold', fontSize: 12, marginTop: 3, textShadowColor: 'rgba(0,0,0,0.6)', textShadowRadius: 4 },
  railAvatar: { width: 56, height: 56, borderRadius: 28, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  smallRailAvatar: { width: 46, height: 46, borderRadius: 23 },
  plus: { width: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginTop: -10 },
  disc: { width: 40, height: 40, borderRadius: 20, borderWidth: 9, backgroundColor: '#2A2A2E', alignItems: 'center', justifyContent: 'center', marginTop: 4 },
  smallDisc: { width: 32, height: 32, borderRadius: 16, borderWidth: 7 },
  discDot: { width: 8, height: 8, borderRadius: 4 },
  caption: { position: 'absolute', left: 16, right: 84, bottom: 74, gap: 6 },
  authorRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  cc: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, height: 22, borderRadius: 6, backgroundColor: 'rgba(12,12,14,0.7)' },
  ccText: { color: '#FFFFFF', fontFamily: 'Poppins_600SemiBold', fontSize: 11 },
  author: { color: '#FFF', fontFamily: 'Poppins_700Bold', fontSize: 17, flexShrink: 1 },
  follow: { paddingHorizontal: 14, paddingVertical: 4, minHeight: 30, maxWidth: '100%', borderRadius: 999, borderWidth: 1, justifyContent: 'center' },
  row6: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  loc: { fontFamily: 'Poppins_500Medium', fontSize: 13 },
  captionText: { color: '#FFF', fontFamily: 'Poppins_400Regular', fontSize: 15, lineHeight: 22, textShadowColor: 'rgba(0,0,0,0.5)', textShadowRadius: 4 },
  music: { flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: 'flex-start', maxWidth: '100%', paddingHorizontal: 12, height: 30, borderRadius: 999, backgroundColor: 'rgba(12,12,14,0.7)' },
  musicText: { color: '#FFFFFF', fontFamily: 'Poppins_400Regular', fontSize: 12, flexShrink: 1 },
  tbar: { position: 'absolute', left: 14, right: 14, minHeight: 54, paddingVertical: 8, borderRadius: 27, borderWidth: 1, backgroundColor: 'rgba(12,12,14,0.88)', flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, shadowColor: 'rgba(255,255,255,0.5)', shadowOpacity: 0.35, shadowRadius: 12, shadowOffset: { width: 0, height: 0 } },
  tbarText: { flex: 1, color: '#FFF', fontFamily: 'Poppins_600SemiBold', fontSize: 16 },
  ai: { paddingHorizontal: 8, minHeight: 26, paddingVertical: 4, maxWidth: '30%', borderRadius: 999, borderWidth: 1, justifyContent: 'center' },
  nav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', backgroundColor: '#0E0E10', borderTopWidth: 1 },
  navItem: { flex: 1, minHeight: 48, paddingHorizontal: 2, paddingVertical: 4, alignItems: 'center', justifyContent: 'center', gap: 2 },
  navLabel: { fontFamily: 'Poppins_500Medium', fontSize: 11, textAlign: 'center' },
  navAv: { width: 30, height: 30, borderRadius: 15, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  create: { width: 54, height: 54, borderRadius: 27, borderWidth: 0, backgroundColor: '#0E0E10', alignItems: 'center', justifyContent: 'center', shadowColor: 'rgba(255,255,255,0.5)', shadowOpacity: 0, shadowRadius: 10, shadowOffset: { width: 0, height: 0 } },
  searchInput: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderRadius: 14, paddingHorizontal: 12, marginVertical: 12 },
  result: { flexDirection: 'row', gap: 12, alignItems: 'center', paddingVertical: 10, borderTopWidth: 1 },
  emptyFollowing: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14, paddingHorizontal: 40 },
  emptyTitle: { fontFamily: 'Poppins_600SemiBold', fontSize: 18, textAlign: 'center' },
  emptyBody: { fontFamily: 'Poppins_400Regular', fontSize: 14, textAlign: 'center', lineHeight: 22 },
  emptyButton: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 18, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  demoProfile: { flexDirection: 'row', alignItems: 'center', gap: 14, borderWidth: 1, borderRadius: 16, padding: 14, marginTop: 16 },
});
