import { useQueryClient, type QueryClient, type Query } from '@tanstack/react-query';
import {
  getGetMessagingRelationshipQueryKey, useSetMessagingRelationship, type MessagingRelationship, type MessagingThread,
} from '@workspace/api-client-react';
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';

export const POLL_MS = 5000;

/** Matches every messaging query (profile, search, inbox pages, thread pages). */
export const isMessagingQuery = (q: Query) => typeof q.queryKey[0] === 'string' && (q.queryKey[0] as string).startsWith('/api/messaging');
const isInbox = (q: Query) => q.queryKey[0] === '/api/messaging/conversations';
const isThread = (id: string) => (q: Query) => q.queryKey[0] === `/api/messaging/conversations/${id}/messages`;

export function invalidateInbox(qc: QueryClient) {
  return qc.invalidateQueries({ predicate: isInbox });
}
export function invalidateThread(qc: QueryClient, id: string) {
  return qc.invalidateQueries({ predicate: isThread(id) });
}
/** Removes every account-scoped messaging record (sign-out / account switch). */
export function clearMessaging(qc: QueryClient) {
  void qc.cancelQueries({ predicate: isMessagingQuery });
  qc.removeQueries({ predicate: isMessagingQuery });
}

/** True only while this screen is focused and the app is in the foreground. */
export function useActive() {
  const [focused, setFocused] = useState(false);
  const [fg, setFg] = useState(AppState.currentState === 'active' || AppState.currentState == null);
  useFocusEffect(useCallback(() => { setFocused(true); return () => setFocused(false); }, []));
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => setFg(s === 'active'));
    return () => sub.remove();
  }, []);
  return focused && fg;
}

export function shortTime(iso: string, lang: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const now = new Date();
  try {
    if (d.toDateString() === now.toDateString()) return d.toLocaleTimeString(lang, { hour: 'numeric', minute: '2-digit' });
    return d.toLocaleDateString(lang, { month: 'short', day: 'numeric' });
  } catch {
    return d.toISOString().slice(0, 10);
  }
}

const isThreadAny = (q: Query) => typeof q.queryKey[0] === 'string' && /^\/api\/messaging\/conversations\/[^/]+\/messages$/.test(q.queryKey[0] as string);

/** Writes an authoritative server relationship into every cache that shows this peer, then refetches permissions. */
export function applyRelationship(qc: QueryClient, peerId: string, rel: MessagingRelationship) {
  qc.setQueryData(getGetMessagingRelationshipQueryKey(peerId), rel);
  for (const q of qc.getQueryCache().findAll({ predicate: isThreadAny })) {
    qc.setQueryData<MessagingThread>(q.queryKey, (old) => (old && old.conversation.peer.id === peerId ? { ...old, conversation: { ...old.conversation, relationship: rel } } : old));
  }
  void qc.invalidateQueries({ queryKey: getGetMessagingRelationshipQueryKey(peerId) });
  void qc.invalidateQueries({ predicate: isThreadAny });
  void invalidateInbox(qc);
}

/**
 * Follow toggle with no optimistic state: the UI shows `pending` until the
 * server answers, then adopts the server's relationship. Failures leave the
 * previous (true) state and surface `error`.
 */
export function useFollowToggle(peerId: string | undefined) {
  const qc = useQueryClient();
  const m = useSetMessagingRelationship();
  const mutate = useRef(m.mutate); mutate.current = m.mutate;
  const [error, setError] = useState(false);
  const busy = useRef(false);
  const toggle = useCallback((currentlyFollowing: boolean) => {
    if (!peerId || busy.current) return;
    busy.current = true; setError(false);
    mutate.current({ id: peerId, data: { following: !currentlyFollowing } }, {
      onSuccess: (rel) => applyRelationship(qc, peerId, rel),
      onError: () => { setError(true); void qc.invalidateQueries({ queryKey: getGetMessagingRelationshipQueryKey(peerId) }); },
      onSettled: () => { busy.current = false; },
    });
  }, [peerId, qc]);
  return { toggle, pending: m.isPending, error };
}
