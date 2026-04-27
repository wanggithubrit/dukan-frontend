import { Ionicons } from '@expo/vector-icons';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';
import * as Location from 'expo-location';
import { usePathname, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  Image,
  Linking,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AdBanner from '../../components/AdBanner';

const BASE_URL = 'http://10.194.216.149:8000';
const { width } = Dimensions.get('window');
const POLL_INTERVAL = 20_000;
const BANNER_INTERVAL = 6_000;

// ─── Palette ─────────────────────────────────────────────────────────────────
const C = {
  primary: '#1B6B50',
  primaryLight: '#EAF4EF',
  accent: '#22C55E',
  white: '#FFFFFF',
  bg: '#F2F5F4',
  card: '#FFFFFF',
  text: '#111111',
  textMid: '#555555',
  textLight: '#999999',
  border: '#EBEBEB',
  shadow: '#000000',
};

const avatars = {
  male_1: require('../../assets/avatars/man.png'),
  male_2: require('../../assets/avatars/woman.png'),
  female_1: require('../../assets/avatars/cat.png'),
  female_2: require('../../assets/avatars/panda.png'),
};

const CATEGORIES = [
  { name: 'All', icon: 'apps-outline' },
  { name: 'Grocery', icon: 'cart-outline' },
  { name: 'Footwear', icon: 'walk-outline' },
  { name: 'Fashion', icon: 'shirt-outline' },
  { name: 'Medicine', icon: 'medkit-outline' },
  { name: 'Electronics', icon: 'phone-portrait-outline' },
  { name: 'Bakeries', icon: 'cafe-outline' },
  { name: 'Rentals', icon: 'key-outline' },
  { name: 'Stationery', icon: 'pencil-outline' },
  { name: 'Furniture', icon: 'bed-outline' },
  { name: 'Books', icon: 'book-outline' },
  { name: 'Others', icon: 'grid-outline' },
];

const RANGES = [1, 5, 10, 25 , 'All'];

// ─── Pure helpers (outside component — never re-created) ──────────────────────
const getImageUrl = img =>
  !img ? 'https://via.placeholder.com/300'
    : img.startsWith('http') ? img
    : `${BASE_URL}${img}`;

const formatTime = date => {
  if (!date) return 'Recently';
  const diff = Math.floor((Date.now() - new Date(date)) / 60000);
  if (diff < 1) return 'Just now';
  if (diff < 60) return `${diff} min ago`;
  if (diff < 1440) return `${Math.floor(diff / 60)} hr ago`;
  return `${Math.floor(diff / 1440)} days ago`;
};

// ─── Skeleton pulse ───────────────────────────────────────────────────────────
const Skeleton = ({ style }) => {
  const opacity = useRef(new Animated.Value(0.3)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.3, duration: 700, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);
  return <Animated.View style={[{ backgroundColor: '#DDE2E0', borderRadius: 12 }, style, { opacity }]} />;
};

// ─── Shop card ────────────────────────────────────────────────────────────────
const ShopCard = ({ item, onPress }) => (
  <TouchableOpacity style={s.card} onPress={() => onPress(item.id)} activeOpacity={0.82}>
    <View style={[s.badge, { backgroundColor: item.is_open ? C.accent : C.textLight }]}>
      <Text style={s.badgeText}>{item.is_open ? 'Open' : 'Closed'}</Text>
    </View>
    <Image source={{ uri: getImageUrl(item.cover_image || item.image) }} style={s.cardImage} />
    <View style={s.cardInfo}>
      <Text style={s.cardName} numberOfLines={1}>{item.name}</Text>
      <Text style={s.cardMeta}>
        <FontAwesome name="location-arrow" size={11} color={C.textLight} /> {item.distance ? `${item.distance} km` : '—'}
      </Text>
      <Text style={s.cardMeta}>⏱ {formatTime(item.updated_at)}</Text>
    </View>
  </TouchableOpacity>
);

// ─── Product card ─────────────────────────────────────────────────────────────
const ProductCard = ({ item, onPress }) => (
  <TouchableOpacity style={s.card} onPress={() => onPress(item.shopId)} activeOpacity={0.82}>
    <Image source={{ uri: getImageUrl(item.image) }} style={s.cardImage} />
    <View style={s.cardInfo}>
      <Text style={s.cardName} numberOfLines={1}>{item.name}</Text>
      <Text style={s.cardMeta}>{item.shopName}</Text>
      <Text style={s.cardMeta}>{item.distance ? `${item.distance} km` : ''}</Text>
    </View>
  </TouchableOpacity>
);

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function Home() {
  const router = useRouter();
  const pathname = usePathname();

  const [user, setUser] = useState(null);
  const [localAvatar, setLocalAvatar] = useState(null);

  const [shops, setShops] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [city, setCity] = useState('Loading...');
  const coordsRef = useRef(null);

  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [range, setRange] = useState(5);

  const [showLocationInput, setShowLocationInput] = useState(false);
  const [manualCity, setManualCity] = useState('');
  const [suggestions, setSuggestions] = useState([]);

  const [featuredBanners, setFeaturedBanners] = useState([]);
  const [activeBanner, setActiveBanner] = useState(0);

  const bannerRef = useRef(null);
  const bannerWidth = width - 30;
  const hasInitialized = useRef(false);

  // ── Avatar ──
  useEffect(() => {
    AsyncStorage.getItem('avatar').then(saved => { if (saved) setLocalAvatar(saved); });
  }, []);

  // ── User ──
  const fetchUser = useCallback(async () => {
    try {
      const user_id = await AsyncStorage.getItem('user_id');
      const res = await fetch(`${BASE_URL}/api/user/${user_id}/`);
      if (!res.ok) return;
      const data = await res.json();
      setUser(data);
      if (data?.avatar) {
        AsyncStorage.setItem('avatar', data.avatar);
        setLocalAvatar(data.avatar);
      }
    } catch { /* silent */ }
  }, []);

  // ── Banners ──
  const fetchFeaturedBanners = useCallback(async () => {
    try {
      const res = await fetch(`${BASE_URL}/api/banners/featured/`);
      if (!res.ok) return;
      const data = await res.json();
      setFeaturedBanners(data);
    } catch { /* silent */ }
  }, []);

  // Auto-scroll banner
  useEffect(() => {
    if (featuredBanners.length < 2) return;
    const iv = setInterval(() => {
      setActiveBanner(prev => {
        const next = (prev + 1) % featuredBanners.length;
        bannerRef.current?.scrollTo({ x: next * bannerWidth, animated: true });
        return next;
      });
    }, BANNER_INTERVAL);
    return () => clearInterval(iv);
  }, [featuredBanners.length, bannerWidth]);

  const onBannerScroll = useCallback(e => {
    setActiveBanner(Math.round(e.nativeEvent.contentOffset.x / bannerWidth));
  }, [bannerWidth]);

  // ── Shops ──
  const fetchShops = useCallback(async (latArg, lonArg) => {
    try {
      let lat = latArg ?? coordsRef.current?.latitude;
      let lon = lonArg ?? coordsRef.current?.longitude;
      if (!lat || !lon) {
        const [[, storedLat], [, storedLon]] = await AsyncStorage.multiGet(['lat', 'lon']);
        lat = storedLat; lon = storedLon;
      }
      if (!lat || !lon) return;

      const rangeParam = range === 'All' ? '' : `&range=${range}`;
      const res = await fetch(`${BASE_URL}/api/shops/?lat=${lat}&lon=${lon}${rangeParam}`);
      if (!res.ok) return;
      const data = await res.json();
      if (!Array.isArray(data)) return;

      setShops(prev => JSON.stringify(prev) === JSON.stringify(data) ? prev : data);
      AsyncStorage.setItem('shops_cache', JSON.stringify(data));
    } catch { /* silent */ }
  }, [range]);

  // ── Location ──
  const getUserLocation = useCallback(async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') { setCity('Location Off'); setLoading(false); return; }

      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const { latitude, longitude } = loc.coords;

      await AsyncStorage.multiSet([['lat', String(latitude)], ['lon', String(longitude)]]);
      coordsRef.current = { latitude, longitude };

      const [geo] = await Promise.all([
        Location.reverseGeocodeAsync({ latitude, longitude }),
        fetchShops(latitude, longitude),
      ]);

      if (geo.length > 0) {
        const place = geo[0];
        const fullLocation = [place.name, place.city, place.region, place.country].filter(Boolean).join(', ');
        setCity(fullLocation);
        AsyncStorage.setItem('cached_city', fullLocation);
      }
    } catch { setCity('Error'); }
    finally { setLoading(false); }
  }, [fetchShops]);

  // ── Init ──
  useEffect(() => {
    const init = async () => {
      const [
        [, cached], [, cachedCity], [, cachedLat], [, cachedLon],
      ] = await AsyncStorage.multiGet(['shops_cache', 'cached_city', 'lat', 'lon']);

      if (cached) {
        try { setShops(JSON.parse(cached)); } catch { /* corrupt */ }
        setLoading(false);
      }
      if (cachedCity) setCity(cachedCity);
      if (cachedLat && cachedLon) {
        const c = { latitude: parseFloat(cachedLat), longitude: parseFloat(cachedLon) };
        coordsRef.current = c;
      }

      await Promise.all([fetchUser(), fetchFeaturedBanners()]);

      if (cachedLat && cachedLon) {
        fetchShops(parseFloat(cachedLat), parseFloat(cachedLon));
      } else {
        await getUserLocation();
      }
      hasInitialized.current = true;
    };
    init();
  }, []); // mount only

  // ── Focus refresh + poll ──
  useFocusEffect(
    useCallback(() => {
      if (!hasInitialized.current) return;
      const lat = coordsRef.current?.latitude;
      const lon = coordsRef.current?.longitude;
      if (lat && lon) { fetchShops(lat, lon); fetchUser(); }
      else getUserLocation();

      const iv = setInterval(() => {
        const la = coordsRef.current?.latitude;
        const lo = coordsRef.current?.longitude;
        if (la && lo) fetchShops(la, lo);
      }, POLL_INTERVAL);
      return () => clearInterval(iv);
    }, [fetchShops, fetchUser, getUserLocation])
  );

  // ── Derived: filtered shops + product results ──
  const { filteredShops, productResults } = useMemo(() => {
    if (!Array.isArray(shops)) return { filteredShops: [], productResults: [] };

    const query = search.toLowerCase();
    let filtered = [...shops];
    const products = [];

    if (query) {
      shops.forEach(shop => {
        (shop.items ?? []).forEach(item => {
          if (item.name?.toLowerCase().includes(query)) {
            products.push({ ...item, shopId: shop.id, shopName: shop.name, distance: shop.distance });
          }
        });
      });
      if (range !== 'All') {
        products.splice(0, products.length, ...products.filter(i => i.distance != null && Number(i.distance) <= range));
      }
      products.sort((a, b) => (a.distance || 999) - (b.distance || 999));
      filtered = filtered.filter(s => s.name?.toLowerCase().includes(query));
    }

    if (selectedCategory !== 'All') {
      filtered = filtered.filter(s => s.category?.toLowerCase() === selectedCategory.toLowerCase());
    }

    if (range !== 'All') {
      filtered = filtered.filter(s => s.distance != null && Number(s.distance) <= range);
    }
    filtered.sort((a, b) => (a.distance || 999) - (b.distance || 999));

    return { filteredShops: filtered, productResults: products };
  }, [shops, search, selectedCategory, range]);

  // ── Location search ──
  const handleSearchLocation = useCallback(async text => {
    setManualCity(text);
    if (text.length < 3) { setSuggestions([]); return; }
    try {
      const geo = await Location.geocodeAsync(text);
      const results = await Promise.all(
        geo.slice(0, 5).map(async (item, index) => {
          const rev = await Location.reverseGeocodeAsync({ latitude: item.latitude, longitude: item.longitude });
          const place = rev[0];
          const name = [place?.name, place?.city, place?.region, place?.country].filter(Boolean).join(', ');
          return { id: index, latitude: item.latitude, longitude: item.longitude, name: name || 'Unknown location' };
        })
      );
      setSuggestions(results);
    } catch { /* silent */ }
  }, []);

  const selectSuggestion = useCallback(async item => {
    try {
      setLoading(true);
      setCity(item.name);
      AsyncStorage.setItem('cached_city', item.name);
      coordsRef.current = { latitude: item.latitude, longitude: item.longitude };
      await fetchShops(item.latitude, item.longitude);
    } catch { /* silent */ }
    finally {
      setShowLocationInput(false);
      setSuggestions([]);
      setManualCity('');
      setLoading(false);
    }
  }, [fetchShops]);

  // ── Pull to refresh ──
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const lat = coordsRef.current?.latitude;
      const lon = coordsRef.current?.longitude;
      await Promise.all([fetchShops(lat, lon), fetchFeaturedBanners(), fetchUser()]);
    } catch { /* silent */ }
    finally { setRefreshing(false); }
  }, [fetchShops, fetchFeaturedBanners, fetchUser]);

  const navigateToShop = useCallback(id => router.push(`/shop/${id}`), [router]);

  const toggleLocation = useCallback(() => setShowLocationInput(p => !p), []);

  const displayCity = useMemo(() => city.split(',').slice(0, 2).join(','), [city]);

  // ── Skeleton on cold start ──
  if (loading && shops.length === 0) {
    return (
      <SafeAreaView edges={['top']} style={s.safe}>
        <StatusBar style="dark" />
        <View style={s.skeletonHeader}>
          <Skeleton style={{ width: 40, height: 40, borderRadius: 10 }} />
          <Skeleton style={{ width: 140, height: 18, marginLeft: 10 }} />
          <Skeleton style={{ width: 40, height: 40, borderRadius: 20, marginLeft: 'auto' }} />
        </View>
        <Skeleton style={{ height: 50, marginHorizontal: 15, borderRadius: 30, marginBottom: 20 }} />
        <View style={{ flexDirection: 'row', gap: 10, paddingHorizontal: 15, marginBottom: 16 }}>
          {[1, 2, 3].map(i => <Skeleton key={i} style={{ width: 80, height: 70, borderRadius: 18 }} />)}
        </View>
        <Skeleton style={{ height: 110, marginHorizontal: 15, borderRadius: 20, marginBottom: 16 }} />
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, paddingHorizontal: 15 }}>
          {[1, 2, 3, 4].map(i => <Skeleton key={i} style={{ width: (width - 40) / 2, height: 150, borderRadius: 18 }} />)}
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={['top']} style={s.safe}>
      <StatusBar style="dark" />

      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.primary} />}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 100 }}
        keyboardShouldPersistTaps="handled"
      >
        {/* HEADER */}
        <View style={s.header}>
          <View style={s.headerLeft}>
            <Image source={require('../../assets/images/logo_round.png')} style={s.logo} />
            <TouchableOpacity style={s.locationBox} onPress={toggleLocation} activeOpacity={0.7}>
              <Ionicons name="location-outline" size={20} color={C.primary} style={{ marginLeft: -8 }} />
              <Text numberOfLines={1} style={s.locationText}>{displayCity}</Text>
              <Ionicons name={showLocationInput ? 'chevron-up' : 'chevron-down'} size={14} color={C.textLight} />
            </TouchableOpacity>
          </View>
          <TouchableOpacity onPress={() => router.push('/profile')} activeOpacity={0.8}>
            <Image source={avatars[user?.avatar || localAvatar || 'male_1']} style={s.headerAvatar} />
          </TouchableOpacity>
        </View>

        {/* LOCATION DROPDOWN */}
        {showLocationInput && (
          <View style={s.dropdown}>
            <TouchableOpacity style={s.useCurrent} onPress={getUserLocation} activeOpacity={0.7}>
              <Ionicons name="locate" size={16} color={C.primary} />
              <Text style={{ marginLeft: 8, color: C.primary, fontWeight: '600' }}>Use Current Location</Text>
            </TouchableOpacity>
            <TextInput
              placeholder="Search location..."
              placeholderTextColor={C.textLight}
              value={manualCity}
              onChangeText={handleSearchLocation}
              style={s.locationInput}
            />
            {suggestions.map(item => (
              <TouchableOpacity key={item.id} style={s.suggestion} onPress={() => selectSuggestion(item)} activeOpacity={0.7}>
                <Ionicons name="location-outline" size={16} color={C.textLight} />
                <Text style={{ marginLeft: 8, flex: 1, color: C.text, fontSize: 13 }}>{item.name}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* SEARCH */}
        <View style={s.searchBar}>
          <Ionicons name="search-outline" size={20} color={C.textLight} style={{ marginRight: 8 }} />
          <TextInput
            placeholder="Search shops or products..."
            placeholderTextColor={C.textLight}
            value={search}
            onChangeText={setSearch}
            style={s.searchInput}
            selectionColor={C.primary}
            returnKeyType="search"
            underlineColorAndroid="transparent"
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch('')} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Ionicons name="close-circle" size={18} color={C.textLight} />
            </TouchableOpacity>
          )}
        </View>

        {/* PRODUCT RESULTS */}
        {productResults.length > 0 && (
          <>
            <View style={s.sectionHeader}>
              <Text style={s.sectionTitle}>Products</Text>
              <Text style={s.viewAll}>{productResults.length} found</Text>
            </View>
            <View style={s.grid}>
              {productResults.map((item, i) => (
                <ProductCard key={`prod-${item.shopId}-${i}`} item={item} onPress={navigateToShop} />
              ))}
            </View>
          </>
        )}

        {/* RANGE */}
        <View style={s.rangeContainer}>
          <Text style={s.rangeLabel}>Range</Text>
          {RANGES.map(r => (
            <TouchableOpacity
              key={r}
              style={[s.rangeBtn, range === r && s.rangeBtnActive]}
              onPress={() => setRange(r)}
              activeOpacity={0.75}
            >
              <Text style={[s.rangeBtnText, range === r && s.rangeBtnTextActive]}>{r === 'All' ? 'All' : `${r} km`}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* CATEGORIES */}
        <View style={s.sectionHeader}>
          <Text style={s.sectionTitle}>Explore Categories</Text>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingLeft: 15 }}>
          {CATEGORIES.map(cat => {
            const active = selectedCategory === cat.name;
            return (
              <TouchableOpacity
                key={cat.name}
                onPress={() => setSelectedCategory(cat.name)}
                style={[s.category, active && s.categoryActive]}
                activeOpacity={0.75}
              >
                <Ionicons name={cat.icon} size={20} color={active ? C.white : C.primary} />
                <Text style={[s.categoryText, { color: active ? C.white : C.text }]}>{cat.name}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
          <AdBanner />
        {/* BANNERS */}
        {featuredBanners.length > 0 && (
          <View style={{ marginVertical: 15, paddingHorizontal: 15 }}>
            <ScrollView
              ref={bannerRef}
              horizontal pagingEnabled
              showsHorizontalScrollIndicator={false}
              snapToInterval={bannerWidth}
              decelerationRate="fast"
              onScroll={onBannerScroll}
              scrollEventThrottle={16}
            >
              {featuredBanners.map(b => (
                <TouchableOpacity
                  key={b.id}
                  activeOpacity={0.9}
                  onPress={() => b.link?.startsWith('http') && Linking.openURL(b.link)}
                  style={{ width: bannerWidth, justifyContent: 'center' }}
                >
                  {b.banner_type === 'image' && b.image ? (
                    <View>
                      <Image source={{ uri: b.image }} style={{ width: '100%', height: 110, borderRadius: 20 }} resizeMode="cover" />
                      {b.link && (
                        <Ionicons name="open-outline" size={16} color={C.white}
                          style={{ position: 'absolute', top: 10, right: 10, backgroundColor: 'rgba(0,0,0,0.4)', padding: 6, borderRadius: 50 }} />
                      )}
                    </View>
                  ) : (
                    <View style={{ height: 110, borderRadius: 20, padding: 18, justifyContent: 'center', backgroundColor: b.background_color || C.primary, overflow: 'hidden' }}>
                      {b.link && (
                        <Ionicons name="open-outline" size={16} color={C.white}
                          style={{ position: 'absolute', top: 10, right: 10, backgroundColor: 'rgba(0,0,0,0.3)', padding: 6, borderRadius: 50 }} />
                      )}
                      <Ionicons name="storefront-outline" size={80} color="rgba(255,255,255,0.08)" style={{ position: 'absolute', top: 10, right: 10 }} />
                      <Ionicons name="pricetags-outline" size={60} color="rgba(255,255,255,0.05)" style={{ position: 'absolute', bottom: 10, left: 10 }} />
                      <View style={{ gap: 6 }}>
                        <Text style={{ color: '#ffffffcc', fontSize: 10 }}>{b.small_text || 'DUKAN APP'}</Text>
                        <Text style={{ color: C.white, fontSize: 20, fontWeight: '800' }}>{b.title || 'Save your time and energy'}</Text>
                        <Text style={{ color: '#ffffffcc', fontSize: 11 }}>{b.subtitle || 'Find nearby shops instantly'}</Text>
                      </View>
                    </View>
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
            <View style={{ flexDirection: 'row', justifyContent: 'center', marginTop: 8 }}>
              {featuredBanners.map((_, i) => (
                <View
                  key={i}
                  style={{
                    width: activeBanner === i ? 16 : 6, height: 6, borderRadius: 3,
                    backgroundColor: activeBanner === i ? C.primary : '#ccc', marginHorizontal: 3,
                  }}
                />
              ))}
            </View>
          </View>
        )}

        {/* SHOPS */}
        <View style={s.sectionHeader}>
          <Text style={s.sectionTitle}>Nearby Shops</Text>
          <Text style={s.viewAll}>{filteredShops.length} shops</Text>
        </View>

        {filteredShops.length === 0 ? (
          <Text style={{ textAlign: 'center', marginTop: 20, color: C.textMid }}>No shops found 😕</Text>
        ) : (
          <View style={s.grid}>
            {filteredShops.map(item => (
              <ShopCard key={item.id} item={item} onPress={navigateToShop} />
            ))}
          </View>
        )}
      </ScrollView>

      {/* ── NAV (unchanged) ── */}
      <View style={s.bottomNav}>
        <TouchableOpacity style={s.tab} onPress={() => router.push('/shop/home')}>
          <View style={[s.iconWrapper, pathname === '/shop/home' && s.activeTab]}>
            <Ionicons name="home" size={24} color={pathname === '/shop/home' ? C.white : '#888'} />
          </View>
        </TouchableOpacity>
        <TouchableOpacity style={s.tab} onPress={() => router.push('/favorites')}>
          <View style={[s.iconWrapper, pathname === '/favorites' && s.activeTab]}>
            <Ionicons name="heart-outline" size={24} color={pathname === '/favorites' ? C.white : '#888'} />
          </View>
        </TouchableOpacity>
        <TouchableOpacity style={s.tab} onPress={() => router.push('/profile')}>
          <View style={[s.iconWrapper, pathname === '/profile' && s.activeTab]}>
            <Ionicons name="person-outline" size={24} color={pathname === '/profile' ? C.white : '#888'} />
          </View>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  safe: {
    flex: 1, backgroundColor: C.bg,
    marginTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
  },

  // Skeleton
  skeletonHeader: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 15, paddingTop: 5, paddingBottom: 14 },

  // Header
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 15, paddingTop: 5, paddingBottom: 10,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  logo: { width: 40, height: 40, borderRadius: 10 },
  locationBox: { flexDirection: 'row', alignItems: 'center', marginLeft: 8, flex: 1 },
  locationText: { fontWeight: '500', marginLeft: 2, fontSize: 13, color: C.text, flex: 1 },
  headerAvatar: { width: 40, height: 40, borderRadius: 20, borderWidth: 1.5, borderColor: C.primary },

  // Dropdown
  dropdown: { backgroundColor: C.white, marginHorizontal: 15, borderRadius: 16, padding: 10, marginBottom: 8, shadowColor: C.shadow, shadowOpacity: 0.07, shadowRadius: 10, elevation: 4 },
  locationInput: { paddingHorizontal: 10, paddingVertical: 8, fontSize: 14, color: C.text, borderTopWidth: 1, borderColor: C.border },
  suggestion: { flexDirection: 'row', padding: 10, alignItems: 'center', borderTopWidth: 1, borderColor: C.border },
  useCurrent: { flexDirection: 'row', alignItems: 'center', padding: 10 },

  // Search
  searchBar: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: C.white, marginHorizontal: 15, borderRadius: 30,
    paddingHorizontal: 15, height: 50, marginBottom: 20,
    elevation: 2, shadowColor: C.shadow, shadowOpacity: 0.06, shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
  },
  searchInput: {
    flex: 1, height: '100%', fontSize: 15, color: C.text,
    paddingVertical: 0, includeFontPadding: false,
  },

  // Range
  rangeContainer: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 15, marginVertical: 10, flexWrap: 'wrap', gap: 6 },
  rangeLabel: { fontSize: 14, fontWeight: '700', color: C.text, marginRight: 8 },
  rangeBtn: { paddingHorizontal: 12, paddingVertical: 5, backgroundColor: '#E8EDEC', borderRadius: 12 },
  rangeBtnActive: { backgroundColor: C.primary },
  rangeBtnText: { fontSize: 13, color: C.text },
  rangeBtnTextActive: { color: C.white, fontWeight: '600' },

  // Categories
  category: {
    alignItems: 'center', marginRight: 10, backgroundColor: C.white,
    paddingVertical: 8, paddingHorizontal: 14, borderRadius: 18,
    width: 80, borderWidth: 1, borderColor: C.border,
  },
  categoryActive: { backgroundColor: C.primary, borderColor: C.primary },
  categoryText: { marginTop: 5, fontSize: 11, textAlign: 'center' },

  // Section
  sectionHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 15, marginTop: 15, marginBottom: 10,
  },
  sectionTitle: { fontWeight: '700', fontSize: 16, color: C.text },
  viewAll: { color: C.primary, fontSize: 13, fontWeight: '600' },

  // Grid / cards
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', paddingHorizontal: 15 },
  card: {
    width: '48%', backgroundColor: C.white, borderRadius: 18,
    marginBottom: 10, overflow: 'hidden',
    shadowColor: C.shadow, shadowOpacity: 0.08, shadowRadius: 10, elevation: 4,
  },
  cardImage: { width: '100%', height: 100 },
  badge: { position: 'absolute', top: 6, left: 8, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, zIndex: 10 },
  badgeText: { color: C.white, fontSize: 10, fontWeight: '600' },
  cardInfo: { padding: 9 },
  cardName: { fontWeight: '700', fontSize: 13, marginBottom: 2, color: C.text },
  cardMeta: { fontSize: 11, color: C.textLight, marginTop: 1 },

  // Bottom nav (unchanged from original)
  bottomNav: {
    position: 'absolute', bottom: 10, alignSelf: 'center',
    flexDirection: 'row', width: '90%', backgroundColor: C.white,
    borderRadius: 30, paddingVertical: 12, justifyContent: 'space-around',
    shadowColor: C.shadow, shadowOpacity: 0.12, shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 }, elevation: 10,
  },
  tab: { alignItems: 'center' },
  iconWrapper: { padding: 10, borderRadius: 20 },
  activeTab: { backgroundColor: C.primary, transform: [{ scale: 1.1 }] },
});
