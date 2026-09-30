import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator, FlatList, Modal, Platform, Pressable, StyleProp, StyleSheet, Text, TextInput, TextInputProps, View, ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/hooks/useColors';
import { LANGS, useI18n } from '@/lib/i18n';

export function useInsets() {
  const i = useSafeAreaInsets();
  const web = Platform.OS === 'web';
  return { top: web ? Math.max(i.top, 67) : i.top, bottom: web ? Math.max(i.bottom, 34) : i.bottom };
}

export function Background({ children }: { children: React.ReactNode }) {
  const c = useColors();
  return (
    <LinearGradient colors={[c.bgTop, c.bgBottom]} style={{ flex: 1 }}>
      <View pointerEvents="none" style={[styles.orb, { backgroundColor: c.accent }]} />
      {children}
    </LinearGradient>
  );
}

export function PillButton({
  label, onPress, variant = 'primary', loading, disabled, icon, testID, style,
}: {
  label: string; onPress: () => void; variant?: 'primary' | 'ghost' | 'danger'; loading?: boolean; disabled?: boolean;
  icon?: keyof typeof Feather.glyphMap; testID?: string; style?: StyleProp<ViewStyle>;
}) {
  const c = useColors();
  const { font, row } = useI18n();
  const off = disabled || loading;
  const primary = variant === 'primary';
  const fg = primary ? c.onAccent : variant === 'danger' ? c.danger : c.text;
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      disabled={off}
      onPress={() => { if (Platform.OS !== 'web') Haptics.selectionAsync(); onPress(); }}
      style={({ pressed }) => [
        styles.pill,
        { flexDirection: row },
        primary
          ? { backgroundColor: c.accent, shadowColor: c.accent, shadowOpacity: 0, shadowRadius: 0, shadowOffset: { width: 0, height: 0 }, elevation: 8 }
          : { borderWidth: 1, borderColor: variant === 'danger' ? 'rgba(255,59,74,0.45)' : c.border, backgroundColor: variant === 'danger' ? c.dangerWash : 'rgba(26,26,29,0.6)' },
        off && { opacity: 0.5 },
        pressed && { transform: [{ scale: 0.98 }], opacity: 0.9 },
        style,
      ]}
    >
      {loading ? <ActivityIndicator color={fg} /> : (
        <>
          {icon ? <Feather name={icon} size={18} color={fg} /> : null}
          <Text style={[styles.pillText, { color: fg, fontFamily: font('semibold') }]}>{label}</Text>
        </>
      )}
    </Pressable>
  );
}

export function Field({ label, error, ...props }: TextInputProps & { label: string; error?: string }) {
  const c = useColors();
  const { font, align, rtl } = useI18n();
  const [focus, setFocus] = useState(false);
  return (
    <View style={{ gap: 8 }}>
      <Text style={[styles.label, { color: c.secondary, fontFamily: font('medium'), textAlign: align }]}>{label}</Text>
      <TextInput
        placeholderTextColor={c.muted}
        {...props}
        onFocus={(e) => { setFocus(true); props.onFocus?.(e); }}
        onBlur={(e) => { setFocus(false); props.onBlur?.(e); }}
        style={[
          styles.input,
          {
            color: c.text, backgroundColor: c.card, borderColor: error ? c.danger : focus ? c.borderStrong : c.border,
            fontFamily: font('regular'), textAlign: props.keyboardType === 'email-address' || props.secureTextEntry ? (rtl ? 'right' : 'left') : align,
          },
        ]}
      />
      {error ? <Text style={[styles.err, { color: c.danger, fontFamily: font('regular'), textAlign: align }]}>{error}</Text> : null}
    </View>
  );
}

