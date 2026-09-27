import { router } from 'expo-router';
import React from 'react';
import { RealProfile } from '@/components/profile/RealProfile';

export default function ProfileScreen() {
  return <RealProfile onBack={() => (router.canGoBack() ? router.back() : router.replace('/feed'))} />;
}
