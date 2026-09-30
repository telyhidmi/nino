import React, { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withDelay, withRepeat, withSequence, withTiming } from 'react-native-reanimated';
import Svg, { Circle, Defs, Ellipse, G, LinearGradient, Path, RadialGradient, Stop, Text as SvgText } from 'react-native-svg';
import { useColors } from '@/hooks/useColors';
import { EarthGlobe } from '@/components/EarthGlobe';

/** Earth used as the "o" of the wordmark and as a standalone mark. */
export function GlobeMark({ size = 48 }: { size?: number }) {
  return <EarthGlobe size={size} />;
}

/** Nino wordmark: glossy white→turquoise letters, globe as the "o". */
export function Wordmark({ height = 56 }: { height?: number }) {
  const w = height * 2.60;
  return (
    <View style={{ width: w, height, flexDirection: 'row', alignItems: 'center', direction: 'ltr' }}>
      <Svg width={height * 2.2} height={height} viewBox="0 0 220 100">
        <Defs>
          <LinearGradient id="wg" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#FFFFFF" />
            <Stop offset="0.5" stopColor="#D9FCFD" />
            <Stop offset="1" stopColor="#FE2C55" />
          </LinearGradient>
        </Defs>
        <SvgText x="0" y="84" fontSize="98" fontFamily="Poppins_700Bold" fontWeight="700" fill="#0E6D74" opacity={0.55} dx={2} dy={3}>Nin</SvgText>
        <SvgText x="0" y="84" fontSize="98" fontFamily="Poppins_700Bold" fontWeight="700" fill="url(#wg)">Nin</SvgText>
      </Svg>
      <View style={{ marginLeft: -height * 0.38, marginTop: height * 0.16 }}>
        <GlobeMark size={height * 0.78} />
      </View>
    </View>
  );
}

const NODES = [
  { x: 84, y: 92 }, { x: 196, y: 70 }, { x: 150, y: 150 }, { x: 222, y: 176 }, { x: 98, y: 190 }, { x: 170, y: 228 },
];
const ARCS = [
  'M84 92 Q140 30 196 70', 'M196 70 Q240 120 222 176', 'M98 190 Q120 120 150 150', 'M150 150 Q200 150 222 176',
  'M98 190 Q130 250 170 228', 'M84 92 Q60 150 98 190',
];

const CHIPS = [
  { flag: '🇧🇷', text: 'Olá!', top: '6%', left: '-2%', delay: 0 },
  { flag: '🇸🇦', text: 'مرحبا', top: '14%', right: '-4%', delay: 500 },
  { flag: '🇯🇵', text: 'こんにちは', bottom: '16%', left: '-6%', delay: 1000 },
  { flag: '🇪🇸', text: '¡Hola!', bottom: '4%', right: '0%', delay: 1500 },
] as const;

function FloatChip({ chip }: { chip: (typeof CHIPS)[number] }) {
  const c = useColors();
  const y = useSharedValue(0);
  const o = useSharedValue(0);
  useEffect(() => {
    o.value = withDelay(chip.delay, withTiming(1, { duration: 700 }));
    y.value = withDelay(chip.delay, withRepeat(withSequence(
      withTiming(-6, { duration: 2200, easing: Easing.inOut(Easing.sin) }),
      withTiming(0, { duration: 2200, easing: Easing.inOut(Easing.sin) }),
    ), -1));
  }, [chip.delay, o, y]);
  const st = useAnimatedStyle(() => ({ opacity: o.value, transform: [{ translateY: y.value }] }));
  const { flag, text, delay: _d, ...pos } = chip;
  return (
    <Animated.View style={[styles.chip, { backgroundColor: 'rgba(21,38,43,0.92)', borderColor: c.border }, pos as object, st]}>
      <Text style={styles.chipFlag}>{flag}</Text>
      <Text style={[styles.chipText, { color: c.text, fontFamily: text === 'مرحبا' ? 'Cairo_600SemiBold' : 'Poppins_500Medium' }]}>{text}</Text>
    </Animated.View>
  );
}

