import { AdEventType, AppOpenAd, TestIds } from 'react-native-google-mobile-ads';
import AsyncStorage from '@react-native-async-storage/async-storage';

const adUnitId = __DEV__
  ? TestIds.APP_OPEN
  : 'ca-app-pub-9676497994699972/4424666017';

let appOpenAd = null;
let isAdLoaded = false;
let isLoadInProgress = false;

// Create the ad unit instance
const createAd = () => {
  if (!appOpenAd) {
    try {
      appOpenAd = AppOpenAd.createForAdRequest(adUnitId, {
        requestNonPersonalizedAdsOnly: true,
      });
    } catch (e) {
      console.debug('Failed to create AppOpenAd:', e.message);
    }
  }
  return appOpenAd;
};

// Check if user is eligible for ads
export const isEligibleForAds = async () => {
  try {
    const role = await AsyncStorage.getItem('role');
    const plan = await AsyncStorage.getItem('plan');
    
    // Customers always see ads
    if (!role || role === 'customer') {
      return true;
    }
    
    // Merchants see ads only if they are on the free plan
    if (role === 'merchant') {
      return plan !== 'pro';
    }
    
    return true;
  } catch (e) {
    return true; // default to showing ads if check fails
  }
};

// Preload the App Open Ad
export const preloadAppOpenAd = () => {
  const ad = createAd();
  if (!ad || isAdLoaded || isLoadInProgress) return;
  isLoadInProgress = true;

  try {
    const unsubLoaded = ad.addAdEventListener(AdEventType.LOADED, () => {
      isAdLoaded = true;
      isLoadInProgress = false;
      unsubLoaded();
    });

    const unsubError = ad.addAdEventListener(AdEventType.ERROR, (error) => {
      console.debug('App Open Ad load error:', error);
      isAdLoaded = false;
      isLoadInProgress = false;
      unsubError();
    });

    ad.load();
  } catch (e) {
    console.debug('App Open Ad preload exception:', e.message);
    isLoadInProgress = false;
  }
};

let activeCleanup = null;

// Try showing the App Open Ad. If it is already loaded, show it immediately.
// Otherwise, wait for it to load and show it.
export const showAppOpenAdIfReady = async () => {
  const eligible = await isEligibleForAds();
  if (!eligible) {
    return;
  }

  const ad = createAd();
  if (!ad) return;

  if (activeCleanup) {
    activeCleanup();
    activeCleanup = null;
  }

  const unsubscribeLoaded = ad.addAdEventListener(
    AdEventType.LOADED,
    () => {
      isAdLoaded = true;
      isLoadInProgress = false;
      ad.show();
    }
  );

  const unsubscribeClosed = ad.addAdEventListener(
    AdEventType.CLOSED,
    () => {
      cleanup();
      isAdLoaded = false;
      isLoadInProgress = false;
      preloadAppOpenAd(); // Load the next one
    }
  );

  const unsubscribeError = ad.addAdEventListener(
    AdEventType.ERROR,
    (error) => {
      console.debug('App Open Ad error during show request:', error);
      cleanup();
      isAdLoaded = false;
      isLoadInProgress = false;
      preloadAppOpenAd();
    }
  );

  const cleanup = () => {
    unsubscribeLoaded();
    unsubscribeClosed();
    unsubscribeError();
    activeCleanup = null;
  };

  activeCleanup = cleanup;

  if (isAdLoaded) {
    try {
      ad.show();
    } catch (e) {
      console.debug('App Open Ad show error:', e);
      isAdLoaded = false;
      preloadAppOpenAd();
    }
  } else {
    if (!isLoadInProgress) {
      isLoadInProgress = true;
      ad.load();
    }
  }

  return cleanup;
};
