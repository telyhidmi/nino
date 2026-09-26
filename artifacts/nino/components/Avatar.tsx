import { Feather } from '@expo/vector-icons';
import { Image } from 'expo-image';
import React from 'react';
import { Text, View } from 'react-native';
import { useColors } from '@/hooks/useColors';

export function Avatar({ uri, name, size = 112, flag }: { uri?: string | null; name?: string; size?: number; flag?: string }) {
  const c = useColors();
  const initials = (name ?? '').trim().split(/\s+/).map((p) => p[0]).slice(0, 2).join('').toUpperCase();
  return (
    <View style={{ width: size + 8, height: size + 8, borderRadius: (size + 8) / 2, borderWidth: 2, borderColor: c.accent, alignItems: 'center', justifyContent: 'center', shadowColor: c.accent, shadowOpacity: 0.6, shadowRadius: 18, shadowOffset: { width: 0, height: 0 } }}>
      {uri ? (
        <Image source={{ uri }} style={{ width: size, height: size, borderRadius: size / 2 }} contentFit="cover" />
      ) : (
        <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: c.card, alignItems: 'center', justifyContent: 'center' }}>
          {initials ? <Text style={{ color: c.accent, fontFamily: 'Poppins_600SemiBold', fontSize: size * 0.34 }}>{initials}</Text> : <Feather name="user" size={size * 0.4} color={c.secondary} />}
        </View>
      )}
      {flag ? (
        <View style={{ position: 'absolute', bottom: 0, right: 0, width: 34, height: 34, borderRadius: 17, backgroundColor: c.bgBottom, borderWidth: 1, borderColor: c.border, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ fontSize: 18 }}>{flag}</Text>
        </View>
      ) : null}
    </View>
  );
}
