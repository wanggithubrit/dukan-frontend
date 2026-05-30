import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const BASE_URL = 'https://dukan-backend-0cc9.onrender.com';


export default function Offers() {
  const router = useRouter();

  const [offers, setOffers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState(null);

  /* ---------------- FETCH ---------------- */
  const fetchOffers = useCallback(async () => {
    try {
      const user_id = await AsyncStorage.getItem('user_id');
      if (!user_id) return;

      setLoading(true);

      const res = await fetch(`${BASE_URL}/api/merchant/dashboard/${user_id}/`);
      const data = await res.json();

      setOffers(data.banners || []);

    } catch (err) {
      console.log(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOffers();
  }, [fetchOffers]);

  /* ---------------- DELETE ---------------- */
  const confirmDelete = useCallback(async (id) => {
    try {
      setDeletingId(id);

      const token = await AsyncStorage.getItem('access_token');

      const res = await fetch(`${BASE_URL}/api/banner/delete/${id}/`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await res.json();

      if (!res.ok) {
        Alert.alert(data.error || 'Failed');
        return;
      }

      setOffers(prev => prev.filter(o => o.id !== id));

    } catch (err) {
      console.log(err);
      Alert.alert('Network error');
    } finally {
      setDeletingId(null);
    }
  }, []);

  const handleDelete = useCallback((id) => {
    Alert.alert('Delete Offer', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => confirmDelete(id),
      },
    ]);
  }, [confirmDelete]);

  /* ---------------- RENDER ITEM ---------------- */
  const renderItem = useCallback(({ item }) => (
    <OfferCard
      offer={item}
      onDelete={handleDelete}
      deletingId={deletingId}
    />
  ), [handleDelete, deletingId]);

  /* ---------------- UI ---------------- */
  return (
    <SafeAreaView style={styles.container}>

      {/* HEADER */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} />
        </TouchableOpacity>

        <Text style={styles.headerTitle}>Manage Offers</Text>

        <View style={{ width: 22 }} />
      </View>

      {/* CONTENT */}
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#2F5D50" />
        </View>
      ) : (
        <FlatList
          data={offers}
          keyExtractor={(item) => item.id.toString()}
          renderItem={renderItem}

          initialNumToRender={5}
          maxToRenderPerBatch={5}
          windowSize={5}
          removeClippedSubviews

          ListEmptyComponent={
            <Text style={styles.empty}>No offers yet</Text>
          }

          showsVerticalScrollIndicator={false}
        />
      )}
    </SafeAreaView>
  );
}

/* ---------------- CARD (MEMOIZED) ---------------- */
const OfferCard = React.memo(({ offer, onDelete, deletingId }) => {

  const getTemplateStyle = () => {
    switch (offer.template) {
      case 'red': return { backgroundColor: '#e63946' };
      case 'green': return { backgroundColor: '#2F5D50' };
      case 'dark': return { backgroundColor: '#222' };
      default: return { backgroundColor: '#2F5D50' };
    }
  };

  return (
    <View style={styles.card}>

      {offer.image ? (
        <Image source={{ uri: offer.image }} style={styles.image} />
      ) : (
        <View style={[styles.textCard, getTemplateStyle()]}>
          <Text style={styles.discount}>
            {offer.discount || 20}% OFF 🔥
          </Text>
        </View>
      )}

      <TouchableOpacity
        style={styles.deleteBtn}
        onPress={() => onDelete(offer.id)}
        disabled={deletingId === offer.id}
      >
        {deletingId === offer.id ? (
          <ActivityIndicator color="#fff" size="small" />
        ) : (
          <Text style={styles.deleteText}>Delete</Text>
        )}
      </TouchableOpacity>

    </View>
  );
});
OfferCard.displayName = 'OfferCard';

/* ---------------- STYLES ---------------- */
const styles = StyleSheet.create({

  container: {
    flex: 1,
    backgroundColor: '#F2F5F4',
    paddingHorizontal: 15,
  },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 15,
    marginTop: 10,
  },

  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
  },

  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },

  empty: {
    textAlign: 'center',
    marginTop: 30,
    color: '#666',
  },

  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    marginBottom: 15,
    overflow: 'hidden',
  },

  image: {
    width: '100%',
    height: 120,
  },

  textCard: {
    height: 120,
    justifyContent: 'center',
    alignItems: 'center',
  },

  discount: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '700',
  },

  deleteBtn: {
    backgroundColor: '#e63946',
    padding: 12,
    alignItems: 'center',
  },

  deleteText: {
    color: '#fff',
    fontWeight: '600',
  },

});