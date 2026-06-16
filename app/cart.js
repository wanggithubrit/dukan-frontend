import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';
import { Image } from 'expo-image';
import * as Location from 'expo-location';
import { usePathname, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const BASE_URL = 'https://dukan-backend-0cc9.onrender.com';

const C = {
  primary: '#2F5D50',
  primaryDark: '#1E3E35',
  white: '#FFFFFF',
  bg: '#F4F7F6',
  surface: '#FFFFFF',
  text: '#0D1F19',
  textMid: '#354F44',
  textSoft: '#5F7A6E',
  textMuted: '#96ADA5',
  border: '#E0EAE6',
  danger: '#E5484D',
  accent: '#17C26A',
  accentSoft: '#D1FAE5',
};

export default function Cart() {
  const router = useRouter();
  const pathname = usePathname();

  const [globalCart, setGlobalCart] = useState([]);
  const [checkoutForm, setCheckoutForm] = useState({
    name: '',
    phone: '',
    address: '',
    notes: '',
    lat: '',
    lon: '',
    paymentMethod: 'COD',
    submitting: false,
  });
  const [collapsedShops, setCollapsedShops] = useState({});
  const [loading, setLoading] = useState(true);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  // Load cart and check auth status on focus
  useFocusEffect(
    useCallback(() => {
      const initialize = async () => {
        try {
          const token = (await AsyncStorage.getItem('token')) || (await AsyncStorage.getItem('access_token'));
          if (!token) {
            Alert.alert('Authentication Required', 'Please login to view your cart.');
            router.replace('/login');
            return;
          }
          setIsLoggedIn(true);

          const stored = await AsyncStorage.getItem('dukan_cart');
          const parsed = stored ? JSON.parse(stored) : [];
          const cartList = Array.isArray(parsed) ? parsed : [];
          setGlobalCart(cartList);

          // Pre-populate form from profile
          const userId = await AsyncStorage.getItem('user_id');
          let savedName = '';
          let savedPhone = '';
          let savedAddress = '';

          if (userId) {
            try {
              const res = await fetch(`${BASE_URL}/api/user/${userId}/`);
              if (res.ok) {
                const data = await res.json();
                savedName = data.name || '';
                savedPhone = data.phone || '';
                savedAddress = data.address || '';
              }
            } catch (err) {
              console.log('Error fetching user details on cart init:', err);
            }
          }

          if (!savedName) savedName = (await AsyncStorage.getItem('cust_name')) || '';
          if (!savedPhone) savedPhone = (await AsyncStorage.getItem('cust_phone')) || '';

          setCheckoutForm(prev => ({
            ...prev,
            name: prev.name || savedName,
            phone: prev.phone || savedPhone,
            address: prev.address || savedAddress,
          }));

        } catch (e) {
          console.log('Error initializing cart screen:', e);
        } finally {
          setLoading(false);
        }
      };

      initialize();
    }, [router])
  );

  const saveCart = async (newCart) => {
    setGlobalCart(newCart);
    try {
      await AsyncStorage.setItem('dukan_cart', JSON.stringify(newCart));
    } catch (e) {
      console.log('Error saving dukan_cart:', e);
    }
  };

  const handleUpdateQty = (shopId, itemId, change) => {
    const nextCart = globalCart.map(entry => {
      if (entry.shop.id === shopId) {
        const updatedItems = entry.items.map(itemEntry => {
          if (itemEntry.item.id === itemId) {
            const nextQty = itemEntry.quantity + change;
            if (nextQty <= 0) return null;
            return { ...itemEntry, quantity: nextQty };
          }
          return itemEntry;
        }).filter(Boolean);

        if (updatedItems.length === 0) return null;
        return { ...entry, items: updatedItems };
      }
      return entry;
    }).filter(Boolean);

    saveCart(nextCart);
  };

  const handleRemoveItem = (shopId, itemId) => {
    const nextCart = globalCart.map(entry => {
      if (entry.shop.id === shopId) {
        const updatedItems = entry.items.filter(itemEntry => itemEntry.item.id !== itemId);
        if (updatedItems.length === 0) return null;
        return { ...entry, items: updatedItems };
      }
      return entry;
    }).filter(Boolean);

    saveCart(nextCart);
  };

  const handleInputChange = (field, value) => {
    setCheckoutForm(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleGetLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Location permission is required.');
        return;
      }
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      handleInputChange('lat', String(loc.coords.latitude));
      handleInputChange('lon', String(loc.coords.longitude));
      Alert.alert('Location Captured', 'GPS coordinates saved successfully! 📍');
    } catch (e) {
      Alert.alert('Error', 'Could not fetch GPS coordinates.');
    }
  };

  const toggleShopCollapse = (shopId) => {
    setCollapsedShops(prev => ({
      ...prev,
      [shopId]: !prev[shopId]
    }));
  };

  const handlePlaceAllOrders = async () => {
    if (!checkoutForm.name?.trim()) {
      Alert.alert('Validation Error', 'Name is required.');
      return;
    }
    if (!checkoutForm.phone?.trim()) {
      Alert.alert('Validation Error', 'Phone number is required.');
      return;
    }

    const needsAddress = globalCart.some(entry => entry.shop.delivery_available);
    if (needsAddress && !checkoutForm.address?.trim()) {
      Alert.alert('Validation Error', 'Delivery address is required.');
      return;
    }

    if (!checkoutForm.lat || !checkoutForm.lon || !String(checkoutForm.lat).trim() || !String(checkoutForm.lon).trim()) {
      Alert.alert('Validation Error', 'Please share your exact GPS location to place the order.');
      return;
    }

    try {
      setCheckoutForm(prev => ({ ...prev, submitting: true }));

      const token = (await AsyncStorage.getItem('token')) || (await AsyncStorage.getItem('access_token'));
      let successCount = 0;
      let totalItemsCount = 0;

      const promises = [];
      globalCart.forEach(entry => {
        const shopId = entry.shop.id;
        entry.items.forEach(itemEntry => {
          totalItemsCount++;
          const body = {
            shop_id: shopId,
            item_id: itemEntry.item.id,
            quantity: itemEntry.quantity,
            customer_name: checkoutForm.name.trim(),
            customer_phone: checkoutForm.phone.trim(),
            delivery_address: checkoutForm.address?.trim() || '',
            notes: checkoutForm.notes?.trim() || '',
            customer_latitude: checkoutForm.lat?.trim() ? parseFloat(checkoutForm.lat) : null,
            customer_longitude: checkoutForm.lon?.trim() ? parseFloat(checkoutForm.lon) : null,
            payment_method: 'COD',
          };

          promises.push(
            fetch(`${BASE_URL}/api/orders/`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
              },
              body: JSON.stringify(body),
            }).then(res => {
              if (res.ok) successCount++;
            }).catch(err => {
              console.log('Error placing order item:', err);
            })
          );
        });
      });

      await Promise.all(promises);

      await AsyncStorage.setItem('cust_name', checkoutForm.name.trim());
      await AsyncStorage.setItem('cust_phone', checkoutForm.phone.trim());

      if (successCount === totalItemsCount) {
        Alert.alert('Orders Placed! 🎉', 'Successfully placed all orders.', [
          { text: 'OK', onPress: () => router.push('/orders') }
        ]);
        saveCart([]);
      } else if (successCount > 0) {
        Alert.alert('Partially Successful', `Placed ${successCount} of ${totalItemsCount} orders successfully.`, [
          { text: 'OK', onPress: () => router.push('/orders') }
        ]);
        saveCart([]);
      } else {
        Alert.alert('Connection Error', 'Failed to place orders. Please try again.');
      }
    } catch (e) {
      console.log('Error placing orders:', e);
      Alert.alert('Error', 'An error occurred while placing orders.');
    } finally {
      setCheckoutForm(prev => ({ ...prev, submitting: false }));
    }
  };

  const getImageUrl = (img) => {
    if (!img) return 'https://placehold.co/100x100/e0e0e0/aaaaaa?text=Item';
    if (img.startsWith('http')) return img;
    return `${BASE_URL}/${img.replace(/^\/+/, '')}`;
  };

  if (loading || !isLoggedIn) {
    return (
      <SafeAreaView style={styles.safe}>
        <StatusBar style="dark" />
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={C.primary} />
        </View>
      </SafeAreaView>
    );
  }

  // Calculations
  const totalItemsCount = globalCart.reduce((sum, entry) => {
    return sum + entry.items.reduce((itemSum, itemEntry) => itemSum + itemEntry.quantity, 0);
  }, 0);

  const itemsSubtotal = globalCart.reduce((sum, entry) => {
    return sum + entry.items.reduce((itemSum, itemEntry) => itemSum + (itemEntry.item.price || 0) * itemEntry.quantity, 0);
  }, 0);

  const totalDeliveryCharges = globalCart.reduce((sum, entry) => {
    if (entry.shop.delivery_available && entry.shop.delivery_charge) {
      const parsed = parseFloat(entry.shop.delivery_charge);
      return sum + (isNaN(parsed) ? 0 : parsed);
    }
    return sum;
  }, 0);

  const hasTextDeliveryCharges = globalCart.some(entry => {
    if (!entry.shop.delivery_available) return false;
    const parsed = parseFloat(entry.shop.delivery_charge);
    return isNaN(parsed) && entry.shop.delivery_charge;
  });

  const grandTotal = itemsSubtotal + totalDeliveryCharges;



  const formatDeliveryCharge = (charge) => {
    if (!charge) return 'Free';
    const parsed = parseFloat(charge);
    if (isNaN(parsed)) return charge;
    return `₹${charge}`;
  };

  return (
    <SafeAreaView edges={['top']} style={styles.safe}>
      <StatusBar style="dark" />

      {/* HEADER */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.replace('/shop/home')} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={20} color={C.text} />
        </TouchableOpacity>

        <View>
          <Text style={styles.headerTitle}>My Cart</Text>
          <Text style={styles.headerSub}>
            {totalItemsCount} item{totalItemsCount !== 1 ? 's' : ''} in cart
          </Text>
        </View>

        <View style={{ width: 40 }} />
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 110 }}
        >
          {globalCart.length === 0 ? (
            <View style={styles.emptyState}>
              <View style={styles.emptyIconRing}>
                <Ionicons name="cart-outline" size={38} color={C.textMuted} />
              </View>
              <Text style={styles.emptyTitle}>Your cart is empty</Text>
              <Text style={styles.emptySubtitle}>Browse local shops and add items to your cart.</Text>
              <TouchableOpacity
                onPress={() => router.replace('/shop/home')}
                style={styles.discoverBtn}
              >
                <Text style={styles.discoverBtnText}>Discover Shops</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={{ padding: 16, gap: 14 }}>
              {/* Merchant Collapsible Accordions */}
              {globalCart.map((entry) => {
                const shopId = entry.shop.id;
                const isCollapsed = !!collapsedShops[shopId];
                const shopSubtotal = entry.items.reduce((sum, itemEntry) => sum + (itemEntry.item.price || 0) * itemEntry.quantity, 0);

                return (
                  <View key={shopId} style={styles.shopCard}>
                    {/* Collapsible Header */}
                    <TouchableOpacity
                      onPress={() => toggleShopCollapse(shopId)}
                      style={styles.shopHeader}
                      activeOpacity={0.8}
                    >
                      <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center' }}>
                        <Ionicons name="storefront-outline" size={16} color={C.primary} style={{ marginRight: 8 }} />
                        <Text style={styles.shopTitle} numberOfLines={1}>
                          {entry.shop.name}
                        </Text>
                        <Text style={styles.itemCountBadge}>
                          {entry.items.length}
                        </Text>
                      </View>
                      <Ionicons
                        name={isCollapsed ? 'chevron-down-outline' : 'chevron-up-outline'}
                        size={18}
                        color={C.textSoft}
                      />
                    </TouchableOpacity>

                    {/* Collapsible Content */}
                    {!isCollapsed && (
                      <View style={{ borderTopWidth: 1, borderTopColor: C.border }}>
                        {/* Items */}
                        <View style={styles.itemsContainer}>
                          {entry.items.map((itemEntry) => {
                            const item = itemEntry.item;
                            const price = item.price || 0;
                            return (
                              <View key={item.id} style={styles.itemRow}>
                                <Image
                                  source={{ uri: getImageUrl(item.image) }}
                                  style={styles.itemImage}
                                  contentFit="cover"
                                />
                                <View style={styles.itemDetails}>
                                  <Text style={styles.itemName} numberOfLines={2}>{item.name}</Text>
                                  <Text style={styles.itemPrice}>₹{price}</Text>

                                  <Text style={styles.inStockText}>
                                    {item.quantity_status === 'out' ? 'Out of Stock' : 'In Stock'}
                                  </Text>

                                  {/* Qty and Delete */}
                                  <View style={styles.itemActionsRow}>
                                    <View style={styles.qtySelector}>
                                      <TouchableOpacity onPress={() => handleUpdateQty(shopId, item.id, -1)} style={styles.qtyBtn}>
                                        <Ionicons name="remove" size={12} color={C.textSoft} />
                                      </TouchableOpacity>
                                      <Text style={styles.qtyText}>{itemEntry.quantity}</Text>
                                      <TouchableOpacity onPress={() => handleUpdateQty(shopId, item.id, 1)} style={styles.qtyBtn}>
                                        <Ionicons name="add" size={12} color={C.textSoft} />
                                      </TouchableOpacity>
                                    </View>

                                    <TouchableOpacity onPress={() => handleRemoveItem(shopId, item.id)} style={styles.deleteLink}>
                                      <Ionicons name="trash-outline" size={13} color={C.danger} style={{ marginRight: 3 }} />
                                      <Text style={styles.deleteLinkText}>Delete</Text>
                                    </TouchableOpacity>
                                  </View>
                                </View>
                              </View>
                            );
                          })}
                        </View>

                        {/* Shop subtotal & delivery details */}
                        <View style={styles.subtotalRow}>
                          <Text style={styles.subtotalLabel}>Subtotal</Text>
                          <Text style={styles.subtotalValue}>₹{shopSubtotal}</Text>
                        </View>

                        {entry.shop.delivery_available && (
                          <View style={styles.shopDeliveryBanner}>
                            <Text style={styles.shopDeliveryBannerText}>
                              🚚 Delivery Charge: {formatDeliveryCharge(entry.shop.delivery_charge)} | Est: {entry.shop.estimated_delivery_time || 'N/A'}
                            </Text>
                          </View>
                        )}
                      </View>
                    )}
                  </View>
                );
              })}

              {/* Unified Checkout Form */}
              <View style={[styles.shopCard, { marginTop: 6 }]}>
                <View style={styles.formHeader}>
                  <Ionicons name="receipt-outline" size={16} color={C.primary} style={{ marginRight: 8 }} />
                  <Text style={styles.formTitle}>Unified Checkout Details</Text>
                </View>

                <View style={styles.formContainer}>
                  <Text style={styles.label}>Your Name *</Text>
                  <TextInput
                    value={checkoutForm.name}
                    onChangeText={(val) => handleInputChange('name', val)}
                    placeholder="Enter full name"
                    style={styles.input}
                    placeholderTextColor="#A0BAB4"
                  />

                  <Text style={styles.label}>Phone Number *</Text>
                  <TextInput
                    value={checkoutForm.phone}
                    onChangeText={(val) => handleInputChange('phone', val)}
                    placeholder="Enter phone number"
                    keyboardType="phone-pad"
                    style={styles.input}
                    placeholderTextColor="#A0BAB4"
                  />

                  <Text style={styles.label}>Delivery Address *</Text>
                  <TextInput
                    value={checkoutForm.address}
                    onChangeText={(val) => handleInputChange('address', val)}
                    placeholder="Enter full delivery address"
                    multiline
                    numberOfLines={2}
                    style={[styles.input, { height: 50, textAlignVertical: 'top', paddingTop: 8 }]}
                    placeholderTextColor="#A0BAB4"
                  />

                  <Text style={styles.label}>Notes (Optional)</Text>
                  <TextInput
                    value={checkoutForm.notes}
                    onChangeText={(val) => handleInputChange('notes', val)}
                    placeholder="Instructions for merchants"
                    style={styles.input}
                    placeholderTextColor="#A0BAB4"
                  />

                  {/* GPS */}
                  <Text style={styles.label}>GPS Coordinates *</Text>
                  <View style={styles.gpsRow}>
                    <TouchableOpacity
                      onPress={handleGetLocation}
                      style={styles.gpsBtn}
                    >
                      <Ionicons name="location-outline" size={14} color="#FFF" />
                      <Text style={styles.gpsBtnText}>Get GPS</Text>
                    </TouchableOpacity>
                    <TextInput
                      value={checkoutForm.lat}
                      onChangeText={(val) => handleInputChange('lat', val)}
                      placeholder="Lat"
                      style={[styles.input, styles.gpsInput]}
                      placeholderTextColor="#A0BAB4"
                    />
                    <TextInput
                      value={checkoutForm.lon}
                      onChangeText={(val) => handleInputChange('lon', val)}
                      placeholder="Lon"
                      style={[styles.input, styles.gpsInput]}
                      placeholderTextColor="#A0BAB4"
                    />
                  </View>
                  {/* Payment Method (COD Only) */}
                  <Text style={styles.label}>Payment Method</Text>
                  <View style={{ 
                    flexDirection: 'row', 
                    alignItems: 'center', 
                    backgroundColor: '#F3FBF9', 
                    borderWidth: 1, 
                    borderColor: '#E2EFEB', 
                    borderRadius: 10, 
                    padding: 12, 
                    marginBottom: 14, 
                    gap: 8 
                  }}>
                    <Ionicons name="cash-outline" size={18} color="#2F5D50" style={{ marginTop: 2 }} />
                    <Text style={{ fontSize: 13, fontWeight: '700', color: '#2F5D50', flex: 1 }}>
                      {globalCart[0]?.shop?.payment_policy === 'cod' 
                        ? 'Cash on Delivery (COD)' 
                        : globalCart[0]?.shop?.payment_policy === 'contact' 
                        ? 'Merchant may contact you for payment.' 
                        : 'Cash on Delivery (COD) or merchant may contact you for payment.'}
                    </Text>
                  </View>
                  {/* Checkout Breakdowns */}
                  <View style={styles.breakdownBox}>
                    <View style={styles.breakdownRow}>
                      <Text style={styles.breakdownLabel}>Items Subtotal:</Text>
                      <Text style={styles.breakdownVal}>₹{itemsSubtotal}</Text>
                    </View>
                    {(totalDeliveryCharges > 0 || hasTextDeliveryCharges) && (
                      <View style={styles.breakdownRow}>
                        <Text style={styles.breakdownLabel}>Delivery Charges:</Text>
                        <Text style={styles.breakdownVal}>
                          {totalDeliveryCharges > 0 ? `₹${totalDeliveryCharges}` : ''}
                          {hasTextDeliveryCharges ? (totalDeliveryCharges > 0 ? ' + Extra' : 'Extra/Variable') : ''}
                        </Text>
                      </View>
                    )}
                    <View style={[styles.breakdownRow, { borderTopWidth: 1, borderTopColor: C.border, paddingTop: 8, marginTop: 8 }]}>
                      <Text style={[styles.breakdownLabel, { fontWeight: '900', color: C.text }]}>Grand Total:</Text>
                      <Text style={[styles.breakdownVal, { fontWeight: '950', color: C.text, fontSize: 15 }]}>
                        ₹{grandTotal}{hasTextDeliveryCharges ? ' + Extra' : ''}
                      </Text>
                    </View>
                  </View>

                  {/* Checkout submit */}
                  <TouchableOpacity
                    onPress={handlePlaceAllOrders}
                    disabled={checkoutForm.submitting || globalCart.length === 0}
                    style={[styles.submitBtn, checkoutForm.submitting && { opacity: 0.6 }]}
                  >
                    {checkoutForm.submitting ? (
                      <ActivityIndicator size="small" color="#FFF" />
                    ) : (
                      <Text style={styles.submitBtnText}>Place Order (₹{grandTotal}{hasTextDeliveryCharges ? ' + Extra' : ''})</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>

      {/* BOTTOM NAVIGATION */}
      <View style={styles.bottomNav}>
        {[
          { route: '/shop/home', icon: 'home',   iconOutline: 'home-outline',   label: 'Home'      },
          { route: '/favorites', icon: 'heart',  iconOutline: 'heart-outline',  label: 'Saved'     },
          { route: '/cart',      icon: 'cart',   iconOutline: 'cart-outline',   label: 'Cart'      },
          { route: '/profile',   icon: 'person', iconOutline: 'person-outline', label: 'Profile'   },
        ].map(tab => {
          const active = tab.route === '/cart';
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
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  
  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: C.white,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  backBtn: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: C.bg,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: C.text,
    textAlign: 'center',
  },
  headerSub: {
    fontSize: 10,
    color: C.textSoft,
    textAlign: 'center',
    marginTop: 1,
  },

  // Empty State
  emptyState: {
    padding: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 60,
  },
  emptyIconRing: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: C.white,
    borderWidth: 1,
    borderColor: C.border,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
    marginBottom: 20,
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
  discoverBtn: {
    backgroundColor: C.primary,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12,
    shadowColor: C.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 4,
  },
  discoverBtnText: {
    color: C.white,
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  // Shop Card
  shopCard: {
    backgroundColor: C.white,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: C.border,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.02,
    shadowRadius: 6,
    elevation: 1,
  },
  shopHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: '#FAFDFB',
  },
  shopTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: C.text,
    marginRight: 6,
  },
  itemCountBadge: {
    fontSize: 9,
    fontWeight: '900',
    backgroundColor: 'rgba(47,93,80,0.08)',
    color: C.primary,
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 6,
  },

  // Items List
  itemsContainer: {
    paddingHorizontal: 16,
  },
  itemRow: {
    flexDirection: 'row',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F5F2',
  },
  itemImage: {
    width: 68,
    height: 68,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: '#FAFDFB',
  },
  itemDetails: {
    flex: 1,
    marginLeft: 12,
  },
  itemName: {
    fontSize: 12,
    fontWeight: '800',
    color: C.text,
    lineHeight: 16,
  },
  itemPrice: {
    fontSize: 12,
    fontWeight: '900',
    color: C.text,
    marginTop: 2,
  },
  inStockText: {
    fontSize: 9,
    fontWeight: '700',
    color: C.accent,
    marginTop: 1,
  },
  itemActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  qtySelector: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F6F4',
    borderWidth: 1,
    borderColor: '#E4EDE9',
    borderRadius: 8,
  },
  qtyBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  qtyText: {
    fontSize: 11,
    fontWeight: '800',
    color: C.text,
    paddingHorizontal: 2,
  },
  deleteLink: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
  },
  deleteLinkText: {
    fontSize: 11,
    fontWeight: '800',
    color: C.danger,
  },

  // Subtotal and delivery details inside item card
  subtotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FCFDFD',
  },
  subtotalLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: C.textSoft,
    textTransform: 'uppercase',
  },
  subtotalValue: {
    fontSize: 13,
    fontWeight: '900',
    color: C.text,
  },
  shopDeliveryBanner: {
    paddingHorizontal: 16,
    paddingBottom: 14,
  },
  shopDeliveryBannerText: {
    fontSize: 10,
    color: C.primary,
    fontWeight: '700',
    backgroundColor: '#F0F7F4',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    overflow: 'hidden',
  },

  // Unified Checkout Form
  formHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#FAFDFB',
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  formTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: C.text,
  },
  formContainer: {
    padding: 16,
  },
  label: {
    fontSize: 9,
    fontWeight: '900',
    textTransform: 'uppercase',
    color: C.textSoft,
    letterSpacing: 0.5,
    marginBottom: 4,
    marginTop: 10,
  },
  input: {
    height: 38,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 12,
    backgroundColor: '#FCFDFD',
    paddingHorizontal: 12,
    fontSize: 12,
    color: C.text,
  },
  gpsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  gpsBtn: {
    backgroundColor: '#1E293B',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    height: 38,
    paddingHorizontal: 12,
    borderRadius: 12,
  },
  gpsBtnText: {
    color: C.white,
    fontSize: 9,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  gpsInput: {
    flex: 1,
    textAlign: 'center',
  },
  paymentBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 40,
    backgroundColor: '#F3F5F4',
    borderWidth: 1,
    borderColor: '#E8EFEA',
    borderRadius: 12,
  },
  paymentBtnActive: {
    backgroundColor: '#2F5D50',
    borderColor: '#2F5D50',
  },
  paymentBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#2F5D50',
  },
  paymentBtnTextActive: {
    color: '#FFF',
    fontWeight: '800',
  },

  // Breakdown Summary Card
  breakdownBox: {
    backgroundColor: '#FAFDFB',
    borderRadius: 14,
    padding: 12,
    marginTop: 18,
    borderWidth: 1,
    borderColor: C.border,
  },
  breakdownRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 3,
  },
  breakdownLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: C.textSoft,
  },
  breakdownVal: {
    fontSize: 11,
    fontWeight: '800',
    color: C.text,
  },

  // Submit button
  submitBtn: {
    backgroundColor: C.primary,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 18,
    shadowColor: C.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 4,
  },
  submitBtnText: {
    color: C.white,
    fontSize: 12,
    fontWeight: '900',
  },

  // Footer Nav
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
