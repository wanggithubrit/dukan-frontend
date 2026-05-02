import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { useRootNavigationState, useRouter } from 'expo-router';
import { useEffect } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  View,
} from 'react-native';
import mobileAds from 'react-native-google-mobile-ads';
import { SafeAreaView } from 'react-native-safe-area-context';

// 🔥 GLOBAL ERROR HANDLER FOR EXPO-KEEP-AWAKE
const originalConsoleError = console.error;
console.error = (...args) => {
  const errorMessage = args.join(' ');
  if (errorMessage.includes('ExpoKeepAwake.activate') ||
      errorMessage.includes('The current activity is no longer available')) {
    // Ignore keep awake errors - they happen when app is backgrounded
    return;
  }
  originalConsoleError.apply(console, args);
};

// 🔥 CATCH UNHANDLED PROMISE REJECTIONS
const originalConsoleWarn = console.warn;
console.warn = (...args) => {
  const warningMessage = args.join(' ');
  if (warningMessage.includes('ExpoKeepAwake') ||
      warningMessage.includes('activity is no longer available')) {
    // Ignore keep awake warnings
    return;
  }
  originalConsoleWarn.apply(console, args);
};

// 🔥 MUST BE OUTSIDE COMPONENT
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

export default function Index() {
  const router = useRouter();
  const navigationState = useRootNavigationState();

  // 🔥 INIT ADMOB
  useEffect(() => {
    try {
      mobileAds().initialize();
    } catch (_e) {}
  }, []);

  // 🔥 HANDLE APP CLOSED → PUSH CLICK
  useEffect(() => {
    if (!navigationState?.key) return;

    const checkInitialNotification = async () => {
      // Small delay to ensure layout is mounted
      await new Promise(resolve => setTimeout(resolve, 100));
      try {
        const response = await Notifications.getLastNotificationResponseAsync();

        if (response) {
          const data = response.notification.request.content.data;

          if (data?.shop_id) {
            router.replace(`/shop/${data.shop_id}`);
          }
        }
      } catch (error) {
        // Ignore notification errors that might occur during app startup
        console.debug('Initial notification check failed:', error.message);
      }
    };

    checkInitialNotification();
  }, [navigationState?.key, router]);

  // 🔥 HANDLE LOGIN REDIRECT
  useEffect(() => {
    if (!navigationState?.key) return;

    const checkLogin = async () => {
      // Small delay to ensure layout is mounted
      await new Promise(resolve => setTimeout(resolve, 100));
      const token = await AsyncStorage.getItem('token');

      if (token) router.replace('/shop/home');
      else router.replace('/login');
    };

    checkLogin();
  }, [navigationState?.key, router]);

  // 🔥 HANDLE PUSH CLICK (APP OPEN / BACKGROUND)
  useEffect(() => {
    const subscription = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        try {
          const data = response.notification.request.content.data;
          if (data?.shop_id) {
            router.push(`/shop/${data.shop_id}`);
          }
        } catch (error) {
          // Ignore navigation errors that might occur when activity is destroyed
          console.debug('Notification response handling failed:', error.message);
        }
      }
    );

    return () => subscription.remove();
  }, [router]);

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