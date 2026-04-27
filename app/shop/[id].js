import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  RefreshControl,
  Share,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const BASE_URL = 'http://10.194.216.149:8000';
const { width } = Dimensions.get('window');
const COVER_HEIGHT = 300;
const POLL_INTERVAL = 15_000;

// ─── Palette ──────────────────────────────────────────────────────────────────
const C = {
  primary: '#1B6B50',
  primaryLight: '#EAF4EF',
  accent: '#22C55E',
  gold: '#F5A623',
  white: '#FFFFFF',
  bg: '#F0F3F2',
  text: '#111111',
  textMid: '#555555',
  textLight: '#AAAAAA',
  border: '#EBEBEB',
  shadow: '#000000',
  call: '#1B6B50',
  whatsapp: '#25D366',
  map: '#3A86FF',
};

// ─── Custom hook: shop data + favorites ──────────────────────────────────────
function useShopData(id) {
  const [shop, setShop] = useState(null);
  const [banners, setBanners] = useState([]);
  const [media, setMedia] = useState([]);
  const [items, setItems] = useState([]);
  const [favorite, setFavorite] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Load from cache first (instant paint)
  useEffect(() => {
    AsyncStorage.getItem(`shop_${id}`).then(raw => {
      if (!raw) return;
      try {
        const d = JSON.parse(raw);
        setShop(d.shop);
        setBanners(d.banners ?? []);
        setMedia(d.media ?? []);
        setItems(d.items ?? []);
        setLoading(false);
      } catch { /* corrupt cache — ignore */ }
    });
  }, [id]);

  const fetchShop = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true);

      const [[, lat], [, lon], [, user_id]] = await AsyncStorage.multiGet(['lat', 'lon', 'user_id']);
      const hasLoc = lat && lon && lat !== 'null' && lon !== 'null';
      const shopUrl = hasLoc
        ? `${BASE_URL}/api/shops/${id}/?lat=${lat}&lon=${lon}`
        : `${BASE_URL}/api/shops/${id}/`;

      const [shopRes, favRes] = await Promise.all([
        fetch(shopUrl),
        fetch(`${BASE_URL}/api/favorites/${user_id}/`),
      ]);

      if (!shopRes.ok) return;
      const shopData = await shopRes.json();
      if (!shopData?.shop) return;

      const favData = favRes.ok ? await favRes.json() : [];

      setShop(shopData.shop);
      setBanners(shopData.banners ?? []);
      setMedia(shopData.media ?? []);
      setItems(shopData.items ?? []);
      setFavorite(Array.isArray(favData) && favData.some(f => f.id === shopData.shop.id));

      AsyncStorage.setItem(`shop_${id}`, JSON.stringify({
        shop: shopData.shop,
        banners: shopData.banners ?? [],
        media: shopData.media ?? [],
        items: shopData.items ?? [],
      }));
    } catch { /* silent – background refresh */ }
    finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [id]);

  // Initial fetch + poll
  useEffect(() => {
    fetchShop();
    const iv = setInterval(fetchShop, POLL_INTERVAL);
    return () => clearInterval(iv);
  }, [fetchShop]);

  const onRefresh = useCallback(() => fetchShop(true), [fetchShop]);

  const toggleFavorite = useCallback(async (shopId) => {
    setFavorite(prev => !prev);
    const user_id = await AsyncStorage.getItem('user_id');
    fetch(`${BASE_URL}/api/favorite/toggle/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id, shop_id: shopId }),
    }).catch(() => setFavorite(prev => !prev)); // revert on error
  }, []);

  return { shop, banners, media, items, favorite, loading, refreshing, onRefresh, toggleFavorite };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
const getImageUrl = img =>
  !img ? 'https://via.placeholder.com/400x300'
    : img.startsWith('http') ? img
    : `${BASE_URL}${img}`;

const templateColors = { red: '#C0392B', green: '#1B6B50', dark: '#181825' };
const getTemplateBg = t => ({ backgroundColor: templateColors[t] ?? '#1B6B50' });

// ─── CategoryPill ─────────────────────────────────────────────────────────────
const CategoryPill = ({ label }) => (
  <View style={s.categoryPill}>
    <Text style={s.categoryPillText}>{label}</Text>
  </View>
);

// ─── ActionBtn ───────────────────────────────────────────────────────────────
const ActionBtn = ({ icon, label, color, onPress, disabled }) => (
  <TouchableOpacity
    style={[s.actionBtn, { backgroundColor: color }, disabled && s.actionBtnDisabled]}
    onPress={onPress}
    disabled={disabled}
    activeOpacity={0.78}
  >
    <Ionicons name={icon} size={19} color={C.white} />
    <Text style={s.actionBtnText}>{label}</Text>
  </TouchableOpacity>
);

// ─── FloatBtn ────────────────────────────────────────────────────────────────
const FloatBtn = ({ icon, onPress, color = C.white }) => (
  <TouchableOpacity
    style={s.floatBtn}
    onPress={onPress}
    activeOpacity={0.78}
    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
  >
    <Ionicons name={icon} size={20} color={color} />
  </TouchableOpacity>
);

// ─── ItemCard ────────────────────────────────────────────────────────────────
const ItemCard = ({ item, onPress }) => {
  const scale = useRef(new Animated.Value(1)).current;

  const onPressIn = useCallback(() =>
    Animated.spring(scale, { toValue: 1.06, useNativeDriver: true, speed: 80, bounciness: 12 }).start()
  , [scale]);

  const onPressOut = useCallback(() =>
    Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 40, bounciness: 8 }).start()
  , [scale]);

  const handlePress = useCallback(() => onPress(item), [item, onPress]);

  return (
    <TouchableWithoutFeedback onPressIn={onPressIn} onPressOut={onPressOut} onPress={handlePress}>
      <Animated.View style={[s.itemCard, { transform: [{ scale }] }]}>
        <Image source={{ uri: getImageUrl(item.image) }} style={s.itemImg} resizeMode="cover" />
        {item.price != null && (
          <View style={s.itemPriceBadge}>
            <Text style={s.itemPriceBadgeText}>₹{item.price}</Text>
          </View>
        )}
        <View style={s.itemBody}>
          <Text style={s.itemName} numberOfLines={2}>{item.name}</Text>
          {item.description ? <Text style={s.itemDesc} numberOfLines={1}>{item.description}</Text> : null}
        </View>
      </Animated.View>
    </TouchableWithoutFeedback>
  );
};

// ─── ItemModal ────────────────────────────────────────────────────────────────
const ItemModal = ({ item, visible, onClose }) => {
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(anim, {
      toValue: visible ? 1 : 0,
      useNativeDriver: true,
      speed: 20,
      bounciness: 6,
    }).start();
  }, [visible, anim]);

  if (!item) return null;

  const scaleOut = anim.interpolate({ inputRange: [0, 1], outputRange: [0.88, 1] });
  const slideOut = anim.interpolate({ inputRange: [0, 1], outputRange: [40, 0] });

  return (
    <Modal transparent visible={visible} onRequestClose={onClose} animationType="fade">
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={s.modalOverlay}>
          <TouchableWithoutFeedback>
            <Animated.View
              style={[s.modalCard, { opacity: anim, transform: [{ scale: scaleOut }, { translateY: slideOut }] }]}
            >
              <Image source={{ uri: getImageUrl(item.image) }} style={s.modalImage} resizeMode="cover" />
              <TouchableOpacity style={s.modalClose} onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name="close" size={18} color={C.text} />
              </TouchableOpacity>
              <View style={s.modalBody}>
                <Text style={s.modalName}>{item.name}</Text>
                {item.price != null && <Text style={s.modalPrice}>₹{item.price}</Text>}
                {item.description ? <Text style={s.modalDesc}>{item.description}</Text> : null}
              </View>
            </Animated.View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
};

// ─── Skeleton loader ─────────────────────────────────────────────────────────
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
  return <Animated.View style={[{ backgroundColor: '#E0E0E0', borderRadius: 8 }, style, { opacity }]} />;
};

const LoadingScreen = () => (
  <View style={s.safe}>
    <StatusBar style="dark" />
    <Skeleton style={{ height: COVER_HEIGHT, borderRadius: 0 }} />
    <View style={{ padding: 22, gap: 12 }}>
      <Skeleton style={{ height: 26, width: '60%' }} />
      <Skeleton style={{ height: 16, width: '40%' }} />
      <Skeleton style={{ height: 16, width: '80%' }} />
      <View style={{ flexDirection: 'row', gap: 10, marginTop: 8 }}>
        {[1, 2, 3].map(i => <Skeleton key={i} style={{ flex: 1, height: 52, borderRadius: 16 }} />)}
      </View>
    </View>
  </View>
);

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function ShopDetail() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const scrollY = useRef(new Animated.Value(0)).current;
  const favScale = useRef(new Animated.Value(1)).current;
  const scrollRef = useRef(null);
  const searchRef = useRef(null);
  const searchBarY = useRef(0);

  const [activeIndex, setActiveIndex] = useState(0);
  const [offerIndex, setOfferIndex] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);

  const { shop, banners, media, items, favorite, loading, refreshing, onRefresh, toggleFavorite } =
    useShopData(id);

  // ── actions ──
  const callShop = useCallback(() => {
    if (shop?.phone) Linking.openURL(`tel:+91${shop.phone}`);
  }, [shop?.phone]);

  const openWhatsApp = useCallback(() => {
    let phone = shop?.whatsapp_number || shop?.phone;
    if (!phone) return;
    phone = phone.replace(/\D/g, '');
    if (!phone.startsWith('91')) phone = '91' + phone;
    Linking.openURL(`https://wa.me/${phone}`);
  }, [shop?.whatsapp_number, shop?.phone]);

  const openMap = useCallback(() => {
    if (shop?.latitude)
      Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${shop.latitude},${shop.longitude}`);
  }, [shop?.latitude, shop?.longitude]);

  const shareShop = useCallback(async () => {
    if (shop) Share.share({ message: `Check out ${shop.name} on Dukan 👇\n${BASE_URL}/shop/${shop.id}` });
  }, [shop]);

  const handleToggleFavorite = useCallback(() => {
    Animated.sequence([
      Animated.spring(favScale, { toValue: 1.5, useNativeDriver: true, speed: 60 }),
      Animated.spring(favScale, { toValue: 1, useNativeDriver: true, speed: 20 }),
    ]).start();
    toggleFavorite(shop.id);
  }, [favScale, toggleFavorite, shop?.id]);

  // ── items ──
  const filteredItems = useMemo(
    () => items.filter(i => i.name?.toLowerCase().includes(searchQuery.toLowerCase())),
    [items, searchQuery]
  );

  const openItem = useCallback((item) => {
    setSelectedItem(item);
    setModalVisible(true);
    Keyboard.dismiss();
  }, []);

  const closeModal = useCallback(() => setModalVisible(false), []);

  const clearSearch = useCallback(() => {
    setSearchQuery('');
    searchRef.current?.focus();
  }, []);

  const onSearchFocus = useCallback(() => {
    setSearchFocused(true);
    setTimeout(() => {
      scrollRef.current?.scrollTo({ y: searchBarY.current - 16, animated: true });
    }, 150);
  }, []);

  const onSearchBlur = useCallback(() => setSearchFocused(false), []);

  // ── scroll-driven header ──
  const headerOpacity = useMemo(() => scrollY.interpolate({
    inputRange: [COVER_HEIGHT - 70, COVER_HEIGHT - 10],
    outputRange: [0, 1], extrapolate: 'clamp',
  }), [scrollY]);

  const titleOpacity = useMemo(() => scrollY.interpolate({
    inputRange: [COVER_HEIGHT - 40, COVER_HEIGHT + 20],
    outputRange: [0, 1], extrapolate: 'clamp',
  }), [scrollY]);

  const onScroll = useMemo(() => Animated.event(
    [{ nativeEvent: { contentOffset: { y: scrollY } } }],
    { useNativeDriver: false }
  ), [scrollY]);

  const offerWidth = width - 32;
  const HEADER_TOP = insets.top + 6;

  if (loading && !shop) return <LoadingScreen />;
  if (!shop) return null;

  const isPro = shop.plan === 'pro';
  const hasPhone = !!(shop.phone);
  const hasWhatsApp = !!(shop.phone || shop.whatsapp_number);

  return (
    <View style={s.safe}>
      <StatusBar style="light" />

      <ItemModal item={selectedItem} visible={modalVisible} onClose={closeModal} />

      {/* FAB: Back */}
      <View style={[s.fabBack, { top: HEADER_TOP }]}>
        <FloatBtn icon="chevron-back" onPress={router.back} />
      </View>

      {/* FAB: Share + Fav */}
      <View style={[s.fabRight, { top: HEADER_TOP }]}>
        <FloatBtn icon="share-social-outline" onPress={shareShop} />
        <TouchableOpacity
          style={s.floatBtn}
          onPress={handleToggleFavorite}
          activeOpacity={0.78}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Animated.View style={{ transform: [{ scale: favScale }] }}>
            <Ionicons name={favorite ? 'heart' : 'heart-outline'} size={20} color={favorite ? '#FF4560' : C.white} />
          </Animated.View>
        </TouchableOpacity>
      </View>

      {/* Scroll-in solid header */}
      <Animated.View style={[s.solidHeader, { opacity: headerOpacity, paddingTop: HEADER_TOP }]} pointerEvents="none">
        <Animated.Text style={[s.solidHeaderTitle, { opacity: titleOpacity }]} numberOfLines={1}>
          {shop.name}
        </Animated.Text>
      </Animated.View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
      >
        <Animated.ScrollView
          ref={scrollRef}
          onScroll={onScroll}
          scrollEventThrottle={16}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.primary} />}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 200 }}
        >
          {/* COVER */}
          <View style={{ height: COVER_HEIGHT }}>
            {media.length > 0 ? (
              isPro ? (
                <>
                  <Animated.ScrollView
                    horizontal pagingEnabled
                    showsHorizontalScrollIndicator={false}
                    scrollEventThrottle={16}
                    onScroll={e => setActiveIndex(Math.round(e.nativeEvent.contentOffset.x / width))}
                  >
                    {media.slice(0, 5).map((m, i) => (
                      <Image
                        key={m?.id ?? i}
                        source={{ uri: getImageUrl(m.image) }}
                        style={{ width, height: COVER_HEIGHT }}
                        resizeMode="cover"
                      />
                    ))}
                  </Animated.ScrollView>
                  {media.length > 1 && (
                    <View style={s.dots}>
                      {media.slice(0, 5).map((_, i) => (
                        <View key={i} style={[s.dot, activeIndex === i && s.dotActive]} />
                      ))}
                    </View>
                  )}
                </>
              ) : (
                <Image source={{ uri: getImageUrl(media[0].image) }} style={{ width, height: COVER_HEIGHT }} resizeMode="cover" />
              )
            ) : (
              <Image source={{ uri: getImageUrl(shop.image) }} style={{ width, height: COVER_HEIGHT }} resizeMode="cover" />
            )}
            <View style={s.coverFade} pointerEvents="none" />
          </View>

          {/* INFO CARD */}
          <View style={s.infoCard}>
            <View style={s.infoTopRow}>
              <View style={{ flex: 1, paddingRight: 12 }}>
                <Text style={s.shopName}>{shop.name}</Text>
                <CategoryPill label={shop.category} />
              </View>
              <View style={[s.statusChip, { backgroundColor: shop.is_open ? '#EDFBF4' : '#F5F5F5' }]}>
                <View style={[s.statusDot, { backgroundColor: shop.is_open ? C.accent : C.textLight }]} />
                <Text style={[s.statusText, { color: shop.is_open ? C.accent : C.textLight }]}>
                  {shop.is_open ? 'Open' : 'Closed'}
                </Text>
              </View>
            </View>

            <View style={s.addrRow}>
              <Ionicons name="location" size={13} color={C.primary} style={{ marginTop: 2 }} />
              <Text style={s.addrText} numberOfLines={2}>
                {shop.distance != null ? `${shop.distance} km · ` : ''}{shop.address || 'No address available'}
              </Text>
            </View>

            <View style={s.divider} />

            <View style={s.actionsRow}>
              <ActionBtn icon="call-outline" label="Call" color={C.call} onPress={callShop} disabled={!hasPhone} />
              <ActionBtn icon="logo-whatsapp" label="WhatsApp" color={C.whatsapp} onPress={openWhatsApp} disabled={!hasWhatsApp} />
              <ActionBtn icon="navigate" label="Map" color={C.map} onPress={openMap} disabled={!shop.latitude} />
            </View>
          </View>

          {/* FEATURED OFFERS */}
          <View style={s.section}>
            <View style={s.sectionHead}>
              <Text style={s.sectionTitle}>Featured Offers</Text>
              {isPro && (
                <View style={s.proBadge}>
                  <Ionicons name="flash" size={10} color={C.gold} />
                  <Text style={s.proBadgeText}>PRO</Text>
                </View>
              )}
            </View>

            {isPro && banners.length > 0 ? (
              <View>
                <Animated.ScrollView
                  horizontal
                  decelerationRate="fast"
                  snapToInterval={offerWidth + 12}
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{ gap: 12 }}
                  scrollEventThrottle={16}
                  onScroll={e => setOfferIndex(Math.round(e.nativeEvent.contentOffset.x / (offerWidth + 12)))}
                >
                  {banners.map(b => (
                    <View key={b.id} style={{ width: offerWidth }}>
                      {b.banner_type === 'image' ? (
                        <Image source={{ uri: getImageUrl(b.image) }} style={s.offerImage} resizeMode="cover" />
                      ) : (
                        <View style={[s.offerCard, getTemplateBg(b.template)]}>
                          <View style={{ flex: 1 }}>
                            {b.title && <Text style={s.offerTitle}>{b.title.toUpperCase()}</Text>}
                            {b.discount != null && <Text style={s.offerDiscount}>{b.discount}% OFF</Text>}
                            {b.subtitle && <Text style={s.offerSubtitle}>{b.subtitle}</Text>}
                          </View>
                          <Ionicons name="pricetag" size={78} color="#ffffff12" style={s.offerBgIcon} />
                        </View>
                      )}
                    </View>
                  ))}
                </Animated.ScrollView>
                {banners.length > 1 && (
                  <View style={s.offerDots}>
                    {banners.map((_, i) => (
                      <View key={i} style={[s.offerDot, offerIndex === i && s.offerDotActive]} />
                    ))}
                  </View>
                )}
              </View>
            ) : (
              <View style={s.upgradeCard}>
                <View style={s.upgradeIconBox}>
                  <Ionicons name="flash" size={18} color={C.gold} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.upgradeTitle}>Unlock Featured Banners</Text>
                  <Text style={s.upgradeSubtitle}>Upgrade to Pro to show your offers here</Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color="#ccc" />
              </View>
            )}
          </View>

          {/* ITEMS */}
          <View style={s.section}>
            <View style={s.sectionHead}>
              <Text style={s.sectionTitle}>Items Available</Text>
              <View style={s.itemCountPill}>
                <Text style={s.itemCountText}>{filteredItems.length}</Text>
              </View>
            </View>

            <View
              style={[s.searchBar, searchFocused && s.searchBarActive]}
              onLayout={e => { searchBarY.current = e.nativeEvent.layout.y; }}
            >
              <Ionicons name="search-outline" size={16} color={searchFocused ? C.primary : C.textLight} />
              <TextInput
                ref={searchRef}
                style={s.searchInput}
                placeholder="Search items…"
                placeholderTextColor={C.textLight}
                value={searchQuery}
                onChangeText={setSearchQuery}
                onFocus={onSearchFocus}
                onBlur={onSearchBlur}
                returnKeyType="search"
                onSubmitEditing={Keyboard.dismiss}
                includeFontPadding={false}
                underlineColorAndroid="transparent"
                selectionColor={C.primary}
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity onPress={clearSearch} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                  <Ionicons name="close-circle" size={17} color={C.textLight} />
                </TouchableOpacity>
              )}
            </View>

            {filteredItems.length === 0 ? (
              <View style={s.emptyWrap}>
                <View style={s.emptyIconBox}>
                  <Ionicons name="cube-outline" size={36} color={C.textLight} />
                </View>
                <Text style={s.emptyTitle}>{searchQuery ? 'No results found' : 'No items yet'}</Text>
                <Text style={s.emptySubtitle}>{searchQuery ? `Nothing matches "${searchQuery}"` : 'Check back later'}</Text>
              </View>
            ) : (
              <View style={s.grid}>
                {filteredItems.map(item => (
                  <ItemCard key={item.id} item={item} onPress={openItem} />
                ))}
              </View>
            )}
          </View>
        </Animated.ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },

  // FABs
  fabBack: { position: 'absolute', left: 16, zIndex: 100 },
  fabRight: { position: 'absolute', right: 16, zIndex: 100, flexDirection: 'row', gap: 8 },
  floatBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.32)',
    alignItems: 'center', justifyContent: 'center',
    shadowColor: C.shadow, shadowOpacity: 0.18, shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 }, elevation: 6,
  },

  // Solid scroll-in header
  solidHeader: {
    position: 'absolute', left: 0, right: 0, top: 0, zIndex: 99,
    backgroundColor: C.white, alignItems: 'center', justifyContent: 'flex-end',
    paddingBottom: 12,
    shadowColor: C.shadow, shadowOpacity: 0.06, shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 }, elevation: 6,
  },
  solidHeaderTitle: {
    fontSize: 15, fontWeight: '800', color: C.text, letterSpacing: -0.2,
    paddingHorizontal: 80, textAlign: 'center', includeFontPadding: false,
  },

  // Cover
  coverFade: {
    position: 'absolute', bottom: 0, left: 0, right: 0, height: 100,
    backgroundColor: 'rgba(0,0,0,0.25)',
  },
  dots: {
    position: 'absolute', bottom: 14, left: 0, right: 0,
    flexDirection: 'row', justifyContent: 'center', gap: 6,
  },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.4)' },
  dotActive: { width: 20, backgroundColor: C.white },

  // Info card
  infoCard: {
    backgroundColor: C.white,
    borderBottomLeftRadius: 28, borderBottomRightRadius: 28,
    padding: 22,
    shadowColor: C.shadow, shadowOpacity: 0.07, shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 }, elevation: 6,
  },
  infoTopRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 12 },
  shopName: {
    fontSize: 22, fontWeight: '800', color: C.text, letterSpacing: -0.5,
    marginBottom: 8, lineHeight: 27, includeFontPadding: false,
  },
  categoryPill: {
    alignSelf: 'flex-start', backgroundColor: C.primaryLight,
    borderRadius: 30, paddingHorizontal: 11, paddingVertical: 4,
  },
  categoryPillText: {
    fontSize: 11, fontWeight: '700', color: C.primary,
    letterSpacing: 0.3, includeFontPadding: false,
  },
  statusChip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    borderRadius: 20, paddingHorizontal: 10, paddingVertical: 6, alignSelf: 'flex-start',
  },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontSize: 11, fontWeight: '700', includeFontPadding: false },
  addrRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 5 },
  addrText: { flex: 1, fontSize: 13, color: C.textLight, lineHeight: 19, includeFontPadding: false },
  divider: { height: 1, backgroundColor: '#F3F3F3', marginVertical: 18 },
  actionsRow: { flexDirection: 'row', gap: 10 },
  actionBtn: {
    flex: 1, alignItems: 'center', justifyContent: 'center', gap: 5,
    paddingVertical: 14, borderRadius: 16,
    shadowColor: C.shadow, shadowOpacity: 0.14, shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 }, elevation: 4,
  },
  actionBtnDisabled: { opacity: 0.35, shadowOpacity: 0, elevation: 0 },
  actionBtnText: { color: C.white, fontSize: 11, fontWeight: '700', includeFontPadding: false },

  // Sections
  section: { marginTop: 28, paddingHorizontal: 16 },
  sectionHead: { flexDirection: 'row', alignItems: 'center', marginBottom: 14 },
  sectionTitle: {
    flex: 1, fontSize: 17, fontWeight: '800', color: C.text,
    letterSpacing: -0.3, includeFontPadding: false,
  },
  itemCountPill: {
    backgroundColor: C.primaryLight, borderRadius: 20,
    paddingHorizontal: 10, paddingVertical: 3,
  },
  itemCountText: { fontSize: 12, color: C.primary, fontWeight: '700', includeFontPadding: false },
  proBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: '#FFFBF0', borderWidth: 1, borderColor: '#F5A62330',
    paddingHorizontal: 9, paddingVertical: 4, borderRadius: 20,
  },
  proBadgeText: { fontSize: 10, fontWeight: '800', color: C.gold, letterSpacing: 0.6, includeFontPadding: false },

  // Offers
  offerImage: { width: '100%', height: 130, borderRadius: 20 },
  offerCard: {
    height: 130, borderRadius: 20, padding: 20,
    flexDirection: 'row', alignItems: 'center', overflow: 'hidden',
  },
  offerTitle: { color: C.white, fontSize: 11, fontWeight: '700', letterSpacing: 1.4, opacity: 0.75, includeFontPadding: false },
  offerDiscount: { color: C.white, fontSize: 32, fontWeight: '900', letterSpacing: -1, marginTop: 2, includeFontPadding: false },
  offerSubtitle: { color: C.white, fontSize: 12, marginTop: 2, opacity: 0.85, includeFontPadding: false },
  offerBgIcon: { position: 'absolute', right: 14, bottom: 10 },
  offerDots: { flexDirection: 'row', justifyContent: 'center', marginTop: 12, gap: 5 },
  offerDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: '#D9D9D9' },
  offerDotActive: { width: 16, backgroundColor: C.primary },

  upgradeCard: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: '#FFFCF4', borderRadius: 18, padding: 16,
    borderWidth: 1, borderColor: '#F5A62325',
  },
  upgradeIconBox: {
    width: 38, height: 38, borderRadius: 12,
    backgroundColor: '#FFF4DE', alignItems: 'center', justifyContent: 'center',
  },
  upgradeTitle: { fontSize: 14, fontWeight: '700', color: C.text, marginBottom: 2, includeFontPadding: false },
  upgradeSubtitle: { fontSize: 12, color: C.textLight, includeFontPadding: false },

  // Search
  searchBar: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: C.white, borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === 'android' ? 8 : 13,
    marginBottom: 16, borderWidth: 1.5, borderColor: C.border,
    shadowColor: C.shadow, shadowOpacity: 0.04, shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 }, elevation: 2,
  },
  searchBarActive: {
    borderColor: C.primary,
    shadowColor: C.primary, shadowOpacity: 0.12, shadowRadius: 8,
  },
  searchInput: {
    flex: 1, fontSize: 14, color: C.text,
    paddingVertical: 0,
    includeFontPadding: false,
  },

  // Grid
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  itemCard: {
    width: (width - 32 - 12) / 2,
    backgroundColor: C.white, borderRadius: 18,
    overflow: 'hidden',
    shadowColor: C.shadow, shadowOpacity: 0.08, shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 }, elevation: 4,
  },
  itemImg: { width: '100%', height: 150 },
  itemPriceBadge: {
    position: 'absolute', top: 10, right: 10,
    backgroundColor: C.primary, borderRadius: 20,
    paddingHorizontal: 9, paddingVertical: 3,
  },
  itemPriceBadgeText: { color: C.white, fontSize: 11, fontWeight: '800', includeFontPadding: false },
  itemBody: { padding: 12, paddingTop: 10 },
  itemName: { fontSize: 13, fontWeight: '700', color: C.text, lineHeight: 18, marginBottom: 2, includeFontPadding: false },
  itemDesc: { fontSize: 11, color: C.textLight, includeFontPadding: false },

  // Empty
  emptyWrap: { alignItems: 'center', paddingVertical: 48, gap: 10 },
  emptyIconBox: {
    width: 72, height: 72, borderRadius: 24,
    backgroundColor: '#F5F5F5', alignItems: 'center', justifyContent: 'center',
  },
  emptyTitle: { fontSize: 15, fontWeight: '700', color: C.textMid, includeFontPadding: false },
  emptySubtitle: { fontSize: 12, color: C.textLight, includeFontPadding: false },

  // Modal
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center', alignItems: 'center',
    paddingHorizontal: 24,
  },
  modalCard: {
    width: '100%', backgroundColor: C.white,
    borderRadius: 24, overflow: 'hidden',
    shadowColor: C.shadow, shadowOpacity: 0.25, shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 }, elevation: 20,
  },
  modalImage: { width: '100%', height: 220 },
  modalClose: {
    position: 'absolute', top: 12, right: 12,
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: C.white,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: C.shadow, shadowOpacity: 0.15, shadowRadius: 6, elevation: 4,
  },
  modalBody: { padding: 18 },
  modalName: { fontSize: 18, fontWeight: '800', color: C.text, marginBottom: 6, includeFontPadding: false },
  modalPrice: { fontSize: 20, fontWeight: '900', color: C.primary, marginBottom: 8, includeFontPadding: false },
  modalDesc: { fontSize: 13, color: C.textMid, lineHeight: 20, includeFontPadding: false },
});
