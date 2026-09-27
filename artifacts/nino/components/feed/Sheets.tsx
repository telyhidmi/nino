import { Feather } from '@expo/vector-icons';
import React, { useState } from 'react';
import { FlatList, Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useColors } from '@/hooks/useColors';
import { useInsets } from '@/components/ui';
import { SampleComment, SamplePost } from './data';

export function Sheet({ visible, onClose, title, children, testID }: { visible: boolean; onClose: () => void; title: string; children: React.ReactNode; testID?: string }) {
  const c = useColors();
  const ins = useInsets();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={[StyleSheet.absoluteFill, { backgroundColor: c.overlay }]} onPress={onClose} accessibilityLabel="Close sheet" />
      <View testID={testID} style={[s.sheet, { backgroundColor: c.card, borderColor: c.border, paddingBottom: ins.bottom + 16 }]}>
        <View style={[s.grab, { backgroundColor: c.muted }]} />
        <View style={s.head}>
          <Text style={[s.title, { color: c.text }]}>{title}</Text>
          <Pressable onPress={onClose} hitSlop={8} style={s.x} accessibilityRole="button" accessibilityLabel="Close" testID={`${testID}-close`}>
            <Feather name="x" size={20} color={c.secondary} />
          </Pressable>
        </View>
        {children}
      </View>
    </Modal>
  );
}

export function PreviewTag({ text = 'Preview · sample content' }: { text?: string }) {
  const c = useColors();
  return (
    <View style={[s.tag, { borderColor: c.border, backgroundColor: c.accentWash }]}>
      <Feather name="eye" size={11} color={c.accent} />
      <Text style={{ color: c.accent, fontFamily: 'Poppins_500Medium', fontSize: 11 }}>{text}</Text>
    </View>
  );
}

export function CommentsSheet({ post, visible, onClose, extra, onAdd }: { post: SamplePost; visible: boolean; onClose: () => void; extra: SampleComment[]; onAdd: (t: string) => void }) {
  const c = useColors();
  const [text, setText] = useState('');
  const all = [...post.comments, ...extra];
  return (
    <Sheet visible={visible} onClose={onClose} title={`Comments · ${all.length}`} testID="comments-sheet">
      <PreviewTag text="Sample comments · yours last this demo session only" />
      <FlatList
        style={{ maxHeight: 340, marginTop: 12 }}
        data={all}
        keyExtractor={(i) => i.id}
        renderItem={({ item }) => (
          <View style={s.comment}>
            <View style={[s.av, { backgroundColor: c.accentWash, borderColor: c.border }]}><Text>{item.flag}</Text></View>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={{ color: c.secondary, fontFamily: 'Poppins_500Medium', fontSize: 12 }}>{item.author}</Text>
              <Text style={{ color: c.text, fontFamily: 'Poppins_400Regular', fontSize: 14 }}>{item.text}</Text>
              {item.translation ? <Text style={{ color: c.accent, fontFamily: 'Poppins_400Regular', fontSize: 12 }}>{item.translation}</Text> : null}
            </View>
          </View>
        )}
      />
      <View style={[s.input, { borderColor: c.border, backgroundColor: c.cardSoft }]}>
        <TextInput
          testID="comment-input"
          value={text}
          onChangeText={setText}
          placeholder="Add a comment (demo only)"
          placeholderTextColor={c.muted}
          style={{ flex: 1, color: c.text, fontFamily: 'Poppins_400Regular', fontSize: 14, minHeight: 44 }}
          accessibilityLabel="Comment text"
        />
        <Pressable
          testID="comment-send"
          accessibilityRole="button"
          accessibilityLabel="Post comment"
          disabled={!text.trim()}
          onPress={() => { onAdd(text.trim()); setText(''); }}
          style={[s.send, { backgroundColor: text.trim() ? c.accent : c.accentWash }]}
        >
          <Feather name="send" size={16} color={text.trim() ? c.onAccent : c.muted} />
        </Pressable>
      </View>
    </Sheet>
  );
}

