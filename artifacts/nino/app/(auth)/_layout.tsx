import { useAuth, useClerk } from '@clerk/expo';
import { Redirect, Stack } from 'expo-router';
import React from 'react';
import colors from '@/constants/colors';
import { Shell } from '@/components/Shell';
import { AuthHeader } from '@/components/AuthBits';
import { Banner, PillButton } from '@/components/ui';
import { useI18n } from '@/lib/i18n';

export default function AuthLayout() {
  const { isSignedIn } = useAuth();
  const { session, signOut } = useClerk();
  const { t } = useI18n();
  if (session?.currentTask) {
    return (
      <Shell back={false}>
        <AuthHeader />
        <Banner text={t('socialSessionTask')} />
        <PillButton testID="sso-task-sign-out" label={t('signOut')} onPress={() => void signOut()} />
      </Shell>
    );
  }
  if (isSignedIn) return <Redirect href="/" />;
  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.dark.bgTop } }} />;
}
