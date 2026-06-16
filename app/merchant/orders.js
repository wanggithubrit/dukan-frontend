import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useCallback, useState } from 'react';
import { Image } from 'expo-image';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Image as RNImage,
  Linking,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Print from 'expo-print';

const BASE_URL = 'https://dukan-backend-0cc9.onrender.com';
const { width } = Dimensions.get('window');

const getImageUrl = (path) => {
  if (!path) return 'https://via.placeholder.com/150';
  const isLocal = path.includes('localhost') || path.includes('127.0.0.1') || path.includes('10.14.104.206');
  if (path.startsWith('http://') && !isLocal) {
    path = path.replace('http://', 'https://');
  }
  if (path.startsWith('http')) {
    const isBaseProd = BASE_URL.includes('onrender.com') || BASE_URL.includes('mydukan.online');
    if (isLocal && isBaseProd) {
      const pathPart = path.replace(/^https?:\/\/[^\/]+/, '');
      return `${BASE_URL}/${pathPart.replace(/^\/+/, '')}`;
    }
    return path;
  }
  return `${BASE_URL}${path.startsWith('/') ? '' : '/'}${path}`;
};

const hasGPS = (order) => {
  if (!order) return false;
  const lat = order.customer_latitude;
  const lon = order.customer_longitude;
  if (lat === null || lat === undefined || lat === '' || lat === 'null' || lat === 'None') return false;
  if (lon === null || lon === undefined || lon === '' || lon === 'null' || lon === 'None') return false;
  const numLat = parseFloat(lat);
  const numLon = parseFloat(lon);
  return !isNaN(numLat) && !isNaN(numLon) && (numLat !== 0 || numLon !== 0);
};

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
  const [searchQuery, setSearchQuery] = useState('');

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

  const handlePrintReceipt = async (order) => {
    const htmlContent = `
      <html>
        <head>
          <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, minimum-scale=1.0, user-scalable=no" />
          <style>
            body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; padding: 24px; color: #0D1F19; background: #fff; }
            .header { border-bottom: 3px solid #0A5C43; padding-bottom: 16px; margin-bottom: 24px; text-align: center; }
            .title { font-size: 26px; font-weight: 800; color: #0A5C43; margin: 0; }
            .subtitle { font-size: 14px; color: #5F7A6E; margin-top: 4px; }
            .section { margin-bottom: 24px; }
            .section-title { font-size: 16px; font-weight: 700; color: #0A5C43; border-bottom: 1px solid #E0EAE6; padding-bottom: 6px; margin-bottom: 12px; text-transform: uppercase; }
            .row { display: flex; justify-content: space-between; margin-bottom: 8px; font-size: 14px; }
            .label { font-weight: 600; color: #5F7A6E; }
            .val { font-weight: 700; color: #0D1F19; text-align: right; }
            .footer { margin-top: 48px; text-align: center; font-size: 12px; color: #5F7A6E; border-top: 1px solid #E0EAE6; padding-top: 16px; }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="title">ORDER RECEIPT</div>
            <div class="subtitle">Order #${order.id} &bull; ${new Date(order.created_at).toLocaleString()}</div>
          </div>
          <div class="section">
            <div class="section-title">Shop Details</div>
            <div class="row"><span class="label">Shop Name</span><span class="val">${order.shop_name || 'N/A'}</span></div>
            ${order.shop_phone ? `<div class="row"><span class="label">Phone</span><span class="val">${order.shop_phone}</span></div>` : ''}
            ${order.shop_address ? `<div class="row"><span class="label">Address</span><span class="val">${order.shop_address}</span></div>` : ''}
          </div>
          <div class="section">
            <div class="section-title">Item Details</div>
            <div class="row"><span class="label">Product Name</span><span class="val">${order.product_name}</span></div>
            <div class="row"><span class="label">Quantity</span><span class="val">${order.quantity}</span></div>
          </div>
          <div class="section">
            <div class="section-title">Customer Details</div>
            <div class="row"><span class="label">Name</span><span class="val">${order.customer_name}</span></div>
            <div class="row"><span class="label">Phone</span><span class="val">${order.customer_phone}</span></div>
            <div class="row"><span class="label">Delivery Address</span><span class="val">${order.delivery_address || 'N/A'}</span></div>
            <div class="row"><span class="label">Notes</span><span class="val">${order.notes || 'N/A'}</span></div>
            ${hasGPS(order) ? `<div class="row"><span class="label">Coordinates</span><span class="val">${order.customer_latitude}, ${order.customer_longitude}</span></div>` : ''}
          </div>
          ${hasGPS(order) ? `
          <div class="section" style="text-align: center; margin-top: 20px;">
            <div class="section-title" style="text-align: left;">Customer GPS Location</div>
            <div style="margin-top: 12px; display: flex; flex-direction: column; align-items: center; justify-content: center;">
              <img src="https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(`https://www.google.com/maps/search/?api=1&query=${order.customer_latitude},${order.customer_longitude}`)}" width="150" height="150" style="border: 1px solid #E0EAE6; padding: 4px; border-radius: 4px;" />
              <div style="font-size: 12px; color: #5F7A6E; margin-top: 8px; font-weight: 600;">Scan QR Code to navigate to delivery address</div>
              <div style="font-size: 11px; color: #8E9A96; margin-top: 4px;">(${order.customer_latitude}, ${order.customer_longitude})</div>
            </div>
          </div>
          ` : ''}
          <div class="footer">
            Thank you for using Dukan App!
          </div>
        </body>
      </html>
    `;
    try {
      await Print.printAsync({ html: htmlContent });
    } catch (err) {
      Alert.alert("Print Error", err.message);
    }
  };

  const handleDeleteOrder = async (orderId) => {
    Alert.alert(
      "Delete Order",
      "Are you sure you want to delete this order request from your history?",
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const token = await AsyncStorage.getItem('access_token');
              const res = await fetch(`${BASE_URL}/api/merchant/orders/${orderId}/`, {
                method: 'DELETE',
                headers: {
                  Authorization: `Bearer ${token}`
                }
              });
              if (res.ok) {
                Alert.alert("Success", "Order request deleted");
                fetchOrders();
              } else {
                throw new Error("Failed to delete order");
              }
            } catch (err) {
              Alert.alert("Error", err.message);
            }
          }
        }
      ]
    );
  };

  const handleClearHistory = () => {
    Alert.alert(
      "Clear Order History",
      "Are you sure you want to permanently delete all order history from this shop?",
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear All',
          style: 'destructive',
          onPress: async () => {
            try {
              const token = await AsyncStorage.getItem('access_token');
              const res = await fetch(`${BASE_URL}/api/merchant/orders/`, {
                method: 'DELETE',
                headers: {
                  Authorization: `Bearer ${token}`
                }
              });
              if (res.ok) {
                Alert.alert("Success", "Order history cleared");
                fetchOrders();
              } else {
                throw new Error("Failed to clear history");
              }
            } catch (err) {
              Alert.alert("Error", err.message);
            }
          }
        }
      ]
    );
  };

  const filteredOrders = orders.filter(o => {
    const matchesTab = o.status === activeTab;
    if (!matchesTab) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        o.customer_name?.toLowerCase().includes(q) ||
        o.customer_phone?.toLowerCase().includes(q) ||
        o.product_name?.toLowerCase().includes(q) ||
        o.delivery_address?.toLowerCase().includes(q) ||
        o.notes?.toLowerCase().includes(q)
      );
    }
    return true;
  });

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
      
      <View style={[styles.header, { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }]}>
        <Text style={styles.headerTitle}>Order Requests</Text>
        {orders.length > 0 ? (
          <TouchableOpacity 
            onPress={handleClearHistory} 
            style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 4, paddingHorizontal: 8 }}
            activeOpacity={0.7}
          >
            <Ionicons name="trash-outline" size={14} color={C.danger} />
            <Text style={{ fontSize: 13, color: C.danger, fontWeight: '700' }}>Clear All</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchOrders(); }} />}
      >
        {true && (
          <View style={styles.searchContainer}>
            <Ionicons name="search" size={18} color={C.textSoft} style={{ marginRight: 8 }} />
            <TextInput
              placeholder="Search orders by name, phone, item..."
              placeholderTextColor={C.textSoft}
              value={searchQuery}
              onChangeText={setSearchQuery}
              style={styles.searchInput}
            />
            {searchQuery ? (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <Ionicons name="close-circle" size={16} color={C.textSoft} />
              </TouchableOpacity>
            ) : null}
          </View>
        )}

        <View style={styles.statsGrid}>
          <View style={styles.statCard}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <Text style={styles.statVal}>{stats.pending}</Text>
              <Ionicons name="time-outline" size={18} color={C.warning} />
            </View>
            <Text style={styles.statLbl}>Pending</Text>
          </View>
          <View style={styles.statCard}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <Text style={styles.statVal}>{stats.completed}</Text>
              <Ionicons name="checkmark-circle-outline" size={18} color={C.accent} />
            </View>
            <Text style={styles.statLbl}>Completed</Text>
          </View>
          <View style={styles.statCard}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <Text style={styles.statVal}>{stats.monthly}</Text>
              <Ionicons name="calendar-outline" size={18} color="#3B82F6" />
            </View>
            <Text style={styles.statLbl}>This Month</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: C.primaryLight, borderColor: '#B3DFD2' }]}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <Text style={[styles.statVal, { color: C.primary }]}>{stats.total}</Text>
              <Ionicons name="cart-outline" size={18} color={C.primary} />
            </View>
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
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Text style={styles.orderId}>Order #{order.id}</Text>
                  <View style={[styles.statusBadge, styles[`badge_${order.status}`]]}>
                    <Text style={[styles.statusBadgeText, styles[`badgeText_${order.status}`]]}>
                      {order.status.toUpperCase()}
                    </Text>
                  </View>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <Text style={styles.orderTime}>
                    {new Date(order.created_at).toLocaleDateString()}
                  </Text>
                  <TouchableOpacity 
                    onPress={() => handleDeleteOrder(order.id)}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="trash-outline" size={16} color={C.danger} />
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.orderBody}>
                <View style={{ flexDirection: 'row', gap: 12, marginBottom: 16, alignItems: 'center' }}>
                  {order.item_image ? (
                    <Image 
                      source={{ uri: getImageUrl(order.item_image) }}
                      style={styles.itemImage}
                      contentFit="cover"
                    />
                  ) : (
                    <View style={styles.itemPlaceholder}>
                      <Ionicons name="image-outline" size={20} color={C.textSoft} />
                    </View>
                  )}
                  <View style={{ flex: 1 }}>
                    <Text style={styles.productName}>{order.product_name}</Text>
                    <Text style={styles.quantity}>Qty: {order.quantity}</Text>
                  </View>
                </View>

                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                  <View style={{ flex: 1 }}>
                    <View style={styles.detailRow}>
                      <Ionicons name="person-outline" size={15} color={C.textSoft} style={{ marginRight: 8, marginTop: 1 }} />
                      <Text style={styles.detailLabel}>Customer:</Text>
                      <Text style={styles.detailValue}>{order.customer_name}</Text>
                    </View>
                    <View style={styles.detailRow}>
                      <Ionicons name="card-outline" size={15} color={C.textSoft} style={{ marginRight: 8, marginTop: 1 }} />
                      <Text style={styles.detailLabel}>Payment:</Text>
                      <Text style={[styles.detailValue, { fontWeight: 'bold', color: '#D97706' }]}>
                        Cash on Delivery
                      </Text>
                    </View>
                    {order.delivery_address ? (
                      <View style={styles.detailRow}>
                        <Ionicons name="location-outline" size={15} color={C.textSoft} style={{ marginRight: 8, marginTop: 1 }} />
                        <Text style={styles.detailLabel}>Address:</Text>
                        <Text style={styles.detailValue}>{order.delivery_address}</Text>
                      </View>
                    ) : null}

                    {order.notes ? (
                      <View style={styles.detailRow}>
                        <Ionicons name="document-text-outline" size={15} color={C.textSoft} style={{ marginRight: 8, marginTop: 1 }} />
                        <Text style={styles.detailLabel}>Notes:</Text>
                        <Text style={styles.detailValue}>{order.notes}</Text>
                      </View>
                    ) : null}

                    {hasGPS(order) ? (
                      <View style={[styles.detailRow, { alignItems: 'flex-start' }]}>
                        <Ionicons name="navigate-outline" size={15} color={C.textSoft} style={{ marginRight: 8, marginTop: 2 }} />
                        <Text style={styles.detailLabel}>Coordinates:</Text>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.detailValue}>{order.customer_latitude || 'N/A'}, {order.customer_longitude || 'N/A'}</Text>
                          <TouchableOpacity 
                            style={[styles.pinBtn, { marginTop: 5, alignSelf: 'flex-start' }]}
                            onPress={() => {
                              const url = `https://www.google.com/maps/search/?api=1&query=${order.customer_latitude},${order.customer_longitude}`;
                              Linking.openURL(url).catch(() => Alert.alert("Error", "Could not open map"));
                            }}
                            activeOpacity={0.7}
                          >
                            <Ionicons name="location-outline" size={12} color="#0A5C43" />
                            <Text style={styles.pinBtnText}>Locate</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    ) : null}
                  </View>

                  {hasGPS(order) && (
                    <TouchableOpacity
                      onPress={() => {
                        const url = `https://www.google.com/maps/search/?api=1&query=${order.customer_latitude},${order.customer_longitude}`;
                        Linking.openURL(url).catch(() => Alert.alert("Error", "Could not open map"));
                      }}
                      activeOpacity={0.8}
                      style={styles.listQrContainer}
                    >
                      <RNImage
                        source={{ uri: `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(`https://www.google.com/maps/search/?api=1&query=${order.customer_latitude},${order.customer_longitude}`)}` }}
                        style={styles.listQrImage}
                      />
                      <Text style={styles.listQrHint}>Scan GPS</Text>
                    </TouchableOpacity>
                  )}
                </View>
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

              {true && (
                <View style={[styles.actionsContainer, { borderTopWidth: 0, marginTop: 4, paddingTop: 0 }]}>
                  <TouchableOpacity 
                    style={[styles.actionBtn, styles.printBtn]}
                    onPress={() => handlePrintReceipt(order)}
                  >
                    <Ionicons name="print-outline" size={14} color="#0A5C43" style={{ marginRight: 2 }} />
                    <Text style={styles.printBtnText}>Print Receipt</Text>
                  </TouchableOpacity>
                  {hasGPS(order) ? (
                    <TouchableOpacity 
                      style={[styles.actionBtn, styles.routeBtn]}
                      onPress={() => {
                        const url = `https://www.google.com/maps/dir/?api=1&destination=${order.customer_latitude},${order.customer_longitude}`;
                        Linking.openURL(url).catch(() => Alert.alert("Error", "Could not open navigation directions"));
                      }}
                    >
                      <Ionicons name="map-outline" size={14} color="#fff" style={{ marginRight: 2 }} />
                      <Text style={styles.routeBtnText}>Route Map</Text>
                    </TouchableOpacity>
                  ) : (
                    <View style={[styles.actionBtn, styles.routeBtnDisabled]}>
                      <Ionicons name="map-outline" size={14} color="#A8C5BB" style={{ marginRight: 2 }} />
                      <Text style={styles.routeBtnTextDisabled}>No GPS Shared</Text>
                    </View>
                  )}
                </View>
              )}
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
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2
  },
  statVal: { fontSize: 22, fontWeight: '800', color: C.text },
  statLbl: { fontSize: 11, fontWeight: '600', color: C.textSoft, marginTop: 4 },

  tabRow: {
    flexDirection: 'row',
    backgroundColor: C.white,
    borderRadius: 12,
    padding: 4,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: C.border,
    shadowColor: '#000',
    shadowOpacity: 0.02,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2
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
    shadowOpacity: 0.04,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3
  },
  orderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: C.border
  },
  orderId: { fontSize: 14, fontWeight: '800', color: C.primary },
  orderTime: { fontSize: 12, color: C.textSoft },

  orderBody: { paddingVertical: 12 },
  productName: { fontSize: 16, fontWeight: '800', color: C.text, marginBottom: 4 },
  quantity: { fontSize: 13, fontWeight: '600', color: C.textSoft, marginBottom: 12 },
  detailRow: { flexDirection: 'row', marginBottom: 8, alignItems: 'flex-start' },
  detailLabel: { width: 100, fontSize: 12, fontWeight: '600', color: C.textSoft },
  detailValue: { flex: 1, fontSize: 12, fontWeight: '600', color: C.text, lineHeight: 16 },

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
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.white,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: C.border,
    shadowColor: '#000',
    shadowOpacity: 0.02,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: C.text,
    padding: 0
  },
  printBtn: {
    backgroundColor: C.primaryLight,
    borderWidth: 1,
    borderColor: C.primary
  },
  printBtnText: {
    color: C.primary,
    fontWeight: '700',
    fontSize: 12
  },
  routeBtn: {
    backgroundColor: C.primary
  },
  routeBtnText: {
    color: C.white,
    fontWeight: '700',
    fontSize: 12
  },
  itemImage: {
    width: 50,
    height: 50,
    borderRadius: 8,
    backgroundColor: '#f0f3f1'
  },
  itemPlaceholder: {
    width: 50,
    height: 50,
    borderRadius: 8,
    backgroundColor: '#e0eae6',
    justifyContent: 'center',
    alignItems: 'center'
  },
  pinBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.primaryLight,
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 6,
    borderWidth: 0.5,
    borderColor: C.primary,
    gap: 2
  },
  pinBtnText: {
    fontSize: 10,
    fontWeight: '700',
    color: C.primary
  },
  routeBtnDisabled: {
    backgroundColor: '#E0EAE6',
    borderWidth: 1,
    borderColor: '#C8D5D0'
  },
  routeBtnTextDisabled: {
    color: '#8E9A96',
    fontWeight: '700',
    fontSize: 12
  },

  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusBadgeText: {
    fontSize: 9,
    fontWeight: '850',
    letterSpacing: 0.5,
  },
  badge_pending: { backgroundColor: C.warningBg },
  badgeText_pending: { color: '#C05621' },
  badge_accepted: { backgroundColor: C.accentSoft },
  badgeText_accepted: { color: '#047857' },
  badge_completed: { backgroundColor: C.primaryLight },
  badgeText_completed: { color: C.primary },
  badge_rejected: { backgroundColor: C.dangerBg },
  badgeText_rejected: { color: C.danger },

  listQrContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#E8EFEF',
    borderRadius: 10,
    padding: 6,
    shadowColor: '#000',
    shadowOpacity: 0.02,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  listQrImage: {
    width: 64,
    height: 64,
    borderRadius: 6,
  },
  listQrHint: {
    fontSize: 8,
    fontWeight: '800',
    color: '#0A5C43',
    marginTop: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5
  },

  footer:           { position: 'absolute', bottom: 0, width: '100%', backgroundColor: '#0F2118', flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center', paddingVertical: 10, paddingBottom: Platform.OS === 'ios' ? 24 : 16, borderTopWidth: 0.5, borderColor: 'rgba(255,255,255,0.08)', elevation: 12 },
  navTab:           { alignItems: 'center', gap: 2, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 16 },
  navTabActive:     { backgroundColor: 'rgba(255,255,255,0.08)' },
  navLabel:         { fontSize: 10, color: '#8E9A96', fontWeight: '600' },
  navLabelActive:   { fontSize: 10, color: '#00E676', fontWeight: '700' },
  addBtn:           { width: 52, height: 52, borderRadius: 26, backgroundColor: '#1b4d3e', justifyContent: 'center', alignItems: 'center', elevation: 6, shadowColor: '#1b4d3e', shadowOpacity: 0.4, shadowRadius: 8, marginBottom: 8, borderWidth: 1, borderColor: '#00E676' }
});
