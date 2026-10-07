import { closeActiveLiveSession } from '@/lib/liveSession';
import { useAuth, useClerk, useUser } from '@clerk/expo';
import { Feather } from '@expo/vector-icons';
import { Redirect, router, useFocusEffect } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, Share, Text, View } from 'react-native';
import { Sheet } from '@/components/feed/Sheets';
import { Banner } from '@/components/ui';
import { useColors } from '@/hooks/useColors';
import { clerkErrorMessage, countryBy, languageBy, readProfile } from '@/lib/data';
import { useI18n } from '@/lib/i18n';
import type { ProfileCtx } from './profileCtx';
import { confirmAction, ProfileLanguageButton, ProfileView } from './ProfileView';
import { useQueryClient } from '@tanstack/react-query';
import { getListMyPostsQueryKey, getListPostsQueryKey, useListMyPosts, useDeletePost, type PostList } from '@workspace/api-client-react';
import { usePostCopy } from '@/lib/postTranslations';
import { useSettingsCopy } from '@/lib/settingsCopy';
import { postItem, postError } from '@/lib/posts';
import type { ProfileItem } from './ProfileView';

export function RealProfile({ ctx, onBack, active = true, postsResetToken }: { ctx?: ProfileCtx; onBack?: () => void; active?: boolean; postsResetToken?: number }) {
  const { isSignedIn } = useAuth();
  const { user } = useUser();
  const { signOut } = useClerk();
  const c = useColors();
  const { t, font, row, align } = useI18n();
  const copy = usePostCopy();
  const settingsCopy = useSettingsCopy();
  const queryClient = useQueryClient();
  const mineKey = [...getListMyPostsQueryKey(), user?.id];
  const mine = useListMyPosts({ query: { queryKey: mineKey, enabled: !!isSignedIn && !!user && active, staleTime: 0, refetchOnMount: 'always', retry: false } });
  const removePost = useDeletePost();
  const [deleteError, setDeleteError] = useState<string | null>(null);
  useFocusEffect(useCallback(() => {
    if (active && isSignedIn && user?.id) void mine.refetch();
  }, [active, user?.id, isSignedIn, mine.refetch]));
  const remove = async (item: ProfileItem) => {
    if (removePost.isPending) return;
    setDeleteError(null);
    try {
      await removePost.mutateAsync({ id: item.id });
      queryClient.setQueryData<PostList>(mineKey, (previous) => previous ? { posts: previous.posts.filter((post) => post.id !== item.id) } : previous);
      queryClient.setQueryData<PostList>(getListPostsQueryKey(), (previous) => previous ? { posts: previous.posts.filter((post) => post.id !== item.id) } : previous);
      void queryClient.invalidateQueries({ queryKey: getListMyPostsQueryKey() });
      void queryClient.invalidateQueries({ queryKey: getListPostsQueryKey() });
      void queryClient.invalidateQueries({ queryKey: ['/api/posts/following'] });
    } catch (e) {
      setDeleteError(`${copy.deleteFailed}: ${postError(e)}`);
      throw e;
    }
  };
  const [menu, setMenu] = useState(false);
  useEffect(() => { if (!active) setMenu(false); }, [active]);
  const [error, setError] = useState<string | null>(null);

  if (!isSignedIn || !user) return <Redirect href="/" />;
  const p = readProfile(user.unsafeMetadata);
  if (!p.profileComplete) return <Redirect href="/setup" />;
  const ctry = countryBy(p.country);
  const handle = user.username ?? null; // real, searchable username only — never fabricated

  const doSignOut = async () => {
    setError(null);
    try { await closeActiveLiveSession(); await signOut(); router.replace('/'); } catch (e) { setError(clerkErrorMessage(e, t('genericError'))); }
  };
  const share = () => {
    Share.share({ message: t('profileShareReal').replace('{name}', p.displayName).replace('{handle}', handle ?? '').replace(' (@)', '') }).catch(() => undefined);
  };
  const edit = () => { setMenu(false); router.push('/setup?mode=edit'); };
  const understands = p.understands.map((k) => languageBy(k)?.native ?? k);

  const Item = ({ icon, label, onPress, danger, testID }: { icon: keyof typeof Feather.glyphMap; label: string; onPress: () => void; danger?: boolean; testID: string }) => (
    <Pressable testID={testID} onPress={onPress} accessibilityRole="button" style={{ flexDirection: row, alignItems: 'center', gap: 12, minHeight: 52, paddingVertical: 10, borderTopWidth: 1, borderTopColor: c.border }}>
      <Feather name={icon} size={18} color={danger ? c.danger : c.accent} />
      <Text style={{ color: danger ? c.danger : c.text, fontFamily: font('medium'), fontSize: 15, textAlign: align, flex: 1 }}>{label}</Text>
    </Pressable>
  );

  return (
    <>
      <ProfileView
        active={active}
        postsResetToken={postsResetToken}
        testID="real-profile"
        name={p.displayName} handle={handle ?? undefined} imageUrl={user.hasImage ? user.imageUrl : null}
        flag={ctry?.flag} countryCode={ctry?.code}
        speaks={languageBy(p.nativeLanguage)?.native ?? p.nativeLanguage} understands={understands}
        bio={user.primaryEmailAddress?.emailAddress ?? ''}
        stats={{ following: ctx?.following.length ?? 0, followers: null, likes: null }}
        statsNote={t('profileRealStats')}
        following={ctx?.following ?? []}
        followingEmpty={t(ctx ? 'profileFollowingEmpty' : 'profileFollowingUnsaved')}
        onUnfollow={ctx?.onUnfollow}
        onEdit={edit} onShare={share} onMenu={() => setMenu(true)} onBack={onBack}
          onAdd={ctx?.onAdd} addLabel={copy.newPost} onRemove={remove} removing={removePost.isPending} removalError={deleteError}
          uploadNote={copy.notice}
          postsStatus={<View style={{ padding: 16, gap: 8 }}>
            {mine.isPending ? <Text style={{ color: c.secondary }}>{copy.loading}</Text> : null}
            {mine.isError ? <><Text testID="profile-posts-error" style={{ color: c.danger }}>{copy.loadFailed}: {postError(mine.error)}</Text><Pressable testID="profile-posts-retry" onPress={() => { void mine.refetch(); }} accessibilityRole="button" style={{ minHeight: 44, justifyContent: 'center' }}><Text style={{ color: c.accent }}>{copy.retry}</Text></Pressable></> : null}
            {deleteError ? <Text style={{ color: c.danger }}>{deleteError}</Text> : null}
          </View>}
        tabs={{
            posts: { items: (mine.data?.posts ?? []).map((post) => postItem(post, copy.published)), emptyTitle: mine.isPending || mine.isError ? '' : copy.empty, emptyBody: mine.isPending || mine.isError ? '' : copy.emptyBody },
           private: { items: [], emptyTitle: copy.privateUnavailable, emptyBody: '' },
           reposts: { items: [], emptyTitle: t('profileNoReposts'), emptyBody: t('profileNoRepostsBody') },
           liked: { items: ctx?.liked ?? [], emptyTitle: t('profileNoLiked'), emptyBody: t('profileRealLikedBody') },
        }}
      />
      <Sheet visible={active && menu} onClose={() => setMenu(false)} title={t('profileAccount')} testID="profile-menu-sheet">
        <View style={{ paddingVertical: 12 }}><ProfileLanguageButton onNavigate={() => setMenu(false)} /></View>
        <Banner text={error} />
        <Item testID="menu-edit" icon="edit-2" label={t('edit')} onPress={edit} />
        <Item testID="menu-settings" icon="settings" label={settingsCopy.settings} onPress={() => { setMenu(false); router.push('/settings'); }} />
        <Item testID="sign-out" icon="log-out" label={t('signOut')} danger onPress={() => confirmAction(t('signOutConfirm'), '', t('signOut'), doSignOut, t('profileCancel'))} />
      </Sheet>
    </>
  );
}
