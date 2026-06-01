import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useCallback, useMemo, useRef, useState } from 'react';
import { Image } from 'expo-image';
import { showRewardedAd } from '../../utils/rewardedAd';
import {
  ActivityIndicator, Alert, FlatList, InteractionManager,
  Modal,
  Platform, RefreshControl, StyleSheet,
  Switch,
  Text, TextInput,
  TouchableOpacity, TouchableWithoutFeedback, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AdBanner from '../../components/AdBanner';

const BASE_URL = 'https://dukan-backend-0cc9.onrender.com';
const POLL_MS  = 60_000;
const MAX_BACKOFF_MS = 300_000;

const getImageUrl = (path) => {
  if (!path) return 'https://via.placeholder.com/150';
  return path.startsWith('http') ? path : `${BASE_URL}${path}`;
};

/* ─── Sub-components ─── */
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

const ProductCard = React.memo(({ item, onDelete, onEdit }) => (
  <TouchableOpacity style={styles.card} activeOpacity={0.92} onPress={() => onEdit(item)}>
    <View style={styles.imageWrap}>
      <Image source={{ uri: getImageUrl(item.image) }} style={styles.cardImg} resizeMode="cover" />
      <TouchableOpacity style={styles.delBtn} onPress={() => onDelete(item.id)}>
        <Ionicons name="trash-outline" size={14} color="#FF4444" />
      </TouchableOpacity>
      {item.track_quantity && item.quantity_status === 'out' && (
        <View style={styles.outOfStockBadge}>
          <Text style={styles.outOfStockText}>Out of Stock</Text>
        </View>
      )}
    </View>
    <View style={styles.cardBody}>
      <Text style={styles.cardCat}>{item.category || 'GENERAL'}</Text>
      <Text style={styles.cardName} numberOfLines={1}>{item.name}</Text>
      <Text style={styles.cardPrice}>
        {item.price ? `₹${Number(item.price).toLocaleString()}` : 'No Price'}
      </Text>
      {item.track_quantity && (
        <View style={styles.stockWrap}>
          {item.quantity_status === 'out' && <Text style={styles.stockOut}>Out of Stock</Text>}
          {item.quantity_status === 'low' && <Text style={styles.stockLow}>Only {item.quantity} left</Text>}
          {item.quantity_status === 'in' && <Text style={styles.stockIn}>In Stock ({item.quantity})</Text>}
        </View>
      )}
    </View>
  </TouchableOpacity>
));
ProductCard.displayName = 'ProductCard';

const EmptyState = React.memo(({ query }) => (
  <View style={styles.emptyWrap}>
    <View style={styles.emptyIconBox}>
      <Ionicons name="cube-outline" size={32} color="#ccc" />
    </View>
    <Text style={styles.emptyTitle}>{query ? 'No results' : 'No products yet'}</Text>
    <Text style={styles.emptySub}>
      {query ? `Nothing matches "${query}"` : 'Add your first item to get started'}
    </Text>
  </View>
));
EmptyState.displayName = 'EmptyState';

/* ─── Quantity Stepper ─── */
const QuantityStepper = ({ value, onChange }) => {
  const num = parseInt(value, 10) || 0;
  return (
    <View style={styles.stepperRow}>
      <Text style={styles.stepperLabel}>Quantity</Text>
      <View style={styles.stepperControls}>
        <TouchableOpacity
          style={[styles.stepperBtn, num <= 0 && styles.stepperBtnDisabled]}
          onPress={() => onChange(String(Math.max(0, num - 1)))}
          activeOpacity={0.7}
        >
          <Ionicons name="remove" size={18} color={num <= 0 ? '#ccc' : '#2F5D50'} />
        </TouchableOpacity>
        <TextInput
          style={styles.stepperInput}
          value={value}
          onChangeText={onChange}
          keyboardType="numeric"
          textAlign="center"
        />
        <TouchableOpacity
          style={styles.stepperBtn}
          onPress={() => onChange(String(num + 1))}
          activeOpacity={0.7}
        >
          <Ionicons name="add" size={18} color="#2F5D50" />
        </TouchableOpacity>
      </View>
    </View>
  );
};

/* ─── Main ─── */
export default function InventoryPage() {
  const router = useRouter();

  const [products,     setProducts]     = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [refreshing,   setRefreshing]   = useState(false);
  const [searchQuery,  setSearchQuery]  = useState('');
  const [selectedItem, setSelectedItem] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [editName,     setEditName]     = useState('');
  const [editPrice,    setEditPrice]    = useState('');
  const [trackQuantity,setTrackQuantity]= useState(false);
  const [quantity,     setQuantity]     = useState('0');
  const [saving,       setSaving]       = useState(false);

  const [creditStatus, setCreditStatus] = useState({
    available_credits: 0,
    product_limit: 20,
    is_pro: false,
  });
  const [limitModalVisible, setLimitModalVisible] = useState(false);
  const [purchasingLimit, setPurchasingLimit] = useState(false);

  const _Razorpay = require('react-native-razorpay');
  const RazorpayCheckout = _Razorpay && (_Razorpay.default || _Razorpay);

  const pollTimer   = useRef(null);
  const isFetching  = useRef(false);
  const shopIdRef   = useRef(null);
  const tokenRef    = useRef(null);
  const lastJsonRef = useRef(null);
  const backoffRef  = useRef(POLL_MS);

  const getToken = useCallback(async () => {
    if (tokenRef.current) return tokenRef.current;
    const [[, t], [, at]] = await AsyncStorage.multiGet(['token', 'access_token']);
    tokenRef.current = t || at;
    return tokenRef.current;
  }, []);

  const fetchCreditStatus = useCallback(async () => {
    try {
      const token = await getToken();
      const res = await fetch(`${BASE_URL}/api/credits/status/`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const data = await res.json();
      if (res.ok) {
        setCreditStatus({
          available_credits: data.available_credits,
          product_limit: data.product_limit,
          is_pro: data.is_pro,
        });
      }
    } catch (err) {
      console.log('Error fetching credit status in items.js:', err);
    }
  }, [getToken]);

  const handleBuySlot = useCallback(async () => {
    if (purchasingLimit) return;
    if (creditStatus.available_credits < 10) {
      Alert.alert('Insufficient Credits', 'You need at least 10 credits to unlock a product slot. Watch ads or complete store profile to earn credits!');
      return;
    }
    setPurchasingLimit(true);
    try {
      const token = await getToken();
      const res = await fetch(`${BASE_URL}/api/credits/buy-limit/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });
      const data = await res.json();
      if (res.ok) {
        Alert.alert('Unlocked! 🎉', 'You have unlocked 1 additional product slot.');
        setLimitModalVisible(false);
        fetchCreditStatus();
      } else {
        Alert.alert('Error', data.error || 'Failed to purchase slot');
      }
    } catch (err) {
      Alert.alert('Error', 'Network error. Please try again.');
    } finally {
      setPurchasingLimit(false);
    }
  }, [creditStatus, getToken, fetchCreditStatus, purchasingLimit]);

  const handleWatchAd = useCallback(async () => {
    showRewardedAd(async () => {
      try {
        const token = await getToken();
        const res = await fetch(`${BASE_URL}/api/credits/ad-complete/`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ ad_id: 'inventory_page_limit_watch_' + Date.now() }),
        });
        const data = await res.json();
        if (res.ok) {
          Alert.alert('Congratulations! 🎉', 'You watched the ad and earned 1 Credit.');
          fetchCreditStatus();
        } else {
          Alert.alert('Error', data.error || 'Failed to claim reward');
        }
      } catch (err) {
        Alert.alert('Error', 'Could not apply reward. Try again.');
      }
    });
  }, [getToken, fetchCreditStatus]);

  const fetchInventory = useCallback(async (silent = false, signal = null) => {
    if (isFetching.current) return;
    isFetching.current = true;
    try {
      const [userId, token] = await Promise.all([
        AsyncStorage.getItem('user_id'),
        getToken(),
      ]);
      if (!userId) return;

      if (!shopIdRef.current) {
        const dashRes  = await fetch(`${BASE_URL}/api/merchant/dashboard/${userId}/`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
          signal,
        });
        const dashData = await dashRes.json();
        shopIdRef.current = dashData?.shop?.id;
      }
      if (!shopIdRef.current) return;

      const itemsRes  = await fetch(`${BASE_URL}/api/items/${shopIdRef.current}/`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        signal,
      });
      const itemsData = await itemsRes.json();
      const nextData  = Array.isArray(itemsData) ? itemsData : [];
      const nextJson  = JSON.stringify(nextData);
      if (nextJson !== lastJsonRef.current) {
        lastJsonRef.current = nextJson;
        React.startTransition(() => setProducts(nextData));
      }
      backoffRef.current = POLL_MS;
    } catch (err) {
      if (err?.name === 'AbortError') return;
      if (!silent) console.error('Fetch Error:', err);
      backoffRef.current = Math.min(backoffRef.current * 2, MAX_BACKOFF_MS);
    } finally {
      isFetching.current = false;
      setLoading(false);
      if (!silent) setRefreshing(false);
    }
  }, [getToken]);

  const stopPolling = useCallback(() => {
    if (pollTimer.current) { clearTimeout(pollTimer.current); pollTimer.current = null; }
  }, []);

  const startPolling = useCallback((abortCtrl) => {
    stopPolling();
    const tick = () => {
      fetchInventory(true, abortCtrl.signal);
      pollTimer.current = setTimeout(tick, backoffRef.current);
    };
    pollTimer.current = setTimeout(tick, POLL_MS);
  }, [fetchInventory, stopPolling]);

  useFocusEffect(
    useCallback(() => {
      const abortCtrl = new AbortController();
      const task = InteractionManager.runAfterInteractions(() => {
        fetchInventory(false, abortCtrl.signal);
        fetchCreditStatus();
        startPolling(abortCtrl);
      });
      return () => {
        task.cancel();
        stopPolling();
        abortCtrl.abort();
      };
    }, [fetchInventory, fetchCreditStatus, startPolling, stopPolling])
  );

  React.useEffect(() => {
    if (!selectedItem) return;
    setEditName(selectedItem.name || '');
    setEditPrice(String(selectedItem.price || ''));
    setTrackQuantity(selectedItem.track_quantity || false);
    setQuantity(String(selectedItem.quantity || 0));
  }, [selectedItem]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchInventory(false);
    fetchCreditStatus();
  }, [fetchInventory, fetchCreditStatus]);

  const handleAddPress = useCallback(() => {
    if (!creditStatus.is_pro && products.length >= creditStatus.product_limit) {
      setLimitModalVisible(true);
    } else {
      router.push('/merchant/create-post');
    }
  }, [creditStatus, products.length, router]);

  const handleDelete = useCallback(async (id) => {
    setProducts(prev => {
      const next = prev.filter(p => p.id !== id);
      lastJsonRef.current = JSON.stringify(next);
      return next;
    });
    try {
      const token = await getToken();
      const res = await fetch(`${BASE_URL}/api/item/delete/${id}/`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) { lastJsonRef.current = null; fetchInventory(false); }
    } catch {
      lastJsonRef.current = null;
      fetchInventory(false);
    }
  }, [fetchInventory, getToken]);

  const handleSave = useCallback(async () => {
    if (!selectedItem) return;
    setSaving(true);
    try {
      const token = await getToken();
      const form  = new FormData();
      form.append('name', editName);
      form.append('price', editPrice);
      form.append('track_quantity', trackQuantity);
      form.append('quantity', quantity);

      const res  = await fetch(`${BASE_URL}/api/item/update/${selectedItem.id}/`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}` },
        body: form,
      });
      const data = await res.json();
      if (!res.ok) { alert(data.error || 'Update failed'); return; }

      setProducts(prev =>
        prev.map(item => {
          if (item.id !== selectedItem.id) return item;
          const qty = Number(quantity);
          let quantity_status = null;
          if (trackQuantity) {
            if (qty <= 0) quantity_status = 'out';
            else if (qty <= 5) quantity_status = 'low';
            else quantity_status = 'in';
          }
          return { ...item, name: editName, price: editPrice, quantity: qty, track_quantity: trackQuantity, quantity_status };
        })
      );
      setModalVisible(false);
    } catch (err) {
      console.log(err);
      alert('Network error');
    } finally {
      setSaving(false);
    }
  }, [selectedItem, editName, editPrice, quantity, trackQuantity, getToken]);

  const unlockQuantityFeature = useCallback(async () => {
    try {
      const token = await getToken();
      const res   = await fetch(`${BASE_URL}/api/payment/quantity/create/`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) { alert('Failed to create order'); return; }

      const options = {
        description: 'Inventory Management Unlock',
        currency: 'INR',
        key: data.key,
        amount: data.amount,
        order_id: data.order_id,
        name: 'MyDukan',
        theme: { color: '#2F5D50' },
      };

      RazorpayCheckout.open(options)
        .then(async (payment) => {
          const verifyRes = await fetch(`${BASE_URL}/api/payment/quantity/verify/`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({
              order_id: payment.razorpay_order_id,
              payment_id: payment.razorpay_payment_id,
              signature: payment.razorpay_signature,
            }),
          });
          if (!verifyRes.ok) { alert('Verification failed'); return; }
          setSelectedItem(prev => ({ ...prev, shop_has_quantity_feature: true }));
          setProducts(prev => prev.map(item => ({ ...item, shop_has_quantity_feature: true })));
          alert('Inventory unlocked 🎉');
        })
        .catch(() => alert('Payment cancelled'));
    } catch (err) {
      console.log(err);
      alert('Payment error');
    }
  }, [getToken]);

  const closeModal = useCallback(() => setModalVisible(false), []);

  const filteredData = useMemo(
    () => products.filter(item => item.name?.toLowerCase().includes(searchQuery.toLowerCase())),
    [products, searchQuery]
  );

  const renderItem   = useCallback(({ item }) => (
    <ProductCard
      item={item}
      onDelete={handleDelete}
      onEdit={(i) => { setSelectedItem(i); setModalVisible(true); }}
    />
  ), [handleDelete]);

  const keyExtractor = useCallback((item) => item.id.toString(), []);

  if (loading) return (
    <View style={styles.center}>
      <StatusBar style="dark" />
      <ActivityIndicator size="large" color="#2F5D50" />
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />

      {/* ─── Header ─── */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Inventory</Text>
          <Text style={styles.headerSub}>{products.length} product{products.length !== 1 ? 's' : ''} listed</Text>
        </View>
        <TouchableOpacity
          style={[styles.refreshBtn, refreshing && styles.refreshBtnActive]}
          onPress={onRefresh}
          disabled={refreshing}
        >
          {refreshing
            ? <ActivityIndicator size="small" color="#2F5D50" />
            : <Ionicons name="sync-outline" size={18} color="#2F5D50" />}
        </TouchableOpacity>
      </View>

      {/* ─── Search ─── */}
      <View style={styles.searchSection}>
        <View style={styles.searchBar}>
          <Ionicons name="search" size={17} color="#999" />
          <TextInput
            placeholder="Search products..."
            placeholderTextColor="#999"
            style={styles.searchInput}
            value={searchQuery}
            onChangeText={setSearchQuery}
            returnKeyType="search"
            clearButtonMode="while-editing"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Ionicons name="close-circle" size={17} color="#ccc" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      <AdBanner />

      {!creditStatus.is_pro && products.length >= creditStatus.product_limit && (
        <View style={styles.limitWarningBanner}>
          <Ionicons name="warning-outline" size={16} color="#B45309" />
          <Text style={styles.limitWarningText}>
            You have reached the upload limit ({products.length}/{creditStatus.product_limit} items).
          </Text>
          <TouchableOpacity style={styles.limitWarningBtn} onPress={() => setLimitModalVisible(true)}>
            <Text style={styles.limitWarningBtnText}>Unlock</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ─── Grid ─── */}
      <FlatList
        data={filteredData}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        numColumns={2}
        columnWrapperStyle={styles.gridRow}
        contentContainerStyle={[
          styles.listPadding,
          filteredData.length === 0 && styles.listPaddingEmpty,
        ]}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#2F5D50" colors={['#2F5D50']} />
        }
        ListEmptyComponent={<EmptyState query={searchQuery} />}
        removeClippedSubviews
        initialNumToRender={10}
        maxToRenderPerBatch={10}
        windowSize={5}
        showsVerticalScrollIndicator={false}
      />

      {/* ─── Edit Modal ─── */}
      <Modal
        visible={modalVisible}
        transparent
        animationType="slide"
        onRequestClose={closeModal}
      >
        {/* Tap outside to close */}
        <TouchableWithoutFeedback onPress={closeModal}>
          <View style={styles.modalOverlay}>
            {/* Stop propagation so tapping inside the sheet doesn't close */}
            <TouchableWithoutFeedback onPress={() => {}}>
              <View style={styles.modalSheet}>
                {selectedItem && (
                  <>
                    {/* Drag handle */}
                    <View style={styles.dragHandle} />

                    {/* Product image + name header */}
                    <View style={styles.modalHeader}>
                      <Image
                        source={{ uri: getImageUrl(selectedItem.image) }}
                        style={styles.modalThumb}
                        resizeMode="cover"
                      />
                      <View style={styles.modalHeaderText}>
                        <Text style={styles.modalCategory}>{selectedItem.category || 'GENERAL'}</Text>
                        <Text style={styles.modalProductName} numberOfLines={2}>{selectedItem.name}</Text>
                        <Text style={styles.modalCurrentPrice}>
                          {selectedItem.price ? `₹${Number(selectedItem.price).toLocaleString()}` : 'No Price'}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.divider} />

                    {/* Edit title */}
                    <Text style={styles.sectionLabel}>EDIT DETAILS</Text>

                    {/* Name field */}
                    <View style={styles.inputGroup}>
                      <Text style={styles.inputLabel}>Item Name</Text>
                      <TextInput
                        value={editName}
                        onChangeText={setEditName}
                        placeholder="Item name"
                        placeholderTextColor="#bbb"
                        style={styles.modalInput}
                      />
                    </View>

                    {/* Price field */}
                    <View style={styles.inputGroup}>
                      <Text style={styles.inputLabel}>Price (₹)</Text>
                      <TextInput
                        value={editPrice}
                        onChangeText={setEditPrice}
                        placeholder="0"
                        placeholderTextColor="#bbb"
                        keyboardType="numeric"
                        style={styles.modalInput}
                      />
                    </View>

                    {/* Quantity feature */}
                    {selectedItem.shop_has_quantity_feature ? (
                      <View style={styles.quantitySection}>
                        <View style={styles.switchRow}>
                          <View>
                            <Text style={styles.switchLabel}>Track Quantity</Text>
                            <Text style={styles.switchSub}>Show stock status to customers</Text>
                          </View>
                          <Switch
                            value={trackQuantity}
                            onValueChange={setTrackQuantity}
                            trackColor={{ false: '#e0e0e0', true: '#a8d5c2' }}
                            thumbColor={trackQuantity ? '#2F5D50' : '#f4f3f4'}
                          />
                        </View>

                        {trackQuantity && (
                          <>
                            <QuantityStepper value={quantity} onChange={setQuantity} />
                            {/* Stock status preview */}
                            <View style={styles.stockPreview}>
                              {(() => {
                                const q = parseInt(quantity, 10) || 0;
                                if (q <= 0) return <View style={[styles.stockPill, styles.stockPillOut]}><Text style={styles.stockPillText}>Will show: Out of Stock</Text></View>;
                                if (q <= 5)  return <View style={[styles.stockPill, styles.stockPillLow]}><Text style={styles.stockPillText}>Will show: Only {q} left</Text></View>;
                                return <View style={[styles.stockPill, styles.stockPillIn]}><Text style={styles.stockPillText}>Will show: In Stock ({q})</Text></View>;
                              })()}
                            </View>
                          </>
                        )}
                      </View>
                    ) : (
                      <View style={styles.lockBox}>
                        <View style={styles.lockIconWrap}>
                          <Ionicons name="lock-closed" size={20} color="#D97706" />
                        </View>
                        <View style={styles.lockTextCol}>
                          <Text style={styles.lockTitle}>Inventory Tracking</Text>
                          <Text style={styles.lockSub}>Unlock quantity management for ₹100 lifetime access</Text>
                        </View>
                        <TouchableOpacity style={styles.unlockBtn} onPress={unlockQuantityFeature}>
                          <Text style={styles.unlockText}>Unlock</Text>
                        </TouchableOpacity>
                      </View>
                    )}

                    {/* Save button */}
                    <TouchableOpacity
                      style={[styles.saveBtn, saving && styles.saveBtnLoading]}
                      onPress={handleSave}
                      disabled={saving}
                      activeOpacity={0.85}
                    >
                      {saving
                        ? <ActivityIndicator size="small" color="#fff" />
                        : <>
                            <Ionicons name="checkmark" size={18} color="#fff" />
                            <Text style={styles.saveText}>Save Changes</Text>
                          </>
                      }
                    </TouchableOpacity>
                  </>
                )}
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      {/* ─── Limit Reached Modal ─── */}
      <Modal
        visible={limitModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setLimitModalVisible(false)}
      >
        <TouchableWithoutFeedback onPress={() => setLimitModalVisible(false)}>
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback onPress={() => {}}>
              <View style={styles.modalSheet}>
                <View style={styles.dragHandle} />
                
                <View style={styles.limitHeader}>
                  <View style={styles.limitIconBox}>
                    <Ionicons name="lock-closed" size={32} color="#D97706" />
                  </View>
                  <Text style={styles.limitModalTitle}>Product Limit Reached</Text>
                  <Text style={styles.limitModalSub}>
                    You have used all {creditStatus.product_limit} free product slots. Choose an option below to continue listing products.
                  </Text>
                </View>

                <View style={styles.divider} />

                {/* Option 1: Watch Ad */}
                <TouchableOpacity style={styles.optionRow} onPress={handleWatchAd} activeOpacity={0.8}>
                  <View style={[styles.optionIconBox, { backgroundColor: '#E0F2FE' }]}>
                    <Ionicons name="play-circle" size={24} color="#0284C7" />
                  </View>
                  <View style={styles.optionTextCol}>
                    <Text style={styles.optionTitle}>Watch Video Ad</Text>
                    <Text style={styles.optionSub}>Earn +1 credit immediately by watching a short video</Text>
                  </View>
                  <View style={styles.optionValueBadge}>
                    <Text style={styles.optionValueText}>+1 Credit</Text>
                  </View>
                </TouchableOpacity>

                {/* Option 2: Spend Credits */}
                <TouchableOpacity 
                  style={[styles.optionRow, creditStatus.available_credits < 10 && styles.optionRowDisabled]} 
                  onPress={handleBuySlot} 
                  disabled={purchasingLimit}
                  activeOpacity={0.8}
                >
                  <View style={[styles.optionIconBox, { backgroundColor: '#ECFDF5' }]}>
                    <Ionicons name="flash" size={24} color="#059669" />
                  </View>
                  <View style={styles.optionTextCol}>
                    <Text style={styles.optionTitle}>Use 10 Credits</Text>
                    <Text style={styles.optionSub}>Unlock 1 additional product slot permanently</Text>
                    <Text style={styles.optionBalance}>Current Balance: {creditStatus.available_credits} Credits</Text>
                  </View>
                  <View style={styles.optionValueBadgeSpend}>
                    <Text style={styles.optionValueTextSpend}>Spend 10</Text>
                  </View>
                </TouchableOpacity>

                {/* Option 3: Upgrade to Pro */}
                <TouchableOpacity 
                  style={[styles.optionRow, { borderBottomWidth: 0 }]} 
                  onPress={() => { setLimitModalVisible(false); router.push('/merchant/profile'); }}
                  activeOpacity={0.8}
                >
                  <View style={[styles.optionIconBox, { backgroundColor: '#F5F3FF' }]}>
                    <Ionicons name="ribbon" size={24} color="#7C3AED" />
                  </View>
                  <View style={styles.optionTextCol}>
                    <Text style={styles.optionTitle}>Upgrade to Pro Plan</Text>
                    <Text style={styles.optionSub}>Get unlimited product slots, premium badges, and analytics</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color="#bbb" />
                </TouchableOpacity>

                <TouchableOpacity style={styles.closeModalBtn} onPress={() => setLimitModalVisible(false)}>
                  <Text style={styles.closeModalText}>Close</Text>
                </TouchableOpacity>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      {/* ─── Footer ─── */}
      <View style={styles.footer}>
        <NavBtn icon="home-outline"   label="Home"    onPress={() => router.push('/merchant/home')} />
        <NavBtn icon="grid"           label="Items"   active />
        <TouchableOpacity style={styles.addBtn} onPress={handleAddPress} activeOpacity={0.85}>
          <Ionicons name="add" size={28} color="#fff" />
        </TouchableOpacity>
        <NavBtn icon="person-outline" label="Profile" onPress={() => router.push('/merchant/profile')} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F2F5F4' },
  center:    { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F2F5F4' },

  /* header */
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingVertical: 15, backgroundColor: '#fff',
    borderBottomWidth: 0.5, borderBottomColor: '#eee',
  },
  headerTitle:      { fontSize: 24, fontWeight: '800', color: '#1a1a1a' },
  headerSub:        { fontSize: 12, color: '#aaa', marginTop: 1 },
  refreshBtn:       { width: 38, height: 38, backgroundColor: '#E8EFEA', borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  refreshBtnActive: { backgroundColor: '#d8eadb' },

  /* search */
  searchSection: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 4 },
  searchBar: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff',
    paddingHorizontal: 14, paddingVertical: Platform.OS === 'ios' ? 11 : 8,
    borderRadius: 12, borderWidth: 1, borderColor: '#eee',
    elevation: 1, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 4,
  },
  searchInput: { flex: 1, marginLeft: 9, fontSize: 15, color: '#333', paddingVertical: 0 },

  /* grid */
  listPadding:      { paddingHorizontal: 16, paddingTop: 14, paddingBottom: 110 },
  listPaddingEmpty: { flexGrow: 1 },
  gridRow:          { justifyContent: 'space-between', marginBottom: 12 },

  card: {
    width: '48.5%', backgroundColor: '#fff', borderRadius: 16,
    overflow: 'hidden', elevation: 2,
    shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
  },
  imageWrap: { height: 130, backgroundColor: '#f5f5f5' },
  cardImg:   { width: '100%', height: '100%' },
  delBtn: {
    position: 'absolute', top: 8, right: 8,
    backgroundColor: 'rgba(255,255,255,0.92)',
    padding: 6, borderRadius: 10,
  },
  outOfStockBadge: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: 'rgba(220,38,38,0.82)', paddingVertical: 4, alignItems: 'center',
  },
  outOfStockText: { color: '#fff', fontSize: 10, fontWeight: '700', letterSpacing: 0.5 },
  cardBody:  { padding: 10 },
  cardCat:   { fontSize: 9, fontWeight: '800', color: '#2F5D50', letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 3 },
  cardName:  { fontSize: 13, fontWeight: '700', color: '#1a1a1a', marginBottom: 4 },
  cardPrice: { fontSize: 14, fontWeight: '800', color: '#2F5D50' },

  /* stock */
  stockWrap: { marginTop: 4 },
  stockIn:   { color: '#1B8A3D', fontWeight: '700', fontSize: 10 },
  stockLow:  { color: '#D97706', fontWeight: '700', fontSize: 10 },
  stockOut:  { color: '#DC2626', fontWeight: '700', fontSize: 10 },

  /* empty */
  emptyWrap:    { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 80, gap: 8 },
  emptyIconBox: { width: 64, height: 64, borderRadius: 20, backgroundColor: '#f0f0f0', alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  emptyTitle:   { fontSize: 15, fontWeight: '700', color: '#555' },
  emptySub:     { fontSize: 12, color: '#aaa', textAlign: 'center', paddingHorizontal: 40 },

  /* footer */
  footer: {
    position: 'absolute', bottom: 0, width: '100%',
    backgroundColor: '#0F2118',
    flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center',
    paddingVertical: 10, paddingBottom: Platform.OS === 'ios' ? 24 : 16,
    borderTopWidth: 0.5, borderColor: 'rgba(255,255,255,0.08)',
    elevation: 12,
  },
  navTab:         { alignItems: 'center', gap: 2, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 16 },
  navTabActive:   { backgroundColor: 'rgba(255,255,255,0.08)' },
  navLabel:       { fontSize: 10, color: '#8E9A96', fontWeight: '600' },
  navLabelActive: { fontSize: 10, color: '#00E676', fontWeight: '700' },
  addBtn: {
    width: 52, height: 52, borderRadius: 26,
    backgroundColor: '#1b4d3e',
    justifyContent: 'center', alignItems: 'center',
    elevation: 6,
    shadowColor: '#1b4d3e', shadowOpacity: 0.4, shadowRadius: 8,
    marginBottom: 8,
    borderWidth: 1, borderColor: '#00E676',
  },

  /* ─── Modal ─── */
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: Platform.OS === 'ios' ? 40 : 28,
  },
  dragHandle: {
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: '#e0e0e0',
    alignSelf: 'center', marginBottom: 20,
  },

  /* modal header (image + text side by side) */
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    gap: 14,
  },
  modalThumb: {
    width: 72, height: 72, borderRadius: 16,
    backgroundColor: '#f0f0f0',
  },
  modalHeaderText: { flex: 1 },
  modalCategory: {
    fontSize: 9, fontWeight: '800', color: '#2F5D50',
    letterSpacing: 1, textTransform: 'uppercase', marginBottom: 4,
  },
  modalProductName: {
    fontSize: 16, fontWeight: '800', color: '#111', lineHeight: 20, marginBottom: 4,
  },
  modalCurrentPrice: {
    fontSize: 14, fontWeight: '700', color: '#888',
  },

  divider: {
    height: 1, backgroundColor: '#f0f0f0', marginBottom: 20,
  },

  sectionLabel: {
    fontSize: 10, fontWeight: '800', color: '#aaa',
    letterSpacing: 1.2, marginBottom: 14,
  },

  /* inputs */
  inputGroup:  { marginBottom: 14 },
  inputLabel:  { fontSize: 12, fontWeight: '700', color: '#555', marginBottom: 6 },
  modalInput: {
    backgroundColor: '#F7F8FA',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === 'ios' ? 13 : 10,
    fontSize: 15,
    color: '#111',
    borderWidth: 1,
    borderColor: '#eee',
  },

  /* quantity section */
  quantitySection: { marginBottom: 4 },
  switchRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 16,
  },
  switchLabel: { fontSize: 15, fontWeight: '700', color: '#111' },
  switchSub:   { fontSize: 11, color: '#aaa', marginTop: 2 },

  /* stepper */
  stepperRow: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F7F8FA',
    borderRadius: 14, borderWidth: 1, borderColor: '#eee',
    paddingHorizontal: 16, paddingVertical: 10,
    marginBottom: 12,
  },
  stepperLabel:   { fontSize: 14, fontWeight: '700', color: '#333' },
  stepperControls:{ flexDirection: 'row', alignItems: 'center', gap: 4 },
  stepperBtn: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: '#EAF3EF',
    justifyContent: 'center', alignItems: 'center',
  },
  stepperBtnDisabled: { backgroundColor: '#f4f4f4' },
  stepperInput: {
    width: 52, height: 36,
    backgroundColor: '#fff',
    borderRadius: 10, borderWidth: 1, borderColor: '#e0e0e0',
    fontSize: 16, fontWeight: '700', color: '#111',
    paddingVertical: 0,
  },

  /* stock preview pill */
  stockPreview: { marginBottom: 16 },
  stockPill: { borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6, alignSelf: 'flex-start' },
  stockPillIn:  { backgroundColor: '#ECFDF5' },
  stockPillLow: { backgroundColor: '#FFFBEB' },
  stockPillOut: { backgroundColor: '#FEF2F2' },
  stockPillText:{ fontSize: 12, fontWeight: '700', color: '#444' },

  /* lock box */
  lockBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFBEB',
    borderRadius: 14,
    padding: 14,
    marginBottom: 20,
    gap: 12,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  lockIconWrap: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: '#FEF3C7',
    justifyContent: 'center', alignItems: 'center',
    flexShrink: 0,
  },
  lockTextCol: { flex: 1 },
  lockTitle:   { fontSize: 13, fontWeight: '800', color: '#92400E', marginBottom: 2 },
  lockSub:     { fontSize: 11, color: '#B45309', lineHeight: 15 },
  unlockBtn: {
    backgroundColor: '#D97706',
    paddingHorizontal: 14, paddingVertical: 10,
    borderRadius: 10, flexShrink: 0,
  },
  unlockText: { color: '#fff', fontWeight: '800', fontSize: 12 },

  /* save */
  saveBtn: {
    backgroundColor: '#2F5D50',
    paddingVertical: 15,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 6,
  },
  saveBtnLoading: { opacity: 0.7 },
  saveText: { color: '#fff', fontWeight: '800', fontSize: 15 },

  /* limit warning banner */
  limitWarningBanner: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#FEF3C7',
    paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#FDE68A',
    gap: 10,
  },
  limitWarningText: { flex: 1, fontSize: 12, fontWeight: '600', color: '#92400E' },
  limitWarningBtn: { backgroundColor: '#D97706', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  limitWarningBtnText: { color: '#fff', fontSize: 11, fontWeight: '700' },

  /* limit modal styles */
  limitHeader: { alignItems: 'center', marginVertical: 12 },
  limitIconBox: { width: 56, height: 56, borderRadius: 28, backgroundColor: '#FEF3C7', justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
  limitModalTitle: { fontSize: 18, fontWeight: '800', color: '#111', marginBottom: 6 },
  limitModalSub: { fontSize: 13, color: '#666', textAlign: 'center', paddingHorizontal: 10, lineHeight: 18 },

  optionRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#f3f4f6', gap: 12 },
  optionRowDisabled: { opacity: 0.6 },
  optionIconBox: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center' },
  optionTextCol: { flex: 1 },
  optionTitle: { fontSize: 14, fontWeight: '700', color: '#111', marginBottom: 2 },
  optionSub: { fontSize: 11, color: '#666', lineHeight: 14 },
  optionBalance: { fontSize: 10, fontWeight: '700', color: '#059669', marginTop: 4 },
  optionValueBadge: { backgroundColor: '#E0F2FE', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  optionValueText: { fontSize: 11, fontWeight: '800', color: '#0369A1' },
  optionValueBadgeSpend: { backgroundColor: '#FEE2E2', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  optionValueTextSpend: { fontSize: 11, fontWeight: '800', color: '#B91C1C' },

  closeModalBtn: { backgroundColor: '#f3f4f6', paddingVertical: 13, borderRadius: 14, alignItems: 'center', marginTop: 14 },
  closeModalText: { fontSize: 14, fontWeight: '700', color: '#4b5563' },
});