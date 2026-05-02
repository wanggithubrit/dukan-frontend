import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useCallback, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Image,
  InteractionManager,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AdBanner from '../../components/AdBanner';

const { width } = Dimensions.get('window');

const BASE_URL = "https://api.mydukan.online";

const POLL_MS   = 20_000; // background auto-refresh every 20s

// ─── helpers ──────────────────────────────────────────────────────────────────
const getImageUrl = (img) => {
  if (!img) return null;
  if (img.startsWith('http')) return img;
  return `${BASE_URL}${img.startsWith('/') ? '' : '/'}${img}`;
};

const getToken = () =>
  AsyncStorage.multiGet(['token', 'access_token']).then(
    ([[, t], [, at]]) => t || at
  );

// ─── sub-components (stable, no re-render churn) ──────────────────────────────
const Stat = React.memo(({ label, value, icon }) => (
  <View style={styles.statCard}>
    <View style={styles.statIconBox}>
      <Ionicons name={icon} size={16} color="#2F5D50" />
    </View>
    <View>
      <Text style={styles.statNumber}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  </View>
));
Stat.displayName = 'Stat';

const Action = React.memo(({ icon, label, onPress, highlight }) => (
  <TouchableOpacity
    style={[styles.actionCard, highlight && styles.actionCardHighlight]}
    onPress={onPress}
    activeOpacity={0.75}
  >
    <Ionicons name={icon} size={18} color={highlight ? '#fff' : '#2F5D50'} style={{ marginBottom: 4 }} />
    <Text style={[styles.actionText, highlight && styles.actionTextHighlight]}>{label}</Text>
  </TouchableOpacity>
));
Action.displayName = 'Action';

const NavBtn = React.memo(({ icon, label, onPress, active }) => (
  <TouchableOpacity style={styles.navTab} onPress={onPress} activeOpacity={0.7}>
    <Ionicons name={icon} size={22} color={active ? '#2F5D50' : '#bbb'} />
    <Text style={[styles.navLabel, active && { color: '#2F5D50' }]}>{label}</Text>
  </TouchableOpacity>
));
NavBtn.displayName = 'NavBtn';

const BannerCard = React.memo(({ b, onDelete }) => (
  <View style={styles.bannerWrapper}>
    {b.banner_type === 'image' && b.image ? (
      <>
        <Image source={{ uri: getImageUrl(b.image) }} style={styles.bannerImg} />
        <View style={styles.bannerGradientOverlay} />
        {(b.title || b.subtitle || b.discount != null) && (
          <View style={styles.bannerOverlay}>
            {b.small_text  && <Text style={styles.bannerSmall}>{b.small_text}</Text>}
            {b.title       && <Text style={styles.bannerTitle}>{b.title}</Text>}
            {b.discount != null && <Text style={styles.bannerDiscount}>{b.discount}% OFF</Text>}
            {b.subtitle    && <Text style={styles.bannerSub}>{b.subtitle}</Text>}
          </View>
        )}
      </>
    ) : (
      <View style={[styles.bannerTextCard, { backgroundColor: b.background_color || '#2F5D50' }]}>
        {b.small_text  && <Text style={styles.bannerSmall}>{b.small_text}</Text>}
        {b.title       && <Text style={styles.bannerTitle}>{b.title}</Text>}
        {b.discount != null && <Text style={styles.bannerDiscount}>{b.discount}% OFF</Text>}
        {b.subtitle    && <Text style={styles.bannerSub}>{b.subtitle}</Text>}
      </View>
    )}
    <TouchableOpacity style={styles.smallDeleteBadge} onPress={() => onDelete(b.id)}>
      <Ionicons name="close" size={14} color="#fff" />
    </TouchableOpacity>
  </View>
));
BannerCard.displayName = 'BannerCard';

const PostCard = React.memo(({ post, onDelete }) => (
  <View style={styles.postCard}>
    <Image source={{ uri: getImageUrl(post.image || post.media_url) }} style={styles.postImage} />
    <TouchableOpacity style={styles.postDeleteBadge} onPress={() => onDelete(post.id)}>
      <Ionicons name="trash-outline" size={12} color="#fff" />
    </TouchableOpacity>
  </View>
));
PostCard.displayName = 'PostCard';

