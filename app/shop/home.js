import { Ionicons } from '@expo/vector-icons';
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
import { registerForPushNotificationsAsync } from '../../utils/pushNotifications';

const BASE_URL= 'https://api.mydukan.online';
const { width } = Dimensions.get('window');
const POLL_INTERVAL = 20_000;
const BANNER_INTERVAL = 6_000;

// ─── Palette ──────────────────────────────────────────────────────────────────
const C = {
  primary: '#1B6B50',
  primaryLight: '#EAF4EF',
  accent: '#22C55E',
  accentSoft: '#DCFCE7',
  white: '#FFFFFF',
  bg: '#F2F5F4',
  card: '#FFFFFF',
  text: '#0F1F1A',
  textMid: '#4A5E57',
  textLight: '#9EB3AC',
  border: '#E4EDEA',
  shadow: '#1B6B50',
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

// Category colour map for tags on cards
const CATEGORY_COLORS = {
  Grocery:     { bg: '#DCFCE7', text: '#15803D' },
  Footwear:    { bg: '#FEF9C3', text: '#A16207' },
  Fashion:     { bg: '#FCE7F3', text: '#BE185D' },
  Medicine:    { bg: '#FEE2E2', text: '#DC2626' },
  Electronics: { bg: '#DBEAFE', text: '#1D4ED8' },
  Bakeries:    { bg: '#FEF3C7', text: '#B45309' },
  Rentals:     { bg: '#EDE9FE', text: '#7C3AED' },
  Stationery:  { bg: '#E0F2FE', text: '#0369A1' },
  Furniture:   { bg: '#F3E8FF', text: '#9333EA' },
  Books:       { bg: '#FFEDD5', text: '#EA580C' },
  Others:      { bg: '#F1F5F9', text: '#475569' },
};

const CATEGORY_ICONS = {
  Grocery:     'cart-outline',
  Footwear:    'walk-outline',
  Fashion:     'shirt-outline',
  Medicine:    'medkit-outline',
  Electronics: 'phone-portrait-outline',
  Bakeries:    'cafe-outline',
  Rentals:     'key-outline',
  Stationery:  'pencil-outline',
  Furniture:   'bed-outline',
  Books:       'book-outline',
  Others:      'grid-outline',
};

const RANGES = [1, 5, 10, 25, 'All'];

// ─── Pure helpers ─────────────────────────────────────────────────────────────
const getImageUrl = img =>
  !img ? 'https://via.placeholder.com/300'
    : img.startsWith('http') ? img
    : `${BASE_URL}${img}`;

const formatTime = date => {
  if (!date) return 'Recently';
  const diff = Math.floor((Date.now() - new Date(date)) / 60000);
  if (diff < 1) return 'Just now';
  if (diff < 60) return `${diff}m ago`;
  if (diff < 1440) return `${Math.floor(diff / 60)}h ago`;
  return `${Math.floor(diff / 1440)}d ago`;
};

// ─── Skeleton ─────────────────────────────────────────────────────────────────
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
  return <Animated.View style={[{ backgroundColor: '#D4E2DE', borderRadius: 12 }, style, { opacity }]} />;
};

