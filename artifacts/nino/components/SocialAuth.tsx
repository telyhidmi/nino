import { useClerk, useSignIn, useSignUp } from '@clerk/expo';
import { useSSO } from '@clerk/expo/experimental';
import { FontAwesome } from '@expo/vector-icons';
import * as AuthSession from 'expo-auth-session';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import { router } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { TextLink } from '@/components/AuthBits';
import { Banner } from '@/components/ui';
import { useColors } from '@/hooks/useColors';
import { clerkErrorMessage } from '@/lib/data';
import { useI18n } from '@/lib/i18n';

type Provider = 'google' | 'apple';

export function socialRedirectUri() {
  // Expo Go owns exp:// links; only installed builds can open nino:// links.
  return AuthSession.makeRedirectUri({
    path: 'sso-callback',
    ...(Platform.OS !== 'web' && Constants.executionEnvironment !== ExecutionEnvironment.StoreClient
      ? { scheme: 'nino' }
      : {}),
  });
}

export function SocialAuth({
  disabled = false, onBusyChange, onFlowChange,
}: {
  disabled?: boolean;
  onBusyChange: (busy: boolean) => void;
  onFlowChange: (active: boolean) => void;
}) {
  const { startSSOFlow } = useSSO();
  const clerk = useClerk();
  const { signIn } = useSignIn();
  const { signUp } = useSignUp();
  const c = useColors();
  const { t, font, row } = useI18n();
  const lock = useRef(false);
  const [pending, setPending] = useState<Provider | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [incomplete, setIncomplete] = useState(false);

  const start = async (provider: Provider) => {
    if (disabled || lock.current) return;
    if (Platform.OS === 'web' && window.self !== window.top) {
      // Providers refuse embedded browsers. Start a self-contained redirect flow
      // in a top-level tab, not an AuthSession popup tied to this iframe.
      const url = new URL('/sign-in', window.location.origin);
      url.searchParams.set('sso_provider', provider);
      window.open(url.toString(), '_blank', 'noopener,noreferrer');
      return;
    }
    lock.current = true;
    setPending(provider);
    setError(null);
    setInfo(null);
    setIncomplete(false);
    onBusyChange(true);
    onFlowChange(true);
    try {
      if (Platform.OS === 'web') {
        const result = await signIn.sso({
          strategy: provider === 'google' ? 'oauth_google' : 'oauth_apple',
          redirectUrl: new URL('/', window.location.origin).toString(),
          redirectCallbackUrl: socialRedirectUri(),
        });
        if (result.error) throw result.error;
        return;
      }
      // Core 3's experimental hook finalizes/activates sessions itself.
      // Clerk owns verified-account matching and transfers; never merge by email ourselves.
      const result = await startSSOFlow({
        strategy: provider === 'google' ? 'oauth_google' : 'oauth_apple',
        redirectUrl: socialRedirectUri(),
      });
      if (result.authSessionResult?.type === 'cancel' || result.authSessionResult?.type === 'dismiss') {
        setInfo(t('socialCanceled'));
        onFlowChange(false);
        return;
      }
      if (clerk.session?.currentTask) {
        setError(t('socialSessionTask'));
        setIncomplete(true);
        return;
      }
      const sessionId = result.createdSessionId ?? result.signIn?.existingSession?.sessionId ?? result.signUp?.existingSession?.sessionId;
      if (sessionId && clerk.session?.id === sessionId && clerk.session.status === 'active') {
        // The welcome route uses the actual profile metadata: existing profiles → feed,
        // newly created users (including from sign-in) → setup.
        router.replace('/');
        return;
      }
      setIncomplete(true);
      if (result.signUp?.status === 'missing_requirements') {
        const requirements = [...result.signUp.missingFields, ...result.signUp.unverifiedFields];
        setError(`${t('socialRequirements')}${requirements.length ? ` (${requirements.join(', ')})` : ''}`);
      } else if (result.signIn?.status === 'needs_first_factor') {
        setError(t('socialLinkVerification'));
      } else if (result.signIn?.status === 'needs_second_factor' || result.signIn?.status === 'needs_client_trust') {
        setError(t('socialExtraVerification'));
      } else {
        setError(t('socialIncomplete'));
      }
    } catch (err) {
      setError(clerkErrorMessage(err, t('socialError')));
      setIncomplete(true);
    } finally {
      lock.current = false;
      setPending(null);
      onBusyChange(false);
    }
  };

  useEffect(() => {
    if (Platform.OS !== 'web' || window.self !== window.top || disabled) return;
    const url = new URL(window.location.href);
    const provider = url.searchParams.get('sso_provider');
    if (provider !== 'google' && provider !== 'apple') return;
    url.searchParams.delete('sso_provider');
    window.history.replaceState(window.history.state, '', url.toString());
    void start(provider);
  }, [disabled]);

  const reset = async () => {
    try {
      await signIn.reset();
      await signUp.reset();
      setError(null);
      setInfo(null);
      setIncomplete(false);
      onFlowChange(false);
    } catch (err) {
      setError(clerkErrorMessage(err, t('genericError')));
    }
  };

  return (
    <View style={styles.group}>
      {(['google', 'apple'] as const).map((provider) => {
        const label = t(provider === 'google' ? 'continueGoogle' : 'continueApple');
        const blocked = disabled || pending !== null || incomplete;
        return (
          <Pressable
            key={provider}
            testID={`sso-${provider}`}
            accessibilityRole="button"
            accessibilityLabel={label}
            accessibilityState={{ disabled: blocked, busy: pending === provider }}
            disabled={blocked}
            onPress={() => void start(provider)}
            style={({ pressed }) => [
              styles.button,
              { flexDirection: row, backgroundColor: pressed ? c.accentWash : c.card, borderColor: pressed ? c.accent : c.borderStrong, opacity: blocked && pending !== provider ? 0.5 : 1 },
            ]}
          >
            <View style={styles.icon}>
              {pending === provider
                ? <ActivityIndicator size="small" color={c.accent} />
                : <FontAwesome name={provider} size={22} color={c.text} />}
            </View>
            <Text style={{ color: c.text, fontFamily: font('medium'), fontSize: 14 }}>{label}</Text>
            <View style={styles.icon} />
          </Pressable>
        );
      })}
      <Banner text={error} />
      <Banner text={info} tone="info" />
      {incomplete && <TextLink testID="sso-start-over" label={t('startOver')} onPress={() => void reset()} />}
      <View style={[styles.divider, { flexDirection: row }]}>
        <View style={[styles.line, { backgroundColor: c.borderStrong }]} />
        <Text style={{ color: c.secondary, fontFamily: font('regular'), fontSize: 12 }}>{t('orEmail')}</Text>
        <View style={[styles.line, { backgroundColor: c.borderStrong }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  group: { gap: 12 },
  button: { minHeight: 52, borderWidth: 1, borderRadius: 12, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16, gap: 12 },
  icon: { width: 24, alignItems: 'center' },
  divider: { alignItems: 'center', gap: 12, marginTop: 6 },
  line: { flex: 1, height: StyleSheet.hairlineWidth },
});