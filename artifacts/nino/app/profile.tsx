import { useAuth, useClerk, useUser } from '@clerk/expo';
import { Feather } from '@expo/vector-icons';
import { Redirect, router } from 'expo-router';
import React, { useState } from 'react';
import { Alert, Platform, Text, View } from 'react-native';
import { Avatar } from '@/components/Avatar';
import { GlobeMark } from '@/components/Brand';
import { Shell } from '@/components/Shell';
import { Banner, Card, LanguagePill, PillButton } from '@/components/ui';
import { useColors } from '@/hooks/useColors';
import { clerkErrorMessage, countryBy, languageBy, readProfile } from '@/lib/data';
import { useI18n } from '@/lib/i18n';

function Row({ icon, label, children }: { icon: keyof typeof Feather.glyphMap; label: string; children: React.ReactNode }) {
  const c = useColors();
  const { font, row, align } = useI18n();
  return (
    <View style={{ flexDirection: row, gap: 14, alignItems: 'flex-start', paddingVertical: 12 }}>
      <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: c.accentWash, alignItems: 'center', justifyContent: 'center' }}>
        <Feather name={icon} size={16} color={c.accent} />
      </View>
      <View style={{ flex: 1, gap: 6 }}>
        <Text style={{ color: c.secondary, fontFamily: font('regular'), fontSize: 12, textAlign: align }}>{label}</Text>
        {children}
      </View>
    </View>
  );
}

export default function ProfileScreen() {
  const { isSignedIn } = useAuth();
  const { user } = useUser();
  const { signOut } = useClerk();
  const c = useColors();
  const { t, font, row, align, lang } = useI18n();
  const [error, setError] = useState<string | null>(null);
  const [leaving, setLeaving] = useState(false);

  if (!isSignedIn || !user) return <Redirect href="/" />;
  const p = readProfile(user.unsafeMetadata);
  if (!p.profileComplete) return <Redirect href="/setup" />;
  const ctry = countryBy(p.country);

  const doSignOut = async () => {
    setLeaving(true); setError(null);
    try {
      await signOut();
      router.replace('/');
    } catch (e) {
      setError(clerkErrorMessage(e, t('genericError')));
      setLeaving(false);
    }
  };
  const confirm = () => {
    if (Platform.OS === 'web') return doSignOut();
    Alert.alert(t('signOutConfirm'), undefined, [
      { text: t('cancel'), style: 'cancel' },
      { text: t('signOut'), style: 'destructive', onPress: doSignOut },
    ]);
  };
  const since = user.createdAt ? new Intl.DateTimeFormat(lang, { month: 'long', year: 'numeric' }).format(user.createdAt) : '';
  const Chip = ({ label, strong }: { label: string; strong?: boolean }) => (
    <View style={{ paddingHorizontal: 12, height: 30, borderRadius: 999, justifyContent: 'center', borderWidth: 1, borderColor: strong ? c.accent : c.border, backgroundColor: strong ? c.accentWash : 'transparent' }}>
      <Text style={{ color: c.text, fontFamily: font('medium'), fontSize: 13 }}>{label}</Text>
    </View>
  );

  return (
    <Shell back fallback="/feed">
      <View style={{ alignItems: 'center', gap: 12 }}>
        <Avatar uri={user.hasImage ? user.imageUrl : null} name={p.displayName} size={116} flag={ctry?.flag} />
        <Text style={{ color: c.text, fontFamily: font('bold'), fontSize: 24, textAlign: 'center' }}>{p.displayName}</Text>
        <Text style={{ color: c.secondary, fontFamily: font('regular'), fontSize: 13 }}>{user.primaryEmailAddress?.emailAddress}</Text>
        <View style={{ flexDirection: row, alignItems: 'center', gap: 6, paddingHorizontal: 12, height: 28, borderRadius: 999, backgroundColor: c.accentWash }}>
          <Feather name="check-circle" size={13} color={c.accent} />
          <Text style={{ color: c.accent, fontFamily: font('medium'), fontSize: 12 }}>{t('profileReady')}</Text>
        </View>
      </View>

      <Card style={{ paddingVertical: 6 }}>
        <Row icon="map-pin" label={t('from')}>
          <Text style={{ color: c.text, fontFamily: font('medium'), fontSize: 15, textAlign: align }}>{ctry ? `${ctry.flag}  ${ctry.name}` : '—'}</Text>
        </Row>
        <View style={{ height: 1, backgroundColor: c.border, opacity: 0.5 }} />
        <Row icon="mic" label={t('speaks')}>
          <View style={{ flexDirection: row }}><Chip strong label={languageBy(p.nativeLanguage)?.native ?? p.nativeLanguage} /></View>
        </Row>
        <View style={{ height: 1, backgroundColor: c.border, opacity: 0.5 }} />
        <Row icon="headphones" label={t('understands')}>
          <View style={{ flexDirection: row, flexWrap: 'wrap', gap: 8 }}>
            {p.understands.map((k) => <Chip key={k} label={languageBy(k)?.native ?? k} />)}
          </View>
        </Row>
        <View style={{ height: 1, backgroundColor: c.border, opacity: 0.5 }} />
        <Row icon="globe" label={t('appLanguage')}>
          <View style={{ flexDirection: row }}><LanguagePill /></View>
        </Row>
        {since ? (
          <>
            <View style={{ height: 1, backgroundColor: c.border, opacity: 0.5 }} />
            <Row icon="calendar" label={t('memberSince')}>
              <Text style={{ color: c.text, fontFamily: font('medium'), fontSize: 15, textAlign: align }}>{since}</Text>
            </Row>
          </>
        ) : null}
      </Card>

      <Card style={{ flexDirection: row, alignItems: 'center', gap: 14, backgroundColor: c.cardSoft }}>
        <GlobeMark size={40} />
        <Text style={{ flex: 1, color: c.secondary, fontFamily: font('regular'), fontSize: 13, lineHeight: 20, textAlign: align }}>{t('comingSoon')}</Text>
      </Card>

      <Banner text={error} />
      <PillButton testID="edit-profile" label={t('edit')} icon="edit-2" onPress={() => router.push('/setup?mode=edit')} />
      <PillButton testID="sign-out" variant="danger" label={t('signOut')} icon="log-out" onPress={confirm} loading={leaving} />
    </Shell>
  );
}
