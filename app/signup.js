/* ─────────────────────────────────────────────
   1. IMPORTS
───────────────────────────────────────────── */
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useCallback, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

/* ─────────────────────────────────────────────
   2. CONSTANTS
───────────────────────────────────────────── */
const BASE_URL = 'https://dukan-backend-0cc9.onrender.com';
const RESEND_COOLDOWN = 120;

const formatTimer = (s) => {
  const m = Math.floor(s / 60).toString().padStart(2, '0');
  const sec = (s % 60).toString().padStart(2, '0');
  return `${m}:${sec}`;
};

/* ─────────────────────────────────────────────
   3. VALIDATION
───────────────────────────────────────────── */
const validateEmail = (v) => /\S+@\S+\.\S+/.test(v);

function validateForm({ username, email, password, confirmPassword, emailVerified }) {
  if (!username.trim()) return 'Please enter a username.';
  if (!email.trim() || !validateEmail(email)) return 'Please enter a valid email.';
  if (!emailVerified) return 'Please verify your email before signing up.';
  if (password.length < 6) return 'Password must be at least 6 characters.';
  if (password !== confirmPassword) return 'Passwords do not match.';
  return null;
}

/* ─────────────────────────────────────────────
   4. MAIN COMPONENT
───────────────────────────────────────────── */
export default function CustomerSignup() {
  const router = useRouter();

  /* ── Form state ── */
  const [form, setForm] = useState({
    username: '', email: '', password: '', confirmPassword: '',
  });
  const updateField = useCallback((key, val) => {
    setForm((prev) => ({ ...prev, [key]: val }));
  }, []);

  /* ── UI state ── */
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  /* ── OTP state ── */
  const [otpLoading, setOtpLoading] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [emailVerified, setEmailVerified] = useState(false);
  const [otp, setOtp] = useState('');
  const [otpVerifyLoading, setOtpVerifyLoading] = useState(false);
  const [timer, setTimer] = useState(0);
  const intervalRef = useRef(null);

  /* ── Password match (memoised) ── */
  const passwordsMatch = useMemo(
    () => form.confirmPassword.length > 0 && form.password === form.confirmPassword,
    [form.password, form.confirmPassword],
  );
  const passwordsMismatch = useMemo(
    () => form.confirmPassword.length > 0 && form.password !== form.confirmPassword,
    [form.password, form.confirmPassword],
  );

  /* ── Timer ── */
  const startTimer = useCallback(() => {
    clearInterval(intervalRef.current);
    setTimer(RESEND_COOLDOWN);
    intervalRef.current = setInterval(() => {
      setTimer((prev) => {
        if (prev <= 1) { clearInterval(intervalRef.current); return 0; }
        return prev - 1;
      });
    }, 1000);
  }, []);

  /* ── Reset OTP when email changes ── */
  const handleEmailChange = useCallback((v) => {
    updateField('email', v);
    if (emailVerified || otpSent) {
      setEmailVerified(false);
      setOtpSent(false);
      setOtp('');
      clearInterval(intervalRef.current);
      setTimer(0);
    }
  }, [emailVerified, otpSent, updateField]);

  /* ── Send OTP ── */
  const sendOtp = useCallback(async () => {
    const { email } = form;
    if (!email.trim() || !validateEmail(email)) {
      Alert.alert('Invalid Email', 'Please enter a valid email address.');
      return;
    }
    try {
      setOtpLoading(true);
      const res = await fetch(`${BASE_URL}/api/send-otp/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim().toLowerCase(), purpose: 'signup' }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setOtpSent(true);
        setOtp('');
        startTimer();
        Alert.alert('OTP Sent', 'Check your inbox for the verification code.');
      } else {
        // ── KEY: if email belongs to a merchant, block the customer signup ──
        if (data.error?.toLowerCase().includes('merchant')) {
          Alert.alert(
            'Email In Use',
            'This email is registered to a merchant account and cannot be used for a customer account.',
          );
        } else {
          Alert.alert('Error', data.error || 'Failed to send OTP.');
        }
      }
    } catch {
      Alert.alert('Network Error', 'Please check your connection and try again.');
    } finally {
      setOtpLoading(false);
    }
  }, [form, startTimer]);

  /* ── Verify OTP ── */
  const verifyOtp = useCallback(async () => {
    if (!otp.trim() || otp.length < 4) {
      Alert.alert('Invalid OTP', 'Please enter the OTP sent to your email.');
      return;
    }
    try {
      setOtpVerifyLoading(true);
      const res = await fetch(`${BASE_URL}/api/verify-otp/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: form.email.trim().toLowerCase(), otp: otp.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setEmailVerified(true);
        clearInterval(intervalRef.current);
        Alert.alert('Email Verified ✓', 'Your email has been verified successfully.');
      } else {
        Alert.alert('Verification Failed', data.error || 'Invalid or expired OTP.');
      }
    } catch {
      Alert.alert('Network Error', 'Please check your connection and try again.');
    } finally {
      setOtpVerifyLoading(false);
    }
  }, [otp, form.email]);

  /* ── Signup ── */
  const handleSignup = useCallback(async () => {
    const error = validateForm({ ...form, emailVerified });
    if (error) { Alert.alert('Error', error); return; }

    setLoading(true);
    try {
      const res = await fetch(`${BASE_URL}/api/auth/signup/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: form.username.trim(),
          email: form.email.trim().toLowerCase(),
          password: form.password,
          role: 'customer',
        }),
      });
      const data = await res.json().catch(() => ({}));

      if (res.ok) {
        Alert.alert('Account Created 🎉', 'You can now log in.', [
          { text: 'Login', onPress: () => router.replace('/login') },
        ]);
      } else {
        // ── Never silently upgrade to merchant — show error as-is ──
        Alert.alert('Signup Failed', data.error || 'Please check your details.');
      }
    } catch {
      Alert.alert('Network Error', 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [form, emailVerified, router]);

  /* ─────────────────────────────────────────────
     5. RENDER
  ───────────────────────────────────────────── */
  return (
    <View style={styles.screenWrapper}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      <SafeAreaView style={styles.container}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{ flex: 1 }}
        >
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
          >
            {/* ── Brand ── */}
            <View style={styles.brandSection}>
              <View style={styles.logoPlaceholder}>
                <Image
                  source={require('../assets/images/logo_green.png')}
                  style={styles.logo}
                  resizeMode="contain"
                />
              </View>
              <Text style={styles.brandName}>MyDukan</Text>
              <Text style={styles.brandTagline}>Your local marketplace</Text>
            </View>

            <Text style={styles.formTitle}>Create Account</Text>
            <Text style={styles.formSub}>Fill in the details to get started</Text>

            {/* ── Username ── */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>USERNAME</Text>
              <View style={styles.inputWrapper}>
                <Ionicons name="person-outline" size={17} color="#064E3B" style={styles.inputIcon} />
                <TextInput
                  placeholder="Enter your username"
                  placeholderTextColor="#A3A3A3"
                  style={styles.input}
                  value={form.username}
                  onChangeText={(v) => updateField('username', v)}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>
            </View>

            {/* ── Email + OTP ── */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>EMAIL</Text>
              <View style={[styles.inputWrapper, emailVerified && styles.inputWrapperVerified]}>
                <Ionicons
                  name={emailVerified ? 'checkmark-circle' : 'mail-outline'}
                  size={17}
                  color="#064E3B"
                  style={styles.inputIcon}
                />
                <TextInput
                  placeholder="Enter your email"
                  placeholderTextColor="#A3A3A3"
                  style={[styles.input, styles.inputWithAction]}
                  value={form.email}
                  onChangeText={handleEmailChange}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  editable={!emailVerified}
                />
                {emailVerified ? (
                  <View style={styles.verifiedBadge}>
                    <Ionicons name="checkmark-circle" size={13} color="#064E3B" />
                    <Text style={styles.verifiedText}>Verified</Text>
                  </View>
                ) : (
                  <TouchableOpacity
                    style={[styles.verifyBtn, otpLoading && styles.verifyBtnDisabled]}
                    onPress={sendOtp}
                    disabled={otpLoading}
                    activeOpacity={0.8}
                  >
                    {otpLoading
                      ? <ActivityIndicator size="small" color="#fff" />
                      : <Text style={styles.verifyBtnText}>{otpSent ? 'Resend' : 'Verify'}</Text>
                    }
                  </TouchableOpacity>
                )}
              </View>

              {/* OTP Panel */}
              {otpSent && !emailVerified && (
                <View style={styles.otpPanel}>
                  <View style={styles.otpHintRow}>
                    <Ionicons name="information-circle-outline" size={14} color="#064E3B" />
                    <Text style={styles.otpHint}>
                      Enter the OTP sent to <Text style={{ fontWeight: '700' }}>{form.email}</Text>
                    </Text>
                  </View>
                  <View style={styles.otpRow}>
                    <View style={[styles.inputWrapper, styles.otpInputWrapper]}>
                      <Ionicons name="key-outline" size={17} color="#064E3B" style={styles.inputIcon} />
                      <TextInput
                        placeholder="Enter OTP"
                        placeholderTextColor="#A3A3A3"
                        style={[styles.input, styles.inputWithAction]}
                        value={otp}
                        onChangeText={setOtp}
                        keyboardType="number-pad"
                        maxLength={6}
                      />
                    </View>
                    <TouchableOpacity
                      style={[styles.confirmOtpBtn, otpVerifyLoading && styles.verifyBtnDisabled]}
                      onPress={verifyOtp}
                      disabled={otpVerifyLoading}
                      activeOpacity={0.85}
                    >
                      {otpVerifyLoading
                        ? <ActivityIndicator size="small" color="#fff" />
                        : <Text style={styles.confirmOtpBtnText}>Confirm</Text>
                      }
                    </TouchableOpacity>
                  </View>
                  <View style={styles.resendRow}>
                    {timer > 0 ? (
                      <Text style={styles.resendTimerText}>
                        Resend in <Text style={styles.timerHighlight}>{formatTimer(timer)}</Text>
                      </Text>
                    ) : (
                      <TouchableOpacity onPress={sendOtp} disabled={otpLoading} activeOpacity={0.7}>
                        <Text style={styles.resendActiveText}>Resend OTP</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              )}
            </View>

            {/* ── Password ── */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>PASSWORD</Text>
              <View style={styles.inputWrapper}>
                <Ionicons name="lock-closed-outline" size={17} color="#064E3B" style={styles.inputIcon} />
                <TextInput
                  placeholder="Enter your password"
                  placeholderTextColor="#A3A3A3"
                  secureTextEntry={!showPassword}
                  style={[styles.input, styles.inputWithToggle]}
                  value={form.password}
                  onChangeText={(v) => updateField('password', v)}
                />
                <TouchableOpacity
                  onPress={() => setShowPassword((p) => !p)}
                  style={styles.eyeBtn}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Ionicons
                    name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                    size={20}
                    color={showPassword ? '#064E3B' : '#A3A3A3'}
                  />
                </TouchableOpacity>
              </View>
            </View>

            {/* ── Confirm Password ── */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>CONFIRM PASSWORD</Text>
              <View style={[
                styles.inputWrapper,
                passwordsMismatch && styles.inputWrapperError,
                passwordsMatch && styles.inputWrapperVerified,
              ]}>
                <Ionicons name="lock-closed-outline" size={17} color="#064E3B" style={styles.inputIcon} />
                <TextInput
                  placeholder="Re-enter your password"
                  placeholderTextColor="#A3A3A3"
                  secureTextEntry={!showConfirm}
                  style={[styles.input, styles.inputWithToggle]}
                  value={form.confirmPassword}
                  onChangeText={(v) => updateField('confirmPassword', v)}
                />
                <TouchableOpacity
                  onPress={() => setShowConfirm((p) => !p)}
                  style={styles.eyeBtn}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Ionicons
                    name={showConfirm ? 'eye-off-outline' : 'eye-outline'}
                    size={20}
                    color={showConfirm ? '#064E3B' : '#A3A3A3'}
                  />
                </TouchableOpacity>
              </View>
              {passwordsMismatch && (
                <View style={styles.hintRow}>
                  <Ionicons name="close-circle-outline" size={13} color="#DC2626" />
                  <Text style={styles.hintError}>Passwords do not match</Text>
                </View>
              )}
              {passwordsMatch && (
                <View style={styles.hintRow}>
                  <Ionicons name="checkmark-circle-outline" size={13} color="#064E3B" />
                  <Text style={styles.hintOk}>Passwords match</Text>
                </View>
              )}
            </View>

            {/* ── Submit ── */}
            <TouchableOpacity
              style={[styles.mainBtn, loading && styles.btnDisabled]}
              onPress={handleSignup}
              disabled={loading}
              activeOpacity={0.85}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <View style={styles.btnInner}>
                  <Text style={styles.mainBtnText}>Sign Up</Text>
                  <Ionicons name="arrow-forward-outline" size={18} color="#fff" />
                </View>
              )}
            </TouchableOpacity>

            {/* ── Divider ── */}
            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>or</Text>
              <View style={styles.dividerLine} />
            </View>

            {/* ── Footer ── */}
            <View style={styles.footer}>
              <Text style={styles.footerText}>Already have an account? </Text>
              <TouchableOpacity onPress={() => router.push('/login')}>
                <Text style={styles.link}>Login</Text>
              </TouchableOpacity>
            </View>

          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

/* ─────────────────────────────────────────────
   6. STYLES
───────────────────────────────────────────── */
const styles = StyleSheet.create({
  screenWrapper: { flex: 1, backgroundColor: '#FFFFFF' },
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  scrollContent: { paddingHorizontal: 28, paddingVertical: 32, paddingBottom: 60 },

  brandSection: { alignItems: 'center', marginBottom: 32 },
  logoPlaceholder: {
    width: 84, height: 84, borderRadius: 22,
    justifyContent: 'center', alignItems: 'center',
    marginBottom: 14, overflow: 'hidden',
  },
  logo: { width: '100%', height: '100%' },
  brandName: { fontSize: 38, fontWeight: '900', color: '#064E3B', letterSpacing: -1.5 },
  brandTagline: { fontSize: 13, color: '#A3A3A3', marginTop: 2, letterSpacing: 0.3 },

  formTitle: { fontSize: 24, fontWeight: '800', color: '#0A0A0A', letterSpacing: -0.4 },
  formSub: { fontSize: 14, color: '#A3A3A3', marginTop: 4, marginBottom: 28 },

  fieldGroup: { marginBottom: 18 },
  fieldLabel: { fontSize: 10, fontWeight: '800', color: '#0A0A0A', letterSpacing: 2, marginBottom: 8 },

  inputWrapper: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#F9FAFB', borderRadius: 12,
    borderWidth: 1.5, borderColor: '#E5E7EB',
    paddingHorizontal: 14,
  },
  inputWrapperVerified: { borderColor: '#064E3B', backgroundColor: '#F0FDF4' },
  inputWrapperError: { borderColor: '#DC2626', backgroundColor: '#FFF5F5' },
  inputIcon: { marginRight: 10 },
  input: { flex: 1, paddingVertical: 14, fontSize: 15, color: '#0A0A0A' },
  inputWithToggle: { paddingRight: 4 },
  inputWithAction: { paddingRight: 4 },
  eyeBtn: { paddingLeft: 8, paddingVertical: 4 },

  verifyBtn: {
    backgroundColor: '#064E3B',
    paddingVertical: 6, paddingHorizontal: 12,
    borderRadius: 8, marginLeft: 4,
    minWidth: 60, alignItems: 'center',
  },
  verifyBtnDisabled: { backgroundColor: '#6B7280' },
  verifyBtnText: { color: '#fff', fontSize: 12, fontWeight: '700' },

  verifiedBadge: {
    backgroundColor: '#DCFCE7', paddingVertical: 4, paddingHorizontal: 10,
    borderRadius: 20, marginLeft: 4,
    flexDirection: 'row', alignItems: 'center', gap: 4,
  },
  verifiedText: { color: '#064E3B', fontSize: 11, fontWeight: '800', letterSpacing: 0.3 },

  otpPanel: {
    backgroundColor: '#F0FDF4', borderRadius: 12,
    borderWidth: 1, borderColor: '#DCFCE7',
    padding: 14, marginTop: 10,
  },
  otpHintRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 5, marginBottom: 10 },
  otpHint: { fontSize: 12, color: '#166534', flex: 1, lineHeight: 17 },
  otpRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  otpInputWrapper: { flex: 1, backgroundColor: '#fff', borderColor: '#D1FAE5' },

  confirmOtpBtn: {
    backgroundColor: '#064E3B',
    paddingVertical: 14, paddingHorizontal: 16,
    borderRadius: 12, alignItems: 'center', minWidth: 80,
  },
  confirmOtpBtnText: { color: '#fff', fontSize: 13, fontWeight: '700' },

  resendRow: { alignItems: 'center', marginTop: 10 },
  resendTimerText: { fontSize: 12, color: '#6B7280' },
  timerHighlight: { color: '#064E3B', fontWeight: '700' },
  resendActiveText: { fontSize: 13, color: '#064E3B', fontWeight: '700' },

  hintRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 5 },
  hintError: { fontSize: 12, color: '#DC2626' },
  hintOk: { fontSize: 12, color: '#064E3B' },

  mainBtn: {
    backgroundColor: '#064E3B', paddingVertical: 16, borderRadius: 14, alignItems: 'center',
    shadowColor: '#064E3B', shadowOpacity: 0.22, shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 }, elevation: 5,
  },
  btnInner: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  btnDisabled: { backgroundColor: '#6B7280', shadowOpacity: 0, elevation: 0 },
  mainBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700', letterSpacing: 0.3 },

  divider: { flexDirection: 'row', alignItems: 'center', marginVertical: 24, gap: 12 },
  dividerLine: { flex: 1, height: 1, backgroundColor: '#E5E7EB' },
  dividerText: { color: '#A3A3A3', fontSize: 13, fontWeight: '500' },

  footer: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center' },
  footerText: { color: '#6B7280', fontSize: 14 },
  link: { color: '#064E3B', fontWeight: '800', fontSize: 14 },
});