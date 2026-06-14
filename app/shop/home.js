import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';
import { Image } from 'expo-image';
import * as Location from 'expo-location';
import { usePathname, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    Animated,
    Dimensions,
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
import AppUpdateModal from '../../components/AppUpdateModal';
import { useTheme, getTheme } from '../../utils/theme';

import AdBanner from '../../components/AdBanner';
import { registerForPushNotificationsAsync } from '../../utils/pushNotifications';

// ═══════════════════════════════════════════════════════════════════════════
// CONSTANTS & DESIGN TOKENS
// ═══════════════════════════════════════════════════════════════════════════

const BASE_URL = 'https://dukan-backend-0cc9.onrender.com';
const { width } = Dimensions.get('window');
const POLL_INTERVAL = 60_000;
const BANNER_INTERVAL = 6_000;
const PAGE_SIZE = 6;
const CARD_WIDTH = (width - 52) / 2;

const C = {
  primary: '#0A5C43',
  primaryDark: '#074532',
  primaryMid: '#147A5A',
  primaryLight: '#E6F4EF',
  primaryLighter: '#F0F9F5',
  accent: '#17C26A',
  accentSoft: '#D1FAE5',
  accentVibrant: '#00D97E',

  white: '#FFFFFF',
  bg: '#F2F5F3',
  surface: '#FFFFFF',
  surfaceAlt: '#F8FAF9',
  text: '#0D1F19',
  textMid: '#354F44',
  textSoft: '#5F7A6E',
  textMuted: '#96ADA5',
  border: '#E0EAE6',
  borderMid: '#C5D8D1',
  borderStrong: '#A8C5BB',

  open: '#00C46A',
  openBg: '#CFFADF',
  closed: '#8FA9A0',
  closedBg: '#EEF3F1',
  warning: '#F5A524',
  warningBg: '#FEF3C7',
  danger: '#E5484D',
  dangerBg: '#FEE2E2',

  overlay: 'rgba(0,0,0,0.35)',
  overlayLight: 'rgba(0,0,0,0.18)',
};

let s = getStyles(getTheme());

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
  { name: 'Home & Kitchen', icon: 'home-outline' },
  { name: '🔧 Hardware & Tools', icon: 'construct-outline' },
  { name: 'Computers & Accessories', icon: 'laptop-outline' },
  { name: '🎁 Gifts & Toys', icon: 'gift-outline' },
  { name: 'Others', icon: 'grid-outline' },
];

const CATEGORY_COLORS = {
  Grocery: { bg: '#CFFADF', text: '#065F46', icon: '#00A854', activeBg: '#00A854' },
  Footwear: { bg: '#FEF3C7', text: '#7C4A00', icon: '#D97706', activeBg: '#D97706' },
  Fashion: { bg: '#FDE8F5', text: '#831B5C', icon: '#DB2777', activeBg: '#DB2777' },
  Medicine: { bg: '#FEE2E2', text: '#881B1B', icon: '#DC2626', activeBg: '#DC2626' },
  Electronics: { bg: '#DBEAFE', text: '#1A3A8A', icon: '#2563EB', activeBg: '#2563EB' },
  Bakeries: { bg: '#FEF3C7', text: '#7C4A00', icon: '#D97706', activeBg: '#D97706' },
  Rentals: { bg: '#EDE9FE', text: '#4C1D95', icon: '#7C3AED', activeBg: '#7C3AED' },
  Stationery: { bg: '#E0F2FE', text: '#0C4A6E', icon: '#0284C7', activeBg: '#0284C7' },
  Furniture: { bg: '#F5F3FF', text: '#4C1D95', icon: '#6D28D9', activeBg: '#6D28D9' },
  Books: { bg: '#FFF7ED', text: '#9A3412', icon: '#EA580C', activeBg: '#EA580C' },
  'Home & Kitchen': { bg: '#E6F4EE', text: '#0E5C42', icon: '#1B7A58', activeBg: '#1B7A58' },
  '🔧 Hardware & Tools': { bg: '#F3F4F6', text: '#374151', icon: '#4B5563', activeBg: '#4B5563' },
  'Computers & Accessories': { bg: '#EFF6FF', text: '#1E40AF', icon: '#3B82F6', activeBg: '#3B82F6' },
  '🎁 Gifts & Toys': { bg: '#FFF1F2', text: '#9F1239', icon: '#F43F5E', activeBg: '#F43F5E' },
  Others: { bg: '#F1F5F9', text: '#334155', icon: '#64748B', activeBg: '#475569' },
  All: { bg: '#E6F4EF', text: '#065F46', icon: '#0A5C43', activeBg: '#0A5C43' },
};

const CATEGORY_ICONS = {
  Grocery: 'cart-outline',
  Footwear: 'walk-outline',
  Fashion: 'shirt-outline',
  Medicine: 'medkit-outline',
  Electronics: 'phone-portrait-outline',
  Bakeries: 'cafe-outline',
  Rentals: 'key-outline',
  Stationery: 'pencil-outline',
  Furniture: 'bed-outline',
  Books: 'book-outline',
  'Home & Kitchen': 'home-outline',
  '🔧 Hardware & Tools': 'construct-outline',
  'Computers & Accessories': 'laptop-outline',
  '🎁 Gifts & Toys': 'gift-outline',
  Others: 'grid-outline',
};

const RANGES = [1, 5, 10, 25, 'All'];
const PREMIUM_PLANS = ['Pro', 'Business', 'Premium', 'pro', 'business', 'premium', 'pro_plus', 'pro plus'];
const PREMIUM_SET = new Set(PREMIUM_PLANS.map((p) => String(p).toLowerCase()));



const getImageUrl = (img) => {
  if (!img) return null;
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
  return `${BASE_URL}/${img.replace(/^\/+/, '')}`;
};

const formatTime = (date) => {
  if (!date) return 'Recently';
  const diff = Math.floor((Date.now() - new Date(date)) / 60000);
  if (diff < 1) return 'Just now';
  if (diff < 60) return `${diff}m ago`;
  if (diff < 1440) return `${Math.floor(diff / 60)}h ago`;
  return `${Math.floor(diff / 1440)}d ago`;
};

const formatDist = (d) => {
  if (d == null) return null;
  const distNum = +d;
  if (distNum < 1.0) {
    const meters = Math.round(distNum * 1000);
    return `Nearby (${meters}m)`;
  }
  return `Approx. ${distNum.toFixed(1)} km`;
};

const formatPrice = (price) => {
  if (price == null || price === '' || price === 0) return null;
  const num = parseFloat(price);
  if (isNaN(num)) return null;
  return `₹${num % 1 === 0 ? num.toFixed(0) : num.toFixed(2)}`;
};

const buildCityLabel = (place) => {
  if (!place) return null;
  const primary = place.district || place.subregion || place.city || place.name;
  const secondary = place.region || place.country;
  return [primary, secondary].filter(Boolean).join(', ');
};

const normalizeCatKey = (category) => {
  if (!category) return 'Others';
  const exactMatches = ['Home & Kitchen', '🔧 Hardware & Tools', 'Computers & Accessories', '🎁 Gifts & Toys'];
  const found = exactMatches.find(c => c.toLowerCase() === category.toLowerCase());
  if (found) return found;
  return category.charAt(0).toUpperCase() + category.slice(1).toLowerCase();
};

