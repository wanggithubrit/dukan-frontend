import { Ionicons } from '@expo/vector-icons';
import AppUpdateModal from '../../components/AppUpdateModal';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';
import { Image } from 'expo-image';
import * as Location from 'expo-location';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Animated,
    Dimensions,
    InteractionManager,
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
import AdBanner from '../../components/AdBanner';

const { width } = Dimensions.get('window');
const CARD_WIDTH = (width - 52) / 2;

const BASE_URL = 'https://dukan-backend-0cc9.onrender.com';
const POLL_MS = 60_000;
const PAGE_SIZE = 6;

// ─── design tokens ────────────────────────────────────────────────────────────
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

// ─── helpers ──────────────────────────────────────────────────────────────────


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
  return `${BASE_URL}${img.startsWith('/') ? '' : '/'}${img}`;
};

const getToken = () =>
  AsyncStorage.multiGet(['token', 'access_token']).then(
    ([[, t], [, at]]) => t || at
  );

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

const getPlanRank = (plan) => {
  const p = String(plan || '').toLowerCase();
  if (p === 'pro_plus') return 0;
  if (p === 'pro') return 1;
  return 2;
};

const byDistance = (a, b) => {
  const distA = toKm(a.distance);
  const distB = toKm(b.distance);
  if (distA !== distB) return distA - distB;

  const rankA = getPlanRank(a?.plan);
  const rankB = getPlanRank(b?.plan);
  if (rankA !== rankB) return rankA - rankB;

  return String(a?.name || '').localeCompare(String(b?.name || ''));
};

// ─── sub-components ──────────────────────────────────────────────────────────

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

const Sparkle = ({ size = 16, color = C.accent }) => (
  <Ionicons
    name="sparkles"
    size={size}
    color={color}
    style={{ opacity: 0.8 }}
  />
);

const Stat = React.memo(({ label, value, icon }) => (
  <View style={styles.statCard}>
    <View style={styles.statIconBox}>
      <Ionicons name={icon} size={15} color="#1A3C34" />
    </View>
    <Text style={styles.statNumber}>{value}</Text>
    <Text style={styles.statLabel}>{label}</Text>
  </View>
));
Stat.displayName = 'Stat';

const Action = React.memo(({ icon, label, onPress, highlight }) => (
  <TouchableOpacity
    style={[styles.actionCard, highlight && styles.actionCardHighlight]}
    onPress={onPress}
    activeOpacity={0.72}
  >
    <View style={[styles.actionIconBox, highlight && styles.actionIconBoxHighlight]}>
      <Ionicons name={icon} size={20} color={highlight ? '#fff' : '#1A3C34'} />
    </View>
    <Text style={[styles.actionText, highlight && styles.actionTextHighlight]}>{label}</Text>
  </TouchableOpacity>
));
Action.displayName = 'Action';

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

const BannerCard = React.memo(({ b, onDelete }) => (
  <View style={styles.bannerWrapper}>
    {b.banner_type === 'image' && b.image ? (
      <>
        <Image source={{ uri: getImageUrl(b.image) }} style={styles.bannerImg} />
        <View style={styles.bannerScrim} />
        {(b.title || b.subtitle || b.discount != null) && (
          <View style={styles.bannerOverlay}>
            {b.small_text && <Text style={styles.bannerSmall}>{b.small_text}</Text>}
            {b.title && <Text style={styles.bannerTitle}>{b.title}</Text>}
            {b.discount != null && <Text style={styles.bannerDiscount}>{b.discount}</Text>}
            {b.subtitle && <Text style={styles.bannerSub}>{b.subtitle}</Text>}
          </View>
        )}
      </>
    ) : (
      <View style={[styles.bannerTextCard, { backgroundColor: b.background_color || '#1A3C34' }]}>
        {b.small_text && <Text style={styles.bannerSmall}>{b.small_text}</Text>}
        {b.title && <Text style={styles.bannerTitle}>{b.title}</Text>}
        {b.discount != null && <Text style={styles.bannerDiscount}>{b.discount}</Text>}
        {b.subtitle && <Text style={styles.bannerSub}>{b.subtitle}</Text>}
      </View>
    )}
    <TouchableOpacity style={styles.deleteBadge} onPress={() => onDelete(b.id)}>
      <Ionicons name="close" size={12} color="#fff" />
    </TouchableOpacity>
  </View>
));
BannerCard.displayName = 'BannerCard';

const PostCard = React.memo(({ post, onDelete }) => (
  <View style={styles.postCard}>
    <Image source={{ uri: getImageUrl(post.image || post.media_url) }} style={styles.postImage} />
    <TouchableOpacity style={styles.postDeleteBadge} onPress={() => onDelete(post.id)}>
      <Ionicons name="trash-outline" size={11} color="#fff" />
    </TouchableOpacity>
  </View>
));
PostCard.displayName = 'PostCard';

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
      <View style={[styles.card, isProPlus && styles.cardProPlus, isPro && styles.cardPro]}>
        <View style={styles.cardImageWrap}>
          {imageUri ? (
            <>
              <Image source={{ uri: imageUri }} style={styles.cardImage} resizeMode="cover" />
              <View style={styles.cardImageScrim} />
            </>
          ) : (
            <View style={[styles.cardImage, styles.cardImagePlaceholder, { backgroundColor: placeholderBg }]}>
              <Ionicons
                name={catIcon}
                size={34}
                color={catColor.icon}
                style={{ opacity: 0.45 }}
              />
            </View>
          )}

          <View style={[styles.statusPillBadge, { backgroundColor: item.is_open ? C.openBg : C.closedBg }]}>
            <View
              style={[
                styles.statusDotBadge,
                { backgroundColor: item.is_open ? C.open : C.closed },
              ]}
            />
            <Text style={[styles.statusTextBadge, { color: item.is_open ? '#065F46' : '#4F6B62' }]}>
              {item.is_open ? 'Open' : 'Closed'}
            </Text>
          </View>

          {isProPlus && (
            <View style={[styles.premiumBadge, styles.verifiedGlow, { backgroundColor: '#A855F7' }]}> 
              <Ionicons name="checkmark-circle" size={13} color="#FFFFFF" />
            </View>
          )}
          {isPro && (
            <View style={[styles.premiumBadge, styles.premiumGlow, { backgroundColor: '#EAB308' }]}> 
              <Ionicons name="star" size={11} color="#FFFFFF" />
            </View>
          )}
        </View>

        <View style={styles.cardBody}>
          <Text style={styles.cardName} numberOfLines={1}>
            {isProPlus ? '✅ ' : isPro ? '⭐ ' : ''}{item.name}
          </Text>

          {catKey && catKey !== 'All' && (
            <View
              style={[
                styles.catTag,
                {
                  backgroundColor: catColor.bg + '40',
                  borderColor: catColor.icon + '30',
                  borderWidth: 1,
                },
              ]}
            >
              <Ionicons name={catIcon} size={9} color={catColor.icon} />
              <Text style={[styles.catTagText, { color: catColor.text }]}>{catKey}</Text>
            </View>
          )}

          <View style={styles.cardFooter}>
            {dist ? (
              <View style={styles.distChip}>
                <Ionicons name="navigate" size={9} color={C.primary} />
                <Text style={styles.distText}>{dist}</Text>
              </View>
            ) : (
              <View />
            )}
            <Text style={styles.timeText}>{formatTime(item.updated_at)}</Text>
          </View>
        </View>
      </View>
    </PressScale>
  );
});
ShopCard.displayName = 'ShopCard';

