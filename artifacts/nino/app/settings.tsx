import { useAuth, useClerk } from '@clerk/expo';
import { Feather } from '@expo/vector-icons';
import { useQueryClient, type QueryClient } from '@tanstack/react-query';
import { Redirect, router } from 'expo-router';
import React, { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Switch, Text, View } from 'react-native';
import {
  getGetPrivacySettingsQueryKey, getListBlockedMembersQueryKey, getListFollowRequestsQueryKey, getGetMessagingRelationshipQueryKey,
  useDecideFollowRequest, useGetPrivacySettings, useListBlockedMembers, useListFollowRequests, useSetMessagingBlock, useUpdatePrivacySettings,
  type MessagingProfile, type PrivacySettings,
} from '@workspace/api-client-react';
import { PersonAvatar } from '@/components/MessagingParts';
import { confirmAction } from '@/components/profile/ProfileView';
import { BackButton, Banner, LanguagePill, useInsets } from '@/components/ui';
import { useColors } from '@/hooks/useColors';
import { closeActiveLiveSession } from '@/lib/liveSession';
import { clerkErrorMessage } from '@/lib/data';
import { useI18n } from '@/lib/i18n';
import { invalidateInbox, isMessagingQuery } from '@/lib/messaging';
import { useSettingsCopy } from '@/lib/settingsCopy';

function refreshSocial(qc: QueryClient, peerId?: string) {
  void qc.invalidateQueries({ queryKey: getListFollowRequestsQueryKey() });
  void qc.invalidateQueries({ queryKey: ['/api/posts/following'] });
  void qc.invalidateQueries({ queryKey: ['/api/posts'] });
  void qc.invalidateQueries({ queryKey: ['/api/posts/mine'] });
  if (peerId) void qc.invalidateQueries({ queryKey: getGetMessagingRelationshipQueryKey(peerId) });
}

function SectionTitle({ label }: { label: string }) {
  const c = useColors();
  const { font, align } = useI18n();
  return <Text accessibilityRole="header" style={{ color: c.muted, fontFamily: font('semibold'), fontSize: 12, letterSpacing: 0.6, textTransform: 'uppercase', textAlign: align, paddingHorizontal: 20, paddingTop: 28, paddingBottom: 8 }}>{label}</Text>;
}

function Group({ children }: { children: React.ReactNode }) {
  const c = useColors();
  return <View style={{ marginHorizontal: 16, borderRadius: c.radius.card, backgroundColor: c.card, borderWidth: 1, borderColor: c.border, overflow: 'hidden' }}>{children}</View>;
}

function Row({ icon, label, body, onPress, right, danger, testID, first }: { icon: keyof typeof Feather.glyphMap; label: string; body?: string; onPress?: () => void; right?: React.ReactNode; danger?: boolean; testID: string; first?: boolean }) {
  const c = useColors();
  const { font, row, align, rtl } = useI18n();
  return (
    <Pressable testID={testID} onPress={onPress} accessible={!!onPress} accessibilityRole={onPress ? 'button' : undefined}
      style={({ pressed }) => ({ flexDirection: row, alignItems: 'center', gap: 14, minHeight: 56, paddingHorizontal: 16, paddingVertical: 12, borderTopWidth: first ? 0 : 1, borderTopColor: c.border, backgroundColor: pressed && onPress ? c.cardSoft : 'transparent' })}>
      <View style={{ width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: danger ? c.dangerWash : c.accentWash }}>
        <Feather name={icon} size={17} color={danger ? c.danger : c.accent} />
      </View>
      <View style={{ flex: 1, gap: 3 }}>
        <Text style={{ color: danger ? c.danger : c.text, fontFamily: font('medium'), fontSize: 15, textAlign: align }}>{label}</Text>
        {body ? <Text style={{ color: c.secondary, fontFamily: font('regular'), fontSize: 12.5, lineHeight: 18, textAlign: align }}>{body}</Text> : null}
      </View>
      {right ?? (onPress && !danger ? <Feather name={rtl ? 'chevron-left' : 'chevron-right'} size={18} color={c.muted} /> : null)}
    </Pressable>
  );
}

