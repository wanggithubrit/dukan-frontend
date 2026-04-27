
import {
    RewardedAd,
    RewardedAdEventType,
    TestIds,
} from 'react-native-google-mobile-ads';

const adUnitId = __DEV__
  ? TestIds.REWARDED
  : 'ca-app-pub-3940256099942544/5224354917';

let rewarded = RewardedAd.createForAdRequest(adUnitId);
let isLoaded = false;

export const loadRewardedAd = () => {
  rewarded = RewardedAd.createForAdRequest(adUnitId);

  rewarded.addAdEventListener(RewardedAdEventType.LOADED, () => {
    isLoaded = true;
  });

  rewarded.load();
};

export const showRewardedAd = (onReward) => {
  if (!isLoaded) {
    console.log('Ad not ready');
    return;
  }

  rewarded.show();

  rewarded.addAdEventListener(
    RewardedAdEventType.EARNED_REWARD,
    () => {
      onReward();
      isLoaded = false;
      loadRewardedAd(); // preload next
    }
  );
};