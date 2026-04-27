import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AdBanner from '../../components/AdBanner';
const BASE_URL = 'http://10.194.216.149:8000';


const fetchJSON = async (url, options = {}) => {
  const res = await fetch(url, options);
  if (!res.ok) throw new Error(`API Error: ${res.status}`);
  return res.json();
};

/* ─── Sub-components ─── */
const Stat = ({ label, value, icon }) => (
  <View style={styles.statCard}>
    <View style={styles.statIconBox}>
      <Ionicons name={icon} size={18} color="#2F5D50" />
    </View>
    <Text style={styles.statNumber}>{value}</Text>
    <Text style={styles.statLabel}>{label}</Text>
  </View>
);

const Action = ({ icon, label, onPress, highlight }) => (
  <TouchableOpacity
    style={[styles.actionCard, highlight && styles.actionCardHighlight]}
    onPress={onPress}
    activeOpacity={0.75}
  >
    <View style={[styles.actionIconBox, highlight && styles.actionIconBoxHighlight]}>
      <Ionicons name={icon} size={20} color={highlight ? '#fff' : '#2F5D50'} />
    </View>
    <Text style={[styles.actionText, highlight && styles.actionTextHighlight]}>{label}</Text>
  </TouchableOpacity>
);

const NavBtn = ({ icon, label, onPress, active }) => (
  <TouchableOpacity style={styles.navTab} onPress={onPress} activeOpacity={0.7}>
    <Ionicons name={icon} size={22} color={active ? '#2F5D50' : '#bbb'} />
    <Text style={[styles.navLabel, active && { color: '#2F5D50' }]}>{label}</Text>
  </TouchableOpacity>
);

