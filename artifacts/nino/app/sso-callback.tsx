import * as WebBrowser from 'expo-web-browser';
import { useSignIn, useSignUp } from '@clerk/expo';
import React, { useState } from 'react';
import { Platform } from 'react-native';
import { AuthHeader, TextLink } from '@/components/AuthBits';
import { Shell } from '@/components/Shell';
import { Banner, Title } from '@/components/ui';
import { useI18n } from '@/lib/i18n';
import { router } from 'expo-router';
import { clerkErrorMessage } from '@/lib/data';

// Web AuthSession uses a popup. Return its signed callback URL to the original
// window, where useSSO reloads the Clerk resource and finalizes the session.
// Keep the origin/redirect/state checks enabled (never skipRedirectCheck).
function completeBrowserSession() {
  try {
    return WebBrowser.maybeCompleteAuthSession().type === 'success';
  } catch {
    // A stale/reloaded opener or blocked cross-window messaging cannot complete
    // authentication. Surface recovery guidance rather than claiming success.
    return false;
  }
}
const browserCompleted = completeBrowserSession();

export default function SSOCallback() {
  const { t } = useI18n();
  const { signIn } = useSignIn();
  const { signUp } = useSignUp();
  const [error, setError] = useState<string | null>(null);
  const requirements = [...signUp.missingFields, ...signUp.unverifiedFields];
  const nativeMessage = signUp.status === 'missing_requirements'
    ? `${t('socialRequirements')}${requirements.length ? ` (${requirements.join(', ')})` : ''}`
    : signIn.status === 'needs_first_factor'
      ? t('socialLinkVerification')
      : signIn.status === 'needs_second_factor' || signIn.status === 'needs_client_trust'
        ? t('socialExtraVerification')
        : t('socialIncomplete');

  const recover = async () => {
    try {
      await signIn.reset();
      await signUp.reset();
      router.replace('/sign-in');
    } catch (err) {
      setError(clerkErrorMessage(err, t('genericError')));
    }
  };

  return (
    <Shell back={false}>
      <AuthHeader />
      <Title title={t('socialReturning')} body={t('socialReturnBody')} />
      <Banner
        text={Platform.OS === 'web'
          ? (!browserCompleted ? t('socialCallbackError') : null)
          : nativeMessage}
      />
      <Banner text={error} />
      <TextLink testID="sso-back-to-sign-in" label={t('backToSignIn')} onPress={() => void recover()} />
    </Shell>
  );
}