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
import AdBanner from '../../components/AdBanner';

const BASE_URL= 'https://api.mydukan.online';
const { width } = Dimensions.get('window');
const COVER_HEIGHT = 260;
const POLL_INTERVAL = 15_000;
const COLS = 3;
const GAP = 8;
const ITEM_WIDTH = (width - 32 - GAP * (COLS - 1)) / COLS;

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

// ─── Custom hook ──────────────────────────────────────────────────────────────
function useShopData(id) {
  const [shop, setShop] = useState(null);
  const [banners, setBanners] = useState([]);
  const [media, setMedia] = useState([]);
  const [items, setItems] = useState([]);
  const [favorite, setFavorite] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(`shop_${id}`).then(raw => {
      if (!raw) return;
      try {
        const d = JSON.parse(raw);
        setShop(d.shop); setBanners(d.banners ?? []);
        setMedia(d.media ?? []); setItems(d.items ?? []);
        setLoading(false);
      } catch { }
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
      setShop(shopData.shop); setBanners(shopData.banners ?? []);
      setMedia(shopData.media ?? []); setItems(shopData.items ?? []);
      setFavorite(Array.isArray(favData) && favData.some(f => f.id === shopData.shop.id));
      AsyncStorage.setItem(`shop_${id}`, JSON.stringify({
        shop: shopData.shop, banners: shopData.banners ?? [],
        media: shopData.media ?? [], items: shopData.items ?? [],
      }));
    } catch { }
    finally { setLoading(false); setRefreshing(false); }
  }, [id]);

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
    }).catch(() => setFavorite(prev => !prev));
  }, []);

  return { shop, banners, media, items, favorite, loading, refreshing, onRefresh, toggleFavorite };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const getImageUrl = img =>
  !img ? 'https://via.placeholder.com/400x300'
    : img.startsWith('http') ? img
    : `${BASE_URL}${img}`;

// ─── Small components ─────────────────────────────────────────────────────────
const CategoryPill = ({ label }) => (
  <View style={s.categoryPill}>
    <Text style={s.categoryPillText}>{label}</Text>
  </View>
);

const ActionBtn = ({ icon, label, color, onPress, disabled }) => (
  <TouchableOpacity
    style={[s.actionBtn, { backgroundColor: color }, disabled && s.actionBtnDisabled]}
    onPress={onPress} disabled={disabled} activeOpacity={0.78}
  >
    <Ionicons name={icon} size={17} color={C.white} />
    <Text style={s.actionBtnText}>{label}</Text>
  </TouchableOpacity>
);

const FloatBtn = ({ icon, onPress, color = C.white }) => (
  <TouchableOpacity
    style={s.floatBtn} onPress={onPress} activeOpacity={0.78}
    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
  >
    <Ionicons name={icon} size={19} color={color} />
  </TouchableOpacity>
);

// ─── Item card (3-col) ────────────────────────────────────────────────────────
const ItemCard = ({ item, onPress }) => {
  const scale = useRef(new Animated.Value(1)).current;
  const onPressIn  = useCallback(() => Animated.spring(scale, { toValue: 1.05, useNativeDriver: true, speed: 80, bounciness: 10 }).start(), [scale]);
  const onPressOut = useCallback(() => Animated.spring(scale, { toValue: 1,    useNativeDriver: true, speed: 40, bounciness: 8  }).start(), [scale]);

  return (
    <TouchableWithoutFeedback onPressIn={onPressIn} onPressOut={onPressOut} onPress={() => onPress(item)}>
      <Animated.View style={[s.itemCard, { transform: [{ scale }] }]}>
        <View style={s.itemImgWrap}>
          <Image source={{ uri: getImageUrl(item.image) }} style={s.itemImg} resizeMode="cover" />
          {item.price != null && (
            <View style={s.itemPriceBadge}>
              <Text style={s.itemPriceBadgeText}>₹{item.price}</Text>
            </View>
          )}
        </View>
        <View style={s.itemBody}>
          <Text style={s.itemName} numberOfLines={2}>{item.name}</Text>
          {item.description ? <Text style={s.itemDesc} numberOfLines={1}>{item.description}</Text> : null}
        </View>
      </Animated.View>
    </TouchableWithoutFeedback>
  );
};

