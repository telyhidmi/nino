import { Feather } from '@expo/vector-icons';
import { CameraView, useCameraPermissions, useMicrophonePermissions, type CameraType } from 'expo-camera';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { useVideoPlayer, VideoView } from 'expo-video';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Linking, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { KeyboardAwareScrollViewCompat } from '@/components/KeyboardAwareScrollViewCompat';
import { useInsets } from '@/components/ui';
import { useColors } from '@/hooks/useColors';
import { useAuth } from '@clerk/expo';
import { useRequestPostUpload, usePublishPost, type Post, type PostUploadTicket } from '@workspace/api-client-react';
import { usePostCopy } from '@/lib/postTranslations';
import { readUploadMedia, uploadMedia, type CapturedMedia, type ByteProgress, type UploadMedia } from '@/lib/uploadMedia';
import { captureRecordingCountry, useRecordingLocationCopy, type RecordingLocation, type LocationNotice } from '@/lib/recordingLocation';

type Captured = CapturedMedia & { recordingLocation?: RecordingLocation };
type PermissionProblem = { message: string; settings: boolean };
type Mode = 'photo' | 600 | 60 | 30 | 15;

const MODES: { id: Mode; label: string; spoken: string }[] = [
  { id: 600, label: '10m', spoken: '10 minute video' },
  { id: 60, label: '60s', spoken: '60 second video' },
  { id: 30, label: '30s', spoken: '30 second video' },
  { id: 15, label: '15s', spoken: '15 second video' },
  { id: 'photo', label: 'Photo', spoken: 'Photo' },
];

const IS_WEB = Platform.OS === 'web';
const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
const errText = (e: unknown) => (e instanceof Error ? e.message : 'Unknown error');

function VideoPreview({ uri }: { uri: string }) {
  const player = useVideoPlayer({ uri }, (p) => { p.loop = true; });
  return <VideoView player={player} style={styles.fill} contentFit="contain" nativeControls />;
}