// ─── main ─────────────────────────────────────────────────────────────────────
export default function MerchantHome() {
  const router = useRouter();

  const [shop,     setShop]     = useState(null);
  const [posts,    setPosts]    = useState([]);
  const [banners,  setBanners]  = useState([]);
  const [stats,    setStats]    = useState({ posts: 0, followers: 0 });
  const [loading,  setLoading]  = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [togglingStatus, setTogglingStatus] = useState(false);

  const pollTimer  = useRef(null);
  const isFetching = useRef(false); // prevent overlapping fetches

  // ─── core fetch (silent = no spinner, used for poll & focus) ────────────────
  const fetchData = useCallback(async (silent = false) => {
    if (isFetching.current) return;
    isFetching.current = true;

    try {
      const [userId, token] = await Promise.all([
        AsyncStorage.getItem('user_id'),
        getToken(),
      ]);

      if (!userId || !token) { router.replace('/login'); return; }

      // fire dashboard + banners in parallel
      const [dashRes, bRes] = await Promise.all([
        fetch(`${BASE_URL}/api/merchant/dashboard/${userId}/`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch(`${BASE_URL}/api/merchant/banners/`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);

      const [data, bData] = await Promise.all([
        dashRes.json(),
        bRes.json(),
      ]);

      if (data?.shop) {
        const postsData = data.media || data.images || [];
        // batch all state updates into one render cycle
        React.startTransition(() => {
          setShop(data.shop);
          setPosts(postsData);
          setStats({ posts: postsData.length, followers: data.stats?.followers ?? 0 });
          setBanners(Array.isArray(bData) ? bData : []);
        });
      }
    } catch (_err) {
      if (!silent) console.log('❌ fetchData:', _err);
    } finally {
      isFetching.current = false;
      if (!silent) { setLoading(false); setRefreshing(false); }
      else          { setLoading(false); }
    }
  }, [router]);

  // ─── poll loop ───────────────────────────────────────────────────────────────
  const startPolling = useCallback(() => {
    stopPolling();
    pollTimer.current = setInterval(() => fetchData(true), POLL_MS);
  }, [fetchData]);

  const stopPolling = useCallback(() => {
    if (pollTimer.current) { clearInterval(pollTimer.current); pollTimer.current = null; }
  }, []);

  // ─── focus effect: fetch immediately, then start poll ────────────────────────
  useFocusEffect(
    useCallback(() => {
      const task = InteractionManager.runAfterInteractions(() => {
        fetchData(false);
        startPolling();
      });
      return () => { task.cancel(); stopPolling(); };
    }, [fetchData, startPolling, stopPolling])
  );

  // ─── pull-to-refresh ─────────────────────────────────────────────────────────
  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchData(false);
  }, [fetchData]);

  // ─── toggle open/close ───────────────────────────────────────────────────────
  const toggleStatus = useCallback(async () => {
    if (!shop?.id || togglingStatus) return;
    const newIsOpen = !shop.is_open;
    setShop(prev => ({ ...prev, is_open: newIsOpen })); // optimistic
    try {
      setTogglingStatus(true);
      const token = await getToken();
      await fetch(`${BASE_URL}/api/shop/status/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ shop_id: shop.id, status: newIsOpen ? 'open' : 'close' }),
      });
    } catch {
      setShop(prev => ({ ...prev, is_open: !newIsOpen })); // rollback
    } finally {
      setTogglingStatus(false);
    }
  }, [shop, togglingStatus]);

  // ─── delete helpers ──────────────────────────────────────────────────────────
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

  // ─── render ──────────────────────────────────────────────────────────────────
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
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#2F5D50"
            colors={['#2F5D50']}
          />
        }
      >
        {/* HEADER */}
        <View style={styles.header}>
          <View>
            <Text style={styles.welcomeText}>Hello,</Text>
            <Text style={styles.headerTitle}>Dashboard</Text>
          </View>
          <Image source={require('../../assets/images/logo_round.png')} style={styles.headerLogo} />
        </View>

        {/* SHOP CARD */}
        {shop && (
          <View style={styles.shopCard}>
            <View style={styles.shopAvatar}>
              <Text style={styles.shopAvatarText}>{shop.name?.[0]}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.shopName}>{shop.name}</Text>
              <View style={styles.statusRow}>
                <View style={[styles.statusDot, { backgroundColor: shop.is_open ? '#10B981' : '#ccc' }]} />
                <Text style={[styles.statusText, { color: shop.is_open ? '#10B981' : '#999' }]}>
                  {shop.is_open ? 'Accepting Customers' : 'Closed Temporarily'}
                </Text>
              </View>
            </View>
            <TouchableOpacity
              style={[styles.toggleBtn, { backgroundColor: shop.is_open ? '#FEF2F2' : '#F0FDF4' }]}
              onPress={toggleStatus}
              disabled={togglingStatus}
            >
              {togglingStatus
                ? <ActivityIndicator size="small" color="#2F5D50" />
                : <Text style={[styles.toggleBtnText, { color: shop.is_open ? '#EF4444' : '#2F5D50' }]}>
                    {shop.is_open ? 'Close' : 'Open'}
                  </Text>
              }
            </TouchableOpacity>
          </View>
        )}

        {/* STATS */}
        <View style={styles.statsRow}>
          <Stat label="Total Posts"  value={stats.posts}     icon="images-outline" />
          <Stat label="Followers"    value={stats.followers} icon="heart-outline"  />
        </View>

        {/* ACTIONS */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Manage Business</Text>
        </View>
        <View style={styles.actionsRow}>
          <Action icon="add-outline"        label="New Post"  highlight onPress={() => router.push('/merchant/create-post')} />
          <Action icon="storefront-outline" label="Store"               onPress={() => shop && router.push(`/shop/${shop.id}`)} />
          <Action icon="options-outline"    label="Settings"            onPress={() => router.push('/merchant/profile')} />
        </View>

        <AdBanner />

        {/* BANNERS */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Banners</Text>
          <Text style={styles.sectionCount}>{banners.length} Active</Text>
        </View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingLeft: 20 }}
          decelerationRate="fast"
        >
          {banners.map(b => (
            <BannerCard key={b.id} b={b} onDelete={deleteBanner} />
          ))}
        </ScrollView>

        {/* POSTS GRID */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Recent Gallery</Text>
          <Text style={styles.sectionCount}>{posts.length} Photos</Text>
        </View>
        {posts.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No shop media uploaded.</Text>
          </View>
        ) : (
          <View style={styles.grid}>
            {posts.map((post, index) => (
              <PostCard key={post.id ?? index} post={post} onDelete={deletePost} />
            ))}
          </View>
        )}
      </ScrollView>

      {/* FOOTER */}
      <View style={styles.footer}>
        <NavBtn icon="home"         label="Home"    active />
        <NavBtn icon="grid-outline" label="Items"   onPress={() => router.push('/merchant/items')} />
        <TouchableOpacity style={styles.addBtn} onPress={() => router.push('/merchant/create-post')} activeOpacity={0.85}>
          <Ionicons name="add" size={28} color="#fff" />
        </TouchableOpacity>
        <NavBtn icon="person-outline" label="Profile" onPress={() => router.push('/merchant/profile')} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: '#F8FAFA' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  header:       { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 10, alignItems: 'center' },
  welcomeText:  { fontSize: 14, color: '#666', fontWeight: '500' },
  headerTitle:  { fontSize: 26, fontWeight: '800', color: '#111', marginTop: -2 },
  headerLogo:   { width: 40, height: 40, borderRadius: 10 },

  shopCard: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff',
    marginHorizontal: 20, marginTop: 15, padding: 12, borderRadius: 16,
    borderWidth: 1, borderColor: '#EDF2F2', elevation: 2,
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 5,
  },
  shopAvatar:     { width: 44, height: 44, borderRadius: 12, backgroundColor: '#2F5D50', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  shopAvatarText: { fontSize: 18, fontWeight: 'bold', color: '#fff' },
  shopName:       { fontSize: 15, fontWeight: '700', color: '#111' },
  statusRow:      { flexDirection: 'row', alignItems: 'center', marginTop: 2, gap: 4 },
  statusDot:      { width: 6, height: 6, borderRadius: 3 },
  statusText:     { fontSize: 11, fontWeight: '500' },
  toggleBtn:      { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, minWidth: 52, alignItems: 'center' },
  toggleBtnText:  { fontWeight: '700', fontSize: 12 },

  statsRow: { flexDirection: 'row', marginHorizontal: 20, marginTop: 15, gap: 12 },
  statCard: { flex: 1, backgroundColor: '#fff', padding: 12, borderRadius: 14, flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderColor: '#EDF2F2' },
  statIconBox:  { width: 32, height: 32, borderRadius: 8, backgroundColor: '#F0F4F3', justifyContent: 'center', alignItems: 'center' },
  statNumber:   { fontSize: 16, fontWeight: '800', color: '#111' },
  statLabel:    { fontSize: 10, color: '#888', marginTop: -2 },

  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', paddingHorizontal: 20, marginTop: 20, marginBottom: 12 },
  sectionTitle:  { fontWeight: '800', fontSize: 16, color: '#111' },
  sectionCount:  { fontSize: 11, color: '#999', fontWeight: '600' },

  /* banners */
  bannerWrapper:        { width: 220, height: 90, marginRight: 12, borderRadius: 14, overflow: 'hidden', backgroundColor: '#eee', position: 'relative' },
  bannerImg:            { width: '100%', height: '100%', resizeMode: 'cover' },
  bannerGradientOverlay:{ ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.28)' },
  bannerOverlay:        { position: 'absolute', bottom: 8, left: 10, right: 10 },
  bannerTextCard:       { flex: 1, justifyContent: 'center', padding: 12 },
  bannerSmall:          { fontSize: 9,  color: '#ffffffaa', marginBottom: 1, letterSpacing: 0.5 },
  bannerTitle:          { fontSize: 13, fontWeight: '800', color: '#fff' },
  bannerDiscount:       { fontSize: 17, fontWeight: '900', color: '#fff', letterSpacing: -0.5, marginTop: 1 },
  bannerSub:            { fontSize: 10, color: '#ffffffcc', marginTop: 2 },

  /* gallery */
  grid:           { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 20, gap: 10 },
  postCard:       { width: (width - 50) / 2, height: 110, borderRadius: 12, overflow: 'hidden', backgroundColor: '#fff', position: 'relative', borderWidth: 1, borderColor: '#eee' },
  postImage:      { width: '100%', height: '100%', resizeMode: 'cover' },
  postDeleteBadge:{ position: 'absolute', top: 6, right: 6, backgroundColor: 'rgba(0,0,0,0.5)', width: 24, height: 24, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  smallDeleteBadge:{ position: 'absolute', top: 6, right: 6, backgroundColor: 'rgba(0,0,0,0.5)', width: 24, height: 24, borderRadius: 12, justifyContent: 'center', alignItems: 'center', zIndex: 5 },

  actionsRow:          { flexDirection: 'row', paddingHorizontal: 20, gap: 10 },
  actionCard:          { flex: 1, backgroundColor: '#fff', paddingVertical: 12, borderRadius: 12, alignItems: 'center', borderWidth: 1, borderColor: '#EDF2F2' },
  actionCardHighlight: { backgroundColor: '#2F5D50', borderColor: '#2F5D50' },
  actionText:          { fontSize: 11, fontWeight: '700', color: '#444' },
  actionTextHighlight: { color: '#fff' },

  emptyContainer: { padding: 30, alignItems: 'center' },
  emptyText:      { color: '#999', fontSize: 13 },

  footer: {
    position: 'absolute', bottom: 0, width: '100%',
    backgroundColor: '#fff', flexDirection: 'row',
    justifyContent: 'space-around', alignItems: 'center',
    paddingVertical: 10,
    paddingBottom: Platform.OS === 'ios' ? 24 : 16,
    borderTopWidth: 0.5, borderColor: '#eee', elevation: 12,
  },
  navTab:   { alignItems: 'center', gap: 2 },
  navLabel: { fontSize: 10, color: '#bbb', fontWeight: '500' },
  addBtn: {
    width: 52, height: 52, borderRadius: 26,
    backgroundColor: '#2F5D50', justifyContent: 'center', alignItems: 'center',
    elevation: 6, shadowColor: '#2F5D50', shadowOpacity: 0.4, shadowRadius: 8, marginBottom: 8,
  },
});