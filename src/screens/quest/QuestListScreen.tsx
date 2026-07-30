import React from 'react';
import { GenericListScreen } from '@/components/screens/GenericListScreen';
import { useQuestListConfig } from './questListConfig';

export const QuestListScreen: React.FC = () => {
  const config = useQuestListConfig();
  return <GenericListScreen config={config} />;
};
