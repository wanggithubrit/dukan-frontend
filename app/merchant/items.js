import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator, FlatList, Image, InteractionManager,
  Platform, RefreshControl, StyleSheet, Text, TextInput,
  TouchableOpacity, View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const BASE_URL = "https://api.mydukan.online";
const POLL_MS  = 20_000;
const MAX_BACKOFF_MS = 300_000; // 5 min ceiling

const getImageUrl = (path) => {
  if (!path) return 'https://via.placeholder.com/150';
  return path.startsWith('http') ? path : `${BASE_URL}${path}`;
};

/* ─── Sub-components (unchanged) ─── */
const NavBtn = React.memo(({ icon, label, onPress, active }) => (
  <TouchableOpacity style={styles.navTab} onPress={onPress} activeOpacity={0.7}>
    <Ionicons name={icon} size={22} color={active ? '#2F5D50' : '#bbb'} />
    <Text style={[styles.navLabel, active && { color: '#2F5D50' }]}>{label}</Text>
  </TouchableOpacity>
));
NavBtn.displayName = 'NavBtn';

const ProductCard = React.memo(({ item, onDelete }) => (
  <View style={styles.card}>
    <View style={styles.imageWrap}>
      <Image source={{ uri: getImageUrl(item.image) }} style={styles.cardImg} resizeMode="cover" />
      <TouchableOpacity style={styles.delBtn} onPress={() => onDelete(item.id)}>
        <Ionicons name="trash-outline" size={14} color="#FF4444" />
      </TouchableOpacity>
    </View>
    <View style={styles.cardBody}>
      <Text style={styles.cardCat}>{item.category || 'GENERAL'}</Text>
      <Text style={styles.cardName} numberOfLines={1}>{item.name}</Text>
      <Text style={styles.cardPrice}>
        {item.price ? `₹${Number(item.price).toLocaleString()}` : 'No Price'}
      </Text>
    </View>
  </View>
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

/* ─── Main ─── */
export default function InventoryPage() {
  const router = useRouter();

  const [products,    setProducts]    = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [refreshing,  setRefreshing]  = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const pollTimer    = useRef(null);
  const isFetching   = useRef(false);
  const shopIdRef    = useRef(null);

  // ─── NEW: cache token in a ref so polls don't hit AsyncStorage every time ─
  const tokenRef     = useRef(null);
  // ─── NEW: keep the last JSON string to detect actual changes ──────────────
  const lastJsonRef  = useRef(null);
  // ─── NEW: backoff state for error recovery ────────────────────────────────
  const backoffRef   = useRef(POLL_MS);

  // ─── Token helper — reads once, then reuses from ref ─────────────────────
  const getToken = useCallback(async () => {
    if (tokenRef.current) return tokenRef.current;
    const [[, t], [, at]] = await AsyncStorage.multiGet(['token', 'access_token']);
    tokenRef.current = t || at;
    return tokenRef.current;
  }, []);

  // ─── fetch ────────────────────────────────────────────────────────────────
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
        const dashRes = await fetch(`${BASE_URL}/api/merchant/dashboard/${userId}/`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
          signal,
        });
        const dashData = await dashRes.json();
        shopIdRef.current = dashData?.shop?.id;
      }

      if (!shopIdRef.current) return;

      const itemsRes  = await fetch(`${BASE_URL}/api/items/${shopIdRef.current}/`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        signal, // ← NEW: allows cancellation on unmount
      });
      const itemsData = await itemsRes.json();
      const nextData  = Array.isArray(itemsData) ? itemsData : [];

      // ─── NEW: skip re-render if data hasn't actually changed ──────────────
      const nextJson = JSON.stringify(nextData);
      if (nextJson !== lastJsonRef.current) {
        lastJsonRef.current = nextJson;
        React.startTransition(() => setProducts(nextData));
      }

      // ─── NEW: reset backoff on success ────────────────────────────────────
      backoffRef.current = POLL_MS;

    } catch (err) {
      if (err?.name === 'AbortError') return; // silently ignore unmount cancellation

      if (!silent) console.error('Fetch Error:', err);

      // ─── NEW: exponential backoff on error ────────────────────────────────
      backoffRef.current = Math.min(backoffRef.current * 2, MAX_BACKOFF_MS);

    } finally {
      isFetching.current = false;
      setLoading(false);
      if (!silent) setRefreshing(false);
    }
  }, [getToken]);

  // ─── polling ──────────────────────────────────────────────────────────────
  const stopPolling  = useCallback(() => {
    if (pollTimer.current) { clearInterval(pollTimer.current); pollTimer.current = null; }
  }, []);

  const startPolling = useCallback((abortCtrl) => {
    stopPolling();
    // ─── NEW: use current backoff interval, re-schedule dynamically on errors
    const tick = () => {
      fetchInventory(true, abortCtrl.signal);
      // Re-schedule with updated backoff (may have changed after an error)
      pollTimer.current = setTimeout(tick, backoffRef.current);
    };
    pollTimer.current = setTimeout(tick, POLL_MS);
  }, [fetchInventory, stopPolling]);

  // ─── focus effect ─────────────────────────────────────────────────────────
  useFocusEffect(
    useCallback(() => {
      // ─── NEW: AbortController tied to this focus session ──────────────────
      const abortCtrl = new AbortController();

      const task = InteractionManager.runAfterInteractions(() => {
        fetchInventory(false, abortCtrl.signal);
        startPolling(abortCtrl);
      });

      return () => {
        task.cancel();
        stopPolling();
        abortCtrl.abort(); // cancel any in-flight fetch on blur
      };
    }, [fetchInventory, startPolling, stopPolling])
  );

  // ─── pull-to-refresh ──────────────────────────────────────────────────────
  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchInventory(false);
  }, [fetchInventory]);

  // ─── delete ───────────────────────────────────────────────────────────────
  const handleDelete = useCallback(async (id) => {
    // Optimistic update — also patch lastJsonRef so next poll doesn't revert it
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
      if (!res.ok) {
        lastJsonRef.current = null; // force re-render on next poll
        fetchInventory(false);
      }
    } catch {
      lastJsonRef.current = null;
      fetchInventory(false);
    }
  }, [fetchInventory, getToken]);

  // ─── filtered list (memoized) ─────────────────────────────────────────────
  const filteredData = useMemo(
    () => products.filter(item =>
      item.name?.toLowerCase().includes(searchQuery.toLowerCase())
    ),
    [products, searchQuery]
  );

  const renderItem    = useCallback(({ item }) => (
    <ProductCard item={item} onDelete={handleDelete} />
  ), [handleDelete]);

  const keyExtractor  = useCallback((item) => item.id.toString(), []);

  if (loading) return (
    <View style={styles.center}>
      <StatusBar style="dark" />
      <ActivityIndicator size="large" color="#2F5D50" />
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />

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

      <View style={styles.footer}>
        <NavBtn icon="home-outline"   label="Home"    onPress={() => router.push('/merchant/home')} />
        <NavBtn icon="grid"           label="Items"   onPress={() => router.push('/merchant/items')} active />
        <TouchableOpacity style={styles.addBtn} onPress={() => router.push('/merchant/create-post')} activeOpacity={0.85}>
          <Ionicons name="add" size={28} color="#fff" />
        </TouchableOpacity>
        <NavBtn icon="person-outline" label="Profile" onPress={() => router.push('/merchant/profile')} />
      </View>
    </SafeAreaView>
  );
}

