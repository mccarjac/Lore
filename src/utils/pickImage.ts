/**
 * Pick an image and put it somewhere it will survive.
 *
 * Four form screens used to hold four copies of this, each pushing
 * `result.assets[0].uri` straight onto a record's `imageUris`. That URI points
 * into the OS cache container, so every one of those images vanished the next
 * time the cache was cleared — the bug this module exists to close. The copy
 * into managed storage happens here, at pick time, so a record never holds a
 * reference to a file the operating system is free to delete.
 *
 * Copying at pick time (rather than at save) means an abandoned form leaves a
 * file behind. That is deliberate and cheap: `sweepOrphanFiles()` reclaims it,
 * and the alternative — a form that could lose its images if the app is killed
 * before save — is the worse trade.
 */

import { Alert } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { persistImage } from './fileStore';

export interface PickImageOptions {
  /** Passed through to the picker's editor; screens differ here. */
  aspect?: [number, number];
  quality?: number;
}

/**
 * Request permission, let the user pick one image, and copy it into
 * `images/<collection>/`.
 *
 * Resolves to the managed URI to store, or `null` when permission was refused
 * or the picker was cancelled — the two cases a caller handles identically by
 * doing nothing.
 */
export const pickAndPersistImage = async (
  collection: string,
  { aspect, quality = 0.8 }: PickImageOptions = {}
): Promise<string | null> => {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) {
    Alert.alert(
      'Permission Required',
      'Permission to access camera roll is required!',
      [{ text: 'OK' }]
    );
    return null;
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: true,
    aspect,
    quality,
  });

  if (result.canceled || !result.assets?.length) {
    return null;
  }

  return persistImage(result.assets[0].uri, collection);
};
