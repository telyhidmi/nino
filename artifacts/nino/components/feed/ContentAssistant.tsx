import { Feather } from '@expo/vector-icons';
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useGenerateContentAssist, type ContentAssistResult, type ContentAssistInputLanguage } from '@workspace/api-client-react';
import { confirmAction } from '@/components/profile/ProfileView';
import { useColors } from '@/hooks/useColors';
import { getAssistFrames } from '@/lib/assistFrames';
import { useAssistCopy } from '@/lib/assistCopy';
import { useI18n } from '@/lib/i18n';
import type { CapturedMedia } from '@/lib/uploadMedia';

const LIMIT = 500;
type Kind = 'shortCaption' | 'storyCaption' | 'description';
type Props = { asset: CapturedMedia; caption: string; onApply: (text: string) => void; disabled: boolean };

/** Keyed per asset URI so results never leak across media. */
export function ContentAssistant(props: Props) {
  return <AssistPanel key={props.asset.uri} {...props} />;
}

function AssistPanel({ asset, caption, onApply, disabled }: Props) {
  const c = useColors();
  const { copy, lang } = useAssistCopy();
  const { font, row, align, rtl } = useI18n();
  const regular = { fontFamily: font(), writingDirection: rtl ? 'rtl' as const : 'ltr' as const };
  const semi = { ...regular, fontFamily: font('semibold') };
  const prose = { ...regular, textAlign: align };
  const abort = useRef(new AbortController());
  const gen = useRef(0);
  const mounted = useRef(true);
  const assist = useGenerateContentAssist({ request: { signal: abort.current.signal } });
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ContentAssistResult | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [kind, setKind] = useState<Kind>('shortCaption');
  const [tags, setTags] = useState<Set<string>>(new Set());
  const [note, setNote] = useState<{ text: string; bad: boolean } | null>(null);

  useEffect(() => {
    mounted.current = true;
    const ctrl = abort.current;
    return () => { mounted.current = false; gen.current++; ctrl.abort(); };
  }, []);

  const analyze = async () => {
    if (loading || disabled) return;
    const id = ++gen.current;
    const deadline = Date.now() + 90000;
    setLoading(true); setFailure(null); setNote(null);
    // Bound the entire operation, including platform media decoder promises.
    const watchdog = setTimeout(() => {
      if (!mounted.current || gen.current !== id) return;
      gen.current++;
      abort.current.abort();
      abort.current = new AbortController();
      setFailure(copy.failed); setLoading(false);
    }, 90000);
    let frames: string[];
    try {
      frames = await getAssistFrames(asset);
      if (!frames.length) throw new Error('empty');
    } catch {
      clearTimeout(watchdog);
      if (mounted.current && gen.current === id) { setFailure(copy.framesFailed); setLoading(false); }
      return;
    }
    if (!mounted.current || gen.current !== id) { clearTimeout(watchdog); return; }
    if (Date.now() >= deadline) {
      clearTimeout(watchdog); setFailure(copy.failed); setLoading(false); return;
    }
    try {
      const r = await assist.mutateAsync({ data: { frames, mediaType: asset.type, language: lang as ContentAssistInputLanguage, context: caption.slice(0, LIMIT) } });
      if (!mounted.current || gen.current !== id) return;
      if (Date.now() >= deadline) { setFailure(copy.failed); return; }
      setResult(r); setKind('shortCaption'); setTags(new Set());
    } catch {
      // Never surface raw server/network detail here.
      if (mounted.current && gen.current === id) setFailure(copy.failed);
    } finally {
      clearTimeout(watchdog);
      if (mounted.current && gen.current === id) setLoading(false);
    }
  };
  const cancel = () => {
    gen.current++;
    abort.current.abort();
    abort.current = new AbortController();
    setLoading(false);
  };

  const commit = (text: string) => {
    if (text.length > LIMIT) { setNote({ text: copy.tooLong, bad: true }); return; }
    onApply(text); setNote({ text: copy.applied, bad: false });
  };

  const useSuggestion = () => {
    if (!result || disabled) return;
    const text = result[kind].trim();
    if (text.length > LIMIT) { setNote({ text: copy.tooLong, bad: true }); return; }
    if (caption.trim()) confirmAction(copy.replaceTitle, copy.replaceBody, copy.replace, () => { if (mounted.current) commit(text); }, copy.cancel);
    else commit(text);
  };

  const addTags = () => {
    if (!result || disabled || !tags.size) return;
    const existing = new Set((caption.match(/#[\p{L}\p{N}_]+/gu) ?? []).map(h => h.toLowerCase()));
    const fresh = result.hashtags.filter((h) => tags.has(h)).map((h) => (h.startsWith('#') ? h : `#${h}`))
      .filter((h) => !existing.has(h.toLowerCase()));
    if (!fresh.length) { setTags(new Set()); return; }
    const base = caption.trimEnd();
    commit(base ? `${base} ${fresh.join(' ')}` : fresh.join(' '));
    setTags(new Set());
  };

  const toggle = (h: string) => setTags((s) => { const n = new Set(s); n.has(h) ? n.delete(h) : n.add(h); return n; });
  const kinds: { id: Kind; label: string }[] = [
    { id: 'shortCaption', label: copy.short }, { id: 'storyCaption', label: copy.story }, { id: 'description', label: copy.description },
  ];
  const blocked = disabled || loading;
  const count = caption.length;

  return (
    <View testID="content-assistant" style={[styles.card, { backgroundColor: c.cardSoft, borderColor: c.border }]}>
      {loading ? <Pressable testID="assist-cancel" onPress={cancel} accessibilityRole="button" style={{ minHeight: 44, justifyContent: 'center' }}>
        <Text style={[prose, semi, { color: c.accent }]}>{copy.cancel}</Text>
      </Pressable> : null}
      <View style={[styles.head, { flexDirection: row }]}>
        <View style={[styles.badge, { backgroundColor: c.accentWash }]}><Feather name="aperture" size={15} color={c.accent} /></View>
        <Text style={[styles.title, semi, { color: c.text, flex: 1, textAlign: align }]}>{copy.title}</Text>
        <Text testID="caption-count" style={[styles.count, regular, { color: count > LIMIT - 40 ? c.danger : c.muted, writingDirection: 'ltr' }]}>{count}/{LIMIT}</Text>
      </View>
      <Text style={[styles.small, prose, { color: c.secondary }]}>{asset.type === 'video' ? copy.discloseVideo : copy.disclosePhoto}</Text>

      {loading ? (
        <View style={styles.skel} accessibilityLiveRegion="polite">
          <Text style={[styles.small, prose, { color: c.muted }]}>{copy.analyzing}</Text>
          {[0.92, 0.7, 0.8].map((w, i) => <View key={i} style={[styles.bar, { width: `${w * 100}%`, backgroundColor: c.accentWash, alignSelf: rtl ? 'flex-end' : 'flex-start' }]} />)}
        </View>
      ) : null}

      {failure && !loading ? (
        <View style={[styles.fail, { flexDirection: row, borderColor: c.danger }]} accessibilityLiveRegion="polite">
          <Feather name="alert-circle" size={15} color={c.danger} />
          <Text style={[styles.small, prose, { color: c.text, flex: 1 }]}>{failure}</Text>
        </View>
      ) : null}

      {result && !loading ? (
        <View style={{ gap: 12 }}>
          <View style={[styles.seen, { backgroundColor: c.accentWash }]}>
            <Text style={[styles.label, semi, { color: c.accent, textAlign: align }]}>{copy.seen}</Text>
            <Text style={[styles.body, prose, { color: c.text }]}>{result.observations}</Text>
          </View>
          <View style={[styles.tabs, { flexDirection: row, borderColor: c.border }]} accessibilityRole="tablist">
            {kinds.map((k) => (
              <Pressable key={k.id} testID={`assist-kind-${k.id}`} onPress={() => setKind(k.id)} accessibilityRole="tab" accessibilityState={{ selected: kind === k.id }}
                style={[styles.tab, kind === k.id && { backgroundColor: c.accent }]}>
                <Text style={[styles.tabText, semi, { color: kind === k.id ? c.onAccent : c.secondary }]}>{k.label}</Text>
              </Pressable>
            ))}
          </View>
          <Text testID="assist-suggestion" selectable style={[styles.body, prose, { color: c.text }]}>{result[kind]}</Text>
          <Pressable testID="assist-use" onPress={useSuggestion} disabled={disabled} accessibilityRole="button" accessibilityHint={disabled ? copy.busy : undefined}
            style={[styles.ghost, { flexDirection: row, borderColor: c.accent, opacity: disabled ? 0.4 : 1, alignSelf: rtl ? 'flex-end' : 'flex-start' }]}>
            <Feather name="corner-down-left" size={14} color={c.accent} />
            <Text style={[styles.tabText, semi, { color: c.accent }]}>{copy.useText}</Text>
          </Pressable>
          {result.hashtags.length ? (
            <View style={{ gap: 8 }}>
              <View style={[styles.head, { flexDirection: row }]}>
                <Text style={[styles.label, semi, { color: c.secondary, flex: 1, textAlign: align }]}>{copy.hashtags}</Text>
                <Pressable onPress={() => setTags(new Set(result.hashtags))} accessibilityRole="button" hitSlop={6}>
                  <Text style={[styles.small, semi, { color: c.accent }]}>{copy.selectAll}</Text>
                </Pressable>
              </View>
              <View style={[styles.chips, { flexDirection: row }]}>
                {result.hashtags.map((h) => {
                  const on = tags.has(h);
                  return (
                    <Pressable key={h} onPress={() => toggle(h)} accessibilityRole="checkbox" accessibilityState={{ checked: on }}
                      style={[styles.chip, { borderColor: on ? c.accent : c.border, backgroundColor: on ? c.accentWash : 'transparent' }]}>
                      <Text style={[styles.small, semi, { color: on ? c.accent : c.text, writingDirection: 'ltr' }]}>{h.startsWith('#') ? h : `#${h}`}</Text>
                    </Pressable>
                  );
                })}
              </View>
              <Pressable testID="assist-add-tags" onPress={addTags} disabled={disabled || !tags.size} accessibilityRole="button"
                style={[styles.ghost, { flexDirection: row, borderColor: c.accent, opacity: disabled || !tags.size ? 0.4 : 1, alignSelf: rtl ? 'flex-end' : 'flex-start' }]}>
                <Feather name="plus" size={14} color={c.accent} />
                <Text style={[styles.tabText, semi, { color: c.accent }]}>{copy.addTags}{tags.size ? ` · ${tags.size}` : ''}</Text>
              </Pressable>
            </View>
          ) : null}
        </View>
      ) : null}

      {note ? <Text testID="assist-note" accessibilityLiveRegion="polite" style={[styles.small, prose, { color: note.bad ? c.danger : c.secondary }]}>{note.text}</Text> : null}
      <Text style={[styles.small, prose, { color: c.muted }]}>{copy.review}</Text>

      <Pressable testID="assist-analyze" onPress={analyze} disabled={blocked} accessibilityRole="button" accessibilityState={{ busy: loading, disabled: blocked }}
        style={[styles.cta, { flexDirection: row, backgroundColor: c.accentWash, borderColor: c.accent, opacity: blocked ? 0.5 : 1 }]}>
        {loading ? <ActivityIndicator size="small" color={c.accent} /> : <Feather name={failure ? 'refresh-cw' : 'zap'} size={15} color={c.accent} />}
        <Text style={[styles.tabText, semi, { color: c.accent }]}>
          {disabled ? copy.busy : loading ? copy.analyzing : failure ? copy.retry : result ? copy.again : copy.analyze}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: 18, padding: 14, gap: 10 },
  head: { alignItems: 'center', gap: 8 },
  badge: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 15 },
  count: { fontSize: 12 },
  small: { fontSize: 12, lineHeight: 17 },
  body: { fontSize: 14, lineHeight: 20 },
  label: { fontSize: 11, letterSpacing: 0.6, textTransform: 'uppercase' },
  skel: { gap: 8 },
  bar: { height: 12, borderRadius: 6 },
  fail: { borderWidth: 1, borderRadius: 12, padding: 10, gap: 8, alignItems: 'center' },
  seen: { borderRadius: 12, padding: 10, gap: 4 },
  tabs: { borderWidth: 1, borderRadius: 999, padding: 3, gap: 3 },
  tab: { flex: 1, borderRadius: 999, paddingVertical: 7, alignItems: 'center' },
  tabText: { fontSize: 13 },
  ghost: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7, gap: 6, alignItems: 'center' },
  chips: { flexWrap: 'wrap', gap: 6 },
  chip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 },
  cta: { borderWidth: 1, borderRadius: 14, paddingVertical: 12, gap: 8, alignItems: 'center', justifyContent: 'center' },
});
