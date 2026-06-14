/* ─────────────────────────────────────────────
   1. IMPORTS
───────────────────────────────────────────── */
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import { compressImage, formatBytes } from '../../utils/imageCompressor';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Linking,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { showRewardedAd } from '../../utils/rewardedAd';


/* ─────────────────────────────────────────────
   2. CONSTANTS
───────────────────────────────────────────── */
const BASE_URL = 'https://dukan-backend-0cc9.onrender.com';

const C = Object.freeze({
  bg:            '#FFFFFF',
  surface:       '#F5F8F5',
  surfaceAlt:    '#EDF4ED',
  border:        '#D6E8D6',
  borderActive:  '#1A6B3A',
  accent:        '#2F5D50',
  accentSoft:    'rgba(47,93,80,0.08)',
  accentGlow:    'rgba(47,93,80,0.2)',
  success:       '#16A34A',
  successSoft:   'rgba(22,163,74,0.1)',
  warning:       '#D97706',
  warningSoft:   'rgba(217,119,6,0.1)',
  textPrimary:   '#0F2118',
  textSecondary: '#4A6B55',
  textMuted:     '#9AB5A0',
  white:         '#FFFFFF',
});

const MODES = Object.freeze([
  {
    key:           'cover',
    label:         'Shop cover photo',
    icon:          'image-outline',
    desc:          'Main banner image shown at top of your shop page',
    tip:           'Use a clear, high-quality photo. Horizontal (4:3) works best.',
    requiresImage: true,
  },
  {
    key:           'item',
    label:         'Add Items',
    icon:          'cube-outline',
    desc:          'Add a product to your shop listing',
    tip:           'Add a good photo + price. Items with photos sell 3× more.',
    requiresImage: false,
  },
  {
    key:           'offer',
    label:         'Add Offer',
    icon:          'pricetag-outline',
    desc:          'Promote a discount or sale to your customers',
    tip:           'Short, clear offer titles grab attention fast.',
    requiresImage: false,
    hidePhoto:     true,
  },
]);

const ENDPOINTS = Object.freeze({
  cover: '/api/shop/media/upload/',
  item:  '/api/items/create/',
  offer: '/api/banner/upload/',
});

/* ─────────────────────────────────────────────
   3. FORM REDUCER
───────────────────────────────────────────── */
const initialForm = { name: '', price: '', discount: '', title: '', subtitle: '' };

function formReducer(state, action) {
  if (action.type === 'SET')   return { ...state, [action.field]: action.value };
  if (action.type === 'RESET') return initialForm;
  return state;
}

/* ─────────────────────────────────────────────
   4. SUB-COMPONENTS
───────────────────────────────────────────── */

const NavBtn = memo(({ icon, label, onPress, active }) => (
  <TouchableOpacity
    style={[styles.navTab, active && styles.navTabActive]}
    onPress={onPress}
    activeOpacity={0.7}
  >
    <Ionicons name={icon} size={22} color={active ? '#00E676' : '#8E9A96'} />
    <Text style={active ? styles.navLabelActive : styles.navLabel}>{label}</Text>
  </TouchableOpacity>
));
NavBtn.displayName = 'NavBtn';

const ModeCard = memo(({ mode, isActive, onPress }) => {
  const scale = useRef(new Animated.Value(1)).current;

  const handlePress = useCallback(() => {
    Animated.sequence([
      Animated.timing(scale, { toValue: 0.96, duration: 60,  useNativeDriver: true }),
      Animated.timing(scale, { toValue: 1,    duration: 100, useNativeDriver: true }),
    ]).start();
    onPress(mode.key);
  }, [onPress, mode.key, scale]);

  return (
    <Animated.View style={[styles.modeCardWrap, { transform: [{ scale }] }]}>
      <TouchableOpacity
        onPress={handlePress}
        activeOpacity={0.85}
        style={[styles.modeCard, isActive && styles.modeCardActive]}
      >
        <View style={[styles.modeCardIconBox, isActive && styles.modeCardIconBoxActive]}>
          <Ionicons name={mode.icon} size={22} color={isActive ? C.white : C.textMuted} />
        </View>
        <Text style={isActive ? styles.modeCardLabelActive : styles.modeCardLabel}>
          {mode.label}
        </Text>
        {isActive && (
          <View style={styles.modeCardCheck}>
            <Ionicons name="checkmark-circle" size={16} color={C.accent} />
          </View>
        )}
      </TouchableOpacity>
    </Animated.View>
  );
});
ModeCard.displayName = 'ModeCard';

const FieldLabel = memo(({ children, required, hint }) => (
  <View style={styles.fieldLabelRow}>
    <Text style={styles.fieldLabel}>{children}</Text>
    {required && <Text style={styles.requiredBadge}>Required</Text>}
    {hint && <Text style={styles.fieldHint}>{hint}</Text>}
  </View>
));
FieldLabel.displayName = 'FieldLabel';

