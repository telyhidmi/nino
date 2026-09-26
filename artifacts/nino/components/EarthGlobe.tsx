import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, AppState, PanResponder, Platform, View, type AccessibilityActionEvent } from 'react-native';
import Svg, { Circle, Defs, G, Path, RadialGradient, Stop } from 'react-native-svg';
import { LAND } from '@/constants/earthLand';

// Hand-traced biome patches (lon,lat rings) layered over Natural Earth land for natural variation.
const DESERTS: number[][] = [
  [-16, 21, -5, 30, 10, 32, 25, 31, 33, 28, 35, 20, 30, 16, 15, 15, 0, 16, -12, 17],
  [36, 29, 45, 31, 50, 27, 56, 22, 55, 17, 45, 15, 40, 20],
  [118, -22, 130, -19, 140, -22, 138, -30, 128, -30, 118, -27],
  [80, 42, 95, 44, 110, 43, 105, 39, 90, 37],
  [15, -20, 24, -19, 26, -26, 20, -29, 16, -26],
  [-117, 37, -110, 37, -104, 31, -110, 28, -115, 31],
  [-71, -18, -68, -20, -69, -27, -71, -26],
  [55, 38, 66, 40, 70, 36, 62, 30, 56, 32],
];
const SAVANNA: number[][] = [
  [-17, 15, 0, 14, 20, 14, 38, 12, 42, 5, 38, -8, 30, -15, 35, -24, 28, -30, 18, -18, 13, -12, 14, 4, 5, 9, -10, 9],
  [-60, -12, -45, -8, -38, -16, -48, -24, -58, -26, -64, -18],
  [120, -15, 135, -13, 145, -17, 148, -26, 140, -18, 126, -18],
  [72, 25, 85, 25, 88, 22, 80, 14, 76, 18],
];
const FOREST: number[][] = [
  [-78, 2, -60, 6, -50, 0, -44, -4, -48, -10, -62, -12, -72, -10, -76, -4],
  [9, 4, 18, 5, 29, 3, 30, -4, 24, -8, 14, -5, 10, -2],
  [96, 6, 104, 12, 108, 16, 118, 4, 142, -4, 146, -8, 130, -4, 112, -4, 100, -2],
  [-130, 60, -110, 62, -90, 57, -70, 52, -60, 50, -80, 47, -100, 50, -122, 52],
  [30, 64, 60, 62, 90, 62, 120, 60, 140, 56, 128, 50, 100, 54, 70, 56, 40, 56],
  [-92, 40, -76, 44, -78, 34, -90, 32],
  [0, 50, 20, 52, 30, 56, 22, 58, 10, 56],
];
const MOUNTAINS: number[][] = [
  [72, 36, 80, 36, 92, 30, 100, 30, 98, 27, 88, 27, 78, 30, 72, 33],
  [-76, 4, -70, -6, -68, -16, -67, -30, -70, -40, -72, -40, -71, -28, -72, -16, -78, -6],
  [-122, 55, -112, 48, -106, 40, -105, 34, -110, 36, -116, 44, -126, 55],
  [6, 45, 14, 47, 16, 46, 8, 44],
];
const ICE: number[][] = [
  [-180, -68, -90, -70, 0, -69, 90, -66, 180, -68, 180, -90, -180, -90],
  [-73, 78, -60, 82, -30, 83, -20, 78, -22, 72, -30, 68, -42, 62, -48, 62, -52, 68, -56, 74, -66, 77],
  [-100, 76, -80, 80, -70, 83, -90, 82],
];
// Procedural cloud field: deterministic puffs (irregular lon/lat rings) arranged into
// swirling cyclones, ITCZ convection and scattered cumulus. Rendered in stacked
// translucent layers (halo / body / core) for soft, natural edges.
const D2R = Math.PI / 180;
type Puff = { lon: number; lat: number; r: number };
function rng(seed: number) {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}
const CLOUD_PUFFS: Puff[] = (() => {
  const rnd = rng(7331);
  const out: Puff[] = [];
  // Cyclones: [lon, lat, size, spin(+1 NH ccw / -1 SH)]
  const storms: number[][] = [
    [-32, 52, 1, 1], [165, 46, 0.9, 1], [-150, 40, 0.7, 1], [60, 58, 0.6, 1],
    [-95, -52, 1, -1], [40, -48, 0.9, -1], [140, -44, 0.8, -1], [-10, -38, 0.55, -1],
  ];
  for (const [lon, lat, k, spin] of storms) {
    out.push({ lon, lat, r: 3.2 * k });
    for (let arm = 0; arm < 2; arm++) {
      const off = arm * Math.PI + rnd();
      for (let t = 0.3; t < 3.4; t += 0.22) {
        const rad = 2.2 * k * Math.exp(0.42 * t) * (0.9 + rnd() * 0.2);
        const ang = off + spin * t * 1.15;
        const la = lat + Math.sin(ang) * rad * 0.8;
        out.push({ lon: lon + (Math.cos(ang) * rad) / Math.cos(la * D2R), lat: la, r: k * (2.6 - t * 0.45 + rnd() * 1.2) });
      }
    }
    // trailing frontal band sweeping toward the tropics
    for (let i = 0; i < 9; i++) {
      const f = i / 8;
      out.push({ lon: lon - 6 * k - f * 22 * k, lat: lat - spin * (4 + f * 16) * k + (rnd() - 0.5) * 3, r: (1.8 - f) * k + rnd() * 0.8 });
    }
  }
  // ITCZ: clumpy convective clusters near the equator
  for (let lon = -180; lon < 180; lon += 7 + rnd() * 9) {
    if (rnd() < 0.3) continue;
    const lat = 5 + Math.sin(lon * 0.04) * 3 + (rnd() - 0.5) * 6;
    const n = 1 + Math.floor(rnd() * 3);
    for (let j = 0; j < n; j++) out.push({ lon: lon + (rnd() - 0.5) * 6, lat: lat + (rnd() - 0.5) * 4, r: 0.9 + rnd() * 1.8 });
  }
  // Scattered small cumulus
  for (let i = 0; i < 70; i++) {
    const lat = (rnd() * 2 - 1) * 62;
    out.push({ lon: rnd() * 360 - 180, lat, r: 0.5 + rnd() * 1.1 });
  }
  return out;
})();
function puffRings(scale: number, jitter: number, seed: number, filter: (i: number) => boolean): number[][] {
  const rnd = rng(seed);
  const rings: number[][] = [];
  CLOUD_PUFFS.forEach((p, i) => {
    const ph = rnd() * 6.28, ph2 = rnd() * 6.28, stretch = 1.2 + rnd() * 0.5;
    if (!filter(i)) return;
    const ring: number[] = [];
    const cl = Math.max(0.25, Math.cos(p.lat * D2R));
    for (let v = 0; v < 12; v++) {
      const a = (v / 12) * Math.PI * 2;
      const rr = p.r * scale * (1 + jitter * (0.55 * Math.sin(3 * a + ph) + 0.45 * Math.sin(5 * a + ph2)));
      ring.push(p.lon + (Math.cos(a) * rr * stretch) / cl, Math.max(-85, Math.min(85, p.lat + Math.sin(a) * rr)));
    }
    rings.push(ring);
  });
  return rings;
}
const CLOUD_HALO = puffRings(1.7, 0.3, 11, () => true);
const CLOUD_BODY = puffRings(1.05, 0.35, 23, () => true);
const CLOUD_CORE = puffRings(0.55, 0.4, 37, (i) => CLOUD_PUFFS[i].r > 1.4);


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
  const [active, setActive] = useState(AppState.currentState == null || AppState.currentState === 'active');

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion).catch(() => {});
    const a = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    const b = AppState.addEventListener('change', (s) => setActive(s === 'active'));
    return () => { a.remove(); b.remove(); };
  }, []);

  // One turn every 20 seconds, ~30fps; respect reduced motion and background state.
  useEffect(() => {
    if (reduceMotion || !active) return;
    let raf = 0, last = 0;
    const tick = (t: number) => {
      if (last && !dragging.current && t - last >= 33) {
        const dt = Math.min(t - last, 100);
        setRot((r) => ({ lon: (r.lon + dt * 0.018) % 360, lat: r.lat }));
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
  const P = (r: number[][]) => ringsToPath(r, lon0, lat0, R, c);
  const land = P(LAND), savanna = P(SAVANNA), forest = P(FOREST), desert = P(DESERTS), mtn = P(MOUNTAINS), ice = P(ICE);
  // Clouds drift slowly relative to the surface as the globe turns.
  const clon = lon0 - rot.lon * 0.12 * D2R;
  const cHalo = ringsToPath(CLOUD_HALO, clon, lat0, R, c);
  const cBody = ringsToPath(CLOUD_BODY, clon, lat0, R, c);
  const cCore = ringsToPath(CLOUD_CORE, clon, lat0, R, c);
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
          <RadialGradient id="eg-ocean" cx="40%" cy="36%" r="68%">
            <Stop offset="0" stopColor="#1D5E8C" />
            <Stop offset="0.55" stopColor="#0E3C66" />
            <Stop offset="1" stopColor="#051A33" />
          </RadialGradient>
          <RadialGradient id="eg-night" cx="30%" cy="28%" r="88%">
            <Stop offset="0" stopColor="#FFF6E0" stopOpacity={0.14} />
            <Stop offset="0.35" stopColor="#FFFFFF" stopOpacity={0} />
            <Stop offset="0.62" stopColor="#010814" stopOpacity={0.12} />
            <Stop offset="0.82" stopColor="#010814" stopOpacity={0.62} />
            <Stop offset="1" stopColor="#010814" stopOpacity={0.9} />
          </RadialGradient>
          <RadialGradient id="eg-limb" cx="50%" cy="50%" r="50%">
            <Stop offset="0.8" stopColor="#9CC8F0" stopOpacity={0} />
            <Stop offset="0.96" stopColor="#9CC8F0" stopOpacity={0.28} />
            <Stop offset="1" stopColor="#CFE6FF" stopOpacity={0.5} />
          </RadialGradient>
          <RadialGradient id="eg-atmo" cx="50%" cy="50%" r="50%">
            <Stop offset="0.9" stopColor="#7FB4EA" stopOpacity={0} />
            <Stop offset="0.93" stopColor="#7FB4EA" stopOpacity={0.32} />
            <Stop offset="1" stopColor="#7FB4EA" stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Circle cx={c} cy={c} r={50} fill="url(#eg-atmo)" />
        <Circle cx={c} cy={c} r={R} fill="url(#eg-ocean)" />
        <G>
          <Path d={land} fill="#56703A" stroke="#2F6A8A" strokeOpacity={0.5} strokeWidth={0.35} strokeLinejoin="round" />
          <Path d={savanna} fill="#8C8A4E" opacity={0.75} />
          <Path d={forest} fill="#2E5227" opacity={0.85} />
          <Path d={desert} fill="#C9A66E" opacity={0.9} />
          <Path d={mtn} fill="#7A6A55" opacity={0.7} />
          <Path d={ice} fill="#E8EEF2" opacity={0.92} />
        </G>
        <Path d={cHalo} fill="#F4F8FC" opacity={0.13} />
        <Path d={cBody} fill="#F7FAFD" opacity={0.2} />
        <Path d={cCore} fill="#FFFFFF" opacity={0.26} />
        <Circle cx={c} cy={c} r={R} fill="url(#eg-limb)" />
        <Circle cx={c} cy={c} r={R} fill="url(#eg-night)" />
        <Circle cx={c} cy={c} r={R} fill="none" stroke="rgba(160,200,240,0.35)" strokeWidth={0.5} />
      </Svg>
    </View>
  );
}
