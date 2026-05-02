/* ─────────────────────────────────────────────
   1. IMPORTS
───────────────────────────────────────────── */
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import { useState } from 'react';
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
  View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const BASE_URL = "https://api.mydukan.online";

export default function MerchantSignup() {
  const router = useRouter();

  /* ─────────────────────────────────────────────
     2. LOGIC (State & Functions)
  ───────────────────────────────────────────── */
  const [form, setForm] = useState({
    username: '', email: '', password: '',
    shopName: '', category: '', address: ''
  });
  const [location, setLocation] = useState(null);
  const [loading, setLoading] = useState(false);
  const [locLoading, setLocLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const categories = [
    'Grocery', 'Footwear', 'Fashion', 'Medicine', 'Electronics',
    'Bakeries', 'Rentals', 'Stationery', 'Books', 'Furniture', 'Others'
  ];

  const getLocation = async () => {
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
        setForm({ ...form, address: `${p.name || ''}, ${p.city || ''}, ${p.region || ''}`.replace(/^, /, '') });
      }
    } catch (_err) {
      Alert.alert('Error', 'Could not fetch location.');
    } finally {
      setLocLoading(false);
    }
  };

  const handleSignup = async () => {
    const { username, password, shopName, category, email, address } = form;
    if (!username || !password || !shopName || !category) {
      Alert.alert('Missing Info', 'Please fill in all required business details.');
      return;
    }
    if (!location) {
      Alert.alert('Location Required', 'Please pin your shop location.');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${BASE_URL}/api/auth/signup/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: username.trim(),
          email, password, role: 'merchant',
          shop_name: shopName, category,
          latitude: location.latitude, longitude: location.longitude,
          address
        }),
      });

      const data = await res.json();
      if (res.ok) {
        Alert.alert('Success', 'Merchant account created!', [{ text: 'Login', onPress: () => router.replace('/login') }]);
      } else {
        Alert.alert('Signup Failed', data.error || 'Check your details.');
      }
    } catch (_err) {
      Alert.alert('Network Error', 'Server is unreachable.');
    } finally {
      setLoading(false);
    }
  };

  /* ─────────────────────────────────────────────
     3. UI RENDER
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

            {/* ── Form Header ── */}
            <Text style={styles.formTitle}>Seller Setup</Text>
            <Text style={styles.formSub}>Tell us about your shop</Text>

            {/* Username */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>USERNAME</Text>
              <View style={styles.inputWrapper}>
                <Ionicons name="person-outline" size={17} color="#064E3B" style={styles.inputIcon} />
                <TextInput
                  placeholder="Enter your username"
                  placeholderTextColor="#A3A3A3"
                  style={styles.input}
                  value={form.username}
                  onChangeText={(v) => setForm({ ...form, username: v })}
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
                  value={form.email}
                  onChangeText={(v) => setForm({ ...form, email: v })}
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
                  secureTextEntry={!showPassword}
                  style={[styles.input, styles.inputWithToggle]}
                  value={form.password}
                  onChangeText={(v) => setForm({ ...form, password: v })}
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

            {/* Shop Name */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>SHOP NAME</Text>
              <View style={styles.inputWrapper}>
                <Ionicons name="storefront-outline" size={17} color="#064E3B" style={styles.inputIcon} />
                <TextInput
                  placeholder="Enter your shop name"
                  placeholderTextColor="#A3A3A3"
                  style={styles.input}
                  value={form.shopName}
                  onChangeText={(v) => setForm({ ...form, shopName: v })}
                />
              </View>
            </View>

            {/* Category Selector */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>CATEGORY</Text>
              <TouchableOpacity
                style={styles.selector}
                onPress={() => setShowDropdown(!showDropdown)}
              >
                <View style={styles.selectorLeft}>
                  <Ionicons name="grid-outline" size={17} color="#064E3B" style={styles.inputIcon} />
                  <Text style={[styles.selectorText, form.category && { color: '#0A0A0A' }]}>
                    {form.category || 'Select a category'}
                  </Text>
                </View>
                <Ionicons
                  name={showDropdown ? 'chevron-up' : 'chevron-down'}
                  size={18}
                  color="#A3A3A3"
                />
              </TouchableOpacity>

              {showDropdown && (
                <View style={styles.dropdownList}>
                  {categories.map((cat, i) => (
                    <TouchableOpacity
                      key={i}
                      style={[
                        styles.dropdownItem,
                        i === categories.length - 1 && { borderBottomWidth: 0 }
                      ]}
                      onPress={() => { setForm({ ...form, category: cat }); setShowDropdown(false); }}
                    >
                      <Text style={[
                        styles.dropdownText,
                        form.category === cat && { color: '#064E3B', fontWeight: '700' }
                      ]}>
                        {cat}
                      </Text>
                      {form.category === cat && (
                        <Ionicons name="checkmark" size={16} color="#064E3B" />
                      )}
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>

            {/* Location Box */}
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
              <TouchableOpacity
                style={styles.locAction}
                onPress={getLocation}
                disabled={locLoading}
              >
                {locLoading
                  ? <ActivityIndicator size="small" color="#064E3B" />
                  : <Text style={styles.locActionText}>{location ? 'Change' : 'Get Location'}</Text>
                }
              </TouchableOpacity>
            </View>

            {/* Submit Button */}
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

            {/* Footer */}
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
   4. STYLES
───────────────────────────────────────────── */
const styles = StyleSheet.create({
  screenWrapper: { flex: 1, backgroundColor: '#FFFFFF' },
  container: { flex: 1, backgroundColor: '#FFFFFF' },

  scrollContent: {
    paddingHorizontal: 28,
    paddingVertical: 32,
    paddingBottom: 60,
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

  /* ── Selector ── */
  selector: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  selectorLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  selectorText: {
    fontSize: 15,
    color: '#A3A3A3',
  },
  dropdownList: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    marginTop: 6,
    overflow: 'hidden',
  },
  dropdownItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 13,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  dropdownText: {
    fontSize: 15,
    color: '#374151',
  },

  /* ── Location ── */
  locationBox: {
    backgroundColor: '#F0FDF4',
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#DCFCE7',
    marginBottom: 30,
  },
  locationInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  locTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#064E3B',
  },
  locSub: {
    fontSize: 13,
    color: '#166534',
    marginTop: 2,
  },
  locAction: {
    alignSelf: 'flex-end',
    marginTop: 10,
    paddingVertical: 6,
    paddingHorizontal: 14,
    backgroundColor: '#FFF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#064E3B',
  },
  locActionText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#064E3B',
  },

  /* ── Button ── */
  mainBtn: {
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
  mainBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.3,
  },

  /* ── Footer ── */
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 28,
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