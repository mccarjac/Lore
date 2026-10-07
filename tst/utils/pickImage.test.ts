import { Alert } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { pickAndPersistImage } from '@utils/pickImage';

jest.mock('uuid', () => ({ v4: () => 'generated-uuid' }));

const granted = () =>
  (
    ImagePicker.requestMediaLibraryPermissionsAsync as jest.Mock
  ).mockResolvedValue({ granted: true, status: 'granted' });

describe('pickAndPersistImage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (FileSystem.copyAsync as jest.Mock).mockResolvedValue(undefined);
    (FileSystem.makeDirectoryAsync as jest.Mock).mockResolvedValue(undefined);
    jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('copies the pick out of the cache and returns a managed reference', async () => {
    granted();
    (ImagePicker.launchImageLibraryAsync as jest.Mock).mockResolvedValue({
      canceled: false,
      assets: [{ uri: 'file://mock-cache-directory/ImagePicker/x.jpg' }],
    });

    const stored = await pickAndPersistImage('characters', {
      aspect: [1, 1],
      quality: 1,
    });

    // The whole point: what the record stores is never the picker's own URI.
    expect(stored).toBe('lore-file://images/characters/generated-uuid.jpg');
    expect(FileSystem.copyAsync).toHaveBeenCalledWith({
      from: 'file://mock-cache-directory/ImagePicker/x.jpg',
      to: 'file://mock-document-directory/images/characters/generated-uuid.jpg',
    });
    expect(ImagePicker.launchImageLibraryAsync).toHaveBeenCalledWith(
      expect.objectContaining({ aspect: [1, 1], quality: 1 })
    );
  });

  it('defaults the quality when a caller does not set one', async () => {
    granted();
    (ImagePicker.launchImageLibraryAsync as jest.Mock).mockResolvedValue({
      canceled: true,
    });

    await pickAndPersistImage('events');

    expect(ImagePicker.launchImageLibraryAsync).toHaveBeenCalledWith(
      expect.objectContaining({ quality: 0.8 })
    );
  });

  it('returns null and warns when permission is refused', async () => {
    (
      ImagePicker.requestMediaLibraryPermissionsAsync as jest.Mock
    ).mockResolvedValue({ granted: false, status: 'denied' });

    expect(await pickAndPersistImage('characters')).toBeNull();
    expect(Alert.alert).toHaveBeenCalled();
    expect(ImagePicker.launchImageLibraryAsync).not.toHaveBeenCalled();
  });

  it('returns null on cancel, and on an empty asset list', async () => {
    granted();
    (ImagePicker.launchImageLibraryAsync as jest.Mock).mockResolvedValue({
      canceled: true,
    });
    expect(await pickAndPersistImage('characters')).toBeNull();

    (ImagePicker.launchImageLibraryAsync as jest.Mock).mockResolvedValue({
      canceled: false,
      assets: [],
    });
    expect(await pickAndPersistImage('characters')).toBeNull();

    expect(FileSystem.copyAsync).not.toHaveBeenCalled();
  });
});
