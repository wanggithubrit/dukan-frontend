import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import MapView, { Marker } from 'react-native-maps';

const BASE_URL = 'http://10.194.216.149:8000';


export default function EditShop() {

  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [whatsapp, setWhatsapp] = useState(''); // ✅ ADDED
  const [address, setAddress] = useState('');

  const [coords, setCoords] = useState(null);
  const [region, setRegion] = useState(null);

 

  // 📍 GET LOCATION
const getLocation = useCallback(async () => {
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();

    if (status !== 'granted') return;

    const location = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced, // 🔥 faster than High
    });

    const { latitude, longitude } = location.coords;

    const newCoords = { latitude, longitude };

    setCoords(newCoords);

    setRegion({
      ...newCoords,
      latitudeDelta: 0.01,
      longitudeDelta: 0.01,
    });

  } catch (err) {
    console.log('Location error:', err);
  }
}, []);

  // 📦 FETCH SHOP
  const fetchShop = useCallback(async () => {
  try {
    const user_id = await AsyncStorage.getItem('user_id');
    if (!user_id) return;

    const res = await fetch(`${BASE_URL}/api/merchant/dashboard/${user_id}/`);
    const data = await res.json();

    setName(data.shop.name);
    setPhone(data.shop.phone || '');
    setWhatsapp(data.shop.whatsapp_number || '');
    setAddress(data.shop.address || '');

  } catch (err) {
    console.log(err);
  } finally {
    setLoading(false);
  }
}, []);
 useEffect(() => {
    fetchShop();
    getLocation();
  }, []);

  // 💾 SAVE
  const handleUpdate = useCallback(async () => {
  if (saving) return;

  if (!name.trim()) {
    alert('Shop name required');
    return;
  }

  try {
    setSaving(true);

    const token = await AsyncStorage.getItem('access_token');

    const res = await fetch(`${BASE_URL}/api/shop/update/`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        name,
        phone,
        whatsapp_number: whatsapp,
        address,
        latitude: coords?.latitude,
        longitude: coords?.longitude,
      }),
    });

    const data = await res.json();

    if (!res.ok) return alert(data.error || 'Update failed');

    alert('Shop updated ✅');
    router.back();

  } catch (err) {
    console.log(err);
    alert('Network error');
  } finally {
    setSaving(false);
  }
}, [name, phone, whatsapp, address, coords, saving]);

  const handleMapPress = useCallback((e) => {
  const { latitude, longitude } = e.nativeEvent.coordinate;

  const newCoords = { latitude, longitude };

  setCoords(newCoords);

  setRegion(prev => ({
    ...prev,
    latitude,
    longitude,
  }));
}, []);

  if (loading) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator size="large" color="#2F5D50" />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} keyboardShouldPersistTaps="handled">

      <Text style={styles.title}>Edit Shop</Text>

      <TextInput
        placeholder="Shop Name"
        value={name}
        onChangeText={setName}
        style={styles.input}
      />

      <TextInput
        placeholder="Phone number"
        value={phone}
        onChangeText={setPhone}
        style={styles.input}
        keyboardType="phone-pad"
      />

      <TextInput
        placeholder="WhatsApp number (optional)"
        value={whatsapp}
        onChangeText={setWhatsapp}
        style={styles.input}
        keyboardType="phone-pad"
      />

      <TextInput
        placeholder="Address"
        value={address}
        onChangeText={setAddress}
        style={[styles.input, { height: 80 }]}
        multiline
      />

      {/* LOCATION */}
      <View style={styles.locationBox}>
        <Text style={styles.locationText}>
          📍 {coords
            ? `${coords.latitude.toFixed(4)}, ${coords.longitude.toFixed(4)}`
            : 'Getting location...'}
        </Text>

        <TouchableOpacity style={styles.locBtn} onPress={getLocation}>
          <Text style={styles.locBtnText}>Update Location</Text>
        </TouchableOpacity>
      </View>

      {/* MAP */}
      {region && coords && (
        <>
          <Text style={{ marginBottom: 8 }}>
            Tap map to adjust location
          </Text>

          <MapView
            style={styles.map}
            region={region}
             onPress={handleMapPress}
          >
            <Marker coordinate={coords} />
          </MapView>
        </>
      )}

      {/* SAVE BUTTON */}
      <TouchableOpacity
        style={styles.btn}
        onPress={handleUpdate}
        disabled={saving}
      >
        <Text style={{ color: '#fff' }}>
          {saving ? 'Saving...' : 'Save Changes'}
        </Text>
      </TouchableOpacity>

      <View style={{ height: 40 }} />

    </ScrollView>
  );
}

/* ================= STYLES ================= */
const styles = StyleSheet.create({

  container: {
    flex: 1,
    backgroundColor: '#F4F6F5',
    padding: 20,
  },

  loader: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },

  title: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 20,
  },

  input: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 12,
    marginBottom: 15,
  },

  locationBox: {
    backgroundColor: '#fff',
    padding: 12,
    borderRadius: 10,
    marginBottom: 15,
  },

  locationText: {
    color: '#555',
    marginBottom: 8,
  },

  locBtn: {
    backgroundColor: '#E8EFEA',
    padding: 10,
    borderRadius: 8,
    alignItems: 'center',
  },

  locBtnText: {
    color: '#2F5D50',
    fontWeight: '600',
  },

  map: {
    height: 200,
    borderRadius: 12,
    marginBottom: 15,
  },

  btn: {
    backgroundColor: '#2F5D50',
    padding: 15,
    borderRadius: 12,
    alignItems: 'center',
  },

});