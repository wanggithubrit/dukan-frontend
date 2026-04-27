import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native';

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
      const res = await fetch('http://10.194.216.149:8000/api/auth/signup/', {
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
          <Text style={styles.title}>Create Account ✨</Text>

          {/* Username */}
          <TextInput
            placeholder="Username"
            style={styles.input}
            value={username}
            onChangeText={setUsername}
            autoCapitalize="none"
          />

          {/* Email */}
          <TextInput
            placeholder="Email"
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
          />

          {/* Password */}
          <View style={styles.passwordContainer}>
            <TextInput
              placeholder="Password"
              secureTextEntry={secure1}
              style={styles.passwordInput}
              value={password}
              onChangeText={setPassword}
            />
            <TouchableOpacity
              onPress={() => setSecure1(!secure1)}
              style={{ padding: 5 }}
            >
              <Ionicons
                name={secure1 ? 'eye-off' : 'eye'}
                size={22}
                color="#666"
              />
            </TouchableOpacity>
          </View>

          {/* Confirm Password */}
          <View style={styles.passwordContainer}>
            <TextInput
              placeholder="Confirm Password"
              secureTextEntry={secure2}
              style={styles.passwordInput}
              value={confirmPassword}
              onChangeText={setConfirmPassword}
            />
            <TouchableOpacity
              onPress={() => setSecure2(!secure2)}
              style={{ padding: 5 }}
            >
              <Ionicons
                name={secure2 ? 'eye-off' : 'eye'}
                size={22}
                color="#666"
              />
            </TouchableOpacity>
          </View>

          {/* Button */}
          <TouchableOpacity
            style={[
              styles.button,
              (!username || !email || !password || !confirmPassword || loading) && {
                opacity: 0.5,
              },
            ]}
            onPress={handleSignup}
            disabled={!username || !email || !password || !confirmPassword || loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>Sign Up</Text>
            )}
          </TouchableOpacity>

          {/* Footer */}
          <Text style={styles.footer}>
            Already have an account?{' '}
            <Text style={styles.link} onPress={() => router.push('/login')}>
              Login
            </Text>
          </Text>
        </ScrollView>
      </TouchableWithoutFeedback>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    backgroundColor: '#F8F8F8',
    padding: 20,
    justifyContent: 'center',
  },

  title: {
    fontSize: 26,
    fontWeight: 'bold',
    marginBottom: 30,
    color: '#111',
    textAlign: 'center',
  },

  input: {
    backgroundColor: '#fff',
    padding: 15,
    borderRadius: 12,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: '#E5E5E5',
  },

  passwordContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E5E5',
    marginBottom: 15,
    paddingHorizontal: 10,
  },

  passwordInput: {
    flex: 1,
    padding: 15,
  },

  button: {
    backgroundColor: '#2F5D50',
    padding: 15,
    borderRadius: 12,
    alignItems: 'center',
  },

  buttonText: {
    color: '#fff',
    fontWeight: 'bold',
  },

  footer: {
    textAlign: 'center',
    marginTop: 20,
    color: '#666',
  },

  link: {
    color: '#2F5D50',
    fontWeight: 'bold',
  },
});