import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Linking from 'expo-linking';
import { useRootNavigationState, useRouter } from 'expo-router';
import { useEffect } from 'react';
import {
    ActivityIndicator,
    StyleSheet,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { setupNotificationCategories, handleNotificationAction } from '../utils/pushNotificationScheduler';

// ─── AdMob initialization ────────────────────────────────────────────────────
let isMobileAdsInitialized = false;
const initializeMobileAds = async () => {
  if (isMobileAdsInitialized) return;
  try {
    const adsModule = await import('react-native-google-mobile-ads');
    const mobileAds = adsModule.default || adsModule.mobileAds;
    if (typeof mobileAds === 'function') {
      await mobileAds().initialize();
      isMobileAdsInitialized = true;
    } else {
      console.debug('[index] AdMob init failed: mobileAds is not a function');
    }
  } catch (_e) {
    console.debug('[index] AdMob init failed:', _e.message);
  }
};

// We lazy-require expo-notifications so a missing native module doesn't
// crash the entire file and swallow the default export.
try {
  const Notifications = require('expo-notifications');
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
    }),
  });
} catch (_e) {
  // expo-notifications native module not available (e.g. Expo Go).
  // App will still work; push notifications simply won't fire.
  console.debug('[index] expo-notifications unavailable:', _e.message);
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function Index() {
  const router = useRouter();
  const navigationState = useRootNavigationState();

  // ── 1. Init AdMob & Notification Categories (safe) ──
  useEffect(() => {
    initializeMobileAds();
    setupNotificationCategories();
  }, []);

  // ── 2. Main auth + notification redirect (sequential, no race) ───────────
  //
  // All redirect logic lives in ONE effect so there is a single decision point.
  // Order:
  //   a) If the app was opened by tapping a push notification → go to that shop
  //   b) Otherwise → check login state and route normally
  //
  useEffect(() => {
    if (!navigationState?.key) return; // router not ready yet

    let cancelled = false; // guard against unmount mid-async

    const bootstrap = async () => {
      // Small delay so the layout tree is fully mounted before any navigation
      await new Promise(r => setTimeout(r, 120));
      if (cancelled) return;

      // ── a) Check if app was cold-started via a notification tap ──
      try {
        const Notifications = require('expo-notifications');
        const response = await Notifications.getLastNotificationResponseAsync();
        if (!cancelled && response) {
          const categoryId = response.notification.request.content.categoryIdentifier;
          if (categoryId === 'shop_opening') {
            router.replace('/merchant/home?triggerAction=open');
            return;
          } else if (categoryId === 'shop_closing') {
            router.replace('/merchant/home?triggerAction=close');
            return;
          }
          const shopId = response.notification.request.content.data?.shop_id;
          if (shopId) {
            router.replace(`/shop/${shopId}`);
            return; // done — don't also do the login redirect
          }
        }
      } catch (_e) {
        console.debug('[index] getLastNotificationResponse skipped:', _e.message);
      }

      if (cancelled) return;

      // ── b) Normal auth check ──
      try {
        const token = (await AsyncStorage.getItem('token')) || (await AsyncStorage.getItem('access_token'));
        const role  = await AsyncStorage.getItem('role');

        if (cancelled) return;

        if (token) {
          router.replace(role === 'merchant' ? '/merchant/home' : '/shop/home');
        } else {
          router.replace('/login');
        }
      } catch (error) {
        console.log('[index] AUTH CHECK ERROR:', error);
        if (!cancelled) router.replace('/login');
      }
    };

    bootstrap();

    return () => { cancelled = true; };
  }, [navigationState?.key, router]);


  useEffect(() => {

  const handleDeepLink = (url) => {

    console.log("DEEP LINK:", url);

    const match = url.match(/shop\/(\d+)/);

    if (match) {

      const shopId = match[1];

      router.push(`/shop/${shopId}`);
    }
  };

  // App opened while running
  const sub = Linking.addEventListener('url', ({ url }) => {
    handleDeepLink(url);
  });

  // App opened from closed state
  Linking.getInitialURL().then((url) => {
    if (url) {
      handleDeepLink(url);
    }
  });

  return () => sub.remove();

}, [router]);

  // ── 3. Foreground / background notification tap listener ────────────────
  useEffect(() => {
    let subscription;
    try {
      const Notifications = require('expo-notifications');
      subscription = Notifications.addNotificationResponseReceivedListener(
        (response) => {
          try {
            const actionId = response.actionIdentifier;
            const categoryId = response.notification.request.content.categoryIdentifier;

            if (actionId && actionId !== 'expo.modules.notifications.actions.DEFAULT') {
              if (actionId === 'CHECK_DASHBOARD') {
                router.push('/merchant/home');
              } else {
                handleNotificationAction(actionId, categoryId, 'https://dukan-backend-0cc9.onrender.com');
              }
            } else {
              if (categoryId === 'check_dashboard') {
                router.push('/merchant/home');
              } else if (categoryId === 'shop_opening') {
                router.push('/merchant/home?triggerAction=open');
              } else if (categoryId === 'shop_closing') {
                router.push('/merchant/home?triggerAction=close');
              } else {
                const shopId = response.notification.request.content.data?.shop_id;
                if (shopId) router.push(`/shop/${shopId}`);
              }
            }
          } catch (_e) {
            console.debug('[index] notification action handling failed:', _e.message);
          }
        }
      );
    } catch (_e) {
      console.debug('[index] addNotificationResponseReceivedListener skipped:', _e.message);
    }

    return () => subscription?.remove();
  }, [router]);
    // ── Deep Link Handler ─────────────────────────
  useEffect(() => {

    const handleDeepLink = (url) => {

      console.log("DEEP LINK:", url);

      const match = url.match(/shop\/(\d+)/);

      if (match) {

        const shopId = match[1];

        router.push(`/shop/${shopId}`);
      }
    };

    // App already opened
    const sub = Linking.addEventListener('url', ({ url }) => {
      handleDeepLink(url);
    });

    // App opened from closed state
    Linking.getInitialURL().then((url) => {
      if (url) {
        handleDeepLink(url);
      }
    });

    return () => sub.remove();

  }, [router]);

  // ── Splash / loading UI ─────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#2F5D50" />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#F2F5F4',
  },
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});