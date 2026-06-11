import * as ImageManipulator from 'expo-image-manipulator';
import * as FileSystem from 'expo-file-system';
import { Image } from 'react-native';

/**
 * Helper to get image dimensions.
 */
function getImageSize(uri) {
  return new Promise((resolve, reject) => {
    Image.getSize(
      uri,
      (width, height) => resolve({ width, height }),
      (err) => reject(err)
    );
  });
}

/**
 * Compresses and resizes an image to WebP (75% quality).
 * @param {string} uri - Local image URI
 * @param {object} options - Options
 * @param {number} options.maxWidth - Max width (default 1200)
 * @param {number} options.quality - Quality (default 0.75)
 * @returns {Promise<{uri: string, width: number, height: number, originalSize: number, compressedSize: number, savedPercent: number}>}
 */
export async function compressImage(uri, options = {}) {
  if (!uri) throw new Error('No image URI provided');
  const { maxWidth = 1200, quality = 0.75 } = options;

  try {
    // 1. Get original size in bytes
    let originalSize = 0;
    try {
      const originalInfo = await FileSystem.getInfoAsync(uri);
      originalSize = originalInfo.size || 0;
    } catch (fsErr) {
      console.warn('Could not read original file size:', fsErr.message);
    }

    // 2. Get original dimensions
    const dimensions = await getImageSize(uri);

    const actions = [];
    // Resize maintaining aspect ratio if width exceeds maxWidth
    if (dimensions.width > maxWidth) {
      actions.push({
        resize: {
          width: maxWidth,
        },
      });
    }

    // 3. Compress to WebP format
    const result = await ImageManipulator.manipulateAsync(
      uri,
      actions,
      {
        compress: quality,
        format: ImageManipulator.SaveFormat.WEBP,
      }
    );

    // 4. Get compressed size
    let compressedSize = 0;
    try {
      const compressedInfo = await FileSystem.getInfoAsync(result.uri);
      compressedSize = compressedInfo.size || 0;
    } catch (fsErr) {
      console.warn('Could not read compressed file size:', fsErr.message);
    }

    const savedPercent = originalSize > 0
      ? Math.max(0, Math.round(((originalSize - compressedSize) / originalSize) * 100))
      : 0;

    return {
      uri: result.uri,
      width: result.width,
      height: result.height,
      originalSize,
      compressedSize,
      savedPercent,
    };
  } catch (error) {
    console.error('Image compression failed:', error);
    throw error;
  }
}

/**
 * Format bytes to readable string.
 */
export function formatBytes(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}