export function TranslateSheet({ post, visible, onClose }: { post: SamplePost; visible: boolean; onClose: () => void }) {
  const c = useColors();
  const [sel, setSel] = useState(post.translations[0]?.code);
  const cur = post.translations.find((t) => t.code === sel);
  return (
    <Sheet visible={visible} onClose={onClose} title="Translate with Nino" testID="translate-sheet">
      <PreviewTag text="Curated preview translations · live AI not connected yet" />
      <Text style={{ color: c.secondary, fontFamily: 'Poppins_400Regular', fontSize: 13, marginTop: 12 }}>Original</Text>
      <Text style={{ color: c.text, fontFamily: 'Poppins_500Medium', fontSize: 15, marginTop: 4 }}>{post.caption}</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 16 }}>
        {post.translations.map((t) => {
          const on = t.code === sel;
          return (
            <Pressable key={t.code} testID={`lang-${t.code}`} onPress={() => setSel(t.code)} accessibilityRole="button" accessibilityState={{ selected: on }} accessibilityLabel={`Show ${t.label}`}
              style={[s.langChip, { borderColor: on ? c.accent : c.border, backgroundColor: on ? c.accentWash : 'transparent' }]}>
              <Text style={{ color: on ? c.accent : c.text, fontFamily: t.code === 'ar' ? 'Cairo_600SemiBold' : 'Poppins_500Medium', fontSize: 13 }}>{t.label}</Text>
            </Pressable>
          );
        })}
      </View>
      {cur ? (
        <View style={[s.result, { borderColor: c.borderStrong, backgroundColor: c.cardSoft }]}>
          <Text style={{ color: c.text, fontSize: 16, lineHeight: 24, fontFamily: cur.code === 'ar' ? 'Cairo_600SemiBold' : 'Poppins_400Regular', textAlign: cur.code === 'ar' ? 'right' : 'left' }}>{cur.text}</Text>
        </View>
      ) : null}
    </Sheet>
  );
}

export function SoonSheet({ visible, onClose, icon, title, body }: { visible: boolean; onClose: () => void; icon: keyof typeof Feather.glyphMap; title: string; body: string }) {
  const c = useColors();
  return (
    <Sheet visible={visible} onClose={onClose} title={title} testID="soon-sheet">
      <View style={{ alignItems: 'center', gap: 12, paddingVertical: 16 }}>
        <View style={[s.soonIcon, { borderColor: c.accent, backgroundColor: c.accentWash }]}><Feather name={icon} size={28} color={c.accent} /></View>
        <Text style={{ color: c.accent, fontFamily: 'Poppins_600SemiBold', fontSize: 12, letterSpacing: 1.5 }}>COMING SOON</Text>
        <Text style={{ color: c.secondary, fontFamily: 'Poppins_400Regular', fontSize: 14, textAlign: 'center', lineHeight: 21, maxWidth: 320 }}>{body}</Text>
      </View>
    </Sheet>
  );
}

const s = StyleSheet.create({
  sheet: { position: 'absolute', left: 0, right: 0, bottom: 0, borderTopLeftRadius: 24, borderTopRightRadius: 24, borderWidth: 1, paddingHorizontal: 20, paddingTop: 10, maxWidth: 560, alignSelf: 'center', width: '100%' },
  grab: { width: 40, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 8, opacity: 0.6 },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  title: { fontFamily: 'Poppins_600SemiBold', fontSize: 17 },
  x: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  tag: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', borderWidth: 1, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  comment: { flexDirection: 'row', gap: 10, paddingVertical: 10 },
  av: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  input: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderRadius: 999, paddingLeft: 16, paddingRight: 4, marginTop: 12 },
  send: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  langChip: { minHeight: 44, paddingHorizontal: 16, borderRadius: 999, borderWidth: 1, justifyContent: 'center' },
  result: { marginTop: 16, borderWidth: 1, borderRadius: 16, padding: 16 },
  soonIcon: { width: 68, height: 68, borderRadius: 34, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
});
