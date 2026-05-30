import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
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

const BASE_URL = 'https://dukan-backend-0cc9.onrender.com';

export default function EditShop() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [coords, setCoords] = useState(null);
  
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    whatsapp: '',
    address: '',
    description: ''
  });

  const handleInputChange = (key, value) => {
    setFormData(prev => ({ ...prev, [key]: value }));
  };

  const getLocation = useCallback(async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Location access is required.');
        return;
      }
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      setCoords({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      });
    } catch (err) {
      console.error('Location error:', err);
    }
  }, []);

  const fetchShop = useCallback(async () => {
    try {
      const user_id = await AsyncStorage.getItem('user_id');
      if (!user_id) return;
      const res = await fetch(`${BASE_URL}/api/merchant/dashboard/${user_id}/`);
      const data = await res.json();
      if (res.ok) {
        setFormData({
          name: data.shop.name || '',
          phone: data.shop.phone || '',
          whatsapp: data.shop.whatsapp_number || '',
          address: data.shop.address || '',
          description: data.shop.description || '',
        });
      }
    } catch (err) {
      console.error('Fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchShop();
    getLocation();
  }, [fetchShop, getLocation]);

  const handleUpdate = useCallback(async () => {
    if (saving) return;
    if (!formData.name.trim()) return Alert.alert('Error', 'Shop name is required');
    try {
      setSaving(true);
      const [[, t], [, at]] = await AsyncStorage.multiGet(['token', 'access_token']);
      const token = t || at;
      if (!token) return Alert.alert('Session Expired', 'Please log in again.');

      const res = await fetch(`${BASE_URL}/api/shop/update/`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: formData.name,
          phone: formData.phone,
          whatsapp_number: formData.whatsapp,
          address: formData.address,
          description: formData.description,
          latitude: coords?.latitude,
          longitude: coords?.longitude,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Update failed');
      Alert.alert('Success', 'Shop updated ✅');
      router.back();
    } catch (err) {
      Alert.alert('Error', err.message || 'Network error');
    } finally {
      setSaving(false);
    }
  }, [formData, coords, saving, router]);

  if (loading) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator size="large" color="#2F5D50" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right', 'bottom']}>
      <StatusBar barStyle="dark-content" />
      
      <View style={styles.header}>
        <TouchableOpacity 
          onPress={() => router.back()} 
          style={styles.backButton}
        >
          <Ionicons name="arrow-back" size={24} color="#1A332D" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Edit Shop Profile</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView 
        style={styles.container} 
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.label}>Shop Name</Text>
        <TextInput
          placeholder="Enter shop name"
          value={formData.name}
          onChangeText={(val) => handleInputChange('name', val)}
          style={styles.input}
        />

        <Text style={styles.label}>Contact Number</Text>
        <TextInput
          placeholder="e.g. +1234567890"
          value={formData.phone}
          onChangeText={(val) => handleInputChange('phone', val)}
          style={styles.input}
          keyboardType="phone-pad"
        />

        <Text style={styles.label}>WhatsApp Number</Text>
        <TextInput
          placeholder="WhatsApp number (optional)"
          value={formData.whatsapp}
          onChangeText={(val) => handleInputChange('whatsapp', val)}
          style={styles.input}
          keyboardType="phone-pad"
        />

        <Text style={styles.label}>Area Name / Address</Text>
        <TextInput
          placeholder="Enter full shop address"
          value={formData.address}
          onChangeText={(val) => handleInputChange('address', val)}
          style={[styles.input, styles.textArea]}
          multiline
        />

        <Text style={styles.label}>Shop Description / Colony / Landmark (Optional)</Text>
        <TextInput
          placeholder="Colony name, ward number, nearby landmark, or shop description"
          value={formData.description}
          onChangeText={(val) => handleInputChange('description', val)}
          style={[styles.input, styles.textArea]}
          multiline
        />

        <Text style={styles.label}>Shop Location (Lat/Long)</Text>
        <View style={styles.locationBox}>
          <Text style={styles.locationText}>
            {coords 
              ? `Lat: ${coords.latitude.toFixed(6)}\nLong: ${coords.longitude.toFixed(6)}`
              : 'Fetching coordinates...'}
          </Text>

          <TouchableOpacity style={styles.locBtn} onPress={getLocation}>
            <Text style={styles.locBtnText}>Refresh GPS Location</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={[styles.btn, saving && { opacity: 0.7 }]}
          onPress={handleUpdate}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.btnText}>Save Changes</Text>
          )}
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F4F6F5',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#F4F6F5',
  },
  backButton: {
    padding: 8,
    borderRadius: 20,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#1A332D',
    textAlign: 'center',
  },
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
  },
  loader: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F4F6F5',
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2F5D50',
    marginBottom: 6,
    marginLeft: 4,
  },
  input: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    fontSize: 16,
    color: '#333',
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
  },
  locationBox: {
    backgroundColor: '#E8EFEA',
    padding: 15,
    borderRadius: 12,
    marginBottom: 25,
    borderStyle: 'dashed',
    borderWidth: 1,
    borderColor: '#2F5D50',
  },
  locationText: {
    color: '#2F5D50',
    marginBottom: 12,
    fontSize: 15,
    lineHeight: 22,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  locBtn: {
    backgroundColor: '#2F5D50',
    padding: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  locBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 13,
  },
  btn: {
    backgroundColor: '#2F5D50',
    padding: 18,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
});