function StateBlock({ loading, error, onRetry, empty, emptyIcon }: { loading: boolean; error: boolean; onRetry: () => void; empty?: { title: string; body: string }; emptyIcon: keyof typeof Feather.glyphMap }) {
  const c = useColors();
  const s = useSettingsCopy();
  const { font, row } = useI18n();
  if (loading) return (
    <View style={{ padding: 16, gap: 14 }}>
      {[0.6, 0.42].map((w, i) => (
        <View key={i} style={{ flexDirection: row, gap: 12, alignItems: 'center' }}>
          <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: c.cardSoft }} />
          <View style={{ height: 12, width: `${w * 100}%`, borderRadius: 6, backgroundColor: c.cardSoft }} />
        </View>
      ))}
    </View>
  );
  if (error) return (
    <View style={{ padding: 16, gap: 8, alignItems: 'center' }}>
      <Text style={{ color: c.danger, fontFamily: font('medium'), fontSize: 13, textAlign: 'center' }}>{s.loadFailed}</Text>
      <Pressable onPress={onRetry} accessibilityRole="button" style={{ minHeight: 44, justifyContent: 'center', paddingHorizontal: 16 }}>
        <Text style={{ color: c.accent, fontFamily: font('semibold'), fontSize: 14 }}>{s.retry}</Text>
      </Pressable>
    </View>
  );
  if (empty) return (
    <View style={{ paddingVertical: 22, paddingHorizontal: 20, alignItems: 'center', gap: 6 }}>
      <Feather name={emptyIcon} size={22} color={c.muted} />
      <Text style={{ color: c.text, fontFamily: font('semibold'), fontSize: 14, textAlign: 'center' }}>{empty.title}</Text>
      <Text style={{ color: c.secondary, fontFamily: font('regular'), fontSize: 12.5, lineHeight: 18, textAlign: 'center' }}>{empty.body}</Text>
    </View>
  );
  return null;
}

function SmallBtn({ label, onPress, primary, busy, testID }: { label: string; onPress: () => void; primary?: boolean; busy?: boolean; testID: string }) {
  const c = useColors();
  const { font } = useI18n();
  return (
    <Pressable testID={testID} onPress={onPress} disabled={busy} accessibilityRole="button" accessibilityState={{ busy }} hitSlop={4}
      style={({ pressed }) => ({ height: 34, minWidth: 78, paddingHorizontal: 12, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: primary ? c.accent : 'transparent', borderWidth: 1, borderColor: primary ? c.accent : c.borderStrong, opacity: pressed || busy ? 0.6 : 1 })}>
      {busy ? <ActivityIndicator size="small" color={primary ? c.onAccent : c.text} /> : <Text style={{ color: primary ? c.onAccent : c.text, fontFamily: font('semibold'), fontSize: 12.5 }}>{label}</Text>}
    </Pressable>
  );
}

function PersonRow({ p, first, actions }: { p: MessagingProfile; first: boolean; actions: React.ReactNode }) {
  const c = useColors();
  const { font, row, align } = useI18n();
  return (
    <View style={{ flexDirection: row, alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 12, borderTopWidth: first ? 0 : 1, borderTopColor: c.border }}>
      <PersonAvatar p={p} size={42} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text numberOfLines={1} style={{ color: c.text, fontFamily: font('semibold'), fontSize: 14.5, textAlign: align }}>{p.displayName}</Text>
        {p.username ? <Text numberOfLines={1} style={{ color: c.secondary, fontFamily: font('regular'), fontSize: 12.5, textAlign: align }}>@{p.username}</Text> : null}
      </View>
      <View style={{ flexDirection: row, gap: 8 }}>{actions}</View>
    </View>
  );
}

