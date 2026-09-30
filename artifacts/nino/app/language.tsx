import { Feather } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useState } from 'react';
import { Platform, Pressable, Text, TextInput, View } from 'react-native';
import { Shell } from '@/components/Shell';
import { Banner, PillButton, Title } from '@/components/ui';
import { useColors } from '@/hooks/useColors';
import { Lang, LANGS, useI18n } from '@/lib/i18n';

export default function LanguageScreen() {
  const { from } = useLocalSearchParams<{ from?: string }>();
  const c = useColors();
  const { lang, setLang, t, font, row, align } = useI18n();
  const [query, setQuery] = useState('');
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);
  const normalize = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const filtered = LANGS.filter((l) => normalize(`${l.native} ${l.english} ${l.code}`).includes(normalize(query.trim())));

  const choose = async (l: Lang) => {
    if (saving) return;
    setSaving(true);
    setFailed(false);
    try {
      await setLang(l);
      setQuery('');
    } catch {
      setFailed(true);
    } finally {
      setSaving(false);
    }
  };

  const done = () => {
    if (from === 'switch') router.canGoBack() ? router.back() : router.replace('/');
    else router.replace('/sign-up');
  };

  return (
    <Shell right={<View />}>
      <Title title={t('chooseLanguage')} body={t('chooseLanguageBody')} />
      <TextInput testID="language-search" value={query} onChangeText={setQuery}
        placeholder={t('searchLanguages')} accessibilityLabel={t('searchLanguages')}
        placeholderTextColor={c.muted} autoCapitalize="none" autoCorrect={false}
        style={{ color: c.text, backgroundColor: c.card, borderColor: c.border, borderWidth: 1, borderRadius: 12, padding: 14, fontFamily: font(), textAlign: align }} />
      <Banner text={failed ? t('languageSaveError') : null} />
      <View style={{ gap: 12 }}>
        {filtered.length === 0 && <Text style={{ color: c.secondary, fontFamily: font(), textAlign: align }}>{t('noResults')}</Text>}
        {filtered.map((l) => {
          const on = lang === l.code;
          const nativeFont = ['ru', 'hi', 'zh', 'ja'].includes(l.code) ? (Platform.OS === 'ios' ? 'System' : 'sans-serif') : undefined;
          return (
            <Pressable
              key={l.code}
              testID={`lang-${l.code}`}
              accessibilityRole="radio"
              accessibilityLabel={`${l.native}, ${l.english}`}
              accessibilityState={{ checked: on, disabled: saving }}
              disabled={saving}
              onPress={() => choose(l.code)}
              style={({ pressed }) => [{
                flexDirection: row, alignItems: 'center', gap: 14, padding: 16, borderRadius: 18, borderWidth: 1,
                backgroundColor: on ? c.accentWash : c.card, borderColor: on ? c.accent : c.border,
                shadowColor: c.accent, shadowOpacity: 0, shadowRadius: 14, shadowOffset: { width: 0, height: 0 },
              }, pressed && { opacity: 0.85 }]}
            >
              <Text style={{ fontSize: 28 }}>{l.flag}</Text>
              <View style={{ flex: 1 }}>
                <Text style={{ color: c.text, fontSize: 17, textAlign: align, fontFamily: nativeFont ?? (l.code === 'ar' ? 'Cairo_700Bold' : 'Poppins_600SemiBold') }}>{l.native}</Text>
                <Text style={{ color: c.secondary, fontSize: 13, textAlign: align, fontFamily: nativeFont ?? (l.code === 'ar' ? 'Cairo_400Regular' : 'Poppins_400Regular') }}>{l.hello}</Text>
              </View>
              <View style={{ width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: on ? c.accent : c.muted, alignItems: 'center', justifyContent: 'center', backgroundColor: on ? c.accent : 'transparent' }}>
                {on ? <Feather name="check" size={14} color={c.onAccent} /> : null}
              </View>
            </Pressable>
          );
        })}
      </View>
      <View style={{ flex: 1 }} />
      <PillButton testID="language-continue" label={t('continue')} onPress={done} disabled={saving} />
      <Text style={{ color: c.muted, fontFamily: font('regular'), fontSize: 12, textAlign: 'center' }}>{t('tagline')}</Text>
    </Shell>
  );
}
