/* ─────────────────────────────────────────────
   1. IMPORTS
───────────────────────────────────────────── */
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
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

export default function ResetPassword() {
  const router = useRouter();
  const params = useLocalSearchParams();

  const email = params?.email || '';
  const otp   = params?.otp   || '';

  const [password, setPassword]               = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading]                 = useState(false);
  const [showPassword, setShowPassword]       = useState(false);
  const [showConfirm, setShowConfirm]         = useState(false);

  // strength: 0 = none, 1 = weak, 2 = medium, 3 = strong
  const getStrength = (p) => {
    if (!p) return 0;
    let score = 0;
    if (p.length >= 8) score++;
    if (/[A-Z]/.test(p) && /[a-z]/.test(p)) score++;
    if (/[0-9]/.test(p) || /[^A-Za-z0-9]/.test(p)) score++;
    return score;
  };
  const strength = getStrength(password);
  const strengthLabel = ['', 'Weak', 'Medium', 'Strong'];
  const strengthColor = ['', '#EF4444', '#F59E0B', '#10B981'];

  useEffect(() => {
    console.log("EMAIL:", email, "OTP:", otp);
  }, [email, otp]);

  /* ─────────────────────────────────────────────
     2. HANDLE RESET
  ───────────────────────────────────────────── */
  const handleReset = async () => {
    if (!email) {
      Alert.alert('Error', 'Missing email. Please restart the reset process.');
      return;
    }
    if (!otp) {
      Alert.alert('Error', 'Missing OTP. Please verify again.');
      return;
    }
    if (password.length < 6) {
      Alert.alert('Too Short', 'Password must be at least 6 characters.');
      return;
    }
    if (password !== confirmPassword) {
      Alert.alert('Mismatch', 'Passwords do not match.');
      return;
    }

    try {
      setLoading(true);
      const res = await fetch(`${BASE_URL}/api/reset-password/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, otp }),
      });

      const data = await res.json().catch(() => ({}));

      if (res.ok) {
        Alert.alert(
          'Success ✅',
          'Password updated successfully.',
          [{ text: 'Login', onPress: () => router.replace('/login') }]
        );
      } else {
        Alert.alert('Failed', data.error || 'Something went wrong.');
      }
    } catch (err) {
      console.log("RESET ERROR:", err);
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
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.7}>
            <Ionicons name="arrow-back" size={22} color="#111827" />
          </TouchableOpacity>
        </View>

        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.content}
        >
          {/* ICON — swap source with your own image */}
          <View style={styles.iconContainer}>
      
              <Image
                source={require('../assets/images/logo_green.png')} // 🔁 your image here
                style={styles.iconImage}
                resizeMode="contain"
              />
          
          </View>

          {/* TEXT */}
          <View style={styles.textGroup}>
            <Text style={styles.title}>Secure Your Account</Text>
            <Text style={styles.subtitle}>
              Create a strong password you do not use elsewhere.
            </Text>
          </View>

          {/* FORM */}
          <View style={styles.form}>

            {/* NEW PASSWORD */}
            <Text style={styles.label}>New Password</Text>
            <View style={styles.inputWrapper}>
              <Ionicons name="lock-closed-outline" size={18} color="#9CA3AF" style={styles.inputIcon} />
              <TextInput
                placeholder="Enter new password"
                placeholderTextColor="#9CA3AF"   // ✅ FIX: always set this
                secureTextEntry={!showPassword}
                value={password}
                onChangeText={setPassword}
                style={styles.input}
                autoCapitalize="none"
                returnKeyType="next"
              />
              <TouchableOpacity onPress={() => setShowPassword(!showPassword)} activeOpacity={0.7}>
                <Ionicons
                  name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                  size={20}
                  color="#6B7280"
                />
              </TouchableOpacity>
            </View>

            {/* STRENGTH BAR */}
            {password.length > 0 && (
              <View style={styles.strengthContainer}>
                <View style={styles.strengthBarRow}>
                  {[1, 2, 3].map((level) => (
                    <View
                      key={level}
                      style={[
                        styles.strengthSegment,
                        { backgroundColor: strength >= level ? strengthColor[strength] : '#E5E7EB' },
                      ]}
                    />
                  ))}
                </View>
                <Text style={[styles.strengthLabel, { color: strengthColor[strength] }]}>
                  {strengthLabel[strength]}
                </Text>
              </View>
            )}

            {/* CONFIRM PASSWORD */}
            <Text style={styles.label}>Confirm Password</Text>
            <View style={[
              styles.inputWrapper,
              confirmPassword.length > 0 && password !== confirmPassword && styles.inputError,
            ]}>
              <Ionicons name="lock-closed-outline" size={18} color="#9CA3AF" style={styles.inputIcon} />
              <TextInput
                placeholder="Re-enter new password"
                placeholderTextColor="#9CA3AF"   // ✅ FIX: always set this
                secureTextEntry={!showConfirm}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                style={styles.input}
                autoCapitalize="none"
                returnKeyType="done"
                onSubmitEditing={handleReset}
              />
              <TouchableOpacity onPress={() => setShowConfirm(!showConfirm)} activeOpacity={0.7}>
                <Ionicons
                  name={showConfirm ? 'eye-off-outline' : 'eye-outline'}
                  size={20}
                  color="#6B7280"
                />
              </TouchableOpacity>
            </View>

            {/* INLINE MATCH ERROR */}
            {confirmPassword.length > 0 && password !== confirmPassword && (
              <Text style={styles.errorText}>Passwords do not match</Text>
            )}

            {/* BUTTON */}
            <TouchableOpacity
              style={[styles.mainBtn, loading && styles.btnDisabled]}
              onPress={handleReset}
              disabled={loading}
              activeOpacity={0.85}
            >
              {loading
                ? <ActivityIndicator color="#fff" />
                : <Text style={styles.mainBtnText}>Update Password</Text>
              }
            </TouchableOpacity>

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
  container:     { flex: 1, backgroundColor: '#F9FAFB' },

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

  iconContainer: { alignItems: 'center', marginBottom: 26 },
  
  iconImage: { width: 80, height: 80 },

  textGroup:  { alignItems: 'center', marginBottom: 32 },
  title:      { fontSize: 26, fontWeight: '800', color: '#111827', textAlign: 'center' },
  subtitle:   { fontSize: 14, color: '#6B7280', textAlign: 'center', marginTop: 8, lineHeight: 21 },

  label: {
    fontSize: 13,
    fontWeight: '600',
    color: '#374151',      // ✅ explicit dark color — visible on any device
    marginBottom: 6,
    marginLeft: 2,
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
    marginBottom: 14,
  },
  inputError: { borderColor: '#FCA5A5' },
  inputIcon:  { marginRight: 10 },
  input: {
    flex: 1,
    paddingVertical: 15,
    fontSize: 15,
    color: '#111827',          // ✅ FIX: explicit text color — never leave this out
  },

  strengthContainer: { marginTop: -8, marginBottom: 14 },
  strengthBarRow:    { flexDirection: 'row', gap: 4, marginBottom: 4 },
  strengthSegment:   { flex: 1, height: 4, borderRadius: 4 },
  strengthLabel:     { fontSize: 12, fontWeight: '600', textAlign: 'right' },

  errorText: { fontSize: 12, color: '#EF4444', marginTop: -10, marginBottom: 12, marginLeft: 4 },

  mainBtn: {
    backgroundColor: '#064E3B',
    paddingVertical: 17,
    borderRadius: 14,
    alignItems: 'center',
    marginTop: 8,
    elevation: 3,
    shadowColor: '#064E3B',
    shadowOpacity: 0.25,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },
  btnDisabled:  { opacity: 0.65, backgroundColor: '#374151' },
  mainBtnText:  { color: '#FFF', fontSize: 16, fontWeight: '700', letterSpacing: 0.3 },
});