const StyledInput = memo(({ label, required, iconName, prefix, hint, ...props }) => {
  const [focused, setFocused] = useState(false);
  const onFocus = useCallback(() => setFocused(true),  []);
  const onBlur  = useCallback(() => setFocused(false), []);

  return (
    <View style={styles.inputGroup}>
      {label && <FieldLabel required={required} hint={hint}>{label}</FieldLabel>}
      <View style={focused ? styles.inputWrapperFocused : styles.inputWrapper}>
        {iconName && (
          <Ionicons
            name={iconName}
            size={18}
            color={focused ? C.accent : C.textMuted}
            style={styles.inputIconMargin}
          />
        )}
        {prefix && (
          <Text style={[styles.inputPrefix, { color: focused ? C.accent : C.textMuted }]}>
            {prefix}
          </Text>
        )}
        <TextInput
          style={styles.input}
          placeholderTextColor={C.textMuted}
          onFocus={onFocus}
          onBlur={onBlur}
          {...props}
        />
      </View>
    </View>
  );
});
StyledInput.displayName = 'StyledInput';

const CreditsChip = memo(({ message, limitReached }) => (
  <View style={limitReached ? styles.creditsChipWarning : styles.creditsChip}>
    <Ionicons
      name={limitReached ? 'warning-outline' : 'flash-outline'}
      size={15}
      color={limitReached ? C.warning : C.accent}
    />
    <Text style={limitReached ? styles.creditsTextWarning : styles.creditsText}>
      {message}
    </Text>
  </View>
));
CreditsChip.displayName = 'CreditsChip';

const ImagePlaceholder = memo(({ optional }) => (
  <View style={styles.imagePlaceholder}>
    <View style={styles.imagePlaceholderIconBox}>
      <Ionicons name="camera-outline" size={30} color={C.accent} />
    </View>
    <Text style={styles.imagePlaceholderTitle}>Add Photo</Text>
    <Text style={styles.imagePlaceholderSub}>
      {optional ? 'Optional — tap to add from camera or gallery' : 'Tap to add from camera or gallery'}
    </Text>
  </View>
));
ImagePlaceholder.displayName = 'ImagePlaceholder';

const TipCard = memo(({ text }) => (
  <View style={styles.tipCard}>
    <Ionicons name="bulb-outline" size={16} color={C.warning} style={{ marginTop: 1 }} />
    <Text style={styles.tipText}>{text}</Text>
  </View>
));
TipCard.displayName = 'TipCard';

const ReadyItem = memo(({ done, label }) => (
  <View style={styles.readyItem}>
    <Ionicons
      name={done ? 'checkmark-circle' : 'ellipse-outline'}
      size={18}
      color={done ? C.success : C.textMuted}
    />
    <Text style={[styles.readyLabel, done && styles.readyLabelDone]}>{label}</Text>
  </View>
));
ReadyItem.displayName = 'ReadyItem';

