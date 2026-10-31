import { useSession, useUser } from '@clerk/expo';
import { Redirect } from 'expo-router';
import React, { useRef, useState } from 'react';
import { Shell } from '@/components/Shell';
import { Banner, Card, Field, PillButton, Title } from '@/components/ui';
import { clerkErrorMessage } from '@/lib/data';
import { useI18n } from '@/lib/i18n';
import { usePasswordSetupCopy } from '@/lib/passwordSetupCopy';

export default function SetPasswordScreen() {
  const { user, isLoaded } = useUser();
  const { session } = useSession();
  const { t } = useI18n();
  const s = usePasswordSetupCopy();
  const [stage, setStage] = useState<'start' | 'code' | 'password' | 'done'>('start');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false);

  async function run(action: () => Promise<void>) {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setError(null);
    try { await action(); }
    catch (e) { setError(clerkErrorMessage(e, t('genericError'))); }
    finally { inFlight.current = false; setBusy(false); }
  }

  async function sendCode() {
    if (!session || !user) return;
    const verification = await session.startVerification({ level: 'first_factor' });
    const factor = verification.supportedFirstFactors?.find(
      (f) => f.strategy === 'email_code' && f.emailAddressId === user.primaryEmailAddressId,
    );
    if (!factor || factor.strategy !== 'email_code') throw new Error(t('genericError'));
    await session.prepareFirstFactorVerification({ strategy: 'email_code', emailAddressId: factor.emailAddressId });
    setCode('');
    setStage('code');
  }

  async function verifyCode() {
    if (!session) return;
    const result = await session.attemptFirstFactorVerification({ strategy: 'email_code', code: code.trim() });
    if (result.status !== 'complete') throw new Error(t('secondFactor'));
    setCode('');
    setStage('password');
  }

  async function save() {
    if (!user || user.passwordEnabled) return;
    if (password !== confirm) { setError(s.mismatch); return; }
    await user.updatePassword({ newPassword: password });
    setPassword('');
    setConfirm('');
    setStage('done');
  }

  if (!isLoaded) return null;
  if (!user) return <Redirect href="/sign-in" />;

  return (
    <Shell fallback="/settings">
      <Title title={s.title} body={s.body} />
      <Card style={{ gap: 16 }}>
        {stage === 'done' ? <Banner text={s.success} tone="info" /> :
          user.passwordEnabled ? <Banner text={s.existing} tone="info" /> : <>
            {stage === 'start' && <>
              <Banner text={user.primaryEmailAddress?.emailAddress ?? t('genericError')} tone="info" />
              <PillButton testID="password-send-code" label={t('sendCode')} onPress={() => void run(sendCode)} loading={busy} disabled={!session || !user.primaryEmailAddress} />
            </>}
            {stage === 'code' && <>
              <Banner text={t('codeSent')} tone="info" />
              <Field testID="password-verify-code" label={t('code')} value={code} onChangeText={setCode} keyboardType="number-pad" autoComplete="one-time-code" maxLength={6} />
              <PillButton testID="password-verify" label={t('continue')} onPress={() => void run(verifyCode)} loading={busy} disabled={code.trim().length !== 6} />
              <PillButton testID="password-resend" label={t('resend')} onPress={() => void run(sendCode)} disabled={busy} />
            </>}
            {stage === 'password' && <>
              <Field testID="setup-password" label={t('newPassword')} value={password} onChangeText={setPassword} secureTextEntry autoComplete="new-password" placeholder={t('passwordPh')} />
              <Field testID="setup-password-confirm" label={s.confirm} value={confirm} onChangeText={setConfirm} secureTextEntry autoComplete="new-password" />
              <PillButton testID="password-save" label={t('save')} onPress={() => void run(save)} loading={busy} disabled={!password || !confirm} />
            </>}
          </>}
        <Banner text={error} />
      </Card>
    </Shell>
  );
}
