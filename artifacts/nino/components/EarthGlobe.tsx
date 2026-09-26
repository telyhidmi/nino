import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, AppState, Image, PanResponder, Platform, View, type AccessibilityActionEvent } from 'react-native';

// Photographic globe: offline raycast renders of NASA Blue Marble (three.js earth_atmos_2048) onto a
// lit sphere. One sheet per tilt (-60..60 step 15), each a 9x8 grid of 72 frames (lon 0..355 step 5).
// Adjacent longitude frames are cross-faded for smooth continuous rotation. See assets/earth/ATTRIBUTION.txt.
const SHEETS = [
  require('@/assets/earth/globe_t0.jpg'), require('@/assets/earth/globe_t1.jpg'), require('@/assets/earth/globe_t2.jpg'),
  require('@/assets/earth/globe_t3.jpg'), require('@/assets/earth/globe_t4.jpg'), require('@/assets/earth/globe_t5.jpg'),
  require('@/assets/earth/globe_t6.jpg'), require('@/assets/earth/globe_t7.jpg'), require('@/assets/earth/globe_t8.jpg'),
];
const COLS = 9, ROWS = 8, STEP = 5, FRAMES = 72;

function Frame({ sheet, idx, size, opacity }: { sheet: number; idx: number; size: number; opacity: number }) {
  const col = idx % COLS, row = Math.floor(idx / COLS);
  return (
    <Image
      source={SHEETS[sheet]}
      fadeDuration={0}
      style={{ position: 'absolute', width: size * COLS, height: size * ROWS, left: -col * size, top: -row * size, opacity }}
    />
  );
}

export function EarthGlobe({ size }: { size: number }) {
  const [rot, setRot] = useState({ lon: -75, lat: 12 });
  const rotRef = useRef(rot);
  rotRef.current = rot;
  const dragging = useRef(false);
  const [reduceMotion, setReduceMotion] = useState(false);
  const [active, setActive] = useState(AppState.currentState === 'active');

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion).catch(() => {});
    const a = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    const b = AppState.addEventListener('change', (s) => setActive(s === 'active'));
    return () => { a.remove(); b.remove(); };
  }, []);

  // Slow auto-rotation (~6°/s), ~30fps, stops when backgrounded, reduced motion, or unmounted.
  useEffect(() => {
    if (reduceMotion || !active) return;
    let raf = 0, last = 0;
    const tick = (t: number) => {
      if (last && !dragging.current && t - last >= 33) {
        const dt = Math.min(t - last, 100);
        setRot((r) => ({ lon: (r.lon + dt * 0.006) % 360, lat: r.lat }));
        last = t;
      } else if (!last || dragging.current) last = t;
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [reduceMotion, active]);

  const pan = useMemo(() => {
    let start = { lon: 0, lat: 0 };
    return PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: () => { dragging.current = true; start = rotRef.current; },
      onPanResponderMove: (_e, g) => {
        const k = 180 / Math.max(size, 30);
        setRot({ lon: start.lon - g.dx * k, lat: Math.max(-60, Math.min(60, start.lat + g.dy * k)) });
      },
      onPanResponderRelease: () => { dragging.current = false; },
      onPanResponderTerminate: () => { dragging.current = false; },
    });
  }, [size]);

  const onAction = (e: AccessibilityActionEvent) => {
    const step = e.nativeEvent.actionName === 'increment' ? 30 : e.nativeEvent.actionName === 'decrement' ? -30 : 0;
    if (step) setRot((r) => ({ ...r, lon: r.lon - step }));
  };

  const L = (((rot.lon % 360) + 360) % 360) / STEP;
  const i0 = Math.floor(L) % FRAMES, i1 = (i0 + 1) % FRAMES, frac = L - Math.floor(L);
  const sheet = Math.max(0, Math.min(8, Math.round((rot.lat + 60) / 15)));
  const slop = Math.max(0, (44 - size) / 2);

  return (
    <View
      {...pan.panHandlers}
      hitSlop={{ top: slop, bottom: slop, left: slop, right: slop }}
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel="Earth globe"
      accessibilityHint="Drag to rotate the globe"
      accessibilityActions={[{ name: 'increment', label: 'Rotate east' }, { name: 'decrement', label: 'Rotate west' }]}
      onAccessibilityAction={onAction}
      style={[{ width: size, height: size }, Platform.OS === 'web' ? ({ touchAction: 'none', cursor: 'grab' } as object) : null]}
    >
      <View pointerEvents="none" style={{ width: size, height: size, borderRadius: size / 2, overflow: 'hidden', backgroundColor: '#051A33' }}>
        <Frame sheet={sheet} idx={i0} size={size} opacity={1} />
        {frac > 0.02 ? <Frame sheet={sheet} idx={i1} size={size} opacity={frac} /> : null}
      </View>
    </View>
  );
}