// styles unchanged

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F2F5F4' },
  center:    { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F2F5F4' },

  /* header */
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingVertical: 15, backgroundColor: '#fff',
    borderBottomWidth: 0.5, borderBottomColor: '#eee',
  },
  headerTitle:     { fontSize: 24, fontWeight: '800', color: '#1a1a1a' },
  headerSub:       { fontSize: 12, color: '#aaa', marginTop: 1 },
  refreshBtn:      { width: 38, height: 38, backgroundColor: '#E8EFEA', borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  refreshBtnActive:{ backgroundColor: '#d8eadb' },

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
  cardBody:  { padding: 10 },
  cardCat:   { fontSize: 9, fontWeight: '800', color: '#2F5D50', letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 3 },
  cardName:  { fontSize: 13, fontWeight: '700', color: '#1a1a1a', marginBottom: 4 },
  cardPrice: { fontSize: 14, fontWeight: '800', color: '#2F5D50' },

  /* empty */
  emptyWrap:    { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 80, gap: 8 },
  emptyIconBox: { width: 64, height: 64, borderRadius: 20, backgroundColor: '#f0f0f0', alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  emptyTitle:   { fontSize: 15, fontWeight: '700', color: '#555' },
  emptySub:     { fontSize: 12, color: '#aaa', textAlign: 'center', paddingHorizontal: 40 },

  /* footer */
  footer: {
    position: 'absolute', bottom: 0, width: '100%',
    backgroundColor: '#fff', flexDirection: 'row',
    justifyContent: 'space-around', alignItems: 'center',
    paddingVertical: 10,
    paddingBottom: Platform.OS === 'ios' ? 24 : 16,
    borderTopWidth: 0.5, borderColor: '#eee', elevation: 12,
  },
  navTab:   { alignItems: 'center', gap: 2 },
  navLabel: { fontSize: 10, color: '#bbb', fontWeight: '500' },
  addBtn: {
    width: 52, height: 52, borderRadius: 26,
    backgroundColor: '#2F5D50', justifyContent: 'center', alignItems: 'center',
    elevation: 6, shadowColor: '#2F5D50', shadowOpacity: 0.4, shadowRadius: 8, marginBottom: 8,
  },
});