/* ─────────────────────────────────────────────
   1. IMPORTS
───────────────────────────────────────────── */
import { AntDesign, Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import {
  Image,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

/* ─────────────────────────────────────────────
   2. LOGIC (Components)
───────────────────────────────────────────── */
const RoleCard = ({ icon, title, desc, onPress, bg }) => (
  <TouchableOpacity 
    style={styles.card} 
    activeOpacity={0.8} 
    onPress={onPress}
  >
    <View style={[styles.cardIcon, { backgroundColor: bg }]}>
      {icon}
    </View>

    <View style={styles.cardContent}>
      <Text style={styles.cardTitle}>{title}</Text>
      <Text style={styles.cardDesc}>{desc}</Text>
    </View>

    <AntDesign name="arrowright" size={18} color="#C1C7CD" />
  </TouchableOpacity>
);

export default function RoleScreen() {
  const router = useRouter();

  /* ─────────────────────────────────────────────
     3. UI RENDER
  ───────────────────────────────────────────── */
  return (
    <View style={styles.screenWrapper}>
      <StatusBar barStyle="light-content" backgroundColor="#000" />
      
      <SafeAreaView style={styles.container}>
        <View style={styles.topContent}>
          {/* LOGO SECTION */}
          <Image
            source={require('../assets/images/logo_black.png')}
            style={styles.logo}
          />

          <View style={styles.textGroup}>
            <Text style={styles.title}>Choose Your Path</Text>
            <Text style={styles.subtitle}>
              How would you like to use Dukan today?
            </Text>
          </View>

          {/* CUSTOMER CARD */}
          <RoleCard
            icon={<Feather name="shopping-bag" size={20} color="#064E3B" />}
            title="I'm a Customer"
            desc="Browse nearby shops and discover local deals."
            bg="#ECFDF5"
            onPress={() => router.push('/signup')}
          />

          {/* DIVIDER */}
          <View style={styles.divider}>
            <View style={styles.line} />
            <Text style={styles.orText}>OR</Text>
            <View style={styles.line} />
          </View>

          {/* MERCHANT CARD */}
          <RoleCard
            icon={<AntDesign name="shop" size={20} color="#064E3B" />}
            title="I'm a Merchant"
            desc="Grow your shop and connect with your community."
            bg="#F0FDF4"
            onPress={() => router.push('/merchant-signup')}
          />

          <TouchableOpacity
            style={styles.merchantLogin}
            onPress={() => router.push('/login')}
          >
            <Text style={styles.merchantLoginText}>
              Already a Seller Account? <Text style={styles.boldGreen}>Sign In</Text>
            </Text>
          </TouchableOpacity>
        </View>

        {/* FOOTER */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>
            Already have an account?{' '}
            <Text style={styles.link} onPress={() => router.push('/login')}>
              Sign In
            </Text>
          </Text>
        </View>
      </SafeAreaView>
    </View>
  );
}

/* ─────────────────────────────────────────────
   4. STYLES
───────────────────────────────────────────── */
const styles = StyleSheet.create({
  screenWrapper: { flex: 1, backgroundColor: '#000' },
  container: { 
    flex: 1, 
    backgroundColor: '#F9FAFB', 
    paddingHorizontal: 24,
    justifyContent: 'space-between'
  },

  topContent: {
    paddingTop: 60,
  },

  logo: {
    width: 60,
    height: 60,
    alignSelf: 'center',
    marginBottom: 30,
    resizeMode: 'contain',
  },

  textGroup: {
    alignItems: 'center',
    marginBottom: 40,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: '#111827',
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 15,
    textAlign: 'center',
    color: '#6B7280',
    marginTop: 8,
    lineHeight: 22,
    paddingHorizontal: 15,
  },

  // Role Card Styles
  card: {
    flexDirection: 'row',
    backgroundColor: '#FFF',
    padding: 18,
    borderRadius: 20,
    alignItems: 'center',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#F3F4F6',
    // Subtle shadow for depth
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  cardIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  cardContent: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
  },
  cardDesc: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 3,
    lineHeight: 18,
  },

  // Divider
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 15,
  },
  line: {
    flex: 1,
    height: 1,
    backgroundColor: '#E5E7EB',
  },
  orText: {
    marginHorizontal: 12,
    fontSize: 11,
    fontWeight: '700',
    color: '#9CA3AF',
  },

  merchantLogin: {
    marginTop: 15,
    alignItems: 'center',
  },
  merchantLoginText: {
    color: '#6B7280',
    fontSize: 13,
  },
  boldGreen: {
    color: '#064E3B',
    fontWeight: '700',
  },

  footer: {
    marginBottom: 30,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  footerText: {
    textAlign: 'center',
    fontSize: 14,
    color: '#6B7280',
  },
  link: {
    color: '#064E3B',
    fontWeight: '700',
  },
});