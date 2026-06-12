import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import * as Sharing from 'expo-sharing';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useRef, useState } from 'react';
import SupportMyDukan from '../../components/SupportMyDukan';

import {
  ActivityIndicator,
  Alert,
  Linking,
  Modal,
  Platform,
  RefreshControl,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  KeyboardAvoidingView
} from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import RazorpayCheckout from 'react-native-razorpay';
import { SafeAreaView } from 'react-native-safe-area-context';
import ViewShot from 'react-native-view-shot';

const BASE_URL = 'https://dukan-backend-0cc9.onrender.com';

const NavBtn = ({ icon, label, onPress, active }) => (
  <TouchableOpacity
    style={[styles.navTab, active && styles.navTabActive]}
    onPress={onPress}
    activeOpacity={0.7}
  >
    <Ionicons name={icon} size={22} color={active ? '#00E676' : '#8E9A96'} />
    <Text style={[styles.navLabel, active && styles.navLabelActive]}>{label}</Text>
  </TouchableOpacity>
);

const Stat = ({ label, value, icon }) => (
  <View style={styles.statBox}>
    <Ionicons name={icon} size={20} color="#2F5D50" style={{ marginBottom: 4 }} />
    <Text style={styles.statValue}>{value}</Text>
    <Text style={styles.statLabel}>{label}</Text>
  </View>
);

const Setting = ({ icon, text, onPress, color = '#2F5D50', border = true }) => (
  <TouchableOpacity
    style={[styles.settingRow, !border && { borderBottomWidth: 0 }]}
    onPress={onPress}
    activeOpacity={0.7}
  >
    <View style={[styles.settingIconBox, { backgroundColor: color + '18' }]}>
      <Ionicons name={icon} size={18} color={color} />
    </View>
    <Text style={[styles.settingText, { color }]}>{text}</Text>
    <Ionicons name="chevron-forward" size={16} color={color + '80'} style={{ marginLeft: 'auto' }} />
  </TouchableOpacity>
);

const SupportRow = ({ icon, title, subtitle, onPress }) => (
  <TouchableOpacity style={styles.supportRow} onPress={onPress} activeOpacity={0.7}>
    <View style={styles.supportIconBox}>
      <Ionicons name={icon} size={20} color="#2F5D50" />
    </View>
    <View style={{ marginLeft: 12, flex: 1 }}>
      <Text style={styles.supportTitle}>{title}</Text>
      <Text style={styles.supportSub}>{subtitle}</Text>
    </View>
    <Ionicons name="chevron-forward" size={16} color="#ccc" />
  </TouchableOpacity>
);

const QRModal = ({ visible, onClose, shop, onDownload, viewRef }) => (
  <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
    <View style={styles.qrOverlay}>
      <View style={styles.qrModalCard}>
        <ViewShot ref={viewRef} options={{ format: 'png', quality: 1 }}>
          <View style={styles.qrPrintable}>
            <Ionicons name="storefront" size={40} color="#2F5D50" />
            <Text style={styles.qrTitle}>Scan to visit our shop</Text>
            <Text style={styles.qrShopName}>{shop?.name}</Text>
            <View style={styles.qrBox}>
              <QRCode
                value={`https://mydukan.online/shop/${shop?.id}`}
                size={180}
                color="#1a1a1a"
                backgroundColor="#fff"
                logo={require('../../assets/images/logo_splash_login.png')}
                logoSize={45}
                logoBorderRadius={8}
                logoBackgroundColor="#fff"
              />
            </View>
            <Text style={styles.qrFooter}>Make your local shopping easy nextime</Text>
          </View>
        </ViewShot>
        <View style={styles.qrActions}>
          <TouchableOpacity style={styles.qrDownloadBtn} onPress={onDownload} activeOpacity={0.85}>
            <Ionicons name="share-social-outline" size={18} color="#fff" />
            <Text style={styles.qrDownloadText}>Share QR Code</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.qrCloseBtn} onPress={onClose} activeOpacity={0.7}>
            <Text style={styles.qrCloseText}>Close</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  </Modal>
);

