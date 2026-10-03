import type { QueryClient, Query } from '@tanstack/react-query';
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
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
