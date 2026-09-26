import React from 'react';
import { View } from 'react-native';
import { KeyboardAwareScrollViewCompat } from '@/components/KeyboardAwareScrollViewCompat';
import { GlobeMark } from '@/components/Brand';
import { Background, BackButton, LanguagePill, useInsets } from '@/components/ui';
import { useI18n } from '@/lib/i18n';

export function Shell({ children, back = true, fallback, right }: { children: React.ReactNode; back?: boolean; fallback?: string; right?: React.ReactNode }) {
  const ins = useInsets();
  const { row } = useI18n();
  return (
    <Background>
      <KeyboardAwareScrollViewCompat
        bottomOffset={24}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ flexGrow: 1, paddingTop: ins.top + 8, paddingBottom: ins.bottom + 24, paddingHorizontal: 22 }}
      >
        <View style={{ flexDirection: row, alignItems: 'center', justifyContent: 'space-between', height: 48, marginBottom: 18 }}>
          {back ? <BackButton fallback={fallback} /> : <GlobeMark size={36} />}
          {right ?? <LanguagePill />}
        </View>
        <View style={{ width: '100%', maxWidth: 480, alignSelf: 'center', gap: 22, flex: 1 }}>{children}</View>
      </KeyboardAwareScrollViewCompat>
    </Background>
  );
}
