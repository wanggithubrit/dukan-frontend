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

const BASE_URL = 'http://10.194.216.149:8000';


export default function Login() {
  const router = useRouter();

  /* ─────────────────────────────────────────────
     2. LOGIC (State & Functions)
  ───────────────────────────────────────────── */
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    // Basic Validation
    if (!username.trim() || !password.trim()) {
      Alert.alert('Incomplete Fields', 'Please enter both your username and password.');
      return;
    }

    try {
      setLoading(true);

      const res = await fetch(`${BASE_URL}/api/auth/login/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: username.trim(),
          password: password.trim(),
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (res.ok && (data.access || data.token)) {
        const accessToken = data.access || data.token;

        // Save session data
        await AsyncStorage.multiSet([
          ['access_token', accessToken],
          ['refresh_token', data.refresh || ''],
          ['user_id', String(data.user_id || '')],
          ['role', data.role || 'customer'],
        ]);

        // Role-based routing
        if (data.role === 'merchant') {
          router.replace('/merchant/home');
        } else {
          router.replace('/shop/home');
        }
      } else {
        Alert.alert('Login Failed', data?.error || 'Invalid credentials. Please try again.');
      }
    } catch (err) {
      Alert.alert('Connection Error', 'Could not reach the server. Check your network.');
    } finally {
      setLoading(false);
    }
  };

  /* ─────────────────────────────────────────────
     3. UI RENDER
  ───────────────────────────────────────────── */
  return (
    <View style={styles.mainWrapper}>
      <StatusBar barStyle="light-content" backgroundColor="#000" />
      
      <SafeAreaView style={styles.container}>
        {/* TOP NAVIGATION (Back Button) */}
        <View style={styles.navHeader}>
          <TouchableOpacity 
            style={styles.backCircle} 
            onPress={() => router.back()}
          >
            <Ionicons name="chevron-back" size={24} color="#1A1A1A" />
          </TouchableOpacity>
        </View>

        <KeyboardAvoidingView 
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.content}
        >
          {/* WELCOME SECTION */}
          <View style={styles.welcomeSection}>
            <Text style={styles.welcomeTitle}>Welcome Back</Text>
            <Text style={styles.welcomeSub}>Please log in to continue</Text>
          </View>

          {/* INPUT FIELDS */}
          <View style={styles.form}>
            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>Username</Text>
              <TextInput
                placeholder="Enter your username"
                placeholderTextColor="#9CA3AF"
                value={username}
                onChangeText={setUsername}
                style={styles.input}
                autoCapitalize="none"
              />
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>Password</Text>
              <TextInput
                placeholder="Enter your password"
                placeholderTextColor="#9CA3AF"
                secureTextEntry
                value={password}
                onChangeText={setPassword}
                style={styles.input}
              />
            </View>

            <TouchableOpacity
              onPress={() => router.push('/forgot-password')}
              style={styles.forgotBtn}
            >
              <Text style={styles.forgotText}>Forgot Password?</Text>
            </TouchableOpacity>

            {/* LOGIN BUTTON */}
            <TouchableOpacity
              style={[styles.loginBtn, loading && styles.btnDisabled]}
              onPress={handleLogin}
              disabled={loading}
              activeOpacity={0.8}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.loginBtnText}>Sign In</Text>
              )}
            </TouchableOpacity>
          </View>

          {/* SIGN UP REDIRECT (Optional but professional) */}
          <View style={styles.footer}>
            <Text style={styles.footerText}>Don't have an account? </Text>
            <TouchableOpacity onPress={() => router.push('/role')}>
              <Text style={styles.signUpText}>Join now</Text>
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
  mainWrapper: { flex: 1, backgroundColor: '#000' }, // For black status bar area
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  
  navHeader: {
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  backCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FFF',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 5,
  },

  content: {
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: 'center',
  },

  welcomeSection: {
    marginBottom: 35,
  },
  welcomeTitle: {
    fontSize: 32,
    fontWeight: '800',
    color: '#111827',
    letterSpacing: -0.5,
  },
  welcomeSub: {
    fontSize: 16,
    color: '#6B7280',
    marginTop: 4,
  },

  form: {
    width: '100%',
  },
  inputContainer: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
    marginLeft: 4,
  },
  input: {
    backgroundColor: '#FFF',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 12,
    fontSize: 16,
    color: '#111827',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },

  forgotBtn: {
    alignSelf: 'flex-end',
    marginBottom: 30,
  },
  forgotText: {
    color: '#064E3B',
    fontWeight: '700',
    fontSize: 14,
  },

  loginBtn: {
    backgroundColor: '#064E3B',
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#064E3B',
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },
  btnDisabled: {
    backgroundColor: '#374151',
    opacity: 0.8,
  },
  loginBtnText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '700',
  },

  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 40,
  },
  footerText: {
    color: '#6B7280',
    fontSize: 14,
  },
  signUpText: {
    color: '#064E3B',
    fontWeight: '700',
    fontSize: 14,
  },
});