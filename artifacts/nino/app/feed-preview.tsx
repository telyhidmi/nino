import { router } from 'expo-router';
import React from 'react';
import { FeedScreen } from '@/components/feed/FeedScreen';

/** Public, local-only demo. No account is created and authenticated routes remain guarded. */
export default function FeedPreview() {
  return <FeedScreen viewer={{ name: 'Alex Morgan' }} preview onProfile={() => router.push('/profile')} onExitDemo={() => router.replace('/')} />;
}
