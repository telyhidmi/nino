import { Feather } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useVideoPlayer, VideoView } from 'expo-video';
import React, { useState } from 'react';
import { Linking, Modal, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { KeyboardAwareScrollViewCompat } from '@/components/KeyboardAwareScrollViewCompat';
import { useInsets } from '@/components/ui';
import { useColors } from '@/hooks/useColors';
import type { ProfileItem } from '@/components/profile/ProfileView';

type Choice = 'photo' | 'video' | 'library';
type PermissionProblem = { message: string; settings: boolean };

const RECORDING_LENGTHS = [
  { seconds: 600, label: '10 min', spoken: '10 minutes' },
  { seconds: 60, label: '60s', spoken: '60 seconds' },
  { seconds: 30, label: '30s', spoken: '30 seconds' },
  { seconds: 15, label: '15s', spoken: '15 seconds' },
] as const;
type RecordingLength = (typeof RECORDING_LENGTHS)[number]['seconds'];

function VideoPreview({ uri }: { uri: string }) {
  const player = useVideoPlayer({ uri });
  return <VideoView player={player} style={styles.preview} contentFit="contain" nativeControls />;
}

export function CreatePost({ visible, onClose, onSave }: { visible: boolean; onClose: () => void; onSave: (item: ProfileItem) => void }) {
  const c = useColors();
  const ins = useInsets();
  const [asset, setAsset] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [caption, setCaption] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [permission, setPermission] = useState<PermissionProblem | null>(null);
  const [liveInfo, setLiveInfo] = useState(false);
  const [recordingLength, setRecordingLength] = useState<RecordingLength>(60);
  const recordingLabel = RECORDING_LENGTHS.find((option) => option.seconds === recordingLength)!.spoken;

  const close = () => {
    if (busy) return;
    setAsset(null); setCaption(''); setError(null); setPermission(null); setLiveInfo(false);
    onClose();
  };

  const choose = async (choice: Choice) => {
    if (busy) return;
    setBusy(true); setError(null); setPermission(null); setLiveInfo(false);
    try {
      // On web the picker must be launched directly from the tap gesture.
      if (Platform.OS !== 'web') {
        const response = choice === 'library'
          ? await ImagePicker.requestMediaLibraryPermissionsAsync()
          : await ImagePicker.requestCameraPermissionsAsync();
        if (!response.granted) {
          const label = choice === 'library' ? 'photo library' : 'camera';
          setPermission({
            message: `Nino needs ${label} access to ${choice === 'library' ? 'choose media' : choice === 'video' ? 'record a video' : 'take a photo'}. ${response.canAskAgain ? 'Tap again to retry.' : 'Enable access in device settings.'}`,
            settings: !response.canAskAgain,
          });
          return;
        }
      }
      const result = choice === 'library'
        ? await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images', 'videos'], quality: 0.8 })
        : await ImagePicker.launchCameraAsync({
          mediaTypes: choice === 'video' ? ['videos'] : ['images'],
          quality: 0.8,
          ...(choice === 'video' ? { videoMaxDuration: recordingLength } : {}),
        });
      if (!result.canceled && result.assets[0]) {
        const picked = result.assets[0];
        if (picked.type !== 'video' && picked.type !== 'image') {
          setError('This media format is not supported. Choose a photo or video.');
        } else {
          setAsset(picked);
        }
      }
    } catch (e) {
      setError(`Could not ${choice === 'library' ? 'open your library' : choice === 'video' ? 'record video' : 'take photo'}: ${e instanceof Error ? e.message : 'Unknown error'}`);
    } finally {
      setBusy(false);
    }
  };

  const save = () => {
    if (busy || !asset) return;
    setBusy(true);
    try {
      const isVideo = asset.type === 'video';
      const text = caption.trim();
      onSave({
        id: `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        kind: isVideo ? 'video' : 'photo',
        local: true,
        image: isVideo ? undefined : { uri: asset.uri },
        video: isVideo ? { uri: asset.uri } : undefined,
        label: text ? text.slice(0, 48) : isVideo ? 'Your video' : 'Your photo',
        caption: text || 'Saved locally for this session. Not published.',
      });
      setBusy(false);
      close();
    } catch (e) {
      setError(`Could not save this local post: ${e instanceof Error ? e.message : 'Unknown error'}`);
      setBusy(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={close}>
      <View testID="create-post" style={[styles.root, { backgroundColor: c.bgTop, paddingTop: ins.top, paddingBottom: ins.bottom }]}>
        <View style={styles.header}>
          <Pressable testID="create-close" onPress={close} disabled={busy} accessibilityRole="button" accessibilityLabel="Close composer" style={styles.iconButton}>
            <Feather name="x" size={24} color={c.text} />
          </Pressable>
          <Text style={[styles.heading, { color: c.text }]}>Create</Text>
          <View style={styles.iconButton} />
        </View>
        <KeyboardAwareScrollViewCompat contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" bottomOffset={20}>
          <View style={[styles.notice, { backgroundColor: c.accentWash, borderColor: c.border }]}>
            <Feather name="info" size={18} color={c.accent} />
            <Text style={[styles.body, { color: c.secondary, flex: 1 }]}>Local only · your post appears on this device for this session. Nothing is uploaded or published. Media uses a temporary device file and may disappear when the app or device clears its cache.</Text>
          </View>
          {asset ? (
            <>
              <View style={[styles.media, { backgroundColor: c.card }]}>
                {asset.type === 'video' ? <VideoPreview key={asset.uri} uri={asset.uri} /> : <Image source={{ uri: asset.uri }} style={styles.preview} contentFit="contain" accessibilityLabel="Selected photo preview" />}
              </View>
              <Text style={[styles.label, { color: c.secondary }]}>{asset.type === 'video' ? 'Video preview' : 'Photo preview'}</Text>
              <Pressable testID="create-change" onPress={() => setAsset(null)} disabled={busy} accessibilityRole="button" style={styles.change}>
                <Feather name="refresh-cw" size={15} color={c.accent} />
                <Text style={[styles.actionText, { color: c.accent }]}>Choose different media</Text>
              </Pressable>
              <Text style={[styles.label, { color: c.secondary }]}>Caption</Text>
              <TextInput testID="create-caption" value={caption} onChangeText={setCaption} multiline maxLength={500}
                placeholder="Add a caption to your local post" placeholderTextColor={c.muted} accessibilityLabel="Post caption"
                style={[styles.input, { color: c.text, borderColor: c.border, backgroundColor: c.cardSoft }]} />
              <Pressable testID="create-save" disabled={busy} onPress={save} accessibilityRole="button"
                style={[styles.save, { backgroundColor: c.accent, opacity: busy ? 0.5 : 1 }]}>
                <Feather name="check" size={18} color={c.onAccent} />
                <Text style={[styles.actionText, { color: c.onAccent }]}>Save to my profile · local only</Text>
              </Pressable>
            </>
          ) : (
            <>
              <Text style={[styles.label, { color: c.secondary }]}>VIDEO RECORDING LENGTH</Text>
              <View style={styles.durations} accessibilityRole="radiogroup" accessibilityLabel="Video recording length">
                {RECORDING_LENGTHS.map((option) => {
                  const selected = recordingLength === option.seconds;
                  return (
                    <Pressable key={option.seconds} testID={`create-duration-${option.seconds}`}
                      onPress={() => setRecordingLength(option.seconds)} disabled={busy}
                      accessibilityRole="radio" accessibilityLabel={option.spoken}
                      accessibilityState={{ checked: selected, disabled: busy }}
                      style={[styles.duration, {
                        backgroundColor: selected ? c.accent : c.card,
                        borderColor: selected ? c.accent : c.border,
                        opacity: busy ? 0.5 : 1,
                      }]}>
                      <Text style={[styles.actionText, { color: selected ? c.onAccent : c.text }]}>{option.label}</Text>
                    </Pressable>
                  );
                })}
              </View>
              <Text style={[styles.body, { color: c.secondary }]}>
                Record up to {recordingLabel}. You can stop earlier.
                {Platform.OS === 'web' ? ' Browser cameras may not enforce this limit.' : Platform.OS === 'android' ? ' The limit depends on your camera app.' : ''}
              </Text>
              <Text style={[styles.label, { color: c.secondary }]}>CHOOSE MEDIA</Text>
              {([
                ['photo', 'camera', 'Take photo', 'Open your device camera'],
                ['video', 'video', 'Record video', 'Capture a video with your device camera'],
                ['library', 'image', 'Choose from library', 'Select a photo or video'],
              ] as const).map(([key, icon, title, subtitle]) => (
                <Pressable key={key} testID={`create-${key}`} disabled={busy} onPress={() => choose(key)} accessibilityRole="button"
                  style={[styles.option, { borderColor: c.border, backgroundColor: c.card, opacity: busy ? 0.5 : 1 }]}>
                  <View style={[styles.optionIcon, { backgroundColor: c.accentWash }]}><Feather name={icon} size={23} color={c.accent} /></View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.optionTitle, { color: c.text }]}>{title}</Text>
                    <Text style={[styles.body, { color: c.secondary }]}>{key === 'video' ? `Open camera · up to ${recordingLabel}` : subtitle}</Text>
                  </View>
                  <Feather name="chevron-right" size={18} color={c.secondary} />
                </Pressable>
              ))}
              <Pressable testID="create-live" onPress={() => setLiveInfo(true)} accessibilityRole="button"
                style={[styles.option, { borderColor: c.border, backgroundColor: c.card }]}>
                <View style={[styles.optionIcon, { backgroundColor: c.accentWash }]}><Feather name="radio" size={23} color={c.accent} /></View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.optionTitle, { color: c.text }]}>Live · unavailable</Text>
                  <Text style={[styles.body, { color: c.secondary }]}>Broadcasting is not connected</Text>
                </View>
                <Feather name="info" size={18} color={c.secondary} />
              </Pressable>
              {liveInfo ? <Text style={[styles.feedback, { color: c.secondary }]}>Live streaming requires a broadcasting service, which is not connected to Nino. No broadcast will start.</Text> : null}
            </>
          )}
          {busy ? <Text style={[styles.feedback, { color: c.secondary }]}>Opening device media…</Text> : null}
          {permission ? (
            <View style={[styles.feedbackBox, { borderColor: c.danger }]}>
              <Text style={[styles.feedback, { color: c.text }]}>{permission.message}</Text>
              {permission.settings && Platform.OS !== 'web' ? (
                <Pressable testID="create-settings" onPress={async () => {
                  try { await Linking.openSettings(); } catch (e) { setError(`Could not open settings: ${e instanceof Error ? e.message : 'Unknown error'}`); }
                }} accessibilityRole="button" style={styles.change}>
                  <Feather name="settings" size={16} color={c.accent} /><Text style={[styles.actionText, { color: c.accent }]}>Open Settings</Text>
                </Pressable>
              ) : null}
            </View>
          ) : null}
          {error ? <Text testID="create-error" style={[styles.feedback, { color: c.danger }]}>{error}</Text> : null}
        </KeyboardAwareScrollViewCompat>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { height: 56, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  iconButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  heading: { fontFamily: 'Poppins_600SemiBold', fontSize: 19 },
  content: { paddingHorizontal: 18, paddingBottom: 48, gap: 12 },
  notice: { flexDirection: 'row', gap: 10, padding: 14, borderWidth: 1, borderRadius: 14, alignItems: 'flex-start', marginBottom: 8 },
  body: { fontFamily: 'Poppins_400Regular', fontSize: 12, lineHeight: 19 },
  label: { fontFamily: 'Poppins_600SemiBold', fontSize: 12, letterSpacing: 0.5, marginTop: 8 },
  durations: { flexDirection: 'row', gap: 8 },
  duration: { flex: 1, minHeight: 48, borderWidth: 1, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  media: { height: 280, borderRadius: 16, overflow: 'hidden' },
  preview: { width: '100%', height: '100%' },
  change: { minHeight: 44, alignSelf: 'flex-start', flexDirection: 'row', gap: 8, alignItems: 'center' },
  actionText: { fontFamily: 'Poppins_600SemiBold', fontSize: 14 },
  input: { borderWidth: 1, borderRadius: 14, minHeight: 100, textAlignVertical: 'top', padding: 12, fontFamily: 'Poppins_400Regular', fontSize: 15 },
  save: { minHeight: 50, borderRadius: 999, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 10 },
  option: { minHeight: 72, borderWidth: 1, borderRadius: 16, flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12 },
  optionIcon: { width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center' },
  optionTitle: { fontFamily: 'Poppins_600SemiBold', fontSize: 15 },
  feedbackBox: { borderWidth: 1, borderRadius: 12, padding: 12 },
  feedback: { fontFamily: 'Poppins_400Regular', fontSize: 13, lineHeight: 20 },
});