const { withAndroidManifest, withInfoPlist } = require('@expo/config-plugins');

function ensureMetaData(application, name, value) {
  application[0]['meta-data'] = application[0]['meta-data'] || [];
  const mdList = application[0]['meta-data'];
  const idx = mdList.findIndex(m => (m['$'] && m['$']['android:name']) === name);
  const entry = { $: { 'android:name': name, 'android:value': value } };
  if (idx >= 0) mdList[idx] = entry;
  else mdList.push(entry);
}

module.exports = function withGoogleMobileAds(config, props = {}) {
  const androidAppId = props.androidAppId;
  const iosAppId = props.iosAppId;
  const userTrackingUsageDescription = props.userTrackingUsageDescription;

  if (androidAppId) {
    config = withAndroidManifest(config, (config) => {
      const manifest = config.modResults;
      // AndroidManifest structure: manifest.manifest.application is an array
      const application = manifest.manifest && manifest.manifest.application;
      if (application) {
        ensureMetaData(application, 'com.google.android.gms.ads.APPLICATION_ID', androidAppId);
      }
      return config;
    });
  }

  if (iosAppId || userTrackingUsageDescription) {
    config = withInfoPlist(config, (config) => {
      if (iosAppId) {
        config.modResults.GADApplicationIdentifier = iosAppId;
      }
      if (userTrackingUsageDescription) {
        config.modResults.NSUserTrackingUsageDescription = userTrackingUsageDescription;
      }
      return config;
    });
  }

  return config;
};
