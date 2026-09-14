import React from 'react';
import { Image, type ImageProps } from 'react-native';
import { resolveFileUri } from '@utils/fileStore';

export type StoredImageProps = Omit<ImageProps, 'source'> & {
  /** A stored reference: managed, `data:`, remote, or a legacy absolute path. */
  uri: string;
};

/**
 * `<Image>` for a URI that came out of storage.
 *
 * Records hold `lore-file://` references rather than absolute paths, because
 * an absolute path stops naming a real file the moment the OS moves the app
 * container (see `utils/fileStore.ts`). Resolution is a synchronous string
 * concatenation, so this stays a plain wrapper with no loading state — the
 * only reason it exists is that forgetting to resolve renders a blank box,
 * and a component is harder to forget than a function call.
 */
export const StoredImage: React.FC<StoredImageProps> = ({ uri, ...props }) => (
  <Image source={{ uri: resolveFileUri(uri) }} {...props} />
);
