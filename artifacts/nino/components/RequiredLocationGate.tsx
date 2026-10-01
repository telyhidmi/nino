import { Feather } from '@expo/vector-icons';
import * as Location from 'expo-location';
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, AppState, Linking, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Wordmark } from '@/components/Brand';
import { Background, Card, PickerSheet, PillButton, Title, useInsets } from '@/components/ui';
import { useColors } from '@/hooks/useColors';
import { LANGS, useI18n } from '@/lib/i18n';
import { closeActiveLiveSession } from '@/lib/liveSession';
import { useLocationGateCopy } from '@/lib/locationGateCopy';

export type LocationGateState = {
  status: 'checking' | 'requesting' | 'prompt' | 'granted' | 'denied' | 'unsupported' | 'error' | 'servicesDisabled';
  canAskAgain: boolean;
  issue?: 'insecure' | 'unsupported';
  retainRoutes?: boolean;
};
export interface LocationGateAdapter {
  check: () => Promise<LocationGateState>;
  request: () => Promise<LocationGateState>;
  subscribe: (listener: (state: LocationGateState) => void) => () => void;
  setForeground: (active: boolean, granted: boolean) => void;
  dispose: () => void;
}

const state = (status: LocationGateState['status'], canAskAgain = false): LocationGateState => ({ status, canAskAgain });

// Only a freshly verified grant permits visible/interactive access. A route tree
// that was already authorized may stay mounted, but hidden, during rechecking.
export function locationGateAllowsAccess(value: LocationGateState) { return value.status === 'granted'; }
export function locationGateKeepsRoutesMounted(value: LocationGateState) {
  return locationGateAllowsAccess(value)
    || (value.retainRoutes === true && (value.status === 'checking' || value.status === 'requesting'));
}

export function createNativeLocationAdapter(api = Location): LocationGateAdapter {
  let foreground = true;
  let requestEpoch = 0;
  let disposed = false;
  const verify = async (permission: Location.LocationPermissionResponse): Promise<LocationGateState> => {
    if (permission.status === 'granted' && permission.granted) {
      return state(await api.hasServicesEnabledAsync() ? 'granted' : 'servicesDisabled');
    }
    return state(permission.status === 'denied' ? 'denied' : 'prompt', permission.canAskAgain);
  };
  return {
    check: async () => verify(await api.getForegroundPermissionsAsync()),
    request: async () => {
      const epoch = ++requestEpoch;
      const permission = await api.getForegroundPermissionsAsync();
      if (disposed || !foreground || epoch !== requestEpoch) return state('checking');
      // Never re-prompt a permanently denied permission.
      return verify(permission.granted || !permission.canAskAgain ? permission : await api.requestForegroundPermissionsAsync());
    },
    subscribe: () => () => {},
    setForeground: (active) => { foreground = active; if (!active) requestEpoch++; },
    dispose: () => { disposed = true; requestEpoch++; },
  };
}

type BrowserLocationEnvironment = {
  navigator: Pick<Navigator, 'geolocation'> & { permissions?: Pick<Permissions, 'query'> };
  isSecureContext: boolean;
};

