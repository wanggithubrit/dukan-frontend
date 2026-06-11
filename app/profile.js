import { Ionicons } from '@expo/vector-icons';
import SupportMyDukan from '../components/SupportMyDukan';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Image } from 'expo-image';
import { usePathname, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Linking,
  Platform,
  Share,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Modal,
  Alert
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme, setTheme, THEMES } from '../utils/theme';
const BASE_URL = 'https://dukan-backend-0cc9.onrender.com';
// ── Palette ───────────────────────────────────────────────────────────────────
const DEFAULT_C = {
  white:     '#FFFFFF',   // ← add
  textMuted: '#9CAAA5',   // ← add
  surface:   '#FFFFFF', 
  primary:    '#2F5D50',
  primaryLt:  '#3D7A68',
  accent:     '#7ECFB3',
  bg:         '#F4F7F6',
  card:       '#FFFFFF',
  cardBorder: '#E4EDE9',
  textHi:     '#0F1F1B',
  textMid:    '#6B8A82',
  textLo:     '#A0BAB4',
  danger:     '#FF6B6B',
  green:      '#22C55E',
  blue:       '#3B82F6',
};

// ── Static (outside component — never recreated) ──────────────────────────────
const AVATARS = {
  male_1:   require('../assets/avatars/man.png'),
  male_2:   require('../assets/avatars/woman.png'),
  female_1: require('../assets/avatars/cat.png'),
  female_2: require('../assets/avatars/panda.png'),
};
const AVATAR_KEYS = Object.keys(AVATARS);

