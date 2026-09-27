import { router, useLocalSearchParams } from 'expo-router';
import React from 'react';
import { FeedScreen } from '@/components/feed/FeedScreen';

/** Public, local-only demo. No account is created and authenticated routes remain guarded. */
export default function FeedPreview() {
  const { section } = useLocalSearchParams<{ section?: string }>();
  return <FeedScreen viewer={{ name: 'Alex Morgan' }} preview initialSection={section === 'discover' ? 'discover' : section === 'profile' ? 'profile' : 'home'} onProfile={() => router.push('/profile')} onExitDemo={() => router.replace('/')} />;
}