const ProductCard = React.memo(({ item, onPress }) => {
  const dist = formatDist(item.distance);
  const imageUri = getImageUrl(item.image);
  const price = formatPrice(item.price);

  return (
    <PressScale style={{ width: CARD_WIDTH }} onPress={() => onPress(item.shopId)}>
      <View style={styles.card}>
        <View style={styles.cardImageWrap}>
          {imageUri ? (
            <>
              <Image source={{ uri: imageUri }} style={styles.cardImage} resizeMode="cover" />
              <View style={styles.cardImageScrim} />
            </>
          ) : (
            <View style={[styles.cardImage, styles.cardImagePlaceholder, { backgroundColor: '#EEF2F0' }]}>
              <Ionicons name="cube-outline" size={34} color="#94A3B8" style={{ opacity: 0.45 }} />
            </View>
          )}

          {price && (
            <View style={styles.priceBadge}>
              <Text style={styles.priceBadgeText}>{price}</Text>
            </View>
          )}
        </View>

        <View style={styles.cardBody}>
          <Text style={styles.cardName} numberOfLines={1}>
            {item.name}
          </Text>

          {item.track_quantity && item.quantity_status === 'low' && (
            <View style={[styles.stockBadge, { backgroundColor: C.warningBg }]}>
              <Ionicons name="warning-outline" size={9} color="#92400E" />
              <Text style={[styles.stockText, { color: '#92400E' }]}>
                Only {item.quantity} left
              </Text>
            </View>
          )}

          {item.track_quantity && item.quantity_status === 'out' && (
            <View style={[styles.stockBadge, { backgroundColor: C.dangerBg }]}>
              <Ionicons name="close-circle-outline" size={9} color="#991B1B" />
              <Text style={[styles.stockText, { color: '#991B1B' }]}>Out of stock</Text>
            </View>
          )}

          <Text style={styles.shopNameText} numberOfLines={1}>
            {item.shopName}
          </Text>

          {dist && (
            <View style={[styles.distChip, { alignSelf: 'flex-start' }]}>
              <Ionicons name="navigate" size={9} color={C.primary} />
              <Text style={styles.distText}>{dist}</Text>
            </View>
          )}
        </View>
      </View>
    </PressScale>
  );
});
ProductCard.displayName = 'ProductCard';

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
      <View style={[styles.openNowCard, isProPlus && styles.cardProPlus, isPro && styles.cardPro]}>
        <View style={{ position: 'relative' }}>
          {imageUri ? (
            <>
              <Image source={{ uri: imageUri }} style={styles.openNowImage} resizeMode="cover" />
              <View style={styles.openNowScrim} />
            </>
          ) : (
            <View style={[styles.openNowImage, styles.cardImagePlaceholder, { backgroundColor: placeholderBg }]}>
              <Ionicons
                name={CATEGORY_ICONS[catKey] || 'storefront-outline'}
                size={26}
                color={catColor.icon}
                style={{ opacity: 0.45 }}
              />
            </View>
          )}

          <View style={styles.openNowOverlay}>
            <View style={[styles.openNowLiveDot, styles.openNowLiveDotGlow]} />
          </View>

          {isProPlus && (
            <View style={[styles.premiumBadge, styles.verifiedGlow, { backgroundColor: '#A855F7' }]}> 
              <Ionicons name="checkmark-circle" size={11} color="#FFFFFF" />
            </View>
          )}
          {isPro && (
            <View style={[styles.premiumBadge, styles.premiumGlow, { backgroundColor: '#EAB308' }]}> 
              <Ionicons name="star" size={10} color="#FFFFFF" />
            </View>
          )}
        </View>

        <View style={styles.openNowBody}>
          <Text style={styles.openNowName} numberOfLines={1}>
            {isProPlus ? '✅ ' : isPro ? '⭐ ' : ''}{item.name}
          </Text>
          {catKey && catKey !== 'All' && (
            <Text style={[styles.openNowCat, { color: catColor.icon }]}>{catKey}</Text>
          )}
          {dist && (
            <View style={[styles.distChip, { marginTop: 4, alignSelf: 'flex-start' }]}>
              <Ionicons name="navigate" size={9} color={C.primary} />
              <Text style={styles.distText}>{dist}</Text>
            </View>
          )}
        </View>
      </View>
    </PressScale>
  );
});
OpenNowCard.displayName = 'OpenNowCard';