/* ─────────────────────────────────────────────
   5. MAIN SCREEN
───────────────────────────────────────────── */
export default function CreatePost() {
  const router = useRouter();

  const [mode,    setModeState] = useState('cover');
  const [image,   setImage]     = useState(null);
  const [image2,  setImage2]    = useState(null);
  const [image3,  setImage3]    = useState(null);
  const [image4,  setImage4]    = useState(null);
  const [detailImage, setDetailImage] = useState(null);
  const [loading, setLoading]   = useState(false);
  const [notifyCustomers, setNotifyCustomers] = useState(true);
  const [planData, setPlanData] = useState({ plan: null, stats: null, credits: null });

  const [form, dispatch] = useReducer(formReducer, initialForm);

  const setField    = useCallback((field) => (value) => dispatch({ type: 'SET', field, value }), []);
  const setName     = useMemo(() => setField('name'),     [setField]);
  const setPrice    = useMemo(() => setField('price'),    [setField]);
  const setDiscount = useMemo(() => setField('discount'), [setField]);
  const setTitle    = useMemo(() => setField('title'),    [setField]);
  const setSubtitle = useMemo(() => setField('subtitle'), [setField]);

  const fadeAnim  = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;
  const isMounted = useRef(true);
  // ✅ FIX: ref to always hold the latest upload function, breaking stale closure
  const uploadRef = useRef(null);

  const animateInRef = useRef(null);
  
  animateInRef.current = () => {
    fadeAnim.setValue(0.3);
    slideAnim.setValue(14);
    Animated.parallel([
      Animated.timing(fadeAnim,  { toValue: 1, duration: 220, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 220, useNativeDriver: true }),
    ]).start();
  };

  useEffect(() => () => { isMounted.current = false; }, []);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim,  { toValue: 1, duration: 360, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 360, useNativeDriver: true }),
    ]).start();
  }, [fadeAnim, slideAnim]);

  const setMode = useCallback((key) => {
    setModeState(key);
    setImage(null);
    dispatch({ type: 'RESET' });
    animateInRef.current();
  }, []);

  const fetchPlan = useCallback(async () => {
    try {
      const user_id = await AsyncStorage.getItem('user_id');
      const token = await AsyncStorage.getItem('token') || await AsyncStorage.getItem('access_token');

      if (!user_id) return;

      const [dashRes, creditsRes] = await Promise.all([
        fetch(`${BASE_URL}/api/merchant/dashboard/${user_id}/`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        }),
        fetch(`${BASE_URL}/api/credits/status/`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        })
      ]);

      const dashData = await dashRes.json();
      const creditsData = await creditsRes.json();

      if (isMounted.current) {
        setPlanData({
          plan: dashData.plan,
          stats: dashData.stats,
          credits: creditsData,
        });
      }
    } catch (e) {
      console.log('FETCH PLAN ERROR:', e);
    }
  }, []);
  useEffect(() => { fetchPlan(); }, [fetchPlan]);

  const { plan, stats, credits } = planData;
  const activeMode         = useMemo(() => MODES.find(m => m.key === mode), [mode]);
  const showPhotoStep      = !activeMode.hidePhoto;
  const creditsRemaining   = useMemo(() => credits?.available_credits ?? 0, [credits]);
  const proLimit = credits?.pro_tier_limit ?? 120;
  const isProLimitReached = useMemo(() => credits?.is_pro && (stats?.items ?? 0) >= proLimit, [credits, stats, proLimit]);
  const isItemLimitReached = useMemo(() => {
    if (credits?.is_pro) return isProLimitReached;
    const limit = credits?.product_limit ?? 20;
    const currentCount = stats?.items ?? 0;
    return currentCount >= limit;
  }, [credits, stats, isProLimitReached]);
  const itemLimitMessage = useMemo(() => {
    if (credits?.is_pro && isProLimitReached) {
      return `Item limit reached — max ${proLimit} items. Contact support or send feedback to increase your limit.`;
    }
    return isItemLimitReached
      ? 'Item limit reached — watch an ad to get +1 free credit'
      : `${creditsRemaining} credit${creditsRemaining !== 1 ? 's' : ''} remaining`;
  }, [credits, creditsRemaining, isItemLimitReached, isProLimitReached, proLimit]);
  const publishDisabled = loading || (mode === 'item' && credits?.is_pro && isProLimitReached);

  const checks = useMemo(() => {
    if (mode === 'cover') return [
      { done: !!image, label: 'Banner photo added' },
    ];
    if (mode === 'item') return [
      { done: !!form.name.trim(),  label: 'Item name entered' },
      { done: !!form.price.trim(), label: 'Price entered (₹)' },
      { done: !!image,             label: 'Photo added (optional)' },
    ];
    return [
      { done: !!form.title.trim(),    label: 'Offer title entered' },
      { done: !!form.discount.trim(), label: 'Discount % or amount set' },
    ];
  }, [mode, form.name, form.price, form.title, form.discount, image]);

  const canPublish = useMemo(
    () => checks.filter(c => !c.label.includes('optional')).every(c => c.done),
    [checks]
  );

  const { doneCount, totalChecks } = useMemo(() => ({
    doneCount:   checks.reduce((n, c) => n + (c.done ? 1 : 0), 0),
    totalChecks: checks.length,
  }), [checks]);

  const pickImageIndexed = useCallback((setImageFn) => {
    Alert.alert('Add Photo', 'Where do you want to pick the image from?', [
      {
        text: '📷  Camera',
        onPress: async () => {
          const perm = await ImagePicker.requestCameraPermissionsAsync();
          if (!perm.granted)
            return Alert.alert('Permission Needed', 'Please allow camera access in Settings.');
          const result = await ImagePicker.launchCameraAsync({
            quality: 1.0, allowsEditing: true, aspect: [4, 3],
          });
          if (!result.canceled && result.assets?.length > 0) {
            try {
              const compressed = await compressImage(result.assets[0].uri);
              setImageFn(compressed);
            } catch (err) {
              Alert.alert('Compression Error', 'Could not compress camera photo.');
            }
          }
        },
      },
      {
        text: '🖼️  Photo Gallery',
        onPress: async () => {
          const result = await ImagePicker.launchImageLibraryAsync({
            quality: 1.0, allowsEditing: true, aspect: [4, 3],
          });
          if (!result.canceled && result.assets?.length > 0) {
            try {
              const compressed = await compressImage(result.assets[0].uri);
              setImageFn(compressed);
            } catch (err) {
              Alert.alert('Compression Error', 'Could not compress selected image.');
            }
          }
        },
      },
      { text: 'Cancel', style: 'cancel' },
    ]);
  }, []);

  const removeImage = useCallback(() => {
    Alert.alert('Remove Photo', 'Remove this image?', [
      { text: 'Remove', style: 'destructive', onPress: () => setImage(null) },
      { text: 'Keep', style: 'cancel' },
    ]);
  }, []);

  const removeDetailImage = useCallback(() => {
    Alert.alert('Remove Photo', 'Remove this detail image?', [
      { text: 'Remove', style: 'destructive', onPress: () => setDetailImage(null) },
      { text: 'Keep', style: 'cancel' },
    ]);
  }, []);

  const resetForm = useCallback(() => {
    setImage(null);
    setImage2(null);
    setImage3(null);
    setImage4(null);
    setDetailImage(null);
    setNotifyCustomers(true);
    dispatch({ type: 'RESET' });
  }, []);

  // ── Upload ──
  const upload = useCallback(async () => {
    if (loading) return;
    Keyboard.dismiss();

    const token = await AsyncStorage.getItem('token');
console.log('UPLOAD TOKEN:', token);
    
    if (!token) return Alert.alert('Session Expired', 'Please log in again.');

    const proLimit = credits?.pro_tier_limit ?? 120;
    if (mode === 'item' && credits?.is_pro && stats?.items >= proLimit) {
      return Alert.alert(
        'Item Limit Reached',
        `You have reached the maximum limit of ${proLimit} items on the Pro plan. To increase your limit further, please contact support or send us feedback.`,
        [
          {
            text: '📧 Email Support',
            onPress: () => Linking.openURL('mailto:dukanpersonal316@gmail.com?subject=Request More Product Slots'),
          },
          { text: 'Cancel', style: 'cancel' },
        ]
      );
    }

    if (mode === 'cover' && !image)
      return Alert.alert('Photo Required', 'Please add a banner image to continue.');
    if (mode === 'item' && !form.name.trim())
      return Alert.alert('Item Name Required', 'Please enter the item name.');
    if (mode === 'offer' && !form.title.trim())
      return Alert.alert('Offer Title Required', 'Please enter the offer title.');

    console.log('UPLOAD URL:', `${BASE_URL}${ENDPOINTS[mode]}`);
    console.log('TOKEN EXISTS:', !!token);
    console.log('MODE:', mode);
    console.log('IMAGE:', image);

    setLoading(true);
    try {
      const fd = new FormData();
      if (image) {
        if (image?.uri) {
          const filename = image.uri.split('/').pop() || 'photo.jpg';
          const ext = filename.split('.').pop()?.toLowerCase();
          let mime = 'image/jpeg';
          if (ext === 'png') mime = 'image/png';
          if (ext === 'webp') mime = 'image/webp';
          fd.append('image', {
            uri: image.uri,
            name: filename,
            type: mime,
          });
        }
      }
      if (mode === 'item' && credits?.is_pro) {
        if (image2 && image2.uri) {
          const filename = image2.uri.split('/').pop() || 'photo2.jpg';
          const ext = filename.split('.').pop()?.toLowerCase();
          let mime = 'image/jpeg';
          if (ext === 'png') mime = 'image/png';
          if (ext === 'webp') mime = 'image/webp';
          fd.append('image2', { uri: image2.uri, name: filename, type: mime });
        }
        if (image3 && image3.uri) {
          const filename = image3.uri.split('/').pop() || 'photo3.jpg';
          const ext = filename.split('.').pop()?.toLowerCase();
          let mime = 'image/jpeg';
          if (ext === 'png') mime = 'image/png';
          if (ext === 'webp') mime = 'image/webp';
          fd.append('image3', { uri: image3.uri, name: filename, type: mime });
        }
      }
      if (mode === 'item') {
        fd.append('name', form.name.trim());
        if (form.price) fd.append('price', form.price);
        const isPro = plan?.type === 'pro';
        fd.append('notify_customers', (isPro && notifyCustomers) ? 'true' : 'false');
      }
      if (mode === 'offer') {
        if (form.discount) fd.append('discount', form.discount);
        if (form.title)    fd.append('title',    form.title);
        if (form.subtitle) fd.append('subtitle', form.subtitle);
        if (detailImage && detailImage.uri && plan?.type === 'pro_plus') {
          const filename = detailImage.uri.split('/').pop() || 'detail_photo.jpg';
          const ext = filename.split('.').pop()?.toLowerCase();
          let mime = 'image/jpeg';
          if (ext === 'png') mime = 'image/png';
          if (ext === 'webp') mime = 'image/webp';
          fd.append('detail_image', { uri: detailImage.uri, name: filename, type: mime });
        }
      }

      const res  = await fetch(`${BASE_URL}${ENDPOINTS[mode]}`, {
        method: 'POST',headers: {
  Authorization: `Bearer ${token}`,
  Accept: 'application/json',
}, body: fd,
      });

      let data = {};
      try {
        data = await res.json();
      } catch (e) {
        console.log('NON JSON RESPONSE');
      }

      if (!res.ok) {
        if (res.status === 403 && data.error === 'limit_reached') {
          if (isMounted.current) setLoading(false);
          return Alert.alert(
            'Item Limit Reached',
            `You have reached your product limit of ${credits?.product_limit ?? 20} items.\nWatch a short ad to earn +1 free credit (current balance: ${creditsRemaining} Cr).`,
            [
              {
                text: '▶  Watch Ad',
                onPress: () =>
                  showRewardedAd(async () => {
                    try {
                      const rewardToken = await AsyncStorage.getItem('token') || await AsyncStorage.getItem('access_token');
                      const adRes = await fetch(`${BASE_URL}/api/credits/ad-complete/`, {
                        method: 'POST',
                        headers: {
                          'Content-Type': 'application/json',
                          Authorization: `Bearer ${rewardToken}`,
                        },
                        body: JSON.stringify({ ad_id: 'create_post_rewarded_watch_' + Date.now() })
                      });
                      const adData = await adRes.json();
                      if (!adRes.ok) {
                        Alert.alert('Error', adData.error || 'Failed to claim reward');
                        return;
                      }

                      // reset loading before retry
                      if (isMounted.current) setLoading(false);

                      // Refresh stats and credits
                      await fetchPlan();

                      // retry upload using latest function ref
                      setTimeout(() => {
                        uploadRef.current?.();
                      }, 50);
                    } catch {
                      Alert.alert('Error', 'Could not apply reward. Try again.');
                    }
                  }),
              },
              { text: 'Not Now', style: 'cancel' },
            ]
          );
        }
        throw new Error(data.error || 'Upload failed. Please try again.');
      }

      Alert.alert('🎉 Published!', 'Your content is now live on your shop.', [
        { text: 'Add Another', onPress: resetForm },
        { text: 'Done', onPress: () => router.push('/merchant/home') },
      ]);
      fetchPlan();
    } catch (err) {
      Alert.alert('Upload Failed', err.message);
    } finally {
      if (isMounted.current) setLoading(false);
    }
  }, [loading, mode, image, image2, image3, form, credits, creditsRemaining, resetForm, fetchPlan, router, notifyCustomers, plan, stats, detailImage]);

  // ✅ Keep uploadRef in sync with the latest upload function after every render.
  useEffect(() => {
    uploadRef.current = upload;
  }, [upload]);

  // ── Nav ──
  const goHome    = useCallback(() => router.push('/merchant/home'),        [router]);
  const goItems   = useCallback(() => router.push('/merchant/items'),       [router]);
  const goCreate  = useCallback(() => router.push('/merchant/create-post'), [router]);
  const goProfile = useCallback(() => router.push('/merchant/profile'),     [router]);
  const goBack    = useCallback(() => router.back(),                        [router]);

  /* ─────────────────────────────────────────────
     6. RENDER
  ───────────────────────────────────────────── */
  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* ── Header ── */}
        <View style={styles.header}>
          <TouchableOpacity onPress={goBack} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={20} color={C.accent} />
          </TouchableOpacity>
          <View style={styles.flex}>
            <Text style={styles.headerTitle}>Create Post</Text>
            <Text style={styles.headerSub}>Publish to your shop in seconds</Text>
          </View>
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* ── Step 1: Choose type ── */}
          <View style={styles.stepSection}>
            <View style={styles.stepHeader}>
              <View style={styles.stepBadge}><Text style={styles.stepBadgeText}>1</Text></View>
              <Text style={styles.stepTitle}>What do you want to post?</Text>
            </View>
            <View style={styles.modeCardRow}>
              {MODES.map(m => (
                <ModeCard key={m.key} mode={m} isActive={m.key === mode} onPress={setMode} />
              ))}
            </View>
            <Text style={styles.modeDesc}>{activeMode.desc}</Text>
          </View>

          <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>

            {/* Credits chip — items only */}
            {mode === 'item' && (
              <CreditsChip message={itemLimitMessage} limitReached={isItemLimitReached} />
            )}

            {/* ── Step 2: Photo (hidden for offer) ── */}
            {showPhotoStep && (
              <View style={styles.stepSection}>
                <View style={styles.stepHeader}>
                  <View style={styles.stepBadge}><Text style={styles.stepBadgeText}>2</Text></View>
                  <Text style={styles.stepTitle}>
                    Add Photo
                    {!activeMode.requiresImage && (
                      <Text style={styles.optionalLabel}> (optional)</Text>
                    )}
                  </Text>
                </View>

                {mode === 'item' && credits?.is_pro ? (
                  <View>
                    <View style={{ flexDirection: 'row', gap: 10, justifyContent: 'space-between' }}>
                      {[
                        { img: image, set: setImage, rem: () => setImage(null), label: 'Image 1' },
                        { img: image2, set: setImage2, rem: () => setImage2(null), label: 'Image 2' },
                        { img: image3, set: setImage3, rem: () => setImage3(null), label: 'Image 3' }
                      ].map((slot, index) => (
                        <TouchableOpacity
                          key={index}
                          style={[styles.imagePicker, { flex: 1, height: 110, marginHorizontal: 2 }]}
                          onPress={() => pickImageIndexed(slot.set)}
                          activeOpacity={0.82}
                        >
                          {slot.img ? (
                            <View style={{ width: '100%', height: '100%' }}>
                              <Image
                                source={{ uri: slot.img.uri }}
                                style={{ width: '100%', height: '100%', borderRadius: 12 }}
                                fadeDuration={0}
                              />
                              <TouchableOpacity
                                style={{ position: 'absolute', top: 5, right: 5, backgroundColor: 'rgba(239, 68, 68, 0.9)', borderRadius: 12, padding: 4 }}
                                onPress={slot.rem}
                              >
                                <Ionicons name="trash-outline" size={12} color="#fff" />
                              </TouchableOpacity>
                            </View>
                          ) : (
                            <View style={{ alignItems: 'center', justifyContent: 'center', flex: 1 }}>
                              <Ionicons name="camera-outline" size={20} color={C.accent} />
                              <Text style={{ fontSize: 10, fontWeight: '600', color: C.accent, marginTop: 4 }}>{slot.label}</Text>
                            </View>
                          )}
                        </TouchableOpacity>
                      ))}
                    </View>
                    {/* Compression stats for multi-images */}
                    <View style={{ marginTop: 8 }}>
                      {[image, image2, image3].map((img, idx) => {
                        if (!img || img.originalSize === undefined) return null;
                        return (
                          <Text key={idx} style={styles.compressionStatsTextMini}>
                            Image {idx + 1}: {formatBytes(img.originalSize)} → {formatBytes(img.compressedSize)} (-{img.savedPercent}% saved)
                          </Text>
                        );
                      })}
                    </View>
                  </View>
                ) : (
                  <View>
                    {mode === 'offer' && plan?.type === 'pro_plus' ? (
                      <View style={{ gap: 16 }}>
                        {/* Minimal Banner */}
                        <View>
                          <Text style={{ fontSize: 13, fontWeight: '700', color: C.textSoft, marginBottom: 6 }}>
                            Minimal Banner Image (1600x500 px)
                          </Text>
                          <TouchableOpacity
                            style={[styles.imagePicker, { height: 120 }]}
                            onPress={() => pickImageIndexed(setImage)}
                            activeOpacity={0.82}
                          >
                            {image ? (
                              <View style={{ width: '100%', height: '100%' }}>
                                <Image
                                  source={{ uri: image.uri }}
                                  style={{ width: '100%', height: '100%', borderRadius: 12 }}
                                  resizeMode="cover"
                                  fadeDuration={0}
                                />
                                <View style={styles.imageOverlay}>
                                  <TouchableOpacity style={styles.imageChangeBtn} onPress={() => pickImageIndexed(setImage)}>
                                    <Ionicons name="camera-outline" size={14} color={C.textPrimary} />
                                    <Text style={styles.imageChangeBtnText}>Change</Text>
                                  </TouchableOpacity>
                                  <TouchableOpacity style={styles.imageRemoveBtn} onPress={removeImage}>
                                    <Ionicons name="trash-outline" size={14} color="#EF4444" />
                                  </TouchableOpacity>
                                </View>
                              </View>
                            ) : (
                              <ImagePlaceholder optional={false} />
                            )}
                          </TouchableOpacity>
                        </View>

                        {/* Detailed Banner */}
                        <View>
                          <Text style={{ fontSize: 13, fontWeight: '700', color: C.textSoft, marginBottom: 6 }}>
                            Detail Banner Image (Optional - Shown on Press)
                          </Text>
                          <TouchableOpacity
                            style={[styles.imagePicker, { height: 120 }]}
                            onPress={() => pickImageIndexed(setDetailImage)}
                            activeOpacity={0.82}
                          >
                            {detailImage ? (
                              <View style={{ width: '100%', height: '100%' }}>
                                <Image
                                  source={{ uri: detailImage.uri }}
                                  style={{ width: '100%', height: '100%', borderRadius: 12 }}
                                  resizeMode="contain"
                                  fadeDuration={0}
                                />
                                <View style={styles.imageOverlay}>
                                  <TouchableOpacity style={styles.imageChangeBtn} onPress={() => pickImageIndexed(setDetailImage)}>
                                    <Ionicons name="camera-outline" size={14} color={C.textPrimary} />
                                    <Text style={styles.imageChangeBtnText}>Change</Text>
                                  </TouchableOpacity>
                                  <TouchableOpacity style={styles.imageRemoveBtn} onPress={removeDetailImage}>
                                    <Ionicons name="trash-outline" size={14} color="#EF4444" />
                                  </TouchableOpacity>
                                </View>
                              </View>
                            ) : (
                              <ImagePlaceholder optional={true} />
                            )}
                          </TouchableOpacity>
                        </View>
                      </View>
                    ) : (
                      <TouchableOpacity
                        style={styles.imagePicker}
                        onPress={() => pickImageIndexed(setImage)}
                        activeOpacity={0.82}
                      >
                        {image ? (
                          <View>
                            <Image
                              source={{ uri: image.uri }}
                              style={styles.imagePreview}
                              fadeDuration={0}
                            />
                            <View style={styles.imageOverlay}>
                              <TouchableOpacity style={styles.imageChangeBtn} onPress={() => pickImageIndexed(setImage)}>
                                <Ionicons name="camera-outline" size={14} color={C.textPrimary} />
                                <Text style={styles.imageChangeBtnText}>Change</Text>
                              </TouchableOpacity>
                              <TouchableOpacity style={styles.imageRemoveBtn} onPress={removeImage}>
                                <Ionicons name="trash-outline" size={14} color="#EF4444" />
                              </TouchableOpacity>
                            </View>
                          </View>
                        ) : (
                          <ImagePlaceholder optional={!activeMode.requiresImage} />
                        )}
                      </TouchableOpacity>
                    )}
                    {image && image.originalSize !== undefined && (
                      <View style={styles.compressionStatsBox}>
                        <Ionicons name="sparkles" size={14} color={C.accent} style={{ marginRight: 6 }} />
                        <Text style={styles.compressionStatsText}>
                          WebP Compressed: {formatBytes(image.originalSize)} → {formatBytes(image.compressedSize)} (-{image.savedPercent}% saved)
                        </Text>
                      </View>
                    )}
                  </View>
                )}
              </View>
            )}

            {/* ── Step 3 (or 2 for offer): Details ── */}
            {(mode === 'item' || mode === 'offer') && (
              <View style={styles.stepSection}>
                <View style={styles.stepHeader}>
                  <View style={styles.stepBadge}>
                    <Text style={styles.stepBadgeText}>{showPhotoStep ? '3' : '2'}</Text>
                  </View>
                  <Text style={styles.stepTitle}>Enter Details</Text>
                </View>

                <View style={styles.fieldsCard}>
                  {mode === 'item' && (
                    <>
                      <StyledInput
                        label="Item Name"
                        required
                        iconName="cube-outline"
                        placeholder="e.g. Handmade Leather Wallet"
                        value={form.name}
                        onChangeText={setName}
                        returnKeyType="next"
                        autoCapitalize="words"
                      />
                      <StyledInput
                        label="Price"
                        prefix="₹"
                        placeholder="0.00"
                        value={form.price}
                        onChangeText={setPrice}
                        keyboardType="decimal-pad"
                        hint="Enter selling price in rupees"
                      />
                      {plan?.type === 'pro' && (
                        <View style={styles.switchRow}>
                          <Text style={styles.switchLabel}>Notify Customers</Text>
                          <Switch
                            value={notifyCustomers}
                            onValueChange={setNotifyCustomers}
                            trackColor={{ false: '#767577', true: '#2F5D50' }}
                            thumbColor={notifyCustomers ? '#fff' : '#f4f3f4'}
                          />
                        </View>
                      )}
                    </>
                  )}

                  {mode === 'offer' && (
                    <>
                      <StyledInput
                        label="Offer Title"
                        required
                        iconName="sparkles-outline"
                        placeholder="e.g. Diwali Sale, Weekend Special"
                        value={form.title}
                        onChangeText={setTitle}
                        autoCapitalize="words"
                      />
                      <StyledInput
                        label="Discount"
                        iconName="pricetag-outline"
                        placeholder="e.g. 20% OFF or ₹100 OFF"
                        value={form.discount}
                        onChangeText={setDiscount}
                        hint="Type exactly what customers will see"
                        keyboardType="default"
                      />
                      <StyledInput
                        label="Short Description"
                        iconName="text-outline"
                        placeholder="e.g. Valid till Sunday only"
                        value={form.subtitle}
                        onChangeText={setSubtitle}
                        autoCapitalize="sentences"
                      />
                    </>
                  )}
                </View>
              </View>
            )}

            {/* ── Tip card ── */}
            <TipCard text={activeMode.tip} />

            {/* ── Readiness checklist ── */}
            <View style={styles.readyCard}>
              <Text style={styles.readyTitle}>
                Ready to publish? ({doneCount}/{totalChecks})
              </Text>
              {checks.map((c, i) => (
                <ReadyItem key={i} done={c.done} label={c.label} />
              ))}
            </View>

            {/* ── Publish button ── */}
            <TouchableOpacity
              style={[styles.publishBtn, (!canPublish || publishDisabled) && styles.publishBtnDisabled]}
              onPress={upload}
              activeOpacity={0.85}
              disabled={publishDisabled}
            >
              {loading ? (
                <ActivityIndicator color={C.white} size="small" />
              ) : (
                <>
                  <Ionicons name="cloud-upload-outline" size={20} color={C.white} />
                  <Text style={styles.publishBtnText}>
                    {canPublish ? 'Publish Now' : 'Fill Required Fields'}
                  </Text>
                </>
              )}
            </TouchableOpacity>

            {/* Reset */}
            {(image || form.name || form.title) && (
              <TouchableOpacity style={styles.resetBtn} onPress={resetForm}>
                <Ionicons name="refresh-outline" size={14} color={C.textMuted} />
                <Text style={styles.resetBtnText}>Start over</Text>
              </TouchableOpacity>
            )}

          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* ── Footer nav ── */}
      <View style={styles.footer}>
        <NavBtn icon="home-outline" label="Home" onPress={goHome} />
        <NavBtn icon="grid-outline" label="Items" onPress={goItems} />
        <TouchableOpacity style={styles.addBtn} onPress={goCreate} activeOpacity={0.85}>
          <Ionicons name="add" size={28} color={C.white} />
        </TouchableOpacity>
        <NavBtn icon="person-outline" label="Profile" onPress={goProfile} />
      </View>
    </SafeAreaView>
  );
}

