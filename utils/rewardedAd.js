import {
    AdEventType,
    RewardedAd,
    RewardedAdEventType,
    TestIds,
} from 'react-native-google-mobile-ads';

const adUnitId = __DEV__
  ? TestIds.REWARDED
  : 'ca-app-pub-9676497994699972/5941082220';

let rewarded = null;
let isAdLoaded = false;
let isLoadInProgress = false;

// Track the cleanup fn for any currently-active listener set
// so we never stack listeners across calls.
let activeCleanup = null;

// Safely create rewarded ad instance
const createRewardedAd = () => {
  try {
    if (!rewarded) {
      rewarded = RewardedAd.createForAdRequest(adUnitId, {
        requestNonPersonalizedAdsOnly: true,
      });
    }
    return rewarded;
  } catch (e) {
    console.debug('Failed to create RewardedAd:', e.message);
    return null;
  }
};

// ── Keep the ad pre-warmed at all times ──────────────────────────
const preloadAd = () => {
  if (!rewarded || isAdLoaded || isLoadInProgress) return;
  isLoadInProgress = true;

  try {
    const unsubLoaded = rewarded.addAdEventListener(
      RewardedAdEventType.LOADED,
      () => {
        isAdLoaded = true;
        isLoadInProgress = false;
        unsubLoaded();
      }
    );

    const unsubError = rewarded.addAdEventListener(
      AdEventType.ERROR,
      (error) => {
        console.warn('Rewarded ad preload error:', error);
        isAdLoaded = false;
        isLoadInProgress = false;
        unsubError();
        // Retry after 30s so we don't hammer the network
        setTimeout(preloadAd, 30_000);
      }
    );

    rewarded.load();
  } catch (e) {
    console.debug('Rewarded ad preload exception:', e.message);
    isLoadInProgress = false;
  }
};

// Initialize on first import (deferred — lazy)
setTimeout(() => {
  rewarded = createRewardedAd();
  if (rewarded) preloadAd();
}, 0);

// ── Public API ───────────────────────────────────────────────────
export const showRewardedAd = (onRewardEarned = () => {}) => {
  if (!rewarded) return;

  // Tear down any stale listeners from a previous call
  if (activeCleanup) {
    activeCleanup();
    activeCleanup = null;
  }

  let rewardGranted = false;

  const unsubscribeLoaded = rewarded.addAdEventListener(
    RewardedAdEventType.LOADED,
    () => {
      isAdLoaded = true;
      isLoadInProgress = false;
      rewarded.show();
    }
  );

  const unsubscribeEarned = rewarded.addAdEventListener(
    RewardedAdEventType.EARNED_REWARD,
    (reward) => {
      console.log('User earned reward:', reward);
      rewardGranted = true;
      onRewardEarned(reward);
    }
  );

  // AdEventType.CLOSED is the correct event for rewarded ads —
  // RewardedAdEventType.CLOSED does NOT exist in this library.
  const unsubscribeClosed = rewarded.addAdEventListener(
    AdEventType.CLOSED,
    () => {
      cleanup();
      if (!rewardGranted) {
        console.log('Ad closed without reward (user skipped)');
      }
      // Reset state and pre-warm the next ad
      isAdLoaded = false;
      isLoadInProgress = false;
      preloadAd();
    }
  );

  const unsubscribeError = rewarded.addAdEventListener(
    AdEventType.ERROR,
    (error) => {
      console.warn('Rewarded ad show error:', error);
      cleanup();
      isAdLoaded = false;
      isLoadInProgress = false;
      preloadAd();
    }
  );

  const cleanup = () => {
    unsubscribeLoaded();
    unsubscribeEarned();
    unsubscribeClosed();
    unsubscribeError();
    activeCleanup = null;
  };

  activeCleanup = cleanup;

  if (isAdLoaded) {
    // Ad already fetched — show immediately, no second load() call
    rewarded.show();
  } else {
    // Not ready yet — load() will fire LOADED which then calls show()
    if (!isLoadInProgress) {
      isLoadInProgress = true;
      rewarded.load();
    }
    // If load is already in progress, the LOADED listener above
    // will catch it when it completes — nothing else needed.
  }

  return cleanup;
};