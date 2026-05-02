import { useRouter } from 'expo-router';
import { useEffect, useRef } from 'react';
import {
    Animated,
    Image,
    StyleSheet,
    Text,
    View,
} from 'react-native';

export default function SplashScreen() {
  const router = useRouter();

  // Animation values
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    // Run animation
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 900,
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: 0,
        duration: 900,
        useNativeDriver: true,
      }),
    ]).start();

    // Navigate after delay
    const timer = setTimeout(() => {
      router.replace('/role');
    }, 2000);

    return () => clearTimeout(timer); // cleanup
  }, [fadeAnim, router, translateY]);

  return (
    <View style={styles.container}>
      <Animated.View
        style={{
          alignItems: 'center',
          opacity: fadeAnim,
          transform: [{ translateY }],
        }}
      >
        {/* Logo */}
        <View style={styles.logoBox}>
          <Image
            source={require('../assets/images/logo_green.png')}
            style={styles.logo}
          />
        </View>

        {/* App Name */}
        <Text style={styles.title}>Dukan</Text>

        {/* Tagline */}
        <Text style={styles.subtitle}>
          FIND WHAT’S NEW NEARBY
        </Text>
      </Animated.View>

      {/* Footer */}
      <Text style={styles.footer}>Powered by Local Commerce</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9f7f6ff',
    justifyContent: 'center',
    alignItems: 'center',
  },

  logoBox: {
    width: 110,
    height: 110,
    backgroundColor: '#fff',
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',

    // subtle shadow
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,

    marginBottom: 18,
  },

  logo: {
    width: 85,
    height: 85,
    resizeMode: 'contain',
  },

  title: {
    fontSize: 26,
    fontWeight: '800',
    color: '#1c492dff',
    letterSpacing: 0.5,
  },

  subtitle: {
    fontSize: 12,
    color: '#777',
    marginTop: 8,
    letterSpacing: 1.2,
  },

  footer: {
    position: 'absolute',
    bottom: 40,
    fontSize: 11,
    color: '#aaa',
  },
});