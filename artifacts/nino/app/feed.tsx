import { useAuth, useUser } from '@clerk/expo';
import { Redirect, router } from 'expo-router';
import React from 'react';
import { FeedScreen } from '@/components/feed/FeedScreen';
import { readProfile } from '@/lib/data';

export default function Feed() {
  const { isSignedIn } = useAuth();
  const { user } = useUser();
  if (!isSignedIn || !user) return <Redirect href="/" />;
  const p = readProfile(user.unsafeMetadata);
  if (!p.profileComplete) return <Redirect href="/setup" />;
  return <FeedScreen viewer={{ name: p.displayName, imageUrl: user.hasImage ? user.imageUrl : null }} onProfile={() => router.push('/profile')} />;
}
