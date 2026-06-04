/* ─────────────────────────────────────────────
   1. IMPORTS
───────────────────────────────────────────── */
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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

const CATEGORIES = [
  'Grocery', 'Footwear', 'Fashion', 'Medicine', 'Electronics',
  'Bakeries', 'Rentals', 'Stationery', 'Books', 'Furniture',
  'Home & Kitchen', '🔧 Hardware & Tools', 'Computers & Accessories', '🎁 Gifts & Toys',
  'Others',
];

const formatTimer = (seconds) => {
  const m = Math.floor(seconds / 60).toString().padStart(2, '0');
  const s = (seconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
};

/* ─────────────────────────────────────────────
   3. CUSTOM HOOK — useEmailOtp
   Handles send/verify/timer for email OTP.
   Pass `preVerifiedEmail` to skip OTP entirely
   when a customer email is already verified.
───────────────────────────────────────────── */
function useEmailOtp(preVerifiedEmail) {
  const intervalRef = useRef(null);

  const [otpLoading, setOtpLoading] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [emailVerified, setEmailVerified] = useState(!!preVerifiedEmail);
  const [otp, setOtp] = useState('');
  const [otpVerifyLoading, setOtpVerifyLoading] = useState(false);
  const [timer, setTimer] = useState(0);

  useEffect(() => () => clearInterval(intervalRef.current), []);

  // If a pre-verified email arrives, mark immediately verified
  useEffect(() => {
    if (preVerifiedEmail) setEmailVerified(true);
  }, [preVerifiedEmail]);

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

  const resetOtp = useCallback(() => {
    setEmailVerified(false);
    setOtpSent(false);
    setOtp('');
    clearInterval(intervalRef.current);
    setTimer(0);
  }, []);

  const sendOtp = useCallback(async (email) => {
    if (!email.trim() || !email.includes('@')) {
      Alert.alert('Invalid Email', 'Please enter a valid email address.');
      return;
    }
    try {
      setOtpLoading(true);
      const res = await fetch(`${BASE_URL}/api/send-otp/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setOtpSent(true);
        setOtp('');
        startTimer();
        Alert.alert('OTP Sent', 'Check your inbox for the verification code.');
      } else {
        Alert.alert('Error', data.error || 'Failed to send OTP.');
      }
    } catch {
      Alert.alert('Network Error', 'Please check your connection and try again.');
    } finally {
      setOtpLoading(false);
    }
  }, [startTimer]);

  const verifyOtp = useCallback(async (email) => {
    if (!otp.trim() || otp.length < 4) {
      Alert.alert('Invalid OTP', 'Please enter the OTP sent to your email.');
      return;
    }
    try {
      setOtpVerifyLoading(true);
      const res = await fetch(`${BASE_URL}/api/verify-otp/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), otp: otp.trim() }),
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
  }, [otp]);

  return {
    otpLoading, otpSent, emailVerified,
    otp, setOtp, otpVerifyLoading, timer,
    sendOtp, verifyOtp, resetOtp,
  };
}

/* ─────────────────────────────────────────────
   4. CUSTOM HOOK — useShopLocation
───────────────────────────────────────────── */
function useShopLocation(setAddress) {
  const [location, setLocation] = useState(null);
  const [locLoading, setLocLoading] = useState(false);

  const getLocation = useCallback(async () => {
    try {
      setLocLoading(true);
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Location access is required to register your shop.');
        return;
      }
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      const coords = { latitude: loc.coords.latitude, longitude: loc.coords.longitude };
      setLocation(coords);

      const geo = await Location.reverseGeocodeAsync(coords);
      if (geo.length > 0) {
        const p = geo[0];
        const addr = [p.name, p.city, p.region].filter(Boolean).join(', ');
        setAddress(addr);
      }
    } catch {
      Alert.alert('Error', 'Could not fetch location.');
    } finally {
      setLocLoading(false);
    }
  }, [setAddress]);

  return { location, locLoading, getLocation };
}

/* ─────────────────────────────────────────────
   5. VALIDATION HELPER
───────────────────────────────────────────── */
function validateSignupForm({ username, password, confirmPassword, shopName, category, emailVerified, location }) {
  if (!username || !shopName || !category) return 'Please fill in all required business details.';
  if (!emailVerified) return 'Please verify your email before registering.';
  if (!password || !confirmPassword) return 'Please enter and confirm your password.';
  if (password !== confirmPassword) return 'Passwords do not match. Please try again.';
  if (!location) return 'Please pin your shop location.';
  return null;
}

