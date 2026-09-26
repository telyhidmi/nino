import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, AppState, PanResponder, Platform, View, type AccessibilityActionEvent } from 'react-native';
import Svg, { Circle, Defs, G, Path, RadialGradient, Stop } from 'react-native-svg';
import { LAND } from '@/constants/earthLand';

// Rough arid regions (lon,lat) drawn over land for subtle desert tint.
const DESERTS: number[][] = [
  [-16, 21, -5, 30, 10, 32, 25, 31, 33, 28, 35, 20, 30, 16, 15, 15, 0, 16, -12, 17],
  [36, 29, 45, 31, 50, 27, 56, 22, 55, 17, 45, 15, 40, 20],
  [118, -22, 130, -19, 140, -22, 138, -30, 128, -30, 118, -27],
  [80, 42, 95, 44, 110, 43, 105, 39, 90, 37],
];

const D2R = Math.PI / 180;

/** Orthographic projection with horizon clipping. Hidden vertices are replaced by
 *  exact horizon crossings and radially clamped onto the limb, so no backface shows. */
function ringsToPath(rings: number[][], lon0: number, lat0: number, R: number, c: number): string {
  const sl = Math.sin(lat0), cl = Math.cos(lat0);
  let d = '';
  for (const ring of rings) {
    const n = ring.length / 2;
    const px: number[] = [], py: number[] = [], pz: number[] = [];
    let anyVis = false;
    for (let i = 0; i < n; i++) {
      const lam = ring[i * 2] * D2R - lon0, phi = ring[i * 2 + 1] * D2R;
      const cp = Math.cos(phi);
      const x = cp * Math.sin(lam);
      const y0 = Math.sin(phi), z0 = cp * Math.cos(lam);
      const y = y0 * cl - z0 * sl;
      const z = y0 * sl + z0 * cl;
      px.push(x); py.push(y); pz.push(z);
      if (z > 0) anyVis = true;
    }
    if (!anyVis) continue;
    const pts: string[] = [];
    const push = (x: number, y: number, z: number) => {
      if (z <= 0) { const m = Math.hypot(x, y) || 1; x /= m; y /= m; }
      pts.push(`${(c + x * R).toFixed(1)} ${(c - y * R).toFixed(1)}`);
    };
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      push(px[i], py[i], pz[i]);
      if ((pz[i] > 0) !== (pz[j] > 0)) {
        const t = pz[i] / (pz[i] - pz[j]);
        push(px[i] + (px[j] - px[i]) * t, py[i] + (py[j] - py[i]) * t, 0);
      }
    }
    d += `M${pts.join('L')}Z`;
  }
  return d;
}

export function EarthGlobe({ size }: { size: number }) {
  const [rot, setRot] = useState({ lon: 20, lat: 18 });
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
        setRot({ lon: start.lon - g.dx * k, lat: Math.max(-80, Math.min(80, start.lat + g.dy * k)) });
      },
      onPanResponderRelease: () => { dragging.current = false; },
      onPanResponderTerminate: () => { dragging.current = false; },
    });
  }, [size]);

  const onAction = (e: AccessibilityActionEvent) => {
    const step = e.nativeEvent.actionName === 'increment' ? 30 : e.nativeEvent.actionName === 'decrement' ? -30 : 0;
    if (step) setRot((r) => ({ ...r, lon: r.lon - step }));
  };

  const V = 100, c = 50, R = 46;
  const lon0 = rot.lon * D2R, lat0 = rot.lat * D2R;
  const land = ringsToPath(LAND, lon0, lat0, R, c);
  const desert = ringsToPath(DESERTS, lon0, lat0, R, c);
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
      <Svg width={size} height={size} viewBox={`0 0 ${V} ${V}`} pointerEvents="none">
        <Defs>
          <RadialGradient id="eg-ocean" cx="38%" cy="34%" r="70%">
            <Stop offset="0" stopColor="#3E9FC9" />
            <Stop offset="0.6" stopColor="#17618F" />
            <Stop offset="1" stopColor="#0A2F4E" />
          </RadialGradient>
          <RadialGradient id="eg-shade" cx="36%" cy="32%" r="68%">
            <Stop offset="0" stopColor="#FFFFFF" stopOpacity={0.18} />
            <Stop offset="0.55" stopColor="#FFFFFF" stopOpacity={0} />
            <Stop offset="0.85" stopColor="#021018" stopOpacity={0.3} />
            <Stop offset="1" stopColor="#021018" stopOpacity={0.55} />
          </RadialGradient>
          <RadialGradient id="eg-atmo" cx="50%" cy="50%" r="50%">
            <Stop offset="0.9" stopColor="#8FE8FF" stopOpacity={0} />
            <Stop offset="0.94" stopColor="#8FE8FF" stopOpacity={0.45} />
            <Stop offset="1" stopColor="#8FE8FF" stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Circle cx={c} cy={c} r={50} fill="url(#eg-atmo)" />
        <Circle cx={c} cy={c} r={R} fill="url(#eg-ocean)" />
        <G>
          <Path d={land} fill="#4E9A4A" fillRule="nonzero" stroke="#3C7F3B" strokeWidth={0.4} strokeLinejoin="round" />
          <Path d={desert} fill="#CDB679" opacity={0.55} />
        </G>
        <Circle cx={c} cy={c} r={R} fill="url(#eg-shade)" />
        <Circle cx={c} cy={c} r={R} fill="none" stroke="rgba(170,235,255,0.55)" strokeWidth={0.8} />
      </Svg>
    </View>
  );
}
