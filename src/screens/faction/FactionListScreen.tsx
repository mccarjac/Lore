import React from 'react';
import { GenericListScreen } from '@/components/screens/GenericListScreen';
import { useFactionListConfig } from './factionListConfig';

export const FactionListScreen: React.FC = () => {
  const config = useFactionListConfig();
  return <GenericListScreen config={config} />;
};
