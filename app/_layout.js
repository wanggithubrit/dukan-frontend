import { Slot } from 'expo-router';
import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { preloadAppOpenAd, showAppOpenAdIfReady } from '../utils/appOpenAd';

// We lazy-require expo-notifications
let Notifications = null;
try {
  Notifications = require('expo-notifications');
} catch (e) {
  console.debug('[layout] expo-notifications unavailable:', e.message);
}

// AdMob initialization
let isMobileAdsInitialized = false;
let hasAppOpenAdShown = false;

const initializeMobileAds = async () => {
  if (isMobileAdsInitialized) return;
  try {
    const adsModule = await import('react-native-google-mobile-ads');
    const mobileAds = adsModule.default || adsModule.mobileAds;
    if (typeof mobileAds === 'function') {
      await mobileAds().initialize();
      isMobileAdsInitialized = true;
      // Preload App Open Ad immediately
      preloadAppOpenAd();
      
      // Show App Open Ad after a brief startup delay (1.5 seconds) exactly once
      if (!hasAppOpenAdShown) {
        hasAppOpenAdShown = true;
        setTimeout(() => {
          showAppOpenAdIfReady();
        }, 1500);
      }
    }
  } catch (_e) {
    console.debug('[layout] AdMob init failed:', _e.message);
  }
};

async function triggerLocalNotification(title, body) {
  if (!Notifications) return;
  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: title,
        body: body,
        sound: true,
        priority: Notifications.AndroidNotificationPriority.MAX,
      },
      trigger: null,
    });
  } catch (err) {
    console.debug('Failed to trigger local notification:', err);
  }
}

function NotificationSoundListener() {
  const processedIds = useRef(new Set());
  const isFirstLoad = useRef(true);

  useEffect(() => {
    let intervalId;

    const checkNotifications = async () => {
      try {
        const userId = await AsyncStorage.getItem('user_id');
        if (!userId) return;

        const res = await fetch(`https://dukan-backend-0cc9.onrender.com/api/notifications/${userId}/`);
        if (!res.ok) return;

        const data = await res.json();
        if (!Array.isArray(data)) return;

        let hasNewUnread = false;
        let latestMsg = "";
        let latestTitle = "";

        data.forEach(notif => {
          if (!notif.is_read && notif.id && !processedIds.current.has(notif.id)) {
            processedIds.current.add(notif.id);
            if (!isFirstLoad.current) {
              hasNewUnread = true;
              latestMsg = notif.message || "You have a new update.";
              latestTitle = notif.title || "New Notification 🔔";
            }
          }
        });

        if (isFirstLoad.current) {
          isFirstLoad.current = false;
        } else if (hasNewUnread) {
          await triggerLocalNotification(latestTitle, latestMsg);
        }
      } catch (err) {
        console.debug('[NotificationSoundListener] Check failed:', err);
      }
    };

    checkNotifications();
    // Poll every 10 seconds
    intervalId = setInterval(checkNotifications, 10000);

    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, []);

  return null;
}

export default function Layout() {
  useEffect(() => {
    // Initialize AdMob and trigger cold-start ad
    initializeMobileAds();
  }, []);

  return (
    <>
      <Slot />
      <NotificationSoundListener />
    </>
  );
}