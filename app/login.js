/* ─────────────────────────────────────────────
   1. IMPORTS
───────────────────────────────────────────── */
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { useState } from 'react';
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
  View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const BASE_URL = "https://api.mydukan.online";

export default function Login() {
  const router = useRouter();

  /* ─────────────────────────────────────────────
     2. LOGIC (State & API)
  ───────────────────────────────────────────── */
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleLogin = async () => {
    if (!username.trim() || !password.trim()) {
      Alert.alert('Incomplete Fields', 'Please enter both your username and password.');
      return;
    }

    try {
      setLoading(true);

      const res = await fetch(`${BASE_URL}/api/auth/login/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          username: username.trim(),
          password: password.trim(),
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (res.ok && (data.access || data.token)) {
        const accessToken = data.access || data.token;

        await AsyncStorage.multiSet([
          ['access_token', accessToken],
          ['refresh_token', data.refresh || ''],
          ['user_id', String(data.user_id || '')],
          ['role', data.role || 'customer'],
        ]);

        if (data.role === 'merchant') {
          router.replace('/merchant/home');
        } else {
          router.replace('/shop/home');
        }
      } else {
        Alert.alert(
          'Login Failed',
          data?.error || 'Invalid credentials. Please try again.'
        );
      }
    } catch (_err) {
      Alert.alert(
        'Connection Error',
        'Could not reach the server. Check your network connection or server address.'
      );
    } finally {
      setLoading(false);
    }
  };

  /* ─────────────────────────────────────────────
     3. UI RENDER
  ───────────────────────────────────────────── */
  return (
    <View style={styles.mainWrapper}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

      <SafeAreaView style={styles.container}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.content}
        >

          {/* ── Brand Section ── */}
          <View style={styles.brandSection}>
            <View style={styles.logoPlaceholder}>
              <Image
                source={require('../assets/images/logo_green.png')}
                style={styles.logo}
                resizeMode="contain"
              />
            </View>
            <Text style={styles.brandName}>dukan</Text>
            <Text style={styles.brandTagline}>Making local shopping easy</Text>
          </View>

          {/* ── Form Section ── */}
          <View style={styles.formSection}>

            <Text style={styles.formTitle}>Welcome back</Text>
            <Text style={styles.formSub}>Sign in</Text>

            {/* Username Field */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>USERNAME</Text>
              <View style={styles.inputWrapper}>
                <Ionicons name="person-outline" size={17} color="#064E3B" style={styles.inputIcon} />
                <TextInput
                  placeholder="Enter your username"
                  placeholderTextColor="#A3A3A3"
                  value={username}
                  onChangeText={(text) => setUsername(text.trim())}
                  style={styles.input}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>
            </View>

            {/* Password Field */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>PASSWORD</Text>
              <View style={styles.inputWrapper}>
                <Ionicons name="lock-closed-outline" size={17} color="#064E3B" style={styles.inputIcon} />
                <TextInput
                  placeholder="Enter your password"
                  placeholderTextColor="#A3A3A3"
                  secureTextEntry={!showPassword}
                  value={password}
                  onChangeText={(text) => setPassword(text)}
                  style={[styles.input, styles.inputWithToggle]}
                />
                <TouchableOpacity
                  onPress={() => setShowPassword((prev) => !prev)}
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

            {/* Forgot Password */}
            <TouchableOpacity
              onPress={() => router.push('/forgot-password')}
              style={styles.forgotBtn}
            >
              <Text style={styles.forgotText}>Forgot Password?</Text>
            </TouchableOpacity>

            {/* Sign In Button */}
            <TouchableOpacity
              style={[styles.loginBtn, loading && styles.btnDisabled]}
              onPress={handleLogin}
              disabled={loading}
              activeOpacity={0.85}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <View style={styles.btnInner}>
                  <Text style={styles.loginBtnText}>Sign In</Text>
                  <Ionicons name="arrow-forward-outline" size={18} color="#fff" />
                </View>
              )}
            </TouchableOpacity>

            {/* Divider */}
            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>or</Text>
              <View style={styles.dividerLine} />
            </View>

            {/* Footer */}
            <View style={styles.footer}>
              <Text style={styles.footerText}>Don't have an account? </Text>
              <TouchableOpacity onPress={() => router.push('/role')}>
                <Text style={styles.signUpText}>Join Now</Text>
              </TouchableOpacity>
            </View>

          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

/* ─────────────────────────────────────────────
   STYLES  —  palette: #FFFFFF · #064E3B · #0A0A0A
───────────────────────────────────────────── */
const styles = StyleSheet.create({
  mainWrapper: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  content: {
    flex: 1,
    paddingHorizontal: 28,
    justifyContent: 'center',
  },

  /* ── Brand ── */
  brandSection: {
    alignItems: 'center',
    marginBottom: 40,
  },
  logoPlaceholder: {
    width: 84,
    height: 84,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    overflow: 'hidden',
  },
  logo: {
    width: '100%',
    height: '100%',
  },
  brandName: {
    fontSize: 38,
    fontWeight: '900',
    color: '#064E3B',
    letterSpacing: -1.5,
  },
  brandTagline: {
    fontSize: 13,
    color: '#A3A3A3',
    marginTop: 2,
    letterSpacing: 0.3,
  },

  /* ── Form ── */
  formSection: {
    width: '100%',
  },
  formTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#0A0A0A',
    letterSpacing: -0.4,
  },
  formSub: {
    fontSize: 14,
    color: '#A3A3A3',
    marginTop: 4,
    marginBottom: 28,
  },

  /* Fields */
  fieldGroup: {
    marginBottom: 18,
  },
  fieldLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#0A0A0A',
    letterSpacing: 2,
    marginBottom: 8,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    paddingHorizontal: 14,
  },
  inputIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    paddingVertical: 14,
    fontSize: 15,
    color: '#0A0A0A',
  },
  inputWithToggle: {
    paddingRight: 4,
  },
  eyeBtn: {
    paddingLeft: 8,
    paddingVertical: 4,
  },

  /* Forgot */
  forgotBtn: {
    alignSelf: 'flex-end',
    marginBottom: 26,
    marginTop: -6,
  },
  forgotText: {
    color: '#064E3B',
    fontWeight: '700',
    fontSize: 13,
  },

  /* Button */
  loginBtn: {
    backgroundColor: '#064E3B',
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
    shadowColor: '#064E3B',
    shadowOpacity: 0.22,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 5,
  },
  btnInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  btnDisabled: {
    backgroundColor: '#6B7280',
    shadowOpacity: 0,
    elevation: 0,
  },
  loginBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.3,
  },

  /* Divider */
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 24,
    gap: 12,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#E5E7EB',
  },
  dividerText: {
    color: '#A3A3A3',
    fontSize: 13,
    fontWeight: '500',
  },

  /* Footer */
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  footerText: {
    color: '#6B7280',
    fontSize: 14,
  },
  signUpText: {
    color: '#064E3B',
    fontWeight: '800',
    fontSize: 14,
  },
});