// ── MenuRow ───────────────────────────────────────────────────────────────────
function MenuRow({ icon, iconBg, iconColor, label, sublabel, onPress, last, rightEl }) {
  const scale = useRef(new Animated.Value(1)).current;
  const { theme: C } = useTheme();
  const s = getStyles(C);

  const handlePress = useCallback(() => {
    Animated.sequence([
      Animated.timing(scale, { toValue: 0.97, duration: 70, useNativeDriver: true }),
      Animated.timing(scale, { toValue: 1,    duration: 70, useNativeDriver: true }),
    ]).start();
    onPress?.();
  }, [scale, onPress]);

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <TouchableOpacity
        onPress={handlePress}
        activeOpacity={1}
        style={s.menuRow}
      >
        <View style={[s.menuIconBox, { backgroundColor: iconBg }]}>
          <Ionicons name={icon} size={17} color={iconColor} />
        </View>
        <View style={s.menuMeta}>
          <Text style={s.menuLabel}>{label}</Text>
          {sublabel ? <Text style={s.menuSub}>{sublabel}</Text> : null}
        </View>
        {rightEl ?? <Ionicons name="chevron-forward" size={15} color={C.textLo} />}
      </TouchableOpacity>
    </Animated.View>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function Profile() {
  const router   = useRouter();
  const pathname = usePathname();
  const { theme: C, themeKey } = useTheme();
  const s = getStyles(C);

  const [user,         setUser]         = useState(null);
  const [loading,      setLoading]      = useState(true);
  const [showFeedback, setShowFeedback] = useState(false);
  const [feedback,     setFeedback]     = useState('');
  const [sending,      setSending]      = useState(false);
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteLoading, setDeleteLoading] = useState(false);


  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    fetchProfile();
    Animated.timing(fadeAnim, { toValue: 1, duration: 450, useNativeDriver: true }).start();
  }, [fadeAnim, fetchProfile]);

  const fetchProfile = useCallback(async () => {
    try {
      const [user_id, savedAvatar] = await Promise.all([
        AsyncStorage.getItem('user_id'),
        AsyncStorage.getItem('avatar'),
      ]);
      const res  = await fetch(`${BASE_URL}/api/user/${user_id}/`);
      if (res.status === 401 || res.status === 404 || res.status === 500) {
        await AsyncStorage.clear();
        router.replace('/login');
        return;
      }
      if (!res.ok) return;
      const data = await res.json();
      setUser({ ...data, avatar: savedAvatar || data.avatar });
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, []);

  const updateAvatar = useCallback(async (key) => {
    if (!key) return;
    try {
      const token = await AsyncStorage.getItem('token');
      const res = await fetch(`${BASE_URL}/api/avatar/update/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ avatar: key }),
      });
      if (res.ok) {
        AsyncStorage.setItem('avatar', key);
        setUser(p => ({ ...p, avatar: key }));
      }
    } catch { /* silent */ }
  }, []);

  const handleLogout = useCallback(async () => {
    await AsyncStorage.clear();
    router.replace('/role');
  }, [router]);

  const handleDeleteAccount = useCallback(async () => {
    if (!deletePassword.trim()) {
      Alert.alert('Error', 'Please enter your password.');
      return;
    }
    setDeleteLoading(true);
    try {
      const token = await AsyncStorage.getItem('token');
      const res = await fetch(`${BASE_URL}/api/auth/delete/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ password: deletePassword })
      });
      const data = await res.json();
      if (res.ok) {
        setDeleteModalVisible(false);
        setDeletePassword('');
        Alert.alert('Deleted', 'Your account has been deleted successfully.', [
          { text: 'OK', onPress: () => handleLogout() }
        ]);
      } else {
        Alert.alert('Error', data.error || 'Failed to delete account');
      }
    } catch (err) {
      Alert.alert('Error', 'Network error. Please try again.');
    } finally {
      setDeleteLoading(false);
    }
  }, [deletePassword, handleLogout]);

  const toggleFeedback = useCallback(() => setShowFeedback(v => !v), []);

  const handleShareAppLink = useCallback(async () => {
    try {
      const playStoreLink = 'https://play.google.com/store/apps/details?id=com.mydukan.dukanapp';
      const message = `🏪 Discover local shops and items instantly with mydukan!\n\nDownload mydukan here:\n${playStoreLink}`;
      await Share.share({
        message,
        title: 'Share mydukan App',
      });
    } catch (error) {
      console.error('[Share App] Share failed:', error);
    }
  }, []);

  const submitFeedback = useCallback(async () => {
    if (!feedback.trim() || sending) return;
    setSending(true);
    try {
      const token = await AsyncStorage.getItem('access_token');
      const res = await fetch(`${BASE_URL}/api/feedback/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ message: feedback.trim() }),
      });
      if (res.ok) { setFeedback(''); setShowFeedback(false); }
    } catch { /* silent */ }
    finally { setSending(false); }
  }, [feedback, sending]);

  if (loading) {
    return (
      <View style={s.loader}>
        <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
        <ActivityIndicator size="large" color={C.accent} />
      </View>
    );
  }

  const avatar = user?.avatar || 'male_1';

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

      <Animated.ScrollView
        style={{ opacity: fadeAnim }}
        contentContainerStyle={s.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* TOP BAR */}
        <View style={s.topBar}>
          <Text style={s.screenTitle}>My Profile</Text>
          <TouchableOpacity onPress={handleLogout} style={s.logoutPill} activeOpacity={0.8}>
            <Ionicons name="log-out-outline" size={15} color={C.danger} />
            <Text style={s.logoutTxt}>Sign out</Text>
          </TouchableOpacity>
        </View>

        {/* HERO CARD */}
        <View style={s.heroCard}>
          <View style={s.heroAccentCircle} />
          <View style={s.heroInner}>
            <View style={s.heroAvatarWrap}>
              <Image source={AVATARS[avatar]} style={s.heroAvatar} />
              <View style={s.onlineDot} />
            </View>
            <View style={s.heroText}>
              <Text style={s.heroName}>{user?.username || 'Member'}</Text>
              <Text style={s.heroEmail} numberOfLines={1}>{user?.email || '—'}</Text>
            </View>
          </View>
          <View style={s.statsStrip}>
            <View style={s.statItem}>
              <Text style={s.statVal}>4</Text>
              <Text style={s.statLbl}>Avatars</Text>
            </View>
            <View style={s.statSep} />
            <View style={s.statItem}>
              <View style={s.activePill}>
                <View style={s.activeDot} />
                <Text style={s.activeText}>Active</Text>
              </View>
              <Text style={s.statLbl}>Status</Text>
            </View>
            <View style={s.statSep} />
            <View style={s.statItem}>
              <Text style={[s.statVal, { color: '#1a5a2dff' }]}>Free</Text>
              <Text style={s.statLbl}>Plan</Text>
            </View>
          </View>
        </View>

        {/* AVATAR PICKER */}
        <View style={s.section}>
          <Text style={s.sectionLabel}>CHOOSE AVATAR</Text>
          <View style={s.card}>
            <View style={s.avatarRow}>
              {AVATAR_KEYS.map((key, i) => (
                <TouchableOpacity
                  key={key}
                  onPress={() => updateAvatar(key)}
                  activeOpacity={0.85}
                  style={[
                    s.avatarBtn,
                    avatar === key && s.avatarBtnActive,
                    i < AVATAR_KEYS.length - 1 && { marginRight: 14 },
                  ]}
                >
                  <Image source={AVATARS[key]} style={s.avatarImg} />
                  {avatar === key && (
                    <View style={s.avatarTick}>
                      <Ionicons name="checkmark" size={9} color="#fff" />
                    </View>
                  )}
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>



        {/* ACCOUNT MENU */}
        <View style={s.section}>
          <Text style={s.sectionLabel}>ACCOUNT</Text>
          <View style={s.card}>
            <MenuRow
              icon="heart"
              iconColor="#1b7f34ff"
              iconBg="rgba(53,131,64,0.3)"
              label="Saved Shops"
              sublabel="Your favourite stores"
              onPress={() => router.push('/favorites')}
            />
            <View style={s.divider} />
            <MenuRow
              icon="share-social-outline"
              iconColor="#0F5C43"
              iconBg="rgba(14,92,67,0.15)"
              label="Share App Link"
              sublabel="Share mydukan app with friends"
              onPress={handleShareAppLink}
            />
            <View style={s.divider} />
            <MenuRow
              icon="information-circle-outline"
              iconColor="#2f5d50ff"
              iconBg="rgba(47,93,80,0.15)"
              label="About Us"
              sublabel="Learn more about mydukan"
              onPress={() => router.push('/about')}
            />
            <View style={s.divider} />
            <MenuRow
              icon="trash-outline"
              iconColor="#FF4B4B"
              iconBg="rgba(255,75,75,0.15)"
              label="Delete Account"
              sublabel="Permanently delete your profile"
              onPress={() => setDeleteModalVisible(true)}
              last={!showFeedback}
            />
            {showFeedback && (
              <View style={s.feedbackPanel}>
                <TextInput
                  placeholder="What's on your mind?"
                  placeholderTextColor={C.textLo}
                  value={feedback}
                  onChangeText={setFeedback}
                  multiline
                  style={s.feedbackInput}
                  selectionColor={C.primary}
                  underlineColorAndroid="transparent"
                />
                <TouchableOpacity
                  style={[s.sendBtn, (!feedback.trim() || sending) && s.sendBtnOff]}
                  onPress={submitFeedback}
                  disabled={!feedback.trim() || sending}
                  activeOpacity={0.85}
                >
                  {sending
                    ? <ActivityIndicator color="#fff" size="small" />
                    : <>
                        <Ionicons name="send" size={14} color="#fff" style={{ marginRight: 7 }} />
                        <Text style={s.sendBtnTxt}>Send Feedback</Text>
                      </>
                  }
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>



        {/* Delete Account Modal */}
        <Modal
          visible={deleteModalVisible}
          transparent
          animationType="fade"
          onRequestClose={() => {
            if (!deleteLoading) {
              setDeleteModalVisible(false);
              setDeletePassword('');
            }
          }}
        >
          <View style={s.modalOverlay}>
            <View style={s.modalCard}>
              {/* Alert Icon */}
              <View style={s.alertIconWrapper}>
                <Ionicons name="warning" size={32} color="#EF4444" />
              </View>

              <Text style={s.modalTitle}>Delete Your Account?</Text>
              <Text style={s.modalSub}>
                All your data, shops, favorites, and profile configurations will be permanently deleted. This action cannot be reversed.
              </Text>

              {/* Password Input with label */}
              <View style={s.formField}>
                <Text style={s.fieldLabel}>CONFIRM PASSWORD</Text>
                <TextInput
                  secureTextEntry
                  placeholder="••••••••"
                  placeholderTextColor="#A0BAB4"
                  value={deletePassword}
                  onChangeText={setDeletePassword}
                  style={s.modalInput}
                  selectionColor={C.primary}
                />
              </View>

              <View style={s.modalBtnRow}>
                <TouchableOpacity
                  style={[s.modalBtn, s.modalCancelBtn]}
                  onPress={() => {
                    setDeleteModalVisible(false);
                    setDeletePassword('');
                  }}
                  disabled={deleteLoading}
                  activeOpacity={0.8}
                >
                  <Text style={s.modalCancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[s.modalBtn, s.modalDeleteBtn]}
                  onPress={handleDeleteAccount}
                  disabled={deleteLoading || !deletePassword.trim()}
                  activeOpacity={0.8}
                >
                  {deleteLoading ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <Text style={s.modalDeleteText}>Confirm Delete</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* SOCIAL */}
        <View style={s.section}>
          <Text style={s.sectionLabel}>FOLLOW US</Text>
          <View style={s.socialRow}>
            <TouchableOpacity
              style={[s.socialCard, { marginRight: 12 }]}
              activeOpacity={0.85}
              onPress={() => Linking.openURL('https://www.instagram.com/mydukan.online/')}
            >
              <View style={[s.socialIcon, { backgroundColor: '#E1306C' }]}>
                <Ionicons name="logo-instagram" size={19} color="#fff" />
              </View>
              <View>
                <Text style={s.socialName}>Instagram</Text>
                <Text style={s.socialHandle}>@mydukan.online</Text>
              </View>
            </TouchableOpacity>
            <TouchableOpacity
              style={s.socialCard}
              activeOpacity={0.85}
              onPress={() => Linking.openURL('https://www.youtube.com/channel/UCL1BkfKBa89jjHgudjR8P7g')}
            >
              <View style={[s.socialIcon, { backgroundColor: '#FF0000' }]}>
                <Ionicons name="logo-youtube" size={19} color="#fff" />
              </View>
              <View style={{ flex: 1, paddingRight: 8 }}>
                <Text style={s.socialName}>YouTube</Text>
                <Text style={[s.socialHandle, { fontSize: 10 }]} numberOfLines={2}>Subscribe for tutorials and many more</Text>
              </View>
            </TouchableOpacity>
          </View>
        </View>

        <SupportMyDukan platform="customer" />

        <Text style={s.version}>dukanpersonal316@gmail.com</Text>
      </Animated.ScrollView>

      <View style={s.bottomNav}>
        {[
          { route: '/shop/home', icon: 'home',   iconOutline: 'home-outline',   label: 'Home'      },
          { route: '/favorites', icon: 'heart',  iconOutline: 'heart-outline',  label: 'Saved'     },
          { route: '/profile',   icon: 'person', iconOutline: 'person-outline', label: 'Profile'   },
        ].map(tab => {
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
                  size={20}
                  color={active ? C.white : C.textMuted}
                />
              </View>
              <Text style={[s.navLabel, active && s.navLabelActive]}>{tab.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const getStyles = (C) => StyleSheet.create({
  safe:   { flex: 1, backgroundColor: '#FFFFFF' },
  loader: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#FFFFFF' },
  scroll: { paddingBottom: 140 },

  // Top bar
  topBar: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 22, paddingTop: 18, paddingBottom: 22,
  },
  screenTitle: { fontSize: 26, fontWeight: '800', color: C.textHi, letterSpacing: -0.5 },
  logoutPill: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(255,107,107,0.1)',
    paddingHorizontal: 13, paddingVertical: 8, borderRadius: 20,
    borderWidth: 1, borderColor: 'rgba(255,107,107,0.18)',
  },
  logoutTxt: { color: C.danger, fontSize: 13, fontWeight: '600', marginLeft: 6 },

  // Hero card
  heroCard: {
    marginHorizontal: 20, backgroundColor: C.card,
    borderRadius: 24, borderWidth: 1, borderColor: C.cardBorder,
    overflow: 'hidden',
    shadowColor: C.primary, shadowOpacity: 0.08, shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 }, elevation: 4,
  },
  heroAccentCircle: {
    position: 'absolute', top: -40, right: -40,
    width: 140, height: 140, borderRadius: 70,
    backgroundColor: 'rgba(47,93,80,0.08)',
  },
  heroInner: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 22, paddingTop: 26, paddingBottom: 22,
  },
  heroAvatarWrap: { position: 'relative', marginRight: 16 },
  heroAvatar: {
    width: 76, height: 76, borderRadius: 38,
    borderWidth: 2.5, borderColor: C.primaryLt,
  },
  onlineDot: {
    position: 'absolute', bottom: 2, right: 2,
    width: 14, height: 14, borderRadius: 7,
    backgroundColor: C.green, borderWidth: 2.5, borderColor: '#fff',
  },
  heroText:  { flex: 1 },
  heroName:  { fontSize: 20, fontWeight: '700', color: C.textHi, marginBottom: 5, letterSpacing: -0.3 },
  heroEmail: { fontSize: 13, color: C.textMid },

  // Stats
  statsStrip: {
    flexDirection: 'row',
    borderTopWidth: 1, borderTopColor: C.cardBorder, paddingVertical: 16,
  },
  statItem:   { flex: 1, alignItems: 'center' },
  statVal:    { fontSize: 16, fontWeight: '700', color: C.textHi, marginBottom: 4 },
  statLbl:    { fontSize: 11, color: C.textMid, fontWeight: '500' },
  statSep:    { width: 1, backgroundColor: C.cardBorder },
  activePill: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  activeDot:  { width: 7, height: 7, borderRadius: 4, backgroundColor: C.green, marginRight: 5 },
  activeText: { fontSize: 15, fontWeight: '700', color: '#1a5a2dff' },

  // Section
  section:      { marginTop: 28, paddingHorizontal: 20 },
  sectionLabel: {
    fontSize: 11, fontWeight: '700', color: C.textLo,
    letterSpacing: 1.4, marginBottom: 10, marginLeft: 2,
  },

  // Card
  card: {
    backgroundColor: C.card, borderRadius: 20,
    borderWidth: 1, borderColor: C.cardBorder, overflow: 'hidden',
    shadowColor: C.primary, shadowOpacity: 0.06, shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 }, elevation: 3,
  },

  // Avatar picker
  avatarRow:       { flexDirection: 'row', justifyContent: 'center', padding: 20 },
  avatarBtn:       { borderRadius: 36, borderWidth: 2.5, borderColor: 'transparent', position: 'relative', padding: 3 },
  avatarBtnActive: { borderColor: C.accent, backgroundColor: 'rgba(126,207,179,0.1)' },
  avatarImg:       { width: 58, height: 58, borderRadius: 29 },
  avatarTick: {
    position: 'absolute', bottom: 1, right: 1,
    width: 18, height: 18, borderRadius: 9,
    backgroundColor: C.primary,
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 1.5, borderColor: '#fff',
  },

  // Menu row
  menuRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 18, paddingVertical: 15,
  },
  menuIconBox: {
    width: 36, height: 36, borderRadius: 11,
    justifyContent: 'center', alignItems: 'center', marginRight: 14,
  },
  menuMeta:  { flex: 1 },
  menuLabel: { fontSize: 15, fontWeight: '600', color: C.textHi, marginBottom: 2 },
  menuSub:   { fontSize: 12, color: C.textMid },
  divider:   { height: 1, backgroundColor: C.cardBorder },

  // Feedback
  feedbackPanel: {
    padding: 16, borderTopWidth: 1, borderTopColor: C.cardBorder,
    backgroundColor: '#F9FBFA',
  },
  feedbackInput: {
    backgroundColor: '#F4F7F6', borderRadius: 14,
    borderWidth: 1, borderColor: C.cardBorder,
    padding: 14, height: 110,
    textAlignVertical: 'top', fontSize: 14,
    color: C.textHi, lineHeight: 21,
  },
  sendBtn: {
    backgroundColor: C.primary, paddingVertical: 14,
    borderRadius: 14, marginTop: 12,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
  },
  sendBtnOff: { opacity: 0.4 },
  sendBtnTxt: { color: '#fff', fontWeight: '700', fontSize: 15 },

  // Social
  socialRow: { flexDirection: 'row' },
  socialCard: {
    flex: 1, backgroundColor: C.card, borderRadius: 20,
    borderWidth: 1, borderColor: C.cardBorder,
    flexDirection: 'row', alignItems: 'center', padding: 16,
  },
  socialIcon: {
    width: 40, height: 40, borderRadius: 12,
    justifyContent: 'center', alignItems: 'center', marginRight: 12,
  },
  socialName:   { fontSize: 14, fontWeight: '700', color: C.textHi, marginBottom: 2 },
  socialHandle: { fontSize: 11, color: C.textMid, fontWeight: '500' },

  // Version
  version: {
    textAlign: 'center', fontSize: 12,
    color: C.textLo, fontWeight: '500',
    marginTop: 30, letterSpacing: 0.5,
  },

 // ── Bottom nav ─────────────────────────────────────────────────────────────
   bottomNav: {
     position: 'absolute',
     bottom: 0,
     left: 0,
     right: 0,
     flexDirection: 'row',
     backgroundColor: C.surface,
     borderTopWidth: 0,
     paddingVertical: 10,
     paddingHorizontal: 10,
     paddingBottom: Platform.OS === 'ios' ? 24 : 10,
     justifyContent: 'space-around',
     alignItems: 'center',
     // shadow upward
     shadowColor: '#000',
     shadowOpacity: 0.08,
     shadowRadius: 16,
     shadowOffset: { width: 0, height: -4 },
     elevation: 12,
   },
   navTab: {
     alignItems: 'center',
     gap: 3,
     flex: 1,
     marginBottom: 5,
   },
   navIconWrap: {
     width: 42,
     height: 36,
     borderRadius: 18,
     alignItems: 'center',
     justifyContent: 'center',
   },
   navIconWrapActive: {
     backgroundColor: C.primary,
   },
   navLabel: {
     fontSize: 10,
     fontWeight: '600',
     color: C.textMuted,
   },
   navLabelActive: {
     color: C.primary,
   },
   // Modal styling
   modalOverlay: {
     flex: 1,
     backgroundColor: 'rgba(0, 0, 0, 0.5)',
     justifyContent: 'center',
     alignItems: 'center',
     padding: 20,
   },
   modalCard: {
     width: '100%',
     maxWidth: 340,
     backgroundColor: C.card,
     borderRadius: 24,
     padding: 24,
     alignItems: 'center',
     borderWidth: 1,
     borderColor: C.cardBorder,
     elevation: 5,
     shadowColor: '#000',
     shadowOpacity: 0.15,
     shadowRadius: 12,
     shadowOffset: { width: 0, height: 6 },
   },
   modalTitle: {
     fontSize: 18,
     fontWeight: '800',
     color: C.textHi,
     marginBottom: 8,
     textAlign: 'center',
   },
   modalSub: {
     fontSize: 13,
     color: C.textMid,
     textAlign: 'center',
     lineHeight: 18,
     marginBottom: 20,
   },
   modalInput: {
     width: '100%',
     backgroundColor: '#F4F7F6',
     borderWidth: 1,
     borderColor: C.cardBorder,
     borderRadius: 12,
     paddingHorizontal: 16,
     paddingVertical: 12,
     fontSize: 15,
     color: C.textHi,
     marginBottom: 20,
   },
   modalBtnRow: {
     flexDirection: 'row',
     width: '100%',
     gap: 12,
   },
   modalBtn: {
     flex: 1,
     paddingVertical: 14,
     borderRadius: 12,
     alignItems: 'center',
     justifyContent: 'center',
   },
   modalCancelBtn: {
     backgroundColor: C.surface,
     borderWidth: 1,
     borderColor: C.cardBorder,
   },
   modalCancelText: {
     fontSize: 14,
     fontWeight: '700',
     color: C.textMid,
   },
   modalDeleteBtn: {
     backgroundColor: C.danger,
   },
   modalDeleteText: {
     fontSize: 14,
     fontWeight: '700',
     color: '#FFF',
   },
   alertIconWrapper: {
     width: 60,
     height: 60,
     borderRadius: 30,
     backgroundColor: 'rgba(239, 68, 68, 0.1)',
     alignItems: 'center',
     justifyContent: 'center',
     marginBottom: 16,
   },
   formField: {
     width: '100%',
     marginBottom: 16,
   },
   fieldLabel: {
     fontSize: 10,
     fontWeight: '800',
     color: C.textMid,
     letterSpacing: 1,
     marginBottom: 6,
   },
});