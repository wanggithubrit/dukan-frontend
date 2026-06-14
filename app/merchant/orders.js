import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Linking,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const BASE_URL = 'https://dukan-backend-0cc9.onrender.com';
const { width } = Dimensions.get('window');

const C = {
  primary: '#0A5C43',
  primaryLight: '#E6F4EF',
  accent: '#17C26A',
  accentSoft: '#D1FAE5',
  white: '#FFFFFF',
  bg: '#F2F5F3',
  surface: '#FFFFFF',
  text: '#0D1F19',
  textSoft: '#5F7A6E',
  border: '#E0EAE6',
  danger: '#E5484D',
  warning: '#F5A524',
  warningBg: '#FEF3C7',
  dangerBg: '#FEE2E2',
};

const NavBtn = React.memo(({ icon, label, onPress, active }) => (
  <TouchableOpacity
    style={[styles.navTab, active && styles.navTabActive]}
    onPress={onPress}
    activeOpacity={0.7}
  >
    <Ionicons name={icon} size={22} color={active ? '#00E676' : '#8E9A96'} />
    <Text style={[styles.navLabel, active && styles.navLabelActive]}>{label}</Text>
  </TouchableOpacity>
));
NavBtn.displayName = 'NavBtn';

export default function MerchantOrders() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [plan, setPlan] = useState({ type: 'free' });
  const [orders, setOrders] = useState([]);
  const [stats, setStats] = useState({ total: 0, pending: 0, accepted: 0, rejected: 0, completed: 0, monthly: 0 });
  const [activeTab, setActiveTab] = useState('pending'); // pending, accepted, rejected, completed

  const fetchOrders = useCallback(async () => {
    try {
      const [token, user_id] = await Promise.all([
        AsyncStorage.getItem('access_token'),
        AsyncStorage.getItem('user_id')
      ]);
      
      if (!user_id) {
        setLoading(false);
        setRefreshing(false);
        return;
      }

      const userRes = await fetch(`${BASE_URL}/api/merchant/dashboard/${user_id}/`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (userRes.ok) {
        const dashboardData = await userRes.json();
        const planType = dashboardData.plan?.type || 'free';
        setPlan({ type: planType });
        
        if (!['pro', 'pro_plus'].includes(planType)) {
          setLoading(false);
          setRefreshing(false);
          return;
        }
      } else {
        setLoading(false);
        setRefreshing(false);
        return;
      }

      const ordersRes = await fetch(`${BASE_URL}/api/merchant/orders/`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (ordersRes.ok) {
        const ordersData = await ordersRes.json();
        setOrders(ordersData.orders || []);
        setStats(ordersData.stats || { total: 0, pending: 0, accepted: 0, rejected: 0, completed: 0, monthly: 0 });
      }
    } catch (err) {
      console.warn("Error fetching merchant orders:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      fetchOrders();
    }, [fetchOrders])
  );

  const handleStatusUpdate = async (orderId, newStatus) => {
    Alert.alert(
      `${newStatus.charAt(0).toUpperCase() + newStatus.slice(1)} Order`,
      `Are you sure you want to mark this order as ${newStatus}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm',
          onPress: async () => {
            try {
              const token = await AsyncStorage.getItem('access_token');
              const res = await fetch(`${BASE_URL}/api/merchant/orders/${orderId}/`, {
                method: 'PATCH',
                headers: {
                  'Content-Type': 'application/json',
                  Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({ status: newStatus })
              });
              if (res.ok) {
                Alert.alert("Success", `Order marked as ${newStatus}`);
                fetchOrders();
              } else {
                throw new Error("Failed to update status");
              }
            } catch (err) {
              Alert.alert("Error", err.message);
            }
          }
        }
      ]
    );
  };

  const handleCall = (phone) => {
    if (!phone) return;
    Linking.openURL(`tel:${phone}`).catch(() => {
      Alert.alert("Error", "Could not initiate call");
    });
  };

  const filteredOrders = orders.filter(o => o.status === activeTab);

  if (loading) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={C.primary} />
      </SafeAreaView>
    );
  }

  if (!['pro', 'pro_plus'].includes(plan.type)) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar style="dark" />
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Customer Orders</Text>
        </View>
        <ScrollView contentContainerStyle={styles.lockedScroll}>
          <View style={styles.lockedCard}>
            <View style={styles.lockedIconWrap}>
              <Ionicons name="lock-closed" size={42} color={C.primary} />
            </View>
            <Text style={styles.lockedTitle}>Upgrade to Pro</Text>
            <Text style={styles.lockedDesc}>
              The Customer Ordering Dashboard is exclusive to our premium **Pro** and **Pro Plus** tiers. Upgrade your business today to accept direct customer orders, offer delivery options, and unlock priority listing support.
            </Text>
            <TouchableOpacity 
              style={styles.lockedBtn}
              onPress={() => router.push('/merchant/profile')}
            >
              <Text style={styles.lockedBtnText}>Go to Profile & Upgrade</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
        <View style={styles.footer}>
          <NavBtn icon="home-outline" label="Home" onPress={() => router.push('/merchant/home')} />
          <NavBtn icon="grid-outline" label="Items" onPress={() => router.push('/merchant/items')} />
          <TouchableOpacity style={styles.addBtn} onPress={() => router.push('/merchant/create-post')} activeOpacity={0.85}>
            <Ionicons name="add" size={28} color="#fff" />
          </TouchableOpacity>
          <NavBtn icon="cart" label="Orders" active />
          <NavBtn icon="person-outline" label="Profile" onPress={() => router.push('/merchant/profile')} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />
      
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Order Requests</Text>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchOrders(); }} />}
      >
        <View style={styles.statsGrid}>
          <View style={styles.statCard}>
            <Text style={styles.statVal}>{stats.pending}</Text>
            <Text style={styles.statLbl}>Pending</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statVal}>{stats.completed}</Text>
            <Text style={styles.statLbl}>Completed</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statVal}>{stats.monthly}</Text>
            <Text style={styles.statLbl}>This Month</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: C.primaryLight }]}>
            <Text style={[styles.statVal, { color: C.primary }]}>{stats.total}</Text>
            <Text style={[styles.statLbl, { color: C.primary }]}>Total Orders</Text>
          </View>
        </View>

        <View style={styles.tabRow}>
          <TouchableOpacity 
            style={[styles.tab, activeTab === 'pending' && styles.tabActive]} 
            onPress={() => setActiveTab('pending')}
          >
            <Text style={[styles.tabText, activeTab === 'pending' && styles.tabTextActive]}>
              Pending ({stats.pending})
            </Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.tab, activeTab === 'accepted' && styles.tabActive]} 
            onPress={() => setActiveTab('accepted')}
          >
            <Text style={[styles.tabText, activeTab === 'accepted' && styles.tabTextActive]}>
              Accepted
            </Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.tab, activeTab === 'completed' && styles.tabActive]} 
            onPress={() => setActiveTab('completed')}
          >
            <Text style={[styles.tabText, activeTab === 'completed' && styles.tabTextActive]}>
              Completed
            </Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.tab, activeTab === 'rejected' && styles.tabActive]} 
            onPress={() => setActiveTab('rejected')}
          >
            <Text style={[styles.tabText, activeTab === 'rejected' && styles.tabTextActive]}>
              Rejected
            </Text>
          </TouchableOpacity>
        </View>

        {filteredOrders.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="cart-outline" size={48} color="#A8C5BB" />
            <Text style={styles.emptyTitle}>No orders in {activeTab}</Text>
            <Text style={styles.emptyDesc}>New requests submitted by customers will show up here.</Text>
          </View>
        ) : (
          filteredOrders.map((order) => (
            <View key={order.id} style={styles.orderCard}>
              <View style={styles.orderHeader}>
                <Text style={styles.orderId}>Order #{order.id}</Text>
                <Text style={styles.orderTime}>
                  {new Date(order.created_at).toLocaleDateString()}
                </Text>
              </View>

              <View style={styles.orderBody}>
                <Text style={styles.productName}>{order.product_name}</Text>
                <Text style={styles.quantity}>Qty: {order.quantity}</Text>

                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Customer Name:</Text>
                  <Text style={styles.detailValue}>{order.customer_name}</Text>
                </View>

                {order.delivery_address ? (
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Delivery Address:</Text>
                    <Text style={styles.detailValue}>{order.delivery_address}</Text>
                  </View>
                ) : null}

                {order.notes ? (
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Notes:</Text>
                    <Text style={styles.detailValue}>{order.notes}</Text>
                  </View>
                ) : null}
              </View>

              <View style={styles.actionsContainer}>
                {order.status === 'pending' && (
                  <>
                    <TouchableOpacity 
                      style={[styles.actionBtn, styles.rejectBtn]}
                      onPress={() => handleStatusUpdate(order.id, 'rejected')}
                    >
                      <Text style={styles.rejectBtnText}>Reject</Text>
                    </TouchableOpacity>
                    <TouchableOpacity 
                      style={[styles.actionBtn, styles.acceptBtn]}
                      onPress={() => handleStatusUpdate(order.id, 'accepted')}
                    >
                      <Text style={styles.acceptBtnText}>Accept</Text>
                    </TouchableOpacity>
                  </>
                )}

                {order.status === 'accepted' && (
                  <TouchableOpacity 
                    style={[styles.actionBtn, styles.completeBtn]}
                    onPress={() => handleStatusUpdate(order.id, 'completed')}
                  >
                    <Text style={styles.completeBtnText}>Mark Completed</Text>
                  </TouchableOpacity>
                )}

                <TouchableOpacity 
                  style={[styles.actionBtn, styles.callBtn]}
                  onPress={() => handleCall(order.customer_phone)}
                >
                  <Ionicons name="call" size={14} color="#fff" />
                  <Text style={styles.callBtnText}>Call Customer</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))
        )}
      </ScrollView>

      <View style={styles.footer}>
        <NavBtn icon="home-outline" label="Home" onPress={() => router.push('/merchant/home')} />
        <NavBtn icon="grid-outline" label="Items" onPress={() => router.push('/merchant/items')} />
        <TouchableOpacity style={styles.addBtn} onPress={() => router.push('/merchant/create-post')} activeOpacity={0.85}>
          <Ionicons name="add" size={28} color="#fff" />
        </TouchableOpacity>
        <NavBtn icon="cart" label="Orders" active />
        <NavBtn icon="person-outline" label="Profile" onPress={() => router.push('/merchant/profile')} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: C.bg },
  
  header: {
    height: 56,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
    backgroundColor: C.white,
    justifyContent: 'center'
  },
  headerTitle: { fontSize: 18, fontWeight: '800', color: C.text },

  scrollContent: { padding: 16, paddingBottom: 110 },
  
  lockedScroll: { flexGrow: 1, justifyContent: 'center', padding: 24, paddingBottom: 120 },
  lockedCard: {
    backgroundColor: C.white,
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    shadowColor: C.primary,
    shadowOpacity: 0.08,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4
  },
  lockedIconWrap: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: C.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20
  },
  lockedTitle: { fontSize: 20, fontWeight: '800', color: C.text, marginBottom: 12 },
  lockedDesc: { fontSize: 14, color: C.textSoft, textAlign: 'center', lineHeight: 22, marginBottom: 24 },
  lockedBtn: {
    backgroundColor: C.primary,
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 12,
    alignSelf: 'stretch',
    alignItems: 'center'
  },
  lockedBtnText: { color: C.white, fontSize: 15, fontWeight: '700' },

  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 20 },
  statCard: {
    flex: 1,
    minWidth: (width - 42) / 2,
    backgroundColor: C.white,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: C.border,
    shadowColor: '#000',
    shadowOpacity: 0.02,
    shadowRadius: 4,
    elevation: 1
  },
  statVal: { fontSize: 22, fontWeight: '800', color: C.text, marginBottom: 4 },
  statLbl: { fontSize: 11, fontWeight: '600', color: C.textSoft },

  tabRow: {
    flexDirection: 'row',
    backgroundColor: C.white,
    borderRadius: 12,
    padding: 4,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: C.border
  },
  tab: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 8 },
  tabActive: { backgroundColor: C.primaryLight },
  tabText: { fontSize: 12, fontWeight: '600', color: C.textSoft },
  tabTextActive: { color: C.primary, fontWeight: '800' },

  emptyContainer: {
    backgroundColor: C.white,
    borderRadius: 16,
    padding: 32,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: C.border,
    marginTop: 20
  },
  emptyTitle: { fontSize: 16, fontWeight: '800', color: C.text, marginTop: 12, marginBottom: 4 },
  emptyDesc: { fontSize: 12, color: C.textSoft, textAlign: 'center', lineHeight: 18 },

  orderCard: {
    backgroundColor: C.white,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: C.border,
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2
  },
  orderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: C.border
  },
  orderId: { fontSize: 14, fontWeight: '800', color: C.primary },
  orderTime: { fontSize: 12, color: C.textSoft },

  orderBody: { paddingVertical: 12 },
  productName: { fontSize: 16, fontWeight: '800', color: C.text, marginBottom: 4 },
  quantity: { fontSize: 13, fontWeight: '600', color: C.textSoft, marginBottom: 12 },
  detailRow: { flexDirection: 'row', marginBottom: 6 },
  detailLabel: { width: 120, fontSize: 12, color: C.textSoft },
  detailValue: { flex: 1, fontSize: 12, fontWeight: '600', color: C.text },

  actionsContainer: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: C.border
  },
  actionBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 4
  },
  rejectBtn: { backgroundColor: C.dangerBg, borderWidth: 1, borderColor: C.danger },
  rejectBtnText: { color: C.danger, fontWeight: '700', fontSize: 12 },
  acceptBtn: { backgroundColor: C.primary },
  acceptBtnText: { color: C.white, fontWeight: '700', fontSize: 12 },
  completeBtn: { backgroundColor: C.accentSoft, borderWidth: 1, borderColor: C.accent },
  completeBtnText: { color: C.accent, fontWeight: '700', fontSize: 12 },
  callBtn: { backgroundColor: C.primary },
  callBtnText: { color: C.white, fontWeight: '700', fontSize: 12 },

  footer:           { position: 'absolute', bottom: 0, width: '100%', backgroundColor: '#0F2118', flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center', paddingVertical: 10, paddingBottom: Platform.OS === 'ios' ? 24 : 16, borderTopWidth: 0.5, borderColor: 'rgba(255,255,255,0.08)', elevation: 12 },
  navTab:           { alignItems: 'center', gap: 2, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 16 },
  navTabActive:     { backgroundColor: 'rgba(255,255,255,0.08)' },
  navLabel:         { fontSize: 10, color: '#8E9A96', fontWeight: '600' },
  navLabelActive:   { fontSize: 10, color: '#00E676', fontWeight: '700' },
  addBtn:           { width: 52, height: 52, borderRadius: 26, backgroundColor: '#1b4d3e', justifyContent: 'center', alignItems: 'center', elevation: 6, shadowColor: '#1b4d3e', shadowOpacity: 0.4, shadowRadius: 8, marginBottom: 8, borderWidth: 1, borderColor: '#00E676' }
});
