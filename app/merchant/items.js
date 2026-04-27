/* ─────────────────────────────────────────────
   1. IMPORTS
───────────────────────────────────────────── */
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar'; // Use expo-status-bar for better control
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const BASE_URL = 'http://10.194.216.149:8000';

/* ─── Sub-components (Matches Home) ─── */
const NavBtn = ({ icon, label, onPress, active }) => (
  <TouchableOpacity style={styles.navTab} onPress={onPress} activeOpacity={0.7}>
    <Ionicons name={icon} size={22} color={active ? '#2F5D50' : '#bbb'} />
    <Text style={[styles.navLabel, active && { color: '#2F5D50' }]}>{label}</Text>
  </TouchableOpacity>
);

export default function InventoryPage() {
  const router = useRouter();

  /* ─────────────────────────────────────────────
     2. LOGIC
  ───────────────────────────────────────────── */
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const fetchInventory = useCallback(async (isRefreshing = false) => {
    try {
      if (isRefreshing) setRefreshing(true);
      const userId = await AsyncStorage.getItem('user_id');
      if (!userId) return;

      const dashRes = await fetch(`${BASE_URL}/api/merchant/dashboard/${userId}/`);
      const dashData = await dashRes.json();
      
      const itemsRes = await fetch(`${BASE_URL}/api/items/${dashData.shop.id}/`);
      const itemsData = await itemsRes.json();
      
      setProducts(itemsData);
    } catch (error) {
      console.error("Fetch Error:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchInventory();
  }, [fetchInventory]);

  const handleDelete = async (id) => {
    // Optimistic UI update
    setProducts(prev => prev.filter(p => p.id !== id)); 
    try {
      const token = await AsyncStorage.getItem('access_token');
      await fetch(`${BASE_URL}/api/item/delete/${id}/`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
    } catch (e) {
      fetchInventory(); 
    }
  };

  const filteredData = products.filter(item => 
    item.name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getImageUrl = (path) => {
    if (!path) return 'https://via.placeholder.com/150';
    return path.startsWith('http') ? path : `${BASE_URL}${path}`;
  };

  /* ─────────────────────────────────────────────
     3. UI RENDER
  ───────────────────────────────────────────── */
  if (loading) {
    return (
      <View style={styles.center}>
        <StatusBar style="dark" />
        <ActivityIndicator size="large" color="#2F5D50" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* This makes the status bar icons/text black */}
      <StatusBar style="dark" />
      
      {/* HEADER */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Inventory</Text>
          <Text style={styles.headerSub}>{products.length} Products listed</Text>
        </View>
        <TouchableOpacity style={styles.refreshBtn} onPress={() => fetchInventory(true)}>
          <Ionicons name="sync-outline" size={18} color="#2F5D50" />
        </TouchableOpacity>
      </View>

      {/* SEARCH */}
      <View style={styles.searchSection}>
        <View style={styles.searchBar}>
          <Ionicons name="search" size={18} color="#999" />
          <TextInput
            placeholder="Search products..."
            placeholderTextColor="#999"
            style={styles.searchInput}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>
      </View>

      {/* LIST */}
      <FlatList
        data={filteredData}
        keyExtractor={(item) => item.id.toString()}
        numColumns={2}
        columnWrapperStyle={styles.gridRow}
        contentContainerStyle={styles.listPadding}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => fetchInventory(true)} tintColor="#2F5D50" />
        }
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={styles.imageWrap}>
              <Image source={{ uri: getImageUrl(item.image) }} style={styles.cardImg} />
              <TouchableOpacity style={styles.delBtn} onPress={() => handleDelete(item.id)}>
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
        )}
      />

      {/* ── FOOTER NAV ── */}
      <View style={styles.footer}>
        <NavBtn icon="home-outline" label="Home" onPress={() => router.push('/merchant/home')} />
        <NavBtn icon="grid" label="Items" onPress={() => router.push('/merchant/items')} active />
        <TouchableOpacity style={styles.addBtn} onPress={() => router.push('/merchant/create-post')} activeOpacity={0.85}>
          <Ionicons name="add" size={28} color="#fff" />
        </TouchableOpacity>
        <NavBtn icon="person-outline" label="Profile" onPress={() => router.push('/merchant/profile')} />
      </View>

    </SafeAreaView>
  );
}

/* ─────────────────────────────────────────────
   4. STYLES
───────────────────────────────────────────── */
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F2F5F4' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingVertical: 15, backgroundColor: '#fff',
  },
  headerTitle: { fontSize: 24, fontWeight: '800', color: '#1a1a1a' },
  headerSub: { fontSize: 13, color: '#aaa' },
  refreshBtn: { width: 38, height: 38, backgroundColor: '#E8EFEA', borderRadius: 12, justifyContent: 'center', alignItems: 'center' },

  searchSection: { paddingHorizontal: 16, marginTop: 10 },
  searchBar: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff',
    paddingHorizontal: 15, paddingVertical: 10, borderRadius: 12,
    elevation: 2, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 5
  },
  searchInput: { flex: 1, marginLeft: 10, fontSize: 15, color: '#333' },

  listPadding: { paddingHorizontal: 16, paddingTop: 15, paddingBottom: 110 }, 
  gridRow: { justifyContent: 'space-between', marginBottom: 12 },
  card: { 
    width: '48%', backgroundColor: '#fff', borderRadius: 16, 
    overflow: 'hidden', elevation: 3, shadowColor: '#000', shadowOpacity: 0.07, shadowRadius: 10 
  },
  imageWrap: { height: 130, backgroundColor: '#f0f0f0' },
  cardImg: { width: '100%', height: '100%', resizeMode: 'cover' },
  delBtn: { position: 'absolute', top: 8, right: 8, backgroundColor: 'rgba(255,255,255,0.9)', padding: 6, borderRadius: 10 },
  cardBody: { padding: 10 },
  cardCat: { fontSize: 9, fontWeight: '800', color: '#2F5D50', textTransform: 'uppercase', marginBottom: 2 },
  cardName: { fontSize: 14, fontWeight: '700', color: '#1a1a1a', marginBottom: 2 },
  cardPrice: { fontSize: 15, fontWeight: '800', color: '#2F5D50' },

  footer: {
    position: 'absolute',
    bottom: 0,
    width: '100%',
    backgroundColor: '#fff',
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingVertical: 10,
    paddingBottom: 16,
    borderTopWidth: 0.5,
    borderColor: '#eee',
    elevation: 12,
  },
  navTab: { alignItems: 'center', gap: 2 },
  navLabel: { fontSize: 10, color: '#bbb', fontWeight: '500' },
  addBtn: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#2F5D50',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 6,
    shadowColor: '#2F5D50',
    shadowOpacity: 0.4,
    shadowRadius: 8,
    marginBottom: 8,
  },
});