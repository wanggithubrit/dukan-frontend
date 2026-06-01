import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { Alert, Platform } from 'react-native';

// Define Notification Category Actions
export async function setupNotificationCategories() {
  try {
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'Default Channel',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#FF231F7C',
      });
    }

    await Notifications.setNotificationCategoryAsync('shop_opening', [
      {
        identifier: 'OPEN_SHOP',
        buttonTitleShort: 'Open Shop',
        options: { isDestructive: false, isAuthenticationRequired: false },
      },
      {
        identifier: 'SNOOZE_5',
        buttonTitleShort: 'Snooze 5m',
        options: { isDestructive: false, isAuthenticationRequired: false },
      },
      {
        identifier: 'SNOOZE_10',
        buttonTitleShort: 'Snooze 10m',
        options: { isDestructive: false, isAuthenticationRequired: false },
      },
      {
        identifier: 'SNOOZE_30',
        buttonTitleShort: 'Snooze 30m',
        options: { isDestructive: false, isAuthenticationRequired: false },
      },
    ]);

    await Notifications.setNotificationCategoryAsync('shop_closing', [
      {
        identifier: 'CLOSE_SHOP',
        buttonTitleShort: 'Close Shop',
        options: { isDestructive: true, isAuthenticationRequired: false },
      },
      {
        identifier: 'KEEP_OPEN',
        buttonTitleShort: 'Keep Open',
        options: { isDestructive: false, isAuthenticationRequired: false },
      },
      {
        identifier: 'SNOOZE_5',
        buttonTitleShort: 'Snooze 5m',
        options: { isDestructive: false, isAuthenticationRequired: false },
      },
      {
        identifier: 'SNOOZE_10',
        buttonTitleShort: 'Snooze 10m',
        options: { isDestructive: false, isAuthenticationRequired: false },
      },
      {
        identifier: 'SNOOZE_30',
        buttonTitleShort: 'Snooze 30m',
        options: { isDestructive: false, isAuthenticationRequired: false },
      },
    ]);
  } catch (err) {
    console.debug('Failed to set notification categories:', err);
  }
}

// Parse HH:MM string to { hour, minute }
function parseTime(timeStr) {
  if (!timeStr) return null;
  const parts = timeStr.split(':');
  if (parts.length < 2) return null;
  const hour = parseInt(parts[0], 10);
  const minute = parseInt(parts[1], 10);
  if (isNaN(hour) || isNaN(minute)) return null;
  return { hour, minute };
}

// Main scheduler function
export async function scheduleShopReminders(shop) {
  try {
    // 1. Request and verify notification permissions
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync({
        ios: {
          allowAlert: true,
          allowBadge: true,
          allowSound: true,
        },
      });
      finalStatus = status;
    }
    if (finalStatus !== 'granted') {
      Alert.alert(
        'No Permissions',
        'Please grant notification permissions in system settings to receive reminders.'
      );
      return;
    }

    // 2. Cancel all existing scheduled notifications before rescheduling
    await Notifications.cancelAllScheduledNotificationsAsync();

    if (!shop || !shop.auto_reminder_enabled) {
      return;
    }

    const openTime = parseTime(shop.opening_time);
    const closeTime = parseTime(shop.closing_time);

    // 3. Schedule daily opening notification
    // Uses type: 'calendar' with repeats: true — the correct way to fire at a fixed
    // time every day in expo-notifications. type: 'daily' does NOT exist.
    if (openTime) {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: '⏰ Time to Open Your Shop',
          body: 'Your scheduled opening time has arrived.',
          categoryIdentifier: 'shop_opening',
          sound: true,
          priority: Notifications.AndroidNotificationPriority.HIGH,
          channelId: 'default',
        },
        trigger: {
          type: 'daily',
          hour: openTime.hour,
          minute: openTime.minute,
          repeats: true,
        },
      });
    }

    // 4. Schedule daily closing notification
    if (closeTime) {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: '🌙 Time to Close Your Shop',
          body: 'Your scheduled closing time has arrived.',
          categoryIdentifier: 'shop_closing',
          sound: true,
          priority: Notifications.AndroidNotificationPriority.HIGH,
          channelId: 'default',
        },
        trigger: {
          type: 'daily',
          hour: closeTime.hour,
          minute: closeTime.minute,
          repeats: true,
        },
      });
    }

    // 5. Immediate confirmation notification (fires after 3 seconds)
    await Notifications.scheduleNotificationAsync({
      content: {
        title: '🔔 Reminders Configured!',
        body: `Auto-reminders enabled. We'll alert you at your scheduled times (${shop.opening_time || 'N/A'} & ${shop.closing_time || 'N/A'}).`,
        sound: true,
        categoryIdentifier: 'shop_opening',
        channelId: 'default',
      },
      trigger: {
        type: 'timeInterval',
        seconds: 3,
      },
    });
  } catch (err) {
    console.error('Failed to schedule shop reminders:', err);
    Alert.alert('Notification Error', err?.message || String(err));
  }
}

// Handle notification actions (Snoozes, Open/Close status triggers)
export async function handleNotificationAction(actionIdentifier, categoryIdentifier, BASE_URL) {
  try {
    const [[, t], [, at]] = await AsyncStorage.multiGet(['token', 'access_token']);
    const token = t || at;
    if (!token) return;

    if (actionIdentifier === 'OPEN_SHOP') {
      const res = await fetch(`${BASE_URL}/api/credits/report-action/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ action: 'open' }),
      });
      if (res.ok) {
        await Notifications.scheduleNotificationAsync({
          content: {
            title: '✅ Shop Opened!',
            body: 'Your shop status has been updated to Open. +0.5 Credits earned!',
            sound: true,
            channelId: 'default',
          },
          trigger: null, // immediate
        });
      }
    } else if (actionIdentifier === 'CLOSE_SHOP') {
      const res = await fetch(`${BASE_URL}/api/credits/report-action/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ action: 'close' }),
      });
      if (res.ok) {
        await Notifications.scheduleNotificationAsync({
          content: {
            title: '🌙 Shop Closed!',
            body: 'Your shop status has been updated to Closed.',
            sound: true,
            channelId: 'default',
          },
          trigger: null, // immediate
        });
      }
    } else if (actionIdentifier.startsWith('SNOOZE_')) {
      const minutes = parseInt(actionIdentifier.split('_')[1], 10);
      const title =
        categoryIdentifier === 'shop_opening'
          ? '⏰ Time to Open Your Shop'
          : '🌙 Time to Close Your Shop';
      const body =
        categoryIdentifier === 'shop_opening'
          ? 'Your scheduled opening time has arrived (Snoozed).'
          : 'Your scheduled closing time has arrived (Snoozed).';

      await Notifications.scheduleNotificationAsync({
        content: {
          title,
          body,
          categoryIdentifier,
          sound: true,
          channelId: 'default',
        },
        trigger: {
          type: 'timeInterval',
          seconds: minutes * 60,
        },
      });
    }
  } catch (err) {
    console.debug('Notification action handler failed:', err);
  }
}