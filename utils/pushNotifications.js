import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';

export async function registerForPushNotificationsAsync() {
  try {
    if (!Device.isDevice) {
      // Running on emulator / web — push tokens require a real device and FCM
      // on Android. Return null so callers can proceed without crashing.
      return null;
    }

    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      return null;
    }

    // This can throw if native FCM is not configured on Android (no
    // google-services.json). Catch and return null so the app continues.
   const tokenData = await Notifications.getExpoPushTokenAsync({
    projectId: 'de72371e-b987-4c8b-a5c3-7853bb2c0d9f',
  });
    return tokenData?.data ?? null; // important: return token string or null
  } catch (err) {
    // Don't let Firebase/FCM init errors crash the app during development.
    // Log at debug level in __DEV__ so release builds remain silent and
    // development logs aren't crowded on emulators without Play Services.
    // With conditional Firebase setup, this error is expected when google-services.json is missing
    if (typeof __DEV__ !== 'undefined' && __DEV__) {
      console.debug('registerForPushNotificationsAsync failed (Firebase not configured):', err?.message ?? err);
    }
    return null;
  }
}