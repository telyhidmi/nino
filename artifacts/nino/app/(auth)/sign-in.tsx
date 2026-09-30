import { useSignIn } from '@clerk/expo';
import { router } from 'expo-router';
import React, { useState } from 'react';
import { AuthHeader, LinkRow, TextLink } from '@/components/AuthBits';
import { Shell } from '@/components/Shell';
import { SocialAuth } from '@/components/SocialAuth';
import { Banner, Card, Field, PillButton, Title } from '@/components/ui';
import { clerkErrorMessage } from '@/lib/data';
import { useI18n } from '@/lib/i18n';

export default function SignInScreen() {
  const { signIn, errors, fetchStatus } = useSignIn();
  const { t } = useI18n();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [socialBusy, setSocialBusy] = useState(false);
  const [socialActive, setSocialActive] = useState(false);
  const busy = fetchStatus === 'fetching' || socialBusy;

  const finish = () => signIn.finalize({ navigate: () => router.replace('/') });

  const submit = async () => {
    setError(null);
    if (!email || !password) return setError(t('missingFields'));
    const { error: e } = await signIn.password({ emailAddress: email.trim(), password });
    if (e) return setError(clerkErrorMessage(e, t('genericError')));
    if (signIn.status === 'complete') return finish();
    if (signIn.status === 'needs_client_trust') {
      const f = signIn.supportedSecondFactors.find((x) => x.strategy === 'email_code');
      if (f) {
        const { error: e2 } = await signIn.mfa.sendEmailCode();
        if (e2) setError(clerkErrorMessage(e2, t('genericError')));
        return;
      }
    }
    setError(t('secondFactor'));
  };

  const verify = async () => {
    setError(null);
    const { error: e } = await signIn.mfa.verifyEmailCode({ code: code.trim() });
    if (e) return setError(clerkErrorMessage(e, t('genericError')));
    if (signIn.status === 'complete') await finish();
    else setError(t('genericError'));
  };

  if (signIn.status === 'needs_client_trust' && !socialActive) {
    return (
      <Shell fallback="/">
        <AuthHeader />
        <Title title={t('verifyTitle')} body={`${t('verifyBody')} ${email}`} />
        <Card style={{ gap: 16 }}>
          <Field testID="code" label={t('code')} value={code} onChangeText={setCode} keyboardType="number-pad" maxLength={6} placeholder="••••••" error={errors.fields.code?.message} />
          <Banner text={error} />
          <Banner text={info} tone="info" />
          <PillButton testID="verify" label={t('verify')} onPress={verify} loading={busy} disabled={code.length < 6} />
        </Card>
        <TextLink label={t('resend')} onPress={async () => { const { error: e } = await signIn.mfa.sendEmailCode(); if (e) setError(clerkErrorMessage(e, t('genericError'))); else setInfo(t('codeSent')); }} />
        <TextLink label={t('startOver')} onPress={() => { signIn.reset(); setCode(''); setError(null); setInfo(null); }} />
      </Shell>
    );
  }

  return (
    <Shell fallback="/">
      <AuthHeader />
      <Title title={t('welcomeBack')} body={t('welcomeBackBody')} />
      <SocialAuth disabled={fetchStatus === 'fetching'} onBusyChange={setSocialBusy} onFlowChange={setSocialActive} />
      <Card style={{ gap: 16 }}>
        <Field testID="email" label={t('email')} value={email} onChangeText={setEmail} autoCapitalize="none" autoComplete="email" keyboardType="email-address" placeholder={t('emailPh')} error={errors.fields.identifier?.message} />
        <Field testID="password" label={t('password')} value={password} onChangeText={setPassword} secureTextEntry autoComplete="password" placeholder="••••••••" error={errors.fields.password?.message} />
        <TextLink testID="forgot" center={false} label={t('forgot')} onPress={() => router.push('/forgot-password')} />
        <Banner text={error} />
        <PillButton testID="sign-in" label={t('signIn')} onPress={submit} loading={busy} disabled={!email || !password || socialActive} />
      </Card>
      <LinkRow testID="to-sign-up" prompt={t('noAccount')} action={t('signUp')} href="/sign-up" />
    </Shell>
  );
}
