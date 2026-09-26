import { useAuth, useUser } from '@clerk/expo';
import { Feather } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { Redirect, router, useLocalSearchParams } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Avatar } from '@/components/Avatar';
import { Shell } from '@/components/Shell';
import { Banner, Field, PickerSheet, PickItem, PillButton, SelectField, Title } from '@/components/ui';
import { useColors } from '@/hooks/useColors';
import { clerkErrorMessage, COUNTRIES, countryBy, LANGUAGES, languageBy, readProfile } from '@/lib/data';
import { useI18n } from '@/lib/i18n';

type Sheet = null | 'country' | 'native' | 'understand';

export default function SetupScreen() {
  const { isSignedIn } = useAuth();
  const { user } = useUser();
  const { mode } = useLocalSearchParams<{ mode?: string }>();
  const editing = mode === 'edit';
  const c = useColors();
  const { t, font, row, align } = useI18n();
  const initial = readProfile(user?.unsafeMetadata);

  const [name, setName] = useState(initial.displayName || user?.firstName || '');
  const [country, setCountry] = useState(initial.country);
  const [native, setNative] = useState(initial.nativeLanguage);
  const [understands, setUnderstands] = useState<string[]>(initial.understands);
  const [photo, setPhoto] = useState<{ preview: string; file: string } | null>(null);
  const [sheet, setSheet] = useState<Sheet>(null);
  const [errs, setErrs] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const countryItems = useMemo<PickItem[]>(() => COUNTRIES.map((x) => ({ key: x.code, title: x.name, lead: x.flag })), []);
  const langItems = useMemo<PickItem[]>(() => LANGUAGES.map((x) => ({ key: x.code, title: x.native, subtitle: x.name })), []);

  if (!isSignedIn || !user) return <Redirect href="/" />;

  const pickPhoto = async () => {
    setError(null);
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return setError(t('photoDenied'));
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.7, base64: true });
    if (res.canceled || !res.assets[0]) return;
    const a = res.assets[0];
    const file = a.base64 ? `data:${a.mimeType ?? 'image/jpeg'};base64,${a.base64}` : a.uri;
    setPhoto({ preview: a.uri, file });
  };

  const save = async () => {
    const e: Record<string, string> = {};
    if (!name.trim()) e.name = t('requiredName');
    if (!country) e.country = t('requiredCountry');
    if (!native) e.native = t('requiredNative');
    if (understands.length === 0) e.understand = t('requiredUnderstand');
    setErrs(e);
    if (Object.keys(e).length) return;
    setSaving(true); setError(null);
    try {
      if (photo) await user.setProfileImage({ file: photo.file });
      await user.update({
        unsafeMetadata: {
          ...user.unsafeMetadata,
          displayName: name.trim(), country, nativeLanguage: native, understands, profileComplete: true,
        },
      });
      await user.reload();
      router.replace('/profile');
    } catch (err) {
      setError(clerkErrorMessage(err, t('genericError')));
    } finally {
      setSaving(false);
    }
  };

  const ctry = countryBy(country);
  const toggleUnderstand = (k: string) => setUnderstands((u) => (u.includes(k) ? u.filter((x) => x !== k) : [...u, k]));

  return (
    <Shell back={editing} fallback="/profile">
      <Title title={editing ? t('editTitle') : t('setupTitle')} body={t('setupBody')} />
      <Pressable testID="pick-photo" onPress={pickPhoto} style={{ alignItems: 'center', gap: 10 }}>
        <Avatar uri={photo?.preview ?? (user.hasImage ? user.imageUrl : null)} name={name} size={108} />
        <View style={{ flexDirection: row, alignItems: 'center', gap: 6 }}>
          <Feather name="camera" size={15} color={c.accent} />
          <Text style={{ color: c.accent, fontFamily: font('medium'), fontSize: 14 }}>{photo || user.hasImage ? t('changePhoto') : t('addPhoto')}</Text>
        </View>
      </Pressable>

      <Field testID="display-name" label={t('displayName')} value={name} onChangeText={setName} placeholder={t('displayNamePh')} maxLength={40} error={errs.name} />
      <SelectField testID="country" label={t('country')} placeholder={t('selectCountry')} value={ctry?.name} lead={ctry?.flag} onPress={() => setSheet('country')} error={errs.country} />
      <SelectField testID="native-language" label={t('nativeLanguage')} placeholder={t('selectLanguage')} value={languageBy(native)?.native} onPress={() => setSheet('native')} error={errs.native} />

      <View style={{ gap: 8 }}>
        <Text style={{ color: c.secondary, fontFamily: font('medium'), fontSize: 13, textAlign: align }}>{t('understand')}</Text>
        <Text style={{ color: c.muted, fontFamily: font('regular'), fontSize: 12, textAlign: align }}>{t('understandHint')}</Text>
        <View style={{ flexDirection: row, flexWrap: 'wrap', gap: 8, marginTop: 4 }}>
          {understands.map((k) => (
            <Pressable key={k} testID={`chip-${k}`} onPress={() => toggleUnderstand(k)} style={{ flexDirection: row, alignItems: 'center', gap: 6, paddingHorizontal: 14, height: 36, borderRadius: 999, backgroundColor: c.accentWash, borderWidth: 1, borderColor: c.accent }}>
              <Text style={{ color: c.text, fontFamily: font('medium'), fontSize: 13 }}>{languageBy(k)?.native}</Text>
              <Feather name="x" size={14} color={c.accent} />
            </Pressable>
          ))}
          <Pressable testID="add-understand" onPress={() => setSheet('understand')} style={{ flexDirection: row, alignItems: 'center', gap: 6, paddingHorizontal: 14, height: 36, borderRadius: 999, borderWidth: 1, borderStyle: 'dashed', borderColor: errs.understand ? c.danger : c.border }}>
            <Feather name="plus" size={14} color={c.accent} />
            <Text style={{ color: c.secondary, fontFamily: font('medium'), fontSize: 13 }}>{t('selectLanguage')}</Text>
          </Pressable>
        </View>
        {errs.understand ? <Text style={{ color: c.danger, fontFamily: font('regular'), fontSize: 12, textAlign: align }}>{errs.understand}</Text> : null}
      </View>

      <Banner text={error} />
      <PillButton testID="save-profile" label={editing ? t('save') : t('finish')} onPress={save} loading={saving} />
      {editing ? <PillButton variant="ghost" label={t('cancel')} onPress={() => router.replace('/profile')} /> : null}

      <PickerSheet visible={sheet === 'country'} title={t('selectCountry')} items={countryItems} selected={country ? [country] : []} onToggle={setCountry} onClose={() => setSheet(null)} />
      <PickerSheet visible={sheet === 'native'} title={t('nativeLanguage')} items={langItems} selected={native ? [native] : []} onToggle={setNative} onClose={() => setSheet(null)} />
      <PickerSheet visible={sheet === 'understand'} title={t('understand')} items={langItems} selected={understands} multi onToggle={toggleUnderstand} onClose={() => setSheet(null)} />
    </Shell>
  );
}
