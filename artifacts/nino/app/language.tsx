import { Feather } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { FlatList, Platform, Pressable, Text, TextInput, View } from 'react-native';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import { Background, BackButton, Banner, PillButton, useInsets } from '@/components/ui';
import { useColors } from '@/hooks/useColors';
import { Lang, LANGS, useI18n } from '@/lib/i18n';

const SYS_FONT = Platform.OS === 'ios' ? 'System' : 'sans-serif';

export default function LanguageScreen() {
  const { from } = useLocalSearchParams<{ from?: string }>();
  const c = useColors();
  const ins = useInsets();
  const { lang, setLang, t, font, row, align, rtl } = useI18n();
  const [query, setQuery] = useState('');
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);
  const normalize = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

  const list = useMemo(() => {
    const q = normalize(query.trim());
    const matches = LANGS.filter((l) => normalize(`${l.native} ${l.english} ${l.code}`).includes(q));
    const cur = matches.filter((l) => l.code === lang);
    return [...cur, ...matches.filter((l) => l.code !== lang)];
  }, [query, lang]);

  const choose = async (l: Lang) => {
    if (saving || l === lang) return;
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
    <Background>
      <KeyboardAvoidingView behavior="padding" style={{ flex: 1 }}>
        <View style={{ flex: 1, width: '100%', maxWidth: 480, alignSelf: 'center', paddingTop: ins.top + 8, paddingHorizontal: 20 }}>
          <View style={{ flexDirection: row, alignItems: 'center', gap: 12, height: 48, marginBottom: 10 }}>
            <BackButton />
            <Text numberOfLines={1} style={{ flex: 1, color: c.text, fontFamily: font('bold'), fontSize: 22, textAlign: align }}>{t('chooseLanguage')}</Text>
          </View>
          <Text numberOfLines={2} style={{ color: c.secondary, fontFamily: font('regular'), fontSize: 13, lineHeight: 19, textAlign: align, marginBottom: 12 }}>{t('chooseLanguageBody')}</Text>

          <View style={{ flexDirection: row, alignItems: 'center', gap: 8, backgroundColor: c.card, borderColor: c.border, borderWidth: 1, borderRadius: 14, paddingHorizontal: 14, height: 46 }}>
            <Feather name="search" size={16} color={c.secondary} />
            <TextInput testID="language-search" value={query} onChangeText={setQuery}
              placeholder={t('searchLanguages')} accessibilityLabel={t('searchLanguages')}
              placeholderTextColor={c.muted} autoCapitalize="none" autoCorrect={false} returnKeyType="search"
              style={{ flex: 1, color: c.text, fontFamily: font(), fontSize: 15, textAlign: align, paddingVertical: 0 }} />
            {query ? (
              <Pressable onPress={() => setQuery('')} hitSlop={10} accessibilityRole="button" accessibilityLabel={t('cancel')}>
                <Feather name="x-circle" size={16} color={c.muted} />
              </Pressable>
            ) : null}
          </View>

          {failed ? <View style={{ marginTop: 10 }}><Banner text={t('languageSaveError')} /></View> : null}

          <FlatList
            style={{ flex: 1, marginTop: 10 }}
            contentContainerStyle={{ paddingBottom: 12, gap: 6 }}
            data={list}
            keyExtractor={(l) => l.code}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            scrollEnabled={list.length > 0}
            accessibilityRole="radiogroup"
            ListEmptyComponent={
              <View style={{ alignItems: 'center', padding: 28, gap: 8 }}>
                <Feather name="globe" size={24} color={c.muted} />
                <Text style={{ color: c.secondary, fontFamily: font(), textAlign: 'center' }}>{t('noResults')}</Text>
              </View>
            }
            renderItem={({ item: l }) => {
              const on = lang === l.code;
              const nativeFont = ['ru', 'hi', 'zh', 'ja'].includes(l.code) ? SYS_FONT : undefined;
              return (
                <Pressable
                  testID={`lang-${l.code}`}
                  accessibilityRole="radio"
                  accessibilityLabel={`${l.native}, ${l.english}`}
                  accessibilityState={{ checked: on, disabled: saving }}
                  disabled={saving}
                  onPress={() => choose(l.code)}
                  style={({ pressed }) => [{
                    flexDirection: row, alignItems: 'center', gap: 12, paddingVertical: 10, paddingHorizontal: 14, borderRadius: 14, borderWidth: 1,
                    backgroundColor: on ? c.accentWash : c.card, borderColor: on ? c.accent : c.border,
                  }, on && { marginBottom: 6 }, pressed && { opacity: 0.8 }]}
                >
                  <Text style={{ fontSize: 22 }}>{l.flag}</Text>
                  <View style={{ flex: 1 }}>
                    <Text numberOfLines={1} style={{ color: c.text, fontSize: 15, textAlign: align, fontFamily: nativeFont ?? (l.code === 'ar' ? 'Cairo_700Bold' : 'Poppins_600SemiBold') }}>{l.native}</Text>
                    <Text numberOfLines={1} style={{ color: c.secondary, fontSize: 12, textAlign: align, fontFamily: nativeFont ?? (l.code === 'ar' ? 'Cairo_400Regular' : 'Poppins_400Regular') }}>{l.hello}</Text>
                  </View>
                  <View style={{ width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: on ? c.accent : c.muted, alignItems: 'center', justifyContent: 'center', backgroundColor: on ? c.accent : 'transparent' }}>
                    {on ? <Feather name="check" size={13} color={c.onAccent} /> : null}
                  </View>
                </Pressable>
              );
            }}
          />

          <View style={{ paddingTop: 10, paddingBottom: ins.bottom + 10, gap: 8, borderTopWidth: 1, borderTopColor: c.border }}>
            <PillButton testID="language-continue" label={t('continue')} onPress={done} disabled={saving}
              icon={rtl ? 'arrow-left' : 'arrow-right'} />
            <Text numberOfLines={1} style={{ color: c.muted, fontFamily: font('regular'), fontSize: 11, textAlign: 'center' }}>{t('tagline')}</Text>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Background>
  );
}
