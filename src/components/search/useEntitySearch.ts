import { useCallback, useMemo, useState } from 'react';
import {
  FilterFieldConfig,
  FilterValues,
  isFieldSet,
  isFilterValueActive,
} from './filterFieldTypes';

export interface UseEntitySearchOptions<T> {
  searchableText: (item: T) => string[];
  filterFields?: FilterFieldConfig[];
  initialFilterValues?: FilterValues;
}

export interface UseEntitySearchResult<T> {
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  filterValues: FilterValues;
  setFilterValues: (values: FilterValues) => void;
  clearFilters: () => void;
  activeFilterCount: number;
  results: T[];
}

export function useEntitySearch<T>(
  data: T[],
  {
    searchableText,
    filterFields = [],
    initialFilterValues = {},
  }: UseEntitySearchOptions<T>
): UseEntitySearchResult<T> {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterValues, setFilterValues] =
    useState<FilterValues>(initialFilterValues);

  const clearFilters = useCallback(() => {
    setFilterValues(initialFilterValues);
  }, [initialFilterValues]);

  const activeFilterCount = useMemo(
    () =>
      filterFields.filter(field =>
        isFilterValueActive(field, filterValues[field.key])
      ).length,
    [filterFields, filterValues]
  );

  const results = useMemo(() => {
    const query = searchQuery.toLowerCase().trim();
    const setFields = filterFields.filter(field =>
      isFieldSet(filterValues[field.key])
    );

    return data.filter(item => {
      if (query.length > 0) {
        const matchesText = searchableText(item).some(text =>
          text.toLowerCase().includes(query)
        );
        if (!matchesText) {
          return false;
        }
      }

      return setFields.every(field => {
        const value = filterValues[field.key];
        if (field.type === 'number') {
          return field.matches(item, value as number, filterValues);
        }
        return field.matches(item, value as string, filterValues);
      });
    });
  }, [data, searchQuery, filterValues, filterFields, searchableText]);

  return {
    searchQuery,
    setSearchQuery,
    filterValues,
    setFilterValues,
    clearFilters,
    activeFilterCount,
    results,
  };
}
