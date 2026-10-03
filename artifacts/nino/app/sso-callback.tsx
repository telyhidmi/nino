import * as WebBrowser from 'expo-web-browser';
import { useClerk, useSignIn, useSignUp } from '@clerk/expo';
import React, { useEffect, useRef, useState } from 'react';
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
const browserCompleted = Platform.OS === 'web' && completeBrowserSession();

export default function SSOCallback() {
  const { t } = useI18n();
  const clerk = useClerk();
  const { signIn } = useSignIn();
  const { signUp } = useSignUp();
  const [error, setError] = useState<string | null>(null);
  const started = useRef(false);
  useEffect(() => {
    if (Platform.OS !== 'web' || browserCompleted || started.current) return;
    started.current = true;
    // Clerk validates and completes the redirect in this tab. No opener, Expo
    // popup storage or cross-window messaging is needed for browser sign-in.
    void clerk.handleRedirectCallback({
      signInUrl: '/sign-in',
      signUpUrl: '/sign-up',
      signInFallbackRedirectUrl: '/',
      signUpFallbackRedirectUrl: '/',
    }).catch((err: unknown) => setError(clerkErrorMessage(err, t('socialError'))));
  }, [clerk, t]);
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
          ? null
          : nativeMessage}
      />
      <Banner text={error} />
      <TextLink testID="sso-back-to-sign-in" label={t('backToSignIn')} onPress={() => void recover()} />
    </Shell>
  );
}