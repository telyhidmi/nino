import { useAuth, useUser } from '@clerk/expo';
import { Redirect, router } from 'expo-router';
import React, { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';
import { WorldArt, Wordmark } from '@/components/Brand';
import { Background, LanguagePill, PillButton, useInsets } from '@/components/ui';
import { useColors } from '@/hooks/useColors';
import { readProfile } from '@/lib/data';
import { useI18n } from '@/lib/i18n';

function Rise({ delay, children }: { delay: number; children: React.ReactNode }) {
  const v = useSharedValue(0);
  useEffect(() => { v.value = withDelay(delay, withTiming(1, { duration: 700 })); }, [delay, v]);
  const st = useAnimatedStyle(() => ({ opacity: v.value, transform: [{ translateY: (1 - v.value) * 18 }] }));
  return <Animated.View style={st}>{children}</Animated.View>;
}

export default function Welcome() {
  const { isSignedIn } = useAuth();
  const { user } = useUser();
  const c = useColors();
  const ins = useInsets();
  const { t, font, languageChosen, rtl } = useI18n();

  if (isSignedIn) {
    return <Redirect href={readProfile(user?.unsafeMetadata).profileComplete ? '/feed' : '/setup'} />;
  }

  return (
    <Background>
      <View style={[styles.wrap, { paddingTop: ins.top + 8, paddingBottom: ins.bottom + 16 }]}>
        <View style={styles.top}><LanguagePill /></View>
        <View style={styles.center}>
          <Rise delay={0}><WorldArt size={270} /></Rise>
          <Rise delay={250}>
            <View style={{ alignItems: 'center', gap: 6, marginTop: 8 }}>
              <Wordmark height={62} />
              <Text style={{ color: c.text, fontFamily: 'Cairo_700Bold', fontSize: 18 }}>عالم واحد صوت واحد</Text>
              <Text style={{ color: c.accent, fontFamily: 'Poppins_500Medium', fontSize: 14, letterSpacing: 1.5 }}>One World   One Voice</Text>
            </View>
          </Rise>
          <Rise delay={450}>
            <View style={{ gap: 8, alignItems: 'center', paddingHorizontal: 12 }}>
              <Text style={{ color: c.text, fontFamily: font('semibold'), fontSize: 22, textAlign: 'center', lineHeight: rtl ? 36 : 30 }}>{t('welcomeTitle')}</Text>
              <Text style={{ color: c.secondary, fontFamily: font('regular'), fontSize: 14, textAlign: 'center', lineHeight: 22, maxWidth: 340 }}>{t('welcomeBody')}</Text>
            </View>
          </Rise>
        </View>
        <Rise delay={650}>
          <View style={{ gap: 12, width: '100%', maxWidth: 440, alignSelf: 'center' }}>
            <PillButton testID="get-started" label={t('getStarted')} icon="globe" onPress={() => router.push(languageChosen ? '/sign-up' : '/language')} />
            <PillButton testID="have-account" variant="ghost" label={t('haveAccount')} onPress={() => router.push('/sign-in')} />
          </View>
        </Rise>
      </View>
    </Background>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, paddingHorizontal: 22 },
  top: { alignItems: 'flex-end', height: 44, justifyContent: 'center' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 18 },
});
