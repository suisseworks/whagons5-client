import { normalizeFieldType, coerceBoolean, parseMultiValue, formatDateValueForInput } from './fieldHelpers';

export const deserializeCustomFieldValue = (row: any, field: any) => {
  const type = normalizeFieldType(field);
  const value = row?.value ?? row?.value_text;
  const valueNumeric = row?.value_numeric ?? row?.valueNumber;
  const valueDate = row?.value_date ?? row?.valueDate;
  const valueJson = row?.value_json ?? row?.valueJson;

  if (type === 'multi_select' || type === 'multi-select' || type === 'multi select') {
    if (Array.isArray(valueJson)) return valueJson.map((v: any) => String(v));
    if (value != null) return parseMultiValue(value);
    return [];
  }
  if (type === 'checkbox') {
    if (value != null) return coerceBoolean(value);
    if (valueNumeric != null) return Number(valueNumeric) === 1;
    return false;
  }
  if (type === 'number') {
    if (valueNumeric != null && Number.isFinite(Number(valueNumeric))) return Number(valueNumeric);
    if (value != null && String(value).length) {
      const num = Number(value);
      return Number.isFinite(num) ? num : '';
    }
    return '';
  }
  if (type === 'date' || type.startsWith('datetime')) {
    return formatDateValueForInput(valueDate ?? value, type);
  }
  if (type === 'time') {
    return value ?? '';
  }
  return value ?? '';
};

export const parseDefaultCustomFieldValue = (defaultValue: any, field: any) => {
  const type = normalizeFieldType(field);
  if (type === 'multi_select' || type === 'multi-select' || type === 'multi select') {
    return parseMultiValue(defaultValue);
  }
  if (type === 'checkbox') {
    if (defaultValue == null) return false;
    return coerceBoolean(defaultValue);
  }
  if (type === 'number') {
    if (defaultValue == null || defaultValue === '') return '';
    const num = Number(defaultValue);
    return Number.isFinite(num) ? num : '';
  }
  if (type === 'date' || type.startsWith('datetime')) {
    return formatDateValueForInput(defaultValue, type);
  }
  if (type === 'time') {
    return defaultValue ?? '';
  }
  return defaultValue ?? '';
};

export const isCustomFieldValueFilled = (field: any, raw: any): boolean => {
  const type = normalizeFieldType(field);
  if (type === 'multi_select' || type === 'multi-select' || type === 'multi select') {
    if (Array.isArray(raw)) return raw.length > 0;
    return String(raw ?? '').trim().length > 0;
  }
  if (type === 'checkbox') {
    return raw === true || raw === false || raw === 'true' || raw === 'false' || raw === 1 || raw === 0 || raw === '1' || raw === '0';
  }
  if (type === 'number') {
    if (raw === '' || raw == null) return false;
    return Number.isFinite(Number(raw));
  }
  return raw != null && String(raw).trim().length > 0;
};

export const serializeCustomFieldPayload = (field: any, raw: any) => {
  const type = normalizeFieldType(field);
  const base = { value: null as any, value_numeric: null as any, value_date: null as any, value_json: null as any };

  if (type === 'multi_select' || type === 'multi-select' || type === 'multi select') {
    const arr = Array.isArray(raw) ? raw.map((v) => String(v)).filter(Boolean) : parseMultiValue(raw);
    return {
      ...base,
      value: arr.length ? arr.join(',') : null,
      value_json: arr.length ? arr : [],
    };
  }
  if (type === 'checkbox') {
    if (raw == null || raw === '') return base;
    const bool = coerceBoolean(raw);
    return {
      ...base,
      value: bool ? 'true' : 'false',
      value_numeric: bool ? 1 : 0,
    };
  }
  if (type === 'number') {
    if (raw == null || raw === '') return base;
    const num = Number(raw);
    return {
      ...base,
      value: Number.isFinite(num) ? String(num) : null,
      value_numeric: Number.isFinite(num) ? num : null,
    };
  }
  if (type === 'date' || type.startsWith('datetime')) {
    if (!raw) return base;
    return {
      ...base,
      value: String(raw),
      value_date: String(raw),
    };
  }
  if (type === 'time') {
    return {
      ...base,
      value: raw == null || raw === '' ? null : String(raw),
    };
  }
  // TEXT, TEXTAREA, LIST, RADIO or fallback
  return {
    ...base,
    value: raw == null || String(raw).trim() === '' ? null : String(raw),
  };
};
