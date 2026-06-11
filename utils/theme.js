import AsyncStorage from '@react-native-async-storage/async-storage';
import { useState, useEffect } from 'react';

// Theme presets
export const THEMES = {
  emerald: {
    name: 'Forest Emerald',
    primary: '#0A5C43',
    primaryDark: '#074532',
    primaryMid: '#147A5A',
    primaryLight: '#E6F4EF',
    primaryLighter: '#F0F9F5',
    accent: '#17C26A',
    accentSoft: '#D1FAE5',
    accentVibrant: '#00D97E',
    bg: '#F2F5F3',
    surface: '#FFFFFF',
    text: '#0D1F19',
    textMid: '#354F44',
  },
  royal: {
    name: 'Royal Sapphire',
    primary: '#1D4ED8',
    primaryDark: '#1E3A8A',
    primaryMid: '#2563EB',
    primaryLight: '#DBEAFE',
    primaryLighter: '#EFF6FF',
    accent: '#3B82F6',
    accentSoft: '#BFDBFE',
    accentVibrant: '#60A5FA',
    bg: '#F3F4F6',
    surface: '#FFFFFF',
    text: '#111827',
    textMid: '#374151',
  },
  obsidian: {
    name: 'Midnight Obsidian',
    primary: '#1F2937',
    primaryDark: '#111827',
    primaryMid: '#374151',
    primaryLight: '#E5E7EB',
    primaryLighter: '#F3F4F6',
    accent: '#F3F4F6',
    accentSoft: '#E5E7EB',
    accentVibrant: '#9CA3AF',
    bg: '#F9FAFB',
    surface: '#FFFFFF',
    text: '#111827',
    textMid: '#4B5563',
  },
  rose: {
    name: 'Rose Gold',
    primary: '#9D174D',
    primaryDark: '#831843',
    primaryMid: '#BE185D',
    primaryLight: '#FCE7F3',
    primaryLighter: '#FDF2F8',
    accent: '#EC4899',
    accentSoft: '#FBCFE8',
    accentVibrant: '#F472B6',
    bg: '#FAF5F5',
    surface: '#FFFFFF',
    text: '#1C0D12',
    textMid: '#4D333D',
  }
};

let listeners = [];
let currentThemeKey = 'emerald';

const getStoredTheme = async () => {
  try {
    const key = await AsyncStorage.getItem('app_theme');
    if (key && THEMES[key]) {
      currentThemeKey = key;
    }
  } catch (e) {}
  return currentThemeKey;
};

// Initialize theme
getStoredTheme();

export const getTheme = () => THEMES[currentThemeKey] || THEMES.emerald;
export const getThemeKey = () => currentThemeKey;

export const setTheme = async (themeKey) => {
  if (THEMES[themeKey]) {
    currentThemeKey = themeKey;
    await AsyncStorage.setItem('app_theme', themeKey);
    listeners.forEach((l) => l(THEMES[themeKey]));
  }
};

export const useTheme = () => {
  const [theme, setThemeState] = useState(getTheme());
  const [themeKey, setThemeKeyState] = useState(currentThemeKey);

  useEffect(() => {
    const listener = (newTheme) => {
      setThemeState(newTheme);
      setThemeKeyState(currentThemeKey);
    };
    listeners.push(listener);
    getStoredTheme().then((key) => {
      setThemeState(THEMES[key] || THEMES.emerald);
      setThemeKeyState(key);
    });
    return () => {
      listeners = listeners.filter((l) => l !== listener);
    };
  }, []);

  return { theme, themeKey };
};
