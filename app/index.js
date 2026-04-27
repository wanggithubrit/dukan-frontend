import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRootNavigationState, useRouter } from 'expo-router';
import { useEffect } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  View,
} from 'react-native';
import mobileAds from 'react-native-google-mobile-ads';
import { SafeAreaView } from 'react-native-safe-area-context';


export default function Index() {
  const router = useRouter();
  const navigationState = useRootNavigationState();

  useEffect(() => {
    // Initialize AdMob when the app root mounts. Safe to call multiple times.
    try {
      mobileAds().initialize();
    } catch (e) {
      // Ignore initialization errors in non-native environments (Expo Go / web)
      // console.warn('AdMob init failed', e);
    }
  }, []);

  useEffect(() => {
    if (!navigationState?.key) return;

    const checkLogin = async () => {
      const token = await AsyncStorage.getItem('token');

      if (token) router.replace('/shop/home');
      else router.replace('/login');
    };

    checkLogin();
  }, [navigationState]);

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