// ─── Shop card ────────────────────────────────────────────────────────────────
const ShopCard = ({ item, onPress }) => {
  const catKey = item.category
    ? item.category.charAt(0).toUpperCase() + item.category.slice(1).toLowerCase()
    : null;
  const catColor = CATEGORY_COLORS[catKey] || CATEGORY_COLORS.Others;
  const catIcon  = CATEGORY_ICONS[catKey] || 'grid-outline';

  return (
    <TouchableOpacity style={s.card} onPress={() => onPress(item.id)} activeOpacity={0.82}>
      {/* Cover image */}
      <View style={s.cardImageWrap}>
        <Image
          source={{ uri: getImageUrl(item.cover_image || item.image) }}
          style={s.cardImage}
          resizeMode="cover"
        />
        {/* Open/Closed pill */}
        <View style={[s.statusPill, { backgroundColor: item.is_open ? C.accent : '#94A3B8' }]}>
          <View style={[s.statusDot, { backgroundColor: item.is_open ? '#fff' : '#CBD5E1' }]} />
          <Text style={s.statusText}>{item.is_open ? 'Open' : 'Closed'}</Text>
        </View>
      </View>

      {/* Info */}
      <View style={s.cardInfo}>
        <Text style={s.cardName} numberOfLines={1}>{item.name}</Text>

        {/* Category tag */}
        {catKey && catKey !== 'All' && (
          <View style={[s.catTag, { backgroundColor: catColor.bg }]}>
            <Ionicons name={catIcon} size={9} color={catColor.text} />
            <Text style={[s.catTagText, { color: catColor.text }]}>{catKey}</Text>
          </View>
        )}

        {/* Meta row */}
        <View style={s.metaRow}>
          {item.distance != null && (
            <View style={s.metaChip}>
              <Ionicons name="navigate-outline" size={9} color={C.primary} />
              <Text style={[s.metaText, { color: C.primary }]}>{item.distance} km</Text>
            </View>
          )}
          <Text style={s.timeText}>{formatTime(item.updated_at)}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
};

// ─── Product card ─────────────────────────────────────────────────────────────
const ProductCard = ({ item, onPress }) => (
  <TouchableOpacity style={s.card} onPress={() => onPress(item.shopId)} activeOpacity={0.82}>
    <View style={s.cardImageWrap}>
      <Image source={{ uri: getImageUrl(item.image) }} style={s.cardImage} resizeMode="cover" />
    </View>
    <View style={s.cardInfo}>
      <Text style={s.cardName} numberOfLines={1}>{item.name}</Text>
      <Text style={s.shopNameText} numberOfLines={1}>{item.shopName}</Text>
      <View style={s.metaRow}>
        {item.distance != null && (
          <View style={s.metaChip}>
            <Ionicons name="navigate-outline" size={9} color={C.primary} />
            <Text style={[s.metaText, { color: C.primary }]}>{item.distance} km</Text>
          </View>
        )}
      </View>
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

  const [, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const [shopPage, setShopPage] = useState(1);
  const [productPage, setProductPage] = useState(1);

  const PAGE_SIZE = 6; // items per page

  useEffect(() => { setShopPage(1); setProductPage(1); }, [search, selectedCategory, range]);

  const bannerRef = useRef(null);
  const bannerWidth = width - 32;
  const hasInitialized = useRef(false);


  // ── Avatar ──
  useEffect(() => {
    AsyncStorage.getItem('avatar').then(saved => { if (saved) setLocalAvatar(saved); });
  }, []);

  const fetchNotifications = useCallback(async () => {
    try {
      const user_id = await AsyncStorage.getItem('user_id');
      if (!user_id) return;
      const res = await fetch(`${BASE_URL}/api/notifications/${user_id}/`);
      const data = await res.json();
      setNotifications(data);
      setUnreadCount(data.filter(n => !n.is_read).length);
    } catch { /* silent */ }
  }, []);

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

  useEffect(() => {
    const init = async () => {
      const [[, cached], [, cachedCity], [, cachedLat], [, cachedLon]] =
        await AsyncStorage.multiGet(['shops_cache', 'cached_city', 'lat', 'lon']);
      if (cached) { try { setShops(JSON.parse(cached)); } catch { } setLoading(false); }
      if (cachedCity) setCity(cachedCity);
      if (cachedLat && cachedLon) coordsRef.current = { latitude: parseFloat(cachedLat), longitude: parseFloat(cachedLon) };
      await Promise.all([fetchUser(), fetchFeaturedBanners(), fetchNotifications()]);
      try {
        const pushToken = await registerForPushNotificationsAsync();
        if (pushToken) await AsyncStorage.setItem('push_token', pushToken);
      } catch (err) { console.warn('Push registration failed:', err); }
      if (cachedLat && cachedLon) fetchShops(parseFloat(cachedLat), parseFloat(cachedLon));
      else await getUserLocation();
      hasInitialized.current = true;
    };
    init();
  }, [fetchUser, fetchFeaturedBanners, fetchNotifications, fetchShops, getUserLocation]);

  useFocusEffect(
    useCallback(() => {
      fetchNotifications();
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
    }, [fetchShops, fetchUser, getUserLocation, fetchNotifications])
  );

  const { filteredShops, productResults } = useMemo(() => {
    if (!Array.isArray(shops)) return { filteredShops: [], productResults: [] };
    const query = search.toLowerCase();
    let filtered = [...shops];
    const products = [];
    if (query) {
      shops.forEach(shop => {
        (shop.items ?? []).forEach(item => {
          if (item.name?.toLowerCase().includes(query))
            products.push({ ...item, shopId: shop.id, shopName: shop.name, distance: shop.distance });
        });
      });
      if (range !== 'All') products.splice(0, products.length, ...products.filter(i => i.distance != null && Number(i.distance) <= range));
      products.sort((a, b) => (a.distance || 999) - (b.distance || 999));
      filtered = filtered.filter(s => s.name?.toLowerCase().includes(query));
    }
    if (selectedCategory !== 'All') filtered = filtered.filter(s => s.category?.toLowerCase() === selectedCategory.toLowerCase());
    if (range !== 'All') filtered = filtered.filter(s => s.distance != null && Number(s.distance) <= range);
    filtered.sort((a, b) => (a.distance || 999) - (b.distance || 999));
    return { filteredShops: filtered, productResults: products };
  }, [shops, search, selectedCategory, range]);

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
    finally { setShowLocationInput(false); setSuggestions([]); setManualCity(''); setLoading(false); }
  }, [fetchShops]);

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

  // ── Skeleton cold start ──
  if (loading && shops.length === 0) {
    return (
      <SafeAreaView edges={['top']} style={s.safe}>
        <StatusBar style="dark" />
        <View style={s.skeletonHeader}>
          <Skeleton style={{ width: 36, height: 36, borderRadius: 10 }} />
          <Skeleton style={{ width: 130, height: 16, marginLeft: 10 }} />
          <Skeleton style={{ width: 36, height: 36, borderRadius: 18, marginLeft: 'auto' }} />
        </View>
        <Skeleton style={{ height: 46, marginHorizontal: 16, borderRadius: 14, marginBottom: 16 }} />
        <View style={{ flexDirection: 'row', gap: 8, paddingHorizontal: 16, marginBottom: 14 }}>
          {[1, 2, 3, 4].map(i => <Skeleton key={i} style={{ width: 72, height: 62, borderRadius: 14 }} />)}
        </View>
        <Skeleton style={{ height: 105, marginHorizontal: 16, borderRadius: 18, marginBottom: 14 }} />
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, paddingHorizontal: 16 }}>
          {[1, 2, 3, 4].map(i => <Skeleton key={i} style={{ width: (width - 42) / 2, height: 155, borderRadius: 16 }} />)}
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
        contentContainerStyle={{ paddingBottom: 96 }}
        keyboardShouldPersistTaps="handled"
      >
        {/* ── HEADER ── */}
        <View style={s.header}>
          <View style={s.headerLeft}>
            <Image source={require('../../assets/images/logo_round.png')} style={s.logo} />
            <TouchableOpacity style={s.locationBox} onPress={toggleLocation} activeOpacity={0.7}>
              <Ionicons name="location-outline" size={16} color={C.primary} />
              <Text numberOfLines={1} style={s.locationText}>{displayCity}</Text>
              <Ionicons name={showLocationInput ? 'chevron-up' : 'chevron-down'} size={12} color={C.textLight} />
            </TouchableOpacity>
          </View>
          <View style={s.headerRight}>
            {/* Notification bell */}
            <TouchableOpacity onPress={() => router.push('/notifications')} style={s.iconBtn} activeOpacity={0.7}>
              <Ionicons name="notifications-outline" size={22} color={C.text} />
              {unreadCount > 0 && (
                <View style={s.badge}>
                  <Text style={s.badgeText}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
                </View>
              )}
            </TouchableOpacity>
            {/* Avatar */}
            <TouchableOpacity onPress={() => router.push('/profile')} activeOpacity={0.8}>
              <Image source={avatars[user?.avatar || localAvatar || 'male_1']} style={s.headerAvatar} />
            </TouchableOpacity>
          </View>
        </View>

        {/* ── LOCATION DROPDOWN ── */}
        {showLocationInput && (
          <View style={s.dropdown}>
            <TouchableOpacity style={s.useCurrent} onPress={getUserLocation} activeOpacity={0.7}>
              <Ionicons name="locate" size={15} color={C.primary} />
              <Text style={s.useCurrentText}>Use Current Location</Text>
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
                <Ionicons name="location-outline" size={14} color={C.textLight} />
                <Text style={s.suggestionText} numberOfLines={1}>{item.name}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* ── SEARCH BAR ── */}
        <View style={s.searchBar}>
          <Ionicons name="search-outline" size={18} color={C.textLight} style={{ marginRight: 8 }} />
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
              <Ionicons name="close-circle" size={17} color={C.textLight} />
            </TouchableOpacity>
          )}
        </View>

        {/* ── PRODUCT RESULTS ── */}
        {productResults.length > 0 && (
  <>
    <View style={s.sectionHeader}>
      <Text style={s.sectionTitle}>Products</Text>
      <View style={s.countPill}><Text style={s.countPillText}>{productResults.length} found</Text></View>
    </View>
    <View style={s.grid}>
      {productResults.slice(0, productPage * PAGE_SIZE).map((item, i) => (
        <ProductCard key={`prod-${item.shopId}-${i}`} item={item} onPress={navigateToShop} />
      ))}
    </View>
    {productPage * PAGE_SIZE < productResults.length && (
      <TouchableOpacity style={s.loadMoreBtn} onPress={() => setProductPage(p => p + 1)} activeOpacity={0.75}>
        <Text style={s.loadMoreText}>Show more products</Text>
        <Ionicons name="chevron-down" size={14} color={C.primary} />
      </TouchableOpacity>
    )}
    {productPage * PAGE_SIZE >= productResults.length && productResults.length > PAGE_SIZE && (
      <TouchableOpacity style={s.loadMoreBtn} onPress={() => setProductPage(1)} activeOpacity={0.75}>
        <Text style={s.loadMoreText}>Show less</Text>
        <Ionicons name="chevron-up" size={14} color={C.primary} />
      </TouchableOpacity>
    )}
  </>
)}

        {/* ── RANGE SELECTOR ── */}
        <View style={s.rangeContainer}>
          <Text style={s.rangeLabel}>Distance</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
            {RANGES.map(r => (
              <TouchableOpacity
                key={r}
                style={[s.rangeBtn, range === r && s.rangeBtnActive]}
                onPress={() => setRange(r)}
                activeOpacity={0.75}
              >
                <Text style={[s.rangeBtnText, range === r && s.rangeBtnTextActive]}>
                  {r === 'All' ? 'Global' : `${r} km`}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* ── CATEGORIES ── */}
        <View style={s.sectionHeader}>
          <Text style={s.sectionTitle}>Categories</Text>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingLeft: 16, paddingRight: 8, gap: 8 }}>
          {CATEGORIES.map(cat => {
            const active = selectedCategory === cat.name;
            return (
              <TouchableOpacity
                key={cat.name}
                onPress={() => setSelectedCategory(cat.name)}
                style={[s.category, active && s.categoryActive]}
                activeOpacity={0.75}
              >
                <View style={[s.catIconWrap, active && s.catIconWrapActive]}>
                  <Ionicons name={cat.icon} size={18} color={active ? C.white : C.primary} />
                </View>
                <Text style={[s.categoryText, active && s.categoryTextActive]}>{cat.name}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        <AdBanner />

        {/* ── FEATURED BANNERS ── */}
        {featuredBanners.length > 0 && (
          <View style={{paddingHorizontal: 12}}>
            <ScrollView
              ref={bannerRef}
              horizontal pagingEnabled
              showsHorizontalScrollIndicator={false}
              snapToInterval={bannerWidth + 2}
              decelerationRate="fast"
              onScroll={onBannerScroll}
              scrollEventThrottle={16}
            >
              {featuredBanners.map(b => (
                <TouchableOpacity
                  key={b.id}
                  activeOpacity={0.9}
                  onPress={() => b.link?.startsWith('http') && Linking.openURL(b.link)}
                  style={{ width: bannerWidth, marginRight: 8, justifyContent: 'center' }}
                >
                  {b.banner_type === 'image' && b.image ? (
                    <View style={{ borderRadius: 18, overflow: 'hidden' }}>
                      <Image source={{ uri: b.image }} style={{ width: '100%', height: 105, borderRadius: 18 }} resizeMode="cover" />
                      {b.link && (
                        <Ionicons name="open-outline" size={14} color={C.white}
                          style={{ position: 'absolute', top: 9, right: 9, backgroundColor: 'rgba(0,0,0,0.35)', padding: 5, borderRadius: 50 }} />
                      )}
                    </View>
                  ) : (
                    <View style={{ height: 105, borderRadius: 18, padding: 16, justifyContent: 'center', backgroundColor: b.background_color || C.primary, overflow: 'hidden' }}>
                      {b.link && (
                        <Ionicons name="open-outline" size={14} color={C.white}
                          style={{ position: 'absolute', top: 9, right: 9, backgroundColor: 'rgba(0,0,0,0.3)', padding: 5, borderRadius: 50 }} />
                      )}
                      <Ionicons name="storefront-outline" size={72} color="rgba(255,255,255,0.08)" style={{ position: 'absolute', top: 8, right: 8 }} />
                      <View style={{ gap: 4 }}>
                        <Text style={{ color: '#ffffffbb', fontSize: 9, letterSpacing: 1, textTransform: 'uppercase' }}>{b.small_text || 'DUKAN APP'}</Text>
                        <Text style={{ color: C.white, fontSize: 18, fontWeight: '800', lineHeight: 22 }}>{b.title || 'Save your time and energy'}</Text>
                        <Text style={{ color: '#ffffffbb', fontSize: 11 }}>{b.subtitle || 'Find nearby shops instantly'}</Text>
                      </View>
                    </View>
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
            {/* Dots */}
            <View style={{ flexDirection: 'row', justifyContent: 'center', marginTop: 8, gap: 4 }}>
              {featuredBanners.map((_, i) => (
                <View
                  key={i}
                  style={{
                    width: activeBanner === i ? 18 : 5,
                    height: 5,
                    borderRadius: 3,
                    backgroundColor: activeBanner === i ? C.primary : '#C5D5D0',
                  }}
                />
              ))}
            </View>
          </View>
        )}

        {/* ── NEARBY SHOPS ── */}
        <View style={s.sectionHeader}>
          <Text style={s.sectionTitle}>Nearby Shops</Text>
          <View style={s.countPill}>
            <Text style={s.countPillText}>{filteredShops.length} shops</Text>
          </View>
        </View>

        {filteredShops.length === 0 ? (
  <View style={s.emptyState}>
    <Ionicons name="storefront-outline" size={40} color={C.textLight} />
    <Text style={s.emptyText}>No shops found nearby</Text>
  </View>
) : (
  <>
    <View style={s.grid}>
      {filteredShops.slice(0, shopPage * PAGE_SIZE).map(item => (
        <ShopCard key={item.id} item={item} onPress={navigateToShop} />
      ))}
    </View>
    {shopPage * PAGE_SIZE < filteredShops.length && (
      <TouchableOpacity style={s.loadMoreBtn} onPress={() => setShopPage(p => p + 1)} activeOpacity={0.75}>
        <Text style={s.loadMoreText}>Show more shops ({filteredShops.length - shopPage * PAGE_SIZE} remaining)</Text>
        <Ionicons name="chevron-down" size={14} color={C.primary} />
      </TouchableOpacity>
    )}
    {shopPage * PAGE_SIZE >= filteredShops.length && filteredShops.length > PAGE_SIZE && (
      <TouchableOpacity style={s.loadMoreBtn} onPress={() => setShopPage(1)} activeOpacity={0.75}>
        <Text style={s.loadMoreText}>Show less</Text>
        <Ionicons name="chevron-up" size={14} color={C.primary} />
      </TouchableOpacity>
    )}
  </>
)}
      </ScrollView>

      {/* ── BOTTOM NAV ── */}
      <View style={s.bottomNav}>
        {[
          { route: '/shop/home', icon: 'home', iconOutline: 'home-outline' },
          { route: '/favorites', icon: 'heart', iconOutline: 'heart-outline' },
          { route: '/profile', icon: 'person', iconOutline: 'person-outline' },
        ].map(tab => {
          const active = pathname === tab.route;
          return (
            <TouchableOpacity key={tab.route} style={s.tab} onPress={() => router.push(tab.route)} activeOpacity={0.75}>
              <View style={[s.iconWrapper, active && s.activeTab]}>
                <Ionicons name={active ? tab.icon : tab.iconOutline} size={22} color={active ? C.white : '#94A3B8'} />
              </View>
            </TouchableOpacity>
          );
        })}
      </View>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const CARD_WIDTH = (width - 42) / 2;

const s = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: C.bg,
    marginTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
  },

  // Skeleton
  skeletonHeader: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingTop: 4, paddingBottom: 12,
  },

  // Header
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16, paddingTop: 4, paddingBottom: 8,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', flex: 1, minWidth: 0 },
  logo: { width: 36, height: 36, borderRadius: 10 },
  locationBox: {
    flexDirection: 'row', alignItems: 'center',
    marginLeft: 8, flex: 1, gap: 3,
  },
  locationText: { fontWeight: '600', fontSize: 13, color: C.text, flex: 1 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 10, marginLeft: 8 },
  iconBtn: { padding: 2, position: 'relative' },
  headerAvatar: { width: 36, height: 36, borderRadius: 18, borderWidth: 1.5, borderColor: C.primary },

  // Notification badge
  badge: {
    position: 'absolute', top: -4, right: -4,
    backgroundColor: '#EF4444', borderRadius: 8,
    minWidth: 16, height: 16,
    paddingHorizontal: 3, alignItems: 'center', justifyContent: 'center',
  },
  badgeText: { color: '#fff', fontSize: 9, fontWeight: '700' },

  // Dropdown
  dropdown: {
    backgroundColor: C.white, marginHorizontal: 16, borderRadius: 14,
    padding: 8, marginBottom: 8,
    shadowColor: C.shadow, shadowOpacity: 0.08, shadowRadius: 12, elevation: 5,
  },
  locationInput: {
    paddingHorizontal: 10, paddingVertical: 8, fontSize: 13, color: C.text,
    borderTopWidth: 1, borderColor: C.border,
  },
  suggestion: {
    flexDirection: 'row', padding: 9, alignItems: 'center',
    borderTopWidth: 1, borderColor: C.border,
  },
  suggestionText: { marginLeft: 8, flex: 1, color: C.text, fontSize: 13 },
  useCurrent: { flexDirection: 'row', alignItems: 'center', padding: 9, gap: 6 },
  useCurrentText: { color: C.primary, fontWeight: '600', fontSize: 13 },

  // Search
  searchBar: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: C.white, marginHorizontal: 16, borderRadius: 14,
    paddingHorizontal: 14, height: 46, marginBottom: 14,
    elevation: 2, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
  searchInput: {
    flex: 1, height: '100%', fontSize: 14, color: C.text,
    paddingVertical: 0, includeFontPadding: false,
  },

  // Range
  rangeContainer: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, marginVertical: 8, gap: 8,
  },
  rangeLabel: { fontSize: 13, fontWeight: '700', color: C.text },
  rangeBtn: {
    paddingHorizontal: 12, paddingVertical: 5,
    backgroundColor: C.white, borderRadius: 10,
    borderWidth: 1, borderColor: C.border,
  },
  rangeBtnActive: { backgroundColor: C.primary, borderColor: C.primary },
  rangeBtnText: { fontSize: 12, color: C.textMid, fontWeight: '500' },
  rangeBtnTextActive: { color: C.white, fontWeight: '700' },

  // Categories
  category: {
    alignItems: 'center', backgroundColor: C.white,
    paddingVertical: 9, paddingHorizontal: 10,
    borderRadius: 14, width: 70,
    borderWidth: 1, borderColor: C.border,
  },
  categoryActive: { backgroundColor: C.primaryLight, borderColor: C.primary },
  catIconWrap: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: C.primaryLight,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 4,
  },
  catIconWrapActive: { backgroundColor: C.primary },
  categoryText: { fontSize: 10, textAlign: 'center', color: C.textMid, fontWeight: '500' },
  categoryTextActive: { color: C.primary, fontWeight: '700' },

  // Section header
  sectionHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16, marginTop: 14, marginBottom: 10,
  },
  sectionTitle: { fontWeight: '800', fontSize: 15, color: C.text },
  countPill: {
    backgroundColor: C.primaryLight, borderRadius: 8,
    paddingHorizontal: 8, paddingVertical: 3,
  },
  countPillText: { color: C.primary, fontSize: 11, fontWeight: '700' },

  // Grid
  grid: {
    flexDirection: 'row', flexWrap: 'wrap',
    paddingHorizontal: 16, gap: 10,
  },

  // Card
  card: {
    width: CARD_WIDTH,
    backgroundColor: C.white, borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#1B6B50', shadowOpacity: 0.07,
    shadowRadius: 8, elevation: 3,
    shadowOffset: { width: 0, height: 2 },
  },
  cardImageWrap: { position: 'relative' },
  cardImage: { width: '100%', height: 95 },

  // Status pill (replaces old badge)
  statusPill: {
    position: 'absolute', top: 7, left: 7,
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 7, paddingVertical: 3, borderRadius: 20, gap: 4,
  },
  statusDot: { width: 5, height: 5, borderRadius: 3 },
  statusText: { color: C.white, fontSize: 9, fontWeight: '700' },

  // Card info
  cardInfo: { padding: 9, gap: 4 },
  cardName: { fontWeight: '700', fontSize: 12.5, color: C.text, lineHeight: 16 },
  shopNameText: { fontSize: 11, color: C.textMid, fontWeight: '500' },

  // Category tag on card
  catTag: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    alignSelf: 'flex-start',
    paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6,
  },
  catTagText: { fontSize: 9.5, fontWeight: '700' },

  // Meta row
  metaRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginTop: 2,
  },
  metaChip: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: C.primaryLight,
    paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6,
  },
  metaText: { fontSize: 9.5, fontWeight: '600' },
  timeText: { fontSize: 9, color: C.textLight },

  // Empty state
  emptyState: { alignItems: 'center', marginTop: 32, gap: 8 },
  emptyText: { color: C.textMid, fontSize: 14, fontWeight: '500' },

  // Bottom nav
    bottomNav: {
    position: 'absolute', bottom: 10, alignSelf: 'center',
    flexDirection: 'row', width: '90%', backgroundColor: '#fff',
    borderRadius: 30, paddingVertical: 12, justifyContent: 'space-around',
    shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 }, elevation: 10,
  },
  tab:         { alignItems: 'center' },
  iconWrapper: { padding: 10, borderRadius: 20 },
  activeTab:   { backgroundColor: C.primary, transform: [{ scale: 1.1 }] },
  loadMoreBtn: {
  flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
  gap: 6, marginHorizontal: 16, marginTop: 10, marginBottom: 4,
  paddingVertical: 11, borderRadius: 12,
  backgroundColor: C.primaryLight,
  borderWidth: 1, borderColor: C.border,
},
loadMoreText: {
  color: C.primary, fontSize: 13, fontWeight: '700',
},
});