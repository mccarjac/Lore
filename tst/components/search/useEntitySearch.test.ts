import { renderHook, act } from '@testing-library/react-native';
import { useEntitySearch } from '@/components/search/useEntitySearch';
import type { FilterFieldConfig } from '@/components/search/filterFieldTypes';

interface Widget {
  id: string;
  name: string;
  category: string;
  score: number;
}

const widgets: Widget[] = [
  { id: '1', name: 'Alpha Gear', category: 'tools', score: 3 },
  { id: '2', name: 'Beta Gadget', category: 'tools', score: 5 },
  { id: '3', name: 'Gamma Widget', category: 'toys', score: 1 },
];

const categoryField: FilterFieldConfig = {
  key: 'category',
  type: 'select',
  label: 'Category',
  options: [
    { value: 'tools', label: 'Tools' },
    { value: 'toys', label: 'Toys' },
  ],
  matches: (item, value) => (item as Widget).category === value,
};

const minScoreField: FilterFieldConfig = {
  key: 'minScore',
  type: 'number',
  label: 'Min Score',
  matches: (item, value) => (item as Widget).score >= value,
};

const setupHook = (filterFields: FilterFieldConfig[] = []) =>
  renderHook(() =>
    useEntitySearch(widgets, {
      searchableText: item => [item.name],
      filterFields,
    })
  );

describe('useEntitySearch', () => {
  it('filters by plain text search across the given fields', () => {
    const { result } = setupHook();

    act(() => result.current.setSearchQuery('gadget'));

    expect(result.current.results.map(w => w.id)).toEqual(['2']);
  });

  it('combines plain text search with advanced filters (AND semantics)', () => {
    const { result } = setupHook([categoryField]);

    act(() => {
      result.current.setSearchQuery('widget');
      result.current.setFilterValues({ category: 'tools' });
    });

    // "widget" only matches item 3, which is category "toys" — combined
    // filters should exclude it.
    expect(result.current.results).toHaveLength(0);
  });

  it('applies multiple advanced filters together, reading sibling values', () => {
    const { result } = setupHook([categoryField, minScoreField]);

    act(() =>
      result.current.setFilterValues({ category: 'tools', minScore: 4 })
    );

    expect(result.current.results.map(w => w.id)).toEqual(['2']);
  });

  it('reports how many filters are active, excluding a field left at its default', () => {
    const fieldWithDefault: FilterFieldConfig = {
      ...categoryField,
      defaultValue: 'tools',
    };
    const { result } = renderHook(() =>
      useEntitySearch(widgets, {
        searchableText: item => [item.name],
        filterFields: [fieldWithDefault],
        initialFilterValues: { category: 'tools' },
      })
    );

    expect(result.current.activeFilterCount).toBe(0);

    act(() => result.current.setFilterValues({ category: 'toys' }));
    expect(result.current.activeFilterCount).toBe(1);
  });

  it('still applies a field left at its default value (e.g. hide-by-default)', () => {
    const fieldWithDefault: FilterFieldConfig = {
      ...categoryField,
      defaultValue: 'tools',
    };
    const { result } = renderHook(() =>
      useEntitySearch(widgets, {
        searchableText: item => [item.name],
        filterFields: [fieldWithDefault],
        initialFilterValues: { category: 'tools' },
      })
    );

    // Default value still filters results even though it doesn't count
    // toward the visible active-filter badge.
    expect(result.current.results.map(w => w.id)).toEqual(['1', '2']);
  });

  it('clearFilters resets to the initial filter values', () => {
    const { result } = renderHook(() =>
      useEntitySearch(widgets, {
        searchableText: item => [item.name],
        filterFields: [categoryField],
        initialFilterValues: { category: 'tools' },
      })
    );

    act(() => result.current.setFilterValues({ category: 'toys' }));
    expect(result.current.results.map(w => w.id)).toEqual(['3']);

    act(() => result.current.clearFilters());
    expect(result.current.filterValues).toEqual({ category: 'tools' });
    expect(result.current.results.map(w => w.id)).toEqual(['1', '2']);
  });
});