/** Welcome artwork: a slowly turning dotted globe wired with glowing connection arcs. */
export function WorldArt({ size = 300 }: { size?: number }) {
  const spin = useSharedValue(0);
  const pulse = useSharedValue(0);
  useEffect(() => {
    spin.value = withRepeat(withTiming(360, { duration: 60000, easing: Easing.linear }), -1);
    pulse.value = withRepeat(withSequence(withTiming(1, { duration: 1800 }), withTiming(0, { duration: 1800 })), -1);
  }, [spin, pulse]);
  const ring = useAnimatedStyle(() => ({ transform: [{ rotate: `${spin.value}deg` }] }));
  const glow = useAnimatedStyle(() => ({ opacity: 0.35 + pulse.value * 0.35, transform: [{ scale: 1 + pulse.value * 0.04 }] }));

  const dots: { x: number; y: number }[] = [];
  for (let lat = -80; lat <= 80; lat += 10) {
    const r = Math.cos((lat * Math.PI) / 180) * 120;
    const cy = 150 - Math.sin((lat * Math.PI) / 180) * 120;
    const n = Math.max(4, Math.round(r / 9));
    for (let i = 0; i < n; i++) {
      const x = 150 - r + ((2 * r) / (n - 1 || 1)) * i;
      const h = (x * 7 + cy * 13) % 11;
      if (h < 5.2) dots.push({ x, y: cy });
    }
  }

  return (
    <View style={{ width: size, height: size }}>
      <Animated.View style={[StyleSheet.absoluteFill, glow]}>
        <Svg width={size} height={size} viewBox="0 0 300 300">
          <Defs>
            <RadialGradient id="halo" cx="50%" cy="50%" r="50%">
              <Stop offset="0.55" stopColor="#FE2C55" stopOpacity={0.35} />
              <Stop offset="1" stopColor="#FE2C55" stopOpacity={0} />
            </RadialGradient>
          </Defs>
          <Circle cx="150" cy="150" r="150" fill="url(#halo)" />
        </Svg>
      </Animated.View>
      <Svg width={size} height={size} viewBox="0 0 300 300" style={StyleSheet.absoluteFill}>
        <Defs>
          <RadialGradient id="sphere" cx="38%" cy="32%" r="80%">
            <Stop offset="0" stopColor="#1B4A52" />
            <Stop offset="0.6" stopColor="#0F2C33" />
            <Stop offset="1" stopColor="#081518" />
          </RadialGradient>
          <LinearGradient id="arc" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor="#FE2C55" stopOpacity={0.2} />
            <Stop offset="0.5" stopColor="#8FF7FA" />
            <Stop offset="1" stopColor="#FE2C55" stopOpacity={0.2} />
          </LinearGradient>
        </Defs>
        <Circle cx="150" cy="150" r="122" fill="url(#sphere)" stroke="rgba(255,255,255,0.55)" strokeWidth={1.2} />
        {dots.map((d, i) => (
          <Circle key={i} cx={d.x} cy={d.y} r={1.7} fill="#FE2C55" opacity={0.28 + (i % 5) * 0.08} />
        ))}
        <Ellipse cx="150" cy="150" rx="122" ry="40" fill="none" stroke="rgba(255,255,255,0.18)" />
        <Ellipse cx="150" cy="150" rx="48" ry="122" fill="none" stroke="rgba(255,255,255,0.18)" />
        {ARCS.map((d, i) => (
          <Path key={i} d={d} fill="none" stroke="url(#arc)" strokeWidth={1.8} strokeLinecap="round" />
        ))}
        {NODES.map((n, i) => (
          <G key={i}>
            <Circle cx={n.x} cy={n.y} r={8} fill="#FE2C55" opacity={0.18} />
            <Circle cx={n.x} cy={n.y} r={3.4} fill="#FFFFFF" />
          </G>
        ))}
        <Ellipse cx="112" cy="84" rx="54" ry="22" fill="#FFFFFF" opacity={0.05} />
      </Svg>
      <Animated.View style={[StyleSheet.absoluteFill, ring]} pointerEvents="none">
        <Svg width={size} height={size} viewBox="0 0 300 300">
          <Circle cx="150" cy="150" r="140" fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth={1} strokeDasharray="2 7" />
          <Circle cx="150" cy="10" r="4" fill="#FE2C55" />
          <Circle cx="290" cy="150" r="2.5" fill="#9FB3B8" />
        </Svg>
      </Animated.View>
      {CHIPS.map((ch) => <FloatChip key={ch.text} chip={ch} />)}
    </View>
  );
}

const styles = StyleSheet.create({
  chip: { position: 'absolute', flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999, borderWidth: 1 },
  chipFlag: { fontSize: 14 },
  chipText: { fontSize: 13 },
});
