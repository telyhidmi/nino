import { Feather } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Shell } from '@/components/Shell';
import { PillButton, Title } from '@/components/ui';
import { useColors } from '@/hooks/useColors';
import { Lang, LANGS, useI18n } from '@/lib/i18n';

export default function LanguageScreen() {
  const { from } = useLocalSearchParams<{ from?: string }>();
  const c = useColors();
  const { lang, setLang, t, font, row, align } = useI18n();
  const [pick, setPick] = useState<Lang>(lang);

  const choose = async (l: Lang) => {
    setPick(l);
    await setLang(l);
  };

  const done = () => {
    if (from === 'switch') router.canGoBack() ? router.back() : router.replace('/');
    else router.replace('/sign-up');
  };

  return (
    <Shell right={<View />}>
      <Title title={t('chooseLanguage')} body={t('chooseLanguageBody')} />
      <View style={{ gap: 12 }}>
        {LANGS.map((l) => {
          const on = pick === l.code;
          return (
            <Pressable
              key={l.code}
              testID={`lang-${l.code}`}
              onPress={() => choose(l.code)}
              style={({ pressed }) => [{
                flexDirection: row, alignItems: 'center', gap: 14, padding: 16, borderRadius: 18, borderWidth: 1,
                backgroundColor: on ? c.accentWash : c.card, borderColor: on ? c.accent : c.border,
                shadowColor: c.accent, shadowOpacity: on ? 0.4 : 0, shadowRadius: 14, shadowOffset: { width: 0, height: 0 },
              }, pressed && { opacity: 0.85 }]}
            >
              <Text style={{ fontSize: 28 }}>{l.flag}</Text>
              <View style={{ flex: 1 }}>
                <Text style={{ color: c.text, fontSize: 17, textAlign: align, fontFamily: l.code === 'ar' ? 'Cairo_700Bold' : 'Poppins_600SemiBold' }}>{l.native}</Text>
                <Text style={{ color: c.secondary, fontSize: 13, textAlign: align, fontFamily: l.code === 'ar' ? 'Cairo_400Regular' : 'Poppins_400Regular' }}>{l.hello}</Text>
              </View>
              <View style={{ width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: on ? c.accent : c.muted, alignItems: 'center', justifyContent: 'center', backgroundColor: on ? c.accent : 'transparent' }}>
                {on ? <Feather name="check" size={14} color={c.onAccent} /> : null}
              </View>
            </Pressable>
          );
        })}
      </View>
      <View style={{ flex: 1 }} />
      <PillButton testID="language-continue" label={t('continue')} onPress={done} />
      <Text style={{ color: c.muted, fontFamily: font('regular'), fontSize: 12, textAlign: 'center' }}>{t('tagline')}</Text>
    </Shell>
  );
}
