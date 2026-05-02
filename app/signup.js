import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function Signup() {
  const router = useRouter();

  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [secure1, setSecure1] = useState(true);
  const [secure2, setSecure2] = useState(true);
  const [loading, setLoading] = useState(false);

  const validateEmail = (email) => /\S+@\S+\.\S+/.test(email);

  const handleSignup = async () => {
    if (!username || !email || !password || !confirmPassword) {
      alert('Please fill all fields');
      return;
    }
    if (!validateEmail(email)) {
      alert('Enter a valid email');
      return;
    }
    if (password.length < 6) {
      alert('Password must be at least 6 characters');
      return;
    }
    if (password !== confirmPassword) {
      alert('Passwords do not match');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('https://api.mydukan.online', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, email, password }),
      });

      const data = await res.json();

      if (res.ok && data.message) {
        alert('Signup successful 🎉');
        router.replace('/login');
      } else {
        alert(data.error || 'Signup failed');
      }
    } catch (err) {
      console.log(err);
      alert('Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <ScrollView
            contentContainerStyle={styles.container}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
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
              <Text style={styles.brandTagline}>Your local marketplace</Text>
            </View>

            {/* ── Form Title ── */}
            <Text style={styles.formTitle}>Create Account</Text>
            <Text style={styles.formSub}>Fill in the details to get started</Text>

            {/* Username */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>USERNAME</Text>
              <View style={styles.inputWrapper}>
                <Ionicons name="person-outline" size={17} color="#064E3B" style={styles.inputIcon} />
                <TextInput
                  placeholder="Enter your username"
                  placeholderTextColor="#A3A3A3"
                  style={styles.input}
                  value={username}
                  onChangeText={setUsername}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>
            </View>

            {/* Email */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>EMAIL</Text>
              <View style={styles.inputWrapper}>
                <Ionicons name="mail-outline" size={17} color="#064E3B" style={styles.inputIcon} />
                <TextInput
                  placeholder="Enter your email"
                  placeholderTextColor="#A3A3A3"
                  style={styles.input}
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>
            </View>

            {/* Password */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>PASSWORD</Text>
              <View style={styles.inputWrapper}>
                <Ionicons name="lock-closed-outline" size={17} color="#064E3B" style={styles.inputIcon} />
                <TextInput
                  placeholder="Enter your password"
                  placeholderTextColor="#A3A3A3"
                  secureTextEntry={secure1}
                  style={[styles.input, styles.inputWithToggle]}
                  value={password}
                  onChangeText={setPassword}
                />
                <TouchableOpacity
                  onPress={() => setSecure1(!secure1)}
                  style={styles.eyeBtn}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Ionicons
                    name={secure1 ? 'eye-outline' : 'eye-off-outline'}
                    size={20}
                    color={!secure1 ? '#064E3B' : '#A3A3A3'}
                  />
                </TouchableOpacity>
              </View>
            </View>

            {/* Confirm Password */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>CONFIRM PASSWORD</Text>
              <View style={styles.inputWrapper}>
                <Ionicons name="lock-closed-outline" size={17} color="#064E3B" style={styles.inputIcon} />
                <TextInput
                  placeholder="Re-enter your password"
                  placeholderTextColor="#A3A3A3"
                  secureTextEntry={secure2}
                  style={[styles.input, styles.inputWithToggle]}
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                />
                <TouchableOpacity
                  onPress={() => setSecure2(!secure2)}
                  style={styles.eyeBtn}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Ionicons
                    name={secure2 ? 'eye-outline' : 'eye-off-outline'}
                    size={20}
                    color={!secure2 ? '#064E3B' : '#A3A3A3'}
                  />
                </TouchableOpacity>
              </View>
            </View>

            {/* Sign Up Button */}
            <TouchableOpacity
              style={[
                styles.button,
                (!username || !email || !password || !confirmPassword || loading) && styles.btnDisabled,
              ]}
              onPress={handleSignup}
              disabled={!username || !email || !password || !confirmPassword || loading}
              activeOpacity={0.85}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <View style={styles.btnInner}>
                  <Text style={styles.buttonText}>Sign Up</Text>
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
              <Text style={styles.footerText}>Already have an account? </Text>
              <TouchableOpacity onPress={() => router.push('/login')}>
                <Text style={styles.link}>Login</Text>
              </TouchableOpacity>
            </View>

          </ScrollView>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  container: {
    flexGrow: 1,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 28,
    paddingVertical: 32,
    justifyContent: 'center',
  },

  /* ── Brand ── */
  brandSection: {
    alignItems: 'center',
    marginBottom: 32,
  },
  logoPlaceholder: {
    width: 84,
    height: 84,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 14,
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

  /* ── Form Header ── */
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

  /* ── Fields ── */
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

  /* ── Button ── */
  button: {
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
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.3,
  },

  /* ── Divider ── */
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

  /* ── Footer ── */
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  footerText: {
    color: '#6B7280',
    fontSize: 14,
  },
  link: {
    color: '#064E3B',
    fontWeight: '800',
    fontSize: 14,
  },
});