export function Card({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  const c = useColors();
  return <View style={[{ backgroundColor: c.card, borderColor: c.border, borderWidth: 1, borderRadius: 18, padding: 18 }, style]}>{children}</View>;
}

export function Banner({ text, tone = 'error' }: { text?: string | null; tone?: 'error' | 'info' }) {
  const c = useColors();
  const { font, row, align } = useI18n();
  if (!text) return null;
  const col = tone === 'error' ? c.danger : c.accent;
  return (
    <View style={[styles.banner, { flexDirection: row, borderColor: tone === 'error' ? 'rgba(255,59,74,0.4)' : c.border, backgroundColor: tone === 'error' ? c.dangerWash : c.accentWash }]}>
      <Feather name={tone === 'error' ? 'alert-circle' : 'check-circle'} size={16} color={col} />
      <Text style={{ flex: 1, color: c.text, fontFamily: font('regular'), fontSize: 13, textAlign: align }}>{text}</Text>
    </View>
  );
}

export function Title({ title, body }: { title: string; body?: string }) {
  const c = useColors();
  const { font, align } = useI18n();
  return (
    <View style={{ gap: 6 }}>
      <Text style={{ color: c.text, fontFamily: font('bold'), fontSize: 26, textAlign: align }}>{title}</Text>
      {body ? <Text style={{ color: c.secondary, fontFamily: font('regular'), fontSize: 14, lineHeight: 22, textAlign: align }}>{body}</Text> : null}
    </View>
  );
}

export function IconButton({ icon, onPress, testID }: { icon: keyof typeof Feather.glyphMap; onPress: () => void; testID?: string }) {
  const c = useColors();
  return (
    <Pressable testID={testID} onPress={onPress} hitSlop={8} style={({ pressed }) => [styles.iconBtn, { borderColor: c.border, backgroundColor: 'rgba(26,26,29,0.7)' }, pressed && { opacity: 0.7 }]}>
      <Feather name={icon} size={20} color={c.text} />
    </Pressable>
  );
}

export function BackButton({ fallback = '/' }: { fallback?: string }) {
  const { rtl } = useI18n();
  return <IconButton testID="back" icon={rtl ? 'arrow-right' : 'arrow-left'} onPress={() => (router.canGoBack() ? router.back() : router.replace(fallback as never))} />;
}

export function LanguagePill() {
  const c = useColors();
  const { lang, font, row } = useI18n();
  const cur = LANGS.find((l) => l.code === lang)!;
  return (
    <Pressable testID="language-pill" onPress={() => router.push('/language?from=switch')} style={({ pressed }) => [styles.langPill, { flexDirection: row, borderColor: c.border, backgroundColor: 'rgba(26,26,29,0.7)' }, pressed && { opacity: 0.7 }]}>
      <Feather name="globe" size={14} color={c.accent} />
      <Text style={{ color: c.text, fontFamily: font('medium'), fontSize: 13 }}>{cur.native}</Text>
      <Feather name="chevron-down" size={14} color={c.secondary} />
    </Pressable>
  );
}

export type PickItem = { key: string; title: string; subtitle?: string; lead?: string };

export function SelectField({ label, placeholder, value, onPress, error, lead, testID }: { label: string; placeholder: string; value?: string; onPress: () => void; error?: string; lead?: string; testID?: string }) {
  const c = useColors();
  const { font, align, row, rtl } = useI18n();
  return (
    <View style={{ gap: 8 }}>
      <Text style={[styles.label, { color: c.secondary, fontFamily: font('medium'), textAlign: align }]}>{label}</Text>
      <Pressable testID={testID} onPress={onPress} style={({ pressed }) => [styles.input, { flexDirection: row, alignItems: 'center', gap: 10, backgroundColor: c.card, borderColor: error ? c.danger : c.border }, pressed && { opacity: 0.85 }]}>
        {lead ? <Text style={{ fontSize: 20 }}>{lead}</Text> : null}
        <Text style={{ flex: 1, color: value ? c.text : c.muted, fontFamily: font('regular'), fontSize: 15, textAlign: align }}>{value || placeholder}</Text>
        <Feather name={rtl ? 'chevron-left' : 'chevron-right'} size={18} color={c.secondary} />
      </Pressable>
      {error ? <Text style={[styles.err, { color: c.danger, fontFamily: font('regular'), textAlign: align }]}>{error}</Text> : null}
    </View>
  );
}

export function PickerSheet({
  visible, title, items, selected, multi, onToggle, onClose,
}: { visible: boolean; title: string; items: PickItem[]; selected: string[]; multi?: boolean; onToggle: (k: string) => void; onClose: () => void }) {
  const c = useColors();
  const { font, align, row, t } = useI18n();
  const ins = useInsets();
  const [q, setQ] = useState('');
  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    return s ? items.filter((i) => i.title.toLowerCase().includes(s) || (i.subtitle ?? '').toLowerCase().includes(s)) : items;
  }, [q, items]);
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: c.overlay, justifyContent: 'flex-end' }}>
        <View style={[styles.sheet, { backgroundColor: c.bgBottom, borderColor: c.border, paddingBottom: ins.bottom + 12, marginTop: ins.top + 20 }]}>
          <View style={[{ flexDirection: row, alignItems: 'center', justifyContent: 'space-between' }]}>
            <Text style={{ color: c.text, fontFamily: font('semibold'), fontSize: 18 }}>{title}</Text>
            <Pressable testID="picker-done" onPress={() => { setQ(''); onClose(); }} hitSlop={10}>
              <Text style={{ color: c.accent, fontFamily: font('semibold'), fontSize: 15 }}>{multi ? t('continue') : t('cancel')}</Text>
            </Pressable>
          </View>
          <View style={[styles.search, { flexDirection: row, backgroundColor: c.card, borderColor: c.border }]}>
            <Feather name="search" size={16} color={c.secondary} />
            <TextInput value={q} onChangeText={setQ} placeholder={t('search')} placeholderTextColor={c.muted} style={{ flex: 1, color: c.text, fontFamily: font('regular'), fontSize: 15, textAlign: align, paddingVertical: 10 }} />
          </View>
          <FlatList
            data={list}
            keyExtractor={(i) => i.key}
            keyboardShouldPersistTaps="handled"
            scrollEnabled={list.length > 0}
            ListEmptyComponent={
              <View style={{ alignItems: 'center', padding: 32, gap: 8 }}>
                <Feather name="compass" size={28} color={c.muted} />
                <Text style={{ color: c.secondary, fontFamily: font('regular') }}>{t('noResults')}</Text>
              </View>
            }
            renderItem={({ item }) => {
              const on = selected.includes(item.key);
              return (
                <Pressable
                  testID={`pick-${item.key}`}
                  onPress={() => { onToggle(item.key); if (!multi) { setQ(''); onClose(); } }}
                  style={({ pressed }) => [styles.row, { flexDirection: row, borderColor: on ? c.borderStrong : 'transparent', backgroundColor: on ? c.accentWash : 'transparent' }, pressed && { opacity: 0.7 }]}
                >
                  {item.lead ? <Text style={{ fontSize: 22 }}>{item.lead}</Text> : null}
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: c.text, fontFamily: font('medium'), fontSize: 15, textAlign: align }}>{item.title}</Text>
                    {item.subtitle ? <Text style={{ color: c.secondary, fontFamily: font('regular'), fontSize: 12, textAlign: align }}>{item.subtitle}</Text> : null}
                  </View>
                  <Feather name={on ? 'check-circle' : 'circle'} size={20} color={on ? c.accent : c.muted} />
                </Pressable>
              );
            }}
          />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  orb: { position: 'absolute', width: 420, height: 420, borderRadius: 210, top: -220, right: -160, opacity: 0.07 },
  pill: { height: 54, borderRadius: 999, alignItems: 'center', justifyContent: 'center', gap: 10, paddingHorizontal: 24 },
  pillText: { fontSize: 16 },
  label: { fontSize: 13 },
  input: { minHeight: 52, borderRadius: 14, borderWidth: 1, paddingHorizontal: 16, fontSize: 15 },
  err: { fontSize: 12 },
  banner: { gap: 10, alignItems: 'center', padding: 12, borderRadius: 14, borderWidth: 1 },
  iconBtn: { width: 42, height: 42, borderRadius: 21, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  langPill: { alignItems: 'center', gap: 6, paddingHorizontal: 12, height: 36, borderRadius: 999, borderWidth: 1 },
  sheet: { flex: 1, borderTopLeftRadius: 24, borderTopRightRadius: 24, borderWidth: 1, padding: 20, gap: 14 },
  search: { alignItems: 'center', gap: 8, borderRadius: 14, borderWidth: 1, paddingHorizontal: 14 },
  row: { alignItems: 'center', gap: 12, padding: 12, borderRadius: 14, borderWidth: 1, marginBottom: 4 },
});
