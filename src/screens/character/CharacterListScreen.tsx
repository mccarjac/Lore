import React from 'react';
import { GenericListScreen } from '@/components/screens/GenericListScreen';
import { useCharacterListConfig } from './characterListConfig';

export const CharacterListScreen: React.FC = () => {
  const config = useCharacterListConfig();
  return <GenericListScreen config={config} />;
};
