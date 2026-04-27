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

const BASE_URL = 'http://10.194.216.149:8000';


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
    } catch (err) {
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
    } catch (err) {
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
      <StatusBar barStyle="light-content" backgroundColor="#000" />
      <SafeAreaView style={styles.container}>
        
        {/* HEADER */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={24} color="#111" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Seller Setup</Text>
          <View style={{ width: 40 }} /> 
        </View>

        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
            
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Business Details</Text>
              <Text style={styles.sectionSub}>Tell us about your shop</Text>
            </View>

            {/* INPUT FIELDS */}
            <TextInput placeholder="Username" style={styles.input} onChangeText={(v) => setForm({...form, username: v})} />
            <TextInput placeholder="Email Address" keyboardType="email-address" style={styles.input} onChangeText={(v) => setForm({...form, email: v})} />
            <TextInput placeholder="Password" secureTextEntry style={styles.input} onChangeText={(v) => setForm({...form, password: v})} />
            <TextInput placeholder="Shop Name" style={styles.input} onChangeText={(v) => setForm({...form, shopName: v})} />

            {/* CATEGORY SELECTOR */}
            <TouchableOpacity style={styles.selector} onPress={() => setShowDropdown(!showDropdown)}>
              <Text style={[styles.selectorText, form.category && { color: '#111' }]}>
                {form.category || 'Select Category'}
              </Text>
              <Ionicons name={showDropdown ? "chevron-up" : "chevron-down"} size={18} color="#666" />
            </TouchableOpacity>

            {showDropdown && (
              <View style={styles.dropdownList}>
                {categories.map((cat, i) => (
                  <TouchableOpacity key={i} style={styles.dropdownItem} onPress={() => { setForm({...form, category: cat}); setShowDropdown(false); }}>
                    <Text style={styles.dropdownText}>{cat}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {/* LOCATION BOX */}
            <View style={styles.locationBox}>
              <View style={styles.locationInfo}>
                <MaterialCommunityIcons name="map-marker-radius" size={24} color="#064E3B" />
                <View style={{ marginLeft: 12, flex: 1 }}>
                  <Text style={styles.locTitle}>Shop Location</Text>
                  <Text style={styles.locSub} numberOfLines={2}>
                    {form.address || (location ? 'Coordinates Captured' : 'Not set')}
                  </Text>
                </View>
              </View>
              <TouchableOpacity style={styles.locAction} onPress={getLocation} disabled={locLoading}>
                {locLoading ? <ActivityIndicator size="small" color="#064E3B" /> : <Text style={styles.locActionText}>{location ? 'Change' : 'Get Location'}</Text>}
              </TouchableOpacity>
            </View>

            {/* SUBMIT */}
            <TouchableOpacity style={[styles.mainBtn, loading && styles.btnDisabled]} onPress={handleSignup} disabled={loading}>
              {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.mainBtnText}>Register Shop</Text>}
            </TouchableOpacity>

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
  screenWrapper: { flex: 1, backgroundColor: '#000' },
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: '#FFF' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#111' },
  backBtn: { padding: 8 },

  scrollContent: { padding: 24, paddingBottom: 60 },
  sectionHeader: { marginBottom: 24 },
  sectionTitle: { fontSize: 24, fontWeight: '800', color: '#111827' },
  sectionSub: { fontSize: 14, color: '#6B7280', marginTop: 4 },

  input: { backgroundColor: '#FFF', padding: 16, borderRadius: 12, marginBottom: 16, borderWidth: 1, borderColor: '#E5E7EB', fontSize: 16 },
  
  selector: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#FFF', padding: 16, borderRadius: 12, marginBottom: 12, borderWidth: 1, borderColor: '#E5E7EB' },
  selectorText: { fontSize: 16, color: '#9CA3AF' },
  
  dropdownList: { backgroundColor: '#FFF', borderRadius: 12, borderWidth: 1, borderColor: '#E5E7EB', marginBottom: 16, overflow: 'hidden' },
  dropdownItem: { padding: 14, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  dropdownText: { fontSize: 15, color: '#374151' },

  locationBox: { backgroundColor: '#F0FDF4', padding: 16, borderRadius: 16, borderWidth: 1, borderColor: '#DCFCE7', marginBottom: 30 },
  locationInfo: { flexDirection: 'row', alignItems: 'center' },
  locTitle: { fontSize: 15, fontWeight: '700', color: '#064E3B' },
  locSub: { fontSize: 13, color: '#166534', marginTop: 2 },
  locAction: { alignSelf: 'flex-end', marginTop: 10, paddingVertical: 6, paddingHorizontal: 12, backgroundColor: '#FFF', borderRadius: 8, borderWidth: 1, borderColor: '#064E3B' },
  locActionText: { fontSize: 12, fontWeight: '700', color: '#064E3B' },

  mainBtn: { backgroundColor: '#064E3B', paddingVertical: 18, borderRadius: 14, alignItems: 'center', marginTop: 10, elevation: 4, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 8 },
  btnDisabled: { opacity: 0.7 },
  mainBtnText: { color: '#FFF', fontSize: 16, fontWeight: '700' }
});