export function CreatePost({ visible, onClose, onSave, allowPublish = true }: { visible: boolean; onClose: () => void; onSave: (item: Post) => void | Promise<void>; allowPublish?: boolean }) {
  const c = useColors();
  const copy = usePostCopy();
  const locationCopy = useRecordingLocationCopy();
  const { isSignedIn, userId, getToken } = useAuth();
  const apiAbort = useRef(new AbortController());
  const requestUpload = useRequestPostUpload({ request: { signal: apiAbort.current.signal } });
  const publish = usePublishPost({ request: { signal: apiAbort.current.signal } });
  const uploading = useRef(false);
  const cancelUpload = useRef<(() => void) | null>(null);
  const ticket = useRef<(PostUploadTicket & { ownerId: string; uploaded: boolean; media: UploadMedia }) | null>(null);
  const [bytes, setBytes] = useState<ByteProgress | null>(null);
  const [phase, setPhase] = useState<'upload' | 'finalize' | null>(null);
  const ins = useInsets();
  const [camPerm, requestCam] = useCameraPermissions();
  const [, requestMic] = useMicrophonePermissions();

  const cameraRef = useRef<CameraView>(null);
  const mounted = useRef(true);
  const lock = useRef(false);
  const recordingRef = useRef(false);
  const session = useRef(0);
  const recId = useRef(0);
  const discardId = useRef(-1);
  const readyRef = useRef(false);
  const fgRef = useRef(true);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const locationAbort = useRef<AbortController | null>(null);
  const visibleRef = useRef(visible);
  visibleRef.current = visible;

  const [foreground, setForeground] = useState(AppState.currentState === 'active' || IS_WEB);
  fgRef.current = foreground;
  const [asset, setAsset] = useState<Captured | null>(null);
  const [picking, setPicking] = useState(false);
  const [ready, setReady] = useState(false);
  const [facing, setFacing] = useState<CameraType>('back');
  const [mode, setMode] = useState<Mode>(60);
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [busy, setBusy] = useState(false);
  const [caption, setCaption] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [problem, setProblem] = useState<PermissionProblem | null>(null);
  const [liveInfo, setLiveInfo] = useState(false);
  const [asked, setAsked] = useState(false);
  const [locationNotice, setLocationNotice] = useState<LocationNotice | null>(null);
  const [locating, setLocating] = useState(false);

  const isVideoMode = mode !== 'photo';
  const maxSeconds = isVideoMode ? (mode as number) : 0;
  const granted = !!camPerm?.granted;
  const cameraActive = visible && foreground && !asset && !picking && granted;
  const alive = (t: number) => mounted.current && visibleRef.current && session.current === t;
  const markReady = (v: boolean) => { readyRef.current = v; setReady(v); };

  const clearTimer = () => { if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; } };

  const stopNative = useCallback(() => {
    if (!recordingRef.current) return;
    try { cameraRef.current?.stopRecording(); } catch { /* camera already gone */ }
  }, []);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      cancelUpload.current?.();
      apiAbort.current.abort();
      session.current++;
      locationAbort.current?.abort();
      discardId.current = recId.current;
      clearTimer();
      stopNative();
    };
  }, [stopNative]);

  useEffect(() => {
    const apply = (fg: boolean) => {
      fgRef.current = fg;
      if (!fg) locationAbort.current?.abort();
      if (!fg && recordingRef.current) { discardId.current = recId.current; stopNative(); }
      if (mounted.current) { setForeground(fg); if (!fg) markReady(false); }
    };
    const sub = AppState.addEventListener('change', (st) => { if (!IS_WEB) apply(st === 'active'); });
    const doc = IS_WEB && typeof document !== 'undefined' ? document : null;
    const onVis = () => { if (doc) apply(doc.visibilityState !== 'hidden'); };
    doc?.addEventListener('visibilitychange', onVis);
    return () => { sub.remove(); doc?.removeEventListener('visibilitychange', onVis); };
  }, [stopNative]);

  // Auto-request camera permission when composer opens.
  useEffect(() => {
    if (!visible || !camPerm || camPerm.granted || asked) return;
    if (!camPerm.canAskAgain) return;
    setAsked(true);
    requestCam().catch((e) => { if (mounted.current) setError(`Could not request camera access: ${errText(e)}`); });
  }, [visible, camPerm, asked, requestCam]);

  useEffect(() => { if (!cameraActive) markReady(false); }, [cameraActive]);
  useEffect(() => {
    if (!visible) {
      session.current++;
      locationAbort.current?.abort();
      if (recordingRef.current) { discardId.current = recId.current; stopNative(); }
      if (!recordingRef.current) lock.current = false;
      setBusy(false); setLocating(false);
    }
  }, [visible, stopNative]);

  const reset = () => {
    locationAbort.current?.abort(); locationAbort.current = null;
    setLocationNotice(null); setLocating(false);
    ticket.current = null; setBytes(null); setPhase(null);
    setAsset(null); setCaption(''); setError(null); setProblem(null); setLiveInfo(false);
    setElapsed(0); markReady(false); setAsked(false); setBusy(false); setPicking(false);
    session.current++;
    // Keep the lock while a prior recording promise is still settling.
    if (!recordingRef.current) lock.current = false;
  };

  const close = () => {
    if (uploading.current) return;
    if (recordingRef.current) { discardId.current = recId.current; stopNative(); }
    clearTimer();
    reset();
    onClose();
  };

  const takePhoto = async () => {
    const cam = cameraRef.current;
    if (!cam) { lock.current = false; return; }
    const t = session.current;
    setBusy(true);
    try {
      const pic = await cam.takePictureAsync({ quality: 0.85 });
      if (alive(t) && pic?.uri) { setLocationNotice('unlocated'); setAsset({ uri: pic.uri, type: 'image', mimeType: 'image/jpeg', recordingLocation: undefined }); }
    } catch (e) {
      if (alive(t)) setError(`Could not take photo: ${errText(e)}`);
    } finally {
      if (alive(t)) { setBusy(false); lock.current = false; }
    }
  };

  const startRecording = async () => {
    if (IS_WEB) {
      setError('Video recording is not supported in this browser preview. Use Photo, or pick a video from your library.');
      lock.current = false; return;
    }
    const t = session.current;
    setBusy(true);
    let mic;
    try {
      mic = await requestMic();
    } catch (e) {
      if (alive(t)) { setError(`Could not request microphone access: ${errText(e)}`); setBusy(false); lock.current = false; }
      return;
    }
    if (!alive(t)) return;
    if (!mic.granted) {
      setBusy(false);
      setProblem({ message: `Nino needs microphone access to record video. ${mic.canAskAgain ? 'Tap record again to retry.' : 'Enable it in device settings.'}`, settings: !mic.canAskAgain });
      lock.current = false; return;
    }
    // Permission prompts may background/remount the camera. Check after each
    // prompt, and again after lookup before touching the native camera.
    const cameraAvailable = () => alive(t) && fgRef.current && readyRef.current && !!cameraRef.current;
    if (!cameraAvailable()) {
      setError(locationCopy.cameraReady); setBusy(false); lock.current = false; return;
    }
    let countryCode: RecordingLocation['countryCode'] | undefined;
    let notice: LocationNotice | null = null;
    let lookupCanceled = false;
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (!alive(t)) return;
      if (!permission.granted) setLocationNotice('denied');
      if (!cameraAvailable()) {
        setError(locationCopy.cameraReady); setBusy(false); lock.current = false; return;
      }
      if (!permission.granted) {
        notice = 'denied';
      } else {
        const controller = new AbortController();
        locationAbort.current = controller;
        setLocating(true);
        try {
          countryCode = await captureRecordingCountry(controller.signal);
          if (!countryCode) notice = 'unavailable';
        } catch {
          // Never surface native location errors, which could include coordinates.
          notice = 'unavailable';
        } finally {
          lookupCanceled = controller.signal.aborted;
          if (locationAbort.current === controller) locationAbort.current = null;
        }
      }
    } catch {
      notice = 'unavailable';
    }
    if (!alive(t)) return;
    setLocating(false); setBusy(false); setLocationNotice(notice);
    const cam = cameraRef.current;
    if (lookupCanceled || !cameraAvailable() || !cam) {
      setError(locationCopy.cameraReady); lock.current = false; return;
    }
    const id = ++recId.current;
    recordingRef.current = true;
    setRecording(true); setElapsed(0);
    const started = Date.now();
    const recordingLocation = countryCode ? { countryCode, recordedAt: new Date(started).toISOString() } : undefined;
    clearTimer();
    timerRef.current = setInterval(() => {
      if (mounted.current) setElapsed(Math.min(maxSeconds, (Date.now() - started) / 1000));
    }, 250);
    lock.current = false;
    try {
      const result = await cam.recordAsync({ maxDuration: maxSeconds });
      if (alive(t) && discardId.current !== id && result?.uri) setAsset({ uri: result.uri, type: 'video', recordingLocation });
    } catch (e) {
      if (alive(t) && discardId.current !== id) setError(`Recording stopped: ${errText(e)}`);
    } finally {
      if (recId.current === id) { recordingRef.current = false; clearTimer(); lock.current = false; }
      if (mounted.current && recId.current === id) setRecording(false);
    }
  };

  const shutter = () => {
    if (lock.current) return;
    if (recordingRef.current) { lock.current = true; stopNative(); return; } // unlocked when record promise settles
    if (busy || !readyRef.current || !cameraActive) return;
    lock.current = true;
    setError(null); setProblem(null);
    if (isVideoMode) startRecording(); else takePhoto();
  };

  const openLibrary = async () => {
    if (recording || busy || lock.current) return;
    lock.current = true;
    const t = session.current;
    setError(null); setProblem(null);
    if (!IS_WEB) setPicking(true);
    try {
      if (!IS_WEB) {
        const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!perm.granted) {
          if (alive(t)) setProblem({ message: `Nino needs photo library access to choose media. ${perm.canAskAgain ? 'Tap again to retry.' : 'Enable it in device settings.'}`, settings: !perm.canAskAgain });
          return;
        }
      }
      const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images', 'videos'], quality: 0.8 });
      if (!alive(t)) return;
      const a = res.canceled ? null : res.assets[0];
      if (a) {
        if (a.type === 'video' || a.type === 'image') { setLocationNotice('unlocated'); setAsset({ uri: a.uri, type: a.type, mimeType: a.mimeType, file: a.file, recordingLocation: undefined }); }
        else setError('This media format is not supported. Choose a photo or video.');
      }
    } catch (e) {
      if (alive(t)) setError(`Could not open your library: ${errText(e)}`);
    } finally {
      if (alive(t)) { lock.current = false; setPicking(false); }
    }
  };

  const retake = () => {
    if (busy || uploading.current) return;
    locationAbort.current?.abort(); locationAbort.current = null;
    session.current++; setLocationNotice(null); setLocating(false);
    ticket.current = null; setBytes(null); setPhase(null);
    setAsset(null); setCaption(''); setError(null); setElapsed(0);
  };

  const save = async () => {
    if (busy || uploading.current || !asset) return;
    if (!allowPublish || !isSignedIn || !userId) { setError(copy.signIn); return; }
    uploading.current = true;
    setBusy(true); setError(null);
    const t = session.current;
    try {
      if (!(await getToken())) throw new Error(copy.signIn);
      if (!alive(t)) return;
      if (ticket.current && ticket.current.ownerId !== userId) throw new Error(copy.signIn);
      setPhase('upload');
      if (!ticket.current) {
        const media = await readUploadMedia(asset, copy.invalid, copy.limit);
        if (!alive(t)) return;
        const result = await requestUpload.mutateAsync({ data: { contentType: media.contentType, size: media.size, kind: asset.type === 'video' ? 'video' : 'photo' } });
        if (!alive(t)) return;
        ticket.current = { ...result, ownerId: userId, uploaded: false, media };
      }
      const pending = ticket.current;
      if (!pending.uploaded) {
        await uploadMedia(pending.uploadUrl, pending.media, (value) => { if (alive(t)) setBytes(value); },
          (cancel) => { cancelUpload.current = cancel; if (!alive(t)) cancel(); });
        if (!alive(t)) return;
        pending.uploaded = true;
        cancelUpload.current = null;
      }
      setPhase('finalize');
      const post = await publish.mutateAsync({ data: { uploadId: pending.uploadId, caption: caption.trim(),
        ...(asset.type === 'video' && asset.recordingLocation ? { recordingLocation: asset.recordingLocation } : {}) } });
      if (!alive(t)) return;
      // Never mark published before the server has finalized. Same ticket survives errors,
      // including a lost finalize response, so the server's idempotency prevents duplicates.
      await onSave(post);
      reset();
      onClose();
    } catch (e) {
      if (alive(t)) setError(`${copy.failed}\n${errText(e)}`);
    } finally {
      uploading.current = false;
      cancelUpload.current = null;
      if (mounted.current) { setBusy(false); setPhase(null); }
    }
  };

  const openSettings = async () => {
    try { await Linking.openSettings(); } catch (e) { setError(`Could not open settings: ${errText(e)}`); }
  };

  const feedback = (
    <>
      {isVideoMode ? (
        <View style={[styles.toast, { backgroundColor: c.overlay, borderColor: c.border }]} accessibilityLiveRegion="polite">
          <Text testID="create-location-notice" style={[styles.toastText, { color: c.secondary }]}>
            {locating ? locationCopy.checking : locationNotice ? locationCopy[locationNotice] : locationCopy.rationale}
          </Text>
        </View>
      ) : null}
      {problem ? (
        <View style={[styles.toast, { backgroundColor: c.overlay, borderColor: c.danger }]}>
          <Text style={[styles.toastText, { color: c.text }]}>{problem.message}</Text>
          {problem.settings && !IS_WEB ? (
            <Pressable testID="create-settings" onPress={openSettings} accessibilityRole="button" style={styles.inlineBtn}>
              <Feather name="settings" size={15} color={c.accent} /><Text style={[styles.inlineText, { color: c.accent }]}>Open Settings</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
      {error ? (
        <Pressable onPress={() => setError(null)} style={[styles.toast, { backgroundColor: c.overlay, borderColor: c.danger }]}>
          <Text testID="create-error" style={[styles.toastText, { color: c.text }]}>{error}</Text>
        </Pressable>
      ) : null}
      {liveInfo ? (
        <Pressable onPress={() => setLiveInfo(false)} style={[styles.toast, { backgroundColor: c.overlay, borderColor: c.border }]}>
          <Text style={[styles.toastText, { color: c.secondary }]}>Live broadcasting isn't connected to Nino yet. Nothing will stream.</Text>
        </Pressable>
      ) : null}
    </>
  );

  const renderPreview = (a: Captured) => (
    <View testID="create-post" style={[styles.root, { backgroundColor: c.bgTop, paddingTop: ins.top, paddingBottom: ins.bottom }]}>
      <View style={styles.header}>
        <Pressable testID="create-retake" onPress={retake} disabled={busy} accessibilityRole="button" accessibilityLabel="Retake" style={styles.iconButton}>
          <Feather name="chevron-left" size={26} color={c.text} />
        </Pressable>
        <Text style={[styles.heading, { color: c.text }]}>{copy.newPost}</Text>
        <Pressable testID="create-close" onPress={close} disabled={busy} accessibilityRole="button" accessibilityLabel="Close composer" style={styles.iconButton}>
          <Feather name="x" size={24} color={c.text} />
        </Pressable>
      </View>
      <KeyboardAwareScrollViewCompat contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" bottomOffset={20}>
        <View style={[styles.media, { backgroundColor: c.card, borderColor: c.border }]}>
          {a.type === 'video' ? <VideoPreview key={a.uri} uri={a.uri} /> : <Image source={{ uri: a.uri }} style={styles.fill} contentFit="contain" accessibilityLabel="Captured photo preview" />}
        </View>
        <Pressable testID="create-change" onPress={retake} disabled={busy} accessibilityRole="button" style={styles.inlineBtn}>
          <Feather name="rotate-ccw" size={15} color={c.accent} />
          <Text style={[styles.inlineText, { color: c.accent }]}>Retake</Text>
        </Pressable>
        <TextInput testID="create-caption" value={caption} onChangeText={setCaption} multiline maxLength={500} editable={!busy}
          placeholder={copy.caption} placeholderTextColor={c.muted} accessibilityLabel={copy.caption}
          style={[styles.input, { color: c.text, borderColor: c.border, backgroundColor: c.cardSoft }]} />
        <View style={[styles.notice, { backgroundColor: c.accentWash, borderColor: c.border }]}>
          <Feather name="map-pin" size={16} color={c.accent} />
          <Text testID="create-recording-country" style={[styles.body, { color: c.secondary, flex: 1 }]}>
            {a.recordingLocation ? locationCopy.countryNotice(a.recordingLocation.countryCode) : locationCopy[locationNotice ?? 'unlocated']}
          </Text>
        </View>
        <View style={[styles.notice, { backgroundColor: c.accentWash, borderColor: c.border }]}>
          <Feather name="smartphone" size={16} color={c.accent} />
          <Text style={[styles.body, { color: c.secondary, flex: 1 }]}>{allowPublish && isSignedIn ? copy.notice : copy.signIn}</Text>
        </View>
        {busy && bytes ? <View accessibilityLiveRegion="polite">
          <Text testID="create-upload-progress" style={[styles.body, { color: c.secondary }]}>{phase === 'finalize' ? copy.finalizing : copy.uploading} · {Math.min(100, Math.round(bytes.sent / bytes.total * 100))}% · {(bytes.sent / 1048576).toFixed(1)} / {(bytes.total / 1048576).toFixed(1)} MB</Text>
          <View style={[styles.progressTrack, { backgroundColor: c.accentWash, width: '100%', marginTop: 8 }]}><View style={[styles.progressFill, { backgroundColor: c.accent, width: `${Math.min(100, bytes.sent / bytes.total * 100)}%` }]} /></View>
        </View> : null}
        <Pressable testID="create-save" disabled={busy} onPress={save} accessibilityRole="button"
          style={[styles.save, { backgroundColor: c.accent, opacity: busy ? 0.5 : 1 }]}>
          <Feather name="check" size={18} color={c.onAccent} />
          <Text style={[styles.inlineText, { color: c.onAccent }]}>{busy ? copy.publishing : error ? `${copy.retry} · ${copy.publish}` : copy.publish}</Text>
        </Pressable>
        {error ? <Text testID="create-error" style={[styles.body, { color: c.danger }]}>{error}</Text> : null}
      </KeyboardAwareScrollViewCompat>
    </View>
  );

  const renderPermission = () => {
    const denied = camPerm && !camPerm.granted && (asked || !camPerm.canAskAgain);
    return (
      <View style={styles.permWrap}>
        <View style={[styles.permIcon, { backgroundColor: c.accentWash, borderColor: c.border }]}>
          <Feather name={denied ? 'camera-off' : 'camera'} size={30} color={c.accent} />
        </View>
        <Text style={[styles.permTitle, { color: c.text }]}>{denied ? 'Camera access is off' : 'Opening camera…'}</Text>
        {denied ? (
          <>
            <Text style={[styles.permBody, { color: c.secondary }]}>
              {camPerm?.canAskAgain ? 'Allow camera access to capture photos and videos.' : 'Turn on camera access for Nino in your device settings.'}
            </Text>
            {camPerm?.canAskAgain || IS_WEB ? (
              <Pressable testID="create-allow" onPress={() => { requestCam().catch((e) => setError(errText(e))); }} style={[styles.permBtn, { backgroundColor: c.accent }]} accessibilityRole="button">
                <Text style={[styles.inlineText, { color: c.onAccent }]}>Allow camera</Text>
              </Pressable>
            ) : (
              <Pressable testID="create-settings" onPress={openSettings} style={[styles.permBtn, { backgroundColor: c.accent }]} accessibilityRole="button">
                <Feather name="settings" size={16} color={c.onAccent} /><Text style={[styles.inlineText, { color: c.onAccent }]}>Open Settings</Text>
              </Pressable>
            )}
            <Text style={[styles.permBody, { color: c.muted }]}>You can still pick from your library below.</Text>
          </>
        ) : null}
      </View>
    );
  };

  const shutterDisabled = !recording && (!ready || busy || !cameraActive || (IS_WEB && isVideoMode));

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={close} statusBarTranslucent>
      {asset ? renderPreview(asset) : (
        <View testID="create-post" style={[styles.root, { backgroundColor: c.bgTop }]}>
          {cameraActive ? (
            <CameraView
              key={`${facing}-${isVideoMode ? 'video' : 'picture'}`}
              ref={cameraRef}
              style={StyleSheet.absoluteFill}
              facing={facing}
              mode={isVideoMode ? 'video' : 'picture'}
              active={cameraActive}
              onCameraReady={() => { if (mounted.current) markReady(true); }}
              onMountError={(e) => { if (mounted.current) setError(`Camera unavailable: ${e.message}`); }}
            />
          ) : granted ? null : renderPermission()}

          {/* Top bar */}
          <View style={[styles.topBar, { paddingTop: ins.top + 6 }]} pointerEvents="box-none">
            <Pressable testID="create-close" onPress={close} hitSlop={8} accessibilityRole="button" accessibilityLabel="Close camera" style={[styles.glass, { backgroundColor: c.overlay }]}>
              <Feather name="x" size={22} color={c.text} />
            </Pressable>
            {recording ? (
              <View style={[styles.timer, { backgroundColor: c.overlay, borderColor: c.danger }]} accessibilityLiveRegion="polite">
                <View style={[styles.recDot, { backgroundColor: c.danger }]} />
                <Text style={[styles.timerText, { color: c.text }]}>{fmt(elapsed)}</Text>
                <Text style={[styles.timerMax, { color: c.secondary }]}>/ {fmt(maxSeconds)}</Text>
              </View>
            ) : (
              <Pressable testID="create-live" onPress={() => setLiveInfo((v) => !v)} style={[styles.livePill, { backgroundColor: c.overlay, borderColor: c.border }]} accessibilityRole="button" accessibilityLabel="Live broadcasting unavailable">
                <Feather name="radio" size={13} color={c.muted} />
                <Text style={[styles.liveText, { color: c.muted }]}>LIVE · OFF</Text>
              </Pressable>
            )}
            <Pressable testID="create-flip" onPress={() => { if (lock.current || recordingRef.current) return; markReady(false); setFacing((f) => (f === 'back' ? 'front' : 'back')); }} disabled={recording || busy || !granted}
              hitSlop={8} accessibilityRole="button" accessibilityLabel="Flip camera"
              style={[styles.glass, { backgroundColor: c.overlay, opacity: recording || busy || !granted ? 0.35 : 1 }]}>
              <Feather name="refresh-cw" size={20} color={c.text} />
            </Pressable>
          </View>

          {/* Bottom controls */}
          <View style={[styles.bottom, { paddingBottom: ins.bottom + 14 }]} pointerEvents="box-none">
            <View style={styles.feedbackWrap}>{feedback}</View>
            {IS_WEB && isVideoMode && !error ? (
              <Text style={[styles.hint, { color: c.secondary }]}>Browser can't record video · use Photo or library</Text>
            ) : null}
            {recording && elapsed > 0 ? (
              <View style={[styles.progressTrack, { backgroundColor: c.accentWash }]}>
                <View style={[styles.progressFill, { backgroundColor: c.accent, width: `${Math.min(100, (elapsed / maxSeconds) * 100)}%` }]} />
              </View>
            ) : null}
            <View style={styles.controls}>
              <Pressable testID="create-library" onPress={openLibrary} disabled={recording || busy}
                accessibilityRole="button" accessibilityLabel="Choose from library"
                style={[styles.sideBtn, { borderColor: c.borderStrong, backgroundColor: c.overlay, opacity: recording || busy ? 0.35 : 1 }]}>
                <Feather name="image" size={22} color={c.text} />
              </Pressable>
              <Pressable testID="create-shutter" onPress={shutter} disabled={shutterDisabled}
                accessibilityRole="button" accessibilityLabel={recording ? 'Stop recording' : isVideoMode ? 'Start recording' : 'Take photo'}
                style={[styles.shutterRing, { borderColor: recording ? c.danger : c.text, opacity: shutterDisabled ? 0.4 : 1 }]}>
                <View style={[
                  recording ? styles.shutterStop : styles.shutterCore,
                  { backgroundColor: isVideoMode ? c.danger : c.accent },
                ]} />
              </Pressable>
              <View style={styles.sideBtnGhost}>
                {!ready && cameraActive ? <Text style={[styles.readyText, { color: c.secondary }]}>warming{'\n'}up</Text> : null}
              </View>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.modes}
              accessibilityRole="radiogroup" pointerEvents={recording ? 'none' : 'auto'} style={{ opacity: recording ? 0.3 : 1, flexGrow: 0 }}>
              {MODES.map((m) => {
                const sel = m.id === mode;
                return (
                  <Pressable key={String(m.id)} testID={`create-mode-${m.id}`} onPress={() => { if (!recording && !busy && !lock.current && m.id !== mode) { if (isVideoMode !== (m.id !== 'photo')) markReady(false); setMode(m.id); setError(null); } }}
                    disabled={recording || busy} accessibilityRole="radio" accessibilityState={{ selected: sel }} accessibilityLabel={m.spoken}
                    style={[styles.mode, sel && { backgroundColor: c.accent }]}>
                    <Text style={[styles.modeText, { color: sel ? c.onAccent : c.text }]}>{m.label}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        </View>
      )}
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  fill: { width: '100%', height: '100%' },
  topBar: { position: 'absolute', left: 0, right: 0, top: 0, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  glass: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  timer: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, height: 34, borderRadius: 17, borderWidth: 1 },
  recDot: { width: 8, height: 8, borderRadius: 4 },
  timerText: { fontFamily: 'Poppins_600SemiBold', fontSize: 15, fontVariant: ['tabular-nums'] },
  timerMax: { fontFamily: 'Poppins_400Regular', fontSize: 12 },
  livePill: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, height: 30, borderRadius: 15, borderWidth: 1 },
  liveText: { fontFamily: 'Poppins_600SemiBold', fontSize: 11, letterSpacing: 1 },
  bottom: { position: 'absolute', left: 0, right: 0, bottom: 0, alignItems: 'center', gap: 14 },
  feedbackWrap: { width: '100%', paddingHorizontal: 16, gap: 8 },
  toast: { borderWidth: 1, borderRadius: 14, padding: 12, gap: 4 },
  toastText: { fontFamily: 'Poppins_400Regular', fontSize: 13, lineHeight: 19 },
  hint: { fontFamily: 'Poppins_400Regular', fontSize: 12 },
  progressTrack: { width: '70%', height: 3, borderRadius: 2, overflow: 'hidden' },
  progressFill: { height: 3 },
  controls: { width: '100%', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 36 },
  sideBtn: { width: 52, height: 52, borderRadius: 14, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  sideBtnGhost: { width: 52, height: 52, alignItems: 'center', justifyContent: 'center' },
  readyText: { fontFamily: 'Poppins_400Regular', fontSize: 10, textAlign: 'center' },
  shutterRing: { width: 84, height: 84, borderRadius: 42, borderWidth: 5, alignItems: 'center', justifyContent: 'center' },
  shutterCore: { width: 64, height: 64, borderRadius: 32 },
  shutterStop: { width: 30, height: 30, borderRadius: 8 },
  modes: { paddingHorizontal: 16, gap: 6, alignItems: 'center', flexGrow: 1, justifyContent: 'center' },
  mode: { minWidth: 52, height: 36, paddingHorizontal: 14, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  modeText: { fontFamily: 'Poppins_600SemiBold', fontSize: 13 },
  permWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32, gap: 12 },
  permIcon: { width: 72, height: 72, borderRadius: 36, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  permTitle: { fontFamily: 'Poppins_600SemiBold', fontSize: 20, textAlign: 'center' },
  permBody: { fontFamily: 'Poppins_400Regular', fontSize: 13, lineHeight: 20, textAlign: 'center' },
  permBtn: { minHeight: 48, paddingHorizontal: 24, borderRadius: 999, flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center' },
  header: { height: 56, paddingHorizontal: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  iconButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  heading: { fontFamily: 'Poppins_600SemiBold', fontSize: 18 },
  content: { paddingHorizontal: 18, paddingBottom: 48, gap: 12 },
  media: { height: 360, borderRadius: 18, overflow: 'hidden', borderWidth: 1 },
  notice: { flexDirection: 'row', gap: 10, padding: 12, borderWidth: 1, borderRadius: 14, alignItems: 'center' },
  body: { fontFamily: 'Poppins_400Regular', fontSize: 12, lineHeight: 18 },
  inlineBtn: { minHeight: 40, alignSelf: 'flex-start', flexDirection: 'row', gap: 8, alignItems: 'center' },
  inlineText: { fontFamily: 'Poppins_600SemiBold', fontSize: 14 },
  input: { borderWidth: 1, borderRadius: 14, minHeight: 96, textAlignVertical: 'top', padding: 12, fontFamily: 'Poppins_400Regular', fontSize: 15 },
  save: { minHeight: 52, borderRadius: 999, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
});
