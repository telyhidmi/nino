import { useAuth, useUser } from '@clerk/expo';
import { Redirect, router } from 'expo-router';
import React from 'react';
import { FeedScreen } from '@/components/feed/FeedScreen';
import { RealProfile } from '@/components/profile/RealProfile';
import { readProfile } from '@/lib/data';
import { getGetMessagingProfileQueryKey, useGetMessagingProfile } from '@workspace/api-client-react';

export default function Feed() {
  const { isSignedIn } = useAuth();
  const { user } = useUser();
  // Signed-in entry: syncs this account's public messaging identity so others can find it.
  useGetMessagingProfile({ query: { enabled: !!isSignedIn && !!user, queryKey: getGetMessagingProfileQueryKey() } });
  if (!isSignedIn || !user) return <Redirect href="/" />;
  const p = readProfile(user.unsafeMetadata);
  if (!p.profileComplete) return <Redirect href="/setup" />;
  return <FeedScreen viewer={{ id: user.id, name: p.displayName, imageUrl: user.hasImage ? user.imageUrl : null }} onProfile={() => router.push('/profile')}
    renderProfile={(ctx, active, postsResetToken) => <RealProfile ctx={ctx} active={active} postsResetToken={postsResetToken} />} />;
}
