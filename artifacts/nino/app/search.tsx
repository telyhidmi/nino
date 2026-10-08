import { useAuth } from '@clerk/expo';
import { Feather } from '@expo/vector-icons';
import { Redirect, router } from 'expo-router';
import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { KeyboardAwareScrollViewCompat } from '@/components/KeyboardAwareScrollViewCompat';
import { PeopleSearch } from '@/components/search/PeopleSearch';
import { useInsets } from '@/components/ui';
import { useColors } from '@/hooks/useColors';
import { useI18n } from '@/lib/i18n';
import { useMessagesCopy } from '@/lib/messagesCopy';

const SEARCH_USERS: Record<string, string> = {
  en: 'Search users', ar: 'البحث عن مستخدمين', pt: 'Buscar usuários', es: 'Buscar usuarios', fr: 'Rechercher des utilisateurs',
  de: 'Nutzer suchen', it: 'Cerca utenti', tr: 'Kullanıcı ara', ru: 'Поиск пользователей', hi: 'उपयोगकर्ता खोजें', zh: '搜索用户', ja: 'ユーザーを検索',
};

export default function SearchScreen() {
  const { isSignedIn } = useAuth();
  if (!isSignedIn) return <Redirect href="/" />;
  return <SearchUsers />;
}

function SearchUsers() {
  const c = useColors();
  const t = useMessagesCopy();
  const ins = useInsets();
  const { lang, font, row, align } = useI18n();
  const back = () => (router.canGoBack() ? router.back() : router.replace('/feed'));
  return (
    <View style={{ flex: 1, backgroundColor: c.bgTop, paddingTop: ins.top }} testID="search-screen">
      <View style={{ flexDirection: row, alignItems: 'center', gap: 6, paddingHorizontal: 8, minHeight: 52 }}>
        <Pressable testID="search-back" onPress={back} accessibilityRole="button" accessibilityLabel={t.back} hitSlop={8}
          style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}>
          <Feather name={align === 'right' ? 'chevron-right' : 'chevron-left'} size={26} color={c.text} />
        </Pressable>
        <Text accessibilityRole="header" numberOfLines={1} style={{ flex: 1, color: c.text, fontFamily: font('bold'), fontSize: 18, textAlign: align }}>
          {SEARCH_USERS[lang] ?? SEARCH_USERS.en}
        </Text>
      </View>
      <KeyboardAwareScrollViewCompat bottomOffset={16} keyboardDismissMode="on-drag"
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: ins.bottom + 24 }}>
        <PeopleSearch inlineFollow />
      </KeyboardAwareScrollViewCompat>
    </View>
  );
}
