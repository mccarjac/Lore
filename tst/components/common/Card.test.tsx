import React from 'react';
import { render } from '@testing-library/react-native';
import { Text } from 'react-native';
import { Card } from '@components/common/Card';

describe('Card', () => {
  it('should render children correctly', () => {
    const { getByText } = render(
      <Card>
        <Text>Test Content</Text>
      </Card>
    );

    expect(getByText('Test Content')).toBeTruthy();
  });

  it('should apply custom style when provided', () => {
    const customStyle = { backgroundColor: 'red' };
    const { getByText } = render(
      <Card style={customStyle}>
        <Text>Styled Card</Text>
      </Card>
    );

    expect(getByText('Styled Card')).toBeTruthy();
  });

  it('should apply custom content style when provided', () => {
    const customContentStyle = { padding: 20 };
    const { getByText } = render(
      <Card contentStyle={customContentStyle}>
        <Text>Content Styled Card</Text>
      </Card>
    );

    expect(getByText('Content Styled Card')).toBeTruthy();
  });
});
