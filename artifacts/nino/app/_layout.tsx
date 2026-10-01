import { ClerkLoaded, ClerkProvider, useAuth } from '@clerk/expo';
import { tokenCache } from '@clerk/expo/token-cache';
import { Cairo_400Regular, Cairo_600SemiBold, Cairo_700Bold } from '@expo-google-fonts/cairo';
import { Poppins_400Regular, Poppins_500Medium, Poppins_600SemiBold, Poppins_700Bold, useFonts } from '@expo-google-fonts/poppins';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useRef } from 'react';
import { Text, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Wordmark } from '@/components/Brand';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { RequiredLocationGate } from '@/components/RequiredLocationGate';
import { Background, Card } from '@/components/ui';
import colors from '@/constants/colors';
import { I18nProvider } from '@/lib/i18n';
import { setAuthTokenGetter, setBaseUrl } from '@workspace/api-client-react';
import { apiOrigin } from '@/lib/posts';

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();
setBaseUrl(apiOrigin || null);
const publishableKey = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY;
const proxyUrl = process.env.EXPO_PUBLIC_CLERK_PROXY_URL || undefined;

function MissingAuthConfig() {
  const c = colors.dark;
  return (
    <Background>
      <View style={{ flex: 1, justifyContent: 'center', padding: 24, gap: 24, alignItems: 'center' }}>
        <Wordmark height={52} />
        <Card style={{ gap: 10, maxWidth: 440 }}>
          <Text style={{ color: c.danger, fontFamily: 'Poppins_600SemiBold', fontSize: 16 }}>Authentication is not configured</Text>
          <Text style={{ color: c.secondary, fontFamily: 'Poppins_400Regular', fontSize: 14, lineHeight: 21 }}>
            EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY is missing from this build, so sign-in cannot start. In development it is injected
            from CLERK_PUBLISHABLE_KEY by the dev script; in production by scripts/build.js. Make sure Clerk is provisioned and
            restart the app.
          </Text>
        </Card>
      </View>
    </Background>
  );
}

function RootNav() {
  const { getToken, userId } = useAuth();
  const previousUser = useRef(userId);
  // Register before child queries mount (including web, where the API uses bearer auth).
  setAuthTokenGetter(() => getToken());
  useEffect(() => {
    // Do not allow account-specific post data to survive sign-out/account switches.
    const oldUser = previousUser.current;
    if (oldUser && oldUser !== userId) queryClient.removeQueries({ queryKey: ['/api/posts/mine', oldUser] });
    previousUser.current = userId;
  }, [userId]);
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.dark.bgTop }, animation: 'fade' }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="language" options={{ animation: 'slide_from_bottom' }} />
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="setup" />
      <Stack.Screen name="feed" />
      <Stack.Screen name="feed-preview" />
      <Stack.Screen name="profile" />
      <Stack.Screen name="live" />
    </Stack>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Poppins_400Regular, Poppins_500Medium, Poppins_600SemiBold, Poppins_700Bold, Cairo_400Regular, Cairo_600SemiBold, Cairo_700Bold,
  });

  useEffect(() => {
    if (fontsLoaded || fontError) SplashScreen.hideAsync();
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) return null;

  return (
    <SafeAreaProvider>
      <ErrorBoundary>
        <QueryClientProvider client={queryClient}>
          <GestureHandlerRootView style={{ flex: 1, backgroundColor: colors.dark.bgTop }}>
            <KeyboardProvider>
              <StatusBar style="light" />
              <I18nProvider>
                {publishableKey ? (
                  <ClerkProvider publishableKey={publishableKey} tokenCache={tokenCache} proxyUrl={proxyUrl}>
                    <RequiredLocationGate>
                      <ClerkLoaded>
                        <RootNav />
                      </ClerkLoaded>
                    </RequiredLocationGate>
                  </ClerkProvider>
                ) : (
                  <RequiredLocationGate>
                    <MissingAuthConfig />
                  </RequiredLocationGate>
                )}
              </I18nProvider>
            </KeyboardProvider>
          </GestureHandlerRootView>
        </QueryClientProvider>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}