const getCategoryPlaceholderColor = (category) => {
  const map = {
    Grocery: '#C8E6CB',
    Footwear: '#FFF9C4',
    Fashion: '#F8BBD9',
    Medicine: '#FFCDD2',
    Electronics: '#BBDEFB',
    Bakeries: '#FFE082',
    Rentals: '#D1C4E9',
    Stationery: '#B3E5FC',
    Furniture: '#E1BEE7',
    Books: '#FFE0B2',
    'Home & Kitchen': '#C7E2D5',
    '🔧 Hardware & Tools': '#E5E7EB',
    'Computers & Accessories': '#DBEAFE',
    '🎁 Gifts & Toys': '#FFE4E6',
    Others: '#CFD8DC',
  };
  return map[normalizeCatKey(category)] || '#CFD8DC';
};

const getGreeting = () => {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
};

const toKm = (d) => (d == null || d === '') ? 999 : Number(d);

const byDistance = (a, b) => {
  const distA = toKm(a.distance);
  const distB = toKm(b.distance);
  if (distA !== distB) return distA - distB;
  // For equal distances, prefer paid/pro plans (explicit list) over Free
  const aPlan = String(a?.plan || '').toLowerCase();
  const bPlan = String(b?.plan || '').toLowerCase();
  const aPremium = PREMIUM_SET.has(aPlan);
  const bPremium = PREMIUM_SET.has(bPlan);
  if (aPremium && !bPremium) return -1;
  if (!aPremium && bPremium) return 1;
  return 0;
};

// ═══════════════════════════════════════════════════════════════════════════
// SKELETON LOADER
// ═══════════════════════════════════════════════════════════════════════════

const Skeleton = ({ style }) => {
  const opacity = useRef(new Animated.Value(0.35)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.85, duration: 900, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.35, duration: 900, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);

  return (
    <Animated.View
      style={[{ backgroundColor: '#C8DDD7', borderRadius: 12 }, style, { opacity }]}
    />
  );
};

// ═══════════════════════════════════════════════════════════════════════════
// ANIMATED PRESS WRAPPER
// ═══════════════════════════════════════════════════════════════════════════

const PressScale = ({ children, onPress, style, activeScale = 0.96 }) => {
  const scale = useRef(new Animated.Value(1)).current;

  const onIn = () =>
    Animated.spring(scale, {
      toValue: activeScale,
      useNativeDriver: true,
      speed: 60,
      bounciness: 2,
    }).start();

  const onOut = () =>
    Animated.spring(scale, {
      toValue: 1,
      useNativeDriver: true,
      speed: 60,
      bounciness: 2,
    }).start();

  return (
    <Animated.View style={[{ transform: [{ scale }] }, style]}>
      <TouchableOpacity
        onPress={onPress}
        onPressIn={onIn}
        onPressOut={onOut}
        activeOpacity={1}
      >
        {children}
      </TouchableOpacity>
    </Animated.View>
  );
};

// ═══════════════════════════════════════════════════════════════════════════
// MAGIC SPARKLE COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

const Sparkle = ({ size = 16, color = C.accent }) => (
  <Ionicons
    name="sparkles"
    size={size}
    color={color}
    style={{ opacity: 0.8 }}
  />
);

// ═══════════════════════════════════════════════════════════════════════════
// SHOP CARD
// ═══════════════════════════════════════════════════════════════════════════

const ShopCard = React.memo(({ item, onPress }) => {
  const planNorm = String(item?.plan || '').toLowerCase();
  const isPremium = PREMIUM_SET.has(planNorm);
  const catKey = normalizeCatKey(item.category);
  const catColor = CATEGORY_COLORS[catKey] || CATEGORY_COLORS.Others;
  const catIcon = CATEGORY_ICONS[catKey] || 'grid-outline';
  const dist = formatDist(item.distance);
  const imageUri = getImageUrl(item.cover_image || item.image);
  const placeholderBg = getCategoryPlaceholderColor(item.category);

  const isProPlus = planNorm === 'pro_plus';
  const isPro = planNorm === 'pro';

  return (
    <PressScale style={{ width: CARD_WIDTH }} onPress={() => onPress(item.id)}>
      <View style={[s.card, isProPlus && s.cardProPlus, isPro && s.cardPro]}>
        {/* Image Section */}
        <View style={s.cardImageWrap}>
          {imageUri ? (
            <>
              <Image source={{ uri: imageUri }} style={s.cardImage} resizeMode="cover" />
              <View style={s.cardImageScrim} />
            </>
          ) : (
            <View style={[s.cardImage, s.cardImagePlaceholder, { backgroundColor: placeholderBg }]}>
              <Ionicons
                name={catIcon}
                size={34}
                color={catColor.icon}
                style={{ opacity: 0.45 }}
              />
            </View>
          )}

          {/* Status Pill */}
          <View style={[s.statusPill, { backgroundColor: item.is_open ? C.openBg : C.closedBg }]}>
            <View
              style={[
                s.statusDot,
                { backgroundColor: item.is_open ? C.open : C.closed },
                item.is_open && s.statusDotGlow,
              ]}
            />
            <Text style={[s.statusText, { color: item.is_open ? '#065F46' : '#4F6B62' }]}>
              {item.is_open ? 'Open' : 'Closed'}
            </Text>
          </View>

          {/* Premium Badge */}
          {isPremium && (
            <View style={[s.premiumBadge, s.premiumGlow, { backgroundColor: '#EAB308' }]}> 
              <Ionicons name="star" size={12} color="#FFFFFF" />
            </View>
          )}
        </View>

        {/* Body Section */}
        <View style={s.cardBody}>
          <Text style={s.cardName} numberOfLines={1}>
            {item.name}
          </Text>

          {catKey && catKey !== 'All' && (
            <View
              style={[
                s.catTag,
                {
                  backgroundColor: catColor.bg + '40',
                  borderColor: catColor.icon + '30',
                  borderWidth: 1,
                },
              ]}
            >
              <Ionicons name={catIcon} size={9} color={catColor.icon} />
              <Text style={[s.catTagText, { color: catColor.text }]}>{catKey}</Text>
            </View>
          )}

          <View style={s.cardFooter}>
            {dist ? (
              <View style={s.distChip}>
                <Ionicons name="navigate" size={9} color={C.primary} />
                <Text style={s.distText}>{dist}</Text>
              </View>
            ) : (
              <View />
            )}
            <Text style={s.timeText}>{formatTime(item.updated_at)}</Text>
          </View>
        </View>
      </View>
    </PressScale>
  );
});
ShopCard.displayName = 'ShopCard';

// ═══════════════════════════════════════════════════════════════════════════
// PRODUCT CARD
// ═══════════════════════════════════════════════════════════════════════════

const ProductCard = React.memo(({ item, onPress }) => {
  const dist = formatDist(item.distance);
  const imageUri = getImageUrl(item.image);
  const price = formatPrice(item.price);

  return (
    <PressScale style={{ width: CARD_WIDTH }} onPress={() => onPress(item.shopId)}>
      <View style={s.card}>
        {/* Image Section */}
        <View style={s.cardImageWrap}>
          {imageUri ? (
            <>
              <Image source={{ uri: imageUri }} style={s.cardImage} resizeMode="cover" />
              <View style={s.cardImageScrim} />
            </>
          ) : (
            <View style={[s.cardImage, s.cardImagePlaceholder, { backgroundColor: '#EEF2F0' }]}>
              <Ionicons name="cube-outline" size={34} color="#94A3B8" style={{ opacity: 0.45 }} />
            </View>
          )}

          {/* Price Badge */}
          {price && (
            <View style={s.priceBadge}>
              <Text style={s.priceBadgeText}>{price}</Text>
            </View>
          )}
        </View>

        {/* Body Section */}
        <View style={s.cardBody}>
          <Text style={s.cardName} numberOfLines={1}>
            {item.name}
          </Text>

          {item.track_quantity && item.quantity_status === 'low' && (
            <View style={[s.stockBadge, { backgroundColor: C.warningBg }]}>
              <Ionicons name="warning-outline" size={9} color="#92400E" />
              <Text style={[s.stockText, { color: '#92400E' }]}>
                Only {item.quantity} left
              </Text>
            </View>
          )}

          {item.track_quantity && item.quantity_status === 'out' && (
            <View style={[s.stockBadge, { backgroundColor: C.dangerBg }]}>
              <Ionicons name="close-circle-outline" size={9} color="#991B1B" />
              <Text style={[s.stockText, { color: '#991B1B' }]}>Out of stock</Text>
            </View>
          )}

          <Text style={s.shopNameText} numberOfLines={1}>
            {item.shopName}
          </Text>

          {dist && (
            <View style={[s.distChip, { alignSelf: 'flex-start' }]}>
              <Ionicons name="navigate" size={9} color={C.primary} />
              <Text style={s.distText}>{dist}</Text>
            </View>
          )}
        </View>
      </View>
    </PressScale>
  );
});
ProductCard.displayName = 'ProductCard';

