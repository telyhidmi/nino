import { useAuth } from '@clerk/expo';
import { Feather } from '@expo/vector-icons';
import { useQueryClient } from '@tanstack/react-query';
import { Camera } from 'expo-camera';
import { Redirect, router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, AppState, FlatList, Linking, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import { createLiveStream, endLiveStream, getListLiveStreamsQueryKey, joinLiveStream, type LiveJoin } from '@workspace/api-client-react';
import type { LocalTrack, LocalVideoTrack, RemoteParticipant, Room } from 'livekit-client';
import { useColors } from '@/hooks/useColors';
import { useInsets } from '@/components/ui';
import { useI18n } from '@/lib/i18n';
import { useLiveCopy } from '@/lib/liveCopy';
import { loadLiveNative, supportsNativeLive } from '@/lib/liveNative';
import { registerLiveCleanup } from '@/lib/liveSession';
import { postError } from '@/lib/posts';

type SDK = Awaited<ReturnType<typeof loadLiveNative>>;
type Phase = 'idle' | 'connecting' | 'connected' | 'reconnecting' | 'ended';
type Chat = { id: string; name: string; text: string };
type Session = { cancelled: boolean; ownsBroadcast: boolean; sdk?: SDK; room?: Room; tracks: LocalTrack[]; join?: LiveJoin; creating?: Promise<LiveJoin>; audio: boolean; ending?: Promise<void> };

export default function Live() {
  const { isSignedIn, userId } = useAuth();
  const { id: param } = useLocalSearchParams<{ id?: string }>();
  const id = typeof param === 'string' ? param : undefined;
  const c = useColors();
  const ins = useInsets();
  const { font, row, align } = useI18n();
  const copy = useLiveCopy();
  const copyRef = useRef(copy);
  copyRef.current = copy;
  const queryClient = useQueryClient();
  const [title, setTitle] = useState('');
  const [phase, setPhase] = useState<Phase>('idle');
  const [join, setJoin] = useState<LiveJoin | null>(null);
  const [sdk, setSDK] = useState<SDK | null>(null);
  const [viewers, setViewers] = useState(0);
  const [revision, setRevision] = useState(0);
  const [error, setError] = useState('');
  const [settings, setSettings] = useState(false);
  const [mic, setMic] = useState(true);
  const [front, setFront] = useState(true);
  const [controlBusy, setControlBusy] = useState(false);
  const [chat, setChat] = useState<Chat[]>([]);
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const session = useRef<Session | null>(null);
  const starting = useRef(false);
  const mounted = useRef(true);
  const focused = useRef(false);
  const text = { color: c.text, fontFamily: font(), textAlign: align };
  const invalidate = useCallback(() => { void queryClient.invalidateQueries({ queryKey: getListLiveStreamsQueryKey() }); }, [queryClient]);

  const dispose = useCallback(async (s: Session) => {
    // Stop physical capture immediately, even when the end request is offline.
    s.cancelled = true;
    let failure: unknown;
    for (const track of s.tracks.splice(0)) {
      try { track.stop(); } catch (e) { failure = e; }
    }
    const room = s.room;
    s.room = undefined;
    room?.removeAllListeners();
    try { await room?.disconnect(true); } catch (e) { failure = e; }
    if (s.audio) {
      s.audio = false;
      try { await s.sdk?.native.AudioSession.stopAudioSession(); } catch (e) { failure = e; }
    }
    if (s.ownsBroadcast && s.join?.isHost) {
      if (!s.ending) s.ending = endLiveStream(s.join.stream.id).then(() => { s.join = undefined; invalidate(); }).catch((e) => { s.ending = undefined; throw e; });
      await s.ending;
    }
    invalidate();
    if (failure) throw failure;
  }, [invalidate]);
  const close = useCallback(async () => {
    const s = session.current;
    if (s) {
      await dispose(s);
      // Sign-out must not revoke auth while a POST is still allocating a host room.
      if (s.creating) {
        try { await s.creating; } catch { /* A failed create has no room to terminate. */ }
        await dispose(s);
      }
    }
  }, [dispose]);
  const closeWithNotice = useCallback(() => {
    setPhase('ended');
    void close().catch((e) => { if (mounted.current) setError(postError(e)); });
  }, [close]);

  useEffect(() => {
    mounted.current = true;
    const unregister = registerLiveCleanup(close);
    return () => {
      mounted.current = false; unregister();
      void close().catch((e) => Alert.alert(copyRef.current.error, postError(e)));
    };
  }, [close, userId]);
  useFocusEffect(useCallback(() => {
    focused.current = true;
    const sub = AppState.addEventListener('change', (state) => {
      // Permission sheets can briefly mark iOS inactive. A real background transition ends the session.
      if (state === 'background') closeWithNotice();
    });
    return () => { focused.current = false; sub.remove(); void close().catch((e) => { if (mounted.current) setError(postError(e)); }); };
  }, [close, closeWithNotice]));

  const start = useCallback(async () => {
    if (starting.current || !isSignedIn || !supportsNativeLive || !focused.current || AppState.currentState === 'background') return;
    if (!id && !title.trim()) return;
    starting.current = true;
    setError(''); setSettings(false); setPhase('connecting'); setChat([]);
    const previous = session.current;
    // An earlier end request may have failed. Never allocate another room until cleanup succeeds.
    if (previous) {
      try { await dispose(previous); } catch (e) { setError(postError(e)); setPhase('ended'); starting.current = false; return; }
    }
    const s: Session = { cancelled: false, ownsBroadcast: !id, tracks: [], audio: false };
    session.current = s;
    const check = () => {
      if (s.cancelled || !mounted.current || !focused.current || AppState.currentState === 'background') {
        s.cancelled = true;
        throw new Error('Live session cancelled');
      }
    };
    try {
      check();
      try { s.sdk = await loadLiveNative(); } catch (e) { throw new Error(`${copy.buildBody}\n${postError(e)}`); }
      check();
      if (!id) {
        const camera = await Camera.requestCameraPermissionsAsync(); check();
        if (!camera.granted) { setSettings(!camera.canAskAgain); throw new Error(copy.permissions); }
        const microphone = await Camera.requestMicrophonePermissionsAsync(); check();
        if (!microphone.granted) { setSettings(!microphone.canAskAgain); throw new Error(copy.permissions); }
      }
      await s.sdk.native.AudioSession.startAudioSession(); s.audio = true; check();
      if (!id) {
        // Acquire actual capture before allocating any backend room. Permission/capture
        // failures therefore cannot leave an orphan broadcast.
        s.tracks = await s.sdk.client.createLocalTracks({ audio: true, video: { facingMode: 'user' } }); check();
      }
      // Do not abort POST: a cancelled create must still receive its id so we can delete it.
      s.creating = (id ? joinLiveStream(id) : createLiveStream({ title: title.trim() })).then((result) => { s.join = result; return result; });
      s.join = await s.creating;
      check();
      if (id && s.join.isHost) throw new Error('Join returned a host token for a viewer session. Reopen Go Live to broadcast.');
      const { client } = s.sdk;
      const room = new client.Room({ adaptiveStream: true, dynacast: true });
      s.room = room;
      const update = () => {
        if (s.cancelled || !mounted.current) return;
        const hostIdentity = `nino-user:${s.join?.stream.hostId}`;
        setViewers([...room.remoteParticipants.values(), room.localParticipant].filter((p) => p.identity.startsWith('nino-user:') && p.identity !== hostIdentity).length);
        setRevision((v) => v + 1);
      };
      const append = (name: string, body: string) => {
        if (!s.cancelled && mounted.current) setChat((old) => [{ id: `${Date.now()}-${Math.random()}`, name: name.slice(0, 80), text: body }, ...old].slice(0, 100));
      };
      room.on(client.RoomEvent.ParticipantConnected, update).on(client.RoomEvent.ParticipantDisconnected, update)
        .on(client.RoomEvent.TrackSubscribed, update).on(client.RoomEvent.TrackUnsubscribed, update)
        .on(client.RoomEvent.TrackPublished, update).on(client.RoomEvent.TrackUnpublished, update)
        .on(client.RoomEvent.LocalTrackPublished, update).on(client.RoomEvent.TrackMuted, update).on(client.RoomEvent.TrackUnmuted, update)
        .on(client.RoomEvent.Reconnecting, () => { if (!s.cancelled && mounted.current) setPhase('reconnecting'); })
        .on(client.RoomEvent.Reconnected, () => { if (!s.cancelled && mounted.current) { setPhase('connected'); update(); } })
        .on(client.RoomEvent.Disconnected, () => {
          if (s.cancelled) return;
          if (mounted.current) { setPhase('ended'); setError(copy.ended); }
          void dispose(s).catch((e) => { if (mounted.current) setError(postError(e)); });
        })
        .on(client.RoomEvent.DataReceived, (payload: Uint8Array, participant?: RemoteParticipant, _kind?: unknown, topic?: string) => {
          if (!participant || topic !== 'nino.chat.v1' || payload.byteLength > 2048) return;
          try {
            const data: unknown = JSON.parse(new TextDecoder().decode(payload));
            if (!data || typeof data !== 'object' || !('text' in data) || typeof data.text !== 'string') return;
            const body = data.text.trim();
            if (!body || body.length > 500) return;
            // Ignore all payload identity fields: attribution comes from the authenticated participant.
            append(participant.name || participant.identity, body);
          } catch { /* Invalid/untrusted data is not a chat message. */ }
        });
      await room.connect(s.join.serverUrl, s.join.token); check();
      // Viewers never acquire devices or publish tracks; backend token grants also enforce this.
      for (const track of s.tracks) { await room.localParticipant.publishTrack(track); check(); }
      setSDK(s.sdk); setJoin(s.join); setMic(true); setFront(true); setPhase('connected'); update(); invalidate();
    } catch (e) {
      const cancelled = s.cancelled;
      try { await dispose(s); } catch (cleanupError) { if (mounted.current) setError(postError(cleanupError)); }
      if (mounted.current && !cancelled) { setError((old) => old || `${copy.error}: ${postError(e)}`); setPhase('ended'); }
    } finally { starting.current = false; }
  }, [isSignedIn, id, title, copy, dispose, invalidate]);

  const toggle = async (kind: 'mic' | 'flip') => {
    const s = session.current;
    if (!s?.join?.isHost || !s.room || !s.sdk || controlBusy) return;
    setControlBusy(true);
    try {
      if (kind === 'mic') { await s.room.localParticipant.setMicrophoneEnabled(!mic); setMic(!mic); }
      else {
        const track = s.room.localParticipant.getTrackPublication(s.sdk.client.Track.Source.Camera)?.track as LocalVideoTrack | undefined;
        if (!track) throw new Error(copy.waiting);
        await track.restartTrack({ facingMode: front ? 'environment' : 'user' }); setFront(!front);
      }
    } catch (e) { setError(postError(e)); } finally { if (mounted.current) setControlBusy(false); }
  };
  const send = async () => {
    const s = session.current;
    const body = message.trim();
    if (!s?.room || !body || body.length > 500 || sending || phase !== 'connected') return;
    setSending(true);
    try {
      await s.room.localParticipant.publishData(new TextEncoder().encode(JSON.stringify({ text: body })), { reliable: true, topic: 'nino.chat.v1' });
      if (!s.cancelled && mounted.current) {
        const p = s.room.localParticipant;
        setChat((old) => [{ id: `${Date.now()}-${Math.random()}`, name: (p.name || p.identity).slice(0, 80), text: body }, ...old].slice(0, 100));
        setMessage('');
      }
    } catch (e) { setError(postError(e)); } finally { if (mounted.current) setSending(false); }
  };
  const leave = async () => {
    setPhase('ended');
    try { await close(); router.back(); } catch (e) { setError(postError(e)); }
  };

  if (!isSignedIn) return <Redirect href="/" />;
  const s = session.current;
  const host = join?.isHost;
  const participant = host ? s?.room?.localParticipant : s?.room?.remoteParticipants.get(`nino-user:${join?.stream.hostId ?? ''}`);
  const publication = sdk && participant?.getTrackPublication(sdk.client.Track.Source.Camera);
  const trackRef = sdk && participant && publication?.track && !publication.isMuted ? { participant, publication, source: sdk.client.Track.Source.Camera } : undefined;
  const Video = sdk?.native.VideoTrack;
  void revision; // Track events refresh the publication reference without storing native track objects in state.
  const live = phase === 'connected' || phase === 'reconnecting';
  return <KeyboardAvoidingView behavior="padding" style={[styles.root, { backgroundColor: c.bgTop, paddingTop: ins.top, paddingBottom: ins.bottom }]}>
    <View style={[styles.header, { flexDirection: row }]}>
      <Feather name="radio" size={22} color={c.accent} />
      <Text style={[text, { flex: 1, fontFamily: font('semibold'), fontSize: 20 }]} numberOfLines={2}>{join?.stream.title || copy.go}</Text>
      <Pressable testID="live-close" onPress={() => void leave()} accessibilityRole="button" accessibilityLabel={copy.leave} style={styles.icon}>
        <Feather name="x" size={24} color={c.text} />
      </Pressable>
    </View>
    {!supportsNativeLive ? <View testID="live-build-required" style={styles.setup}>
      <Feather name="smartphone" size={42} color={c.accent} />
      <Text style={[text, styles.title]}>{copy.build}</Text>
      <Text style={[text, { color: c.secondary }]}>{copy.buildBody}</Text>
    </View> : !live ? <View style={styles.setup}>
      <Feather name="video" size={42} color={c.accent} />
      {phase === 'connecting' ? <><ActivityIndicator color={c.accent} /><Text style={text}>{copy.connecting}</Text></> : <>
        {phase === 'ended' ? <Text style={[text, styles.title]}>{copy.ended}</Text> : null}
        {!id ? <TextInput testID="live-title" value={title} onChangeText={setTitle} maxLength={120} placeholder={copy.title}
          accessibilityLabel={copy.title} placeholderTextColor={c.muted} style={[styles.input, text, { borderColor: c.border, backgroundColor: c.card }]} /> : null}
        {s?.ownsBroadcast && s.join ? <Pressable testID="live-end-retry" onPress={() => void leave()} accessibilityRole="button" style={[styles.button, { backgroundColor: c.accentWash }]}>
          <Text style={[text, { color: c.accent }]}>{copy.end}</Text>
        </Pressable> : null}
        <Pressable testID="live-start" accessibilityRole="button" disabled={starting.current || (!id && !title.trim())}
          onPress={() => void start()} style={[styles.button, { backgroundColor: c.accent, opacity: !id && !title.trim() ? 0.5 : 1 }]}>
          <Text style={[text, { color: c.onAccent, fontFamily: font('semibold') }]}>{phase === 'ended' ? copy.retry : id ? copy.join : copy.start}</Text>
        </Pressable>
      </>}
    </View> : <>
      <View testID="live-video" style={[styles.video, { backgroundColor: c.cardSoft }]}>
        {Video && trackRef ? <Video trackRef={trackRef} mirror={!!host && front} style={StyleSheet.absoluteFill} /> :
          <Text style={[text, { color: c.secondary }]}>{copy.waiting}</Text>}
        <View style={[styles.badge, { backgroundColor: c.overlay }]}>
          <Text style={[text, { color: c.onAccent }]}>{phase === 'reconnecting' ? copy.reconnecting : `${viewers} · ${copy.viewers}`}</Text>
        </View>
      </View>
      <View style={[styles.controls, { flexDirection: row }]}>
        {host ? <>
          <Pressable testID="live-flip" onPress={() => void toggle('flip')} disabled={controlBusy || phase !== 'connected'} accessibilityRole="button" accessibilityLabel={copy.flip} style={styles.icon}><Feather name="refresh-cw" size={22} color={c.text} /></Pressable>
          <Pressable testID="live-mic" onPress={() => void toggle('mic')} disabled={controlBusy || phase !== 'connected'} accessibilityRole="button" accessibilityLabel={copy.mic} accessibilityState={{ selected: mic }} style={styles.icon}><Feather name={mic ? 'mic' : 'mic-off'} size={22} color={mic ? c.text : c.accent} /></Pressable>
        </> : null}
        <Pressable testID={host ? 'live-end' : 'live-leave'} onPress={() => void leave()} accessibilityRole="button" style={[styles.button, { backgroundColor: c.accent, flex: 1 }]}>
          <Text style={[text, { color: c.onAccent, fontFamily: font('semibold') }]}>{host ? copy.end : copy.leave}</Text>
        </Pressable>
      </View>
      <Text style={[text, { color: c.muted, fontSize: 11, paddingHorizontal: 16 }]}>{copy.chatNote}</Text>
      <FlatList testID="live-chat" inverted data={chat} keyExtractor={(item) => item.id} keyboardShouldPersistTaps="handled" keyboardDismissMode="interactive"
        style={{ flex: 1 }} contentContainerStyle={{ padding: 16, gap: 8 }} renderItem={({ item }) => <Text style={text}>
          <Text style={{ color: c.accent, fontFamily: font('semibold') }}>{item.name} </Text>{item.text}
        </Text>} />
      <View style={[styles.controls, { flexDirection: row }]}>
        <TextInput testID="live-message" value={message} onChangeText={setMessage} maxLength={500} editable={phase === 'connected'}
          placeholder={copy.chat} accessibilityLabel={copy.chat} placeholderTextColor={c.muted} style={[styles.input, text, { flex: 1, borderColor: c.border }]} />
        <Pressable testID="live-send" onPress={() => void send()} disabled={sending || phase !== 'connected' || !message.trim()} accessibilityRole="button" accessibilityLabel={copy.send} style={styles.icon}>
          <Feather name="send" size={22} color={c.accent} />
        </Pressable>
      </View>
    </>}
    {error ? <Text testID="live-error" accessibilityLiveRegion="polite" style={[text, { color: c.danger, paddingHorizontal: 16, paddingBottom: 12 }]}>{error}</Text> : null}
    {settings ? <Pressable testID="live-settings" onPress={() => void Linking.openSettings().catch((e) => setError(postError(e)))} style={styles.button}>
      <Text style={[text, { color: c.accent }]}>{copy.settings}</Text>
    </Pressable> : null}
  </KeyboardAvoidingView>;
}
const styles = StyleSheet.create({
  root: { flex: 1 }, header: { paddingHorizontal: 16, gap: 10, alignItems: 'center', minHeight: 64 },
  setup: { flex: 1, justifyContent: 'center', padding: 24, gap: 18 }, title: { fontSize: 22 },
  icon: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  input: { borderWidth: 1, borderRadius: 12, minHeight: 48, paddingHorizontal: 14, fontSize: 14 },
  button: { borderRadius: 12, padding: 14, alignItems: 'center', justifyContent: 'center' },
  video: { flex: 1.5, minHeight: 180, alignItems: 'center', justifyContent: 'center' },
  badge: { position: 'absolute', top: 12, left: 12, borderRadius: 999, paddingVertical: 6, paddingHorizontal: 12 },
  controls: { padding: 12, gap: 10, alignItems: 'center' },
});