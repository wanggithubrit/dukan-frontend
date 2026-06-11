/* ─────────────────────────────────────────────
   1. IMPORTS
───────────────────────────────────────────── */
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const BASE_URL = 'https://dukan-backend-0cc9.onrender.com';

export default function VerifyOtp() {
  const router = useRouter();
  const { email } = useLocalSearchParams();

  /* ─────────────────────────────────────────────
     2. LOGIC (State & Functions)
  ───────────────────────────────────────────── */
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [timer, setTimer] = useState(120); // 2 minutes cooldown
  const [resendLoading, setResendLoading] = useState(false);
  const intervalRef = useRef(null);

  const startTimer = () => {
    clearInterval(intervalRef.current);
    setTimer(120);
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

  useEffect(() => {
    startTimer();
    return () => clearInterval(intervalRef.current);
  }, []);

  const formatTimer = (seconds) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  const handleResend = async () => {
    if (!email) {
      Alert.alert('Error', 'Missing email address.');
      return;
    }
    try {
      setResendLoading(true);
      const res = await fetch(`${BASE_URL}/api/send-otp/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim().toLowerCase(), purpose: 'reset' }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        startTimer();
        let msg = 'Check your inbox for the new verification code.';
        if (data.otp) {
          msg += ` (Debug OTP: ${data.otp})`;
        }
        Alert.alert('OTP Sent', msg);
        if (data.otp) {
          setOtp(data.otp);
        }
      } else {
        Alert.alert('Error', data.error || 'Failed to resend OTP.');
      }
    } catch {
      Alert.alert('Network Error', 'Please check your connection and try again.');
    } finally {
      setResendLoading(false);
    }
  };

  const verifyOtp = async () => {
    if (otp.length < 4) {
      Alert.alert('Invalid Code', 'Please enter the full verification code sent to your email.');
      return;
    }

    try {
      setLoading(true);
      const res = await fetch(`${BASE_URL}/api/verify-otp/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim().toLowerCase(), otp: otp.trim() }),
      });

      const data = await res.json().catch(() => ({}));

      if (res.ok) {
        router.push({
        pathname: '/reset-password',
        params: {
        email,
        otp   // 🔥 THIS IS THE FIX
      }
});
} else {
        Alert.alert('Verification Failed', data.error || 'The code you entered is incorrect or expired.');
      }
    } catch (_err) {
      Alert.alert('Network Error', 'Check your connection and try again.');
    } finally {
      setLoading(false);
    }
  };

  /* ─────────────────────────────────────────────
     3. UI RENDER
  ───────────────────────────────────────────── */
  return (
    <View style={styles.screenWrapper}>
      <StatusBar barStyle="light-content" backgroundColor="#000" />
      <SafeAreaView style={styles.container}>
        
        {/* HEADER */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color="#111" />
          </TouchableOpacity>
        </View>

        <KeyboardAvoidingView 
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'} 
          style={styles.content}
        >
          {/* ICON & TEXT */}
          <View style={styles.iconContainer}>
            <View style={styles.iconCircle}>
              <MaterialCommunityIcons name="email-check-outline" size={40} color="#064E3B" />
            </View>
          </View>

          <View style={styles.textGroup}>
            <Text style={styles.title}>Verify Email</Text>
            <Text style={styles.subtitle}>
              {'We\'ve sent a 6-digit code to'}{"\n"}
              <Text style={styles.emailHighlight}>{email || 'your email'}</Text>
            </Text>
          </View>

          {/* OTP INPUT */}
          <View style={styles.form}>
            <TextInput
              placeholder="0 0 0 0 0 0"
              placeholderTextColor="#9CA3AF"
              value={otp}
              onChangeText={setOtp}
              style={styles.otpInput}
              keyboardType="number-pad"
              maxLength={6}
              autoFocus={true}
            />

            <TouchableOpacity 
              style={[styles.mainBtn, loading && styles.btnDisabled]} 
              onPress={verifyOtp}
              disabled={loading}
              activeOpacity={0.8}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.mainBtnText}>Verify & Continue</Text>
              )}
            </TouchableOpacity>

            {/* RESEND OPTION */}
            <View style={styles.resendContainer}>
              {timer > 0 ? (
                <Text style={styles.resendText}>
                  Resend OTP in <Text style={{ color: '#064E3B', fontWeight: '700' }}>{formatTimer(timer)}</Text>
                </Text>
              ) : (
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Text style={styles.resendText}>{'Didn\'t receive code? '}</Text>
                  <TouchableOpacity onPress={handleResend} disabled={resendLoading}>
                    {resendLoading ? (
                      <ActivityIndicator size="small" color="#064E3B" style={{ marginLeft: 5 }} />
                    ) : (
                      <Text style={styles.resendLink}>Resend OTP</Text>
                    )}
                  </TouchableOpacity>
                </View>
              )}
            </View>
          </View>

        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

/* ─────────────────────────────────────────────
   4. STYLES
───────────────────────────────────────────── */
const styles = StyleSheet.create({
  screenWrapper: { flex: 1, backgroundColor: '#000' },
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  
  header: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backBtn: {
    padding: 8,
    borderRadius: 12,
    backgroundColor: '#FFF',
    alignSelf: 'flex-start',
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 5,
  },

  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 20,
  },

  iconContainer: {
    alignItems: 'center',
    marginBottom: 30,
  },
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#ECFDF5',
    justifyContent: 'center',
    alignItems: 'center',
  },

  textGroup: {
    alignItems: 'center',
    marginBottom: 40,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: '#111827',
  },
  subtitle: {
    fontSize: 15,
    color: '#6B7280',
    textAlign: 'center',
    marginTop: 10,
    lineHeight: 22,
  },
  emailHighlight: {
    color: '#111827',
    fontWeight: '700',
  },

  form: {
    width: '100%',
  },
  otpInput: {
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 16,
    paddingVertical: 18,
    fontSize: 28,
    color: '#064E3B',
    textAlign: 'center',
    fontWeight: '800',
    letterSpacing: 10,
    marginBottom: 30,
  },

  mainBtn: {
    backgroundColor: '#064E3B',
    paddingVertical: 18,
    borderRadius: 14,
    alignItems: 'center',
    shadowColor: '#064E3B',
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  btnDisabled: {
    opacity: 0.7,
    backgroundColor: '#374151',
  },
  mainBtnText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '700',
  },

  resendContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 25,
  },
  resendText: {
    fontSize: 14,
    color: '#6B7280',
  },
  resendLink: {
    fontSize: 14,
    color: '#064E3B',
    fontWeight: '700',
  },
});