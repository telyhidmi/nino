import { Feather } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useEventListener } from 'expo';
import { useVideoPlayer, VideoView } from 'expo-video';
import React, { useEffect, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import type { SamplePost } from './data';

type VideoFormat = 'mp4' | 'webm';

function supportedFormats(): VideoFormat[] {
  if (Platform.OS !== 'web' || typeof document === 'undefined') return ['mp4'];
  const video = document.createElement('video');
  // H.264 baseline is supported by Safari (including iOS Safari); VP8/WebM is
  // useful on Chromium builds without H.264. Never assume WebM works on all web.
  const mp4 = video.canPlayType('video/mp4; codecs="avc1.42E01E"');
  const webm = video.canPlayType('video/webm; codecs="vp8"');
  return [
    ...(mp4 ? ['mp4' as const] : []),
    ...(webm ? ['webm' as const] : []),
  ];
}

// Mounted only for the visible post. useVideoPlayer releases its native player on unmount.
export function FeedVideo({ post, active }: { post: SamplePost; active: boolean }) {
  const [formats] = useState(supportedFormats);
  const [formatIndex, setFormatIndex] = useState(0);
  const [attempt, setAttempt] = useState(0);
  const format = formats[formatIndex] ?? 'mp4';
  const retry = () => { setFormatIndex(0); setAttempt((n) => n + 1); };
  return <Playback key={`${post.id}-${formatIndex}-${attempt}`} post={post} active={active} format={format}
    onError={() => {
      if (formatIndex + 1 < formats.length) setFormatIndex(formatIndex + 1);
    }} retry={retry} />;
}

function Playback({ post, active, format, onError, retry }: {
  post: SamplePost; active: boolean; format: VideoFormat; onError: () => void; retry: () => void;
}) {
  // expo-video resolves the numeric require() asset ID to a local URI on both
  // native and web. Use the browser's codec probe before choosing the web asset.
  const player = useVideoPlayer(format === 'webm' ? post.videoWeb! : post.video!, (p) => {
    p.loop = true;
    p.muted = true;
    p.staysActiveInBackground = false;
  });
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [error, setError] = useState('Unable to load this sample video.');
  const [firstFrame, setFirstFrame] = useState(false);
  const [paused, setPaused] = useState(false);
  const [muted, setMuted] = useState(true);

  useEventListener(player, 'statusChange', ({ status: next, error: playbackError }) => {
    if (next === 'error') {
      setError(playbackError?.message || 'Unable to load this sample video.');
      setStatus('error');
    } else if (next === 'readyToPlay') {
      setStatus('ready');
    } else if (next === 'loading') {
      setStatus('loading');
    }
  });

  useEffect(() => {
    // A player can become ready before the event subscription is installed.
    // Without this check, the ready-only play effect can remain stuck forever.
    if (player.status === 'readyToPlay') setStatus('ready');
    else if (player.status === 'error') setStatus('error');
  }, [player]);

  useEffect(() => {
    if (status === 'error') onError();
  }, [status, onError]);

  useEffect(() => {
    if (active && !paused && status === 'ready') {
      player.play();
    } else {
      player.pause();
    }
    return () => { player.pause(); };
  }, [active, paused, player, status]);

  return (
    <View style={StyleSheet.absoluteFill}>
      <VideoView player={player} style={[StyleSheet.absoluteFill, { width: '100%', height: '100%' }]} contentFit="cover" nativeControls={false} playsInline
        onFirstFrameRender={() => setFirstFrame(true)} />
      {!firstFrame || status === 'error' ? (
        <Image source={post.image} style={StyleSheet.absoluteFill} contentFit="cover"
          accessibilityLabel="Illustrative sample poster (video footage may show a different scene)" />
      ) : null}
      {status !== 'error' ? (
        <Pressable style={StyleSheet.absoluteFill} onPress={() => setPaused((value) => !value)}
          accessibilityRole="button" accessibilityLabel={paused ? 'Play sample video' : 'Pause sample video'}>
          {paused && firstFrame ? (
            <View style={styles.center}><Feather name="play" size={34} color="#FFF" /></View>
          ) : null}
        </Pressable>
      ) : null}
      {status === 'loading' && !firstFrame ? (
        <View pointerEvents="none" style={styles.center}>
          <Text style={styles.status}>Loading sample video…</Text>
        </View>
      ) : null}
      {status === 'error' ? (
        <View style={styles.center}>
          <Text style={styles.status}>{error}</Text>
          <Pressable onPress={retry} accessibilityRole="button" accessibilityLabel="Retry sample video" style={styles.retry}>
            <Text style={styles.status}>Retry video</Text>
          </Pressable>
        </View>
      ) : null}
      <View style={styles.controls} pointerEvents="box-none">
        <Pressable onPress={() => { player.muted = !muted; setMuted(!muted); }}
          disabled={!post.videoHasAudio} accessibilityRole="button"
          accessibilityLabel={post.videoHasAudio ? (muted ? 'Unmute sample video' : 'Mute sample video') : 'This sample video has no audio'}
          accessibilityState={{ disabled: !post.videoHasAudio }}
          style={styles.mute}>
          <Feather name={post.videoHasAudio ? (muted ? 'volume-x' : 'volume-2') : 'volume-x'} size={17} color="#FFF" />
          <Text style={styles.controlText}>{post.videoHasAudio ? (muted ? 'Muted' : 'Sound on') : 'No audio'}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { position: 'absolute', left: 70, right: 70, top: '42%', alignItems: 'center', justifyContent: 'center', padding: 14, borderRadius: 16, backgroundColor: 'rgba(8,20,24,0.68)', gap: 8 },
  status: { color: '#FFF', textAlign: 'center', fontFamily: 'Poppins_600SemiBold', fontSize: 13 },
  retry: { minHeight: 44, paddingHorizontal: 18, justifyContent: 'center', borderRadius: 22, borderWidth: 1, borderColor: '#1FE0E8' },
  controls: { position: 'absolute', top: 196, left: 16, right: 80, alignItems: 'flex-start', gap: 6 },
  mute: { minHeight: 44, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 22, backgroundColor: 'rgba(8,20,24,0.72)' },
  controlText: { color: '#FFF', fontFamily: 'Poppins_600SemiBold', fontSize: 12 },
});