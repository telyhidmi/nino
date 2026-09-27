import { router } from 'expo-router';
import React from 'react';
import { FeedScreen } from '@/components/feed/FeedScreen';

/** Public, data-free preview of the feed UI. Does not bypass auth: profile goes to the guarded /profile. */
export default function FeedPreview() {
  return <FeedScreen viewer={null} preview onProfile={() => router.push('/profile')} />;
}
