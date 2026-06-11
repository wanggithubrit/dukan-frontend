import React, { useState, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  ActivityIndicator,
  Modal,
  Alert,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';

const BASE_URL = 'https://dukan-backend-0cc9.onrender.com';

const _Razorpay = require('react-native-razorpay');
const RazorpayCheckout = _Razorpay && (_Razorpay.default || _Razorpay);

export default function SupportMyDukan({ platform = 'customer' }) {
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [thankYouVisible, setThankYouVisible] = useState(false);
  const [focused, setFocused] = useState(false);

  const handleSupport = useCallback(async () => {
    const amtNum = parseFloat(amount);
    if (isNaN(amtNum) || amtNum < 10) {
      Alert.alert('Invalid Amount', 'Please enter an amount of ₹10 or more.');
      return;
    }

    setLoading(true);
    try {
      const [[, token], [, at]] = await AsyncStorage.multiGet(['token', 'access_token']);
      const activeToken = token || at;

      const createRes = await fetch(`${BASE_URL}/api/support/create-order/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(activeToken ? { 'Authorization': `Bearer ${activeToken}` } : {}),
        },
        body: JSON.stringify({ amount: amtNum }),
      });

      const orderData = await createRes.json();
      if (!createRes.ok) {
        Alert.alert('Error', orderData.message || 'Failed to initialize payment.');
        setLoading(false);
        return;
      }

      const options = {
        description: 'Voluntary Support contribution',
        image: 'https://i.imgur.com/3g7URHv.png',
        currency: 'INR',
        key: orderData.key,
        amount: orderData.amount,
        name: 'Support mydukan',
        order_id: orderData.order_id,
        prefill: {
          email: 'user@mydukan.com',
          contact: '9999999999',
          name: 'mydukan Supporter',
        },
        theme: { color: '#0E5C42' },
        method: { upi: true, card: false, netbanking: false, wallet: false, emi: false, paylater: false },
        upi: { flow: 'intent' }
      };

      RazorpayCheckout.open(options)
        .then(async (paymentData) => {
          const verifyRes = await fetch(`${BASE_URL}/api/support/verify-payment/`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...(activeToken ? { 'Authorization': `Bearer ${activeToken}` } : {}),
            },
            body: JSON.stringify({
              order_id: orderData.order_id,
              payment_id: paymentData.razorpay_payment_id,
              signature: paymentData.razorpay_signature,
              amount: amtNum,
              platform: platform,
            }),
          });

          const verifyData = await verifyRes.json();
          if (verifyRes.ok) {
            setThankYouVisible(true);
          } else {
            Alert.alert('Verification Failed', verifyData.message || 'Could not verify payment.');
          }
        })
        .catch((err) => {
          console.log('Razorpay payment cancelled:', err);
        })
        .finally(() => {
          setLoading(false);
        });

    } catch (err) {
      console.error('Support payment failed:', err);
      Alert.alert('Network Error', 'Please check your internet connection.');
      setLoading(false);
    }
  }, [amount, platform]);

  return (
    <View style={styles.card}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.heartCircle}>
          <Ionicons name="heart" size={18} color="#0E5C42" />
        </View>
        <View>
          <Text style={styles.title}>Support mydukan</Text>
          <Text style={styles.subtitle}>Voluntary Contribution</Text>
        </View>
      </View>

      <Text style={styles.description}>
        Your contribution helps us keep the platform running and free for local businesses. Every gesture of support, big or small, helps us scale our infrastructure and build better features.
      </Text>

      {/* Input container */}
      <View style={[styles.inputContainer, focused && styles.inputContainerFocused]}>
        <Text style={styles.currencySymbol}>₹</Text>
        <TextInput
          style={styles.input}
          keyboardType="numeric"
          value={amount}
          onChangeText={setAmount}
          placeholder="Enter contribution amount"
          placeholderTextColor="#A0BAB4"
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
        />
      </View>

      <View style={styles.footerRow}>
        <Text style={styles.hint}>Minimum contribution is ₹10. Thank you for your kind gesture.</Text>
      </View>

      <TouchableOpacity
        style={[styles.btn, loading && styles.btnDisabled]}
        onPress={handleSupport}
        disabled={loading}
        activeOpacity={0.85}
      >
        {loading ? (
          <ActivityIndicator size="small" color="#fff" />
        ) : (
          <View style={styles.btnContent}>
            <Ionicons name="heart" size={16} color="#fff" style={{ marginRight: 6 }} />
            <Text style={styles.btnText}>Support mydukan</Text>
          </View>
        )}
      </TouchableOpacity>

      {/* Thank You Modal */}
      <Modal
        visible={thankYouVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setThankYouVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalIconContainer}>
              <Ionicons name="sparkles" size={40} color="#0E5C42" />
            </View>
            <Text style={styles.modalTitle}>Thank You For Supporting mydukan</Text>
            <Text style={styles.modalDescription}>
              Your contribution helps us improve the platform and support local businesses. We appreciate your backing.
            </Text>
            <TouchableOpacity
              style={styles.modalCloseBtn}
              onPress={() => setThankYouVisible(false)}
            >
              <Text style={styles.modalCloseBtnText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#E4EDE9',
    padding: 20,
    marginTop: 16,
    shadowColor: '#2F5D50',
    shadowOpacity: 0.04,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  heartCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#E6F4EA',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  title: {
    fontSize: 16,
    fontWeight: '850',
    color: '#0F1F1B',
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 10,
    fontWeight: '700',
    color: '#0E5C42',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginTop: 1,
  },
  description: {
    fontSize: 12,
    color: '#6B8A82',
    lineHeight: 18,
    marginBottom: 16,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#E4EDE9',
    borderRadius: 14,
    paddingHorizontal: 14,
    backgroundColor: '#F9FBFA',
    height: 48,
    marginBottom: 8,
  },
  inputContainerFocused: {
    borderColor: '#0E5C42',
    backgroundColor: '#fff',
  },
  currencySymbol: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0D4D37',
    marginRight: 6,
  },
  input: {
    flex: 1,
    fontSize: 15,
    fontWeight: '800',
    color: '#0F1F1B',
    padding: 0,
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    paddingHorizontal: 2,
  },
  hint: {
    fontSize: 11,
    color: '#557A70',
    fontWeight: '600',
    lineHeight: 16,
    flex: 1,
  },
  btn: {
    height: 48,
    backgroundColor: '#0E5C42',
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#0E5C42',
    shadowOpacity: 0.15,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
  },
  btnDisabled: {
    opacity: 0.7,
  },
  btnContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  btnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalCard: {
    width: '100%',
    maxWidth: 320,
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 5,
  },
  modalIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(14, 92, 66, 0.08)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F1F1B',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 8,
  },
  modalDescription: {
    fontSize: 13,
    color: '#6B8A82',
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 20,
  },
  modalCloseBtn: {
    width: '100%',
    height: 44,
    backgroundColor: '#F2F5F4',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalCloseBtnText: {
    color: '#4B5563',
    fontWeight: '700',
    fontSize: 13,
  },
});
