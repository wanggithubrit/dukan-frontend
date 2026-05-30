import AsyncStorage from '@react-native-async-storage/async-storage';


const BASE_URL = 'https://dukan-backend-0cc9.onrender.com';

/* ───────── REFRESH TOKEN ───────── */
export const refreshAccessToken = async () => {
  try {
    const refresh = await AsyncStorage.getItem('refresh');

    if (!refresh) return null;

    const res = await fetch(`${BASE_URL}/api/token/refresh/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh }),
    });

    const data = await res.json();

    if (!res.ok) return null;

    await AsyncStorage.setItem('token', data.access);
    return data.access;

  } catch (err) {
    console.log('REFRESH ERROR:', err);
    return null;
  }
};

/* ───────── AUTH REQUEST ───────── */
export const authFetch = async (url, options = {}) => {
  let token = await AsyncStorage.getItem('token');

  const makeRequest = async (tk) => {
    return fetch(url, {
      ...options,
      headers: {
        ...(options.headers || {}),
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tk}`,
      },
    });
  };

  let res = await makeRequest(token);
  let data = await res.json();

  // 🔥 TOKEN EXPIRED → REFRESH
  if (data?.code === 'token_not_valid') {
    const newToken = await refreshAccessToken();

    if (!newToken) {
      // logout user
      await AsyncStorage.removeItem('token');
      await AsyncStorage.removeItem('refresh');
      throw new Error('Session expired. Please login again.');
    }

    res = await makeRequest(newToken);
    data = await res.json();
  }

  return { res, data };
};