// The browser API is used directly: Expo's web permission shim is not evidence
// of a real grant. Position callbacks deliberately never read or retain coordinates.
export function createWebLocationAdapter(
  environment: BrowserLocationEnvironment | undefined = typeof window === 'undefined' ? undefined : {
    navigator: window.navigator,
    isSecureContext: window.isSecureContext,
  },
): LocationGateAdapter {
  let permission: PermissionStatus | undefined;
  let notify: ((value: LocationGateState) => void) | undefined;
  let provenGrant = false;
  let knownDenied = false;
  let foreground = true;
  let disposed = false;
  let requestEpoch = 0;
  let watch: number | undefined;
  const support = (): LocationGateState | undefined => {
    if (!environment?.navigator.geolocation) return { ...state('unsupported'), issue: 'unsupported' };
    if (!environment.isSecureContext) return { ...state('unsupported'), issue: 'insecure' };
    return undefined;
  };
  const permissionState = (): LocationGateState => permission?.state === 'granted'
    ? state('granted')
    : permission?.state === 'denied' ? state('denied') : state('prompt', true);
  const permissionChanged = () => {
    provenGrant = false;
    knownDenied = permission?.state === 'denied';
    if (!disposed && (foreground || permission?.state !== 'granted')) notify?.(permissionState());
  };
  const stopWatch = () => {
    if (watch !== undefined) environment?.navigator.geolocation.clearWatch(watch);
    watch = undefined;
  };
  const check = async (): Promise<LocationGateState> => {
    const unavailable = support();
    if (unavailable) return unavailable;
    if (environment?.navigator.permissions?.query) {
      try {
        const next = await environment.navigator.permissions.query({ name: 'geolocation' });
        if (disposed) return state('checking');
        if (permission !== next) {
          permission?.removeEventListener('change', permissionChanged);
          permission = next;
          permission.addEventListener('change', permissionChanged);
        }
        knownDenied = permission.state === 'denied';
        if (permission.state !== 'granted') provenGrant = false;
        return permissionState();
      } catch {
        // Some browsers expose Permissions but do not implement geolocation queries.
        // Fail closed until an explicit user gesture proves a geolocation grant.
      }
    }
    return provenGrant ? state('granted') : knownDenied ? state('denied', true) : state('prompt', true);
  };
  return {
    check,
    request: async () => {
      const epoch = ++requestEpoch;
      const current = await check();
      if (disposed || !foreground || epoch !== requestEpoch) return state('checking');
      if (current.status === 'granted' || current.status === 'unsupported') return current;
      if (current.status === 'denied' && !current.canAskAgain) return current;
      return new Promise<LocationGateState>((resolve) => {
        try {
          environment!.navigator.geolocation.getCurrentPosition(
            () => {
              if (disposed || !foreground || epoch !== requestEpoch) { resolve(state('checking')); return; }
              provenGrant = true; knownDenied = false;
              resolve(state('granted'));
            },
            (error) => {
              if (disposed || !foreground || epoch !== requestEpoch) { resolve(state('checking')); return; }
              provenGrant = false;
              knownDenied = error.code === 1;
              resolve(state(knownDenied ? 'denied' : 'error', !permission));
            },
            { enableHighAccuracy: false, maximumAge: 0, timeout: 12000 },
          );
        } catch { resolve(state('error')); }
      });
    },
    subscribe: (listener) => { notify = listener; return () => { notify = undefined; }; },
    setForeground: (active, granted) => {
      foreground = active;
      if (!active) { provenGrant = false; requestEpoch++; }
      if (!active || !granted || permission) { stopWatch(); return; }
      // Browsers without Permissions events can still report revocation through
      // a foreground geolocation watch. It stops when hidden or access is lost.
      if (watch === undefined && !support()) {
        try {
          watch = environment!.navigator.geolocation.watchPosition(
            () => {},
            (error) => {
              provenGrant = false; knownDenied = error.code === 1;
              stopWatch();
              if (!disposed && foreground) notify?.(state(knownDenied ? 'denied' : 'error', true));
            },
            { enableHighAccuracy: false, maximumAge: 0, timeout: 12000 },
          );
        } catch { provenGrant = false; notify?.(state('error')); }
      }
    },
    dispose: () => {
      disposed = true; requestEpoch++; notify = undefined; stopWatch();
      permission?.removeEventListener('change', permissionChanged);
    },
  };
}

// Kept alongside the gate so its race/permission behavior is testable without
// mounting Expo Router, Clerk, or real device permission sheets.
export class LocationGateController {
  current = state('checking');
  private epoch = 0;
  private active = true;
  private disposed = false;
  private busy = false;
  private unsubscribe: () => void;
  constructor(
    private adapter: LocationGateAdapter,
    private changed: (value: LocationGateState) => void,
    private accessLost: () => void,
  ) {
    this.unsubscribe = adapter.subscribe((value) => {
      if (this.disposed || (!this.active && value.status === 'granted')) return;
      this.epoch++; this.busy = false;
      this.publish(value);
    });
  }
  private publish(value: LocationGateState) {
    if (this.disposed) return;
    const wasMounted = locationGateKeepsRoutesMounted(this.current);
    const retainRoutes = value.status === 'granted'
      || (wasMounted && (value.status === 'checking' || value.status === 'requesting'));
    this.current = { ...value, retainRoutes };
    // Temporary background/focus checks are not revocations. The app's own
    // background camera/live cleanup remains responsible for physical capture.
    if (wasMounted && !retainRoutes) this.accessLost();
    this.changed(this.current);
    this.adapter.setForeground(this.active, locationGateAllowsAccess(value));
  }
  private async perform(request: boolean, block: boolean) {
    if (this.disposed || !this.active) return;
    // A focus check can supersede a passive poll while access is still visible.
    // Do not interrupt permission sheets or duplicate already-covered checks.
    if (this.busy && (!block || !locationGateAllowsAccess(this.current))) return;
    this.busy = true;
    const epoch = ++this.epoch;
    if (request || block) this.publish(state(request ? 'requesting' : 'checking'));
    try {
      const value = await (request ? this.adapter.request() : this.adapter.check());
      if (!this.disposed && this.active && epoch === this.epoch) this.publish(value);
    } catch {
      if (!this.disposed && this.active && epoch === this.epoch) this.publish(state('error', true));
    } finally {
      if (epoch === this.epoch) this.busy = false;
    }
  }
  refresh(block = false) { return this.perform(false, block); }
  request() { return this.perform(true, true); }
  setActive(active: boolean) {
    if (this.disposed || active === this.active) return;
    this.active = active; this.epoch++; this.busy = false;
    // Keep previously authorized routes mounted (drafts/picker/auth state), but
    // covered and noninteractive until a fresh foreground check succeeds.
    this.publish(state('checking'));
    if (active) void this.refresh();
  }
  dispose() {
    this.disposed = true; this.epoch++;
    this.unsubscribe(); this.adapter.dispose();
  }
}