// ═══════════════════════════════════════════════════════════════════════════
// OPEN NOW CARD (HORIZONTAL)
// ═══════════════════════════════════════════════════════════════════════════

const OpenNowCard = React.memo(({ item, onPress }) => {
  const planNorm = String(item?.plan || '').toLowerCase();
  const isPremium = PREMIUM_SET.has(planNorm);
  const catKey = normalizeCatKey(item.category);
  const catColor = CATEGORY_COLORS[catKey] || CATEGORY_COLORS.Others;
  const dist = formatDist(item.distance);
  const imageUri = getImageUrl(item.cover_image || item.image);
  const placeholderBg = getCategoryPlaceholderColor(item.category);

  const isProPlus = planNorm === 'pro_plus';
  const isPro = planNorm === 'pro';

  return (
    <PressScale onPress={() => onPress(item.id)} activeScale={0.95}>
      <View style={[s.openNowCard, isProPlus && s.cardProPlus, isPro && s.cardPro]}>
        <View style={{ position: 'relative' }}>
          {imageUri ? (
            <>
              <Image source={{ uri: imageUri }} style={s.openNowImage} resizeMode="cover" />
              <View style={s.openNowScrim} />
            </>
          ) : (
            <View style={[s.openNowImage, s.cardImagePlaceholder, { backgroundColor: placeholderBg }]}>
              <Ionicons
                name={CATEGORY_ICONS[catKey] || 'storefront-outline'}
                size={26}
                color={catColor.icon}
                style={{ opacity: 0.45 }}
              />
            </View>
          )}

          {/* Live Indicator */}
          <View style={s.openNowOverlay}>
            <View style={[s.openNowLiveDot, s.openNowLiveDotGlow]} />
          </View>

          {/* Premium Badge */}
          {isPremium && (
            <View style={[s.premiumBadge, s.premiumGlow, { backgroundColor: '#EAB308' }]}> 
              <Ionicons name="star" size={10} color="#FFFFFF" />
            </View>
          )}
        </View>

        <View style={s.openNowBody}>
          <Text style={s.openNowName} numberOfLines={1}>
            {item.name}
          </Text>
          {catKey && catKey !== 'All' && (
            <Text style={[s.openNowCat, { color: catColor.icon }]}>{catKey}</Text>
          )}
          {dist && (
            <View style={[s.distChip, { marginTop: 4, alignSelf: 'flex-start' }]}>
              <Ionicons name="navigate" size={9} color={C.primary} />
              <Text style={s.distText}>{dist}</Text>
            </View>
          )}
        </View>
      </View>
    </PressScale>
  );
});
OpenNowCard.displayName = 'OpenNowCard';

// ═══════════════════════════════════════════════════════════════════════════
// SECTION HEADER
// ═══════════════════════════════════════════════════════════════════════════

