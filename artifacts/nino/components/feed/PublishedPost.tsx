import { useEventListener } from 'expo';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useVideoPlayer, VideoView } from 'expo-video';
import { Feather } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import { Pressable, Share, StyleSheet, Text, View } from 'react-native';
import type { Post } from '@workspace/api-client-react';
import { useColors } from '@/hooks/useColors';
import { mediaUrl, postError } from '@/lib/posts';
import { usePostCopy } from '@/lib/postTranslations';

function PublishedVideo({ uri }: { uri: string }) {
  const copy = usePostCopy();
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const player = useVideoPlayer({ uri }, (p) => {
    p.loop = true; p.muted = true; p.staysActiveInBackground = false;
  });
  useEventListener(player, 'statusChange', ({ status, error: problem }) => {
    if (status === 'error') setError(problem?.message || copy.loadFailed);
    if (status === 'readyToPlay') setReady(true);
  });
  useEffect(() => {
    if (player.status === 'readyToPlay') setReady(true);
    if (player.status === 'error') setError(copy.loadFailed);
  }, [player, copy.loadFailed]);
  useEffect(() => {
    if (ready && !error) player.play();
    // useVideoPlayer owns release; do not call a released native player in cleanup.
  }, [player, ready, error]);
  return <>
    <VideoView player={player} style={StyleSheet.absoluteFill} contentFit="cover" nativeControls playsInline />
    {error ? <Text style={s.status}>{error}</Text> : !ready ? <Text style={s.status}>{copy.loading}</Text> : null}
  </>;
}

export function PublishedPost({ post, height, active }: { post: Post; height: number; active: boolean }) {
  const c = useColors();
  const copy = usePostCopy();
  const [attempt, setAttempt] = useState(0);
  const [imageError, setImageError] = useState<string | null>(null);
  const uri = mediaUrl(post.mediaUrl);
  const share = () => {
    Share.share({ message: `${post.authorName} · Nino\n${post.caption}\n${uri}` }).catch((error) => setImageError(postError(error)));
  };
  return <View testID={`published-post-${post.id}`} style={{ height, width: '100%', backgroundColor: c.bgTop }}>
    {post.kind === 'photo' ? <Image key={attempt} source={{ uri }} style={StyleSheet.absoluteFill} contentFit="cover" onError={(event) => setImageError(event.error)} accessibilityLabel={post.caption || copy.published} /> :
      active ? <PublishedVideo key={`${post.id}-${attempt}`} uri={uri} /> : <View style={s.inactive}><Feather name="video" size={36} color={c.accent} /></View>}
    <LinearGradient colors={['transparent', 'rgba(12,12,14,0.85)']} style={s.gradient} pointerEvents="none" />
    {imageError ? <Text style={[s.status, { color: c.danger }]}>{imageError}</Text> : null}
    <View style={s.actions}>
      <Pressable testID={`post-share-${post.id}`} onPress={share} accessibilityRole="button" accessibilityLabel="Share" style={[s.button, { backgroundColor: c.overlay }]}><Feather name="share" size={22} color={c.text} /></Pressable>
      <Pressable testID={`post-media-retry-${post.id}`} onPress={() => { setImageError(null); setAttempt((value) => value + 1); }} accessibilityRole="button" accessibilityLabel={copy.retry} style={[s.button, { backgroundColor: c.overlay }]}><Feather name="refresh-cw" size={22} color={c.text} /></Pressable>
    </View>
    <View style={s.caption} pointerEvents="none">
      <View style={s.authorRow}>
        {post.authorAvatar ? <Image source={{ uri: post.authorAvatar }} style={s.avatar} contentFit="cover" /> : <Feather name="user" size={24} color={c.text} />}
        <Text style={[s.author, { color: c.text }]}>{post.authorName}</Text>
      </View>
      <Text style={[s.text, { color: c.text }]}>{post.caption}</Text>
      <Text style={[s.date, { color: c.secondary }]}>{new Date(post.createdAt).toLocaleDateString()}</Text>
    </View>
  </View>;
}

const s = StyleSheet.create({
  inactive: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  gradient: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 240 },
  actions: { position: 'absolute', bottom: 150, right: 12, gap: 12 },
  button: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  caption: { position: 'absolute', bottom: 48, left: 16, right: 78, gap: 8 },
  authorRow: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  avatar: { width: 32, height: 32, borderRadius: 16 },
  author: { fontSize: 17, fontWeight: '700', flexShrink: 1 },
  text: { fontSize: 15, lineHeight: 22 },
  date: { fontSize: 11 },
  status: { position: 'absolute', top: '40%', left: 30, right: 30, textAlign: 'center', color: '#FFF', backgroundColor: 'rgba(12,12,14,0.8)', padding: 16, borderRadius: 16 },
});