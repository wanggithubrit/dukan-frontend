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
      key: 'YOUR_KEY_ID',
      amount: data.amount,
      name: 'mydukan',
      order_id: data.id,
      prefill: {
        email: '',
        contact: '',
      },
      theme: { color: '#2F5D50' },
    };

  const _Razorpay = require('react-native-razorpay');
  const RazorpayCheckout = _Razorpay && (_Razorpay.default || _Razorpay);

    RazorpayCheckout.open(options)
      .then(async (payment) => {

        // 3️⃣ Verify payment
        await fetch(`${BASE_URL}/api/payment/verify/`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        Alert.alert('Success 🎉', 'You are now Pro!');
      })
      .catch(() => {
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