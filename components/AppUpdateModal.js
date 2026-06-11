import React, { useEffect, useState, useCallback } from 'react';
import {
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ScrollView,
  BackHandler,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import * as Linking from 'expo-linking';
import { Ionicons } from '@expo/vector-icons';

const BASE_URL = 'https://dukan-backend-0cc9.onrender.com';
const PLAY_STORE_URL = 'https://play.google.com/store/apps/details?id=com.mydukan.dukanapp';
const MARKET_URL = 'market://details?id=com.mydukan.dukanapp';

export default function AppUpdateModal() {
  const [visible, setVisible] = useState(false);
  const [updateInfo, setUpdateInfo] = useState(null);

  const checkUpdate = useCallback(async () => {
    try {
      const versionCode = Constants.expoConfig?.android?.versionCode || 22;
      const versionName = Constants.expoConfig?.version || '1.0.0';

      const token = await AsyncStorage.getItem('token') || await AsyncStorage.getItem('access_token');
      const headers = {
        'Content-Type': 'application/json',
      };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const res = await fetch(`${BASE_URL}/api/app-update/check/`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          version_code: versionCode,
          version_name: versionName,
        }),
      });

      const data = await res.json();
      if (res.ok && data.update_available) {
        // Check if user already dismissed this specific version (if optional)
        if (!data.is_mandatory) {
          const dismissedVersion = await AsyncStorage.getItem(`dismissed_version_${data.version_code}`);
          if (dismissedVersion === 'true') {
            return; // Already dismissed, don't show
          }
        }
        setUpdateInfo(data);
        setVisible(true);
      }
    } catch (err) {
      console.warn('App update check failed:', err);
    }
  }, []);

  useEffect(() => {
    checkUpdate();
  }, [checkUpdate]);

  // Handle hardware back button for Android
  useEffect(() => {
    const backAction = () => {
      if (visible && updateInfo?.is_mandatory) {
        return true; // block back button
      }
      return false;
    };

    const backHandler = BackHandler.addEventListener('hardwareBackPress', backAction);
    return () => backHandler.remove();
  }, [visible, updateInfo]);

  const handleUpdate = useCallback(async () => {
    try {
      const canOpen = await Linking.canOpenURL(MARKET_URL);
      if (canOpen) {
        await Linking.openURL(MARKET_URL);
      } else {
        await Linking.openURL(PLAY_STORE_URL);
      }
    } catch {
      Linking.openURL(PLAY_STORE_URL).catch(() => {});
    }
  }, []);

  const handleDismiss = useCallback(async () => {
    if (updateInfo) {
      await AsyncStorage.setItem(`dismissed_version_${updateInfo.version_code}`, 'true');
    }
    setVisible(false);
  }, [updateInfo]);

  if (!visible || !updateInfo) return null;

  return (
    <Modal
      transparent
      animationType="fade"
      visible={visible}
      onRequestClose={() => {
        if (!updateInfo.is_mandatory) {
          setVisible(false);
        }
      }}
    >
      <View style={styles.overlay}>
        <View style={styles.card}>
          <View style={styles.iconContainer}>
            <Ionicons name="cloud-download-outline" size={40} color="#2F5D50" />
          </View>

          <Text style={styles.title}>New Update Available! 🚀</Text>
          <Text style={styles.subtitle}>Version {updateInfo.version_name}</Text>

          {updateInfo.release_notes ? (
            <View style={styles.notesContainer}>
              <Text style={styles.notesLabel}>{"What's New:"}</Text>
              <ScrollView style={styles.notesScroll} contentContainerStyle={styles.notesContent}>
                <Text style={styles.notesText}>{updateInfo.release_notes}</Text>
              </ScrollView>
            </View>
          ) : null}

          {updateInfo.is_mandatory ? (
            <Text style={styles.warningText}>
              This update is mandatory to continue using the app.
            </Text>
          ) : null}

          <View style={styles.btnRow}>
            {!updateInfo.is_mandatory && (
              <TouchableOpacity style={styles.btnSecondary} onPress={handleDismiss}>
                <Text style={styles.btnSecondaryText}>Not Now</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity style={styles.btnPrimary} onPress={handleUpdate}>
              <Ionicons name="logo-google-playstore" size={16} color="#fff" style={{ marginRight: 6 }} />
              <Text style={styles.btnPrimaryText}>Update Now</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 5,
  },
  iconContainer: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(47,93,80,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    color: '#1A1A1A',
    textAlign: 'center',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
    fontWeight: '600',
    marginBottom: 16,
  },
  notesContainer: {
    width: '100%',
    backgroundColor: '#F5F7F6',
    borderRadius: 12,
    padding: 12,
    maxHeight: 120,
    marginBottom: 16,
  },
  notesLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#888',
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  notesScroll: {
    width: '100%',
  },
  notesContent: {
    paddingBottom: 4,
  },
  notesText: {
    fontSize: 13,
    color: '#444',
    lineHeight: 18,
  },
  warningText: {
    fontSize: 12,
    color: '#D97706',
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 16,
  },
  btnRow: {
    flexDirection: 'row',
    width: '100%',
    gap: 12,
  },
  btnPrimary: {
    flex: 1,
    height: 48,
    backgroundColor: '#2F5D50',
    borderRadius: 12,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  btnPrimaryText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
  },
  btnSecondary: {
    flex: 1,
    height: 48,
    backgroundColor: '#f3f4f6',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  btnSecondaryText: {
    color: '#4b5563',
    fontWeight: '700',
    fontSize: 14,
  },
});
