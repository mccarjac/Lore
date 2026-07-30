import { ReactNode } from 'react';
import { ViewStyle } from 'react-native';
import type {
  FilterFieldConfig,
  FilterValues,
} from '@/components/search/filterFieldTypes';
import type { MenuSection } from '@/components/common/menuTypes';

export interface QuickFilter<T> {
  key: string;
  label: (active: boolean) => string;
  predicate: (item: T) => boolean;
  defaultActive?: boolean;
}

export interface BulkAction {
  key: string;
  label: string;
  confirmTitle: string;
  confirmMessage: string;
  confirmLabel?: string;
  run: () => Promise<void>;
}

export interface HeaderButtonConfig {
  key: string;
  label: string;
  onPress: () => void;
  visible?: boolean;
}

export interface LoadResult<T, C = void> {
  items: T[];
  context: C;
}

export interface ListItemHelpers {
  /**
   * Re-runs `loadData` and refreshes the list in place. For a per-row
   * mutation (e.g. Character's present/absent toggle) that isn't a bulk
   * action but still needs the visible list to reflect the change
   * immediately, `renderItem` calls this after the mutation resolves.
   */
  reload: () => Promise<void>;
}

export interface ListScreenConfig<T, C = void> {
  loadData: () => Promise<LoadResult<T, C>>;
  /**
   * Value passed to `useFilterFields`/quick filters before `loadData`
   * resolves for the first time. Required for any `C` shape whose fields
   * are read unconditionally (e.g. Events' filter fields read
   * `context.locations`) — omitting it defaults to `undefined as C`, which
   * is only safe when `C` is `void`.
   */
  initialContext?: C;
  keyExtractor: (item: T) => string;
  renderItem: (item: T, helpers: ListItemHelpers) => ReactNode;
  searchableText: (item: T) => string[];
  useFilterFields: (context: C) => FilterFieldConfig[];
  initialFilterValues?: FilterValues;
  advancedSearchTitle: string;
  searchPlaceholder: string;
  emptyStateTitle: string;
  emptyStateSubtitle?: string;
  contentContainerStyle?: ViewStyle;
  onAddPress?: () => void;
  quickFilters?: QuickFilter<T>[];
  bulkActions?: BulkAction[];
  extraHeaderButtons?: HeaderButtonConfig[];
  menuSections?: MenuSection[];
  sortResults?: (items: T[]) => T[];
}
