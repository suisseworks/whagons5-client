export const normalizeFieldType = (field: any): string => {
  return String(field?.field_type ?? field?.type ?? '').toLowerCase();
};

export const coerceBoolean = (v: any): boolean => {
  if (typeof v === 'boolean') return v;
  if (v == null) return false;
  const s = String(v).toLowerCase();
  return s === 'true' || s === '1' || s === 'yes' || s === 'y' || s === 'on';
};

export const parseFieldOptions = (field?: any): Array<{ value: string; label: string }> => {
  if (!field) return [];
  const raw = field.options;
  try {
    if (Array.isArray(raw)) {
      return raw.map((o: any) => {
        if (typeof o === 'string') return { value: o, label: o };
        if (o && typeof o === 'object') {
          const value = String(o.value ?? o.id ?? o.name ?? '');
          const label = String(o.label ?? o.name ?? value);
          return { value, label };
        }
        return { value: String(o), label: String(o) };
      });
    }
    if (typeof raw === 'string' && raw.trim().length) {
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          return parsed.map((o: any) => {
            if (typeof o === 'string') return { value: o, label: o };
            const value = String(o.value ?? o.id ?? o.name ?? '');
            const label = String(o.label ?? o.name ?? value);
            return { value, label };
          });
        }
      } catch {}
      const parts = raw.split(',').map((p) => p.trim()).filter(Boolean);
      return parts.map((p) => ({ value: p, label: p }));
    }
  } catch {}
  return [];
};

export const parseMultiValue = (val: any): string[] => {
  if (Array.isArray(val)) return val.map((v) => String(v));
  if (val == null) return [];
  try {
    const parsed = JSON.parse(val);
    if (Array.isArray(parsed)) return parsed.map((v: any) => String(v));
  } catch {}
  return String(val)
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
};

export const formatDateValueForInput = (val: any, type: string): string => {
  if (!val) return '';
  const t = (type || '').toLowerCase();
  if (t === 'time') {
    return String(val);
  }
  const d = new Date(val);
  if (!Number.isNaN(d.getTime())) {
    if (t === 'date') return d.toISOString().slice(0, 10);
    if (t.startsWith('datetime')) return d.toISOString().slice(0, 16);
  }
  return String(val);
};

export const normalizeDefaultUserIds = (ids: any): number[] => {
  if (!Array.isArray(ids)) return [];
  return ids
    .map((id: any) => Number(id))
    .filter((n) => Number.isFinite(n));
};
