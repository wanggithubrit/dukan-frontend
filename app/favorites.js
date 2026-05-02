import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';
import { usePathname, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  AppState,
  FlatList,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AdBanner from '../components/AdBanner';

const BASE_URL      = 'https://api.mydukan.online';
const POLL_INTERVAL = 45_000; // 45 s — favorites change rarely; no need to hammer the API

// ── Design tokens ─────────────────────────────────────────────────────────────
const C = {
  bg:        '#F4F7F6',
  card:      '#FFFFFF',
  border:    '#E4EDE9',
  primary:   '#2F5D50',
  primaryLt: '#E8F3F0',
  textHi:    '#0F1F1B',
  textMid:   '#6B8A82',
  textLo:    '#A0BAB4',
  red:       '#FF4B4B',
  redLt:     '#FFF0F0',
};

// ── Helpers ───────────────────────────────────────────────────────────────────
/**
 * Resolves a shop image to a full URL.
 * Uses placehold.co as fallback — via.placeholder.com is unreliable.
 */
const getImageUrl = (img) => {
  if (!img) return 'https://placehold.co/300x300/e0e0e0/aaaaaa?text=Shop';
  if (img.startsWith('http')) return img;
  if (img.startsWith('/')) return `${BASE_URL}${img}`;
  return `${BASE_URL}/${img}`;
};

// ── ShopCard ──────────────────────────────────────────────────────────────────
function ShopCard({ item, onPress, onRemove }) {
  const scale = useRef(new Animated.Value(1)).current;

  const pressIn  = useCallback(() =>
    Animated.spring(scale, { toValue: 0.97, useNativeDriver: true, speed: 30 }).start(), [scale]);
  const pressOut = useCallback(() =>
    Animated.spring(scale, { toValue: 1,    useNativeDriver: true, speed: 30 }).start(), [scale]);

  return (
    <Animated.View style={[s.cardWrap, { transform: [{ scale }] }]}>
      <TouchableOpacity
        style={s.card}
        onPress={onPress}
        onPressIn={pressIn}
        onPressOut={pressOut}
        activeOpacity={1}
      >
        <Image
          source={{ uri: getImageUrl(item.cover_image || item.image) }}
          style={s.cardImage}
        />

        <View style={s.cardBody}>
          <Text style={s.cardName} numberOfLines={1}>{item.name}</Text>

          <View style={s.categoryPill}>
            <Text style={s.categoryText}>{item.category || 'General Store'}</Text>
          </View>

          <View style={s.locationRow}>
            <Ionicons name="location-outline" size={12} color={C.primary} />
            <Text style={s.locationText}>
              {item.distance != null ? `${item.distance} km` : 'Nearby'}
            </Text>
          </View>
        </View>

        <View style={s.cardActions}>
          <TouchableOpacity onPress={onRemove} style={s.heartBtn}>
            <Ionicons name="heart" size={20} color={C.red} />
          </TouchableOpacity>
          <View style={s.visitBtn}>
            <Ionicons name="arrow-forward" size={14} color={C.primary} />
          </View>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

// ── EmptyState ────────────────────────────────────────────────────────────────
function EmptyState() {
  return (
    <View style={s.empty}>
      <View style={s.emptyCircle}>
        <Ionicons name="heart-outline" size={36} color={C.textLo} />
      </View>
      <Text style={s.emptyTitle}>Nothing saved yet</Text>
      <Text style={s.emptySub}>Shops you favourite will appear here</Text>
    </View>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────────
export default function Favorites() {
  const router   = useRouter();
  const pathname = usePathname();

  const [shops,   setShops]   = useState([]);
  const [loading, setLoading] = useState(true);

  // Track whether this screen is currently focused
  const isFocused    = useRef(false);
  const intervalRef  = useRef(null);
  const appStateSub  = useRef(null);

  // ── Core fetch ─────────────────────────────────────────────────────────────
  const fetchFavorites = useCallback(async (showSpinner = false) => {
    try {
      if (showSpinner) setLoading(true);

      const [user_id, lat, lon] = await AsyncStorage.multiGet(['user_id', 'lat', 'lon'])
        .then((pairs) => pairs.map(([, v]) => v));

      const res = await fetch(
        `${BASE_URL}/api/favorites/${user_id}/?lat=${lat}&lon=${lon}`,
      );
      if (!res.ok) return;

      const data = await res.json();
      setShops(Array.isArray(data) ? data : []);
    } catch {
      // silent — don't crash the UI on transient network errors
    } finally {
      setLoading(false);
    }
  }, []);

  // ── Start / stop the background poll ──────────────────────────────────────
  const startPolling = useCallback(() => {
    if (intervalRef.current) return; // already running
    intervalRef.current = setInterval(fetchFavorites, POLL_INTERVAL);
  }, [fetchFavorites]);

  const stopPolling = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  // ── Focus lifecycle: fetch immediately + start/stop poll ──────────────────
  useFocusEffect(
    useCallback(() => {
      isFocused.current = true;
      fetchFavorites(true); // show spinner on first focus
      startPolling();

      // Also pause/resume poll when app is backgrounded while this tab is active
      appStateSub.current = AppState.addEventListener('change', (state) => {
        if (!isFocused.current) return;
        if (state === 'active') {
          fetchFavorites();  // immediate refresh on foreground
          startPolling();
        } else {
          stopPolling();     // no requests while app is in background
        }
      });

      return () => {
        isFocused.current = false;
        stopPolling();
        appStateSub.current?.remove();
        appStateSub.current = null;
      };
    }, [fetchFavorites, startPolling, stopPolling]),
  );

  // ── Remove favourite (optimistic) ─────────────────────────────────────────
  const removeFavorite = useCallback(async (shop_id) => {
    // Optimistic UI update
    setShops((prev) => prev.filter((sh) => sh.id !== shop_id));
    try {
      const [[, token], [, access]] = await AsyncStorage.multiGet(['token', 'access_token']);
      await fetch(`${BASE_URL}/api/favorite/toggle/`, {
        method:  'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization:  `Bearer ${token || access}`,
        },
        body: JSON.stringify({ shop_id }),
      });
    } catch {
      // Rollback: re-fetch on failure so local state stays in sync
      fetchFavorites();
    }
  }, [fetchFavorites]);

  // ── Render item (stable reference) ────────────────────────────────────────
  const renderItem = useCallback(({ item }) => (
    <ShopCard
      item={item}
      onPress={() => router.push(`/shop/${item.id}`)}
      onRemove={() => removeFavorite(item.id)}
    />
  ), [router, removeFavorite]);

  const keyExtractor = useCallback((item) => item.id?.toString(), []);

  // ── Loading screen ────────────────────────────────────────────────────────
  if (loading) {
    return (
      <SafeAreaView style={s.safe}>
        <StatusBar style="dark" />
        <View style={s.centered}>
          <ActivityIndicator size="large" color={C.primary} />
        </View>
      </SafeAreaView>
    );
  }

  // ── Main render ───────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={s.safe}>
      <StatusBar style="dark" />

      {/* HEADER */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
          <Ionicons name="arrow-back" size={20} color={C.textHi} />
        </TouchableOpacity>

        <View>
          <Text style={s.headerTitle}>Saved Shops</Text>
          {shops.length > 0 && (
            <Text style={s.headerSub}>
              {shops.length} store{shops.length !== 1 ? 's' : ''} saved
            </Text>
          )}
        </View>

        {/* Spacer to balance back button */}
        <View style={{ width: 40 }} />
      </View>

      <AdBanner />

      {/* LIST */}
      <FlatList
        data={shops}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        contentContainerStyle={s.list}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={<EmptyState />}
      />

      {/* FOOTER NAV */}
      <View style={s.bottomNav}>
        <TouchableOpacity style={s.tab} onPress={() => router.push('/shop/home')}>
          <View style={[s.iconWrapper, pathname === '/shop/home' && s.activeTab]}>
            <Ionicons name="home" size={24} color={pathname === '/shop/home' ? '#fff' : '#888'} />
          </View>
        </TouchableOpacity>

        <TouchableOpacity style={s.tab} onPress={() => router.push('/favorites')}>
          <View style={[s.iconWrapper, pathname === '/favorites' && s.activeTab]}>
            <Ionicons name="heart-outline" size={24} color={pathname === '/favorites' ? '#fff' : '#888'} />
          </View>
        </TouchableOpacity>

        <TouchableOpacity style={s.tab} onPress={() => router.push('/profile')}>
          <View style={[s.iconWrapper, pathname === '/profile' && s.activeTab]}>
            <Ionicons name="person-outline" size={24} color={pathname === '/profile' ? '#fff' : '#888'} />
          </View>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  safe:    { flex: 1, backgroundColor: C.bg },
  centered:{ flex: 1, justifyContent: 'center', alignItems: 'center' },

  // HEADER
  header: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20, paddingTop: 16, paddingBottom: 14,
  },
  backBtn: {
    width: 40, height: 40, borderRadius: 14,
    backgroundColor: C.card, justifyContent: 'center', alignItems: 'center',
    borderWidth: 1, borderColor: C.border,
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 6, elevation: 2,
  },
  headerTitle: {
    fontSize: 20, fontWeight: '800', color: C.textHi,
    textAlign: 'center', letterSpacing: -0.4,
  },
  headerSub: {
    fontSize: 12, color: C.textMid, fontWeight: '500',
    textAlign: 'center', marginTop: 2,
  },

  // LIST
  list: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 120 },

  // CARD
  cardWrap: { marginBottom: 14 },
  card: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: C.card, borderRadius: 20,
    borderWidth: 1, borderColor: C.border, padding: 12,
    shadowColor: '#2F5D50', shadowOpacity: 0.07,
    shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 3,
  },
  cardImage: { width: 76, height: 76, borderRadius: 14, marginRight: 14 },
  cardBody:  { flex: 1, justifyContent: 'center' },
  cardName:  { fontSize: 16, fontWeight: '700', color: C.textHi, marginBottom: 5 },
  categoryPill: {
    alignSelf: 'flex-start', backgroundColor: C.primaryLt,
    paddingHorizontal: 9, paddingVertical: 3, borderRadius: 8, marginBottom: 6,
  },
  categoryText: { fontSize: 11, fontWeight: '700', color: C.primary, letterSpacing: 0.3 },
  locationRow:  { flexDirection: 'row', alignItems: 'center' },
  locationText: { fontSize: 12, color: C.textMid, fontWeight: '500' },

  // CARD ACTIONS
  cardActions: { alignItems: 'center', paddingLeft: 8, gap: 8 },
  heartBtn: {
    width: 36, height: 36, borderRadius: 12,
    backgroundColor: C.redLt, justifyContent: 'center', alignItems: 'center',
  },
  visitBtn: {
    width: 36, height: 36, borderRadius: 12,
    backgroundColor: C.primaryLt, justifyContent: 'center', alignItems: 'center',
  },

  // EMPTY STATE
  empty:       { alignItems: 'center', marginTop: 80 },
  emptyCircle: {
    width: 84, height: 84, borderRadius: 42,
    backgroundColor: C.card, borderWidth: 1, borderColor: C.border,
    justifyContent: 'center', alignItems: 'center', marginBottom: 18,
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 8, elevation: 2,
  },
  emptyTitle: { fontSize: 17, fontWeight: '700', color: C.textHi, marginBottom: 6 },
  emptySub: {
    fontSize: 13, color: C.textMid, fontWeight: '400',
    textAlign: 'center', paddingHorizontal: 40,
  },

  // FOOTER NAV
  bottomNav: {
    position: 'absolute', bottom: 10, alignSelf: 'center',
    flexDirection: 'row', width: '90%', backgroundColor: '#fff',
    borderRadius: 30, paddingVertical: 12, justifyContent: 'space-around',
    shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 }, elevation: 10,
  },
  tab:        { alignItems: 'center' },
  iconWrapper:{ padding: 10, borderRadius: 20 },
  activeTab:  { backgroundColor: '#2F5D50', transform: [{ scale: 1.1 }] },
});