/* ─── Main Screen ─── */
export default function MerchantHome() {
  const router = useRouter();

  const [shop, setShop] = useState(null);
  const [posts, setPosts] = useState([]);
  const [stats, setStats] = useState({ posts: 0, followers: 0 });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [togglingStatus, setTogglingStatus] = useState(false);

  /* ── Fetch dashboard ── */
  const fetchData = useCallback(async () => {
    try {
      const userId = await AsyncStorage.getItem('user_id');
      if (!userId) return;

      const data = await fetchJSON(`${BASE_URL}/api/merchant/dashboard/${userId}/`);

      setShop(data.shop);

      // ✅ FIX: try multiple possible keys the API might return
      const recentPosts =
        data.recent_posts ||
        data.posts ||
        data.media ||
        data.images ||
        [];

      setPosts(recentPosts);

      setStats({
        posts: data.stats?.posts ?? data.stats?.items ?? 0,
        followers: data.stats?.followers ?? 0,
      });
    } catch (err) {
      console.log('Dashboard error:', err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchData();
    }, [fetchData])
  );

  const onRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  /* ── Toggle open/closed ── */
  const toggleStatus = useCallback(async () => {
    if (!shop?.id || togglingStatus) return;

    // ✅ Optimistic update — flip immediately so UI feels instant
    const newIsOpen = !shop.is_open;
    setShop(prev => ({ ...prev, is_open: newIsOpen }));

    try {
      setTogglingStatus(true);
      const token = await AsyncStorage.getItem('access_token');
      if (!token) {
        // Revert if no token
        setShop(prev => ({ ...prev, is_open: !newIsOpen }));
        return;
      }

      const res = await fetch(`${BASE_URL}/api/shop/status/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          shop_id: shop.id,
          status: newIsOpen ? 'open' : 'close',
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        // Revert optimistic update on failure
        setShop(prev => ({ ...prev, is_open: !newIsOpen }));
        console.log('Toggle error:', data);
        return;
      }

      // ✅ Sync with server response if it returns is_open, else keep optimistic value
      if (typeof data.is_open === 'boolean') {
        setShop(prev => ({ ...prev, is_open: data.is_open }));
      }

    } catch (err) {
      // Revert on network error
      setShop(prev => ({ ...prev, is_open: !newIsOpen }));
      console.log('Toggle status error:', err);
    } finally {
      setTogglingStatus(false);
    }
  }, [shop, togglingStatus]);

  /* ── Image URL ── */
  const getImageUrl = useCallback((img) => {
    if (!img) return null;
    return img.startsWith('http') ? img : `${BASE_URL}${img}`;
  }, []);

  /* ── Loading ── */
  if (loading || !shop) {
    return (
      <SafeAreaView style={styles.safe}>
        <StatusBar style="dark" />
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#2F5D50" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="dark" />

      <ScrollView
        contentContainerStyle={{ paddingBottom: 110 }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#2F5D50" />}
      >

        {/* ── HEADER ── */}
        <View style={styles.header}>
          <View>
            <Text style={styles.headerTitle}>Dashboard</Text>
          </View>
          <Image
            source={require('../../assets/images/logo_round.png')}
            style={styles.headerLogo}
          />
        </View>

        {/* ── SHOP CARD ── */}
        <View style={styles.shopCard}>
          {/* Shop initial avatar */}
          <View style={styles.shopAvatar}>
            <Text style={styles.shopAvatarText}>{shop.name?.[0]?.toUpperCase()}</Text>
          </View>

          <View style={{ flex: 1 }}>
            <Text style={styles.shopName} numberOfLines={1}>{shop.name}</Text>
            <View style={styles.statusRow}>
              <View style={[styles.statusDot, { backgroundColor: shop.is_open ? '#2ecc71' : '#ccc' }]} />
              <Text style={[styles.statusText, { color: shop.is_open ? '#2ecc71' : '#999' }]}>
                {shop.is_open ? 'Open Now' : 'Closed'}
              </Text>
            </View>
          </View>

          <TouchableOpacity
            style={[
              styles.toggleBtn,
              { backgroundColor: shop.is_open ? '#fff0f0' : '#E8EFEA' },
            ]}
            onPress={toggleStatus}
            disabled={togglingStatus}
            activeOpacity={0.8}
          >
            {togglingStatus ? (
              <ActivityIndicator size="small" color="#2F5D50" />
            ) : (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                <Ionicons
                  name={shop.is_open ? 'lock-closed-outline' : 'storefront-outline'}
                  size={14}
                  color={shop.is_open ? '#e74c3c' : '#2F5D50'}
                />
                <Text style={[
                  styles.toggleBtnText,
                  { color: shop.is_open ? '#e74c3c' : '#2F5D50' }
                ]}>
                  {shop.is_open ? 'Close' : 'Open'}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        {/* ── FOLLOWER HIGHLIGHT ── */}
        <View style={styles.highlightCard}>
          <View style={styles.highlightIconBox}>
            <Ionicons name="people" size={18} color="#2F5D50" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.highlightTitle}>{stats.followers} people saved your shop</Text>
            <Text style={styles.highlightSub}>Keep posting to grow your audience</Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color="#2F5D50" />
        </View>

        {/* ── STATS ── */}
        <View style={styles.statsRow}>
          <Stat label="Posts" value={stats.posts} icon="newspaper-outline" />
          <Stat label="Followers" value={stats.followers} icon="people-outline" />
        </View>

        {/* ── QUICK ACTIONS ── */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
        </View>
        <View style={styles.actionsRow}>
          <Action
            icon="add-circle-outline"
            label="New Post"
            onPress={() => router.push('/merchant/create-post')}
            highlight
          />
          <Action
            icon="eye-outline"
            label="View Shop"
            onPress={() => router.push(`/shop/${shop.id}`)}
          />
          <Action
            icon="settings-outline"
            label="Manage"
            onPress={() => router.push('/merchant/profile')}
          />
        </View>
        <AdBanner/>

        {/* ── RECENT POSTS ── */}
        <View style={[styles.sectionHeader, { marginTop: 20 }]}>
          <Text style={styles.sectionTitle}>Recent Posts</Text>
          {posts.length > 0 && (
            <Text style={styles.sectionCount}>{posts.length} posts</Text>
          )}
        </View>

        {posts.length === 0 ? (
          <View style={styles.emptyContainer}>
            <View style={styles.emptyIconBox}>
              <Ionicons name="megaphone-outline" size={32} color="#2F5D50" />
            </View>
            <Text style={styles.emptyTitle}>No posts yet</Text>
            <Text style={styles.emptyText}>Share your first post to attract customers</Text>
            <TouchableOpacity
              style={styles.emptyBtn}
              onPress={() => router.push('/merchant/create-post')}
              activeOpacity={0.85}
            >
              <Ionicons name="add" size={16} color="#fff" />
              <Text style={styles.emptyBtnText}>Create Post</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.grid}>
            {posts.map((post, index) => {
              // ✅ FIX: handle both {image} and {media_url} and {url} fields
              const imageUrl = getImageUrl(post.image || post.media_url || post.url || post.cover_image);

              return (
                <TouchableOpacity
                  key={post.id ?? index}
                  style={styles.postCard}
                  activeOpacity={0.85}
                  onPress={() => router.push(`/shop/${shop.id}`)}
                >
                  {imageUrl ? (
                    <Image
                      source={{ uri: imageUrl }}
                      style={styles.postImage}
                      resizeMode="cover"
                    />
                  ) : (
                    // Fallback if no image
                    <View style={styles.postImageFallback}>
                      <Ionicons name="image-outline" size={28} color="#ccc" />
                    </View>
                  )}

                  {/* Post caption if available */}
                  {post.caption || post.description || post.text ? (
                    <View style={styles.postCaption}>
                      <Text style={styles.postCaptionText} numberOfLines={2}>
                        {post.caption || post.description || post.text}
                      </Text>
                    </View>
                  ) : null}
                </TouchableOpacity>
              );
            })}
          </View>
        )}

      </ScrollView>

      {/* ── FOOTER NAV ── */}
      <View style={styles.footer}>
        <NavBtn icon="home" label="Home" onPress={() => router.push('/merchant/home')} active />
        <NavBtn icon="grid-outline" label="Items" onPress={() => router.push('/merchant/items')} />
        <TouchableOpacity style={styles.addBtn} onPress={() => router.push('/merchant/create-post')} activeOpacity={0.85}>
          <Ionicons name="add" size={28} color="#fff" />
        </TouchableOpacity>
        <NavBtn icon="person-outline" label="Profile" onPress={() => router.push('/merchant/profile')} />
      </View>
    </SafeAreaView>
  );
}

/* ─── Styles ─── */
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F2F5F4' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingTop: 10,
    paddingBottom: 6,
  },
  headerSub: { fontSize: 12, color: '#aaa', fontWeight: '500' },
  headerTitle: { fontSize: 24, fontWeight: '800', color: '#1a1a1a' },
  headerLogo: { width: 42, height: 42, borderRadius: 12 },

  // Shop card
  shopCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginTop: 10,
    padding: 14,
    borderRadius: 20,
    elevation: 3,
    shadowColor: '#000',
    shadowOpacity: 0.07,
    shadowRadius: 10,
  },
  shopAvatar: {
    width: 52,
    height: 52,
    borderRadius: 14,
    backgroundColor: '#2F5D50',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  shopAvatarText: { fontSize: 22, fontWeight: '800', color: '#fff' },
  shopName: { fontSize: 16, fontWeight: '700', color: '#1a1a1a' },
  statusRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4, gap: 5 },
  statusDot: { width: 7, height: 7, borderRadius: 4 },
  statusText: { fontSize: 12, fontWeight: '600' },
  toggleBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
    minWidth: 72,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 36,
  },
  toggleBtnText: { fontWeight: '700', fontSize: 13 },

  // Highlight
  highlightCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E8F5E9',
    marginHorizontal: 16,
    marginTop: 12,
    padding: 14,
    borderRadius: 16,
    gap: 12,
  },
  highlightIconBox: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  highlightTitle: { fontWeight: '700', color: '#2F5D50', fontSize: 14 },
  highlightSub: { fontSize: 11, color: '#5a9e78', marginTop: 2 },

  // Stats
  statsRow: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginTop: 12,
    gap: 10,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#fff',
    padding: 14,
    borderRadius: 18,
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 8,
  },
  statIconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#E8EFEA',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
  },
  statNumber: { fontSize: 20, fontWeight: '800', color: '#1a1a1a' },
  statLabel: { fontSize: 11, color: '#888', marginTop: 2 },

  // Actions
  actionsRow: { flexDirection: 'row', paddingHorizontal: 16, marginTop: 6, gap: 10 },
  actionCard: {
    flex: 1,
    backgroundColor: '#fff',
    paddingVertical: 14,
    borderRadius: 16,
    alignItems: 'center',
    elevation: 2,
  },
  actionCardHighlight: { backgroundColor: '#2F5D50' },
  actionIconBox: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: '#E8EFEA',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
  },
  actionIconBoxHighlight: { backgroundColor: 'rgba(255,255,255,0.2)' },
  actionText: { fontSize: 11, fontWeight: '600', color: '#444' },
  actionTextHighlight: { color: '#fff' },

  // Section header
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    marginTop: 14,
    marginBottom: 10,
  },
  sectionTitle: { fontWeight: '700', fontSize: 15, color: '#1a1a1a' },
  sectionCount: { fontSize: 12, color: '#aaa' },

  // Posts grid
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 16,
    gap: 10,
  },
  postCard: {
    width: '47.5%',
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#fff',
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 8,
  },
  postImage: { width: '100%', height: 130 },
  postImageFallback: {
    width: '100%',
    height: 130,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  postCaption: { padding: 8 },
  postCaptionText: { fontSize: 11, color: '#555' },

  // Empty state
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 36,
    paddingHorizontal: 30,
  },
  emptyIconBox: {
    width: 72,
    height: 72,
    borderRadius: 20,
    backgroundColor: '#E8EFEA',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 14,
  },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: '#1a1a1a', marginBottom: 6 },
  emptyText: { fontSize: 13, color: '#aaa', textAlign: 'center', lineHeight: 20 },
  emptyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#2F5D50',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 12,
    marginTop: 18,
  },
  emptyBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },

  // Footer nav
  footer: {
    position: 'absolute',
    bottom: 0,
    width: '100%',
    backgroundColor: '#fff',
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingVertical: 10,
    paddingBottom: 16,
    borderTopWidth: 0.5,
    borderColor: '#eee',
    elevation: 12,
  },
  navTab: { alignItems: 'center', gap: 2 },
  navLabel: { fontSize: 10, color: '#bbb', fontWeight: '500' },
  addBtn: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#2F5D50',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 6,
    shadowColor: '#2F5D50',
    shadowOpacity: 0.4,
    shadowRadius: 8,
    marginBottom: 8,
  },
});
