import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect, useRouter } from 'expo-router';
import { memo, useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Platform,
  Pressable,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const BASE_URL = "https://api.mydukan.online";

const THEME = {
  bg: '#FFFFFF',
  surface: '#F1F5F2', // Soft Mint tint
  primary: '#064E3B', // Deep Emerald Black-Green
  accent: '#D1FAE5',  // Emerald Wash
  textMain: '#000000',
  textMuted: '#6B7280',
  border: '#F3F4F6',
  danger: '#BE123C',
};

const timeAgo = (iso) => {
  const diff = Math.floor((Date.now() - new Date(iso)) / 1000);
  if (diff < 60) return `Just now`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
};

/* ─── MEMOIZED FOR MAXIMUM FPS ─── */
const NotificationCard = memo(({ item, onPress, onDelete }) => (
  <Pressable
    onPress={() => onPress(item)}
    style={({ pressed }) => [
      styles.card,
      !item.is_read && styles.unreadCard,
      pressed && { transform: [{ scale: 0.98 }], opacity: 0.9 }
    ]}
  >
    <View style={styles.iconContainer}>
      <View style={[styles.statusIndicator, { backgroundColor: item.is_read ? 'transparent' : THEME.primary }]} />
      <View style={[styles.avatarCircle, !item.is_read && { backgroundColor: THEME.primary }]}>
        <Ionicons 
          name={item.is_read ? "mail-outline" : "mail-unread"} 
          size={20} 
          color={item.is_read ? THEME.primary : THEME.bg} 
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

    <TouchableOpacity onPress={() => onDelete(item.id)} style={styles.deleteZone} hitSlop={10}>
      <Ionicons name="close" size={18} color={THEME.textMuted} />
    </TouchableOpacity>
  </Pressable>
));
NotificationCard.displayName = 'NotificationCard';

export default function NotificationsScreen() {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  const fetchNotifications = useCallback(async () => {
    try {
      const user_id = await AsyncStorage.getItem('user_id');
      if (!user_id) return;
      const res = await fetch(`${BASE_URL}/api/notifications/${user_id}/`);
      const data = await res.json();
      setNotifications(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { fetchNotifications(); }, [fetchNotifications]));

  const handleClick = async (item) => {
    try {
      setNotifications(prev => prev.map(n => n.id === item.id ? { ...n, is_read: true } : n));
      await fetch(`${BASE_URL}/api/notification/read/${item.id}/`, { method: 'POST' });
      if (item.shop) router.push(`/shop/${item.shop}`);
    } catch (err) {
      console.error(err);
    }
  };

  const handleDelete = async (id) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
    fetch(`${BASE_URL}/api/notification/delete/${id}/`, { method: 'DELETE' }).catch(console.error);
  };

  const clearAll = () => {
    Alert.alert("Clear All", "Are you sure you want to wipe your activity log?", [
      { text: "Cancel", style: "cancel" },
      { text: "Clear All", style: "destructive", onPress: async () => {
          const user_id = await AsyncStorage.getItem('user_id');
          setNotifications([]);
          fetch(`${BASE_URL}/api/notifications/delete-all/${user_id}/`, { method: 'DELETE' }).catch(console.error);
        }
      }
    ]);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <StatusBar barStyle="dark-content" />
      
      <View style={styles.navBar}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={THEME.textMain} />
        </TouchableOpacity>
        <Text style={styles.navTitle}>Activity</Text>
        {notifications.length > 0 ? (
          <TouchableOpacity onPress={clearAll} style={styles.clearBtn}>
            <Text style={styles.clearTxt}>Clear All</Text>
          </TouchableOpacity>
        ) : <View style={{ width: 40 }} />}
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="small" color={THEME.primary} />
        </View>
      ) : notifications.length === 0 ? (
        <View style={styles.center}>
          <View style={styles.emptyIcon}>
            <Ionicons name="leaf" size={40} color={THEME.accent} />
          </View>
          <Text style={styles.emptyTitle}>Quiet in here...</Text>
          <Text style={styles.emptySub}>When you get notifications, {'they\'ll'} show up here.</Text>
        </View>
      ) : (
        <FlatList
          data={notifications}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => (
            <NotificationCard item={item} onPress={handleClick} onDelete={handleDelete} />
          )}
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
  clearTxt: { color: THEME.danger, fontSize: 12, fontWeight: '700', textTransform: 'uppercase' },
  
  list: { paddingHorizontal: 20, paddingTop: 10, paddingBottom: 40 },
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
      android: { elevation: 2 }
    })
  },
  unreadCard: { backgroundColor: '#F9FFF9', borderColor: THEME.primary + '10' },
  iconContainer: { position: 'relative', marginRight: 15 },
  statusIndicator: {
    position: 'absolute',
    top: -2,
    left: -2,
    zIndex: 1,
    width: 10,
    height: 10,
    borderRadius: 5,
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
  cardTitle: { fontSize: 15, fontWeight: '500', color: THEME.textMuted, flex: 1 },
  boldText: { color: THEME.textMain, fontWeight: '800' },
  timestamp: { fontSize: 11, color: THEME.textMuted, fontWeight: '600' },
  message: { fontSize: 14, color: THEME.textMuted, lineHeight: 19 },
  deleteZone: { paddingLeft: 10 },
  
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 50 },
  emptyIcon: { width: 80, height: 80, borderRadius: 40, backgroundColor: THEME.surface, justifyContent: 'center', alignItems: 'center', marginBottom: 20 },
  emptyTitle: { fontSize: 20, fontWeight: '800', color: THEME.textMain },
  emptySub: { fontSize: 15, color: THEME.textMuted, textAlign: 'center', marginTop: 8, lineHeight: 22 },
});