// ─── Item modal ───────────────────────────────────────────────────────────────
const ItemModal = ({ item, visible, onClose }) => {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.spring(anim, { toValue: visible ? 1 : 0, useNativeDriver: true, speed: 20, bounciness: 6 }).start();
  }, [visible, anim]);
  if (!item) return null;
  const scaleOut = anim.interpolate({ inputRange: [0, 1], outputRange: [0.88, 1] });
  const slideOut = anim.interpolate({ inputRange: [0, 1], outputRange: [40, 0] });
  return (
    <Modal transparent visible={visible} onRequestClose={onClose} animationType="fade">
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={s.modalOverlay}>
          <TouchableWithoutFeedback>
            <Animated.View style={[s.modalCard, { opacity: anim, transform: [{ scale: scaleOut }, { translateY: slideOut }] }]}>
              <Image source={{ uri: getImageUrl(item.image) }} style={s.modalImage} resizeMode="cover" />
              <TouchableOpacity style={s.modalClose} onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name="close" size={16} color={C.text} />
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

// ─── Skeleton ─────────────────────────────────────────────────────────────────
const Skeleton = ({ style }) => {
  const opacity = useRef(new Animated.Value(0.3)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(opacity, { toValue: 1, duration: 700, useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 0.3, duration: 700, useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [opacity]);
  return <Animated.View style={[{ backgroundColor: '#E0E0E0', borderRadius: 8 }, style, { opacity }]} />;
};

const LoadingScreen = () => (
  <View style={s.safe}>
    <StatusBar style="dark" />
    <Skeleton style={{ height: COVER_HEIGHT, borderRadius: 0 }} />
    <View style={{ padding: 18, gap: 10 }}>
      <Skeleton style={{ height: 22, width: '55%' }} />
      <Skeleton style={{ height: 14, width: '38%' }} />
      <Skeleton style={{ height: 14, width: '75%' }} />
      <View style={{ flexDirection: 'row', gap: 8, marginTop: 6 }}>
        {[1, 2, 3].map(i => <Skeleton key={i} style={{ flex: 1, height: 46, borderRadius: 14 }} />)}
      </View>
    </View>
  </View>
);

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function ShopDetail() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const scrollY = useRef(new Animated.Value(0)).current;
  const favScale = useRef(new Animated.Value(1)).current;
  const scrollRef = useRef(null);
  const searchRef = useRef(null);

  const [activeIndex, setActiveIndex] = useState(0);
  const [offerIndex, setOfferIndex] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);

  const { shop, banners, media, items, favorite, loading, refreshing, onRefresh, toggleFavorite } = useShopData(id);

  const callShop     = useCallback(() => { if (shop?.phone) Linking.openURL(`tel:+91${shop.phone}`); }, [shop?.phone]);
  const openWhatsApp = useCallback(() => {
    let phone = shop?.whatsapp_number || shop?.phone;
    if (!phone) return;
    phone = phone.replace(/\D/g, '');
    if (!phone.startsWith('91')) phone = '91' + phone;
    Linking.openURL(`https://wa.me/${phone}`);
  }, [shop?.whatsapp_number, shop?.phone]);
  const openMap  = useCallback(() => {
    if (shop?.latitude) Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${shop.latitude},${shop.longitude}`);
  }, [shop?.latitude, shop?.longitude]);
  const shareShop = useCallback(async () => {
    if (shop) Share.share({ message: `Check out ${shop.name} on Dukan 👇\n${BASE_URL}/shop/${shop.id}` });
  }, [shop]);

  const handleToggleFavorite = useCallback(() => {
    Animated.sequence([
      Animated.spring(favScale, { toValue: 1.5, useNativeDriver: true, speed: 60 }),
      Animated.spring(favScale, { toValue: 1,   useNativeDriver: true, speed: 20 }),
    ]).start();
    toggleFavorite(shop.id);
  }, [favScale, toggleFavorite, shop?.id]);

  const filteredItems = useMemo(
    () => items.filter(i => i.name?.toLowerCase().includes(searchQuery.toLowerCase())),
    [items, searchQuery]
  );

  const openItem   = useCallback((item) => { setSelectedItem(item); setModalVisible(true); Keyboard.dismiss(); }, []);
  const closeModal = useCallback(() => setModalVisible(false), []);
  const clearSearch = useCallback(() => { setSearchQuery(''); searchRef.current?.focus(); }, []);

  // Track absolute Y of the items section so we can scroll past it when keyboard opens
  const itemsSectionY = useRef(0);

  const onSearchFocus = useCallback(() => {
    setSearchFocused(true);
    // Let keyboard fully animate, then scroll so search bar + some items are visible
    const delay = Platform.OS === 'android' ? 350 : 280;
    setTimeout(() => {
      scrollRef.current?.scrollTo({ y: itemsSectionY.current - 10, animated: true });
    }, delay);
  }, []);
  const onSearchBlur = useCallback(() => setSearchFocused(false), []);

  const headerOpacity = useMemo(() => scrollY.interpolate({
    inputRange: [COVER_HEIGHT - 70, COVER_HEIGHT],
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

  const HEADER_TOP = insets.top + 6;

  if (loading && !shop) return <LoadingScreen />;
  if (!shop) return null;

  const isPro       = shop.plan === 'pro';
  const hasPhone    = !!shop.phone;
  const hasWhatsApp = !!(shop.phone || shop.whatsapp_number);

  return (
    <View style={s.safe}>
      <StatusBar style="light" />
      <ItemModal item={selectedItem} visible={modalVisible} onClose={closeModal} />

      {/* FAB: Back */}
      <View style={[s.fabBack, { top: HEADER_TOP -12 }]}>
        <FloatBtn icon="chevron-back" onPress={router.back} />
      </View>

      {/* FAB: Share + Fav */}
      <View style={[s.fabRight, { top: HEADER_TOP -12}]}>
        <FloatBtn icon="share-social-outline" onPress={shareShop} />
        <TouchableOpacity style={s.floatBtn} onPress={handleToggleFavorite} activeOpacity={0.78}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Animated.View style={{ transform: [{ scale: favScale }] }}>
            <Ionicons name={favorite ? 'heart' : 'heart-outline'} size={19} color={favorite ? '#FF4560' : C.white} />
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
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
      >
        <Animated.ScrollView
          ref={scrollRef}
          onScroll={onScroll}
          scrollEventThrottle={16}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.primary} />}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 320 }}
        >
          {/* ── COVER ── */}
          <View style={{ height: COVER_HEIGHT }}>
            {media.length > 0 ? (
              isPro ? (
                <>
                  <Animated.ScrollView
                    horizontal pagingEnabled showsHorizontalScrollIndicator={false}
                    scrollEventThrottle={16}
                    onScroll={e => setActiveIndex(Math.round(e.nativeEvent.contentOffset.x / width))}
                  >
                    {media.slice(0, 5).map((m, i) => (
                      <Image key={m?.id ?? i} source={{ uri: getImageUrl(m.image) }}
                        style={{ width, height: COVER_HEIGHT }} resizeMode="cover" />
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

          {/* ── INFO CARD ── */}
          <View style={s.infoCard}>
            <View style={s.infoTopRow}>
              <View style={{ flex: 1, paddingRight: 10 }}>
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
              <Ionicons name="location" size={12} color={C.primary} style={{ marginTop: 1 }} />
              <Text style={s.addrText} numberOfLines={2}>
                {shop.distance != null ? `${shop.distance} km · ` : ''}{shop.address || 'No address available'}
              </Text>
            </View>

            <View style={s.divider} />

            <View style={s.actionsRow}>
              <ActionBtn icon="call-outline"    label="Call"      color={C.call}      onPress={callShop}     disabled={!hasPhone} />
              <ActionBtn icon="logo-whatsapp"   label="WhatsApp"  color={C.whatsapp}  onPress={openWhatsApp} disabled={!hasWhatsApp} />
              <ActionBtn icon="navigate"        label="Map"       color={C.map}       onPress={openMap}      disabled={!shop.latitude} />
            </View>
          </View>

          {/* ── FEATURED OFFERS ── */}
          <View style={[s.section, { paddingHorizontal: 0 }]}>
            <View style={s.sectionHead}>
              <Text style={{paddingLeft:20,flex: 1, fontSize: 15, fontWeight: '800', color: C.text,letterSpacing: -0.2, includeFontPadding: false,}}>Featured Offers</Text>
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
                  pagingEnabled
                  showsHorizontalScrollIndicator={false}
                  decelerationRate="fast"
                  scrollEventThrottle={16}
                  onScroll={e => setOfferIndex(Math.round(e.nativeEvent.contentOffset.x / width))}
                >
                  {banners.map(b => {
                    // Your API sends: image (optional), title, discount, subtitle
                    // banner_type may be 'image' | 'text' | undefined — treat any truthy image as image card
                    const hasImage = !!(b.image);
                    return (
                      <View key={b.id} style={{ width }}>
                        <View style={{ marginHorizontal: 16 }}>
                        {hasImage ? (
                          /* ── Image banner ── */
                          <View style={s.offerCard}>
                            <Image
                              source={{ uri: getImageUrl(b.image) }}
                              style={StyleSheet.absoluteFill}
                              resizeMode="cover"
                            />
                            {/* Overlay gradient scrim so text is always readable */}
                            <View style={s.offerImageScrim} />
                            {(b.title || b.discount) && (
                              <View style={s.offerImageTextWrap}>
                                {b.discount ? (
                                  <Text style={s.offerDiscountBig}>{b.discount }</Text>
                                ) : null}
                                {b.title ? (
                                  <Text style={s.offerTitleOnImage}>{b.title}</Text>
                                ) : null}
                                {b.subtitle ? (
                                  <Text style={s.offerSubOnImage}>{b.subtitle}</Text>
                                ) : null}
                              </View>
                            )}
                          </View>
                        ) : (
                          /* ── Text-only banner (no image uploaded) ── */
                          
                          <View style={[s.offerCard, s.offerCardText]}>
                            {/* Decorative background icon */}
                            
                           <Ionicons
                            name="pricetag"
                            size={90}
                            color="rgba(255,255,255,0.15)"
                            style={[s.offerBgIcon, { zIndex: 0 }]}
                          />
                            <Ionicons
                              name="sparkles"
                              size={40}
                              color="rgba(255,255,255,0.25)"
                              style={{ position: 'absolute', top: 10, left: 10, zIndex: 0  }}
                            />
                           <View style={{ flex: 1, justifyContent: 'center', gap: 4, zIndex: 1 }}>
                              {b.title ? (
                                <Text style={s.offerTitle}>{b.title.toUpperCase()}</Text>
                              ) : null}
                              {b.discount ? (
                                <Text style={s.offerDiscount}>{b.discount} </Text>
                              ) : null}
                              {b.subtitle ? (
                                <Text style={s.offerSubtitle}>{b.subtitle}</Text>
                              ) : null}
                            </View>
                          </View>
                        )}
                        </View>
                      </View>
                    );
                  })}
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
              <AdBanner/>
            )}
          </View>

          {/* ── ITEMS ── */}
          <View style={s.section} onLayout={e => { itemsSectionY.current = e.nativeEvent.layout.y; }}>
            <View style={s.sectionHead}>
              <Text style={s.sectionTitle}>Items Available</Text>
              <View style={s.itemCountPill}>
                <Text style={s.itemCountText}>{filteredItems.length}</Text>
              </View>
            </View>

            <View style={[s.searchBar, searchFocused && s.searchBarActive]}>
              <Ionicons name="search-outline" size={15} color={searchFocused ? C.primary : C.textLight} />
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
                  <Ionicons name="close-circle" size={16} color={C.textLight} />
                </TouchableOpacity>
              )}
            </View>

            {filteredItems.length === 0 ? (
              <View style={s.emptyWrap}>
                <View style={s.emptyIconBox}>
                  <Ionicons name="cube-outline" size={32} color={C.textLight} />
                </View>
                <Text style={s.emptyTitle}>{searchQuery ? 'No results found' : 'No items yet'}</Text>
                <Text style={s.emptySubtitle}>{searchQuery ? `Nothing matches "${searchQuery}"` : 'Check back later'}</Text>
              </View>
            ) : (
              /* ── 3-COLUMN GRID ── */
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
  fabBack:  { position: 'absolute', left: 14, zIndex: 100 },
  fabRight: { position: 'absolute', right: 14, zIndex: 100, flexDirection: 'row', gap: 7 },
  floatBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.30)',
    alignItems: 'center', justifyContent: 'center',
    shadowColor: C.shadow, shadowOpacity: 0.16, shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 }, elevation: 5,
  },

  // Scroll-in header
  solidHeader: {
    position: 'absolute', left: 0, right: 0, top: 0, zIndex: 99,
    backgroundColor: C.white, alignItems: 'center', justifyContent: 'flex-end',
    paddingBottom: 10,
    shadowColor: C.shadow, shadowOpacity: 0.06, shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 }, elevation: 6,
  },
  solidHeaderTitle: {
    fontSize: 14, fontWeight: '800', color: C.text,
    paddingHorizontal: 70, textAlign: 'center', includeFontPadding: false,
  },

  // Cover
  coverFade: {
    position: 'absolute', bottom: 0, left: 0, right: 0, height: 80,
    backgroundColor: 'rgba(0,0,0,0.22)',
  },
  dots: {
    position: 'absolute', bottom: 10, left: 0, right: 0,
    flexDirection: 'row', justifyContent: 'center', gap: 5,
  },
  dot:       { width: 5, height: 5, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.4)' },
  dotActive: { width: 16, backgroundColor: C.white },

  // Info card
  infoCard: {
    backgroundColor: C.white,
    borderBottomLeftRadius: 24, borderBottomRightRadius: 24,
    padding: 16,
    shadowColor: C.shadow, shadowOpacity: 0.06, shadowRadius: 10,
    shadowOffset: { width: 0, height: 5 }, elevation: 5,
  },
  infoTopRow:  { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 8 },
  shopName: {
    fontSize: 18, fontWeight: '800', color: C.text,
    letterSpacing: -0.4, marginBottom: 6, lineHeight: 22, includeFontPadding: false,
  },
  categoryPill: {
    alignSelf: 'flex-start', backgroundColor: C.primaryLight,
    borderRadius: 30, paddingHorizontal: 10, paddingVertical: 3,
  },
  categoryPillText: { fontSize: 10, fontWeight: '700', color: C.primary, includeFontPadding: false },
  statusChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    borderRadius: 20, paddingHorizontal: 9, paddingVertical: 5, alignSelf: 'flex-start',
  },
  statusDot:  { width: 5, height: 5, borderRadius: 3 },
  statusText: { fontSize: 10, fontWeight: '700', includeFontPadding: false },

  addrRow:  { flexDirection: 'row', alignItems: 'flex-start', gap: 4 },
  addrText: { flex: 1, fontSize: 12, color: C.textLight, lineHeight: 17, includeFontPadding: false },
  divider:  { height: 1, backgroundColor: '#F3F3F3', marginVertical: 12 },

  actionsRow: { flexDirection: 'row', gap: 8 },
  actionBtn: {
    flex: 1, alignItems: 'center', justifyContent: 'center', gap: 4,
    paddingVertical: 11, borderRadius: 14,
    shadowColor: C.shadow, shadowOpacity: 0.12, shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 }, elevation: 3,
  },
  actionBtnDisabled: { opacity: 0.32, shadowOpacity: 0, elevation: 0 },
  actionBtnText: { color: C.white, fontSize: 10, fontWeight: '700', includeFontPadding: false },

  // Section
  section:     { marginTop: 20, paddingHorizontal: 16 },
  sectionHead: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  sectionTitle: {
    flex: 1, fontSize: 15, fontWeight: '800', color: C.text,
    letterSpacing: -0.2, includeFontPadding: false,
  
  },
  itemCountPill: {
    backgroundColor: C.primaryLight, borderRadius: 20,
    paddingHorizontal: 9, paddingVertical: 2,
  },
  itemCountText: { fontSize: 11, color: C.primary, fontWeight: '700', includeFontPadding: false },
  proBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: '#FFFBF0', borderWidth: 1, borderColor: '#F5A62330',
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20,
  },
  proBadgeText: { fontSize: 9, fontWeight: '800', color: C.gold, letterSpacing: 0.5, includeFontPadding: false },

  // Offers
  // Offers — shared card shell
  offerCard: {
    height: 100,
    borderRadius: 18,
    overflow: 'hidden',
    width: '100%',
    position: 'relative',
  },
  // Text-only card background
  offerCardText: {
    backgroundColor: C.primary,
    padding: 20,
    flexDirection: 'row',
    flexDirection: 'column', 
    justifyContent: 'center',
  },
  // Scrim over image so text is readable
  offerImageScrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(14, 63, 28, 0.92)',
  },
  // Text overlaid on image
  offerImageTextWrap: {
    position: 'absolute',
    bottom: 15, left: 16, right: 16,
    gap: 2,
  },
  offerDiscountBig: {
    color: C.white, fontSize: 30, fontWeight: '900',
    letterSpacing: -0.5, includeFontPadding: false,
    textShadowColor: 'rgba(0,0,0,0.4)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 4,
  },
  offerTitleOnImage: {
    color: C.white, fontSize: 16, fontWeight: '700',
    includeFontPadding: false,
    textShadowColor: 'rgba(0,0,0,0.4)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 3,
  },
  offerSubOnImage: {
    color: 'rgba(255,255,255,0.82)', fontSize: 13,
    includeFontPadding: false,
  },
  // Text-only card text styles
  offerTitle:    { color: 'rgba(255,255,255,0.75)', fontSize: 10, fontWeight: '700', letterSpacing: 1.2, includeFontPadding: false },
  offerDiscount: { color: C.white, fontSize: 30, fontWeight: '900', letterSpacing: -1, includeFontPadding: false },
  offerSubtitle: { color: 'rgba(255,255,255,0.82)', fontSize: 12, marginTop: 2, includeFontPadding: false },
  offerBgIcon:   { position: 'absolute', right: 10, bottom: 6 },
  offerDots:     { flexDirection: 'row', justifyContent: 'center', marginTop: 10, gap: 4 },
  offerDot:      { width: 5, height: 5, borderRadius: 3, backgroundColor: '#D9D9D9' },
  offerDotActive:{ width: 14, backgroundColor: C.primary },

  upgradeCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#FFFCF4', borderRadius: 16, padding: 14,
    borderWidth: 1, borderColor: '#F5A62322',
  },
  upgradeIconBox: {
    width: 34, height: 34, borderRadius: 10,
    backgroundColor: '#FFF4DE', alignItems: 'center', justifyContent: 'center',
  },
  upgradeTitle:    { fontSize: 13, fontWeight: '700', color: C.text,      marginBottom: 1, includeFontPadding: false },
  upgradeSubtitle: { fontSize: 11, color: C.textLight, includeFontPadding: false },

  // Search
  searchBar: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: C.white, borderRadius: 13,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === 'android' ? 7 : 11,
    marginBottom: 12, borderWidth: 1.5, borderColor: C.border,
    shadowColor: C.shadow, shadowOpacity: 0.03, shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 }, elevation: 1,
  },
  searchBarActive: { borderColor: C.primary, shadowColor: C.primary, shadowOpacity: 0.10 },
  searchInput: { flex: 1, fontSize: 13, color: C.text, paddingVertical: 0, includeFontPadding: false },

  // 3-col grid
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: GAP,
  },
  itemCard: {
    width: ITEM_WIDTH,
    backgroundColor: C.white,
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: C.shadow, shadowOpacity: 0.07, shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 }, elevation: 3,
  },
  itemImgWrap: { position: 'relative' },
  itemImg: { width: '100%', height: ITEM_WIDTH },   // square image
  itemPriceBadge: {
    position: 'absolute', top: 6, right: 6,
    backgroundColor: C.primary, borderRadius: 8,
    paddingHorizontal: 6, paddingVertical: 2,
  },
  itemPriceBadgeText: { color: C.white, fontSize: 9, fontWeight: '800', includeFontPadding: false },
  itemBody: { padding: 7 },
  itemName: { fontSize: 11, fontWeight: '700', color: C.text, lineHeight: 15, marginBottom: 1, includeFontPadding: false },
  itemDesc: { fontSize: 9.5, color: C.textLight, includeFontPadding: false },

  // Empty
  emptyWrap:    { alignItems: 'center', paddingVertical: 40, gap: 8 },
  emptyIconBox: { width: 64, height: 64, borderRadius: 20, backgroundColor: '#F5F5F5', alignItems: 'center', justifyContent: 'center' },
  emptyTitle:   { fontSize: 14, fontWeight: '700', color: C.textMid, includeFontPadding: false },
  emptySubtitle:{ fontSize: 11, color: C.textLight, includeFontPadding: false },

  // Modal
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.52)',
    justifyContent: 'center', alignItems: 'center', paddingHorizontal: 24,
  },
  modalCard: {
    width: '100%', backgroundColor: C.white, borderRadius: 22, overflow: 'hidden',
    shadowColor: C.shadow, shadowOpacity: 0.22, shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 }, elevation: 18,
  },
  modalImage: { width: '100%', height: 200 },
  modalClose: {
    position: 'absolute', top: 10, right: 10,
    width: 30, height: 30, borderRadius: 15,
    backgroundColor: C.white, alignItems: 'center', justifyContent: 'center',
    shadowColor: C.shadow, shadowOpacity: 0.12, shadowRadius: 4, elevation: 3,
  },
  modalBody:  { padding: 16 },
  modalName:  { fontSize: 16, fontWeight: '800', color: C.text,    marginBottom: 4,  includeFontPadding: false },
  modalPrice: { fontSize: 18, fontWeight: '900', color: C.primary, marginBottom: 6,  includeFontPadding: false },
  modalDesc:  { fontSize: 12, color: C.textMid,  lineHeight: 18,   includeFontPadding: false },
});