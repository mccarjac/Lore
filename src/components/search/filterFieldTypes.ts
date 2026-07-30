export type FilterValues = Record<string, unknown>;

export interface SelectFilterField {
  key: string;
  type: 'select';
  label: string;
  options: { value: string; label: string }[];
  defaultValue?: string;
  matches: (item: unknown, value: string, allValues: FilterValues) => boolean;
}

export interface NumberFilterField {
  key: string;
  type: 'number';
  label: string;
  placeholder?: string;
  matches: (item: unknown, value: number, allValues: FilterValues) => boolean;
}

export type FilterFieldConfig = SelectFilterField | NumberFilterField;

// A field has a usable value to filter with, whether or not that value is
// the field's own default (e.g. a "hide retired by default" field is still
// applied even though it shouldn't count as a user-visible active filter).
export function isFieldSet(value: unknown): boolean {
  return value !== undefined && value !== null && value !== '';
}

// Whether a field should surface as an active filter to the user (badge
// count, chip row) — set, and not silently sitting at its own default.
export function isFilterValueActive(
  field: FilterFieldConfig,
  value: unknown
): boolean {
  if (!isFieldSet(value)) {
    return false;
  }
  if (field.type === 'select') {
    return value !== field.defaultValue;
  }
  return true;
}

export function optionLabel(field: SelectFilterField, value: string): string {
  return field.options.find(option => option.value === value)?.label ?? value;
}
