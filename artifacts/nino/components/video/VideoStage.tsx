import { Feather } from '@expo/vector-icons';
import { useEventListener } from 'expo';
import { VideoView, type VideoPlayer } from 'expo-video';
import React, { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { PanResponder, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useInsets } from '@/components/ui';
import { useI18n } from '@/lib/i18n';
import { usePlaybackCopy } from '@/lib/playbackCopy';

// Session-wide sound preference, like a vertical video feed: once the viewer
// turns sound on with a tap, the next active video keeps it. Starts muted so
// browser autoplay policies allow the first play.
let soundOn = false;
const listeners = new Set<() => void>();
const sound = {
  get: () => soundOn,
  set: (v: boolean) => { soundOn = v; listeners.forEach((l) => l()); },
  sub: (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; },
};

type Props = {
  player: VideoPlayer;
  active: boolean;
  ready: boolean;
  failed: boolean;
  hasAudio?: boolean;
  /** Overrides the shared preference (e.g. an explicit viewer opened by the user). */
  forceSound?: boolean;
  contentFit?: 'cover' | 'contain';
  onFirstFrame?: () => void;
  /** Poster/status layers rendered beneath the controls. */
  children?: React.ReactNode;
};

export function VideoStage({ player, active, ready, failed, hasAudio = true, forceSound, contentFit = 'cover', onFirstFrame, children }: Props) {
  const copy = usePlaybackCopy();
  const { font, rtl } = useI18n();
  const ins = useInsets();
  const shared = useSyncExternalStore(sound.sub, sound.get, sound.get);
  const [local, setLocal] = useState<boolean | null>(forceSound ?? null);
  const wantsSound = hasAudio && (local ?? shared);
  const [paused, setPaused] = useState(false);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [scrub, setScrub] = useState<number | null>(null);
  const [width, setWidth] = useState(0);

  // Leaving the screen resets a manual pause so returning resumes immediately.
  useEffect(() => { if (!active) setPaused(false); }, [active]);

  useEffect(() => { player.muted = !wantsSound; }, [player, wantsSound]);

  useEffect(() => {
    player.timeUpdateEventInterval = active ? 0.25 : 0;
    if (active && !paused && ready && !failed && scrub === null) player.play();
    else player.pause();
    // useVideoPlayer owns release; never touch the native player during cleanup.
  }, [player, active, paused, ready, failed, scrub]);

  // Browsers may block audible autoplay without a recent gesture. Fall back to
  // muted playback instead of a frozen frame; never promise sound autoplay.
  useEffect(() => {
    if (Platform.OS !== 'web' || !active || paused || !ready || failed || !wantsSound || scrub !== null) return;
    const id = setTimeout(() => { if (!player.playing) { setLocal(false); player.muted = true; player.play(); } }, 900);
    return () => clearTimeout(id);
  }, [player, active, paused, ready, failed, wantsSound, scrub]);

  useEventListener(player, 'timeUpdate', ({ currentTime }) => {
    setTime(currentTime);
    if (player.duration > 0 && player.duration !== duration) setDuration(player.duration);
  });
  useEventListener(player, 'sourceLoad', ({ duration: d }) => { if (d > 0) setDuration(d); });

  const toggleSound = () => {
    const next = !wantsSound;
    if (forceSound !== undefined) setLocal(next); else { setLocal(null); sound.set(next); }
    player.muted = !next;
  };

  const widthRef = useRef(0); widthRef.current = width;
  const durRef = useRef(0); durRef.current = duration;
  const startX = useRef(0);
  const scrubRef = useRef<number | null>(null);
  const frac = (x: number) => Math.max(0, Math.min(1, x / (widthRef.current || 1)));
  const pan = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => durRef.current > 0,
    onStartShouldSetPanResponderCapture: () => durRef.current > 0,
    onMoveShouldSetPanResponderCapture: () => durRef.current > 0,
    onPanResponderTerminationRequest: () => false,
    onShouldBlockNativeResponder: () => true,
    onPanResponderGrant: (e) => { startX.current = e.nativeEvent.locationX; scrubRef.current = frac(startX.current); setScrub(scrubRef.current); },
    onPanResponderMove: (_, g) => { scrubRef.current = frac(startX.current + g.dx); setScrub(scrubRef.current); },
    onPanResponderRelease: () => {
      if (scrubRef.current !== null) { const t = scrubRef.current * durRef.current; player.currentTime = t; setTime(t); }
      scrubRef.current = null; setScrub(null);
    },
    onPanResponderTerminate: () => { scrubRef.current = null; setScrub(null); },
  })).current;

  const progress = scrub ?? (duration > 0 ? Math.min(1, time / duration) : 0);
  const showControls = ready && !failed;
  const pct = Math.round(progress * 100);

  return (
    <View style={StyleSheet.absoluteFill}>
      <VideoView player={player} style={[StyleSheet.absoluteFill, { width: '100%', height: '100%' }]} contentFit={contentFit}
        nativeControls={false} playsInline onFirstFrameRender={onFirstFrame} />
      {children}
      {showControls ? (
        <Pressable testID="video-tap" style={StyleSheet.absoluteFill} onPress={() => setPaused((v) => !v)}
          accessibilityRole="button" accessibilityLabel={paused ? copy.play : copy.pause} accessibilityState={{ selected: paused }}>
          {paused ? <View pointerEvents="none" style={s.centerWrap}><View style={s.play}><Feather name="play" size={34} color="#FFF" style={{ marginLeft: 4 }} /></View></View> : null}
        </Pressable>
      ) : null}
      {showControls ? (
        <Pressable testID="video-sound" onPress={toggleSound} disabled={!hasAudio} hitSlop={6}
          accessibilityRole="switch" accessibilityState={{ checked: wantsSound, disabled: !hasAudio }}
          accessibilityLabel={hasAudio ? (wantsSound ? copy.turnOff : copy.turnOn) : copy.noAudio}
          style={[s.sound, { top: ins.top + 108, flexDirection: rtl ? 'row-reverse' : 'row' }, rtl ? { right: 14 } : { left: 14 }, !hasAudio && { opacity: 0.6 }]}>
          <Feather name={wantsSound ? 'volume-2' : 'volume-x'} size={16} color="#FFF" />
          <Text style={[s.soundText, { fontFamily: font('semibold') }]} numberOfLines={1}>{hasAudio ? (wantsSound ? copy.soundOn : copy.soundOff) : copy.noAudio}</Text>
        </Pressable>
      ) : null}
      {showControls && duration > 0 ? (
        <View testID="video-seek" style={s.seekHit} onLayout={(e) => setWidth(e.nativeEvent.layout.width)} {...pan.panHandlers}
          accessible accessibilityRole="adjustable" accessibilityLabel={copy.progress} accessibilityValue={{ min: 0, max: 100, now: pct }}
          accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
          onAccessibilityAction={(e) => { const d = e.nativeEvent.actionName === 'increment' ? 5 : -5; const t = Math.max(0, Math.min(duration, time + d)); player.currentTime = t; setTime(t); }}>
          <View pointerEvents="none" style={[s.track, scrub !== null && s.trackActive]}>
            <View style={[s.fill, { width: `${progress * 100}%` }]} />
          </View>
          {scrub !== null ? <View pointerEvents="none" style={[s.knob, { left: Math.max(0, progress * width - 7) }]} /> : null}
        </View>
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  centerWrap: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
  play: { width: 76, height: 76, borderRadius: 38, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(12,12,14,0.42)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.35)' },
  sound: { position: 'absolute', minHeight: 44, maxWidth: '44%', paddingHorizontal: 12, alignItems: 'center', gap: 6, borderRadius: 22, backgroundColor: 'rgba(12,12,14,0.55)' },
  soundText: { color: '#FFF', fontSize: 12, flexShrink: 1 },
  seekHit: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 22, justifyContent: 'flex-end' },
  track: { height: 3, backgroundColor: 'rgba(255,255,255,0.22)' },
  trackActive: { height: 6 },
  fill: { height: '100%', backgroundColor: 'rgba(255,255,255,0.9)' },
  knob: { position: 'absolute', bottom: -4, width: 14, height: 14, borderRadius: 7, backgroundColor: '#FFF' },
});
