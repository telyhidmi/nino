import { Image } from 'expo-image';
import { useEventListener } from 'expo';
import { useVideoPlayer } from 'expo-video';
import { VideoStage } from '@/components/video/VideoStage';
import React, { useEffect, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import type { SamplePost } from './data';
import { useI18n } from '@/lib/i18n';

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

// Nearby native reels stay prepared but paused. Unmount releases distant players.
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
  const { t, font } = useI18n();
  // expo-video resolves the numeric require() asset ID to a local URI on both
  // native and web. Use the browser's codec probe before choosing the web asset.
  const player = useVideoPlayer(format === 'webm' ? post.videoWeb! : post.video!, (p) => {
    p.loop = true;
    p.muted = true;
    p.staysActiveInBackground = false;
  });
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [firstFrame, setFirstFrame] = useState(false);

  useEventListener(player, 'statusChange', ({ status: next }) => {
    if (next === 'error') setStatus('error');
    else if (next === 'readyToPlay') setStatus('ready');
    else if (next === 'loading') setStatus('loading');
  });

  useEffect(() => {
    // A player can become ready before the event subscription is installed.
    if (player.status === 'readyToPlay') setStatus('ready');
    else if (player.status === 'error') setStatus('error');
  }, [player]);

  useEffect(() => {
    if (status === 'error') onError();
  }, [status, onError]);

  return (
    <VideoStage player={player} active={active} ready={status === 'ready'} failed={status === 'error'}
      hasAudio={!!post.videoHasAudio} onFirstFrame={() => setFirstFrame(true)}>
      {!firstFrame || status === 'error' ? (
        <Image source={post.image} style={StyleSheet.absoluteFill} contentFit="cover"
          accessibilityLabel={t('feedVideoPoster')} />
      ) : null}
      {status === 'loading' && !firstFrame ? (
        <View pointerEvents="none" style={styles.center}>
          <Text style={[styles.status, { fontFamily: font('semibold') }]}>{t('feedLoadingVideo')}</Text>
        </View>
      ) : null}
      {status === 'error' ? (
        <View style={styles.center}>
          <Text style={[styles.status, { fontFamily: font('semibold') }]}>{t('feedVideoError')}</Text>
          <Pressable onPress={retry} accessibilityRole="button" accessibilityLabel={t('feedRetryVideo')} style={styles.retry}>
            <Text style={[styles.status, { fontFamily: font('semibold') }]}>{t('feedRetryVideo')}</Text>
          </Pressable>
        </View>
      ) : null}
    </VideoStage>
  );
}

const styles = StyleSheet.create({
  center: { position: 'absolute', left: 70, right: 70, top: '42%', alignItems: 'center', justifyContent: 'center', padding: 14, borderRadius: 16, backgroundColor: 'rgba(12,12,14,0.68)', gap: 8 },
  status: { color: '#FFF', textAlign: 'center', fontFamily: 'Poppins_600SemiBold', fontSize: 13 },
  retry: { minHeight: 44, paddingHorizontal: 18, justifyContent: 'center', borderRadius: 22, borderWidth: 1, borderColor: 'rgba(255,255,255,0.5)' },
});
