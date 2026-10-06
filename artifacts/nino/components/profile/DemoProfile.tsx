import * as ImagePicker from 'expo-image-picker';
import React, { useEffect, useState } from 'react';
import { Feather } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { Alert, Platform, Pressable, Share, Text, TextInput, View } from 'react-native';
import { PreviewTag, Sheet } from '@/components/feed/Sheets';
import { useColors } from '@/hooks/useColors';
import { SAMPLE_POSTS } from '@/components/feed/data';
import { useI18n } from '@/lib/i18n';
import type { ProfileCtx } from './profileCtx';
import { ProfileLanguageButton, ProfileView } from './ProfileView';
import type { ProfileItem } from './ProfileView';
import { usePostCopy } from '@/lib/postTranslations';

const SAMPLE_UPLOADS: ProfileItem[] = [
  { id: 'demo-falls', kind: 'video', image: require('@/assets/images/feed-kyoto.jpg'), video: require('@/assets/videos/falls.mp4'), label: 'Mist at the falls', caption: 'Sample clip · CC-licensed footage bundled with the demo', views: 4210, pinned: true },
  { id: 'demo-coast', kind: 'video', image: require('@/assets/images/feed-rio-scenic.jpg'), video: require('@/assets/videos/italy.mp4'), label: 'Seaside morning', caption: 'Sample clip · CC-licensed footage bundled with the demo', views: 1873, pinned: true },
  { id: 'demo-tokyo', kind: 'photo', image: require('@/assets/images/feed-tokyo.jpg'), label: 'Tokyo after rain', caption: 'Sample photo', views: 962 },
  { id: 'demo-istanbul', kind: 'photo', image: require('@/assets/images/discover-turkiye.jpg'), label: 'Blue hour, Istanbul', caption: 'Sample photo', views: 538 },
  { id: 'demo-peony', kind: 'video', image: require('@/assets/images/feed-santorini.jpg'), video: require('@/assets/videos/peony.mp4'), label: 'Peony in bloom', caption: 'Sample clip · CC-licensed footage bundled with the demo', views: 347 },
  { id: 'demo-cairo', kind: 'photo', image: require('@/assets/images/discover-egypt.jpg'), label: 'Cairo rooftops', caption: 'Sample photo', views: 291 },
];

