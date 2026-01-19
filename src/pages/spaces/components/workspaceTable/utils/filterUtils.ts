/**
 * Utility functions for managing AG Grid filter models
 */

const ALLOWED_FILTER_KEYS = new Set(['status_id', 'priority_id', 'spot_id', 'user_ids', 'tag_ids', 'name', 'description', 'due_date']);

export const sanitizeFilterModel = (model: any): any => {
  if (!model || typeof model !== 'object') return {};
  const cleaned: any = {};
  for (const key of Object.keys(model)) {
    if (ALLOWED_FILTER_KEYS.has(key)) cleaned[key] = model[key];
  }
  return cleaned;
};

// Normalize a filter model for AG Grid's internal expectations (string keys for set filters)
export const normalizeFilterModelForGrid = (raw: any): any => {
  if (!raw || typeof raw !== 'object') return {};
  const fm = sanitizeFilterModel(raw);
  for (const key of ['status_id', 'priority_id', 'spot_id', 'user_ids', 'tag_ids']) {
    if (fm[key]) {
      const st = { ...fm[key] } as any;
      if ((st as any).filterType === 'set') {
        const rawValues: any[] = Array.isArray(st.values) ? st.values : [];
        st.values = rawValues.map((v) => String(v));
        fm[key] = st;
      }
    }
  }
  return fm;
};

export const normalizeFilterModelForQuery = (raw: any): any => {
  const fm = sanitizeFilterModel(raw);
  if (fm.status_id) {
    const st = { ...fm.status_id } as any;
    const rawValues: any[] = Array.isArray(st.values) ? st.values : [];
    const hasNonNumeric = rawValues.some((v) => isNaN(Number(v)));
    st.values = hasNonNumeric ? rawValues.map((v) => String(v)) : rawValues.map((v) => Number(v));
    fm.status_id = st;
  }
  // Text/date filters pass through unchanged
  for (const key of ['priority_id', 'spot_id', 'user_ids', 'tag_ids']) {
    if (fm[key]) {
      const st = { ...fm[key] } as any;
      const rawValues: any[] = Array.isArray(st.values) ? st.values : [];
      st.values = rawValues.map((v) => Number(v));
      fm[key] = st;
    }
  }
  return fm;
};
