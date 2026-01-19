// Import api from internalApi (store layer) - actionsApi needs it for POST/PUT/PATCH/DELETE
// This is the only place outside store/ that can import api, and it's only for actions (no GET)
import { api } from '@/store/api/internalApi';

/**
 * UI-safe API surface: use for "actions" only (POST/PUT/PATCH/DELETE).
 * Intentionally does NOT expose GET, so pages/components can't accidentally become data loaders.
 */
export const actionsApi = {
  post: api.post.bind(api),
  put: api.put.bind(api),
  patch: api.patch.bind(api),
  delete: api.delete.bind(api),
};

