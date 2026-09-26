import { useSignIn } from '@clerk/expo';
import { router } from 'expo-router';
import React, { useState } from 'react';
import { AuthHeader, TextLink } from '@/components/AuthBits';
import { Shell } from '@/components/Shell';
import { Banner, Card, Field, PillButton, Title } from '@/components/ui';
import { clerkErrorMessage } from '@/lib/data';
import { useI18n } from '@/lib/i18n';

export default function ForgotPasswordScreen() {
  const { signIn, fetchStatus } = useSignIn();
  const { t } = useI18n();
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [stage, setStage] = useState<'email' | 'reset'>('email');
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const busy = fetchStatus === 'fetching';

  const send = async () => {
    setError(null); setInfo(null);
    const { error: e } = await signIn.create({ identifier: email.trim() });
    if (e) return setError(clerkErrorMessage(e, t('genericError')));
    const { error: e2 } = await signIn.resetPasswordEmailCode.sendCode();
    if (e2) return setError(clerkErrorMessage(e2, t('genericError')));
    setStage('reset');
    setInfo(t('codeSent'));
  };

  const reset = async () => {
    setError(null); setInfo(null);
    const { error: e } = await signIn.resetPasswordEmailCode.verifyCode({ code: code.trim() });
    if (e) return setError(clerkErrorMessage(e, t('genericError')));
    const { error: e2 } = await signIn.resetPasswordEmailCode.submitPassword({ password });
    if (e2) return setError(clerkErrorMessage(e2, t('genericError')));
    if (signIn.status === 'complete') await signIn.finalize({ navigate: () => router.replace('/') });
    else setError(t('secondFactor'));
  };

  return (
    <Shell fallback="/sign-in">
      <AuthHeader />
      <Title title={t('resetTitle')} body={stage === 'email' ? t('resetBody') : t('resetCodeBody')} />
      <Card style={{ gap: 16 }}>
        {stage === 'email' ? (
          <>
            <Field testID="email" label={t('email')} value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" autoComplete="email" placeholder={t('emailPh')} />
            <Banner text={error} />
            <PillButton testID="send-code" label={t('sendCode')} onPress={send} loading={busy} disabled={!email} />
          </>
        ) : (
          <>
            <Field testID="code" label={t('code')} value={code} onChangeText={setCode} keyboardType="number-pad" maxLength={6} placeholder="••••••" />
            <Field testID="new-password" label={t('newPassword')} value={password} onChangeText={setPassword} secureTextEntry autoComplete="new-password" placeholder={t('passwordPh')} />
            <Banner text={error} />
            <Banner text={info} tone="info" />
            <PillButton testID="reset" label={t('resetPassword')} onPress={reset} loading={busy} disabled={code.length < 6 || !password} />
          </>
        )}
      </Card>
      {stage === 'reset' ? <TextLink label={t('resend')} onPress={async () => { const { error: e } = await signIn.resetPasswordEmailCode.sendCode(); if (e) setError(clerkErrorMessage(e, t('genericError'))); else setInfo(t('codeSent')); }} /> : null}
      <TextLink testID="back-to-sign-in" label={t('backToSignIn')} onPress={() => router.replace('/sign-in')} />
    </Shell>
  );
}
