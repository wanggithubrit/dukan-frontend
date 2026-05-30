/* ─────────────────────────────────────────────
   1. IMPORTS
───────────────────────────────────────────── */
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const BASE_URL = 'https://dukan-backend-0cc9.onrender.com';
const RESEND_COOLDOWN = 120; // 2 minutes in seconds

export default function ForgotPassword() {
  const router = useRouter();

  /* ─────────────────────────────────────────────
     2. STATE
  ───────────────────────────────────────────── */
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [timer, setTimer] = useState(0);
  const intervalRef = useRef(null);

  /* ─────────────────────────────────────────────
     3. TIMER LOGIC
  ───────────────────────────────────────────── */
  useEffect(() => {
    return () => clearInterval(intervalRef.current); // cleanup on unmount
  }, []);

  const startTimer = () => {
    setTimer(RESEND_COOLDOWN);
    intervalRef.current = setInterval(() => {
      setTimer((prev) => {
        if (prev <= 1) {
          clearInterval(intervalRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const formatTimer = (seconds) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  /* ─────────────────────────────────────────────
     4. SEND / RESEND OTP
  ───────────────────────────────────────────── */
  const sendOtp = async () => {
    if (!email.trim() || !email.includes('@')) {
      Alert.alert('Invalid Email', 'Please enter a valid email address.');
      return;
    }

    try {
      setLoading(true);
      const res = await fetch(`${BASE_URL}/api/send-otp/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      });

      const data = await res.json().catch(() => ({}));

      if (res.ok) {
        setOtpSent(true);
        startTimer();
        Alert.alert('OTP Sent', 'Check your inbox for the OTP.');
        router.push({ pathname: '/verify-otp', params: { email: email.trim() } });
      } else {
        Alert.alert('Error', data.error || 'Failed to send OTP');
      }
    } catch (_err) {
      Alert.alert('Network Error', 'Please check your connection and try again.');
    } finally {
      setLoading(false);
    }
  };

  /* ─────────────────────────────────────────────
     5. UI RENDER
  ───────────────────────────────────────────── */
  return (
    <View style={styles.screenWrapper}>
      <StatusBar barStyle="light-content" backgroundColor="#000" />
      <SafeAreaView style={styles.container}>

        {/* HEADER */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.7}>
            <Ionicons name="arrow-back" size={22} color="#111" />
          </TouchableOpacity>
        </View>

        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.content}
        >
          {/* ICON — replace source with your own image */}
          <View style={styles.iconContainer}>
            <View style={styles.iconCircle}>
              <Image
                source={require('../assets/images/logo_green.png')} // 🔁 Replace with your image
                style={styles.iconImage}
                resizeMode="contain"
              />
            </View>
          </View>

          {/* TEXT */}
          <View style={styles.textGroup}>
            <Text style={styles.title}>Reset Password</Text>
            <Text style={styles.subtitle}>
              Enter the email associated with your account and we will send an OTP to reset your password.
            </Text>
          </View>

          {/* FORM */}
          <View style={styles.form}>
            <View style={styles.inputWrapper}>
              <Ionicons name="mail-outline" size={20} color="#9CA3AF" style={styles.inputIcon} />
              <TextInput
                placeholder="Email Address"
                placeholderTextColor="#9CA3AF"
                value={email}
                onChangeText={setEmail}
                style={styles.input}
                autoCapitalize="none"
                keyboardType="email-address"
                returnKeyType="done"
                onSubmitEditing={sendOtp}
              />
            </View>

            <TouchableOpacity
              style={[styles.mainBtn, loading && styles.btnDisabled]}
              onPress={sendOtp}
              disabled={loading}
              activeOpacity={0.85}
            >
              {loading
                ? <ActivityIndicator color="#fff" />
                : <Text style={styles.mainBtnText}>{otpSent ? 'Resend OTP' : 'Send OTP'}</Text>
              }
            </TouchableOpacity>

            {/* RESEND TIMER */}
            {otpSent && (
              <View style={styles.resendRow}>
                {timer > 0 ? (
                  <Text style={styles.resendTimerText}>
                    Resend OTP in <Text style={styles.timerHighlight}>{formatTimer(timer)}</Text>
                  </Text>
                ) : (
                  <TouchableOpacity onPress={sendOtp} disabled={loading} activeOpacity={0.7}>
                    <Text style={styles.resendActiveText}>Resend OTP</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}
          </View>

          {/* FOOTER */}
          <TouchableOpacity
            style={styles.footerLink}
            onPress={() => router.replace('/login')}
          >
            <Text style={styles.footerText}>
              Remembered your password? <Text style={styles.boldText}>Login</Text>
            </Text>
          </TouchableOpacity>

        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

/* ─────────────────────────────────────────────
   6. STYLES
───────────────────────────────────────────── */
const styles = StyleSheet.create({
  screenWrapper: { flex: 1, backgroundColor: '#000' },
  container: { flex: 1, backgroundColor: '#F9FAFB' },

  header: { paddingHorizontal: 16, paddingVertical: 12 },
  backBtn: {
    padding: 8,
    borderRadius: 12,
    backgroundColor: '#FFF',
    alignSelf: 'flex-start',
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
  },

  content: { flex: 1, paddingHorizontal: 24, paddingTop: 16 },

  iconContainer: { alignItems: 'center', marginBottom: 28 },
  iconCircle: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: '#ECFDF5',
    borderWidth: 2,
    borderColor: '#A7F3D0',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  iconImage: { width: 48, height: 48 }, // adjust to your image size

  textGroup: { alignItems: 'center', marginBottom: 36 },
  title: { fontSize: 26, fontWeight: '800', color: '#111827', textAlign: 'center' },
  subtitle: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 21,
    paddingHorizontal: 12,
  },

  form: { width: '100%' },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 14,
    paddingHorizontal: 14,
    marginBottom: 20,
  },
  inputIcon: { marginRight: 10 },
  input: { flex: 1, paddingVertical: 15, fontSize: 15, color: '#111827' },

  mainBtn: {
    backgroundColor: '#064E3B',
    paddingVertical: 17,
    borderRadius: 14,
    alignItems: 'center',
    elevation: 3,
    shadowColor: '#064E3B',
    shadowOpacity: 0.25,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },
  btnDisabled: { opacity: 0.65, backgroundColor: '#374151' },
  mainBtnText: { color: '#FFF', fontSize: 16, fontWeight: '700', letterSpacing: 0.3 },

  resendRow: { alignItems: 'center', marginTop: 16 },
  resendTimerText: { fontSize: 13, color: '#9CA3AF' },
  timerHighlight: { color: '#064E3B', fontWeight: '700' },
  resendActiveText: { fontSize: 14, color: '#064E3B', fontWeight: '700' },

  footerLink: { marginTop: 32, alignItems: 'center' },
  footerText: { fontSize: 14, color: '#6B7280' },
  boldText: { color: '#064E3B', fontWeight: '700' },
});