import { useEventListener } from 'expo';
import { useVideoPlayer } from 'expo-video';
import { VideoStage } from '@/components/video/VideoStage';
import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { playbackFormats, playbackUri } from '@/lib/videoPlayback';
import { useVideoCopy } from '@/lib/videoTranslations';
import { usePostCopy } from '@/lib/postTranslations';

type Props = { uri: string; active: boolean; muted?: boolean; contentFit?: 'cover' | 'contain' };

// Shared by feed and profile; local/sample videos intentionally use their own source.
export function PublishedVideo({ uri, active, muted, contentFit = 'cover' }: Props) {
  const copy = useVideoCopy();
  const [formats] = useState(playbackFormats);
  const [index, setIndex] = useState(0);
  const [attempt, setAttempt] = useState(0);
  const format = formats[index];
  if (!format) return <Text style={s.status}>{copy.failed}</Text>;
  return <PlayableVideo key={`${uri}-${format}-${attempt}`} uri={playbackUri(uri, format)}
    active={active} muted={muted} contentFit={contentFit}
    onRetry={() => { setIndex(0); setAttempt(value => value + 1); }}
    onFailure={index + 1 < formats.length ? () => setIndex(index + 1) : undefined} />;
}

function PlayableVideo({ uri, active, muted, contentFit, onFailure, onRetry }: Props & { onFailure?: () => void; onRetry: () => void }) {
  const copy = useVideoCopy();
  const postCopy = usePostCopy();
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const player = useVideoPlayer({ uri }, (p) => {
    p.loop = true; p.muted = true; p.staysActiveInBackground = false;
  });
  useEventListener(player, 'statusChange', ({ status }) => {
    if (status === 'error') {
      if (onFailure) onFailure();
      else setError(copy.failed);
    }
    if (status === 'readyToPlay') setReady(true);
  });
  useEffect(() => {
    if (player.status === 'readyToPlay') setReady(true);
    if (player.status === 'error') {
      if (onFailure) onFailure();
      else setError(copy.failed);
    }
  }, [player, copy.failed, onFailure]);
  // muted={false} is an explicit viewer request (profile viewer); otherwise follow the shared sound preference.
  return <VideoStage player={player} active={active} ready={ready} failed={!!error} contentFit={contentFit}
    forceSound={muted === false ? true : undefined}>
    {error ? <View style={s.status}>
      <Text style={s.text}>{error}</Text>
      <Pressable onPress={onRetry} accessibilityRole="button" accessibilityLabel={postCopy.retry} style={s.retry}>
        <Text style={s.text}>{postCopy.retry}</Text>
      </Pressable>
    </View> : !ready ? <Text pointerEvents="none" style={[s.status, s.text]}>{copy.preparing}</Text> : null}
  </VideoStage>;
}

const s = StyleSheet.create({
  status: { position: 'absolute', top: '40%', left: 30, right: 30, backgroundColor: 'rgba(12,12,14,0.8)', padding: 16, borderRadius: 16 },
  text: { color: '#FFF', textAlign: 'center' },
  retry: { minHeight: 44, justifyContent: 'center', marginTop: 8 },
});
