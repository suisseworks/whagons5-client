const STORAGE_PREFIX = "wh-settings";

const buildKey = (namespace: string) => `${STORAGE_PREFIX}:${namespace}`;

export function readSettingsLocal<T>(namespace: string, fallback: T): T {
	if (typeof window === "undefined") return fallback;
	try {
		const raw = window.localStorage.getItem(buildKey(namespace));
		if (!raw) return fallback;
		return JSON.parse(raw) as T;
	} catch {
		return fallback;
	}
}

export function writeSettingsLocal<T>(namespace: string, value: T): void {
	if (typeof window === "undefined") return;
	try {
		window.localStorage.setItem(buildKey(namespace), JSON.stringify(value));
	} catch {
		// Ignore quota/serialization errors
	}
}

export function updateSettingsLocal<T>(namespace: string, updater: (current: T) => T, fallback: T): T {
	const current = readSettingsLocal(namespace, fallback);
	const next = updater(current);
	writeSettingsLocal(namespace, next);
	return next;
}