export const startPayment = async () => {
  try {
    const token = await AsyncStorage.getItem('token');
    const res = await fetch(`${BASE_URL}/api/create-order/`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` }
    });
    const data = await res.json();
    if (!res.ok) throw new Error('Failed to create order');

    const options = {
      description: 'Pro Plan - 30 Days',
      image: 'https://yourlogo.com/logo.png',
      currency: 'INR',
      key: data.key,
      amount: data.amount,
      order_id: data.order_id,
      name: 'mydukan',
      prefill: { contact: '9999999999' },
      theme: { color: '#2F5D50' },
      method: { upi: true, card: false, netbanking: false, wallet: false, emi: false, paylater: false },
      upi: { flow: 'intent' }
    };

    RazorpayCheckout.open(options)
      .then(async (payment) => {
        await verifyPayment(payment);
        Alert.alert("Success 🎉", "Pro Plan Activated!");
      })
      .catch((err) => {
        if (err.code !== 0) Alert.alert("Payment Failed", "Try again.");
      });
  } catch (err) {
    Alert.alert("Error", err.message);
  }
};

const verifyPayment = async (payment) => {
  try {
    const token = await AsyncStorage.getItem('token');
    const res = await fetch(`${BASE_URL}/api/verify-payment/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        order_id: payment.razorpay_order_id,
        payment_id: payment.razorpay_payment_id,
        signature: payment.razorpay_signature
      })
    });
    const data = await res.json();
    if (!res.ok || data.status !== 'success') throw new Error("Verification failed");
  } catch (_err) {
    Alert.alert("Error", "Payment verification failed");
  }
};

