import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect, useRouter } from 'expo-router';
import { memo, useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Platform,
  Pressable,
  RefreshControl,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const BASE_URL = 'https://dukan-backend-0cc9.onrender.com';

const THEME = {
  bg: '#FFFFFF',
  surface: '#F1F5F2',
  primary: '#064E3B',
  accent: '#D1FAE5',
  textMain: '#000000',
  textMuted: '#6B7280',
  border: '#F3F4F6',
  danger: '#BE123C',
};

// Optimization: Helper functions outside component to avoid re-allocation
const timeAgo = (iso) => {
  const diff = Math.floor((Date.now() - new Date(iso)) / 1000);
  if (diff < 60) return `Just now`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
};

/* ─── MEMOIZED ROW COMPONENT ─── */
const NotificationCard = memo(({ item, onPress, onDelete }) => {
  return (
    <Pressable
      onPress={() => onPress(item)}
      style={({ pressed }) => [
        styles.card,
        !item.is_read && styles.unreadCard,
        pressed && { opacity: 0.7, transform: [{ scale: 0.99 }] }
      ]}
    >
      <View style={styles.iconContainer}>
        {!item.is_read && <View style={styles.statusIndicator} />}
        <View style={styles.avatarCircle}>
          <Image 
            source={require('../assets/images/logo_green.png')} 
            style={{ width: 46, height: 46, borderRadius: 14 }}
            resizeMode="cover"
          />
        </View>
      </View>

      <View style={styles.content}>
        <View style={styles.row}>
          <Text style={[styles.cardTitle, !item.is_read && styles.boldText]} numberOfLines={1}>
            {item.title}
          </Text>
          <Text style={styles.timestamp}>{timeAgo(item.created_at)}</Text>
        </View>
        <Text style={styles.message} numberOfLines={2}>{item.message}</Text>
      </View>

      <TouchableOpacity onPress={() => onDelete(item.id)} style={styles.deleteZone} hitSlop={15}>
        <Ionicons name="close" size={18} color={THEME.textMuted} />
      </TouchableOpacity>
    </Pressable>
  );
});
NotificationCard.displayName = 'NotificationCard';

export default function NotificationsScreen() {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const userIdRef = useRef(null);
  const router = useRouter();

  // Load User ID once
  useEffect(() => {
    AsyncStorage.getItem('user_id').then(id => {
      userIdRef.current = id;
      fetchNotifications();
    });
  }, [fetchNotifications]);

  const fetchNotifications = useCallback(async (isRefresh = false) => {
    if (!userIdRef.current) return;
    if (isRefresh) setRefreshing(true);
    
    try {
      const res = await fetch(`${BASE_URL}/api/notifications/${userIdRef.current}/`);
      const data = await res.json();
      setNotifications(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Fetch Error:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchNotifications();
    }, [fetchNotifications])
  );

  const handleClick = useCallback(async (item) => {
    // Optimistic Update
    setNotifications(prev => prev.map(n => n.id === item.id ? { ...n, is_read: true } : n));
    
    try {
      await fetch(`${BASE_URL}/api/notification/read/${item.id}/`, { method: 'POST' });
      if (item.shop) router.push(`/shop/${item.shop}`);
    } catch (err) {
      console.error(err);
    }
  }, [router]);

  const handleDelete = useCallback((id) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
    fetch(`${BASE_URL}/api/notification/delete/${id}/`, { method: 'DELETE' }).catch(console.error);
  }, []);

  const clearAll = () => {
    Alert.alert("Clear All", "Wipe your activity log?", [
      { text: "Cancel", style: "cancel" },
      { text: "Clear All", style: "destructive", onPress: async () => {
          setNotifications([]);
          fetch(`${BASE_URL}/api/notifications/delete-all/${userIdRef.current}/`, { method: 'DELETE' }).catch(console.error);
        }
      }
    ]);
  };

  // Rendering logic for Empty State
  const renderEmpty = () => (
    <View style={styles.center}>
      <View style={styles.emptyIcon}>
        <Image
          source={require('../assets/images/logo_green.png')} 
          style={styles.logoImage}
          resizeMode="contain"
        />
      </View>
      <Text style={styles.emptyTitle}>Quiet in here...</Text>
      <Text style={styles.emptySub}>When you get notifications, they will show up here.</Text>
    </View>
  );

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

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar barStyle="dark-content" />
      
      <View style={styles.navBar}>
        <TouchableOpacity onPress={handleBack} style={styles.backBtn} hitSlop={10}>
          <Ionicons name="arrow-back" size={24} color={THEME.textMain} />
        </TouchableOpacity>
        <Text style={styles.navTitle}>Activity</Text>
        {notifications.length > 0 ? (
          <TouchableOpacity onPress={clearAll} style={styles.clearBtn}>
            <Text style={styles.clearTxt}>Clear All</Text>
          </TouchableOpacity>
        ) : <View style={{ width: 40 }} />}
      </View>

      {loading && !refreshing ? (
        <View style={styles.center}><ActivityIndicator color={THEME.primary} /></View>
      ) : (
        <FlatList
          data={notifications}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <NotificationCard item={item} onPress={handleClick} onDelete={handleDelete} />
          )}
          ListEmptyComponent={renderEmpty}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => fetchNotifications(true)} tintColor={THEME.primary} />
          }
          // Performance props
          initialNumToRender={10}
          maxToRenderPerBatch={10}
          windowSize={5}
          removeClippedSubviews={Platform.OS === 'android'}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: THEME.bg },
  navBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 15,
  },
  navTitle: { fontSize: 22, fontWeight: '900', color: THEME.textMain, letterSpacing: -0.8 },
  backBtn: { padding: 4 },
  clearBtn: { backgroundColor: THEME.surface, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
  clearTxt: { color: THEME.danger, fontSize: 12, fontWeight: '700' },
  
  list: { paddingHorizontal: 20, paddingTop: 10, paddingBottom: 40, flexGrow: 1 },
  card: {
    flexDirection: 'row',
    backgroundColor: THEME.bg,
    padding: 16,
    borderRadius: 20,
    marginBottom: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: THEME.border,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 8 },
      android: { elevation: 1 }
    })
  },
  unreadCard: { backgroundColor: '#F9FFF9', borderColor: THEME.primary + '20' },
  iconContainer: { position: 'relative', marginRight: 15 },
  statusIndicator: {
    position: 'absolute',
    top: -2,
    right: -2,
    zIndex: 2,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: THEME.primary,
    borderWidth: 2,
    borderColor: THEME.bg,
  },
  avatarCircle: {
    width: 46,
    height: 46,
    borderRadius: 14,
    backgroundColor: THEME.surface,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: { flex: 1 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 },
  cardTitle: { fontSize: 15, color: THEME.textMuted, flex: 1 },
  boldText: { color: THEME.textMain, fontWeight: '800' },
  timestamp: { fontSize: 11, color: THEME.textMuted },
  message: { fontSize: 14, color: THEME.textMuted, lineHeight: 19 },
  deleteZone: { paddingLeft: 10 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 50 },
  emptyTitle: { fontSize: 20, fontWeight: '800', color: THEME.textMain, marginTop: 10 },
  emptySub: { fontSize: 15, color: THEME.textMuted, textAlign: 'center', marginTop: 8 },
  emptyIcon: {
    width: 100,
    height: 100,
    borderRadius: 25,
    backgroundColor: THEME.surface,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  logoImage: { width: 60, height: 60 },
});