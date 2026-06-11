import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useRef, useEffect } from 'react';
import {
  Animated,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const C = {
  white:     '#FFFFFF',
  primary:    '#2F5D50',
  primaryLt:  '#3D7A68',
  accent:     '#7ECFB3',
  bg:         '#F4F7F6',
  card:       '#FFFFFF',
  cardBorder: '#E4EDE9',
  textHi:     '#0F1F1B',
  textMid:    '#6B8A82',
  textLo:     '#A0BAB4',
};

export default function AboutScreen() {
  const router = useRouter();
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 500,
      useNativeDriver: true,
    }).start();
  }, [fadeAnim]);

  return (
    <SafeAreaView style={s.safe} edges={['top', 'bottom']}>
      <StatusBar style="dark" />
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn} activeOpacity={0.7}>
          <Ionicons name="chevron-back" size={24} color={C.textHi} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>About Us</Text>
        <View style={{ width: 40 }} />
      </View>

      <Animated.ScrollView
        style={[s.scroll, { opacity: fadeAnim }]}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={s.content}
      >
        {/* LOGO BOX */}
        <View style={s.logoContainer}>
          <View style={s.logoWrapper}>
            <Image source={require('../assets/images/logo_green.png')} style={s.logoImage} />
          </View>
          <Text style={s.brandTitle}>
            my<Text style={{ color: C.textHi }}>dukan</Text>
          </Text>
          <Text style={s.tagline}>Your Neighborhood Marketplace</Text>
        </View>

        {/* MISSION CARD */}
        <View style={s.card}>
          <View style={s.iconTitleRow}>
            <View style={[s.iconBox, { backgroundColor: 'rgba(47,93,80,0.1)' }]}>
              <Ionicons name="compass" size={20} color={C.primary} />
            </View>
            <Text style={s.cardTitle}>Our Mission</Text>
          </View>
          <Text style={s.cardDesc}>
            mydukan is a hyperlocal marketplace designed to help people discover nearby shops, products, and offers in their community.
          </Text>
        </View>

        {/* CONNECTIVITY CARD */}
        <View style={s.card}>
          <View style={s.iconTitleRow}>
            <View style={[s.iconBox, { backgroundColor: 'rgba(126,207,179,0.15)' }]}>
              <Ionicons name="storefront" size={20} color={C.primaryLt} />
            </View>
            <Text style={s.cardTitle}>Hyperlocal Commerce</Text>
          </View>
          <Text style={s.cardDesc}>
            We believe small businesses are the backbone of every neighborhood. By helping local merchants showcase their products and services digitally, we aim to strengthen local economies and create more opportunities for growth.
          </Text>
        </View>

        {/* SUPPORT CARD */}
        <View style={s.card}>
          <View style={s.iconTitleRow}>
            <View style={[s.iconBox, { backgroundColor: 'rgba(59,130,246,0.1)' }]}>
              <Ionicons name="people" size={20} color="#3B82F6" />
            </View>
            <Text style={s.cardTitle}>Built for Communities</Text>
          </View>
          <Text style={s.cardDesc}>
            Whether you are looking for groceries, fashion, electronics, restaurants, or local services, mydukan brings local shopping closer to you with absolute simplicity and digital ease.
          </Text>
        </View>

        {/* DETAILS LIST */}
        <View style={s.detailsCard}>
          <View style={s.detailRow}>
            <Ionicons name="checkmark-circle" size={16} color={C.primary} style={{ marginRight: 8 }} />
            <Text style={s.detailText}>Discover nearby shops instantly</Text>
          </View>
          <View style={s.detailRow}>
            <Ionicons name="checkmark-circle" size={16} color={C.primary} style={{ marginRight: 8 }} />
            <Text style={s.detailText}>Browse products and active offers</Text>
          </View>
          <View style={s.detailRow}>
            <Ionicons name="checkmark-circle" size={16} color={C.primary} style={{ marginRight: 8 }} />
            <Text style={s.detailText}>Connect directly with local merchants</Text>
          </View>
        </View>

        <Text style={s.footerText}>Founded in Nagaland, built for local communities.</Text>
        <Text style={s.emailText}>dukanpersonal316@gmail.com</Text>
      </Animated.ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: C.bg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: C.cardBorder,
    backgroundColor: C.white,
  },
  backBtn: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 20,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: C.textHi,
  },
  scroll: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 40,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 28,
  },
  logoWrapper: {
    width: 80,
    height: 80,
    borderRadius: 22,
    backgroundColor: C.white,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: C.cardBorder,
    shadowColor: C.primary,
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
    marginBottom: 14,
  },
  logoImage: {
    width: 50,
    height: 50,
    resizeMode: 'contain',
  },
  brandTitle: {
    fontSize: 24,
    fontWeight: '900',
    color: C.primary,
    letterSpacing: -0.5,
  },
  tagline: {
    fontSize: 13,
    color: C.textMid,
    fontWeight: '500',
    marginTop: 4,
  },
  card: {
    backgroundColor: C.card,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: C.cardBorder,
    padding: 18,
    marginBottom: 16,
    shadowColor: C.primary,
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  iconTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  iconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: C.textHi,
  },
  cardDesc: {
    fontSize: 13,
    color: C.textMid,
    lineHeight: 20,
    fontWeight: '500',
  },
  detailsCard: {
    backgroundColor: C.card,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: C.cardBorder,
    padding: 18,
    marginBottom: 24,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 6,
  },
  detailText: {
    fontSize: 13,
    color: C.textHi,
    fontWeight: '600',
  },
  footerText: {
    textAlign: 'center',
    fontSize: 12,
    color: C.textMid,
    fontWeight: '600',
    marginTop: 10,
  },
  emailText: {
    textAlign: 'center',
    fontSize: 11,
    color: C.textLo,
    fontWeight: '500',
    marginTop: 6,
  },
});
