/**
 * ShopDetail.jsx — Pro UI Edition (Enhanced)
 * ✨ Distance Fix + Sparkle Magic + Premium UI
 */

import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import {
  memo,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import {
  Alert,
  Animated,
  Dimensions,
  Keyboard,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
  Share,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AdBanner from '../../components/AdBanner';
import { trackShareEvent } from '../../utils/shareAnalytics';

const BASE_URL = 'https://dukan-backend-0cc9.onrender.com';
const { width } = Dimensions.get('window');
const COVER_HEIGHT = 280;
const POLL_INTERVAL = 60_000;
const BANNER_AUTO_SCROLL_MS = 3_500;
const COLS = 3;
const GAP = 10;
const H_PAD = 16;
const ITEM_WIDTH = (width - H_PAD * 2 - GAP * (COLS - 1)) / COLS;
const CRED_CACHE_TTL = 5 * 60_000;

const C = {
  primary:      '#0E5C42',
  primaryMid:   '#1B7A58',
  primaryLight: '#E6F4EE',
  accent:       '#2DD882',
  gold:         '#F0A500',
  goldLight:    '#FFF8E6',
  white:        '#FFFFFF',
  bg:           '#F4F6F5',
  card:         '#FFFFFF',
  text:         '#0D1B14',
  textMid:      '#4A5E55',
  textLight:    '#9EB5AA',
  border:       '#E4EDE8',
  shadow:       '#000000',
  call:         '#0E5C42',
  whatsapp:     '#25D366',
  map:          '#3A7FFF',
  error:        '#D62B2B',
  success:      '#169C53',
  warning:      '#D97706',
  glassWhite:   'rgba(255,255,255,0.18)',
  glassDark:    'rgba(0,0,0,0.28)',
};

async function getCredentials() {
  const [[, lat], [, lon], [, t], [, at]] = await AsyncStorage.multiGet(['lat', 'lon', 'token', 'access_token']);
  const token = t || at;
  return { lat, lon, token };
}

const getImageUrl = (img) =>
  !img
    ? 'https://placehold.co/400x300/e0e0e0/aaaaaa?text=Shop'
    : img.startsWith('http')
    ? img
    : `${BASE_URL}${img}`;

const getItemImages = (item) => [item?.image, item?.image2, item?.image3].filter(Boolean);

const templateGradients = {
  red:   ['#9B1C1C', '#C0392B'],
  green: ['#0E5C42', '#1B7A58'],
  dark:  ['#181825', '#2C2C3E'],
};
const getTemplateGradient = (t) => templateGradients[t] ?? templateGradients.green;

const formatDistance = (d) => {
  const n = Number(d);
  if (!isFinite(n)) return '';
  if (n < 1) return `Nearby (${Math.round(n * 1000)}m)`;
  return `Approx. ${n.toFixed(1)} km`;
};

const formatTime = (timeStr) => {
  if (!timeStr) return '';
  const parts = timeStr.split(':');
  if (parts.length < 2) return timeStr;
  let hours = parseInt(parts[0], 10);
  const minutes = parts[1];
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12;
  hours = hours ? hours : 12;
  return `${hours}:${minutes} ${ampm}`;
};

function useShopData(id) {
  const [shop,       setShop]       = useState(null);
  const [banners,    setBanners]    = useState([]);
  const [media,      setMedia]      = useState([]);
  const [items,      setItems]      = useState([]);
  const [favorite,   setFavorite]   = useState(false);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error,      setError]      = useState(null);

  const favPending = useRef(false);
  const abortRef   = useRef(null);

  useEffect(() => {
    AsyncStorage.getItem(`shop_${id}`).then((raw) => {
      if (!raw) return;
      try {
        const d = JSON.parse(raw);
        setShop(d.shop);
        setBanners(d.banners ?? []);
        setMedia(d.media ?? []);
        setItems(d.items ?? []);
        setLoading(false);
      } catch {}
    });
  }, [id]);

  const fetchShop = useCallback(async (isRefresh = false) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      if (isRefresh) setRefreshing(true);
      setError(null);

      const { lat, lon, token } = await getCredentials();
      const hasLoc  = lat != null && lon != null;
      const shopUrl = hasLoc
        ? `${BASE_URL}/api/shops/${id}/?lat=${lat}&lon=${lon}`
        : `${BASE_URL}/api/shops/${id}/`;
      const headers = token ? { Authorization: `Bearer ${token}` } : {};

      const [shopRes, favRes] = await Promise.all([
        fetch(shopUrl, { headers, signal: controller.signal }),
        fetch(`${BASE_URL}/api/favorites/`, { headers, signal: controller.signal }),
      ]);

      if (!shopRes.ok) throw new Error(`Shop fetch failed (${shopRes.status})`);

      const [shopData, favData] = await Promise.all([
        shopRes.json(),
        favRes.ok ? favRes.json() : Promise.resolve([]),
      ]);

      setShop(shopData.shop);
      setBanners(shopData.banners ?? []);
      setMedia(shopData.media ?? []);
      setItems(shopData.items ?? []);
      setFavorite(
        Array.isArray(favData) && favData.some((f) => f.id === shopData.shop.id)
      );

      AsyncStorage.setItem(`shop_${id}`, JSON.stringify({
        shop: shopData.shop,
        banners: shopData.banners ?? [],
        media: shopData.media ?? [],
        items: shopData.items ?? [],
      }));
    } catch (e) {
      if (e.name === 'AbortError') return;
      setError(e.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [id]);

  useEffect(() => {
    fetchShop();
    const iv = setInterval(fetchShop, POLL_INTERVAL);
    return () => { clearInterval(iv); abortRef.current?.abort(); };
  }, [fetchShop]);

  const onRefresh       = useCallback(() => fetchShop(true), [fetchShop]);
  const toggleFavorite  = useCallback(async (shopId) => {
    if (favPending.current) return;
    favPending.current = true;
    const prev = favorite;
    setFavorite(!prev);
    try {
      const { token } = await getCredentials();
      const res = await fetch(`${BASE_URL}/api/favorite/toggle/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ shop_id: shopId }),
      });
      if (!res.ok) throw new Error();
    } catch {
      setFavorite(prev);
    } finally {
      favPending.current = false;
    }
  }, [favorite]);

  return {
    shop, banners, media, items,
    favorite, loading, refreshing, error,
    onRefresh, toggleFavorite,
  };
}

// ✨ Animated Sparkle Component
const Sparkle = memo(({ size = 12, color = C.accent, delay = 0 }) => {
  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const loop = () => {
      Animated.sequence([
        Animated.delay(delay),
        Animated.parallel([
          Animated.timing(opacity, { toValue: 1, duration: 300, useNativeDriver: true }),
          Animated.timing(scale, { toValue: 1, duration: 300, useNativeDriver: true }),
        ]),
        Animated.delay(800),
        Animated.parallel([
          Animated.timing(opacity, { toValue: 0, duration: 400, useNativeDriver: true }),
          Animated.timing(scale, { toValue: 0.3, duration: 400, useNativeDriver: true }),
        ]),
      ]).start(() => loop());
    };
    loop();
  }, [delay, opacity, scale]);

  return (
    <Animated.View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: color,
        opacity,
        transform: [{ scale }],
      }}
    />
  );
});
Sparkle.displayName = 'Sparkle';

const GlassFab = memo(({ icon, onPress, iconColor = C.white, badge }) => (
  <TouchableOpacity
    style={s.glassFab}
    onPress={onPress}
    activeOpacity={0.75}
    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
  >
    <Ionicons name={icon} size={20} color={iconColor} />
    {badge ? <View style={s.fabBadge} /> : null}
  </TouchableOpacity>
));
GlassFab.displayName = 'GlassFab';

const ActionBtn = memo(({ icon, label, color, gradient, onPress, disabled }) => {
  const scale = useRef(new Animated.Value(1)).current;
  const onIn  = useCallback(() => {
    Animated.spring(scale, { toValue: 0.94, useNativeDriver: true, speed: 100 }).start();
  }, [scale]);
  const onOut = useCallback(() => {
    Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 60 }).start();
  }, [scale]);

  return (
    <TouchableWithoutFeedback onPressIn={onIn} onPressOut={onOut} onPress={onPress} disabled={disabled}>
      <Animated.View style={[s.actionBtn, disabled && s.actionBtnDisabled, { transform: [{ scale }] }]}>
        <LinearGradient
          colors={gradient ?? [color, color]}
          style={s.actionBtnGrad}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <View style={s.actionBtnIcon}>
            <Ionicons name={icon} size={18} color={C.white} />
          </View>
          <Text style={s.actionBtnText}>{label}</Text>
        </LinearGradient>
      </Animated.View>
    </TouchableWithoutFeedback>
  );
});
ActionBtn.displayName = 'ActionBtn';

const CategoryPill = memo(({ label }) => (
  <View style={s.categoryPill}>
    <Text style={s.categoryPillText}>{label}</Text>
  </View>
));
CategoryPill.displayName = 'CategoryPill';

const ItemCard = memo(function ItemCard({ item, onPress }) {
  const scale = useRef(new Animated.Value(1)).current;
  const onPressIn  = useCallback(() => {
    Animated.spring(scale, { toValue: 0.96, useNativeDriver: true, speed: 100, bounciness: 6 }).start();
  }, [scale]);
  const onPressOut = useCallback(() => {
    Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 60, bounciness: 8 }).start();
  }, [scale]);
  const handlePress = useCallback(() => onPress(item), [item, onPress]);
  const images = getItemImages(item);

  return (
    <TouchableWithoutFeedback onPressIn={onPressIn} onPressOut={onPressOut} onPress={handlePress}>
      <Animated.View style={[s.itemCard, { transform: [{ scale }] }]}>

        <View style={s.itemImgWrap}>
          <Image
            source={{ uri: getImageUrl(images[0]) }}
            style={s.itemImg}
            contentFit="cover"
          />
          <LinearGradient colors={['transparent', 'rgba(0,0,0,0.45)']} style={s.itemImgGrad} />
          {images.length > 1 && (
            <View style={s.itemPhotoCountBadge}>
              <Text style={s.itemPhotoCountText}>{images.length} Photos</Text>
            </View>
          )}
          {item.price != null && (
            <LinearGradient
              colors={[C.primary, C.primaryMid]}
              style={s.itemPriceBadge}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <Text style={s.itemPriceBadgeText}>₹{item.price}</Text>
            </LinearGradient>
          )}
        </View>
        <View style={s.itemBody}>
          <Text style={s.itemName} numberOfLines={2}>{item.name}</Text>
          {item.description ? (
            <Text style={s.itemDesc} numberOfLines={1}>{item.description}</Text>
          ) : null}
          {item.track_quantity && (
            <View style={{ marginTop: 6 }}>
              {item.quantity_status === 'out' && (
                <View style={s.stockBadgeOut}>
                  <Text style={s.stockBadgeText}>Out of Stock</Text>
                </View>
              )}
              {item.quantity_status === 'low' && (
                <View style={s.stockBadgeLow}>
                  <Text style={s.stockBadgeText}>Only {item.quantity} left</Text>
                </View>
              )}
              {item.quantity_status === 'in' && (
                <View style={s.stockBadgeIn}>
                  <Text style={s.stockBadgeText}>In Stock</Text>
                </View>
              )}
            </View>
          )}
        </View>
      </Animated.View>
    </TouchableWithoutFeedback>
  );
});
ItemCard.displayName = 'ItemCard';

const ItemRow = memo(({ items, rowIdx, onPress }) => (
  <View style={s.row}>
    {items.map((item, colIdx) =>
      item ? (
        <ItemCard key={item.id} item={item} onPress={onPress} />
      ) : (
        <View key={`row-${rowIdx}-spacer-${colIdx}`} style={s.itemCardSpacer} />
      )
    )}
  </View>
));
ItemRow.displayName = 'ItemRow';

const BannerCarousel = memo(({ banners }) => {
  const [offerIndex, setOfferIndex] = useState(0);
  const scrollRef  = useRef(null);
  const offerWidth = width - H_PAD * 2;

  useEffect(() => {
    if (banners.length <= 1) return;
    const iv = setInterval(() => {
      setOfferIndex((prev) => {
        const next = (prev + 1) % banners.length;
        scrollRef.current?.scrollTo({ x: next * (offerWidth + 12), animated: true });
        return next;
      });
    }, BANNER_AUTO_SCROLL_MS);
    return () => clearInterval(iv);
  }, [banners.length, offerWidth]);

  return (
    <View>
      <Animated.ScrollView
        ref={scrollRef}
        horizontal
        decelerationRate="fast"
        snapToInterval={offerWidth + 12}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 12 }}
        scrollEventThrottle={16}
        onMomentumScrollEnd={(e) =>
          setOfferIndex(Math.round(e.nativeEvent.contentOffset.x / (offerWidth + 12)))
        }
      >
        {banners.map((b) => (
          <View key={b.id} style={{ width: offerWidth }}>
            {b.banner_type === 'image' ? (
              <Image
                source={{ uri: getImageUrl(b.image) }}
                style={s.offerImage}
                contentFit="cover"
              />
            ) : (
              <LinearGradient
                colors={getTemplateGradient(b.template)}
                style={s.offerCard}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
                <View style={{ flex: 1, zIndex: 2 }}>
                  {b.title && <Text style={s.offerTitle}>{b.title.toUpperCase()}</Text>}
                  {b.discount != null && <Text style={s.offerDiscount}>{b.discount}</Text>}
                  {b.subtitle && <Text style={s.offerSubtitle}>{b.subtitle}</Text>}
                </View>
                <View style={s.offerDecorCircle} />
                <Ionicons name="pricetag" size={80} color="rgba(255,255,255,0.08)" style={s.offerBgIcon} />
              </LinearGradient>
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
  );
});
BannerCarousel.displayName = 'BannerCarousel';

const ItemModal = memo(({ item, visible, onClose, shop }) => {
  const anim = useRef(new Animated.Value(0)).current;
  const [activeImage, setActiveImage] = useState(0);
  const carouselRef = useRef(null);
  const images = getItemImages(item);

  useEffect(() => {
    Animated.spring(anim, {
      toValue: visible ? 1 : 0,
      useNativeDriver: true,
      speed: 18,
      bounciness: 7,
    }).start();
  }, [visible, anim]);

  useEffect(() => {
    if (visible) setActiveImage(0);
  }, [visible, item]);

  if (!item) return null;

  const scaleOut  = anim.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1] });
  const slideOut  = anim.interpolate({ inputRange: [0, 1], outputRange: [60, 0] });
  const MODAL_IMG_HEIGHT = 280;

  const handleCarouselScroll = (e) => {
    const idx = Math.round(e.nativeEvent.contentOffset.x / width);
    setActiveImage(idx);
  };

  return (
    <Modal transparent visible={visible} onRequestClose={onClose} animationType="fade" statusBarTranslucent>
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={s.modalOverlay}>
          <TouchableWithoutFeedback>
            <Animated.View style={[
              s.modalCard,
              { opacity: anim, transform: [{ scale: scaleOut }, { translateY: slideOut }] },
            ]}>
              <View style={{ height: MODAL_IMG_HEIGHT, overflow: 'hidden', position: 'relative' }}>
                <ScrollView
                  ref={carouselRef}
                  horizontal
                  pagingEnabled
                  showsHorizontalScrollIndicator={false}
                  scrollEventThrottle={16}
                  onMomentumScrollEnd={handleCarouselScroll}
                >
                  {images.map((uri, idx) => (
                    <Image
                      key={idx}
                      source={{ uri: getImageUrl(uri) }}
                      style={{ width, height: MODAL_IMG_HEIGHT }}
                      contentFit="cover"
                    />
                  ))}
                </ScrollView>
                <LinearGradient
                  colors={['transparent', 'rgba(0,0,0,0.18)']}
                  style={StyleSheet.absoluteFill}
                  pointerEvents="none"
                />
                {images.length > 1 && (
                  <>
                    <TouchableOpacity
                      style={[s.carouselArrow, s.carouselArrowLeft]}
                      onPress={() => {
                        const nextIdx = activeImage === 0 ? images.length - 1 : activeImage - 1;
                        setActiveImage(nextIdx);
                        carouselRef.current?.scrollTo({ x: nextIdx * width, animated: true });
                      }}
                      activeOpacity={0.7}
                    >
                      <Text style={s.carouselArrowText}>‹</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[s.carouselArrow, s.carouselArrowRight]}
                      onPress={() => {
                        const nextIdx = activeImage === images.length - 1 ? 0 : activeImage + 1;
                        setActiveImage(nextIdx);
                        carouselRef.current?.scrollTo({ x: nextIdx * width, animated: true });
                      }}
                      activeOpacity={0.7}
                    >
                      <Text style={s.carouselArrowText}>›</Text>
                    </TouchableOpacity>
                  </>
                )}
                {images.length > 1 && (
                  <View style={s.carouselDots}>
                    {images.map((_, i) => (
                      <View key={i} style={[s.carouselDot, activeImage === i && s.carouselDotActive]} />
                    ))}
                  </View>
                )}
              </View>
              <TouchableOpacity style={s.modalClose} onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name="close" size={15} color={C.text} />
              </TouchableOpacity>

              <View style={s.modalBody}>
                {item.price != null && (
                  <LinearGradient
                    colors={[C.primaryLight, 'rgba(230,244,238,0.7)']}
                    style={s.modalPriceChip}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                  >
                    <Text style={s.modalPriceChipText}>₹{item.price}</Text>
                  </LinearGradient>
                )}
                <Text style={s.modalName}>{item.name}</Text>

                {item.track_quantity && (
                  <View style={{ marginTop: 10 }}>
                    {item.quantity_status === 'out' && (
                      <View style={s.stockBadgeOut}>
                        <Text style={s.stockBadgeText}>Out of Stock</Text>
                      </View>
                    )}
                    {item.quantity_status === 'low' && (
                      <View style={s.stockBadgeLow}>
                        <Text style={s.stockBadgeText}>Only {item.quantity} left</Text>
                      </View>
                    )}
                    {item.quantity_status === 'in' && (
                      <View style={s.stockBadgeIn}>
                        <Text style={s.stockBadgeText}>{item.quantity} available</Text>
                      </View>
                    )}
                  </View>
                )}

                {item.description ? <Text style={s.modalDesc}>{item.description}</Text> : null}
                <View style={s.swipeHint}>
                  <View style={s.swipeBar} />
                </View>
              {images.length > 1 && (
                <View style={s.modalThumbsRow}>
                  {images.map((uri, index) => (
                    <TouchableOpacity
                      key={index}
                      style={[s.modalThumbWrap, activeImage === index && s.modalThumbActive]}
                      onPress={() => {
                        setActiveImage(index);
                        carouselRef.current?.scrollTo({ x: index * width, animated: true });
                      }}
                      activeOpacity={0.8}
                    >
                      <Image
                        source={{ uri: getImageUrl(uri) }}
                        style={s.modalThumb}
                        contentFit="cover"
                      />
                    </TouchableOpacity>
                  ))}
                </View>
              )}
              </View>
            </Animated.View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
});
ItemModal.displayName = 'ItemModal';

const Skeleton = memo(({ style }) => {
  const opacity = useRef(new Animated.Value(0.35)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.9, duration: 750, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.35, duration: 750, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);
  return (
    <Animated.View style={[{ backgroundColor: '#D8E3DC', borderRadius: 10 }, style, { opacity }]} />
  );
});
Skeleton.displayName = 'Skeleton';

const LoadingScreen = () => (
  <View style={s.safe}>
    <StatusBar style="dark" />
    <Skeleton style={{ height: COVER_HEIGHT, borderRadius: 0 }} />
    <View style={{ padding: 20, gap: 12 }}>
      <Skeleton style={{ height: 24, width: '60%', borderRadius: 8 }} />
      <Skeleton style={{ height: 14, width: '40%', borderRadius: 6 }} />
      <Skeleton style={{ height: 14, width: '80%', borderRadius: 6 }} />
      <View style={{ flexDirection: 'row', gap: 10, marginTop: 8 }}>
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} style={{ flex: 1, height: 52, borderRadius: 16 }} />
        ))}
      </View>
    </View>
  </View>
);

const ErrorScreen = memo(({ message, onRetry }) => (
  <View style={s.errorWrap}>
    <View style={s.errorIconBox}>
      <Ionicons name="cloud-offline-outline" size={36} color={C.textLight} />
    </View>
    <Text style={s.errorTitle}>Could not load shop</Text>
    <Text style={s.errorMsg}>{message}</Text>
    <TouchableOpacity style={s.retryBtn} onPress={onRetry} activeOpacity={0.8}>
      <LinearGradient colors={[C.primaryMid, C.primary]} style={s.retryBtnGrad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
        <Text style={s.retryBtnText}>Try Again</Text>
      </LinearGradient>
    </TouchableOpacity>
  </View>
));
ErrorScreen.displayName = 'ErrorScreen';

const ErrorBanner = memo(({ message, onRetry }) => (
  <TouchableOpacity style={s.errorBanner} onPress={onRetry} activeOpacity={0.85}>
    <Ionicons name="alert-circle-outline" size={14} color={C.white} />
    <Text style={s.errorBannerText} numberOfLines={1}>{message} — Tap to retry</Text>
  </TouchableOpacity>
));
ErrorBanner.displayName = 'ErrorBanner';

const CoverCarousel = memo(({ media, shop, isPro, scrollY }) => {
  const [activeIndex, setActiveIndex] = useState(0);

  const imgTranslate = scrollY.interpolate({
    inputRange: [-COVER_HEIGHT, 0, COVER_HEIGHT],
    outputRange: [COVER_HEIGHT * 0.25, 0, -COVER_HEIGHT * 0.25],
    extrapolate: 'clamp',
  });

  const renderImage = (uri, key) => (
    <Animated.Image
      key={key}
      source={{ uri }}
      style={[{ width, height: COVER_HEIGHT + 40, marginTop: -20 }, { transform: [{ translateY: imgTranslate }] }]}
      contentFit="cover"
    />
  );

  if (media.length > 0) {
    if (isPro) {
      const visible = media.slice(0, 5);
      return (
        <>
          <Animated.ScrollView
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            scrollEventThrottle={16}
            onMomentumScrollEnd={(e) =>
              setActiveIndex(Math.round(e.nativeEvent.contentOffset.x / width))
            }
          >
            {visible.map((m, i) => renderImage(getImageUrl(m.image), m?.id ?? i))}
          </Animated.ScrollView>
          {visible.length > 1 && (
            <View style={s.dots}>
              {visible.map((_, i) => (
                <View key={i} style={[s.dot, activeIndex === i && s.dotActive]} />
              ))}
            </View>
          )}
        </>
      );
    }
    return renderImage(getImageUrl(media[0].image), 'single');
  }
  return renderImage(getImageUrl(shop.image), 'shop');
});
CoverCarousel.displayName = 'CoverCarousel';

const ShopListHeader = memo(({
  shop, media, banners, isPro,
  filteredCount, searchQuery, searchFocused,
  searchRef, onSearchBarLayout, scrollY,
  callShop, openWhatsApp, openMap,
  setSearchQuery, onSearchFocus, onSearchBlur, clearSearch,
  reportStatus,
}) => {
  const hasPhone    = !!shop.phone;
  const hasWhatsApp = !!(shop.phone || shop.whatsapp_number);

  return (
    <>
      <View style={{ height: COVER_HEIGHT, overflow: 'hidden' }}>
        <CoverCarousel media={media} shop={shop} isPro={isPro} scrollY={scrollY} />
        <LinearGradient
          colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.12)', 'rgba(0,0,0,0.55)']}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />
      </View>

      <View style={s.infoCard}>
        <View style={s.infoTopRow}>
          <View style={{ flex: 1, paddingRight: 12 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Text style={s.shopName}>{shop.name}</Text>
              {isPro && (
                <View style={{ backgroundColor: '#EAB308', width: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center', shadowColor: '#FFD700', shadowOpacity: 0.5, shadowRadius: 4, elevation: 2 }}>
                  <Ionicons name="star" size={9} color="#FFFFFF" />
                </View>
              )}
            </View>
            <CategoryPill label={shop.category} />
          </View>
          <View style={[s.statusChip, { backgroundColor: shop.is_open ? '#EDFBF2' : '#FCE8E6' }]}>
            <Text style={[s.statusText, { color: shop.is_open ? C.accent : '#EA4335' }]}>
              {shop.is_open ? '🟢 Open Now' : '🔴 Closed'}
            </Text>
          </View>
        </View>

        <View style={s.addrRow}>
          <Ionicons name="location-sharp" size={13} color={C.primary} />
          <Text style={s.addrText} numberOfLines={2}>
            {shop.distance != null ? `${formatDistance(shop.distance)} · ` : ''}
            {shop.address || 'No address available'}
          </Text>
        </View>

        {shop.opening_time && shop.closing_time ? (
          <View style={s.timingBadge}>
            <Ionicons name="time" size={14} color={C.primary} style={{ marginRight: 6 }} />
            <Text style={s.timingText}>
              Hours: <Text style={s.timingHours}>{formatTime(shop.opening_time)} - {formatTime(shop.closing_time)}</Text>
              <Text style={{ color: C.textLight }}>  ·  </Text>
              <Text style={[s.timingHours, { color: shop.is_open ? C.success : C.error }]}>
                {shop.is_open ? 'Open Now' : 'Closed'}
              </Text>
            </Text>
          </View>
        ) : null}

        {shop.description ? (
          <View style={s.descBox}>
            <Text style={s.descLabel}>ABOUT OUR SHOP</Text>
            <Text style={s.descText}>{shop.description}</Text>
          </View>
        ) : null}

        <View style={s.divider} />

        <View style={s.actionsRow}>
          <ActionBtn
            icon="call"
            label="Call"
            color={C.call}
            gradient={[C.primaryMid, C.primary]}
            onPress={callShop}
            disabled={!hasPhone}
          />
          <ActionBtn
            icon="logo-whatsapp"
            label="WhatsApp"
            color={C.whatsapp}
            gradient={['#43E07A', '#25D366']}
            onPress={openWhatsApp}
            disabled={!hasWhatsApp}
          />
          <ActionBtn
            icon="navigate-sharp"
            label="Maps"
            color={C.map}
            gradient={['#5BA3FF', C.map]}
            onPress={openMap}
            disabled={!shop.latitude}
          />
        </View>
      </View>

      <View style={s.section}>
        <View style={s.sectionHead}>
          <View style={s.sectionAccent} />
          <Text style={s.sectionTitle}>
            {isPro ? 'Featured Offers' : 'Sponsored'}
          </Text>
          {isPro && (
            <View style={s.proBadge}>
              <Ionicons name="flash" size={9} color={C.gold} />
              <Text style={s.proBadgeText}>PRO</Text>
            </View>
          )}
          <View style={s.sparkleContainer}>
            <Sparkle size={6} color={C.gold} delay={0} />
            <Sparkle size={5} color={C.accent} delay={200} />
          </View>
        </View>
        {isPro && banners?.length > 0 ? (
          <BannerCarousel banners={banners} />
        ) : (
          <AdBanner />
        )}
      </View>

      <View style={[s.section, { marginBottom: 0 }]}>
        <View style={s.sectionHead}>
          <View style={s.sectionAccent} />
          <Text style={s.sectionTitle}>Items</Text>
          <View style={s.itemCountPill}>
            <Text style={s.itemCountText}>{filteredCount}</Text>
          </View>
          <View style={s.sparkleContainer}>
            <Sparkle size={5} color={C.accent} delay={100} />
          </View>
        </View>

        <Animated.View
          style={[s.searchBar, searchFocused && s.searchBarActive]}
          onLayout={onSearchBarLayout}
        >
          <Ionicons
            name="search"
            size={15}
            color={searchFocused ? C.primary : C.textLight}
          />
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
            <TouchableOpacity
              onPress={clearSearch}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="close-circle" size={16} color={C.textLight} />
            </TouchableOpacity>
          )}
        </Animated.View>
      </View>
    </>
  );
});
ShopListHeader.displayName = 'ShopListHeader';

const PulseDot = memo(() => {
  const scale = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(scale, { toValue: 1.8, duration: 700, useNativeDriver: true }),
        Animated.timing(scale, { toValue: 1,   duration: 700, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [scale]);
  return (
    <View style={{ width: 10, height: 10, alignItems: 'center', justifyContent: 'center' }}>
      <Animated.View style={[s.pulseDotRing, { transform: [{ scale }] }]} />
      <View style={s.pulseDotCore} />
    </View>
  );
});
PulseDot.displayName = 'PulseDot';

const ShopListEmpty = memo(({ searchQuery }) => (
  <View style={s.emptyWrap}>
    <View style={s.emptyIconBox}>
      <Ionicons name="cube-outline" size={30} color={C.textLight} />
    </View>
    <Text style={s.emptyTitle}>
      {searchQuery ? 'No results found' : 'No items yet'}
    </Text>
    <Text style={s.emptySubtitle}>
      {searchQuery ? `Nothing matches "${searchQuery}"` : 'Check back later'}
    </Text>
  </View>
));
ShopListEmpty.displayName = 'ShopListEmpty';

export default function ShopDetail() {
  const { id }   = useLocalSearchParams();
  const router   = useRouter();
  const insets   = useSafeAreaInsets();

  const scrollY  = useRef(new Animated.Value(0)).current;
  const favScale = useRef(new Animated.Value(1)).current;
  const scrollRef  = useRef(null);
  const searchRef  = useRef(null);
  const searchBarY = useRef(0);

  const [searchQuery,   setSearchQuery]   = useState('');
  const [searchFocused, setSearchFocused] = useState(false);
  const [selectedItem,  setSelectedItem]  = useState(null);
  const [modalVisible,  setModalVisible]  = useState(false);

  const {
    shop, banners, media, items,
    favorite, loading, refreshing, error,
    onRefresh, toggleFavorite,
  } = useShopData(id);

  const goBack = useCallback(() => router.back(), [router]);

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

  const handleReportStatus = useCallback(async (details) => {
    try {
      const token = await AsyncStorage.getItem('token') || await AsyncStorage.getItem('access_token');
      if (!token) {
        Alert.alert("Authentication Required", "Please login to submit reports and earn Local Hero rewards.");
        return;
      }
      const res = await fetch(`https://dukan-backend-0cc9.onrender.com/api/reports/submit/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          shop_id: id,
          report_type: 'status',
          details: details
        })
      });
      const data = await res.json();
      if (res.ok) {
        Alert.alert("Thank you Hero!", `+10 Credits earned! Current Balance: ${data.reward_credits || 0}`);
      } else {
        Alert.alert("Failed to Submit", data.error || "Please login again.");
      }
    } catch (err) {
      Alert.alert("Error", "Network connection failed. Please try again.");
    }
  }, [id]);

  const handleToggleFavorite = useCallback(() => {
    Animated.sequence([
      Animated.spring(favScale, { toValue: 1.6, useNativeDriver: true, speed: 80 }),
      Animated.spring(favScale, { toValue: 1,   useNativeDriver: true, speed: 30 }),
    ]).start();
    toggleFavorite(shop.id);
  }, [favScale, toggleFavorite, shop?.id]);

  const handleShareShop = useCallback(async () => {
    if (!shop || !shop.name) {
      Alert.alert('Error', 'Unable to share shop due to missing details.');
      return;
    }

    await trackShareEvent('shop_share_button_clicked', shop);

    const playStoreLink = 'https://play.google.com/store/apps/details?id=com.mydukan.dukanapp';
    const shopName = shop.name;
    const category = shop.category || 'Local Business';
    const address = shop.address || '';
    
    const message = [
      `🏪 Check out this shop on mydukan`,
      `\nShop: ${shopName}`,
      `Link: https://mydukan.online/shop/${shop.id}`,
      address ? `Location: ${address}` : null,
      `Category: ${category}`,
      `\nDiscover products and connect with local businesses using mydukan.`,
      `\nDownload mydukan:`,
      playStoreLink
    ].filter(Boolean).join('\n');

    try {
      const result = await Share.share({
        message,
        title: `Share ${shopName}`,
      });

      if (result.action === Share.sharedAction) {
        await trackShareEvent('shop_shared_successfully', shop);
      }
    } catch (error) {
      console.error('[Share] Share failed:', error);
      Alert.alert('Sharing Failed', 'Could not open sharing panel.');
    }
  }, [shop]);

  const filteredItems = items.filter((i) =>
    i.name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const itemRows = (() => {
    if (!filteredItems.length) return [];
    const rows = [];
    for (let i = 0; i < filteredItems.length; i += COLS) {
      const row = filteredItems.slice(i, i + COLS);
      while (row.length < COLS) row.push(null);
      rows.push({ row, rowIdx: i / COLS });
    }
    return rows;
  })();

  const openItem   = useCallback((item) => {
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
    setTimeout(
      () => scrollRef.current?.scrollTo?.({ y: searchBarY.current - 12, animated: true }),
      150
    );
  }, []);
  const onSearchBlur      = useCallback(() => setSearchFocused(false), []);
  const onSearchBarLayout = useCallback((e) => { searchBarY.current = e.nativeEvent.layout.y; }, []);

  const headerOpacity = scrollY.interpolate({
    inputRange: [COVER_HEIGHT - 70, COVER_HEIGHT],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });
  const titleOpacity = scrollY.interpolate({
    inputRange: [COVER_HEIGHT - 40, COVER_HEIGHT + 20],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });

  const onScroll = Animated.event(
    [{ nativeEvent: { contentOffset: { y: scrollY } } }],
    { useNativeDriver: false }
  );

  const renderRow = useCallback(
    ({ item: { row, rowIdx } }) => <ItemRow items={row} rowIdx={rowIdx} onPress={openItem} />,
    [openItem]
  );
  const keyExtractor = useCallback(
    ({ row, rowIdx }) => `row-${rowIdx}-${row.find(Boolean)?.id ?? rowIdx}`,
    []
  );

  const HEADER_TOP = insets.top + 8;
  const isPro = shop?.plan?.toLowerCase?.() === 'pro';

  if (loading && !shop) return <LoadingScreen />;
  if (!shop && error) return <ErrorScreen message={error} onRetry={onRefresh} />;
  if (!shop) return null;

  return (
    <View style={s.safe}>
      <StatusBar style="light" />
      <ItemModal item={selectedItem} visible={modalVisible} onClose={closeModal} shop={shop} />

      <View style={[s.fabBack, { top: HEADER_TOP - 12 }]}>
        <GlassFab icon="chevron-back" onPress={goBack} />
      </View>

      <View style={[s.fabRight, { top: HEADER_TOP - 12 }]}>
        <GlassFab icon="share-social-outline" onPress={handleShareShop} />
        <TouchableOpacity
          style={s.glassFab}
          onPress={handleToggleFavorite}
          activeOpacity={0.75}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Animated.View style={{ transform: [{ scale: favScale }] }}>
            <Ionicons
              name={favorite ? 'heart' : 'heart-outline'}
              size={19}
              color={favorite ? '#FF4560' : C.white}
            />
          </Animated.View>
        </TouchableOpacity>
      </View>

      <Animated.View style={[s.solidHeader, { opacity: headerOpacity, paddingTop: HEADER_TOP }]} pointerEvents="none">
        <LinearGradient colors={[C.white, C.white]} style={StyleSheet.absoluteFill} />
        <Animated.Text style={[s.solidHeaderTitle, { opacity: titleOpacity }]} numberOfLines={1}>
          {shop.name}
        </Animated.Text>
      </Animated.View>

      {error && <ErrorBanner message={error} onRetry={onRefresh} />}

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
      >
        <Animated.FlatList
          ref={scrollRef}
          data={itemRows}
          keyExtractor={keyExtractor}
          renderItem={renderRow}
          ListHeaderComponent={
            <ShopListHeader
              shop={shop}
              media={media}
              banners={banners}
              isPro={isPro}
              filteredCount={filteredItems.length}
              searchQuery={searchQuery}
              searchFocused={searchFocused}
              searchRef={searchRef}
              onSearchBarLayout={onSearchBarLayout}
              scrollY={scrollY}
              callShop={callShop}
              openWhatsApp={openWhatsApp}
              openMap={openMap}
              setSearchQuery={setSearchQuery}
              onSearchFocus={onSearchFocus}
              onSearchBlur={onSearchBlur}
              clearSearch={clearSearch}
              reportStatus={handleReportStatus}
            />
          }
          ListEmptyComponent={
            filteredItems.length === 0
              ? <ShopListEmpty searchQuery={searchQuery} />
              : null
          }
          onScroll={onScroll}
          scrollEventThrottle={16}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={C.primary}
              colors={[C.primary]}
            />
          }
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: insets.bottom + 120 }}
          removeClippedSubviews={Platform.OS === 'android'}
          windowSize={5}
          maxToRenderPerBatch={4}
          initialNumToRender={6}
          updateCellsBatchingPeriod={50}
        />
      </KeyboardAvoidingView>
    </View>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },

  fabBack:  { position: 'absolute', left: 13, zIndex: 100 },
  fabRight: { position: 'absolute', right: 12, zIndex: 100, flexDirection: 'row', gap: 8 },
  glassFab: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: C.glassDark,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.06)',
    shadowColor: C.shadow, shadowOpacity: 0.22, shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 }, elevation: 8,
  },
  fabBadge: {
    position: 'absolute', right: 6,
    width: 7, height: 7, borderRadius: 4,
    backgroundColor: '#FF4560', borderWidth: 1.5, borderColor: C.white,
  },

  solidHeader: {
    position: 'absolute', left: 0, right: 0, top: 0, zIndex: 99,
    backgroundColor: C.white, alignItems: 'center', justifyContent: 'flex-end',
    paddingBottom: 12,
    shadowColor: C.shadow, shadowOpacity: 0.07, shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 }, elevation: 8,
  },
  solidHeaderTitle: {
    fontSize: 14, fontWeight: '800', color: C.text,
    letterSpacing: -0.3, paddingHorizontal: 72, textAlign: 'center',
    includeFontPadding: false,
  },

  dots: {
    position: 'absolute', bottom: 14, left: 0, right: 0,
    flexDirection: 'row', justifyContent: 'center', gap: 5,
  },
  dot:       { width: 5, height: 5, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.38)' },
  dotActive: { width: 18, backgroundColor: C.white },

  infoCard: {
    backgroundColor: C.card,
    borderBottomLeftRadius: 28, borderBottomRightRadius: 28,
    marginTop: -2,
    paddingHorizontal: 18, paddingTop: 20, paddingBottom: 18,
    shadowColor: C.shadow, shadowOpacity: 0.08, shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 }, elevation: 7,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.9)',
  },
  infoTopRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 10 },
  shopName: {
    fontSize: 22, fontWeight: '900', color: C.text,
    letterSpacing: -0.6, marginBottom: 7, lineHeight: 26,
    includeFontPadding: false,
    textShadowColor: 'rgba(11,54,40,0.06)',
    textShadowOffset: { width: 0, height: 3 },
    textShadowRadius: 8,
  },
  categoryPill: {
    alignSelf: 'flex-start', backgroundColor: C.primaryLight,
    borderRadius: 30, paddingHorizontal: 10, paddingVertical: 4,
    borderWidth: 1, borderColor: 'rgba(14,92,66,0.12)',
  },
  categoryPillText: {
    fontSize: 10, fontWeight: '700', color: C.primary,
    letterSpacing: 0.3, includeFontPadding: false,
  },
  statusChip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    borderRadius: 20, paddingHorizontal: 10, paddingVertical: 6,
    alignSelf: 'flex-start',
  },
  statusDot:  { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontSize: 11, fontWeight: '700', includeFontPadding: false },

  pulseDotRing: {
    position: 'absolute', width: 14, height: 14, borderRadius: 7,
    backgroundColor: 'rgba(45,216,130,0.22)',
  },
  pulseDotCore: {
    width: 6, height: 6, borderRadius: 3,
    backgroundColor: C.accent,
  },

  addrRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 5, marginBottom: 2 },
  addrText: { flex: 1, fontSize: 12.5, color: C.textLight, lineHeight: 18, includeFontPadding: false },
  timingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0F7F4',
    borderWidth: 1,
    borderColor: '#DDECE5',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginTop: 10,
    alignSelf: 'flex-start',
  },
  timingText: {
    fontSize: 12,
    fontWeight: '600',
    color: C.textMid,
    includeFontPadding: false,
  },
  timingHours: {
    fontWeight: '800',
    color: C.primary,
  },
  descBox: {
    marginTop: 8,
    padding: 10,
    backgroundColor: '#F7FAF8',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E6EFEA',
  },
  descLabel: {
    fontSize: 9,
    fontWeight: '900',
    color: C.primary,
    letterSpacing: 0.5,
    marginBottom: 3,
    includeFontPadding: false,
  },
  descText: {
    fontSize: 12,
    color: C.textMid,
    lineHeight: 17,
    includeFontPadding: false,
  },
  divider:  { height: 1, backgroundColor: C.border, marginVertical: 14 },

  actionsRow: { flexDirection: 'row', gap: 10 },
  actionBtn: {
    flex: 1, borderRadius: 16, overflow: 'hidden',
    shadowColor: C.shadow, shadowOpacity: 0.15, shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 }, elevation: 4,
  },
  actionBtnGrad: {
    alignItems: 'center', justifyContent: 'center',
    paddingVertical: 13, gap: 5,
  },
  actionBtnIcon: {
    width: 30, height: 30, borderRadius: 15,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center', justifyContent: 'center',
  },
  actionBtnDisabled: { opacity: 0.30 },
  actionBtnText: {
    color: C.white, fontSize: 10.5, fontWeight: '700',
    letterSpacing: 0.2, includeFontPadding: false,
  },

  section:     { marginTop: 12, paddingHorizontal: H_PAD },
  sectionHead: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 },
  sectionAccent: {
    width: 3, height: 16, borderRadius: 2, backgroundColor: C.primary,
  },
  sectionTitle: {
    flex: 1, fontSize: 15.5, fontWeight: '800', color: C.text,
    letterSpacing: -0.3, includeFontPadding: false,
  },
  itemCountPill: {
    backgroundColor: C.primaryLight, borderRadius: 20,
    paddingHorizontal: 10, paddingVertical: 3,
    borderWidth: 1, borderColor: 'rgba(14,92,66,0.14)',
  },
  itemCountText: { fontSize: 11, color: C.primary, fontWeight: '800', includeFontPadding: false },
  sparkleContainer: {
    flexDirection: 'row', gap: 4, alignItems: 'center',
  },
  proBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: C.goldLight, borderWidth: 1, borderColor: 'rgba(240,165,0,0.25)',
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20,
  },
  proBadgeText: { fontSize: 9, fontWeight: '800', color: C.gold, letterSpacing: 0.8, includeFontPadding: false },

  offerImage: { width: '100%', height: 120, borderRadius: 20 },
  offerCard: {
    height: 120, borderRadius: 20, padding: 20,
    flexDirection: 'row', alignItems: 'center', overflow: 'hidden',
  },
  offerDecorCircle: {
    position: 'absolute', right: -30, top: -30,
    width: 120, height: 120, borderRadius: 60,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  offerTitle:    { color: C.white, fontSize: 10, fontWeight: '700', letterSpacing: 1.5, opacity: 0.75, includeFontPadding: false },
  offerDiscount: { color: C.white, fontSize: 30, fontWeight: '900', letterSpacing: -1.5, marginTop: 2, includeFontPadding: false },
  offerSubtitle: { color: C.white, fontSize: 11, marginTop: 2, opacity: 0.85, includeFontPadding: false },
  offerBgIcon:   { position: 'absolute', right: 16, bottom: 10 },
  offerDots:     { flexDirection: 'row', justifyContent: 'center', marginTop: 10, gap: 5 },
  offerDot:      { width: 5, height: 5, borderRadius: 3, backgroundColor: C.border },
  offerDotActive:{ width: 16, backgroundColor: C.primary, borderRadius: 3 },

  searchBar: {
    flexDirection: 'row', alignItems: 'center', gap: 9,
    backgroundColor: C.white, borderRadius: 14,
    paddingHorizontal: 13,
    paddingVertical: Platform.OS === 'android' ? 8 : 12,
    marginBottom: 14, borderWidth: 1.5, borderColor: C.border,
    shadowColor: C.shadow, shadowOpacity: 0.04, shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 }, elevation: 2,
  },
  searchBarActive: {
    borderColor: C.primary,
    shadowColor: C.primary,
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 4,
  },
  searchInput: {
    flex: 1, fontSize: 13.5, color: C.text,
    paddingVertical: 0, includeFontPadding: false,
  },

  row: { flexDirection: 'row', gap: GAP, paddingHorizontal: H_PAD, marginBottom: GAP },
  itemCard: {
    width: ITEM_WIDTH, backgroundColor: C.card, borderRadius: 16, overflow: 'hidden',
    shadowColor: C.shadow, shadowOpacity: 0.09, shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 }, elevation: 6,
  },
  itemCardSpacer: { width: ITEM_WIDTH },
  itemImgWrap:    { position: 'relative' },
  itemImg:        { width: '100%', height: ITEM_WIDTH * 1.12 },
  itemImgGrad: {
    position: 'absolute', bottom: 0, left: 0, right: 0, height: '50%',
  },
  itemPriceBadge: {
    position: 'absolute', top: 8, right: 8,
    borderRadius: 10,
    paddingHorizontal: 9, paddingVertical: 4,
    shadowColor: C.shadow, shadowOpacity: 0.16, shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 }, elevation: 6,
  },
  itemPriceBadgeText: { color: C.white, fontSize: 10.5, fontWeight: '800', includeFontPadding: false },
  itemPhotoCountBadge: {
    position: 'absolute', top: 8, left: 8,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  itemPhotoCountText: {
    color: C.white,
    fontSize: 10,
    fontWeight: '700',
    includeFontPadding: false,
  },
  itemBody: { padding: 9 },
  modalThumbsRow: {
    flexDirection: 'row',
    marginTop: 18,
    gap: 10,
  },
  modalThumbWrap: {
    width: 60,
    height: 42,
    borderRadius: 10,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  modalThumbActive: {
    borderColor: C.primary,
  },
  modalThumb: {
    width: '100%',
    height: '100%',
  },
  itemName: { fontSize: 11.5, fontWeight: '700', color: C.text, lineHeight: 15, marginBottom: 3, includeFontPadding: false },
  itemDesc: { fontSize: 9.5, color: C.textLight, includeFontPadding: false },

  stockBadgeIn: {
    backgroundColor: C.success,
    paddingHorizontal: 9, paddingVertical: 5,
    borderRadius: 12, alignSelf: 'flex-start',
    shadowColor: C.success, shadowOpacity: 0.2, shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 }, elevation: 3,
  },
  stockBadgeLow: {
    backgroundColor: C.warning,
    paddingHorizontal: 9, paddingVertical: 5,
    borderRadius: 12, alignSelf: 'flex-start',
    shadowColor: C.warning, shadowOpacity: 0.2, shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 }, elevation: 3,
  },
  stockBadgeOut: {
    backgroundColor: C.error,
    paddingHorizontal: 9, paddingVertical: 5,
    borderRadius: 12, alignSelf: 'flex-start',
    shadowColor: C.error, shadowOpacity: 0.2, shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 }, elevation: 3,
  },
  stockBadgeText: {
    color: C.white, fontSize: 12, fontWeight: '800', includeFontPadding: false,
  },

  emptyWrap:    { alignItems: 'center', paddingVertical: 44, gap: 10, paddingHorizontal: H_PAD },
  emptyIconBox: {
    width: 68, height: 68, borderRadius: 22,
    backgroundColor: '#EEF2F0', alignItems: 'center', justifyContent: 'center',
  },
  emptyTitle:    { fontSize: 14, fontWeight: '800', color: C.textMid, includeFontPadding: false },
  emptySubtitle: { fontSize: 12, color: C.textLight, includeFontPadding: false },

  errorWrap: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    gap: 12, paddingHorizontal: 32, backgroundColor: C.bg,
  },
  errorIconBox: {
    width: 80, height: 80, borderRadius: 26,
    backgroundColor: '#F0F3F2', alignItems: 'center', justifyContent: 'center',
    marginBottom: 4,
    shadowColor: C.shadow, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2,
  },
  errorTitle: { fontSize: 17, fontWeight: '900', color: C.text, includeFontPadding: false },
  errorMsg:   { fontSize: 12.5, color: C.textLight, textAlign: 'center', lineHeight: 18, includeFontPadding: false },
  retryBtn:   { marginTop: 6, borderRadius: 16, overflow: 'hidden' },
  retryBtnGrad: { paddingHorizontal: 28, paddingVertical: 14 },
  retryBtnText: { color: C.white, fontWeight: '800', fontSize: 13, letterSpacing: 0.2, includeFontPadding: false },

  errorBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 7,
    backgroundColor: C.error, paddingHorizontal: 16, paddingVertical: 9,
  },
  errorBannerText: { flex: 1, color: C.white, fontSize: 12, fontWeight: '600', includeFontPadding: false },

  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.58)',
    justifyContent: 'center', alignItems: 'center', paddingHorizontal: 20,
  },
  modalCard: {
    width: '100%', backgroundColor: C.white, borderRadius: 24, overflow: 'hidden',
    shadowColor: C.shadow, shadowOpacity: 0.26, shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 }, elevation: 20,
  },
  modalImage: { width: '100%', height: 240 },
  carouselDots: {
    position: 'absolute', bottom: 8, left: 0, right: 0,
    flexDirection: 'row', justifyContent: 'center', gap: 5,
  },
  carouselDot: {
    width: 6, height: 6, borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.5)',
  },
  carouselDotActive: {
    backgroundColor: C.white,
    width: 16,
  },
  carouselArrow: {
    position: 'absolute', top: '50%', marginTop: -16,
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.9)',
    alignItems: 'center', justifyContent: 'center',
    shadowColor: C.shadow, shadowOpacity: 0.2, shadowRadius: 6, elevation: 4,
  },
  carouselArrowLeft: {
    left: 8,
  },
  carouselArrowRight: {
    right: 8,
  },
  carouselArrowText: {
    fontSize: 24, fontWeight: '700', color: C.text,
    includeFontPadding: false,
  },
  modalClose: {
    position: 'absolute', top: 12, right: 12,
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: C.white, alignItems: 'center', justifyContent: 'center',
    shadowColor: C.shadow, shadowOpacity: 0.14, shadowRadius: 6, elevation: 4,
  },
  modalBody: { padding: 18, gap: 8 },
  modalPriceChip: {
    alignSelf: 'flex-start',
    borderRadius: 12, paddingHorizontal: 12, paddingVertical: 6,
    borderWidth: 1, borderColor: 'rgba(14,92,66,0.15)',
  },
  modalPriceChipText: { fontSize: 15, fontWeight: '900', color: C.primary, includeFontPadding: false },
  modalName:  { fontSize: 18, fontWeight: '800', color: C.text, letterSpacing: -0.3, includeFontPadding: false, marginTop: 4 },
  modalDesc:  { fontSize: 13, color: C.textMid, lineHeight: 20, includeFontPadding: false },
  swipeHint:  { alignItems: 'center', paddingTop: 12 },
  swipeBar:   { width: 40, height: 3.5, borderRadius: 2, backgroundColor: C.border },
  heroDivider: {
    height: 1,
    backgroundColor: C.border,
    marginVertical: 12,
  },
  heroVerifyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FDFBF7',
    borderWidth: 1,
    borderColor: '#F0E5D3',
    paddingVertical: 10,
    borderRadius: 12,
  },
  heroVerifyText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#8B6508',
  },
  quoteBtn: {
    backgroundColor: '#25D366',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    paddingVertical: 11,
    marginTop: 10,
  },
  quoteBtnText: {
    color: C.white,
    fontSize: 12,
    fontWeight: '800',
    marginLeft: 6,
  },
});