export function DemoProfile({ name, ctx, onExitDemo, active = true }: { name: string; ctx: ProfileCtx; onExitDemo?: () => void; active?: boolean }) {
  const c = useColors();
  const copy = usePostCopy();
  const { t, font, row, align, rtl } = useI18n();
  const [shownName, setShownName] = useState(name);
  const [bio, setBio] = useState('Exploring the world one story and one language at a time. City walks, local food, new people.');
  const [editing, setEditing] = useState(false);
  useEffect(() => { if (!active) setEditing(false); }, [active]);
  const [photo, setPhoto] = useState<string | null>(null);
  const [draftPhoto, setDraftPhoto] = useState<string | null>(null);
  const pickPhoto = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) { Alert.alert(t('profilePhotoAccess'), t('profilePhotoAccessBody')); return; }
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.8 });
    if (!res.canceled && res.assets[0]) setDraftPhoto(res.assets[0].uri);
  };
  const [draftName, setDraftName] = useState(name);
  const [draftBio, setDraftBio] = useState('');
  const openEdit = () => { setDraftName(shownName); setDraftBio(bio); setDraftPhoto(photo); setEditing(true); };
  const saveEdit = () => { setShownName(draftName.trim() || name); setBio(draftBio.trim()); setPhoto(draftPhoto); setEditing(false); };
  const input = { color: c.text, fontFamily: font(), textAlign: align, writingDirection: rtl ? 'rtl' : 'ltr', fontSize: 15, borderWidth: 1, borderColor: c.border, backgroundColor: c.cardSoft, borderRadius: 12, paddingHorizontal: 12, minHeight: 44, marginTop: 6 } as const;
  const label = { color: c.secondary, fontFamily: font('medium'), textAlign: align, fontSize: 12, marginTop: 14 } as const;

  const share = () => {
    Share.share({ message: t('profileShareDemo').replace('{name}', shownName) }).catch(() => undefined);
  };
  const menu = () => {
    if (!onExitDemo) return;
    if (Platform.OS === 'web') { onExitDemo(); return; }
    Alert.alert(t('profileDemoTitle'), t('profileDemoBody'), [{ text: t('profileCancel'), style: 'cancel' }, { text: t('profileExitDemo'), style: 'destructive', onPress: onExitDemo }]);
  };

  return (
    <>
    <ProfileView
      active={active}
      testID="demo-profile"
      name={shownName} imageUrl={photo} handle="alex.demo" flag="🇨🇦" countryCode="CAN" badge={t('profileDemoBadge')}
      speaks={t('profileEnglishNative')} understands={['FR', 'ES']}
      bio={bio}
      stats={{ following: ctx.following.length, followers: 1284, likes: 8736 }}
      statsNote={t('profileDemoStats')}
      following={ctx.following} followingEmpty={t('profileDemoFollowing')}
      onUnfollow={ctx.onUnfollow}
      onEdit={openEdit} onShare={share} onMenu={onExitDemo ? menu : undefined}
        onAdd={ctx.onAdd} addLabel={copy.newPost}
        uploadNote={copy.demoNotice}
      tabs={{
         posts: { items: SAMPLE_UPLOADS.map((item) => ({ ...item, caption: t(item.kind === 'video' ? 'profileSampleClip' : 'profileSampleCaption') })), emptyTitle: '', emptyBody: '' },
         private: { items: [], emptyTitle: t('profileNoPrivate'), emptyBody: t('profileDemoPrivateBody') },
         reposts: { items: [], emptyTitle: t('profileNoReposts'), emptyBody: t('profileNoRepostsBody') },
         liked: { items: ctx.liked, emptyTitle: t('profileNoLiked'), emptyBody: t('profileDemoLikedBody').replace('{count}', String(SAMPLE_POSTS.length)) },
      }}
    />
    <Sheet visible={active && editing} onClose={() => setEditing(false)} title={t('profileEditDemo')} testID="demo-edit-sheet">
      <PreviewTag text={t('profileDemoSession')} />
      <View style={{ paddingTop: 12 }}><ProfileLanguageButton onNavigate={() => setEditing(false)} /></View>
      <View style={{ flexDirection: row, flexWrap: 'wrap', alignItems: 'center', gap: 14, marginTop: 14 }}>
        <View style={{ width: 64, height: 64, borderRadius: 32, borderWidth: 2, borderColor: c.accent, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', backgroundColor: c.cardSoft }}>
          {draftPhoto ? <Image source={{ uri: draftPhoto }} style={{ width: 64, height: 64 }} contentFit="cover" accessibilityLabel={t('profileDemoPicture')} /> : <Feather name="user" size={26} color={c.secondary} />}
        </View>
        <Pressable testID="demo-edit-photo" onPress={pickPhoto} accessibilityRole="button" style={{ minHeight: 44, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, borderWidth: 1, borderColor: c.accent, flexDirection: row, alignItems: 'center', gap: 6, flexShrink: 1 }}>
          <Feather name="camera" size={15} color={c.accent} />
          <Text style={{ color: c.accent, fontFamily: font('semibold'), fontSize: 13, textAlign: align, flexShrink: 1 }}>{t('profileChangePicture')}</Text>
        </Pressable>
        {draftPhoto ? (
          <Pressable testID="demo-edit-photo-remove" onPress={() => setDraftPhoto(null)} accessibilityRole="button" accessibilityLabel={t('profileRemovePicture')} style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}>
            <Feather name="trash-2" size={17} color={c.danger} />
          </Pressable>
        ) : null}
      </View>
      <Text style={label}>{t('profileName')}</Text>
      <TextInput testID="demo-edit-name" value={draftName} onChangeText={setDraftName} maxLength={40} style={input} placeholderTextColor={c.muted} accessibilityLabel={t('profileName')} />
      <Text style={label}>{t('profileBio')}</Text>
      <TextInput testID="demo-edit-bio" value={draftBio} onChangeText={setDraftBio} maxLength={160} multiline style={[input, { minHeight: 88, paddingTop: 10, textAlignVertical: 'top' }]} accessibilityLabel={t('profileBio')} />
      <Pressable testID="demo-edit-save" onPress={saveEdit} accessibilityRole="button" style={{ marginTop: 18, minHeight: 48, paddingVertical: 10, paddingHorizontal: 12, borderRadius: 999, backgroundColor: c.accent, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ color: c.onAccent, fontFamily: font('semibold'), fontSize: 15, textAlign: 'center' }}>{t('profileSaveSession')}</Text>
      </Pressable>
    </Sheet>
    </>
  );
}
