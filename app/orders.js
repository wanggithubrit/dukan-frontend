import React, { useState, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Linking,
  Alert,
  StatusBar
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';

const BASE_URL = 'https://dukan-backend-0cc9.onrender.com';

const C = {
  primary: '#2F5D50',
  white: '#FFFFFF',
  bg: '#F4F7F6',
  surface: '#FFFFFF',
  text: '#0D1F19',
  textMid: '#354F44',
  textSoft: '#5F7A6E',
  textMuted: '#96ADA5',
  border: '#E4EDE9',
  danger: '#E5484D',
  accent: '#17C26A',
  amber: '#D97706',
  blue: '#2563EB',
};

export default function CustomerOrders() {
  const router = useRouter();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('active'); // 'active' | 'past'

  const fetchOrders = useCallback(async () => {
    try {
      const token = (await AsyncStorage.getItem('token')) || (await AsyncStorage.getItem('access_token'));
      if (!token) {
        Alert.alert('Authentication Required', 'Please login to view your orders.');
        router.replace('/login');
        return;
      }

      const res = await fetch(`${BASE_URL}/api/customer/orders/`, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (res.status === 401) {
        Alert.alert('Session Expired', 'Please login again.');
        await AsyncStorage.clear();
        router.replace('/login');
        return;
      }

      if (res.ok) {
        const data = await res.json();
        setOrders(Array.isArray(data) ? data : []);
      }
    } catch (err) {
      console.log('Failed to fetch customer orders:', err);
    } finally {
      setLoading(false);
    }
  }, [router]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      fetchOrders();
    }, [fetchOrders])
  );

  const activeOrders = orders.filter(o => ['pending', 'accepted'].includes(o.status));
  const pastOrders = orders.filter(o => ['completed', 'rejected'].includes(o.status));
  const displayOrders = activeTab === 'active' ? activeOrders : pastOrders;

  const formatDate = (dateStr) => {
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return dateStr;
    }
  };

  const getStatusBadge = (status) => {
    let bg = '#FEF3C7';
    let text = C.amber;
    let label = 'Pending';
    let icon = 'time-outline';

    if (status === 'accepted') {
      bg = '#DBEAFE';
      text = C.blue;
      label = 'Accepted';
      icon = 'checkmark-circle-outline';
    } else if (status === 'completed') {
      bg = '#D1FAE5';
      text = C.accent;
      label = 'Completed';
      icon = 'checkmark-done-circle-outline';
    } else if (status === 'rejected') {
      bg = '#FEE2E2';
      text = C.danger;
      label = 'Rejected';
      icon = 'close-circle-outline';
    }

    return (
      <View style={[styles.badge, { backgroundColor: bg }]}>
        <Ionicons name={icon} size={11} color={text} style={{ marginRight: 3 }} />
        <Text style={[styles.badgeText, { color: text }]}>{label}</Text>
      </View>
    );
  };

  const handleCall = (phone) => {
    if (!phone) return;
    Linking.openURL(`tel:${phone}`);
  };

  const handleWhatsApp = (phone, orderId, productName, qty) => {
    if (!phone) return;
    const msg = `Hello! I placed an order with your shop for ${qty}x ${productName} (Order ID: #${orderId}). I wanted to check the status.`;
    Linking.openURL(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`);
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <StatusBar style="dark" />
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.push('/profile')} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={C.text} />
        </TouchableOpacity>
        <View>
          <Text style={styles.title}>My Orders</Text>
          <Text style={styles.subtitle}>{orders.length} order{orders.length !== 1 ? 's' : ''} total</Text>
        </View>
      </View>

      {/* Tabs */}
      <View style={styles.tabContainer}>
        <TouchableOpacity
          onPress={() => setActiveTab('active')}
          style={[styles.tabButton, activeTab === 'active' && styles.tabButtonActive]}
          activeOpacity={0.8}
        >
          <Text style={[styles.tabText, activeTab === 'active' && styles.tabTextActive]}>
            Active ({activeOrders.length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => setActiveTab('past')}
          style={[styles.tabButton, activeTab === 'past' && styles.tabButtonActive]}
          activeOpacity={0.8}
        >
          <Text style={[styles.tabText, activeTab === 'past' && styles.tabTextActive]}>
            History ({pastOrders.length})
          </Text>
        </TouchableOpacity>
      </View>

      {/* List */}
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={C.primary} size="large" />
          <Text style={styles.loadingText}>Loading order history...</Text>
        </View>
      ) : displayOrders.length === 0 ? (
        <View style={styles.emptyCard}>
          <View style={styles.emptyIconBox}>
            <Ionicons name="receipt-outline" size={32} color={C.primary} />
          </View>
          <Text style={styles.emptyTitle}>No {activeTab === 'active' ? 'active' : 'past'} orders</Text>
          <Text style={styles.emptySubtitle}>
            {activeTab === 'active'
              ? 'You do not have any ongoing order requests right now.'
              : 'You have no completed or rejected orders.'}
          </Text>
          <TouchableOpacity onPress={() => router.push('/shop/home')} style={styles.emptyBtn}>
            <Text style={styles.emptyBtnText}>SHOP NOW</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          {displayOrders.map(order => {
            const displayImage = order.item_image || 'https://placehold.co/100x100/f3f4f6/9ca3af?text=Item';
            return (
              <View key={order.id} style={styles.orderCard}>
                {/* Header */}
                <View style={styles.cardHeader}>
                  <Text style={styles.orderNumber}>ORDER #{order.id}</Text>
                  {getStatusBadge(order.status)}
                </View>

                {/* Details */}
                <View style={styles.cardBody}>
                  {/* Shop Details */}
                  <View style={styles.shopRow}>
                    <Ionicons name="storefront-outline" size={14} color={C.primary} style={{ marginRight: 6 }} />
                    <Text style={styles.shopName}>{order.shop_name || `Shop #${order.shop}`}</Text>
                  </View>

                  <Text style={styles.dateText}>
                    Ordered on {formatDate(order.created_at)}
                  </Text>

                  {/* Product Details */}
                  <View style={styles.productRow}>
                    <Image
                      source={{ uri: displayImage }}
                      style={styles.productImage}
                      placeholder="https://placehold.co/100x100/f3f4f6/9ca3af?text=Item"
                    />
                    <View style={styles.productMeta}>
                      <Text style={styles.productName} numberOfLines={2}>{order.product_name}</Text>
                      <Text style={styles.productQty}>
                        Qty: {order.quantity} × ₹{order.item_price || 0}
                      </Text>
                      <Text style={styles.totalPrice}>
                        Total: ₹{order.order_total || 0}
                      </Text>
                    </View>
                  </View>

                  {/* Delivery details / notes */}
                  <View style={styles.addressBox}>
                    {order.delivery_address ? (
                      <View style={styles.addressRow}>
                        <Ionicons name="pin-outline" size={12} color={C.textSoft} style={{ marginRight: 4, marginTop: 2 }} />
                        <Text style={styles.addressText}>{order.delivery_address}</Text>
                      </View>
                    ) : null}
                    {order.notes ? (
                      <View style={[styles.addressRow, { marginTop: 4 }]}>
                        <Ionicons name="document-text-outline" size={12} color={C.textSoft} style={{ marginRight: 4, marginTop: 2 }} />
                        <Text style={styles.addressText}>&ldquo;{order.notes}&rdquo;</Text>
                      </View>
                    ) : null}
                    <View style={[styles.addressRow, { marginTop: 4 }]}>
                      <Ionicons name="card-outline" size={12} color={C.textSoft} style={{ marginRight: 4, marginTop: 2 }} />
                      <Text style={[styles.addressText, { fontWeight: '700', color: '#D97706' }]}>
                        Payment: Cash on Delivery
                      </Text>
                    </View>
                  </View>

                  {/* Actions */}
                  <View style={styles.actionsRow}>
                    <TouchableOpacity
                      onPress={() => handleCall(order.shop_phone)}
                      style={[styles.actionBtn, styles.callBtn]}
                    >
                      <Ionicons name="call-outline" size={14} color={C.textMid} style={{ marginRight: 6 }} />
                      <Text style={styles.callBtnText}>Call</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => handleWhatsApp(order.shop_phone, order.id, order.product_name, order.quantity)}
                      style={[styles.actionBtn, styles.waBtn]}
                    >
                      <Ionicons name="logo-whatsapp" size={14} color="#15803d" style={{ marginRight: 6 }} />
                      <Text style={styles.waBtnText}>WhatsApp</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            );
          })}
        </ScrollView>
      )}

      {/* BOTTOM NAVIGATION */}
      <View style={styles.bottomNav}>
        {[
          { route: '/shop/home', icon: 'home',   iconOutline: 'home-outline',   label: 'Home'      },
          { route: '/favorites', icon: 'heart',  iconOutline: 'heart-outline',  label: 'Saved'     },
          { route: '/cart',      icon: 'cart',   iconOutline: 'cart-outline',   label: 'Cart'      },
          { route: '/profile',   icon: 'person', iconOutline: 'person-outline', label: 'Profile'   },
        ].map(tab => {
          const active = tab.route === '/profile';
          return (
            <TouchableOpacity
              key={tab.route}
              style={styles.navTab}
              onPress={() => router.push(tab.route)}
              activeOpacity={0.8}
            >
              <View style={[styles.navIconWrap, active && styles.navIconWrapActive]}>
                <Ionicons
                  name={active ? tab.icon : tab.iconOutline}
                  size={20}
                  color={active ? C.white : C.textMuted}
                />
              </View>
              <Text style={[styles.navLabel, active && styles.navLabelActive]}>{tab.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { fontSize: 12, fontWeight: '700', color: C.textSoft, marginTop: 10, letterSpacing: 0.5 },
  scroll: { paddingHorizontal: 16, paddingBottom: 100 },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: C.white,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  backBtn: {
    marginRight: 14,
    padding: 6,
    borderRadius: 8,
    backgroundColor: C.bg,
  },
  title: { fontSize: 20, fontWeight: '800', color: C.text },
  subtitle: { fontSize: 11, color: C.textSoft, marginTop: 2 },

  // Tabs
  tabContainer: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 8,
    backgroundColor: C.white,
    borderRadius: 12,
    padding: 4,
    borderWidth: 1,
    borderColor: C.border,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 10,
  },
  tabButtonActive: {
    backgroundColor: C.primary,
  },
  tabText: {
    fontSize: 12,
    fontWeight: '800',
    color: C.textSoft,
  },
  tabTextActive: {
    color: C.white,
  },

  // Empty State
  emptyCard: {
    flex: 1,
    marginHorizontal: 16,
    marginTop: 20,
    backgroundColor: C.white,
    borderRadius: 24,
    padding: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: C.border,
  },
  emptyIconBox: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#F0FDF4',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: C.text,
    marginBottom: 6,
  },
  emptySubtitle: {
    fontSize: 12,
    color: C.textSoft,
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 18,
  },
  emptyBtn: {
    backgroundColor: C.primary,
    paddingVertical: 12,
    paddingHorizontal: 28,
    borderRadius: 12,
  },
  emptyBtnText: {
    fontSize: 11,
    fontWeight: '900',
    color: C.white,
    letterSpacing: 1,
  },

  // Order Card
  orderCard: {
    backgroundColor: C.white,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: C.border,
    marginBottom: 14,
    overflow: 'hidden',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#F8FAF9',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  orderNumber: {
    fontSize: 11,
    fontWeight: '800',
    color: C.textMid,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '800',
  },
  cardBody: {
    padding: 16,
  },
  shopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  shopName: {
    fontSize: 13,
    fontWeight: '800',
    color: C.primary,
  },
  dateText: {
    fontSize: 10,
    color: C.textMuted,
    marginBottom: 12,
  },
  productRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  productImage: {
    width: 60,
    height: 60,
    borderRadius: 10,
    backgroundColor: '#F4F7F6',
    borderWidth: 1,
    borderColor: C.border,
  },
  productMeta: {
    flex: 1,
    marginLeft: 12,
  },
  productName: {
    fontSize: 12,
    fontWeight: '800',
    color: C.text,
    lineHeight: 16,
  },
  productQty: {
    fontSize: 10,
    color: C.textSoft,
    marginTop: 2,
  },
  totalPrice: {
    fontSize: 11,
    fontWeight: '800',
    color: C.text,
    marginTop: 4,
  },
  addressBox: {
    backgroundColor: C.bg,
    borderRadius: 12,
    padding: 10,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: C.border,
  },
  addressRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  addressText: {
    fontSize: 10,
    color: C.textMid,
    flex: 1,
    lineHeight: 14,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 9,
    borderRadius: 10,
    borderWidth: 1,
  },
  callBtn: {
    backgroundColor: '#F4F7F6',
    borderColor: C.border,
  },
  callBtnText: {
    fontSize: 11,
    fontWeight: '800',
    color: C.textMid,
  },
  waBtn: {
    backgroundColor: '#F0FDF4',
    borderColor: '#BBF7D0',
  },
  waBtnText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#166534',
  },

  // Bottom Navigation
  bottomNav: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 72,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    backgroundColor: 'rgba(250, 250, 247, 0.98)',
    borderTopWidth: 1,
    borderTopColor: '#E4EDE9',
    paddingBottom: 12,
  },
  navTab: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
  },
  navIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navIconWrapActive: {
    backgroundColor: '#2F5D50',
  },
  navLabel: {
    fontSize: 9,
    fontWeight: '500',
    color: C.textMuted,
    marginTop: 2,
  },
  navLabelActive: {
    color: '#2F5D50',
    fontWeight: '800',
  },
});
