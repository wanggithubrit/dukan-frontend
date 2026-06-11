import AsyncStorage from '@react-native-async-storage/async-storage';
import { Alert, Text, TouchableOpacity, View } from 'react-native';

const BASE_URL = 'https://dukan-backend-0cc9.onrender.com';

export default function Upgrade() {

  const pay = async () => {
    const token = await AsyncStorage.getItem('access_token');

    // 1️⃣ Create order
    const res = await fetch(`${BASE_URL}/api/payment/create/`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    const data = await res.json();

    // 2️⃣ Open Razorpay
    const options = {
      description: 'mydukan Pro Plan',
      currency: 'INR',
      key: data.key,
      amount: data.amount,
      name: 'mydukan',
      order_id: data.order_id,
      prefill: {
        email: 'user@mydukan.com',
        contact: '9999999999',
      },
      theme: { color: '#2F5D50' },
      method: { upi: true, card: false, netbanking: false, wallet: false, emi: false, paylater: false },
      upi: { flow: 'intent' }
    };

    const _Razorpay = require('react-native-razorpay');
    const RazorpayCheckout = _Razorpay && (_Razorpay.default || _Razorpay);

    RazorpayCheckout.open(options)
      .then(async (payment) => {
        // 3️⃣ Verify payment
        const verifyRes = await fetch(`${BASE_URL}/api/payment/verify/`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            order_id: payment.razorpay_order_id,
            payment_id: payment.razorpay_payment_id,
            signature: payment.razorpay_signature,
          }),
        });

        if (verifyRes.ok) {
          Alert.alert('Success 🎉', 'You are now Pro!');
        } else {
          Alert.alert('Verification Failed', 'Payment could not be verified.');
        }
      })
      .catch((err) => {
        console.log('Razorpay payment error:', err);
        Alert.alert('Payment Failed');
      });
  };

  return (
    <View style={{ padding: 20 }}>
      <Text>Upgrade to Pro</Text>
      <Text>₹59 / month</Text>

      <TouchableOpacity onPress={pay}>
        <Text>Pay with UPI</Text>
      </TouchableOpacity>
    </View>
  );
}