const SectionHeader = ({ title, count, countColor, dotColor, subtitle }) => (
  <View style={styles.sectionHeaderMarket}>
    <View style={{ flex: 1 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Text style={styles.sectionTitleMarket}>{title}</Text>
        <Sparkle size={14} color={C.accent} />
      </View>
      {subtitle ? <Text style={styles.sectionSubtitleMarket}>{subtitle}</Text> : null}
    </View>
    {count && (
      <View style={[styles.countBadge, countColor && { backgroundColor: countColor }]}>
        {dotColor && <View style={[styles.countDot, { backgroundColor: dotColor }]} />}
        <Text style={[styles.countBadgeText, dotColor && { color: '#065F46' }]}>{count}</Text>
      </View>
    )}
  </View>
);

let _lastActiveTab = 'dashboard';

// ─── main ─────────────────────────────────────────────────────────────────────
export default function MerchantHome() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const triggerAction = params?.triggerAction;

  // Tab State
  const [activeTab, setActiveTabInternal] = useState(_lastActiveTab); // 'dashboard' | 'marketplace'
  const setActiveTab = useCallback((tab) => {
    _lastActiveTab = tab;
    setActiveTabInternal(tab);
  }, []);

  // Dashboard Stats & State
  const [shop, setShop] = useState(null);
  const [posts, setPosts] = useState([]);
  const [banners, setBanners] = useState([]);
  const [stats, setStats] = useState({ posts: 0, followers: 0, views: 0 });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [togglingStatus, setTogglingStatus] = useState(false);
  const [unreadNotifications, setUnreadNotifications] = useState(false);

  // Marketplace Stats & State
  const [city, setCity] = useState('Loading...');
  const [search, setSearch] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [range, setRange] = useState('All');
  const [onlyDeliverable, setOnlyDeliverable] = useState(false);
  const [shops, setShops] = useState([]);
  const [shopPage, setShopPage] = useState(1);
  const [productPage, setProductPage] = useState(1);

  // Featured Banners State
  const [featuredBanners, setFeaturedBanners] = useState([]);
  const [activeBanner, setActiveBanner] = useState(0);

  // CREDIT & REMINDER SYSTEM STATES
  const [creditData, setCreditData] = useState({
    available_credits: 0.0,
    total_earned: 0.0,
    total_spent: 0.0,
    today_earned: 0.0,
    tier: 'Bronze Merchant',
    shop_health: 0,
    product_limit: 20,
    is_pro: false,
  });
  const [adLoaded, setAdLoaded] = useState(false);
  const [rewardedAdInstance, setRewardedAdInstance] = useState(null);

  const isProPlus = shop?.plan && String(shop.plan).toLowerCase() === 'pro_plus';
  const isPro = shop?.plan && ['pro', 'pro_plus'].includes(String(shop.plan).toLowerCase());

  const fetchCreditStatus = useCallback(async () => {
    try {
      const token = await getToken();
      if (!token) return;
      const res = await fetch(`${BASE_URL}/api/credits/status/`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setCreditData(data);
      }
    } catch (err) {
      console.debug('Credit status fetch error:', err);
    }
  }, []);

  const watchAd = useCallback(() => {
    if (adLoaded && rewardedAdInstance) {
      rewardedAdInstance.show();
      setAdLoaded(false);
      rewardedAdInstance.load();
    } else {
      Alert.alert('Ad Loading', 'The rewarded ad is loading. Please try again in a few seconds.');
    }
  }, [adLoaded, rewardedAdInstance]);

  useEffect(() => {
    let adInstance;
    try {
      const { RewardedAd, TestIds, RewardedAdEventType } = require('react-native-google-mobile-ads');
      const adUnitId = __DEV__ ? TestIds.REWARDED : 'ca-app-pub-9676497994699972/5941082220';
      adInstance = RewardedAd.createForAdRequest(adUnitId, {
        requestNonPersonalizedAdsOnly: true,
      });

      const unsubLoaded = adInstance.addAdEventListener(RewardedAdEventType.LOADED, () => {
        setAdLoaded(true);
      });

      const unsubEarned = adInstance.addAdEventListener(
        RewardedAdEventType.EARNED_REWARD,
        async () => {
          try {
            const token = await getToken();
            const res = await fetch(`${BASE_URL}/api/credits/ad-complete/`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`
              },
              body: JSON.stringify({ ad_id: 'dashboard_rewarded_watch_' + Date.now() })
            });
            const data = await res.json();
            if (res.ok) {
              Alert.alert('Congratulations! 🎉', 'You watched the ad and earned 0.5 Credits.');
              fetchCreditStatus();
            } else {
              Alert.alert('Error', data.error || 'Failed to claim reward');
            }
          } catch (err) {
            console.error('Rewarded ad reward claim error:', err);
          }
        }
      );

      adInstance.load();
      setRewardedAdInstance(adInstance);

      return () => {
        unsubLoaded();
        unsubEarned();
      };
    } catch (e) {
      console.debug('Rewarded ads not supported or failed to load:', e.message);
    }
  }, [fetchCreditStatus]);

  const coordsRef = useRef(null);
  const searchInputRef = useRef(null);
  const bannerRef = useRef(null);
  const bannerWidth = width - 32;
  const pollTimer = useRef(null);
  const isFetching = useRef(false);

  // Reset marketplace page counters when filters update
  useEffect(() => {
    setShopPage(1);
    setProductPage(1);
  }, [search, selectedCategory, range]);

  // Fetch Dashboard details
  const fetchData = useCallback(async (silent = false) => {
    if (isFetching.current) return;
    isFetching.current = true;
    try {
      const [userId, token] = await Promise.all([
        AsyncStorage.getItem('user_id'),
        getToken(),
      ]);
      if (!userId || !token) { router.replace('/login'); return; }
      const [dashRes, bRes] = await Promise.all([
        fetch(`${BASE_URL}/api/merchant/dashboard/${userId}/`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${BASE_URL}/api/merchant/banners/`, { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      if (dashRes.status === 401) {
        await AsyncStorage.clear();
        router.replace('/login');
        return;
      }
      const [data, bData] = await Promise.all([dashRes.json(), bRes.json()]);
      if (data?.shop) {
        const postsData = data.media || data.images || [];
        React.startTransition(() => {
          setShop(data.shop);
          setPosts(postsData);
          setStats({ posts: postsData.length, followers: data.stats?.followers ?? 0, views: data.stats?.views ?? 0 });
          setBanners(Array.isArray(bData) ? bData : []);
        });
        if (data?.plan?.type) {
          AsyncStorage.setItem('plan', data.plan.type).catch(err => console.debug('AsyncStorage plan save failed:', err));
        }
      }
      // Fetch unread notifications
      try {
        const notifRes = await fetch(`${BASE_URL}/api/notifications/${userId}/`);
        if (notifRes.ok) {
          const notifData = await notifRes.json();
          if (Array.isArray(notifData)) {
            const hasUnread = notifData.some(n => !n.is_read);
            setUnreadNotifications(hasUnread);
          }
        }
      } catch (err) {
        console.debug('Failed to fetch notifications:', err);
      }
      // Also fetch merchant credits status
      await fetchCreditStatus();
    } catch (_err) {
      if (!silent) console.log('❌ fetchData:', _err);
    } finally {
      isFetching.current = false;
      if (!silent) { setLoading(false); setRefreshing(false); }
      else { setLoading(false); }
    }
  }, [fetchCreditStatus, router]);

  // Fetch Nearby Shops for Marketplace
  const fetchShops = useCallback(async (latArg, lonArg) => {
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

      setShops(data);
    } catch (e) {
      // silent fail
    }
  }, [range]);

  // Fetch Campaign featured banners for Marketplace
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

  // Location management
  const getUserLocation = useCallback(async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setCity('Location Off');
        fetchShops(null, null);
        fetchFeaturedBanners(null, null);
        return;
      }

      // GPS Services enabled check
      const servicesEnabled = await Location.hasServicesEnabledAsync();
      if (!servicesEnabled) {
        setCity('GPS Disabled');
        fetchShops(null, null);
        fetchFeaturedBanners(null, null);
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
        fetchFeaturedBanners(latitude, longitude),
      ]);

      if (geo?.length > 0) {
        const label = buildCityLabel(geo[0]);
        if (label) {
          setCity(label);
        }
      }
    } catch (e) {
      setCity('Error');
    }
  }, [fetchShops, fetchFeaturedBanners]);

  // Handle marketplace initialization
  useEffect(() => {
    const initMarket = async () => {
      const results = await AsyncStorage.multiGet(['cached_city', 'lat', 'lon']);
      const cachedCity = results[0][1];
      const cachedLat = results[1][1];
      const cachedLon = results[2][1];

      if (cachedCity) setCity(cachedCity);
      if (cachedLat && cachedLon) {
        coordsRef.current = {
          latitude: parseFloat(cachedLat),
          longitude: parseFloat(cachedLon),
        };
        const lat = parseFloat(cachedLat);
        const lon = parseFloat(cachedLon);
        fetchShops(lat, lon);
        fetchFeaturedBanners(lat, lon);
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
    };
    initMarket();
  }, [fetchShops, fetchFeaturedBanners, getUserLocation]);

  // ─── FEATURED BANNER AUTO-SCROLL ───
  useEffect(() => {
    if (featuredBanners.length < 2) return;

    const iv = setInterval(() => {
      setActiveBanner((prev) => {
        const next = (prev + 1) % featuredBanners.length;
        bannerRef.current?.scrollTo({ x: next * (bannerWidth + 8), animated: true });
        return next;
      });
    }, 6000);

    return () => clearInterval(iv);
  }, [featuredBanners.length, bannerWidth]);

  const onBannerScroll = useCallback((e) => {
    setActiveBanner(Math.round(e.nativeEvent.contentOffset.x / (bannerWidth + 8)));
  }, [bannerWidth]);

  const stopPolling = useCallback(() => {
    if (pollTimer.current) { clearInterval(pollTimer.current); pollTimer.current = null; }
  }, []);

  const startPolling = useCallback(() => {
    stopPolling();
    pollTimer.current = setInterval(() => fetchData(true), POLL_MS);
  }, [fetchData, stopPolling]);

  useFocusEffect(
    useCallback(() => {
      const task = InteractionManager.runAfterInteractions(async () => {
        await fetchData(false);
        startPolling();

        if (triggerAction) {
          try {
            const token = await getToken();
            const actionTarget = triggerAction === 'open' ? 'open' : 'close';
            
            const res = await fetch(`${BASE_URL}/api/credits/report-action/`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
              body: JSON.stringify({ action: actionTarget }),
            });
            const actionData = await res.json();
            
            if (res.ok) {
              setShop(prev => prev ? ({ ...prev, is_open: actionTarget === 'open' }) : null);
              Alert.alert(
                actionTarget === 'open' ? 'Shop Opened! ✅' : 'Shop Closed! 🌙',
                actionTarget === 'open' ? 'Status updated. +0.5 Credits rewarded!' : 'Status updated.'
              );
            } else {
              Alert.alert('Error', actionData.error || 'Failed to update status');
            }
          } catch (e) {
            console.error('Quick action handling failed:', e);
          }
          // Clear parameters so it doesn't trigger on reload
          router.replace('/merchant/home');
        }
      });
      return () => { task.cancel(); stopPolling(); };
    }, [fetchData, startPolling, stopPolling, triggerAction, router])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    if (activeTab === 'dashboard') {
      await fetchData(false);
    } else {
      const { latitude: lat, longitude: lon } = coordsRef.current ?? {};
      await Promise.all([fetchShops(lat, lon), fetchFeaturedBanners(lat, lon), getUserLocation()]);
      setRefreshing(false);
    }
  }, [fetchData, fetchShops, fetchFeaturedBanners, getUserLocation, activeTab]);

  const toggleStatus = useCallback(async () => {
    if (!shop?.id || togglingStatus) return;
    const newIsOpen = !shop.is_open;
    setShop(prev => ({ ...prev, is_open: newIsOpen }));
    try {
      setTogglingStatus(true);
      const token = await getToken();
      await fetch(`${BASE_URL}/api/shop/status/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ shop_id: shop.id, status: newIsOpen ? 'open' : 'close' }),
      });
    } catch {
      setShop(prev => ({ ...prev, is_open: !newIsOpen }));
    } finally {
      setTogglingStatus(false);
    }
  }, [shop, togglingStatus]);

  const deleteBanner = useCallback((id) => {
    Alert.alert('Delete Banner', 'Remove this banner from your shop?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive', onPress: async () => {
          try {
            const token = await getToken();
            const res = await fetch(`${BASE_URL}/api/banner/delete/${id}/`, {
              method: 'DELETE', headers: { Authorization: `Bearer ${token}` },
            });
            if (res.ok) setBanners(prev => prev.filter(b => b.id !== id));
          } catch { Alert.alert('Error', 'Network failure'); }
        },
      },
    ]);
  }, []);

  const deletePost = useCallback((id) => {
    Alert.alert('Delete Post', 'Remove this image from your shop?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive', onPress: async () => {
          try {
            const token = await getToken();
            const res = await fetch(`${BASE_URL}/api/shop/media/delete/${id}/`, {
              method: 'DELETE', headers: { Authorization: `Bearer ${token}` },
            });
            if (res.ok) {
              setPosts(prev => prev.filter(p => p.id !== id));
              setStats(s => ({ ...s, posts: s.posts - 1 }));
            }
          } catch { Alert.alert('Error', 'Network failure'); }
        },
      },
    ]);
  }, []);

  const navigateToShop = useCallback((id) => router.push(`/shop/${id}`), [router]);

  const displayCity = useMemo(
    () => city.split(',').slice(0, 2).join(','),
    [city]
  );

  // Memoized filter logic for Shops and Products inside the Marketplace tab
  const { filteredShops, openNowShops, productResults } = useMemo(() => {
    if (!Array.isArray(shops)) {
      return { filteredShops: [], openNowShops: [], productResults: [] };
    }

    const query = search.toLowerCase().trim();
    const cutoff = range !== 'All' ? Number(range) : null;
    const products = [];

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
        console.log('merchant filtered sample', filtered.slice(0,10).map(s => ({ id: s.id, distance: s.distance, plan: s.plan })));
      } catch (e) {}
    }

    // Product search
    if (query) {
      shops.forEach((shop) => {
        if (onlyDeliverable) {
          if (!shop.delivery_available) return;
          const rangeLimit = shop.delivery_range != null && shop.delivery_range !== '' ? Number(shop.delivery_range) : null;
          if (rangeLimit !== null && shop.distance != null && Number(shop.distance) > rangeLimit) {
            return;
          }
        }
        (shop.items ?? []).forEach((item) => {
          if (!item.name?.toLowerCase().includes(query)) return;
          if (cutoff != null && (shop.distance == null || Number(shop.distance) > cutoff)) {
            return;
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

    return { filteredShops: filtered, openNowShops: openNow, productResults: products };
  }, [shops, search, selectedCategory, range, onlyDeliverable]);

  if (loading) return (
    <View style={styles.center}>
      <ActivityIndicator size="large" color="#2F5D50" />
    </View>
  );

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="dark" />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 120 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#2F5D50" colors={['#2F5D50']} />
        }
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
        {/* ── HEADER ── */}
        <View style={styles.header}>
          <View>
            <Text style={styles.headerTitle}>Merchant Portal</Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => {
                const isProPlus = shop?.plan && String(shop.plan).toLowerCase() === 'pro_plus';
                if (isProPlus) {
                  router.push('/notifications');
                } else {
                  Alert.alert(
                    'Upgrade to Pro Plus',
                    'Notification history is a premium feature exclusive to the Pro Plus subscription tier.',
                    [
                      { text: 'Cancel', style: 'cancel' },
                      { text: 'Upgrade Now', onPress: () => router.push('/merchant/profile') }
                    ]
                  );
                }
              }}
              style={{
                width: 38,
                height: 38,
                borderRadius: 12,
                backgroundColor: '#EEF2F0',
                alignItems: 'center',
                justifyContent: 'center',
                position: 'relative',
              }}
            >
              <Ionicons
                name={shop?.plan && String(shop.plan).toLowerCase() === 'pro_plus' ? "notifications" : "notifications-outline"}
                size={20}
                color={shop?.plan && String(shop.plan).toLowerCase() === 'pro_plus' ? '#2F5D50' : '#8E9A96'}
              />
              {unreadNotifications && shop?.plan && String(shop.plan).toLowerCase() === 'pro_plus' && (
                <View
                  style={{
                    position: 'absolute',
                    top: 8,
                    right: 8,
                    width: 8,
                    height: 8,
                    borderRadius: 4,
                    backgroundColor: '#E5484D',
                    borderWidth: 1.5,
                    borderColor: '#EEF2F0',
                  }}
                />
              )}
            </TouchableOpacity>
            <Image source={require('../../assets/images/logo_round.png')} style={styles.headerLogo} />
          </View>
        </View>

        {/* ── TAB BAR ── */}
        <View style={styles.tabBar}>
          <TouchableOpacity
            style={[styles.tabItem, activeTab === 'dashboard' && styles.tabItemActive]}
            onPress={() => setActiveTab('dashboard')}
            activeOpacity={0.8}
          >
            <Ionicons name="stats-chart-outline" size={16} color={activeTab === 'dashboard' ? '#fff' : '#5A7470'} />
            <Text style={[styles.tabText, activeTab === 'dashboard' && styles.tabTextActive]}>My Dashboard</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.tabItem}
            onPress={async () => {
              await AsyncStorage.setItem('role', 'customer');
              router.replace('/shop/home');
            }}
            activeOpacity={0.8}
          >
            <Ionicons name="swap-horizontal-outline" size={16} color="#5A7470" />
            <Text style={styles.tabText}>Switch to Customer</Text>
          </TouchableOpacity>
        </View>

        {activeTab === 'dashboard' ? (
          <>
            {/* ── SHOP HERO CARD ── */}
            {shop && (
              <View style={styles.shopCard}>
                {/* Left: avatar + info */}
                <View style={styles.shopLeft}>
                  <View style={styles.shopAvatar}>
                    <Text style={styles.shopAvatarText}>{shop.name?.[0]?.toUpperCase()}</Text>
                  </View>
                  <View style={styles.shopInfo}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Text style={styles.shopName} numberOfLines={1}>
                        {shop?.plan && String(shop.plan).toLowerCase() === 'pro_plus' ? '✅ ' : (shop?.plan && String(shop.plan).toLowerCase() === 'pro' ? '⭐ ' : '')}{shop.name}
                      </Text>
                      {shop?.plan && String(shop.plan).toLowerCase() === 'pro_plus' ? (
                        <View style={[styles.premiumBadge, styles.verifiedGlow, { backgroundColor: '#A855F7', position: 'relative', top: 0, right: 0, width: 20, height: 20, borderRadius: 10 }]}> 
                          <Ionicons name="checkmark-circle" size={11} color="#FFFFFF" />
                        </View>
                      ) : (shop?.plan && String(shop.plan).toLowerCase() === 'pro') ? (
                        <View style={[styles.premiumBadge, styles.premiumGlow, { backgroundColor: '#EAB308', position: 'relative', top: 0, right: 0, width: 20, height: 20, borderRadius: 10 }]}> 
                          <Ionicons name="star" size={9} color="#FFFFFF" />
                        </View>
                      ) : null}
                    </View>
                    <View style={styles.statusRow}>
                      <View style={[styles.statusPulse, { backgroundColor: shop.is_open ? '#10B981' : '#D1D5DB' }]} />
                      <Text style={[styles.statusText, { color: shop.is_open ? '#059669' : '#9CA3AF' }]}>
                        {shop.is_open ? 'Open for business' : 'Closed'}
                      </Text>
                    </View>
                  </View>
                </View>
                {/* Right: toggle */}
                <TouchableOpacity
                  style={[styles.togglePill, shop.is_open ? styles.togglePillOpen : styles.togglePillClosed]}
                  onPress={toggleStatus}
                  disabled={togglingStatus}
                  activeOpacity={0.8}
                >
                  {togglingStatus
                    ? <ActivityIndicator size="small" color={shop.is_open ? '#EF4444' : '#2F5D50'} />
                    : <>
                        <View style={[styles.toggleDot, { backgroundColor: shop.is_open ? '#EF4444' : '#2F5D50' }]} />
                        <Text style={[styles.toggleText, { color: shop.is_open ? '#EF4444' : '#2F5D50' }]}>
                          {shop.is_open ? 'Close' : 'Open'}
                        </Text>
                      </>
                  }
                </TouchableOpacity>
              </View>
            )}

            {/* ── CREDITS & HEALTH DASHBOARD ── */}
            <View style={styles.creditsSection}>
              {/* Credits Card */}
              <View style={styles.creditsCard}>
                <View style={styles.creditsHeader}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Ionicons name="wallet-outline" size={16} color="#2F5D50" />
                    <Text style={styles.creditsTitle}>My Credits</Text>
                  </View>
                  <View style={styles.tierBadge}>
                    <Text style={styles.tierBadgeText}>{creditData.tier}</Text>
                  </View>
                </View>

                <View style={styles.creditsBody}>
                  <View style={styles.creditItem}>
                    <Text style={styles.creditVal}>{creditData.available_credits}</Text>
                    <Text style={styles.creditLbl}>Available</Text>
                  </View>
                  <View style={styles.creditItem}>
                    <Text style={styles.creditVal}>{creditData.total_earned}</Text>
                    <Text style={styles.creditLbl}>Earned</Text>
                  </View>
                  <View style={styles.creditItem}>
                    <Text style={styles.creditVal}>{creditData.today_earned}</Text>
                    <Text style={styles.creditLbl}>Today</Text>
                  </View>
                </View>

                <View style={styles.adActionRow}>
                  <TouchableOpacity
                    style={[styles.adBtn, !adLoaded && styles.adBtnDisabled]}
                    onPress={watchAd}
                    disabled={!adLoaded}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="play-circle-outline" size={14} color="#fff" />
                    <Text style={styles.adBtnText}>{adLoaded ? 'Watch Ad (+0.5 Cr)' : 'Loading Ad...'}</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Shop Health Score Card */}
              <View style={styles.healthCard}>
                <View style={styles.healthHeader}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Ionicons name="heart-half-outline" size={16} color="#E11D48" />
                    <Text style={styles.healthTitle}>Shop Health</Text>
                  </View>
                  <Text style={styles.healthScoreVal}>{creditData.shop_health}/100</Text>
                </View>
                
                {/* Progress Bar */}
                <View style={styles.healthProgressBg}>
                  <View style={[styles.healthProgressFill, { width: `${creditData.shop_health}%` }]} />
                </View>
                
                <Text style={styles.healthHint}>
                  {creditData.shop_health >= 80 ? '🌟 Excellent health score!' : '📈 Set hours & upload items to boost!'}
                </Text>
              </View>
            </View>

            {/* ── STATS ROW ── */}
            <View style={styles.statsRow}>
              <Stat label="Posts" value={stats.posts} icon="images-outline" />
              <View style={styles.statDivider} />
              <Stat label="Followers" value={stats.followers} icon="heart-outline" />
              <View style={styles.statDivider} />
              <Stat label="Views (Week)" value={stats.views} icon="eye-outline" />
              {['pro', 'pro_plus'].includes(shop?.plan) && (
                <>
                  <View style={styles.statDivider} />
                  <Stat 
                    label="Rating" 
                    value={shop?.average_rating ? `${Number(shop.average_rating).toFixed(1)} (${shop.total_ratings || 0})` : '0.0 (0)'} 
                    icon="star-outline" 
                  />
                </>
              )}
            </View>

            {/* ── QUICK ACTIONS ── */}
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Quick Actions</Text>
            </View>
            <View style={styles.actionsRow}>
              <Action icon="add-circle-outline" label="New Post" highlight onPress={() => router.push('/merchant/create-post')} />
              <Action icon="storefront-outline" label="Store" onPress={() => shop && router.push(`/shop/${shop.id}`)} />
              <Action icon="settings-outline" label="Settings" onPress={() => router.push('/merchant/profile')} />
            </View>

            {!isPro && <AdBanner />}

            {/* ── BANNERS ── */}
            {banners.length > 0 && (
              <>
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>Banners</Text>
                  <View style={styles.countPill}>
                    <Text style={styles.countPillText}>{banners.length}</Text>
                  </View>
                </View>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{ paddingLeft: 20, paddingRight: 8 }}
                  decelerationRate="fast"
                >
                  {banners.map(b => (
                    <BannerCard key={b.id} b={b} onDelete={deleteBanner} />
                  ))}
                </ScrollView>
              </>
            )}

            {/* ── GALLERY ── */}
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Gallery</Text>
              <View style={styles.countPill}>
                <Text style={styles.countPillText}>{posts.length}</Text>
              </View>
            </View>

            {posts.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Ionicons name="images-outline" size={32} color="#D1D5DB" />
                <Text style={styles.emptyText}>No photos yet</Text>
                <TouchableOpacity
                  style={styles.emptyBtn}
                  onPress={() => router.push('/merchant/create-post')}
                  activeOpacity={0.8}
                >
                  <Text style={styles.emptyBtnText}>Upload first photo</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.grid}>
                {posts.map((post, index) => (
                  <PostCard key={post.id ?? index} post={post} onDelete={deletePost} />
                ))}
              </View>
            )}
          </>
        ) : (
          <>
            {/* ── MARKETPLACE SEARCH & DISCOVERY TAB ── */}
            <View style={styles.greetingBlock}>
              <View style={styles.locationContainer}>
                <TouchableOpacity
                  style={styles.locationPill}
                  onPress={getUserLocation}
                  activeOpacity={0.75}
                >
                  <Ionicons name="location" size={11} color={C.primary} />
                  <Text numberOfLines={1} style={styles.locationText}>
                    {displayCity}
                  </Text>
                  <Ionicons name="reload" size={11} color={C.textSoft} />
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => router.push('/favorites')}
                  style={styles.marketFavBtn}
                  activeOpacity={0.75}
                >
                  <Ionicons name="heart-outline" size={19} color={C.primary} />
                </TouchableOpacity>
              </View>

              <Text style={styles.greetingEyebrow}>Explore Local Shops & Products 👋</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' }}>
                <Text style={styles.greetingHeadline}>
                  Find <Text style={styles.greetingAccent}>shops</Text> & <Text style={styles.greetingAccent}>products</Text> near you
                </Text>
                <View style={{ marginLeft: 6 }}>
                  <Sparkle size={20} color={C.accentVibrant} />
                </View>
              </View>
            </View>

            {/* SEARCH BAR & DOORSTEP TOGGLE */}
            <View style={{ flexDirection: 'row', alignItems: 'center', marginHorizontal: 18, marginBottom: 16, gap: 8 }}>
              <View style={[styles.searchWrap, searchFocused && styles.searchWrapFocused, { flex: 1, marginHorizontal: 0, marginBottom: 0 }]}>
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
                  style={styles.searchInput}
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
                    <View style={styles.searchClearBtn}>
                      <Ionicons name="close" size={12} color={C.textSoft} />
                    </View>
                  </TouchableOpacity>
                )}
              </View>

              <TouchableOpacity
                style={[styles.deliveryToggleChip, onlyDeliverable && styles.deliveryToggleChipActive, { height: 52, borderRadius: 18, justifyContent: 'center', alignSelf: 'stretch', paddingHorizontal: 12 }]}
                onPress={() => setOnlyDeliverable(!onlyDeliverable)}
                activeOpacity={0.75}
              >
                <Ionicons name="bicycle-outline" size={16} color={onlyDeliverable ? '#fff' : '#0A5C43'} />
                <Text style={[styles.deliveryToggleChipText, onlyDeliverable && styles.deliveryToggleChipTextActive, { fontSize: 12, marginLeft: 2 }]}>
                  Doorstep
                </Text>
              </TouchableOpacity>
            </View>

            {/* RANGE SELECTOR */}
            <View style={[styles.rangeRow, { paddingRight: 18 }]}>
              <Ionicons name="radio-outline" size={13} color={C.textMuted} />
              <Text style={styles.rangeLabel}>Range</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ gap: 6 }}
                style={{ flex: 1 }}
              >
                {RANGES.map((r) => (
                  <TouchableOpacity
                    key={r}
                    style={[styles.rangeChip, range === r && styles.rangeChipActive]}
                    onPress={() => setRange(r)}
                    activeOpacity={0.75}
                  >
                    <Text style={[styles.rangeChipText, range === r && styles.rangeChipTextActive]}>
                      {r === 'All' ? 'Any' : `${r} km`}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            {/* CATEGORIES */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{
                paddingLeft: 18,
                paddingRight: 18,
                gap: 7,
              }}
              style={{ marginBottom: 12 }}
            >
              {CATEGORIES.map((cat) => {
                const active = selectedCategory === cat.name;
                const catColor = CATEGORY_COLORS[cat.name] || CATEGORY_COLORS.Others;
                return (
                  <TouchableOpacity
                    key={cat.name}
                    onPress={() => setSelectedCategory(cat.name)}
                    style={[
                      styles.catChip,
                      active && [
                        styles.catChipActive,
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
                    <Text style={[styles.catChipText, active && { color: '#fff' }]}>
                      {cat.name}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {!isPro && <AdBanner />}

            {/* PRODUCT RESULTS */}
            {search.length > 0 && productResults.length > 0 && (
              <>
                <SectionHeader title="Products" count={`${productResults.length} found`} />
                <View style={styles.gridMarket}>
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
                    style={styles.loadMoreBtn}
                    onPress={() => setProductPage((p) => p + 1)}
                    activeOpacity={0.75}
                  >
                    <Text style={styles.loadMoreText}>Show more products</Text>
                    <Ionicons name="chevron-down" size={14} color={C.primary} />
                  </TouchableOpacity>
                )}
              </>
            )}

            {/* FEATURED BANNERS */}
            {featuredBanners.length > 0 && !search && (
              <View style={styles.bannerSectionMarket}>
                <ScrollView
                  ref={bannerRef}
                  horizontal
                  pagingEnabled
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
                        <View style={styles.bannerImageWrapMarket}>
                          <Image
                            source={{ uri: getImageUrl(b.image) }}
                            style={styles.bannerImageMarket}
                            resizeMode="cover"
                          />
                          {b.link && (
                            <View style={styles.bannerLinkIconMarket}>
                              <Ionicons name="open-outline" size={12} color={C.white} />
                            </View>
                          )}
                        </View>
                      ) : (
                        <View
                          style={[
                            styles.bannerTextCardMarket,
                            { backgroundColor: b.background_color || C.primary },
                          ]}
                        >
                          {b.link && (
                            <View style={styles.bannerLinkIconMarket}>
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
                            <Text style={styles.bannerEyebrowMarket}>
                              {b.small_text || 'mydukan'}
                            </Text>
                            <Text style={styles.bannerTitleMarket}>
                              {b.title || 'Save your time'}
                            </Text>
                            <Text style={styles.bannerSubtitleMarket}>
                              {b.subtitle || 'Find nearby shops instantly'}
                            </Text>
                          </View>
                        </View>
                      )}
                    </TouchableOpacity>
                  ))}
                </ScrollView>
                <View style={styles.bannerDotsMarket}>
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
                          styles.bannerDotMarket,
                          activeBanner === i
                            ? styles.bannerDotActiveMarket
                            : styles.bannerDotInactiveMarket,
                        ]}
                      />
                    </Pressable>
                  ))}
                </View>
              </View>
            )}

            {/* OPEN NOW */}
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
                  style={{ marginBottom: 12 }}
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

            {/* NEARBY SHOPS */}
            <SectionHeader
              title={search ? 'Matching Shops' : 'Nearby Shops'}
              count={`${filteredShops.length} shops`}
            />

            {filteredShops.length === 0 ? (
              <View style={styles.emptyState}>
                <View style={styles.emptyIconWrap}>
                  <View style={styles.emptyIconRing}>
                    <Ionicons name="storefront-outline" size={34} color={C.primary} />
                  </View>
                </View>
                <Text style={styles.emptyTitle}>No shops found</Text>
                <Text style={styles.emptySubtitle}>
                  {search
                    ? 'Try a different search term'
                    : 'Try expanding the distance range'}
                </Text>
              </View>
            ) : (
              <>
                <View style={styles.gridMarket}>
                  {filteredShops.slice(0, shopPage * PAGE_SIZE).map((item) => (
                    <ShopCard key={item.id} item={item} onPress={navigateToShop} />
                  ))}
                </View>
                {shopPage * PAGE_SIZE < filteredShops.length && (
                  <TouchableOpacity
                    style={styles.loadMoreBtn}
                    onPress={() => setShopPage((p) => p + 1)}
                    activeOpacity={0.75}
                  >
                    <Text style={styles.loadMoreText}>
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
                      style={styles.loadMoreBtn}
                      onPress={() => setShopPage(1)}
                      activeOpacity={0.75}
                    >
                      <Text style={styles.loadMoreText}>Show less</Text>
                      <Ionicons name="chevron-up" size={14} color={C.primary} />
                    </TouchableOpacity>
                  )}
              </>
            )}
          </>
        )}
      </ScrollView>

      {/* ── FOOTER ── */}
      <View style={styles.footer}>
        <NavBtn icon="home"           label="Home"    active />
        <NavBtn icon="grid-outline"   label="Items"   onPress={() => router.push('/merchant/items')} />
        <TouchableOpacity style={styles.addBtn} onPress={() => router.push('/merchant/create-post')} activeOpacity={0.85}>
          <Ionicons name="add" size={28} color="#fff" />
        </TouchableOpacity>
        <NavBtn icon="cart-outline"   label="Orders"  onPress={() => router.push('/merchant/orders')} />
        <NavBtn icon="person-outline" label="Profile" onPress={() => router.push('/merchant/profile')} />
      </View>
      <AppUpdateModal />
    </SafeAreaView>
  );
}

// ─── styles ───────────────────────────────────────────────────────────────────
const CARD_RADIUS = 18;
const GREEN = '#2F5D50';
const DARK = '#1A3C34';

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F5F7F6' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F5F7F6' },

  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 22,
    paddingTop: 14,
    paddingBottom: 6,
  },
  welcomeText: {
    fontSize: 12,
    color: '#94A3A0',
    fontWeight: '500',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: '#0F2923',
    letterSpacing: -0.5,
    marginTop: 1,
  },
  headerLogo: {
    width: 38,
    height: 38,
    borderRadius: 12,
  },

  // Tabs Bar
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#EEF2F0',
    borderRadius: 14,
    padding: 4,
    marginHorizontal: 20,
    marginTop: 16,
    marginBottom: 6,
    gap: 4,
  },
  tabItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 10,
    gap: 6,
  },
  tabItemActive: {
    backgroundColor: GREEN,
    shadowColor: GREEN,
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 3,
  },
  tabText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#5A7470',
  },
  tabTextActive: {
    color: '#fff',
    fontWeight: '700',
  },

  // Shop Card
  shopCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    marginHorizontal: 20,
    marginTop: 16,
    marginBottom: 4,
    padding: 16,
    borderRadius: CARD_RADIUS,
    shadowColor: '#1A3C34',
    shadowOpacity: 0.07,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  shopLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  shopAvatar: {
    width: 46,
    height: 46,
    borderRadius: 14,
    backgroundColor: DARK,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  shopAvatarText: {
    fontSize: 20,
    fontWeight: '800',
    color: '#fff',
  },
  shopInfo: { flex: 1 },
  shopName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F2923',
    letterSpacing: -0.2,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 3,
    gap: 5,
  },
  statusPulse: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '500',
  },
  togglePill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 50,
    gap: 5,
    borderWidth: 1.5,
  },
  togglePillOpen: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
  },
  togglePillClosed: {
    backgroundColor: '#F0FDF4',
    borderColor: '#A7F3D0',
  },
  toggleDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  toggleText: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.2,
  },

  // Stats
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    marginHorizontal: 20,
    marginTop: 12,
    borderRadius: CARD_RADIUS,
    paddingVertical: 18,
    paddingHorizontal: 10,
    shadowColor: '#1A3C34',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  statCard: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  statDivider: {
    width: 1,
    height: 36,
    backgroundColor: '#EEF1F0',
  },
  statIconBox: {
    width: 30,
    height: 30,
    borderRadius: 10,
    backgroundColor: '#EEF4F2',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 2,
  },
  statNumber: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0F2923',
    letterSpacing: -0.5,
  },
  statLabel: {
    fontSize: 11,
    color: '#94A3A0',
    fontWeight: '500',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },

  // Section Headers
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 22,
    marginTop: 24,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F2923',
    letterSpacing: -0.2,
  },
  countPill: {
    backgroundColor: '#EEF4F2',
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  countPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: GREEN,
  },

  // Actions
  actionsRow: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    gap: 10,
  },
  actionCard: {
    flex: 1,
    backgroundColor: '#fff',
    paddingVertical: 16,
    paddingHorizontal: 10,
    borderRadius: 16,
    alignItems: 'center',
    gap: 8,
    shadowColor: '#1A3C34',
    shadowOpacity: 0.05,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  actionCardHighlight: {
    backgroundColor: DARK,
    shadowColor: DARK,
    shadowOpacity: 0.25,
    shadowRadius: 10,
  },
  actionIconBox: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: '#EEF4F2',
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionIconBoxHighlight: {
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  actionText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#5A7470',
    letterSpacing: 0.1,
  },
  actionTextHighlight: {
    color: '#E8F5F1',
  },

  // Banners
  bannerWrapper: {
    width: 210,
    height: 96,
    marginRight: 10,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#ddd',
    position: 'relative',
  },
  bannerImg: { width: '100%', height: '100%', resizeMode: 'cover' },
  bannerScrim: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.3)' },
  bannerOverlay: { position: 'absolute', bottom: 10, left: 12, right: 10 },
  bannerTextCard: { flex: 1, justifyContent: 'center', padding: 14 },
  bannerSmall: { fontSize: 9, color: 'rgba(255,255,255,0.7)', letterSpacing: 0.8, textTransform: 'uppercase' },
  bannerTitle: { fontSize: 13, fontWeight: '800', color: '#fff', letterSpacing: -0.2 },
  bannerDiscount: { fontSize: 18, fontWeight: '900', color: '#fff', letterSpacing: -0.5, marginTop: 1 },
  bannerSub: { fontSize: 10, color: 'rgba(255,255,255,0.8)', marginTop: 2 },
  deleteBadge: {
    position: 'absolute', top: 8, right: 8,
    backgroundColor: 'rgba(0,0,0,0.45)',
    width: 22, height: 22, borderRadius: 11,
    justifyContent: 'center', alignItems: 'center',
    zIndex: 5,
  },

  // Gallery & Grid
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 20,
    gap: 10,
  },
  postCard: {
    width: (width - 50) / 2,
    height: 118,
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: '#E8EEEC',
    position: 'relative',
  },
  postImage: { width: '100%', height: '100%', resizeMode: 'cover' },
  postDeleteBadge: {
    position: 'absolute', top: 7, right: 7,
    backgroundColor: 'rgba(0,0,0,0.45)',
    width: 24, height: 24, borderRadius: 12,
    justifyContent: 'center', alignItems: 'center',
  },

  // Empty state
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 36,
    gap: 8,
  },
  emptyText: {
    fontSize: 14,
    color: '#B0BAB8',
    fontWeight: '500',
  },
  emptyBtn: {
    marginTop: 6,
    backgroundColor: DARK,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 50,
  },
  emptyBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 13,
    letterSpacing: 0.2,
  },

  // Footer
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

  // ── MARKETPLACE STYLES ──────────────────────────────────────────────────────
  greetingBlock: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 20,
  },
  locationContainer: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  locationPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: C.primaryLight,
    paddingHorizontal: 11,
    paddingVertical: 8,
    borderRadius: 22,
    borderWidth: 1.5,
    borderColor: 'rgba(10, 92, 67, 0.15)',
    flex: 1,
  },
  marketFavBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(10, 92, 67, 0.15)',
    marginLeft: 10,
  },
  locationText: {
    fontWeight: '600',
    fontSize: 12,
    color: C.text,
    maxWidth: 180,
    letterSpacing: -0.1,
  },
  greetingEyebrow: {
    fontSize: 13,
    color: C.textSoft,
    fontWeight: '500',
    marginBottom: 6,
    letterSpacing: 0.1,
  },
  greetingHeadline: {
    fontSize: 24,
    fontWeight: '800',
    color: C.primaryDark,
    lineHeight: 30,
    letterSpacing: -0.5,
  },
  greetingAccent: {
    color: C.primary,
    fontWeight: '900',
  },

  // Search Wrap
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    marginHorizontal: 18,
    borderRadius: 18,
    paddingHorizontal: 15,
    height: 52,
    marginBottom: 16,
    borderWidth: 1.5,
    borderColor: '#E0EAE6',
    gap: 10,
    shadowColor: '#0A5C43',
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  searchWrapFocused: {
    borderColor: C.primary,
    borderWidth: 2,
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 4,
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
    backgroundColor: '#E0EAE6',
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
    backgroundColor: '#fff',
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#E0EAE6',
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
    color: '#fff',
    fontWeight: '700',
  },

  // Categories
  catChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 13,
    paddingVertical: 8,
    backgroundColor: '#fff',
    borderRadius: 22,
    borderWidth: 1.5,
    borderColor: '#E0EAE6',
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

  // Section Header Market
  sectionHeaderMarket: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 18,
    marginTop: 20,
    marginBottom: 14,
  },
  sectionTitleMarket: {
    fontWeight: '800',
    fontSize: 18,
    color: C.text,
    letterSpacing: -0.4,
  },
  sectionSubtitleMarket: {
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

  // Grid Market
  gridMarket: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 18,
    gap: 12,
    marginBottom: 12,
  },

  // Card styles
  card: {
    width: CARD_WIDTH,
    backgroundColor: '#fff',
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
    height: 110,
  },
  cardImageScrim: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 50,
  },
  statusPillBadge: {
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
  statusDotBadge: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusTextBadge: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.1,
  },
  premiumBadge: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  premiumGlow: {
    shadowColor: '#FFD700',
    shadowOpacity: 0.5,
    shadowRadius: 8,
    elevation: 4,
  },
  verifiedGlow: {
    shadowColor: '#A855F7',
    shadowOpacity: 0.5,
    shadowRadius: 8,
    elevation: 4,
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
    color: '#fff',
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
    backgroundColor: '#fff',
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
    borderColor: '#fff',
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

  // Empty State
  emptyState: {
    alignItems: 'center',
    marginTop: 40,
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

  // ── Featured Banners Market
  bannerSectionMarket: {
    paddingHorizontal: 16,
    marginTop: 12,
    marginBottom: 12,
  },
  bannerImageWrapMarket: {
    borderRadius: 22,
    overflow: 'hidden',
    position: 'relative',
    shadowColor: '#0A3A28',
    shadowOpacity: 0.08,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
  bannerImageMarket: {
    width: '100%',
    aspectRatio: 16 / 5,
    borderRadius: 22,
  },
  bannerLinkIconMarket: {
    position: 'absolute',
    top: 12,
    right: 12,
    backgroundColor: 'rgba(0,0,0,0.42)',
    padding: 7,
    borderRadius: 24,
  },
  bannerTextCardMarket: {
    aspectRatio: 16 / 5,
    borderRadius: 22,
    padding: 22,
    justifyContent: 'center',
    overflow: 'hidden',
    position: 'relative',
    shadowColor: '#0A3A28',
    shadowOpacity: 0.08,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
  bannerEyebrowMarket: {
    color: 'rgba(255,255,255,0.65)',
    fontSize: 9,
    letterSpacing: 1.9,
    textTransform: 'uppercase',
    fontWeight: '700',
  },
  bannerTitleMarket: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '900',
    lineHeight: 28,
    letterSpacing: -0.5,
  },
  bannerSubtitleMarket: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 12,
    fontWeight: '500',
    letterSpacing: -0.1,
  },
  bannerDotsMarket: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 12,
    gap: 6,
  },
  bannerDotMarket: {
    height: 5,
    borderRadius: 2.5,
  },
  bannerDotActiveMarket: {
    width: 24,
    backgroundColor: C.primary,
  },
  bannerDotInactiveMarket: {
    width: 5,
    backgroundColor: C.borderMid,
  },

  // ── CREDIT & HEALTH DASHBOARD
  creditsSection: {
    paddingHorizontal: 16,
    marginTop: 12,
    marginBottom: 6,
    gap: 12,
  },
  creditsCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E0E7E5',
    padding: 16,
  },
  creditsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  creditsTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#1A332D',
  },
  tierBadge: {
    backgroundColor: '#E8F5E9',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  tierBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#2E7D32',
    textTransform: 'uppercase',
  },
  creditsBody: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  creditItem: {
    alignItems: 'center',
    flex: 1,
  },
  creditVal: {
    fontSize: 18,
    fontWeight: '900',
    color: '#2F5D50',
  },
  creditLbl: {
    fontSize: 10,
    color: '#7B8884',
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  adActionRow: {
    borderTopWidth: 1,
    borderTopColor: '#F0F4F2',
    paddingTop: 10,
  },
  adBtn: {
    backgroundColor: '#2F5D50',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 12,
  },
  adBtnDisabled: {
    backgroundColor: '#7B8884',
    opacity: 0.7,
  },
  adBtnText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '800',
  },
  healthCard: {
    backgroundColor: '#FFF1F2',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#FFE4E6',
    padding: 16,
  },
  healthHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  healthTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#9F1239',
  },
  healthScoreVal: {
    fontSize: 16,
    fontWeight: '900',
    color: '#E11D48',
  },
  healthProgressBg: {
    height: 6,
    backgroundColor: '#FFE4E6',
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 10,
  },
  healthProgressFill: {
    height: '100%',
    backgroundColor: '#E11D48',
    borderRadius: 3,
  },
  healthHint: {
    fontSize: 10.5,
    color: '#9F1239',
    fontWeight: '600',
  },
});