import { Slot } from 'expo-router';
import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { preloadAppOpenAd, showAppOpenAdIfReady } from '../utils/appOpenAd';

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

export default function Layout() {
  useEffect(() => {
    // Initialize AdMob and trigger cold-start ad
    initializeMobileAds();
  }, []);

  return <Slot />;
}