/* ─────────────────────────────────────────────
   7. STYLES
───────────────────────────────────────────── */
const styles = StyleSheet.create({
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 8,
    marginTop: 10,
    borderWidth: 1,
    borderColor: C.border,
  },
  switchLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: C.textPrimary,
  },
  flex:      { flex: 1 },
  container: { flex: 1, backgroundColor: C.bg },

  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 20, paddingVertical: 14,
    backgroundColor: C.bg,
    borderBottomWidth: 1, borderBottomColor: C.border,
    gap: 12,
  },
  backBtn: {
    width: 38, height: 38, borderRadius: 10,
    backgroundColor: C.surface,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: C.border,
  },
  headerTitle: { fontSize: 18, fontWeight: '800', color: C.textPrimary, letterSpacing: 0.1 },
  headerSub:   { fontSize: 12, color: C.textSecondary, marginTop: 1 },

  scroll:        { flex: 1, backgroundColor: C.bg },
  scrollContent: { padding: 20, paddingBottom: 120 },

  stepSection: { marginBottom: 22 },
  stepHeader:  { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  stepBadge: {
    width: 26, height: 26, borderRadius: 13,
    backgroundColor: C.accent,
    alignItems: 'center', justifyContent: 'center',
  },
  stepBadgeText: { fontSize: 13, fontWeight: '700', color: C.white },
  stepTitle:     { fontSize: 15, fontWeight: '700', color: C.textPrimary },
  optionalLabel: { fontSize: 13, fontWeight: '400', color: C.textMuted },

  modeCardRow:         { flexDirection: 'row', gap: 10, marginBottom: 8 },
  modeCardWrap:        { flex: 1 },
  modeCard: {
    alignItems: 'center', paddingVertical: 14, paddingHorizontal: 6,
    borderRadius: 14, backgroundColor: C.surface,
    borderWidth: 1.5, borderColor: C.border,
    position: 'relative',
  },
  modeCardActive:          { borderColor: C.accent, backgroundColor: C.accentSoft },
  modeCardIconBox: {
    width: 44, height: 44, borderRadius: 12,
    backgroundColor: C.border,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 6,
  },
  modeCardIconBoxActive:   { backgroundColor: C.accent },
  modeCardLabel:           { fontSize: 12, fontWeight: '600', color: C.textMuted,  textAlign: 'center' },
  modeCardLabelActive:     { fontSize: 12, fontWeight: '700', color: C.accent,     textAlign: 'center' },
  modeCardCheck:           { position: 'absolute', top: 6, right: 6 },
  modeDesc:                { fontSize: 13, color: C.textSecondary, paddingLeft: 2, lineHeight: 18 },

  creditsChip: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: C.accentSoft,
    borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10,
    marginBottom: 16, borderWidth: 1, borderColor: C.accentGlow,
  },
  creditsChipWarning: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: C.warningSoft,
    borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10,
    marginBottom: 16, borderWidth: 1, borderColor: 'rgba(217,119,6,0.25)',
  },
  creditsText:        { fontSize: 13, color: C.accent,  fontWeight: '600', flexShrink: 1 },
  creditsTextWarning: { fontSize: 13, color: C.warning, fontWeight: '600', flexShrink: 1 },

  imagePicker: {
    borderRadius: 16, overflow: 'hidden',
    borderWidth: 1.5, borderColor: C.border, borderStyle: 'dashed',
    backgroundColor: C.surface,
  },
  imagePlaceholder:        { height: 160, alignItems: 'center', justifyContent: 'center', gap: 6 },
  imagePlaceholderIconBox: {
    width: 60, height: 60, borderRadius: 16,
    backgroundColor: C.accentSoft,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 4, borderWidth: 1, borderColor: C.border,
  },
  imagePlaceholderTitle:   { fontSize: 15, fontWeight: '700', color: C.textPrimary },
  imagePlaceholderSub: {
    fontSize: 12, color: C.textSecondary,
    textAlign: 'center', paddingHorizontal: 24,
  },
  imagePreview:   { width: '100%', height: 200, resizeMode: 'cover' },
  imageOverlay: {
    position: 'absolute', bottom: 10, right: 10,
    flexDirection: 'row', gap: 8,
  },
  imageChangeBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: 'rgba(255,255,255,0.93)',
    borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6,
    borderWidth: 1, borderColor: C.border,
  },
  imageChangeBtnText: { fontSize: 12, color: C.textPrimary, fontWeight: '600' },
  imageRemoveBtn: {
    backgroundColor: 'rgba(255,255,255,0.93)',
    borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6,
    borderWidth: 1, borderColor: '#FECACA',
    alignItems: 'center', justifyContent: 'center',
  },

  fieldsCard: {
    backgroundColor: C.surface, borderRadius: 16,
    padding: 16, gap: 16,
    borderWidth: 1, borderColor: C.border,
  },

  inputGroup:    { gap: 6 },
  fieldLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  fieldLabel: {
    fontSize: 11, fontWeight: '700', color: C.textSecondary,
    textTransform: 'uppercase', letterSpacing: 0.7,
  },
  requiredBadge: {
    fontSize: 10, fontWeight: '700', color: C.white,
    backgroundColor: C.accent,
    paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4,
  },
  fieldHint:    { fontSize: 11, color: C.textMuted, fontStyle: 'italic' },
  inputWrapper: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: C.bg, borderRadius: 12,
    borderWidth: 1.5, borderColor: C.border,
    paddingHorizontal: 14, height: 52,
  },
  inputWrapperFocused: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: C.accentSoft, borderRadius: 12,
    borderWidth: 1.5, borderColor: C.borderActive,
    paddingHorizontal: 14, height: 52,
  },
  inputIconMargin: { marginRight: 8 },
  inputPrefix: { fontSize: 16, fontWeight: '700', marginRight: 4 },
  input: { flex: 1, fontSize: 15, color: C.textPrimary, fontWeight: '500' },

  tipCard: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10,
    backgroundColor: '#FFFBEB',
    borderRadius: 12, padding: 12, marginBottom: 16,
    borderWidth: 1, borderColor: '#FDE68A',
  },
  tipText: { flex: 1, fontSize: 13, color: '#92400E', lineHeight: 19 },

  readyCard: {
    backgroundColor: C.surface,
    borderRadius: 14, padding: 16, marginBottom: 20,
    borderWidth: 1, borderColor: C.border, gap: 10,
  },
  readyTitle:     { fontSize: 13, fontWeight: '700', color: C.textPrimary, marginBottom: 2 },
  readyItem:      { flexDirection: 'row', alignItems: 'center', gap: 10 },
  readyLabel:     { fontSize: 13, color: C.textMuted, fontWeight: '500' },
  readyLabelDone: { color: C.textPrimary },

  publishBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: C.accent, borderRadius: 16, height: 56, gap: 10,
    shadowColor: C.accent, shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.28, shadowRadius: 14, elevation: 6,
    marginBottom: 12,
  },
  publishBtnDisabled: {
    backgroundColor: C.textMuted,
    shadowOpacity: 0, elevation: 0, opacity: 0.6,
  },
  publishBtnText: { fontSize: 16, fontWeight: '700', color: C.white, letterSpacing: 0.3 },

  resetBtn: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'center', gap: 5, paddingVertical: 10,
  },
  resetBtnText: { fontSize: 13, color: C.textMuted, fontWeight: '500' },

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
  compressionStatsBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.accentSoft,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginTop: 8,
    borderWidth: 1,
    borderColor: C.border,
  },
  compressionStatsText: {
    fontSize: 12,
    color: C.accent,
    fontWeight: '600',
  },
  compressionStatsTextMini: {
    fontSize: 11,
    color: C.accent,
    fontWeight: '500',
    marginTop: 2,
  },
});