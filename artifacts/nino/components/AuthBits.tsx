import { router } from 'expo-router';
import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { Wordmark } from '@/components/Brand';
import { useColors } from '@/hooks/useColors';
import { useI18n } from '@/lib/i18n';

export function AuthHeader() {
  return <View style={{ alignItems: 'center', marginBottom: 4 }}><Wordmark height={48} /></View>;
}

export function LinkRow({ prompt, action, href, testID }: { prompt: string; action: string; href: string; testID?: string }) {
  const c = useColors();
  const { font, row } = useI18n();
  return (
    <View style={{ flexDirection: row, justifyContent: 'center', gap: 6, flexWrap: 'wrap' }}>
      <Text style={{ color: c.secondary, fontFamily: font('regular'), fontSize: 14 }}>{prompt}</Text>
      <Pressable testID={testID} onPress={() => router.replace(href as never)} hitSlop={8}>
        <Text style={{ color: c.accent, fontFamily: font('semibold'), fontSize: 14 }}>{action}</Text>
      </Pressable>
    </View>
  );
}

export function TextLink({ label, onPress, testID, center = true }: { label: string; onPress: () => void; testID?: string; center?: boolean }) {
  const c = useColors();
  const { font } = useI18n();
  return (
    <Pressable testID={testID} onPress={onPress} hitSlop={8} style={{ alignSelf: center ? 'center' : 'flex-end' }}>
      <Text style={{ color: c.accent, fontFamily: font('medium'), fontSize: 14 }}>{label}</Text>
    </Pressable>
  );
}
