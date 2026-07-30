import React from 'react';
import {
  useNavigation,
  CompositeNavigationProp,
} from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { DrawerNavigationProp } from '@react-navigation/drawer';
import { RootStackParamList, RootDrawerParamList } from '@/navigation/types';
import { GenericListScreen } from '@/components/screens/GenericListScreen';
import { useLocationListConfig } from './locationListConfig';

type LocationNavigationProp = CompositeNavigationProp<
  DrawerNavigationProp<RootDrawerParamList, 'Locations'>,
  StackNavigationProp<RootStackParamList>
>;

export const LocationListScreen: React.FC = () => {
  const navigation = useNavigation<LocationNavigationProp>();
  const config = useLocationListConfig(navigation);
  return <GenericListScreen config={config} />;
};
