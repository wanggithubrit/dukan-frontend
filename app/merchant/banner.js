import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import { compressImage, formatBytes } from '../../utils/imageCompressor';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';

const BASE_URL = 'https://dukan-backend-0cc9.onrender.com';

export default function BannerUpload() {
  const [image, setImage] = useState(null);
  const [loading, setLoading] = useState(false);

  // ✅ OPTIMIZED IMAGE PICKER WITH WEBP COMPRESSION
  const pickImage = useCallback(async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      quality: 1.0,
    });

    if (!result.canceled && result.assets?.length > 0) {
      try {
        const compressed = await compressImage(result.assets[0].uri);
        setImage(compressed);
      } catch (err) {
        alert('Compression error');
      }
    }
  }, []);

  // ✅ OPTIMIZED UPLOAD WITH WEBP FORMAT
  const uploadBanner = useCallback(async () => {
    if (loading) return;

    if (!image) {
      alert('Select image');
      return;
    }

    try {
      setLoading(true);

      const token = await AsyncStorage.getItem('access_token');

      const form = new FormData();

      form.append('image', {
        uri: image.uri,
        name: 'banner.webp',
        type: 'image/webp',
      });

      const res = await fetch(`${BASE_URL}/api/banner/upload/`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: form,
      });

      const data = await res.json();

      if (!res.ok) {
        alert(data.error || 'Upload failed');
        return;
      }

      alert('Banner uploaded 🎉');

      setImage(null); // ✅ reset after upload

    } catch (err) {
      console.log(err);
      alert('Network error');
    } finally {
      setLoading(false);
    }
  }, [image, loading]);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Upload Banner</Text>

      {/* IMAGE PICKER */}
      <TouchableOpacity onPress={pickImage} style={styles.box}>
        {image ? (
          <Image source={{ uri: image.uri }} style={styles.img} />
        ) : (
          <Text style={{ color: '#777' }}>Select Banner Image</Text>
        )}
      </TouchableOpacity>

      {/* COMPRESSION STATS */}
      {image && image.originalSize !== undefined && (
        <View style={styles.statsBox}>
          <Text style={styles.statsText}>
            WebP Compressed: {formatBytes(image.originalSize)} → {formatBytes(image.compressedSize)} (-{image.savedPercent}% saved)
          </Text>
        </View>
      )}

      {/* UPLOAD BUTTON */}
      <TouchableOpacity
        style={[
          styles.btn,
          loading && { backgroundColor: '#aaa' }
        ]}
        onPress={uploadBanner}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={{ color: '#fff' }}>Upload</Text>
        )}
      </TouchableOpacity>

    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#F4F6F5'
  },

  title: {
    fontSize: 18,
    fontWeight: '700'
  },

  box: {
    height: 150,
    backgroundColor: '#fff',
    marginTop: 20,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center'
  },

  img: {
    width: '100%',
    height: '100%',
    borderRadius: 12
  },

  btn: {
    backgroundColor: '#2F5D50',
    padding: 15,
    marginTop: 20,
    alignItems: 'center',
    borderRadius: 10
  },
  statsBox: {
    backgroundColor: 'rgba(47,93,80,0.08)',
    padding: 10,
    marginTop: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#D6E8D6',
    alignItems: 'center',
  },
  statsText: {
    fontSize: 12,
    color: '#2F5D50',
    fontWeight: '600',
  },
});