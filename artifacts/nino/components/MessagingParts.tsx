import { Feather } from '@expo/vector-icons';
import { Image } from 'expo-image';
import type { Href } from 'expo-router';
import React from 'react';
import { Text, View } from 'react-native';
import type { MessagingProfile } from '@workspace/api-client-react';
import { useColors } from '@/hooks/useColors';

export const threadHref = (id: string) => `/conversation?id=${encodeURIComponent(id)}` as Href;

export function PersonAvatar({ p, size = 48 }: { p?: Pick<MessagingProfile, 'displayName' | 'avatarUrl'> | null; size?: number }) {
  const c = useColors();
  if (p?.avatarUrl) return <Image source={{ uri: p.avatarUrl }} style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: c.card }} contentFit="cover" />;
  const i = (p?.displayName ?? '').trim().split(/\s+/).map((s) => s[0]).slice(0, 2).join('').toUpperCase();
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: c.card, borderWidth: 1, borderColor: c.border, alignItems: 'center', justifyContent: 'center' }}>
      {i ? <Text style={{ color: c.accent, fontFamily: 'Poppins_600SemiBold', fontSize: size * 0.36 }}>{i}</Text> : <Feather name="user" size={size * 0.45} color={c.secondary} />}
    </View>
  );
}

