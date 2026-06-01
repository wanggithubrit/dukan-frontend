import { useRouter } from 'expo-router';
import { useEffect, useRef } from 'react';
import { Image } from 'expo-image';
import {
  Animated,
  StyleSheet,
  Text,
  View,
  ActivityIndicator,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';

const C = {
  bg: '#0F2118',
  white: '#FFFFFF',
  primary: '#2F5D50',
  accent: '#00E676',
  textMuted: '#8E9A96',
};

export default function SplashScreen() {
  const router = useRouter();

  // Animation values
  const logoScale = useRef(new Animated.Value(0.85)).current;
  const contentFade = useRef(new Animated.Value(0)).current;
  const contentTranslateY = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    // Run entering animations
    Animated.parallel([
      Animated.spring(logoScale, {
        toValue: 1,
        friction: 6,
        tension: 40,
        useNativeDriver: true,
      }),
      Animated.timing(contentFade, {
        toValue: 1,
        duration: 1000,
        useNativeDriver: true,
      }),
      Animated.timing(contentTranslateY, {
        toValue: 0,
        duration: 800,
        useNativeDriver: true,
      }),
    ]).start();

    // Navigate to role selection screen after 2.5 seconds
    const timer = setTimeout(() => {
      router.replace('/role');
    }, 2500);

    return () => clearTimeout(timer);
  }, [logoScale, contentFade, contentTranslateY, router]);

  return (
    <View style={s.container}>
      <StatusBar style="light" />

      {/* Decorative Background Accent Rings */}
      <View style={s.accentCircle1} />
      <View style={s.accentCircle2} />

      <Animated.View
        style={[
          s.inner,
          {
            opacity: contentFade,
            transform: [{ translateY: contentTranslateY }],
          },
        ]}
      >
        {/* LOGO BOX WITH GLOW */}
        <Animated.View style={[s.logoBox, { transform: [{ scale: logoScale }] }]}>
          <Image
            source={require('../assets/images/logo_splash_login.png')}
            style={s.logo}
            priority="high"
          />
        </Animated.View>

        {/* BRAND NAME */}
        <Text style={s.brandTitle}>
          My<Text style={{ color: C.white }}>Dukan</Text>
        </Text>

        {/* TAGLINE */}
        <Text style={s.tagline}>making your local shopping easy</Text>

        {/* LOADING INDICATOR */}
        <ActivityIndicator size="small" color={C.accent} style={s.loader} />
      </Animated.View>

      {/* FOOTER */}
      <Text style={s.footer}>Empowering Local Neighborhoods</Text>
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: C.bg,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  accentCircle1: {
    position: 'absolute',
    top: -100,
    right: -100,
    width: 320,
    height: 320,
    borderRadius: 160,
    backgroundColor: 'rgba(47, 93, 80, 0.15)',
  },
  accentCircle2: {
    position: 'absolute',
    bottom: -150,
    left: -150,
    width: 400,
    height: 400,
    borderRadius: 200,
    backgroundColor: 'rgba(0, 230, 118, 0.04)',
  },
  inner: {
    alignItems: 'center',
  },
  logoBox: {
    width: 160,
    height: 160,
    borderRadius: 42,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    shadowColor: C.accent,
    shadowOpacity: 0.15,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 },
    elevation: 5,
    marginBottom: 24,
  },
  logo: {
    width: 130,
    height: 130,
    borderRadius: 34,
  },
  brandTitle: {
    fontSize: 34,
    fontWeight: '900',
    color: C.accent,
    letterSpacing: -0.8,
  },
  tagline: {
    fontSize: 14,
    color: '#A0BAB4',
    marginTop: 10,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  loader: {
    marginTop: 36,
  },
  footer: {
    position: 'absolute',
    bottom: 40,
    fontSize: 11,
    color: C.textMuted,
    fontWeight: '600',
    letterSpacing: 1.2,
    opacity: 0.7,
  },
});