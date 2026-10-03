import { Feather } from '@expo/vector-icons';
import { Image } from 'expo-image';
import type { Href } from 'expo-router';
import React from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import type { MessagingProfile, MessagingRelationship } from '@workspace/api-client-react';
import { useI18n } from '@/lib/i18n';
import { useFollowToggle } from '@/lib/messaging';
import { fill, useMessagesCopy } from '@/lib/messagesCopy';
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


/** Small status chip: "Mutual" or "Follows you". Renders nothing otherwise. */
export function RelationChip({ rel, testID }: { rel?: MessagingRelationship | null; testID?: string }) {
  const c = useColors();
  const t = useMessagesCopy();
  const { font } = useI18n();
  if (!rel || (!rel.mutual && !rel.followsYou)) return null;
  const label = rel.mutual ? t.mutual : t.followsYou;
  return (
    <View testID={testID} accessible accessibilityLabel={label} style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, height: 20, borderRadius: 10, backgroundColor: rel.mutual ? c.accentWash : c.cardSoft }}>
      <Feather name={rel.mutual ? 'repeat' : 'user-check'} size={10} color={rel.mutual ? c.accent : c.secondary} />
      <Text style={{ color: rel.mutual ? c.accent : c.secondary, fontFamily: font('semibold'), fontSize: 10.5 }}>{label}</Text>
    </View>
  );
}

/** Authoritative follow toggle for a real messaging member. Never flips before the server confirms. */
export function FollowButton({ peerId, name, rel, testID = 'follow-toggle', onDark }: { peerId: string; name: string; rel?: MessagingRelationship | null; testID?: string; onDark?: boolean }) {
  const c = useColors();
  const t = useMessagesCopy();
  const { font } = useI18n();
  const { toggle, pending, error } = useFollowToggle(peerId);
  if (!rel) return <View testID={`${testID}-loading`} style={{ width: 86, height: 32, borderRadius: 16, backgroundColor: onDark ? 'rgba(255,255,255,0.12)' : c.card }} />;
  const on = rel.following;
  const label = on ? t.following : rel.followsYou ? t.followBack : t.follow;
  return (
    <View style={{ alignItems: 'flex-end', gap: 2 }}>
      <Pressable testID={testID} onPress={() => toggle(on)} disabled={pending} hitSlop={6}
        accessibilityRole="button" accessibilityState={{ selected: on, busy: pending }}
        accessibilityLabel={fill(on ? t.unfollowA11y : t.followA11y, name)}
        style={({ pressed }) => ({ minWidth: 86, height: 32, paddingHorizontal: 14, borderRadius: 16, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 5,
          borderWidth: 1, borderColor: on ? (onDark ? 'rgba(255,255,255,0.4)' : c.borderStrong) : c.accent,
          backgroundColor: on ? 'transparent' : c.accent, opacity: pressed || pending ? 0.7 : 1 })}>
        {pending ? <ActivityIndicator size="small" color={on ? c.text : c.onAccent} />
          : <><Feather name={on ? 'check' : 'user-plus'} size={13} color={on ? c.text : c.onAccent} />
            <Text style={{ color: on ? c.text : c.onAccent, fontFamily: font('semibold'), fontSize: 12.5 }}>{label}</Text></>}
      </Pressable>
      {error ? <Text testID={`${testID}-error`} accessibilityLiveRegion="polite" style={{ color: c.danger, fontFamily: font('medium'), fontSize: 10.5, maxWidth: 160, textAlign: 'right' }}>{t.followFailed}</Text> : null}
    </View>
  );
}
