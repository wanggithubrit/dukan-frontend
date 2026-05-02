/* ─────────────────────────────────────────────
   1. IMPORTS
───────────────────────────────────────────── */
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
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
  InteractionManager,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { loadRewardedAd, showRewardedAd } from '../../utils/rewardedAd';

/* ─────────────────────────────────────────────
   2. CONSTANTS
───────────────────────────────────────────── */
const BASE_URL = 'https://api.mydukan.online';

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
    // No photo step for offers
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
  <TouchableOpacity style={styles.navTab} onPress={onPress} activeOpacity={0.7}>
    <Ionicons name={icon} size={22} color={active ? C.accent : '#bbb'} />
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

const CreditsChip = memo(({ credits, limitReached }) => (
  <View style={limitReached ? styles.creditsChipWarning : styles.creditsChip}>
    <Ionicons
      name={limitReached ? 'warning-outline' : 'flash-outline'}
      size={15}
      color={limitReached ? C.warning : C.accent}
    />
    <Text style={limitReached ? styles.creditsTextWarning : styles.creditsText}>
      {limitReached
        ? 'Item limit reached — watch an ad to get +1 free credit'
        : `${credits} credit${credits !== 1 ? 's' : ''} remaining`}
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
  const [loading, setLoading]   = useState(false);
  const [planData, setPlanData] = useState({ plan: null, stats: null });

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
    InteractionManager.runAfterInteractions(() => { loadRewardedAd(); });
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
      if (!user_id) return;
      const res  = await fetch(`${BASE_URL}/api/merchant/dashboard/${user_id}/`);
      const data = await res.json();
      if (isMounted.current) setPlanData({ plan: data.plan, stats: data.stats });
    } catch {}
  }, []);

  useEffect(() => { fetchPlan(); }, [fetchPlan]);

  const { plan, stats } = planData;
  const activeMode         = useMemo(() => MODES.find(m => m.key === mode), [mode]);
  const showPhotoStep      = !activeMode.hidePhoto;
  const isItemLimitReached = useMemo(() => plan?.type === 'free' && (stats?.items ?? 0) >= 15, [plan, stats]);
  const credits            = useMemo(() => plan?.credits ?? 0, [plan]);

  // Checklist per mode — offer has no photo check
  const checks = useMemo(() => {
    if (mode === 'cover') return [
      { done: !!image, label: 'Banner photo added' },
    ];
    if (mode === 'item') return [
      { done: !!form.name.trim(),  label: 'Item name entered' },
      { done: !!form.price.trim(), label: 'Price entered (₹)' },
      { done: !!image,             label: 'Photo added (optional)' },
    ];
    // offer
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

  // ── Image picker ──
  const pickImage = useCallback(() => {
    Alert.alert('Add Photo', 'Where do you want to pick the image from?', [
      {
        text: '📷  Camera',
        onPress: async () => {
          const perm = await ImagePicker.requestCameraPermissionsAsync();
          if (!perm.granted)
            return Alert.alert('Permission Needed', 'Please allow camera access in Settings.');
          const result = await ImagePicker.launchCameraAsync({
            quality: 0.85, allowsEditing: true, aspect: [4, 3],
          });
          if (!result.canceled && result.assets?.length > 0) setImage(result.assets[0]);
        },
      },
      {
        text: '🖼️  Photo Gallery',
        onPress: async () => {
          const result = await ImagePicker.launchImageLibraryAsync({
            quality: 0.85, allowsEditing: true, aspect: [4, 3],
          });
          if (!result.canceled && result.assets?.length > 0) setImage(result.assets[0]);
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

  const resetForm = useCallback(() => {
    setImage(null);
    dispatch({ type: 'RESET' });
  }, []);

  // ── Upload ──
  const upload = useCallback(async () => {
    if (loading) return;
    Keyboard.dismiss();

    const token = await AsyncStorage.getItem('access_token');
    if (!token) return Alert.alert('Session Expired', 'Please log in again.');

    if (mode === 'cover' && !image)
      return Alert.alert('Photo Required', 'Please add a banner image to continue.');
    if (mode === 'item' && !form.name.trim())
      return Alert.alert('Item Name Required', 'Please enter the item name.');
    if (mode === 'offer' && !form.title.trim())
      return Alert.alert('Offer Title Required', 'Please enter the offer title.');

    setLoading(true);
    try {
      const fd = new FormData();
      if (image) {
        fd.append('image', {
          uri:  Platform.OS === 'android' ? image.uri : image.uri.replace('file://', ''),
          name: 'upload.jpg',
          type: 'image/jpeg',
        });
      }
      if (mode === 'item') {
        fd.append('name', form.name.trim());
        if (form.price) fd.append('price', form.price);
      }
      if (mode === 'offer') {
        if (form.discount) fd.append('discount', form.discount);
        if (form.title)    fd.append('title',    form.title);
        if (form.subtitle) fd.append('subtitle', form.subtitle);
      }

      const res  = await fetch(`${BASE_URL}${ENDPOINTS[mode]}`, {
        method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: fd,
      });
      const data = await res.json();

      if (!res.ok) {
        if (res.status === 403 && data.error === 'limit_reached') {
          if (isMounted.current) setLoading(false);
          return Alert.alert(
            'Item Limit Reached',
            `You have ${credits} credit(s) left.\nWatch a short ad to earn +1 free credit.`,
            [
              {
                text: '▶  Watch Ad',
                onPress: () =>
                  showRewardedAd(async () => {
                    try {
                      await fetch(`${BASE_URL}/api/reward/`, {
                        method: 'POST', headers: { Authorization: `Bearer ${token}` },
                      });
                      upload();
                    } catch { Alert.alert('Error', 'Could not apply reward. Try again.'); }
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
  }, [loading, mode, image, form, credits, resetForm, fetchPlan, router]);

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
              <CreditsChip credits={credits} limitReached={isItemLimitReached} />
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

                <TouchableOpacity
                  style={styles.imagePicker}
                  onPress={pickImage}
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
                        <TouchableOpacity style={styles.imageChangeBtn} onPress={pickImage}>
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
                          keyboardType="default"   // 🔥 ADD THIS
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
              style={[styles.publishBtn, (!canPublish || loading) && styles.publishBtnDisabled]}
              onPress={upload}
              activeOpacity={0.85}
              disabled={loading}
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
        <NavBtn icon="home-outline"   label="Home"    onPress={goHome} />
        <NavBtn icon="grid-outline"   label="Items"   onPress={goItems} />
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
    backgroundColor: C.white,
    flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center',
    paddingVertical: 10, paddingBottom: 16,
    borderTopWidth: 0.5, borderColor: '#eee',
    elevation: 12,
  },
  navTab:         { alignItems: 'center', gap: 2 },
  navLabel:       { fontSize: 10, color: '#bbb', fontWeight: '500' },
  navLabelActive: { fontSize: 10, color: C.accent, fontWeight: '500' },
  addBtn: {
    width: 52, height: 52, borderRadius: 26,
    backgroundColor: C.accent,
    justifyContent: 'center', alignItems: 'center',
    elevation: 6,
    shadowColor: C.accent, shadowOpacity: 0.4, shadowRadius: 8,
    marginBottom: 8,
  },
});