export default function MerchantProfile() {
  const router = useRouter();
  const viewRef = useRef(null);

  const [data, setData] = useState({
    shop: null,
    media: [],
    stats: null,
    plan: null,
    referral_code: '',
    referral_count: 0
  });

  const [ui, setUI] = useState({
    loading: true,
    refreshing: false,
    upgrading: false,
    showUpgrade: false,
    showQR: false,
    showDelete: false,
    deletePassword: '',
    deleteLoading: false,
  });

  const fetchDashboard = useCallback(async () => {
    try {
      const user_id = await AsyncStorage.getItem('user_id');
      if (!user_id) return;
      const res = await fetch(`${BASE_URL}/api/merchant/dashboard/${user_id}/`);
      const json = await res.json();
      setData({
        shop: json.shop,
        media: json.media || [],
        stats: json.stats,
        plan: json.plan,
        referral_code: json.referral_code || 'DUKAN777',
        referral_count: json.referral_count || 0
      });
      if (json.plan?.type) {
        AsyncStorage.setItem('plan', json.plan.type).catch(err => console.debug('AsyncStorage plan save failed:', err));
      }
    } catch (error) {
      console.log(error);
    } finally {
      setUI(prev => ({ ...prev, loading: false, refreshing: false }));
    }
  }, []);

  useEffect(() => { fetchDashboard(); }, [fetchDashboard]);

  const setUIKey = (key, val) => setUI(prev => ({ ...prev, [key]: val }));
  const openEmail = () => Linking.openURL('mailto:dukanpersonal316@gmail.com?subject=Merchant Support');

  const shareReferral = async () => {
    try {
      const referralCode = data.referral_code || 'DUKAN777';
      const appLink = 'https://play.google.com/store/apps/details?id=com.mydukan.dukanapp';
      await Share.share({
        title: 'Join mydukan as a Merchant',
        message: `Join mydukan as a merchant using my referral code: ${referralCode}\n\nDownload the app here:\n${appLink}\n\nBoost your sales today! 🚀`,
      });
    } catch (error) {
      console.log(error.message);
    }
  };

  const handlePayment = async () => {
    const token = await AsyncStorage.getItem('access_token');
    const res = await fetch(`${BASE_URL}/api/payment/create-order/`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    const options = {
      description: 'mydukan Pro Plan',
      currency: 'INR',
      key: data.key,
      amount: data.amount,
      order_id: data.order_id,
      name: 'mydukan',
      prefill: {
        email: data.shop?.owner_email || '',
        contact: data.shop?.phone || ''
      },
      theme: { color: '#2F5D50' },
    };
    RazorpayCheckout.open(options)
      .then(async () => {
        Alert.alert('Success', 'Payment successful');
        await fetch(`${BASE_URL}/api/shop/upgrade/`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
        });
      })
      .catch(() => Alert.alert('Error', 'Payment failed'));
  };

  const handleDownloadQR = async () => {
    try {
      const uri = await viewRef.current.capture();
      await Sharing.shareAsync(uri);
    } catch (_err) { Alert.alert('Error', 'Could not generate QR'); }
  };



  const handleLogout = async () => {
    Alert.alert('Logout', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Logout', style: 'destructive', onPress: async () => {
          await AsyncStorage.clear();
          router.replace('/role');
      }},
    ]);
  };

  const handleMerchantDeleteAccount = async () => {
    if (!ui.deletePassword.trim()) {
      Alert.alert('Error', 'Please enter your password.');
      return;
    }
    setUIKey('deleteLoading', true);
    try {
      const token = await AsyncStorage.getItem('token');
      const res = await fetch(`${BASE_URL}/api/auth/delete/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ password: ui.deletePassword })
      });
      const data = await res.json();
      if (res.ok) {
        setUI(prev => ({ ...prev, showDelete: false, deletePassword: '' }));
        Alert.alert('Deleted', 'Your account has been deleted successfully.', [
          { text: 'OK', onPress: async () => {
              await AsyncStorage.clear();
              router.replace('/role');
          }}
        ]);
      } else {
        Alert.alert('Error', data.error || 'Failed to delete account');
      }
    } catch (err) {
      Alert.alert('Error', 'Network error. Please try again.');
    } finally {
      setUIKey('deleteLoading', false);
    }
  };

  if (ui.loading || !data.plan) {
    return (
      <View style={styles.center}>
        <StatusBar style="dark" />
        <ActivityIndicator size="large" color="#2F5D50" />
      </View>
    );
  }

  const { shop, stats, plan, referral_count, referral_code } = data;
  const refCode = referral_code || 'DUKAN777';
  const progress = Math.min(((referral_count ?? 0) / 3) * 100, 100);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />

      <QRModal visible={ui.showQR} onClose={() => setUIKey('showQR', false)} shop={shop} onDownload={handleDownloadQR} viewRef={viewRef} />

      {/* UPGRADE MODAL */}
      <Modal visible={ui.showUpgrade} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>Upgrade to PRO</Text>
            <Text style={styles.modalSub}>Take your shop to the next level</Text>
            <View style={styles.modalFeature}><Ionicons name="checkmark-circle" size={20} color="#2F5D50" /><Text style={styles.modalItem}>Showcase up to {plan?.pro_tier_limit ?? 120} products in your shop</Text></View>
            <View style={styles.modalFeature}><Ionicons name="checkmark-circle" size={20} color="#2F5D50" /><Text style={styles.modalItem}>Upload up to 3 images per product</Text></View>
            <View style={styles.modalFeature}><Ionicons name="checkmark-circle" size={20} color="#2F5D50" /><Text style={styles.modalItem}>Get a premium verified badge on your shop</Text></View>
            <View style={styles.modalFeature}><Ionicons name="checkmark-circle" size={20} color="#2F5D50" /><Text style={styles.modalItem}>Appear before free shops when distance is the same</Text></View>
            <View style={styles.modalFeature}><Ionicons name="checkmark-circle" size={20} color="#2F5D50" /><Text style={styles.modalItem}>Boost visibility with a featured banner</Text></View>
            <View style={styles.modalFeature}><Ionicons name="checkmark-circle" size={20} color="#2F5D50" /><Text style={styles.modalItem}>No open app ads</Text></View>
            <View style={styles.modalFeature}><Ionicons name="checkmark-circle" size={20} color="#2F5D50" /><Text style={styles.modalItem}>Highlight your shop with 5 cover images</Text></View>
            <View style={styles.modalFeature}><Ionicons name="checkmark-circle" size={20} color="#2F5D50" /><Text style={styles.modalItem}>Engage customers with instant notifications</Text></View>
            <TouchableOpacity style={styles.modalBtn} onPress={handlePayment} disabled={ui.upgrading}>
              {ui.upgrading ? <ActivityIndicator color="#fff" /> : <Text style={styles.modalBtnText}>Pay ₹59 / month</Text>}
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setUIKey('showUpgrade', false)} style={{ marginTop: 15 }}>
              <Text style={styles.cancelText}>Maybe Later</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* DELETE ACCOUNT MODAL */}
      <Modal 
        visible={ui.showDelete} 
        transparent 
        animationType="fade"
        onRequestClose={() => {
          if (!ui.deleteLoading) {
            setUI(prev => ({ ...prev, showDelete: false, deletePassword: '' }));
          }
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modal}>
            <View style={{
              width: 54,
              height: 54,
              borderRadius: 27,
              backgroundColor: '#FF4B4B18',
              alignItems: 'center',
              justifyContent: 'center',
              alignSelf: 'center',
              marginBottom: 16
            }}>
              <Ionicons name="warning" size={28} color="#FF4B4B" />
            </View>
            <Text style={[styles.modalTitle, { textAlign: 'center' }]}>Delete Business Account?</Text>
            <Text style={[styles.modalSub, { textAlign: 'center', lineHeight: 18, marginBottom: 20 }]}>
              This will permanently delete your store, product listings, banners, and profile data. This cannot be undone.
            </Text>
            <View style={{ width: '100%', marginBottom: 16 }}>
              <Text style={{ fontSize: 10, fontWeight: '800', color: '#666', letterSpacing: 0.5, marginBottom: 6 }}>CONFIRM PASSWORD</Text>
              <TextInput
                secureTextEntry
                placeholder="••••••••"
                placeholderTextColor="#bbb"
                value={ui.deletePassword}
                onChangeText={(txt) => setUI(prev => ({ ...prev, deletePassword: txt }))}
                style={{
                  width: '100%',
                  backgroundColor: '#F8FAF9',
                  borderWidth: 1,
                  borderColor: '#E8EFEA',
                  borderRadius: 12,
                  paddingHorizontal: 16,
                  paddingVertical: 14,
                  fontSize: 15,
                  color: '#1a1a1a',
                }}
              />
            </View>
            <View style={{ flexDirection: 'row', gap: 12, width: '100%' }}>
              <TouchableOpacity 
                style={{ flex: 1, borderWidth: 1, borderColor: '#ccc', padding: 14, borderRadius: 12, alignItems: 'center' }} 
                onPress={() => setUI(prev => ({ ...prev, showDelete: false, deletePassword: '' }))}
                disabled={ui.deleteLoading}
              >
                <Text style={{ color: '#888', fontWeight: '700' }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={{ flex: 1, backgroundColor: '#FF4B4B', padding: 14, borderRadius: 12, alignItems: 'center' }} 
                onPress={handleMerchantDeleteAccount}
                disabled={ui.deleteLoading || !ui.deletePassword.trim()}
              >
                {ui.deleteLoading ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={{ color: '#fff', fontWeight: '700' }}>Delete</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 110 }}
          refreshControl={<RefreshControl refreshing={ui.refreshing} onRefresh={() => { setUIKey('refreshing', true); fetchDashboard(); }} />}
        >
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Merchant Panel</Text>
        </View>

        <View style={styles.heroCard}>
          <View style={styles.heroTop}>
            <View style={styles.shopInitialBox}><Text style={styles.shopInitial}>{shop?.name?.[0]}</Text></View>
            <View style={{ flex: 1, marginLeft: 14 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text style={styles.shopName}>{shop?.name}</Text>
                {plan?.type === 'pro' && (
                  <View style={{ backgroundColor: '#EAB308', width: 18, height: 18, borderRadius: 9, alignItems: 'center', justifyContent: 'center', shadowColor: '#FFD700', shadowOpacity: 0.5, shadowRadius: 4, elevation: 2 }}> 
                    <Ionicons name="star" size={8} color="#FFFFFF" />
                  </View>
                )}
              </View>
              <View style={styles.categoryPill}><Text style={styles.categoryText}>{shop?.category || 'General'}</Text></View>
            </View>
          </View>
          <View style={styles.statsRow}>
            <Stat label="Followers" value={stats?.followers ?? 0} icon="people-outline" />
            <Stat label="Items" value={`${stats?.items ?? 0}`} icon="pricetags-outline" />
            <Stat label="Views (Week)" value={stats?.views ?? 0} icon="eye-outline" />
          </View>
        </View>

        <View style={[styles.planCard, plan.type === 'pro' && styles.planCardPro]}>
          <View style={styles.planHeader}>
            <View style={styles.planBadge}><Text style={styles.planBadgeText}>{plan.type?.toUpperCase()} PLAN</Text></View>
            {plan.type === 'free' && (
              <TouchableOpacity style={styles.upgradeBtn} onPress={() => setUIKey('showUpgrade', true)}>
                <Text style={styles.upgradeText}>Upgrade 🚀</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {plan.type === 'free' && (
          <View style={styles.referralCard}>
            <Text style={styles.referralTitle}>Refer & Earn Pro</Text>
            <Text style={styles.referralCodeText}>Your code: {refCode}</Text>
            <View style={styles.calcWrapper}>
              <View style={styles.progressContainer}>
                <View style={[styles.progressBar, { width: `${progress}%` }]} />
              </View>
              <Text style={styles.calcStatus}>{referral_count}/3 Friends Invited</Text>
            </View>
            <TouchableOpacity style={styles.shareFullBtn} onPress={shareReferral}>
              <Ionicons name="share-social" size={18} color="#fff" />
              <Text style={styles.shareFullText}>Invite Merchants</Text>
            </TouchableOpacity>
          </View>
        )}

        <TouchableOpacity style={styles.qrTriggerBtn} onPress={() => setUIKey('showQR', true)}>
          <Ionicons name="qr-code-outline" size={20} color="#fff" />
          <Text style={styles.qrTriggerText}>Show My Shop QR</Text>
        </TouchableOpacity>

        <View style={styles.sectionHeader}><Text style={styles.sectionTitle}>Business Settings</Text></View>
        <View style={styles.settingsCard}>
          <Setting icon="create-outline" text="Edit Shop Profile" onPress={() => router.push('/merchant/edit-shop')} />
          <Setting icon="images-outline" text="Add Shop Photos" onPress={() => router.push('/merchant/create-post')} />
          <Setting icon="trash-outline" text="Delete Account" color="#FF4B4B" onPress={() => setUIKey('showDelete', true)} />
          <Setting icon="log-out-outline" text="Logout" color="#FF4B4B" onPress={handleLogout} border={false} />
        </View>

        {/* ── FOLLOW US ── */}
        <View style={styles.sectionHeader}><Text style={styles.sectionTitle}>Follow Us</Text></View>
        <View style={styles.socialRow}>
          <TouchableOpacity
            style={[styles.socialCard, { marginRight: 10 }]}
            activeOpacity={0.85}
            onPress={() => Linking.openURL('https://www.instagram.com/mydukan.online/')}
          >
            <View style={[styles.socialIcon, { backgroundColor: '#E1306C' }]}>
              <Ionicons name="logo-instagram" size={19} color="#fff" />
            </View>
            <View>
              <Text style={styles.socialName}>Instagram</Text>
              <Text style={styles.socialHandle}>@mydukan.online</Text>
            </View>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.socialCard}
            activeOpacity={0.85}
            onPress={() => Linking.openURL('https://www.youtube.com/channel/UCL1BkfKBa89jjHgudjR8P7g')}
          >
            <View style={[styles.socialIcon, { backgroundColor: '#FF0000' }]}>
              <Ionicons name="logo-youtube" size={19} color="#fff" />
            </View>
            <View style={{ flex: 1, paddingRight: 8 }}>
              <Text style={styles.socialName}>YouTube</Text>
              <Text style={[styles.socialHandle, { fontSize: 10 }]} numberOfLines={2}>Subscribe for tutorials and many more</Text>
            </View>
          </TouchableOpacity>
        </View>

        <View style={styles.sectionHeader}><Text style={styles.sectionTitle}>Support</Text></View>
        <View style={styles.settingsCard}>
          <SupportRow icon="mail-outline" title="Help Desk" subtitle="Get assistance via email" onPress={openEmail} />
          <SupportRow icon="information-circle-outline" title="About Us" subtitle="Learn more about mydukan" onPress={() => router.push('/about')} />
        </View>

        <View style={{ marginHorizontal: 16, marginBottom: 10 }}>
          <SupportMyDukan platform="merchant" />
        </View>

      </ScrollView>
    </KeyboardAvoidingView>

      {/* FOOTER NAV */}
      <View style={styles.footer}>
        <NavBtn icon="home-outline" label="Home" onPress={() => router.push('/merchant/home')} />
        <NavBtn icon="grid-outline" label="Items" onPress={() => router.push('/merchant/items')} />
        <TouchableOpacity style={styles.addBtn} onPress={() => router.push('/merchant/create-post')} activeOpacity={0.85}>
          <Ionicons name="add" size={28} color="#fff" />
        </TouchableOpacity>
        <NavBtn icon="person" label="Profile" active />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container:        { flex: 1, backgroundColor: '#F2F5F4' },
  center:           { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header:           { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 18, paddingTop: 10 },
  headerTitle:      { fontSize: 24, fontWeight: '800', color: '#1a1a1a' },
  headerEdit:       { backgroundColor: '#E8EFEA', padding: 8, borderRadius: 12 },
  heroCard:         { backgroundColor: '#fff', marginHorizontal: 16, marginTop: 15, borderRadius: 20, padding: 18, elevation: 3 },
  heroTop:          { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  shopInitialBox:   { width: 50, height: 50, borderRadius: 12, backgroundColor: '#2F5D50', justifyContent: 'center', alignItems: 'center' },
  shopInitial:      { fontSize: 22, fontWeight: '800', color: '#fff' },
  shopName:         { fontSize: 18, fontWeight: '700', color: '#1a1a1a' },
  categoryPill:     { marginTop: 4, backgroundColor: '#E8EFEA', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 2, alignSelf: 'flex-start' },
  categoryText:     { fontSize: 11, color: '#2F5D50', fontWeight: '600' },
  statsRow:         { flexDirection: 'row', justifyContent: 'space-between', gap: 10 },
  statBox:          { flex: 1, backgroundColor: '#F8FAF9', borderRadius: 12, paddingVertical: 10, alignItems: 'center' },
  statValue:        { fontWeight: '800', fontSize: 15, color: '#1a1a1a' },
  statLabel:        { fontSize: 10, color: '#888' },
  planCard:         { backgroundColor: '#fff', marginHorizontal: 16, marginTop: 12, borderRadius: 16, padding: 16 },
  planCardPro:      { backgroundColor: '#2F5D5010', borderWidth: 1, borderColor: '#2F5D50' },
  planHeader:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  planBadge:        { backgroundColor: '#2F5D5020', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 5 },
  planBadgeText:    { fontWeight: '700', color: '#2F5D50', fontSize: 12 },
  upgradeBtn:       { backgroundColor: '#2F5D50', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10 },
  upgradeText:      { color: '#fff', fontWeight: '700', fontSize: 12 },
  referralCard:     { backgroundColor: '#fff', marginHorizontal: 16, marginTop: 12, borderRadius: 20, padding: 18 },
  referralTitle:    { fontSize: 16, fontWeight: '700', marginBottom: 8 },
  referralCodeText: { fontSize: 14, color: '#2F5D50', fontWeight: '700', marginBottom: 12 },
  calcWrapper:      { marginBottom: 15 },
  progressContainer:{ height: 8, backgroundColor: '#E8EFEA', borderRadius: 4, overflow: 'hidden', marginBottom: 8 },
  progressBar:      { height: '100%', backgroundColor: '#2F5D50' },
  calcStatus:       { fontSize: 12, fontWeight: '600', color: '#666' },
  shareFullBtn:     { backgroundColor: '#2F5D50', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 12, borderRadius: 12, gap: 8 },
  shareFullText:    { color: '#fff', fontWeight: '700' },
  qrTriggerBtn:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#1a1a1a', marginHorizontal: 16, marginTop: 12, paddingVertical: 14, borderRadius: 12 },
  qrTriggerText:    { color: '#fff', fontWeight: '700' },
  qrOverlay:        { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  qrModalCard:      { backgroundColor: '#fff', borderRadius: 20, width: '100%' },
  qrPrintable:      { alignItems: 'center', padding: 30, backgroundColor: '#fff' },
  qrTitle:          { fontSize: 18, fontWeight: '700', marginTop: 10 },
  qrShopName:       { fontSize: 14, color: '#666', marginBottom: 20 },
  qrBox:            { padding: 10 },
  qrFooter:         { marginTop: 15, fontSize: 12, color: '#aaa' },
  qrActions:        { padding: 20, gap: 10 },
  qrDownloadBtn:    { backgroundColor: '#2F5D50', padding: 15, borderRadius: 10, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 10 },
  qrDownloadText:   { color: '#fff', fontWeight: '700' },
  qrCloseBtn:       { alignItems: 'center', padding: 10 },
  qrCloseText:      { color: '#999' },
  sectionHeader:    { paddingHorizontal: 18, marginTop: 20, marginBottom: 8 },
  sectionTitle:     { fontWeight: '700', fontSize: 16 },
  settingsCard:     { backgroundColor: '#fff', marginHorizontal: 16, borderRadius: 16, overflow: 'hidden' },
  settingRow:       { flexDirection: 'row', alignItems: 'center', padding: 15, borderBottomWidth: 1, borderBottomColor: '#F0F0F0' },
  settingIconBox:   { width: 34, height: 34, borderRadius: 8, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  settingText:      { fontSize: 14, fontWeight: '600' },
  supportRow:       { flexDirection: 'row', alignItems: 'center', padding: 15 },
  supportIconBox:   { width: 34, height: 34, borderRadius: 8, backgroundColor: '#E8EFEA', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  supportTitle:     { fontSize: 14, fontWeight: '600' },
  supportSub:       { fontSize: 12, color: '#888' },
  modalOverlay:     { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 20 },
  modal:            { backgroundColor: '#fff', borderRadius: 20, padding: 25 },
  modalTitle:       { fontSize: 20, fontWeight: '800', marginBottom: 5 },
  modalSub:         { color: '#666', marginBottom: 20 },
  modalFeature:     { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  modalItem:        { fontSize: 14 },
  modalBtn:         { backgroundColor: '#2F5D50', padding: 15, borderRadius: 12, alignItems: 'center', marginTop: 10 },
  modalBtnText:     { color: '#fff', fontWeight: '700' },
  cancelText:       { textAlign: 'center', color: '#999' },

  // ── Follow Us ──
  socialRow:        { flexDirection: 'row', marginHorizontal: 16 },
  socialCard:       { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#fff', borderRadius: 14, padding: 14 },
  socialIcon:       { width: 36, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  socialName:       { fontSize: 13, fontWeight: '700', color: '#1a1a1a' },
  socialHandle:     { fontSize: 11, color: '#888', marginTop: 1 },

  footer:           { position: 'absolute', bottom: 0, width: '100%', backgroundColor: '#0F2118', flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center', paddingVertical: 10, paddingBottom: Platform.OS === 'ios' ? 24 : 16, borderTopWidth: 0.5, borderColor: 'rgba(255,255,255,0.08)', elevation: 12 },
  navTab:           { alignItems: 'center', gap: 2, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 16 },
  navTabActive:     { backgroundColor: 'rgba(255,255,255,0.08)' },
  navLabel:         { fontSize: 10, color: '#8E9A96', fontWeight: '600' },
  navLabelActive:   { fontSize: 10, color: '#00E676', fontWeight: '700' },
  addBtn:           { width: 52, height: 52, borderRadius: 26, backgroundColor: '#1b4d3e', justifyContent: 'center', alignItems: 'center', elevation: 6, shadowColor: '#1b4d3e', shadowOpacity: 0.4, shadowRadius: 8, marginBottom: 8, borderWidth: 1, borderColor: '#00E676' },
});