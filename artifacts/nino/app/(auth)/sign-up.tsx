import { useSignUp } from '@clerk/expo';
import { router } from 'expo-router';
import React, { useState } from 'react';
import { Platform, View } from 'react-native';
import { AuthHeader, LinkRow, TextLink } from '@/components/AuthBits';
import { Shell } from '@/components/Shell';
import { SocialAuth } from '@/components/SocialAuth';
import { Banner, Card, Field, PillButton, Title } from '@/components/ui';
import { clerkErrorMessage } from '@/lib/data';
import { useI18n } from '@/lib/i18n';

export default function SignUpScreen() {
  const { signUp, errors, fetchStatus } = useSignUp();
  const { t } = useI18n();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [socialBusy, setSocialBusy] = useState(false);
  const [socialActive, setSocialActive] = useState(false);
  const busy = fetchStatus === 'fetching' || socialBusy;

  const verifying =
    signUp.status === 'missing_requirements' && signUp.unverifiedFields.includes('email_address') && signUp.missingFields.length === 0;

  const finish = async () => {
    await signUp.finalize({ navigate: () => router.replace('/setup') });
  };

  const submit = async () => {
    setError(null); setInfo(null);
    if (!email || !password) return setError(t('missingFields'));
    try {
    const { error: e } = await signUp.password({ emailAddress: email.trim(), password });
    if (e) return setError(clerkErrorMessage(e, t('genericError')));
    if (signUp.status === 'complete') return finish();
    const { error: e2 } = await signUp.verifications.sendEmailCode();
    if (e2) setError(clerkErrorMessage(e2, t('genericError')));
    } catch (err) {
      setError(clerkErrorMessage(err, t('genericError')));
    }
  };

  const verify = async () => {
    setError(null); setInfo(null);
    const { error: e } = await signUp.verifications.verifyEmailCode({ code: code.trim() });
    if (e) return setError(clerkErrorMessage(e, t('genericError')));
    if (signUp.status === 'complete') await finish();
    else setError(t('genericError'));
  };

  const resend = async () => {
    setError(null);
    const { error: e } = await signUp.verifications.sendEmailCode();
    if (e) setError(clerkErrorMessage(e, t('genericError')));
    else setInfo(t('codeSent'));
  };

  if (verifying && !socialActive) {
    return (
      <Shell fallback="/">
        <AuthHeader />
        <Title title={t('verifyTitle')} body={`${t('verifyBody')} ${signUp.emailAddress ?? email}`} />
        <Card style={{ gap: 16 }}>
          <Field testID="code" label={t('code')} value={code} onChangeText={setCode} keyboardType="number-pad" autoComplete="one-time-code" maxLength={6} placeholder="••••••" error={errors.fields.code?.message} />
          <Banner text={error} />
          <Banner text={info} tone="info" />
          <PillButton testID="verify" label={t('verify')} onPress={verify} loading={busy} disabled={code.length < 6} />
        </Card>
        <TextLink testID="resend" label={t('resend')} onPress={resend} />
        <TextLink testID="start-over" label={t('startOver')} onPress={() => { signUp.reset(); setCode(''); setError(null); setInfo(null); }} />
      </Shell>
    );
  }

  return (
    <Shell fallback="/">
      <AuthHeader />
      <Title title={t('createAccount')} body={t('createAccountBody')} />
      <SocialAuth disabled={fetchStatus === 'fetching'} onBusyChange={setSocialBusy} onFlowChange={setSocialActive} />
      <Card style={{ gap: 16 }}>
        <Field testID="email" label={t('email')} value={email} onChangeText={setEmail} autoCapitalize="none" autoComplete="email" keyboardType="email-address" placeholder={t('emailPh')} error={errors.fields.emailAddress?.message} />
        <Field testID="password" label={t('password')} value={password} onChangeText={setPassword} secureTextEntry autoComplete="new-password" placeholder={t('passwordPh')} error={errors.fields.password?.message} />
        <Banner text={error} />
        {Platform.OS === 'web' && (
          <View style={{ gap: 8 }} testID="human-verification">
            <Banner text={t('humanVerification')} tone="info" />
            <View nativeID="clerk-captcha" />
          </View>
        )}
        <PillButton testID="sign-up" label={t('signUp')} onPress={submit} loading={busy} disabled={!email || !password || socialActive} />
      </Card>
      <LinkRow testID="to-sign-in" prompt={t('alreadyAccount')} action={t('signIn')} href="/sign-in" />
      {Platform.OS !== 'web' && <View nativeID="clerk-captcha" />}
    </Shell>
  );
}