const SectionHeader = ({ title, count, countColor, dotColor, subtitle }) => (
  <View style={s.sectionHeader}>
    <View style={{ flex: 1 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Text style={s.sectionTitle}>{title}</Text>
        <Sparkle size={14} color={C.accent} />
      </View>
      {subtitle ? <Text style={s.sectionSubtitle}>{subtitle}</Text> : null}
    </View>
    {count && (
      <View style={[s.countBadge, countColor && { backgroundColor: countColor }]}>
        {dotColor && <View style={[s.countDot, { backgroundColor: dotColor }]} />}
        <Text style={[s.countBadgeText, dotColor && { color: '#065F46' }]}>{count}</Text>
      </View>
    )}
  </View>
);

// ═══════════════════════════════════════════════════════════════════════════
// MAIN HOME COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

export default function Home() {
  const router = useRouter();
  const pathname = usePathname();
  const { theme: themeObj } = useTheme();
  s = getStyles(themeObj);

  // User & Location
  const [user, setUser] = useState(null);
  const [localAvatar, setLocalAvatar] = useState(null);
  const [shops, setShops] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [city, setCity] = useState('Loading...');
  const coordsRef = useRef(null);

  // Search & Filters
  const [search, setSearch] = useState('');
  const searchInputRef = useRef(null);
  const [searchFocused, setSearchFocused] = useState(false);
  const [onlyDeliverable, setOnlyDeliverable] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [range, setRange] = useState('All');

  // Banners & Notifications
  const [featuredBanners, setFeaturedBanners] = useState([]);
  const [activeBanner, setActiveBanner] = useState(0);
  const [, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);

  // Pagination
  const [shopPage, setShopPage] = useState(1);
  const [productPage, setProductPage] = useState(1);

  // Refs
  const bannerRef = useRef(null);
  const bannerWidth = width - 32;
  const hasInitialized = useRef(false);

  // Reset pagination when filters change
  useEffect(() => {
    setShopPage(1);
    setProductPage(1);
  }, [search, selectedCategory, range]);

  // Load cached avatar
  useEffect(() => {
    AsyncStorage.getItem('avatar').then((saved) => {
      if (saved) setLocalAvatar(saved);
    });
  }, []);

  // ─────────────────────────────────────────────────────────────────────────
  // API CALLS
  // ─────────────────────────────────────────────────────────────────────────

  const fetchNotifications = useCallback(async () => {
    try {
      const user_id = await AsyncStorage.getItem('user_id');
      if (!user_id) return;
      const res = await fetch(`${BASE_URL}/api/notifications/${user_id}/`);
      const data = await res.json();
      setNotifications(data);
      setUnreadCount(data.filter((n) => !n.is_read).length);
    } catch (e) {
      // silent fail
    }
  }, []);

  const fetchUser = useCallback(async () => {
    try {
      const user_id = await AsyncStorage.getItem('user_id');
      if (!user_id) return;
      const res = await fetch(`${BASE_URL}/api/user/${user_id}/`);
      if (res.status === 401) {
        await AsyncStorage.multiRemove(['token', 'user_id', 'user_role']);
        router.replace('/login');
        return;
      }
      if (!res.ok) return;
      const data = await res.json();
      setUser(data);
      if (data?.avatar) {
        AsyncStorage.setItem('avatar', data.avatar);
        setLocalAvatar(data.avatar);
      }
    } catch (e) {
      // silent fail
    }
  }, [router]);

  const fetchFeaturedBanners = useCallback(async (latArg, lonArg) => {
    try {
      let lat = latArg ?? coordsRef.current?.latitude;
      let lon = lonArg ?? coordsRef.current?.longitude;
      if (!lat || !lon) {
        const r = await AsyncStorage.multiGet(['lat', 'lon']);
        lat = r[0][1];
        lon = r[1][1];
      }
      let url = `${BASE_URL}/api/banners/featured/`;
      if (lat && lon) url += `?lat=${lat}&lon=${lon}`;
      const res = await fetch(url);
      if (!res.ok) return;
      const data = await res.json();
      setFeaturedBanners(data);
    } catch (e) {
      // silent fail
    }
  }, []);

  const fetchShops = useCallback(
    async (latArg, lonArg) => {
      try {
        let lat = latArg ?? coordsRef.current?.latitude;
        let lon = lonArg ?? coordsRef.current?.longitude;
        if (!lat || !lon) {
          const r = await AsyncStorage.multiGet(['lat', 'lon']);
          lat = r[0][1];
          lon = r[1][1];
        }

        const rangeParam = range === 'All' ? '' : `&range=${range}`;
        let url = `${BASE_URL}/api/shops/`;
        if (lat && lon) {
          url += `?lat=${lat}&lon=${lon}${rangeParam}`;
        } else if (rangeParam) {
          url += `?${rangeParam.replace('&', '')}`;
        }

        const res = await fetch(url);
        if (!res.ok) return;
        const data = await res.json();
        if (!Array.isArray(data)) return;

        setShops((prev) => {
          if (
            prev.length === data.length &&
            prev[0]?.id === data[0]?.id
          ) {
            return prev;
          }
          return data;
        });
        AsyncStorage.setItem('shops_cache', JSON.stringify(data));
      } catch (e) {
        // silent fail
      }
    },
    [range]
  );

  const getUserLocation = useCallback(async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setCity('Location Off');
        fetchShops(null, null);
        return;
      }

      // GPS Services enabled check
      const servicesEnabled = await Location.hasServicesEnabledAsync();
      if (!servicesEnabled) {
        setCity('GPS Disabled');
        fetchShops(null, null);
        return;
      }

      // Try last known position fallback for weak signal
      let loc = null;
      try {
        loc = await Location.getLastKnownPositionAsync({});
      } catch (e) {}

      if (!loc) {
        loc = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
      }

      const { latitude, longitude } = loc.coords;

      await AsyncStorage.multiSet([
        ['lat', String(latitude)],
        ['lon', String(longitude)],
      ]);
      coordsRef.current = { latitude, longitude };

      const [geo] = await Promise.all([
        Location.reverseGeocodeAsync({ latitude, longitude }),
        fetchShops(latitude, longitude),
      ]);

      if (geo?.length > 0) {
        const label = buildCityLabel(geo[0]);
        if (label) {
          setCity(label);
          AsyncStorage.setItem('cached_city', label);
        }
      }
    } catch (e) {
      setCity('Error');
    } finally {
      setLoading(false);
    }
  }, [fetchShops]);

  // ─────────────────────────────────────────────────────────────────────────
  // INITIALIZATION & FOCUS EFFECTS
  // ─────────────────────────────────────────────────────────────────────────

  useEffect(() => {
    const init = async () => {
      const results = await AsyncStorage.multiGet([
        'shops_cache',
        'cached_city',
        'lat',
        'lon',
      ]);
      const cached = results[0][1];
      const cachedCity = results[1][1];
      const cachedLat = results[2][1];
      const cachedLon = results[3][1];

      if (cached) {
        try {
          setShops(JSON.parse(cached));
        } catch (e) {
          // silent fail
        }
        setLoading(false);
      }

      if (cachedCity) setCity(cachedCity);

      if (cachedLat && cachedLon) {
        coordsRef.current = {
          latitude: parseFloat(cachedLat),
          longitude: parseFloat(cachedLon),
        };
      }

      await Promise.all([fetchUser(), fetchNotifications()]);

      try {
        const pushToken = await registerForPushNotificationsAsync();
        if (pushToken) await AsyncStorage.setItem('push_token', pushToken);
      } catch (e) {
        // silent fail
      }

      // Always request fresh location on startup to overwrite stale cached coordinates
      await getUserLocation();
      const { latitude: lat, longitude: lon } = coordsRef.current ?? {};
      if (lat && lon) {
        await Promise.all([
          fetchShops(lat, lon),
          fetchFeaturedBanners(lat, lon)
        ]);
      }

      hasInitialized.current = true;
    };

    init();
  }, [fetchUser, fetchFeaturedBanners, fetchNotifications, fetchShops, getUserLocation]);

  useFocusEffect(
    useCallback(() => {
      fetchNotifications();

      if (!hasInitialized.current) return;

      const { latitude: lat, longitude: lon } = coordsRef.current ?? {};
      if (lat && lon) {
        fetchShops(lat, lon);
        fetchUser();
      } else {
        getUserLocation();
      }

      const iv = setInterval(() => {
        const { latitude: la, longitude: lo } = coordsRef.current ?? {};
        if (la && lo) fetchShops(la, lo);
      }, POLL_INTERVAL);

      return () => clearInterval(iv);
    }, [fetchShops, fetchUser, getUserLocation, fetchNotifications])
  );

  // ─────────────────────────────────────────────────────────────────────────
  // BANNER AUTO-SCROLL
  // ─────────────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (featuredBanners.length < 2) return;

    const iv = setInterval(() => {
      setActiveBanner((prev) => {
        const next = (prev + 1) % featuredBanners.length;
        bannerRef.current?.scrollTo({ x: next * (bannerWidth + 8), animated: true });
        return next;
      });
    }, BANNER_INTERVAL);

    return () => clearInterval(iv);
  }, [featuredBanners.length, bannerWidth]);

  const onBannerScroll = useCallback((e) => {
    setActiveBanner(Math.round(e.nativeEvent.contentOffset.x / (bannerWidth + 8)));
  }, [bannerWidth]);

  // ─────────────────────────────────────────────────────────────────────────
  // FILTERING & MEMOIZATION
  // ─────────────────────────────────────────────────────────────────────────

  const { filteredShops, openNowShops, productResults, nearestShopDist } = useMemo(() => {
    if (!Array.isArray(shops)) {
      return { filteredShops: [], openNowShops: [], productResults: [], nearestShopDist: null };
    }

    const query = search.toLowerCase().trim();
    const cutoff = range !== 'All' ? Number(range) : null;
    const products = [];

    let minDistance = null;
    shops.forEach((s) => {
      if (s.distance != null) {
        const d = Number(s.distance);
        if (minDistance === null || d < minDistance) {
          minDistance = d;
        }
      }
    });

    let filtered = shops.filter((s) => {
      if (cutoff != null && (s.distance == null || Number(s.distance) > cutoff)) {
        return false;
      }
      if (
        selectedCategory !== 'All' &&
        s.category?.toLowerCase() !== selectedCategory.toLowerCase()
      ) {
        return false;
      }
      if (query && !s.name?.toLowerCase().includes(query)) {
        return false;
      }
      if (onlyDeliverable) {
        if (!s.delivery_available) {
          return false;
        }
        const rangeLimit = s.delivery_range != null && s.delivery_range !== '' ? Number(s.delivery_range) : null;
        if (rangeLimit !== null && s.distance != null && Number(s.distance) > rangeLimit) {
          return false;
        }
      }
      return true;
    });
    filtered.sort(byDistance);
    if (__DEV__) {
      try {
        console.log('filteredShops sample', filtered.slice(0, 10).map(s => ({ id: s.id, distance: s.distance, plan: s.plan })));
      } catch (e) {}
    }

    // Product search
    if (query) {
      shops.forEach((shop) => {
        (shop.items ?? []).forEach((item) => {
          if (!item.name?.toLowerCase().includes(query)) return;
          if (cutoff != null && (shop.distance == null || Number(shop.distance) > cutoff)) {
            return;
          }
          if (onlyDeliverable) {
            if (!shop.delivery_available) return;
            const rangeLimit = shop.delivery_range != null && shop.delivery_range !== '' ? Number(shop.delivery_range) : null;
            if (rangeLimit !== null && shop.distance != null && Number(shop.distance) > rangeLimit) {
              return;
            }
          }
          products.push({
            ...item,
            shopId: shop.id,
            shopName: shop.name,
            distance: shop.distance,
          });
        });
      });
      products.sort(byDistance);
    }

    const openNow = !query ? filtered.filter((s) => s.is_open).slice(0, 12) : [];

    return { 
      filteredShops: filtered, 
      openNowShops: openNow, 
      productResults: products,
      nearestShopDist: minDistance
    };
  }, [shops, search, selectedCategory, range, onlyDeliverable]);

  // ─────────────────────────────────────────────────────────────────────────
  // CALLBACKS
  // ─────────────────────────────────────────────────────────────────────────

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const { latitude: lat, longitude: lon } = coordsRef.current ?? {};
      await Promise.all([fetchShops(lat, lon), fetchFeaturedBanners(), fetchUser()]);
    } catch (e) {
      // silent fail
    } finally {
      setRefreshing(false);
    }
  }, [fetchShops, fetchFeaturedBanners, fetchUser]);

  const navigateToShop = useCallback((id) => router.push(`/shop/${id}`), [router]);
  const displayCity = useMemo(
    () => city.split(',').slice(0, 2).join(','),
    [city]
  );
  const firstName = useMemo(
    () => user?.name?.trim().split(' ')[0] ?? null,
    [user]
  );

  // ─────────────────────────────────────────────────────────────────────────
  // SKELETON LOADER STATE
  // ─────────────────────────────────────────────────────────────────────────

  if (loading && shops.length === 0) {
    return (
      <SafeAreaView edges={['top']} style={s.safe}>
        <StatusBar style="dark" />

        <View style={s.skeletonHeader}>
          <Skeleton style={{ width: 40, height: 40, borderRadius: 14 }} />
          <Skeleton style={{ width: 150, height: 16, marginLeft: 10, borderRadius: 8 }} />
          <View style={{ flex: 1 }} />
          <Skeleton style={{ width: 40, height: 40, borderRadius: 20 }} />
        </View>

        <View style={{ paddingHorizontal: 18, paddingBottom: 22 }}>
          <Skeleton style={{ height: 13, width: 110, borderRadius: 6, marginBottom: 10 }} />
          <Skeleton style={{ height: 28, width: 220, borderRadius: 8, marginBottom: 6 }} />
          <Skeleton style={{ height: 28, width: 170, borderRadius: 8 }} />
        </View>

        <Skeleton style={{ height: 52, marginHorizontal: 18, borderRadius: 16, marginBottom: 18 }} />

        <View style={{ flexDirection: 'row', gap: 8, paddingHorizontal: 18, marginBottom: 18 }}>
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} style={{ width: 78, height: 36, borderRadius: 20 }} />
          ))}
        </View>

        <Skeleton style={{ height: 120, marginHorizontal: 18, borderRadius: 20, marginBottom: 20 }} />

        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12, paddingHorizontal: 18 }}>
          {[1, 2, 3, 4].map((i) => (
            <Skeleton
              key={i}
              style={{ width: CARD_WIDTH, height: 180, borderRadius: 18 }}
            />
          ))}
        </View>
      </SafeAreaView>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────

  return (
    <SafeAreaView edges={['top']} style={s.safe}>
      <StatusBar style="dark" />

      <ScrollView
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={C.primary}
            colors={[C.primary]}
          />
        }
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 110 }}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
        {/* ──────────────────────────────────────────────────────────────────── */}
        {/* HEADER */}
        {/* ──────────────────────────────────────────────────────────────────── */}
        <View style={s.header}>
          <View style={s.headerLeft}>
            <Image
              source={require('../../assets/images/logo_round.png')}
              style={s.logo}
            />
            <TouchableOpacity
              style={s.locationPill}
              onPress={getUserLocation}
              activeOpacity={0.75}
            >
              <Ionicons name="location" size={11} color={C.primary} />
              <Text numberOfLines={1} style={s.locationText}>
                {displayCity}
              </Text>
              <Ionicons name="reload" size={11} color={C.textSoft} />
            </TouchableOpacity>
          </View>

          <View style={s.headerActions}>
            <TouchableOpacity
              onPress={() => router.push('/notifications')}
              style={s.headerIconBtn}
              activeOpacity={0.75}
            >
              <Ionicons name="notifications-outline" size={20} color={C.text} />
              {unreadCount > 0 && <View style={s.notifBadge} />}
            </TouchableOpacity>

            <TouchableOpacity onPress={() => router.push('/profile')} activeOpacity={0.8}>
              <View style={s.avatarRing}>
                <Image
                  source={avatars[user?.avatar || localAvatar || 'male_1']}
                  style={s.headerAvatar}
                />
              </View>
            </TouchableOpacity>
          </View>
        </View>

        {/* ──────────────────────────────────────────────────────────────────── */}
        {/* GREETING */}
        {/* ──────────────────────────────────────────────────────────────────── */}
        <View style={s.greetingBlock}>
          <Text style={s.greetingEyebrow}>{getGreeting()} 👋</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' }}>
            <Text style={s.greetingHeadline}>
              {firstName ? `Hey ${firstName}, ` : ''}
              <Text style={s.greetingAccent}>find shops</Text>
              {'\n'}
              <Text style={s.greetingAccent}>& products</Text>
              {' near you'}
            </Text>
            <View style={{ marginLeft: 6 }}>
              <Sparkle size={20} color={C.accentVibrant} />
            </View>
          </View>
        </View>

        {/* ──────────────────────────────────────────────────────────────────── */}
        {/* SEARCH BAR & DOORSTEP TOGGLE */}
        {/* ──────────────────────────────────────────────────────────────────── */}
        <View style={{ flexDirection: 'row', alignItems: 'center', marginHorizontal: 18, marginBottom: 16, gap: 8 }}>
          <View style={[s.searchWrap, searchFocused && s.searchWrapFocused, { flex: 1, marginHorizontal: 0, marginBottom: 0 }]}>
            <Ionicons
              name="search-outline"
              size={17}
              color={searchFocused ? C.primary : C.textMuted}
            />
            <TextInput
              ref={searchInputRef}
              placeholder="Search shops or products..."
              placeholderTextColor={C.textMuted}
              value={search}
              onChangeText={setSearch}
              onFocus={() => setSearchFocused(true)}
              onBlur={() => setSearchFocused(false)}
              style={s.searchInput}
              selectionColor={C.primary}
              returnKeyType="search"
              underlineColorAndroid="transparent"
              autoCorrect={false}
              autoCapitalize="none"
            />
            {search.length > 0 && (
              <TouchableOpacity
                onPress={() => {
                  setSearch('');
                  searchInputRef.current?.blur();
                }}
                hitSlop={{ top: 14, bottom: 14, left: 14, right: 14 }}
              >
                <View style={s.searchClearBtn}>
                  <Ionicons name="close" size={12} color={C.textSoft} />
                </View>
              </TouchableOpacity>
            )}
          </View>

          <TouchableOpacity
            style={[s.deliveryToggleChip, onlyDeliverable && s.deliveryToggleChipActive, { height: 52, borderRadius: 18, justifyContent: 'center', alignSelf: 'stretch', paddingHorizontal: 12 }]}
            onPress={() => setOnlyDeliverable(!onlyDeliverable)}
            activeOpacity={0.75}
          >
            <Ionicons name="bicycle-outline" size={16} color={onlyDeliverable ? '#fff' : '#0A5C43'} />
            <Text style={[s.deliveryToggleChipText, onlyDeliverable && s.deliveryToggleChipTextActive, { fontSize: 12, marginLeft: 2 }]}>
              Doorstep
            </Text>
          </TouchableOpacity>
        </View>

        {/* ──────────────────────────────────────────────────────────────────── */}
        {/* RANGE SELECTOR */}
        {/* ──────────────────────────────────────────────────────────────────── */}
        <View style={[s.rangeRow, { paddingRight: 18 }]}>
          <Ionicons name="radio-outline" size={13} color={C.textMuted} />
          <Text style={s.rangeLabel}>Range</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 6 }}
            style={{ flex: 1 }}
          >
            {RANGES.map((r) => (
              <TouchableOpacity
                key={r}
                style={[s.rangeChip, range === r && s.rangeChipActive]}
                onPress={() => setRange(r)}
                activeOpacity={0.75}
              >
                <Text style={[s.rangeChipText, range === r && s.rangeChipTextActive]}>
                  {r === 'All' ? 'Any' : `${r} km`}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* ──────────────────────────────────────────────────────────────────── */}
        {/* CATEGORIES */}
        {/* ──────────────────────────────────────────────────────────────────── */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{
            paddingLeft: 18,
            paddingRight: 18,
            gap: 7,
          }}
          style={{ marginBottom: 6 }}
        >
          {CATEGORIES.map((cat) => {
            const active = selectedCategory === cat.name;
            const catColor = CATEGORY_COLORS[cat.name] || CATEGORY_COLORS.Others;
            return (
              <TouchableOpacity
                key={cat.name}
                onPress={() => setSelectedCategory(cat.name)}
                style={[
                  s.catChip,
                  active && [
                    s.catChipActive,
                    {
                      backgroundColor: catColor.activeBg,
                      borderColor: catColor.activeBg,
                    },
                  ],
                ]}
                activeOpacity={0.75}
              >
                <Ionicons
                  name={cat.icon}
                  size={12}
                  color={active ? '#fff' : catColor.icon}
                />
                <Text style={[s.catChipText, active && { color: '#fff' }]}>
                  {cat.name}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        <AdBanner />

        {/* ──────────────────────────────────────────────────────────────────── */}
        {/* PRODUCT RESULTS */}
        {/* ──────────────────────────────────────────────────────────────────── */}
        {search.length > 0 && productResults.length > 0 && (
          <>
            <SectionHeader title="Products" count={`${productResults.length} found`} />
            <View style={s.grid}>
              {productResults.slice(0, productPage * PAGE_SIZE).map((item, i) => (
                <ProductCard
                  key={`prod-${item.shopId}-${i}`}
                  item={item}
                  onPress={navigateToShop}
                />
              ))}
            </View>
            {productPage * PAGE_SIZE < productResults.length && (
              <TouchableOpacity
                style={s.loadMoreBtn}
                onPress={() => setProductPage((p) => p + 1)}
                activeOpacity={0.75}
              >
                <Text style={s.loadMoreText}>Show more products</Text>
                <Ionicons name="chevron-down" size={14} color={C.primary} />
              </TouchableOpacity>
            )}
          </>
        )}

        {/* ──────────────────────────────────────────────────────────────────── */}
        {/* FEATURED BANNERS */}
        {/* ──────────────────────────────────────────────────────────────────── */}
        {featuredBanners.length > 0 && (
          <View style={s.bannerSection}>
            <ScrollView
              ref={bannerRef}
              horizontal
              showsHorizontalScrollIndicator={false}
              snapToInterval={bannerWidth + 8}
              decelerationRate="fast"
              onScroll={onBannerScroll}
              scrollEventThrottle={16}
            >
              {featuredBanners.map((b) => (
                <TouchableOpacity
                  key={b.id}
                  activeOpacity={0.93}
                  onPress={() => {
                    if (!b.link) return;
                    try {
                      if (b.link.includes('instagram.com') || b.link.startsWith('@')) {
                        const u = b.link
                          .replace(/https?:\/\/instagram\.com\//g, '')
                          .replace(/@/g, '')
                          .trim();
                        Linking.openURL(`https://instagram.com/${u}`);
                        return;
                      }
                      if (
                        b.link.includes('wa.me') ||
                        b.link.includes('whatsapp') ||
                        /^\d+$/.test(b.link)
                      ) {
                        Linking.openURL(`https://wa.me/${b.link.replace(/\D/g, '')}`);
                        return;
                      }
                      Linking.openURL(b.link);
                    } catch (e) {
                      // silent fail
                    }
                  }}
                  style={{ width: bannerWidth, marginRight: 8 }}
                >
                  {b.image ? (
                    <View style={s.bannerImageWrap}>
                      <Image
                        source={{ uri: getImageUrl(b.image) }}
                        style={s.bannerImage}
                        resizeMode="cover"
                      />
                      {b.link && (
                        <View style={s.bannerLinkIcon}>
                          <Ionicons name="open-outline" size={12} color={C.white} />
                        </View>
                      )}
                    </View>
                  ) : (
                    <View
                      style={[
                        s.bannerTextCard,
                        { backgroundColor: b.background_color || C.primary },
                      ]}
                    >
                      {b.link && (
                        <View style={s.bannerLinkIcon}>
                          <Ionicons name="open-outline" size={12} color={C.white} />
                        </View>
                      )}
                      <Ionicons
                        name="storefront-outline"
                        size={88}
                        color="rgba(255,255,255,0.055)"
                        style={{ position: 'absolute', top: 0, right: 0 }}
                      />
                      <View style={{ gap: 4 }}>
                        <Text style={s.bannerEyebrow}>
                          {b.small_text || 'mydukan'}
                        </Text>
                        <Text style={s.bannerTitle}>
                          {b.title || 'Save your time'}
                        </Text>
                        <Text style={s.bannerSubtitle}>
                          {b.subtitle || 'Find nearby shops instantly'}
                        </Text>
                      </View>
                    </View>
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
            <View style={s.bannerDots}>
              {featuredBanners.map((_, i) => (
                <Pressable
                  key={i}
                  onPress={() => {
                    setActiveBanner(i);
                    bannerRef.current?.scrollTo({
                      x: i * (bannerWidth + 8),
                      animated: true,
                    });
                  }}
                >
                  <View
                    style={[
                      s.bannerDot,
                      activeBanner === i
                        ? s.bannerDotActive
                        : s.bannerDotInactive,
                    ]}
                  />
                </Pressable>
              ))}
            </View>
          </View>
        )}

        {/* ──────────────────────────────────────────────────────────────────── */}
        {/* OPEN NOW */}
        {/* ──────────────────────────────────────────────────────────────────── */}
        {openNowShops.length > 0 && !search && (
          <>
            <SectionHeader
              title="Open Now"
              count={String(openNowShops.length)}
              countColor={C.accentSoft}
              dotColor={C.accent}
            />
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{
                paddingLeft: 18,
                paddingRight: 18,
                gap: 10,
                paddingBottom: 4,
              }}
            >
              {openNowShops.map((item) => (
                <OpenNowCard
                  key={`open-${item.id}`}
                  item={item}
                  onPress={navigateToShop}
                />
              ))}
            </ScrollView>
          </>
        )}

        {/* ──────────────────────────────────────────────────────────────────── */}
        {/* NEARBY SHOPS */}
        {/* ──────────────────────────────────────────────────────────────────── */}
        <SectionHeader
          title={search ? 'Matching Shops' : 'Nearby Shops'}
          count={`${filteredShops.length} shops`}
        />

        {filteredShops.length === 0 ? (
          <View style={s.emptyState}>
            <View style={s.emptyIconWrap}>
              <View style={s.emptyIconRing}>
                <Ionicons name="storefront-outline" size={34} color={C.primary} />
              </View>
            </View>
            <Text style={s.emptyTitle}>No shops found</Text>
            <Text style={s.emptySubtitle}>
              {search
                ? 'Try a different search term'
                : nearestShopDist != null
                  ? `The nearest shop is ${formatDist(nearestShopDist)} away. Try expanding the range.`
                  : 'Try expanding the distance range or enabling location permissions.'}
            </Text>
          </View>
        ) : (
          <>
            <View style={s.grid}>
              {filteredShops.slice(0, shopPage * PAGE_SIZE).map((item) => (
                <ShopCard key={item.id} item={item} onPress={navigateToShop} />
              ))}
            </View>
            {shopPage * PAGE_SIZE < filteredShops.length && (
              <TouchableOpacity
                style={s.loadMoreBtn}
                onPress={() => setShopPage((p) => p + 1)}
                activeOpacity={0.75}
              >
                <Text style={s.loadMoreText}>
                  Show{' '}
                  {Math.min(
                    PAGE_SIZE,
                    filteredShops.length - shopPage * PAGE_SIZE
                  )}{' '}
                  more shops
                </Text>
                <Ionicons name="chevron-down" size={14} color={C.primary} />
              </TouchableOpacity>
            )}
            {shopPage * PAGE_SIZE >= filteredShops.length &&
              filteredShops.length > PAGE_SIZE && (
                <TouchableOpacity
                  style={s.loadMoreBtn}
                  onPress={() => setShopPage(1)}
                  activeOpacity={0.75}
                >
                  <Text style={s.loadMoreText}>Show less</Text>
                  <Ionicons name="chevron-up" size={14} color={C.primary} />
                </TouchableOpacity>
              )}
          </>
        )}
      </ScrollView>

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* BOTTOM NAVIGATION */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      <View style={s.bottomNav}>
        {[
          {
            route: '/shop/home',
            icon: 'home',
            iconOutline: 'home-outline',
            label: 'Home',
          },
          {
            route: '/favorites',
            icon: 'heart',
            iconOutline: 'heart-outline',
            label: 'Saved',
          },
          {
            route: '/profile',
            icon: 'person',
            iconOutline: 'person-outline',
            label: 'Profile',
          },
        ].map((tab) => {
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
                  size={19}
                  color={active ? C.white : C.textMuted}
                />
              </View>
              <Text style={[s.navLabel, active && s.navLabelActive]}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
      <AppUpdateModal />
    </SafeAreaView>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// STYLES
// ═══════════════════════════════════════════════════════════════════════════

function getStyles(theme) { Object.assign(C, theme || {}); return StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: C.surface,
    marginTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
  },

  // Header
  skeletonHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingTop: 14,
    paddingBottom: 16,
  },

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingTop: 14,
    paddingBottom: 10,
  },

  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    minWidth: 0,
    gap: 10,
  },

  logo: {
    width: 40,
    height: 40,
    borderRadius: 13,
  },

  locationPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: C.primaryLight,
    paddingHorizontal: 11,
    paddingVertical: 8,
    borderRadius: 22,
    flex: 1,
    maxWidth: 230,
    borderWidth: 1.5,
    borderColor: 'rgba(10, 92, 67, 0.15)',
  },

  locationText: {
    fontWeight: '600',
    fontSize: 12,
    color: C.text,
    flex: 1,
    letterSpacing: -0.1,
  },

  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },

  headerIconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: C.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: C.border,
  },

  notifBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: C.danger,
    borderWidth: 2,
    borderColor: C.surface,
  },

  avatarRing: {
    padding: 3,
    borderRadius: 22,
    borderWidth: 2,
    borderColor: C.primary,
    backgroundColor: C.white,
  },

  headerAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },

  // Greeting
  greetingBlock: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 20,
  },

  greetingEyebrow: {
    fontSize: 13,
    color: C.textSoft,
    fontWeight: '500',
    marginBottom: 6,
    letterSpacing: 0.1,
  },

  greetingHeadline: {
    fontSize: 28,
    fontWeight: '900',
    color: C.primaryDark,
    lineHeight: 36,
    letterSpacing: -0.6,
  },

  greetingAccent: {
    color: C.primary,
    fontWeight: '900',
  },

  // Search
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.surface,
    marginHorizontal: 18,
    borderRadius: 18,
    paddingHorizontal: 15,
    height: 52,
    marginBottom: 16,
    borderWidth: 1.5,
    borderColor: C.border,
    gap: 10,
    shadowColor: '#0A5C43',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },

  searchWrapFocused: {
    borderColor: C.primary,
    borderWidth: 2,
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 5,
  },

  searchInput: {
    flex: 1,
    height: '100%',
    fontSize: 14,
    color: C.text,
    paddingVertical: 0,
    includeFontPadding: false,
    letterSpacing: -0.1,
  },

  searchClearBtn: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: C.border,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Range
  rangeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 18,
    marginBottom: 14,
    gap: 6,
  },

  rangeLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: C.textMuted,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginRight: 4,
  },

  rangeChip: {
    paddingHorizontal: 13,
    paddingVertical: 8,
    backgroundColor: C.surface,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: C.border,
  },

  rangeChipActive: {
    backgroundColor: C.primaryDark,
    borderColor: C.primaryDark,
    shadowColor: C.primary,
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 4,
  },

  rangeChipText: {
    fontSize: 12,
    color: C.textSoft,
    fontWeight: '600',
    letterSpacing: -0.1,
  },

  rangeChipTextActive: {
    color: C.white,
    fontWeight: '700',
  },

  // Categories
  catChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 13,
    paddingVertical: 8,
    backgroundColor: C.surface,
    borderRadius: 22,
    borderWidth: 1.5,
    borderColor: C.border,
  },

  catChipActive: {
    shadowColor: '#0A5C43',
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 3,
  },

  catChipText: {
    fontSize: 12,
    color: C.textMid,
    fontWeight: '600',
    letterSpacing: -0.1,
  },

  // Section Header
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 18,
    marginTop: 28,
    marginBottom: 16,
  },

  sectionTitle: {
    fontWeight: '800',
    fontSize: 18,
    color: C.text,
    letterSpacing: -0.4,
  },

  sectionSubtitle: {
    fontSize: 12,
    color: C.textMuted,
    marginTop: 2,
  },

  countBadge: {
    backgroundColor: C.primaryLight,
    borderRadius: 22,
    paddingHorizontal: 12,
    paddingVertical: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderWidth: 1.5,
    borderColor: 'rgba(10, 92, 67, 0.2)',
    shadowColor: C.primary,
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 1,
  },

  countDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },

  countBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: C.primary,
    letterSpacing: -0.1,
  },

  // Grid
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 18,
    gap: 12,
  },

  // Card
  card: {
    width: CARD_WIDTH,
    backgroundColor: C.surface,
    borderRadius: 22,
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: 'rgba(224, 234, 230, 0.8)',
    shadowColor: '#0A3A28',
    shadowOpacity: 0.1,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },

  cardPro: {
    borderWidth: 2,
    borderColor: '#2F5D50',
    shadowOpacity: 0.18,
    shadowRadius: 20,
    elevation: 8,
  },

  cardProPlus: {
    borderWidth: 2.2,
    borderColor: '#C084FC',
    shadowColor: '#C084FC',
    shadowOpacity: 0.22,
    shadowRadius: 20,
    elevation: 8,
  },

  cardImageWrap: {
    position: 'relative',
    overflow: 'hidden',
  },

  cardImage: {
    width: '100%',
    height: 110,
  },

  cardImagePlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },

  cardImageScrim: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 50,
  },

  statusPill: {
    position: 'absolute',
    top: 10,
    left: 10,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 24,
    gap: 5,
    backgroundColor: 'rgba(255,255,255,0.95)',
  },

  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },

  statusDotGlow: {
    shadowColor: '#00C46A',
    shadowOpacity: 0.6,
    shadowRadius: 4,
    elevation: 2,
  },

  statusText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.1,
  },

  premiumBadge: {
    position: 'absolute',
    top: 10,
    right: 10,
    minWidth: 28,
    height: 28,
    paddingHorizontal: 6,
    borderRadius: 16,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 6,
  },

  premiumGlow: {
    shadowColor: '#FFD700',
    shadowOpacity: 0.5,
    shadowRadius: 8,
    elevation: 4,
  },

  premiumBadgeText: {
    color: '#FFF8DC',
    fontSize: 11,
    fontWeight: '800',
    marginLeft: 4,
  },

  premiumBadgeTextSmall: {
    color: '#FFF8DC',
    fontSize: 10,
    fontWeight: '700',
    marginLeft: 4,
  },

  priceBadge: {
    position: 'absolute',
    bottom: 10,
    right: 10,
    backgroundColor: C.primary,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    shadowColor: C.primary,
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 3,
  },

  priceBadgeText: {
    color: C.white,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: -0.2,
  },

  cardBody: {
    padding: 13,
    gap: 6,
  },

  cardName: {
    fontWeight: '700',
    fontSize: 14,
    color: C.text,
    lineHeight: 19,
    letterSpacing: -0.3,
  },

  shopNameText: {
    fontSize: 11,
    color: C.textSoft,
    fontWeight: '500',
  },

  catTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
  },

  catTagText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: -0.1,
  },

  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 2,
  },

  distChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: C.primaryLighter,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(10, 92, 67, 0.15)',
  },

  distText: {
    fontSize: 10,
    fontWeight: '700',
    color: C.primary,
    letterSpacing: -0.1,
  },

  timeText: {
    fontSize: 9.5,
    color: C.textMuted,
    letterSpacing: -0.1,
  },

  stockBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
  },

  stockText: {
    fontSize: 10,
    fontWeight: '700',
  },

  // Open Now Card
  openNowCard: {
    width: 160,
    backgroundColor: C.surface,
    borderRadius: 22,
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: 'rgba(224, 234, 230, 0.8)',
    shadowColor: '#0A3A28',
    shadowOpacity: 0.1,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 5 },
    elevation: 4,
  },

  openNowImage: {
    width: '100%',
    height: 96,
  },

  openNowScrim: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 52,
  },

  openNowOverlay: {
    position: 'absolute',
    bottom: 10,
    left: 10,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: C.open,
    borderWidth: 2.5,
    borderColor: C.white,
  },

  openNowLiveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: C.open,
  },

  openNowLiveDotGlow: {
    shadowColor: C.open,
    shadowOpacity: 0.6,
    shadowRadius: 6,
    elevation: 3,
  },

  openNowBody: {
    padding: 12,
    gap: 5,
  },

  openNowName: {
    fontWeight: '700',
    fontSize: 13,
    color: C.text,
    lineHeight: 17,
    letterSpacing: -0.2,
  },

  openNowCat: {
    fontSize: 11,
    fontWeight: '600',
  },

  // Banners
  bannerSection: {
    paddingHorizontal: 16,
    marginTop: 10,
    marginBottom: 6,
  },

  bannerImageWrap: {
    borderRadius: 22,
    overflow: 'hidden',
    position: 'relative',
    shadowColor: '#0A3A28',
    shadowOpacity: 0.12,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },

  bannerImage: {
    width: '100%',
    aspectRatio: 16 / 5,
    borderRadius: 22,
  },

  bannerLinkIcon: {
    position: 'absolute',
    top: 12,
    right: 12,
    backgroundColor: 'rgba(0,0,0,0.42)',
    padding: 7,
    borderRadius: 24,
  },

  bannerTextCard: {
    aspectRatio: 16 / 5,
    borderRadius: 22,
    padding: 22,
    justifyContent: 'center',
    overflow: 'hidden',
    position: 'relative',
    shadowColor: '#0A3A28',
    shadowOpacity: 0.12,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },

  bannerEyebrow: {
    color: 'rgba(255,255,255,0.65)',
    fontSize: 9,
    letterSpacing: 1.9,
    textTransform: 'uppercase',
    fontWeight: '700',
  },

  bannerTitle: {
    color: C.white,
    fontSize: 22,
    fontWeight: '900',
    lineHeight: 28,
    letterSpacing: -0.5,
  },

  bannerSubtitle: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 12,
    fontWeight: '500',
    letterSpacing: -0.1,
  },

  bannerDots: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 12,
    gap: 6,
  },

  bannerDot: {
    height: 5,
    borderRadius: 2.5,
  },

  bannerDotActive: {
    width: 24,
    backgroundColor: C.primary,
  },

  bannerDotInactive: {
    width: 5,
    backgroundColor: C.borderMid,
  },

  // Empty State
  emptyState: {
    alignItems: 'center',
    marginTop: 60,
    marginBottom: 30,
    gap: 12,
  },

  emptyIconWrap: {
    marginBottom: 6,
  },

  emptyIconRing: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: C.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(10, 92, 67, 0.2)',
  },

  emptyTitle: {
    color: C.text,
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: -0.3,
  },

  emptySubtitle: {
    color: C.textSoft,
    fontSize: 13,
    textAlign: 'center',
    paddingHorizontal: 48,
    lineHeight: 20,
  },

  // Bottom Navigation
  bottomNav: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    backgroundColor: C.surface,
    borderTopWidth: 1,
    borderTopColor: C.border,
    paddingTop: 8,
    paddingHorizontal: 8,
    paddingBottom: Platform.OS === 'ios' ? 26 : 10,
    justifyContent: 'space-around',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: -8 },
    elevation: 16,
  },

  navTab: {
    alignItems: 'center',
    gap: 3,
    flex: 1,
    marginBottom:7,
  },

  navIconWrap: {
    width: 46,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },

  navIconWrapActive: {
    backgroundColor: C.primary,
    shadowColor: C.primary,
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 3,
  },

  navLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: C.textMuted,
    letterSpacing: -0.1,
  },

  navLabelActive: {
    color: C.primary,
    fontWeight: '700',
  },

  // Load More
  loadMoreBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    marginHorizontal: 18,
    marginTop: 16,
    marginBottom: 6,
    paddingVertical: 16,
    borderRadius: 18,
    backgroundColor: C.primaryLighter,
    borderWidth: 1.5,
    borderColor: 'rgba(10, 92, 67, 0.15)',
    shadowColor: C.primary,
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },

  loadMoreText: {
    color: C.primary,
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: -0.2,
  },

  deliveryToggleChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 11,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#E0EAE6',
  },
  deliveryToggleChipActive: {
    backgroundColor: '#0A5C43',
    borderColor: '#0A5C43',
    shadowColor: '#0A5C43',
    shadowOpacity: 0.15,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  deliveryToggleChipText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0A5C43'
  },
  deliveryToggleChipTextActive: {
    color: '#fff'
  }
}); }