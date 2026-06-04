import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Lightweight local analytics manager for tracking shop shares.
 */
export const trackShareEvent = async (eventName, shopData) => {
  const event = {
    event: eventName,
    shopId: shopData.id,
    shopName: shopData.name,
    timestamp: new Date().toISOString(),
    // Future-ready extensibility
    metadata: {
      category: shopData.category || null,
      address: shopData.address || null,
      phone: shopData.phone || null,
      productCount: shopData.items_count || 0,
      latitude: shopData.latitude || null,
      longitude: shopData.longitude || null,
    }
  };

  console.log(`[Analytics] ${eventName}:`, event);

  try {
    const rawHistory = await AsyncStorage.getItem('share_analytics_history');
    const history = rawHistory ? JSON.parse(rawHistory) : [];
    history.push(event);
    
    // Keep last 100 events to manage storage limit
    if (history.length > 100) {
      history.shift();
    }
    
    await AsyncStorage.setItem('share_analytics_history', JSON.stringify(history));
  } catch (error) {
    console.warn('[Analytics] Failed to persist share analytics:', error);
  }
};
