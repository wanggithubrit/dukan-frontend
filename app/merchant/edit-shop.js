import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { scheduleShopReminders } from '../../utils/pushNotificationScheduler';

const BASE_URL = 'https://dukan-backend-0cc9.onrender.com';

export default function EditShop() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [coords, setCoords] = useState(null);
  const [gpsError, setGpsError] = useState(null);
  
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    whatsapp: '',
    address: '',
    description: '',
    opening_time: '',
    closing_time: '',
    auto_reminder_enabled: true
  });

  const [timePickerVisible, setTimePickerVisible] = useState(false);
  const [pickerTarget, setPickerTarget] = useState(null); // 'opening_time' or 'closing_time'
  const [selectedHour, setSelectedHour] = useState(9);
  const [selectedMinute, setSelectedMinute] = useState('00');
  const [selectedAmPm, setSelectedAmPm] = useState('AM');

  const formatTimeDisplay = (time24) => {
    if (!time24) return '';
    const parts = time24.split(':');
    if (parts.length < 2) return '';
    const hours = parseInt(parts[0], 10);
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const dispHours = hours % 12 || 12;
    return `${dispHours}:${parts[1]} ${ampm}`;
  };

  const openTimePicker = (target) => {
    setPickerTarget(target);
    const currentTime = formData[target] || (target === 'opening_time' ? '09:00' : '21:00');
    const parts = currentTime.split(':');
    const hours24 = parseInt(parts[0], 10) || 0;
    const ampm = hours24 >= 12 ? 'PM' : 'AM';
    const hours12 = hours24 % 12 || 12;
    
    setSelectedHour(hours12);
    setSelectedMinute(parts[1] || '00');
    setSelectedAmPm(ampm);
    setTimePickerVisible(true);
  };

  const confirmTimeSelection = () => {
    let hours24 = selectedHour;
    if (selectedAmPm === 'PM' && selectedHour < 12) {
      hours24 += 12;
    } else if (selectedAmPm === 'AM' && selectedHour === 12) {
      hours24 = 0;
    }
    
    // Clamp minute to 0-59
    let minVal = parseInt(selectedMinute, 10) || 0;
    if (minVal < 0) minVal = 0;
    if (minVal > 59) minVal = 59;
    
    const hh = String(hours24).padStart(2, '0');
    const mm = String(minVal).padStart(2, '0');
    handleInputChange(pickerTarget, `${hh}:${mm}`);
    setTimePickerVisible(false);
  };

  const handleInputChange = (key, value) => {
    setFormData(prev => ({ ...prev, [key]: value }));
  };

  const getLocation = useCallback(async () => {
    let resolved = false;
    try {
      const enabled = await Location.hasServicesEnabledAsync();
      if (!enabled) {
        setGpsError('GPS services are disabled. Please enable location services.');
        return;
      }
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setGpsError('Permission Denied. Location access is required.');
        return;
      }
      setGpsError(null);
      // Try fast last known position first (failsafe for emulators/inside buildings)
      const lastKnown = await Location.getLastKnownPositionAsync({});
      if (lastKnown) {
        resolved = true;
        setCoords({
          latitude: lastKnown.coords.latitude,
          longitude: lastKnown.coords.longitude,
        });
      }
      // Then request balanced position updates
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      resolved = true;
      setCoords({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      });
    } catch (err) {
      console.error('Location error:', err);
      // If lastKnown succeeded, don't clear coords if getCurrentPosition fails
      if (!resolved) {
        setGpsError('GPS signal unavailable. Tap refresh to retry.');
      }
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
          opening_time: data.shop.opening_time ? data.shop.opening_time.substring(0, 5) : '',
          closing_time: data.shop.closing_time ? data.shop.closing_time.substring(0, 5) : '',
          auto_reminder_enabled: data.shop.auto_reminder_enabled !== false
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
          opening_time: formData.opening_time || null,
          closing_time: formData.closing_time || null,
          auto_reminder_enabled: formData.auto_reminder_enabled
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Update failed');

      // Schedule local notification alarms
      await scheduleShopReminders({
        opening_time: formData.opening_time,
        closing_time: formData.closing_time,
        auto_reminder_enabled: formData.auto_reminder_enabled
      });

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
    <KeyboardAvoidingView
      style={styles.safeArea}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 80}
    >
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right', 'bottom']}>
          <StatusBar barStyle="dark-content" />
          
          <View style={styles.innerContainer}>
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

        <Text style={styles.label}>Opening Time</Text>
        <TouchableOpacity 
          style={styles.timeSelectorBtn} 
          onPress={() => openTimePicker('opening_time')}
          activeOpacity={0.7}
        >
          <Text style={formData.opening_time ? styles.timeText : styles.timeTextPlaceholder}>
            {formData.opening_time ? formatTimeDisplay(formData.opening_time) : 'Select opening time'}
          </Text>
          <Ionicons name="time-outline" size={20} color="#2F5D50" />
        </TouchableOpacity>

        <Text style={styles.label}>Closing Time</Text>
        <TouchableOpacity 
          style={styles.timeSelectorBtn} 
          onPress={() => openTimePicker('closing_time')}
          activeOpacity={0.7}
        >
          <Text style={formData.closing_time ? styles.timeText : styles.timeTextPlaceholder}>
            {formData.closing_time ? formatTimeDisplay(formData.closing_time) : 'Select closing time'}
          </Text>
          <Ionicons name="time-outline" size={20} color="#2F5D50" />
        </TouchableOpacity>

        <View style={styles.switchRow}>
          <Text style={styles.switchLabel}>Daily Open/Close Reminders</Text>
          <Switch
            value={formData.auto_reminder_enabled}
            onValueChange={(val) => handleInputChange('auto_reminder_enabled', val)}
            trackColor={{ false: '#767577', true: '#2F5D50' }}
            thumbColor={formData.auto_reminder_enabled ? '#fff' : '#f4f3f4'}
          />
        </View>

        <Text style={styles.label}>Shop Location (Lat/Long)</Text>
        <View style={styles.locationBox}>
          <Text style={styles.locationText}>
            {coords 
              ? `Lat: ${coords.latitude.toFixed(6)}\nLong: ${coords.longitude.toFixed(6)}`
              : gpsError || 'Fetching coordinates...'}
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
      {/* ─── Custom Time Picker Modal ─── */}
      <Modal
        visible={timePickerVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setTimePickerVisible(false)}
      >
        <TouchableWithoutFeedback onPress={() => setTimePickerVisible(false)}>
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback onPress={() => {}}>
              <View style={styles.pickerSheet}>
                <Text style={styles.pickerTitle}>
                  Select {pickerTarget === 'opening_time' ? 'Opening' : 'Closing'} Time
                </Text>

                {/* Live Preview Display */}
                <View style={styles.timePreviewContainer}>
                  <Text style={styles.timePreviewLabel}>SELECTED TIME</Text>
                  <Text style={styles.timePreviewText}>
                    {String(selectedHour).padStart(2, '0')}:{String(selectedMinute).padStart(2, '0')} {selectedAmPm}
                  </Text>
                </View>

                {/* Period selector */}
                <Text style={styles.pickerLabel}>Period</Text>
                <View style={styles.ampmRow}>
                  {['AM', 'PM'].map((p) => (
                    <TouchableOpacity
                      key={p}
                      style={[styles.ampmBtn, selectedAmPm === p && styles.ampmBtnActive]}
                      onPress={() => setSelectedAmPm(p)}
                    >
                      <Text style={[styles.ampmText, selectedAmPm === p && styles.ampmTextActive]}>
                        {p}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {/* Hours grid */}
                <Text style={styles.pickerLabel}>Hour</Text>
                <View style={styles.gridContainer}>
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((h) => (
                    <TouchableOpacity
                      key={h}
                      style={[styles.gridCell, selectedHour === h && styles.gridCellActive]}
                      onPress={() => setSelectedHour(h)}
                    >
                      <Text style={[styles.gridCellText, selectedHour === h && styles.gridCellTextActive]}>
                        {h}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {/* Minutes Stepper with Manual Input */}
                <Text style={styles.pickerLabel}>Minute (00 - 59)</Text>
                <View style={styles.minuteStepperRow}>
                  <TouchableOpacity 
                    style={styles.stepperBtn} 
                    onPress={() => {
                      let m = parseInt(selectedMinute, 10) || 0;
                      m = (m - 1 + 60) % 60;
                      setSelectedMinute(String(m).padStart(2, '0'));
                    }}
                  >
                    <Ionicons name="remove" size={20} color="#2F5D50" />
                  </TouchableOpacity>
                  
                  <View style={[styles.minuteInput, { justifyContent: 'center', alignItems: 'center' }]}>
                    <Text style={{ fontSize: 20, fontWeight: '800', color: '#1A332D' }}>
                      {String(selectedMinute)}
                    </Text>
                  </View>

                  <TouchableOpacity 
                    style={styles.stepperBtn} 
                    onPress={() => {
                      let m = parseInt(selectedMinute, 10) || 0;
                      m = (m + 1) % 60;
                      setSelectedMinute(String(m).padStart(2, '0'));
                    }}
                  >
                    <Ionicons name="add" size={20} color="#2F5D50" />
                  </TouchableOpacity>
                </View>

                <View style={styles.pickerActions}>
                  <TouchableOpacity 
                    style={styles.cancelBtn} 
                    onPress={() => setTimePickerVisible(false)}
                  >
                    <Text style={styles.cancelBtnText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity 
                    style={styles.confirmBtn} 
                    onPress={confirmTimeSelection}
                  >
                    <Text style={styles.confirmBtnText}>Set Time</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
          </View>
        </SafeAreaView>
      </TouchableWithoutFeedback>
    </KeyboardAvoidingView>
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
  innerContainer: {
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
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  switchLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1A332D',
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
  timeSelectorBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  timeText: {
    fontSize: 16,
    color: '#333',
    fontWeight: '600',
  },
  timeTextPlaceholder: {
    fontSize: 16,
    color: '#aaa',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  pickerSheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: Platform.OS === 'ios' ? 40 : 24,
  },
  pickerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#1A332D',
    marginBottom: 20,
    textAlign: 'center',
  },
  pickerLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#2F5D50',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 10,
    marginTop: 10,
  },
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 10,
  },
  gridCell: {
    width: '22.5%',
    backgroundColor: '#F3F5F4',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    marginBottom: 4,
  },
  gridCellMinute: {
    width: '22.5%',
    backgroundColor: '#F3F5F4',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    marginBottom: 4,
  },
  gridCellActive: {
    backgroundColor: '#2F5D50',
  },
  gridCellText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#333',
  },
  gridCellTextActive: {
    color: '#fff',
  },
  ampmRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
  },
  ampmBtn: {
    flex: 1,
    backgroundColor: '#F3F5F4',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  ampmBtnActive: {
    backgroundColor: '#2F5D50',
  },
  ampmText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#333',
  },
  ampmTextActive: {
    color: '#fff',
  },
  pickerActions: {
    flexDirection: 'row',
    gap: 12,
  },
  cancelBtn: {
    flex: 1,
    backgroundColor: '#F3F5F4',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  cancelBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#666',
  },
  confirmBtn: {
    flex: 1,
    backgroundColor: '#2F5D50',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  confirmBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#fff',
  },
  timePreviewContainer: {
    backgroundColor: '#E8EFEA',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 20,
    alignItems: 'center',
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#A8C5BB',
  },
  timePreviewLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#2F5D50',
    letterSpacing: 1.5,
    marginBottom: 4,
  },
  timePreviewText: {
    fontSize: 28,
    fontWeight: '800',
    color: '#1A332D',
  },
  minuteStepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    marginBottom: 24,
    backgroundColor: '#F3F5F4',
    paddingVertical: 10,
    borderRadius: 14,
  },
  stepperBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#E8EFEA',
    justifyContent: 'center',
    alignItems: 'center',
  },
  minuteInput: {
    width: 72,
    height: 44,
    backgroundColor: '#fff',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    fontSize: 20,
    fontWeight: '800',
    color: '#1A332D',
    textAlign: 'center',
  },
});