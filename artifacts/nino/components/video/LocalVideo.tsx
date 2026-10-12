import { useEventListener } from 'expo';
import { useVideoPlayer } from 'expo-video';
import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useI18n } from '@/lib/i18n';
import { VideoStage } from './VideoStage';

type Props = { source: number | { uri: string }; active?: boolean; compact?: boolean };

/** Local media uses the same inline gestures as the feed, never OS controls. */
export function LocalVideo(props: Props) {
  const [attempt, setAttempt] = useState(0);
  const id = typeof props.source === 'number' ? props.source : props.source.uri;
  return <Playback key={`${id}-${attempt}`} {...props} retry={() => setAttempt(n => n + 1)} />;
}

function Playback({ source, active = true, compact, retry }: Props & { retry: () => void }) {
  const { t, font } = useI18n();
  const player = useVideoPlayer(source, p => {
    p.loop = true; p.muted = true; p.staysActiveInBackground = false;
  });
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  useEventListener(player, 'statusChange', ({ status }) => {
    if (status === 'readyToPlay') { setReady(true); setFailed(false); }
    if (status === 'error') setFailed(true);
  });
  useEffect(() => {
    if (player.status === 'readyToPlay') setReady(true);
    if (player.status === 'error') setFailed(true);
  }, [player]);
  useEffect(() => {
    if (!active || ready || failed) return;
    const timer = setTimeout(() => setFailed(true), 60000);
    return () => clearTimeout(timer);
  }, [active, ready, failed]);
  return <VideoStage player={player} active={active} ready={ready} failed={failed}
    contentFit="contain" controlTop={compact ? 12 : undefined}>
    {failed ? <View style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center', backgroundColor: '#111', padding: 20 }]}>
      <Text style={{ color: '#fff', fontFamily: font(), textAlign: 'center' }}>{t('feedVideoError')}</Text>
      <Pressable onPress={retry} accessibilityRole="button" style={{ padding: 16 }}>
        <Text style={{ color: '#fff', fontFamily: font('semibold') }}>{t('feedRetryVideo')}</Text>
      </Pressable>
    </View> : null}
  </VideoStage>;
}
