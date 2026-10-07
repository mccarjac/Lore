import React from 'react';
import { render } from '@testing-library/react-native';
import { StoredImage } from '@components/common/StoredImage';

describe('StoredImage', () => {
  it('expands a managed reference against the documents directory', () => {
    const { getByTestId } = render(
      <StoredImage testID="img" uri="lore-file://images/characters/a.jpg" />
    );

    expect(getByTestId('img').props.source).toEqual({
      uri: 'file://mock-document-directory/images/characters/a.jpg',
    });
  });

  it('passes a remote URI through unchanged', () => {
    const { getByTestId } = render(
      <StoredImage testID="img" uri="https://cdn.test/a.jpg" />
    );

    expect(getByTestId('img').props.source).toEqual({
      uri: 'https://cdn.test/a.jpg',
    });
  });

  it('forwards the props an Image would take', () => {
    const style = { width: 10, height: 10 };
    const { getByTestId } = render(
      <StoredImage
        testID="img"
        uri="lore-file://images/a.jpg"
        style={style}
        resizeMode="cover"
      />
    );

    expect(getByTestId('img').props.style).toEqual(style);
    expect(getByTestId('img').props.resizeMode).toBe('cover');
  });
});