export function RequiredLocationGate({ children }: { children: React.ReactNode }) {
  const c = useColors();
  const { ready, lang, t, setLang, font, align, row } = useI18n();
  const copy = useLocationGateCopy();
  const insets = useInsets();
  const [permission, setPermission] = useState<LocationGateState>(state('checking'));
  const [message, setMessage] = useState<'settingsError' | 'cleanupError' | 'languageSaveError'>();
  const [languagesOpen, setLanguagesOpen] = useState(false);
  const controller = useRef<LocationGateController | null>(null);

  useEffect(() => {
    let mounted = true;
    const gate = new LocationGateController(
      Platform.OS === 'web' ? createWebLocationAdapter() : createNativeLocationAdapter(),
      setPermission,
      () => {
        // Stop tracks immediately while auth remains mounted for the host's end
        // request. Definite permission loss unmounts CameraView/recording too.
        void closeActiveLiveSession().catch(() => { if (mounted) setMessage('cleanupError'); });
      },
    );
    controller.current = gate;
    if (Platform.OS === 'web' && typeof document !== 'undefined' && document.visibilityState === 'hidden') gate.setActive(false);
    else if (Platform.OS !== 'web' && AppState.currentState === 'background') gate.setActive(false);
    else void gate.refresh();
    const appState = AppState.addEventListener('change', (next) => {
      if (Platform.OS === 'web') return;
      if (next === 'background') gate.setActive(false);
      if (next === 'active') { gate.setActive(true); void gate.refresh(true); }
    });
    const onVisibility = () => gate.setActive(document.visibilityState !== 'hidden');
    const onFocus = () => { if (document.visibilityState !== 'hidden') { gate.setActive(true); void gate.refresh(true); } };
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      document.addEventListener('visibilitychange', onVisibility);
      window.addEventListener('focus', onFocus);
      window.addEventListener('pageshow', onFocus);
    }
    // Native permissions have no revocation event. Poll only in foreground,
    // without ever requesting permission or reading location coordinates.
    const timer = setInterval(() => {
      if (Platform.OS === 'web' ? typeof document !== 'undefined' && document.visibilityState !== 'hidden' : AppState.currentState === 'active') {
        void gate.refresh();
      }
    }, 2000);
    return () => {
      mounted = false; clearInterval(timer); appState.remove();
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        document.removeEventListener('visibilitychange', onVisibility);
        window.removeEventListener('focus', onFocus);
        window.removeEventListener('pageshow', onFocus);
      }
      gate.dispose(); controller.current = null;
    };
  }, []);

  const accessAllowed = ready && locationGateAllowsAccess(permission);
  const keepRoutesMounted = ready && locationGateKeepsRoutesMounted(permission);
  const busy = !ready || permission.status === 'checking' || permission.status === 'requesting';
  const canRequest = permission.status === 'prompt' || permission.status === 'error' || (permission.status === 'denied' && permission.canAskAgain);
  const canOpenSettings = Platform.OS !== 'web' && (permission.status === 'servicesDisabled' || (permission.status === 'denied' && !permission.canAskAgain));
  const detail = permission.status === 'denied' ? copy.denied
    : permission.status === 'unsupported' ? permission.issue === 'insecure' ? copy.insecure : copy.unsupported
      : permission.status === 'error' ? copy.error
        : permission.status === 'servicesDisabled' ? copy.servicesDisabled : undefined;
  const openSettings = async () => {
    setMessage(undefined);
    try { await Linking.openSettings(); } catch { setMessage('settingsError'); }
  };
  const gateScreen = (
    <Background>
      <ScrollView testID="required-location-gate" contentContainerStyle={[styles.content, { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 20 }]}>
        <View style={styles.panel}>
          <View style={[styles.header, { flexDirection: row }]}>
            <Wordmark height={40} />
            <Pressable testID="location-gate-language" accessibilityRole="button" accessibilityLabel={t('appLanguage')} onPress={() => setLanguagesOpen(true)} style={[styles.language, { flexDirection: row }]}>
              <Feather name="globe" size={16} color={c.accent} />
              <Text style={{ color: c.text, fontFamily: font('medium') }}>{LANGS.find((item) => item.code === lang)?.native}</Text>
            </Pressable>
          </View>
          <Card style={styles.card}>
            <Feather name="map-pin" size={32} color={c.accent} />
            <Title title={copy.title} body={copy.body} />
            {busy ? (
              <View style={[styles.status, { flexDirection: row }]} accessibilityLiveRegion="polite">
                <ActivityIndicator color={c.accent} />
                <Text style={[styles.body, { color: c.secondary, fontFamily: font(), textAlign: align }]}>{permission.status === 'requesting' ? copy.requesting : copy.checking}</Text>
              </View>
            ) : null}
            {detail ? <Text testID={`location-gate-${permission.status}`} accessibilityLiveRegion="polite" style={[styles.body, { color: c.danger, fontFamily: font(), textAlign: align }]}>{detail}</Text> : null}
            {!busy && Platform.OS === 'web' ? <Text style={[styles.body, { color: c.secondary, fontFamily: font(), textAlign: align }]}>{copy.browserSettings}</Text> : null}
            {message ? <Text accessibilityRole="alert" style={[styles.body, { color: c.danger, fontFamily: font(), textAlign: align }]}>{message === 'languageSaveError' ? t(message) : copy[message]}</Text> : null}
            {canOpenSettings ? <PillButton testID="location-gate-settings" label={copy.settings} icon="settings" onPress={() => { void openSettings(); }} /> : null}
            <PillButton
              testID="location-gate-retry"
              label={permission.status === 'prompt' ? copy.allow : copy.retry}
              icon={canRequest ? 'map-pin' : 'refresh-cw'}
              disabled={busy}
              variant={canOpenSettings ? 'ghost' : 'primary'}
              onPress={() => {
                setMessage(undefined);
                if (canRequest) void controller.current?.request();
                else void controller.current?.refresh();
              }}
            />
            <Text style={[styles.privacy, { color: c.secondary, fontFamily: font(), textAlign: align }]}>{copy.privacy}</Text>
          </Card>
        </View>
      </ScrollView>
      <PickerSheet
        visible={languagesOpen}
        title={t('chooseLanguage')}
        items={LANGS.map((item) => ({ key: item.code, title: item.native, subtitle: item.english }))}
        selected={[lang]}
        onToggle={(key) => {
          const selected = LANGS.find((item) => item.code === key);
          if (!selected) return;
          void setLang(selected.code).then(() => setLanguagesOpen(false)).catch(() => setMessage('languageSaveError'));
        }}
        onClose={() => setLanguagesOpen(false)}
      />
    </Background>
  );
  return (
    <View style={styles.root}>
      <View
        testID="location-gate-routes"
        collapsable={false}
        style={[styles.routes, !accessAllowed && styles.hiddenRoutes]}
        pointerEvents={accessAllowed ? 'auto' : 'none'}
        accessibilityElementsHidden={!accessAllowed}
        importantForAccessibility={accessAllowed ? 'auto' : 'no-hide-descendants'}
      >
        {keepRoutesMounted ? children : null}
      </View>
      {!accessAllowed && (keepRoutesMounted ? (
        // Modal also covers app dialogs/portals; an ordinary sibling overlay
        // cannot prevent a previously mounted Modal from accepting input.
        <Modal
          testID="location-gate-rechecking-cover"
          visible
          animationType="none"
          presentationStyle="fullScreen"
          onRequestClose={() => {}}
        >
          {gateScreen}
        </Modal>
      ) : (
        <View style={[styles.cover, { backgroundColor: c.background }]} accessibilityViewIsModal>
          {gateScreen}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  routes: { flex: 1 },
  hiddenRoutes: { display: 'none' },
  cover: { ...StyleSheet.absoluteFill },
  content: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 24 },
  panel: { width: '100%', maxWidth: 460, alignSelf: 'center', gap: 28 },
  header: { alignItems: 'center', justifyContent: 'space-between', gap: 16 },
  language: { alignItems: 'center', gap: 8, paddingVertical: 12 },
  card: { gap: 20 },
  status: { alignItems: 'center', gap: 12 },
  body: { fontSize: 14, lineHeight: 22, flexShrink: 1 },
  privacy: { fontSize: 12, lineHeight: 19 },
});