export default function SettingsScreen() {
  const { isSignedIn } = useAuth();
  const { signOut } = useClerk();
  const c = useColors();
  const ins = useInsets();
  const s = useSettingsCopy();
  const { t, font, row, align } = useI18n();
  const qc = useQueryClient();
  const enabled = !!isSignedIn;

  const settings = useGetPrivacySettings({ query: { queryKey: getGetPrivacySettingsQueryKey(), enabled } });
  const requests = useListFollowRequests({ query: { queryKey: getListFollowRequestsQueryKey(), enabled } });
  const blocked = useListBlockedMembers({ query: { queryKey: getListBlockedMembersQueryKey(), enabled } });
  const update = useUpdatePrivacySettings();
  const decide = useDecideFollowRequest();
  const unblock = useSetMessagingBlock();

  const [saveError, setSaveError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [savingKey, setSavingKey] = useState<keyof PrivacySettings | null>(null);
  const [sessionError, setSessionError] = useState<string | null>(null);

  if (!isSignedIn) return <Redirect href="/" />;

  const current = settings.data;
  const save = (key: keyof PrivacySettings, value: boolean) => {
    if (!current || update.isPending) return;
    const next: PrivacySettings = { privateAccount: current.privateAccount, allowMessageRequests: current.allowMessageRequests, [key]: value };
    setSaveError(null); setSavingKey(key);
    update.mutate({ data: next }, {
      onSuccess: (res) => {
        qc.setQueryData(getGetPrivacySettingsQueryKey(), res);
        refreshSocial(qc);
        void qc.invalidateQueries({ predicate: isMessagingQuery });
      },
      onError: () => { setSaveError(s.saveFailed); void settings.refetch(); },
      onSettled: () => setSavingKey(null),
    });
  };
  const togglePrivate = (v: boolean) => {
    if (!v) confirmAction(s.makePublicTitle, s.makePublicBody, s.makePublic, () => save('privateAccount', false), t('profileCancel'));
    else save('privateAccount', true);
  };
  const onDecide = (id: string, approve: boolean) => {
    if (busyId) return;
    setActionError(null); setBusyId(id);
    decide.mutate({ id, data: { approve } }, {
      onSuccess: () => {
        qc.setQueryData<MessagingProfile[]>(getListFollowRequestsQueryKey(), (old) => old?.filter((p) => p.id !== id));
        refreshSocial(qc, id);
        invalidateInbox(qc);
      },
      onError: () => { setActionError(s.actionFailed); void requests.refetch(); },
      onSettled: () => setBusyId(null),
    });
  };
  const onUnblock = (conversationId: string, peerId: string) => {
    if (busyId) return;
    setActionError(null); setBusyId(conversationId);
    unblock.mutate({ id: conversationId, data: { blocked: false } }, {
      onSuccess: () => {
        void qc.invalidateQueries({ queryKey: getListBlockedMembersQueryKey() });
        void qc.invalidateQueries({ predicate: isMessagingQuery });
        refreshSocial(qc, peerId);
      },
      onError: () => { setActionError(s.actionFailed); void blocked.refetch(); },
      onSettled: () => setBusyId(null),
    });
  };
  const doSignOut = async () => {
    setSessionError(null);
    try { await closeActiveLiveSession(); await signOut(); router.replace('/'); } catch (e) { setSessionError(clerkErrorMessage(e, t('genericError'))); }
  };

  const toggle = (key: keyof PrivacySettings, onChange: (v: boolean) => void) => (
    savingKey === key ? <ActivityIndicator size="small" color={c.accent} /> : (
      <Switch testID={`switch-${key}`} value={!!current?.[key]} onValueChange={onChange} disabled={!current || update.isPending}
        trackColor={{ false: c.borderStrong, true: c.accent }} thumbColor={c.onAccent} ios_backgroundColor={c.borderStrong}
        accessibilityLabel={key === 'privateAccount' ? s.privateAccount : s.messageRequests} />
    )
  );
  const reqList = requests.data ?? [];
  const blockList = blocked.data ?? [];

  return (
    <View testID="settings-screen" style={{ flex: 1, backgroundColor: c.background }}>
      <View style={{ paddingTop: ins.top + 6, paddingHorizontal: 12, paddingBottom: 10, flexDirection: row, alignItems: 'center', gap: 8, borderBottomWidth: 1, borderBottomColor: c.border }}>
        <BackButton fallback="/profile" />
        <Text accessibilityRole="header" numberOfLines={1} style={{ flex: 1, color: c.text, fontFamily: font('semibold'), fontSize: 17, textAlign: 'center' }}>{s.title}</Text>
        <View style={{ width: 40 }} />
      </View>
      <ScrollView contentContainerStyle={{ paddingBottom: ins.bottom + 32 }}>
        <SectionTitle label={s.account} />
        <Group>
          <Row first testID="settings-edit" icon="edit-2" label={s.editProfile} body={s.editProfileBody} onPress={() => router.push('/setup?mode=edit')} />
          <Row testID="settings-language" icon="globe" label={s.language} right={<LanguagePill />} />
        </Group>

        <SectionTitle label={s.privacy} />
        <Group>
          {settings.isPending || settings.isError ? <StateBlock loading={settings.isPending} error={settings.isError} onRetry={() => { void settings.refetch(); }} emptyIcon="lock" /> : <>
            <Row first testID="settings-private" icon="lock" label={s.privateAccount} body={s.privateBody} right={toggle('privateAccount', togglePrivate)} />
            <Row testID="settings-requests-toggle" icon="message-circle" label={s.messageRequests} body={s.messageRequestsBody} right={toggle('allowMessageRequests', (v) => save('allowMessageRequests', v))} />
          </>}
        </Group>
        {saveError ? <View style={{ marginHorizontal: 16, marginTop: 10 }}><Banner text={saveError} /></View> : null}

        <SectionTitle label={`${s.requests}${reqList.length ? ` · ${reqList.length}` : ''}`} />
        <Group>
          {requests.isPending || requests.isError || reqList.length === 0
            ? <StateBlock loading={requests.isPending} error={requests.isError} onRetry={() => { void requests.refetch(); }} empty={{ title: s.requestsEmpty, body: s.requestsEmptyBody }} emptyIcon="user-plus" />
            : reqList.map((p, i) => (
              <PersonRow key={p.id} p={p} first={i === 0} actions={<>
                <SmallBtn testID={`approve-${p.id}`} primary label={s.approve} busy={busyId === p.id && decide.variables?.data.approve === true} onPress={() => onDecide(p.id, true)} />
                <SmallBtn testID={`decline-${p.id}`} label={s.decline} busy={busyId === p.id && decide.variables?.data.approve === false} onPress={() => onDecide(p.id, false)} />
              </>} />
            ))}
        </Group>

        <SectionTitle label={s.blocked} />
        <Group>
          {blocked.isPending || blocked.isError || blockList.length === 0
            ? <StateBlock loading={blocked.isPending} error={blocked.isError} onRetry={() => { void blocked.refetch(); }} empty={{ title: s.blockedEmpty, body: s.blockedEmptyBody }} emptyIcon="slash" />
            : blockList.map((b, i) => (
              <PersonRow key={b.conversationId} p={b.profile} first={i === 0} actions={
                <SmallBtn testID={`unblock-${b.conversationId}`} label={s.unblock} busy={busyId === b.conversationId} onPress={() => onUnblock(b.conversationId, b.profile.id)} />
              } />
            ))}
        </Group>
        {actionError ? <View style={{ marginHorizontal: 16, marginTop: 10 }}><Banner text={actionError} /></View> : null}

        <SectionTitle label={s.session} />
        <Group>
          <Row first testID="settings-sign-out" icon="log-out" label={t('signOut')} danger onPress={() => confirmAction(t('signOutConfirm'), '', t('signOut'), doSignOut, t('profileCancel'))} />
        </Group>
        {sessionError ? <View style={{ marginHorizontal: 16, marginTop: 10 }}><Banner text={sessionError} /></View> : null}
        <Text style={{ color: c.muted, fontFamily: font('regular'), fontSize: 11.5, textAlign: align, paddingHorizontal: 20, paddingTop: 20 }}>Nino</Text>
      </ScrollView>
    </View>
  );
}
