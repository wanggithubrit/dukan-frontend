import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';
import { usePathname, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useRef, useState } from 'react';
import { Image } from 'expo-image';
import {
  ActivityIndicator,
  Animated,
  AppState,
  FlatList,
  Platform,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AdBanner from '../components/AdBanner';


const BASE_URL = 'https://dukan-backend-0cc9.onrender.com';
const POLL_INTERVAL = 90_000; // 90 s — favorites change rarely; no need to hammer the API

// ── Design tokens ─────────────────────────────────────────────────────────────
const C = {
  bg:        '#F4F7F6',
  card:      '#FFFFFF',
  surface:   '#FFFFFF',   // ← add
  border:    '#E4EDE9',
  primary:   '#2F5D50',
  primaryLt: '#E8F3F0',
  textHi:    '#0F1F1B',
  textMid:   '#6B8A82',
  textLo:    '#A0BAB4',
  textMuted: '#9CAAA5',   // ← add
  white:     '#FFFFFF',   // ← add
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
  const isLocal = img.includes('localhost') || img.includes('127.0.0.1') || img.includes('10.14.104.206');
  if (img.startsWith('http://') && !isLocal) {
    img = img.replace('http://', 'https://');
  }
  if (img.startsWith('http')) {
    const isBaseProd = BASE_URL.includes('onrender.com') || BASE_URL.includes('mydukan.online');
    if (isLocal && isBaseProd) {
      const pathPart = img.replace(/^https?:\/\/[^\/]+/, '');
      return `${BASE_URL}/${pathPart.replace(/^\/+/, '')}`;
    }
    return img;
  }
  return `${BASE_URL}${img.startsWith('/') ? '' : '/'}${img}`;
};

const formatDist = (d) => {
  if (d == null) return 'Nearby';
  const distNum = +d;
  if (distNum < 1.0) {
    const meters = Math.round(distNum * 1000);
    return `Nearby (${meters}m)`;
  }
  return `Approx. ${distNum.toFixed(1)} km`;
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
              {formatDist(item.distance)}
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
  const [refreshing, setRefreshing] = useState(false);

  // Track whether this screen is currently focused
  const isFocused    = useRef(false);
  const intervalRef  = useRef(null);
  const appStateSub  = useRef(null);

  // ── Core fetch ─────────────────────────────────────────────────────────────
const fetchFavorites = useCallback(async (showSpinner = false) => {
  try {
    if (showSpinner) setLoading(true);
    else setRefreshing(true);

    const [[, t], [, at], [, lat], [, lon]] =
     await AsyncStorage.multiGet(['token', 'access_token', 'lat', 'lon']);
    const token = t || at;

    const res = await fetch(
      `${BASE_URL}/api/favorites/?lat=${lat}&lon=${lon}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    if (!res.ok) throw new Error();

    const data = await res.json();
    setShops(Array.isArray(data) ? data : []);
  } catch (e) {
    console.log("FAVORITES ERROR:", e);
  } finally {
    setLoading(false);
    setRefreshing(false);
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
  const previous = shops;

  setShops((prev) => prev.filter((sh) => sh.id !== shop_id));

  try {
    const [[, t], [, at]] = await AsyncStorage.multiGet(['token', 'access_token']);
    const token = t || at;

    const res = await fetch(`${BASE_URL}/api/favorite/toggle/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ shop_id }),
    });

    if (!res.ok) throw new Error();

  } catch {
    setShops(previous); // rollback
  }
}, [shops]);

  // ── Render item (stable reference) ────────────────────────────────────────
  const renderItem = useCallback(({ item }) => (
    <ShopCard
      item={item}
      onPress={() => router.push(`/shop/${item.id}`)}
      onRemove={() => removeFavorite(item.id)}
    />
  ), [router, removeFavorite]);

  const handleBack = useCallback(async () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      const role = await AsyncStorage.getItem('role');
      if (role === 'merchant') {
        router.replace('/merchant/home');
      } else {
        router.replace('/shop/home');
      }
    }
  }, [router]);

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
        <TouchableOpacity onPress={handleBack} style={s.backBtn}>
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
      <AdBanner/>

      {/* LIST */}
      <FlatList
        data={shops}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        contentContainerStyle={s.list}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={<EmptyState />}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => fetchFavorites(false)}
            tintColor={C.primary}
          />
        }
      />

      {/* ── BOTTOM NAV (matches Home page) ─────────────────────────────── */}
<View style={s.bottomNav}>
  {[
    { route: '/shop/home', icon: 'home',   iconOutline: 'home-outline',   label: 'Home'      },
    { route: '/favorites', icon: 'heart',  iconOutline: 'heart-outline',  label: 'Saved'     },
    { route: '/profile',   icon: 'person', iconOutline: 'person-outline', label: 'Profile'   },
  ].map(tab => {
    const active = pathname === tab.route;
    return (
      <TouchableOpacity
        key={tab.route}
        style={s.navTab}
        onPress={() => router.push(tab.route)}
        activeOpacity={0.8}
      >
        <View style={[s.navIconWrap, active && s.navIconWrapActive]}>
          <Ionicons
            name={active ? tab.icon : tab.iconOutline}
            size={20}
            color={active ? C.white : C.textMuted}
          />
        </View>
        <Text style={[s.navLabel, active && s.navLabelActive]}>{tab.label}</Text>
      </TouchableOpacity>
    );
  })}
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

   // ── Bottom nav ─────────────────────────────────────────────────────────────
    bottomNav: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      flexDirection: 'row',
      backgroundColor: C.surface,
      borderTopWidth: 0.5,
      borderTopColor: C.border,
      paddingVertical: 10,
      paddingHorizontal: 10,
      paddingBottom: Platform.OS === 'ios' ? 24 : 10,
      justifyContent: 'space-around',
      alignItems: 'center',
      // shadow upward
      shadowColor: '#000',
      shadowOpacity: 0.08,
      shadowRadius: 16,
      shadowOffset: { width: 0, height: -4 },
      elevation: 12,
     
    },
    navTab: {
      alignItems: 'center',
      gap: 3,
      flex: 1,
      marginBottom: 7,
    },
    navIconWrap: {
      width: 42,
      height: 36,
      borderRadius: 18,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: -2,
    },
    navIconWrapActive: {
      backgroundColor: C.primary,
    },
    navLabel: {
      fontSize: 10,
      fontWeight: '600',
      color: C.textMuted,
    },
    navLabelActive: {
      color: C.primary,
    },
 
});