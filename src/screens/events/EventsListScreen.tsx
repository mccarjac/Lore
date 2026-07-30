import React from 'react';
import { GenericListScreen } from '@/components/screens/GenericListScreen';
import { useEventsListConfig } from './eventsListConfig';

export const EventsTimelineScreen: React.FC = () => {
  const config = useEventsListConfig();
  return <GenericListScreen config={config} />;
};
