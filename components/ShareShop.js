import React, { useCallback, useRef } from 'react';
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  Share,
  Alert,
  Animated
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { trackShareEvent } from '../utils/shareAnalytics';

// Premium green styling matching MyDukan color palette
const C = {
  primary: '#0E5C42',
  primaryMid: '#1B7A58',
  white: '#FFFFFF',
  text: '#0D1B14',
  border: '#E4EDE8',
  success: '#169C53',
};

export default function ShareShop({ shop, customStyle }) {
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handlePressIn = useCallback(() => {
    Animated.spring(scaleAnim, {
      toValue: 0.95,
      useNativeDriver: true,
      speed: 100,
    }).start();
  }, [scaleAnim]);

  const handlePressOut = useCallback(() => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      useNativeDriver: true,
      speed: 60,
    }).start();
  }, [scaleAnim]);

  const handleShare = useCallback(async () => {
    if (!shop || !shop.name) {
      Alert.alert('Error', 'Unable to share shop due to missing details.');
      return;
    }

    // Analytics: Shop share button clicked
    await trackShareEvent('shop_share_button_clicked', shop);

    // Build future-proof extensibility fields
    const playStoreLink = 'https://play.google.com/store/apps/details?id=com.mydukan.dukanapp';
    const shopName = shop.name;
    const category = shop.category || 'Local Business';
    const address = shop.address || '';
    
    // Constructing the share message
    const message = [
      `🏪 Check out this shop on MyDukan`,
      `\nShop: ${shopName}`,
      `Link: https://mydukan.online/shop/${shop.id}`,
      address ? `Location: ${address}` : null,
      `Category: ${category}`,
      `\nDiscover products and connect with local businesses using MyDukan.`,
      `\nDownload MyDukan:`,
      playStoreLink
    ].filter(Boolean).join('\n');

    try {
      const result = await Share.share({
        message,
        title: `Share ${shopName}`,
      });

      if (result.action === Share.sharedAction) {
        // Analytics: Shop shared successfully
        await trackShareEvent('shop_shared_successfully', shop);
      } else if (result.action === Share.dismissedAction) {
        console.log('[Share] Sharing dismissed/cancelled.');
      }
    } catch (error) {
      console.error('[Share] Share failed with error:', error);
      Alert.alert('Sharing Failed', 'Could not open sharing panel. Please try again.');
    }
  }, [shop]);

  return (
    <Animated.View style={[{ transform: [{ scale: scaleAnim }] }, styles.container, customStyle]}>
      <TouchableOpacity
        style={styles.shareButton}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        onPress={handleShare}
        activeOpacity={0.9}
      >
        <Ionicons name="share-social-outline" size={18} color={C.white} style={styles.icon} />
        <Text style={styles.buttonText}>Share Shop</Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    marginVertical: 4,
  },
  shareButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: C.primary,
    paddingVertical: 14,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  icon: {
    marginRight: 8,
  },
  buttonText: {
    color: C.white,
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
});