/* ─────────────────────────────────────────────
   6. MAIN COMPONENT
───────────────────────────────────────────── */
export default function MerchantSignup() {
  const router = useRouter();

  /**
   * Route params — customer signup can pass:
   *   verifiedEmail: string   (already OTP-verified)
   *   prefillUsername: string (optional convenience)
   *
   * Example navigation from customer signup:
   *   router.push({ pathname: '/merchant-signup', params: { verifiedEmail: email, prefillUsername: username } });
   */
  const { verifiedEmail = '', prefillUsername = '' } = useLocalSearchParams();

  /* ── Form state ── */
  const [form, setForm] = useState({
    username: prefillUsername || '',
    email: verifiedEmail || '',
    password: '',
    confirmPassword: '',
    shopName: '',
    category: '',
    address: '',
  });

  const updateField = useCallback((key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  }, []);

  const setAddress = useCallback((addr) => updateField('address', addr), [updateField]);

  /* ── UI state ── */
  const [loading, setLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  /* ── OTP hook — pass preVerifiedEmail to skip OTP flow ── */
  const {
    otpLoading, otpSent, emailVerified,
    otp, setOtp, otpVerifyLoading, timer,
    sendOtp, verifyOtp, resetOtp,
  } = useEmailOtp(verifiedEmail);

  /* ── Location hook ── */
  const { location, locLoading, getLocation } = useShopLocation(setAddress);

  /* ── Email change handler: reset OTP if user edits email ── */
  const handleEmailChange = useCallback((v) => {
    updateField('email', v);
    if (emailVerified || otpSent) resetOtp();
  }, [emailVerified, otpSent, resetOtp, updateField]);

  /* ── Password match state (memoised) ── */
  const passwordsMatch = useMemo(
    () => form.confirmPassword.length > 0 && form.password === form.confirmPassword,
    [form.password, form.confirmPassword],
  );
  const passwordsMismatch = useMemo(
    () => form.confirmPassword.length > 0 && form.password !== form.confirmPassword,
    [form.password, form.confirmPassword],
  );

  /* ── Final signup ── */
  const handleSignup = useCallback(async () => {
    const error = validateSignupForm({
      ...form,
      emailVerified,
      location,
    });
    if (error) { Alert.alert('Error', error); return; }

    setLoading(true);
    try {
      const res = await fetch(`${BASE_URL}/api/auth/signup/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: form.username.trim(),
          email: form.email.trim(),
          password: form.password,
          role: 'merchant',
          shop_name: form.shopName,
          category: form.category,
          latitude: location.latitude,
          longitude: location.longitude,
          address: form.address,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        const msg = data.upgraded
          ? 'Your customer account has been upgraded to a merchant account!'
          : 'Merchant account created!';
        Alert.alert('Success', msg, [
          { text: 'Login', onPress: () => router.replace('/login') },
        ]);
      } else {
        Alert.alert('Signup Failed', data.error || 'Check your details.');
      }
    } catch {
      Alert.alert('Network Error', 'Server is unreachable.');
    } finally {
      setLoading(false);
    }
  }, [form, emailVerified, location, router]);

  /* ─────────────────────────────────────────────
     7. RENDER
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

            <Text style={styles.formTitle}>Seller Setup</Text>
            <Text style={styles.formSub}>Tell us about your shop</Text>

            {/* ── Username ── */}
            <FieldGroup label="USERNAME">
              <InputRow icon="person-outline">
                <TextInput
                  placeholder="Enter your username"
                  placeholderTextColor="#A3A3A3"
                  style={styles.input}
                  value={form.username}
                  onChangeText={(v) => updateField('username', v)}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </InputRow>
            </FieldGroup>

            {/* ── Email ── */}
            <FieldGroup label="EMAIL">
              {/* Show banner if email was pre-verified from customer account */}
              {!!verifiedEmail && (
                <View style={styles.preVerifiedBanner}>
                  <Ionicons name="checkmark-circle" size={14} color="#064E3B" />
                  <Text style={styles.preVerifiedText}>
                    Using verified email from your customer account
                  </Text>
                </View>
              )}
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
                    onPress={() => sendOtp(form.email)}
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
                      onPress={() => verifyOtp(form.email)}
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
                      <TouchableOpacity onPress={() => sendOtp(form.email)} disabled={otpLoading} activeOpacity={0.7}>
                        <Text style={styles.resendActiveText}>Resend OTP</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              )}
            </FieldGroup>

            {/* ── Password ── */}
            <FieldGroup label="PASSWORD">
              <InputRow icon="lock-closed-outline">
                <TextInput
                  placeholder="Enter your password"
                  placeholderTextColor="#A3A3A3"
                  secureTextEntry={!showPassword}
                  style={[styles.input, styles.inputWithToggle]}
                  value={form.password}
                  onChangeText={(v) => updateField('password', v)}
                />
                <EyeToggle show={showPassword} onToggle={() => setShowPassword((p) => !p)} />
              </InputRow>
            </FieldGroup>

            {/* ── Confirm Password ── */}
            <FieldGroup label="CONFIRM PASSWORD">
              <View style={[
                styles.inputWrapper,
                passwordsMismatch && styles.inputWrapperError,
                passwordsMatch && styles.inputWrapperVerified,
              ]}>
                <Ionicons name="lock-closed-outline" size={17} color="#064E3B" style={styles.inputIcon} />
                <TextInput
                  placeholder="Re-enter your password"
                  placeholderTextColor="#A3A3A3"
                  secureTextEntry={!showConfirmPassword}
                  style={[styles.input, styles.inputWithToggle]}
                  value={form.confirmPassword}
                  onChangeText={(v) => updateField('confirmPassword', v)}
                />
                <EyeToggle show={showConfirmPassword} onToggle={() => setShowConfirmPassword((p) => !p)} />
              </View>
              {passwordsMismatch && (
                <HintRow icon="close-circle-outline" color="#DC2626" textStyle={styles.passwordHintError} text="Passwords do not match" />
              )}
              {passwordsMatch && (
                <HintRow icon="checkmark-circle-outline" color="#064E3B" textStyle={styles.passwordHintOk} text="Passwords match" />
              )}
            </FieldGroup>

            {/* ── Shop Name ── */}
            <FieldGroup label="SHOP NAME">
              <InputRow icon="storefront-outline">
                <TextInput
                  placeholder="Enter your shop name"
                  placeholderTextColor="#A3A3A3"
                  style={styles.input}
                  value={form.shopName}
                  onChangeText={(v) => updateField('shopName', v)}
                />
              </InputRow>
            </FieldGroup>

            {/* ── Category ── */}
            <FieldGroup label="CATEGORY">
              <TouchableOpacity
                style={styles.selector}
                onPress={() => setShowDropdown((p) => !p)}
              >
                <View style={styles.selectorLeft}>
                  <Ionicons name="grid-outline" size={17} color="#064E3B" style={styles.inputIcon} />
                  <Text style={[styles.selectorText, form.category && { color: '#0A0A0A' }]}>
                    {form.category || 'Select a category'}
                  </Text>
                </View>
                <Ionicons name={showDropdown ? 'chevron-up' : 'chevron-down'} size={18} color="#A3A3A3" />
              </TouchableOpacity>

              {showDropdown && (
                <View style={styles.dropdownList}>
                  {CATEGORIES.map((cat, i) => (
                    <TouchableOpacity
                      key={cat}
                      style={[styles.dropdownItem, i === CATEGORIES.length - 1 && { borderBottomWidth: 0 }]}
                      onPress={() => { updateField('category', cat); setShowDropdown(false); }}
                    >
                      <Text style={[styles.dropdownText, form.category === cat && { color: '#064E3B', fontWeight: '700' }]}>
                        {cat}
                      </Text>
                      {form.category === cat && <Ionicons name="checkmark" size={16} color="#064E3B" />}
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </FieldGroup>

            {/* ── Location ── */}
            <View style={styles.locationBox}>
              <View style={styles.locationInfo}>
                <MaterialCommunityIcons name="map-marker-radius" size={24} color="#064E3B" />
                <View style={{ marginLeft: 12, flex: 1 }}>
                  <Text style={styles.locTitle}>Shop Location</Text>
                  <Text style={styles.locSub} numberOfLines={2}>
                    {form.address || (location ? 'Coordinates Captured' : 'Not set yet')}
                  </Text>
                </View>
              </View>
              <TouchableOpacity style={styles.locAction} onPress={getLocation} disabled={locLoading}>
                {locLoading
                  ? <ActivityIndicator size="small" color="#064E3B" />
                  : <Text style={styles.locActionText}>{location ? 'Change' : 'Get Location'}</Text>
                }
              </TouchableOpacity>
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
                  <Text style={styles.mainBtnText}>Register Shop</Text>
                  <Ionicons name="arrow-forward-outline" size={18} color="#fff" />
                </View>
              )}
            </TouchableOpacity>

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
   8. SUB-COMPONENTS (pure, no re-render cost)
───────────────────────────────────────────── */
function FieldGroup({ label, children }) {
  return (
    <View style={styles.fieldGroup}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {children}
    </View>
  );
}

function InputRow({ icon, children }) {
  return (
    <View style={styles.inputWrapper}>
      <Ionicons name={icon} size={17} color="#064E3B" style={styles.inputIcon} />
      {children}
    </View>
  );
}

function EyeToggle({ show, onToggle }) {
  return (
    <TouchableOpacity onPress={onToggle} style={styles.eyeBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
      <Ionicons name={show ? 'eye-off-outline' : 'eye-outline'} size={20} color={show ? '#064E3B' : '#A3A3A3'} />
    </TouchableOpacity>
  );
}

function HintRow({ icon, color, textStyle, text }) {
  return (
    <View style={styles.passwordHintRow}>
      <Ionicons name={icon} size={13} color={color} />
      <Text style={textStyle}>{text}</Text>
    </View>
  );
}

/* ─────────────────────────────────────────────
   9. STYLES
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
    backgroundColor: '#DCFCE7',
    paddingVertical: 4, paddingHorizontal: 10,
    borderRadius: 20, marginLeft: 4,
    flexDirection: 'row', alignItems: 'center', gap: 4,
  },
  verifiedText: { color: '#064E3B', fontSize: 11, fontWeight: '800', letterSpacing: 0.3 },

  /* Pre-verified email banner */
  preVerifiedBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#F0FDF4', borderRadius: 8,
    paddingVertical: 7, paddingHorizontal: 10,
    borderWidth: 1, borderColor: '#DCFCE7',
    marginBottom: 8,
  },
  preVerifiedText: { fontSize: 12, color: '#166534', flex: 1 },

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

  passwordHintRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 5 },
  passwordHintError: { fontSize: 12, color: '#DC2626' },
  passwordHintOk: { fontSize: 12, color: '#064E3B' },

  selector: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: '#F9FAFB', borderRadius: 12,
    borderWidth: 1.5, borderColor: '#E5E7EB',
    paddingHorizontal: 14, paddingVertical: 14,
  },
  selectorLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  selectorText: { fontSize: 15, color: '#A3A3A3' },
  dropdownList: {
    backgroundColor: '#FFF', borderRadius: 12,
    borderWidth: 1.5, borderColor: '#E5E7EB',
    marginTop: 6, overflow: 'hidden',
  },
  dropdownItem: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 13, paddingHorizontal: 16,
    borderBottomWidth: 1, borderBottomColor: '#F3F4F6',
  },
  dropdownText: { fontSize: 15, color: '#374151' },

  locationBox: {
    backgroundColor: '#F0FDF4', padding: 16, borderRadius: 16,
    borderWidth: 1, borderColor: '#DCFCE7', marginBottom: 30,
  },
  locationInfo: { flexDirection: 'row', alignItems: 'center' },
  locTitle: { fontSize: 15, fontWeight: '700', color: '#064E3B' },
  locSub: { fontSize: 13, color: '#166534', marginTop: 2 },
  locAction: {
    alignSelf: 'flex-end', marginTop: 10,
    paddingVertical: 6, paddingHorizontal: 14,
    backgroundColor: '#FFF', borderRadius: 8,
    borderWidth: 1, borderColor: '#064E3B',
  },
  locActionText: { fontSize: 12, fontWeight: '700', color: '#064E3B' },

  mainBtn: {
    backgroundColor: '#064E3B', paddingVertical: 16, borderRadius: 14, alignItems: 'center',
    shadowColor: '#064E3B', shadowOpacity: 0.22, shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 }, elevation: 5,
  },
  btnInner: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  btnDisabled: { backgroundColor: '#6B7280', shadowOpacity: 0, elevation: 0 },
  mainBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700', letterSpacing: 0.3 },

  footer: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginTop: 28 },
  footerText: { color: '#6B7280', fontSize: 14 },
  link: { color: '#064E3B', fontWeight: '800', fontSize: 14 },
});