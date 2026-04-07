// =============================
// 🌍 Configuración global
// =============================
export interface FormatConfig {
    locale: string;
    currency: string;
}

let currentConfig: FormatConfig = {
    locale: 'es-CO',
    currency: 'COP',
};

export function setFormatConfig(config: Partial<FormatConfig>) {
    currentConfig = { ...currentConfig, ...config };
}

export function getFormatConfig(): FormatConfig {
    return currentConfig;
}

// =============================
// ⚡ Cache interno
// =============================
const numberFormatCache = new Map<string, Intl.NumberFormat>();
const dateFormatCache = new Map<string, Intl.DateTimeFormat>();
const relativeTimeCache = new Map<string, Intl.RelativeTimeFormat>();

const MAX_CACHE_SIZE = 50;

function setCache<K, V>(map: Map<K, V>, key: K, value: V) {
    if (map.size >= MAX_CACHE_SIZE) {
        const iterator = map.keys().next();
        if (!iterator.done) {
            map.delete(iterator.value);
        }
    }
    map.set(key, value);
}

export function clearFormatCache() {
    numberFormatCache.clear();
    dateFormatCache.clear();
    relativeTimeCache.clear();
}

// =============================
// 💰 Money
// =============================
export function formatMoney(
    value: number | string | null | undefined,
    options?: {
        decimals?: number;
        currency?: string;
        locale?: string;
    }
): string {
    const num = Number(value ?? 0);
    if (isNaN(num)) return '';

    const locale = options?.locale ?? currentConfig.locale;
    const currency = options?.currency ?? currentConfig.currency;
    const decimals = options?.decimals ?? 0;

    const key = `${locale}-money-${currency}-${decimals}`;

    let formatter = numberFormatCache.get(key);

    if (!formatter) {
        formatter = new Intl.NumberFormat(locale, {
            style: 'currency',
            currency,
            minimumFractionDigits: decimals,
            maximumFractionDigits: decimals,
            currencyDisplay: 'narrowSymbol',
        });

        setCache(numberFormatCache, key, formatter);
    }

    return formatter.format(num);
}

// =============================
// 💰 Money (code)
// =============================
export function formatMoneyCode(
    value: number | string | null | undefined,
    options?: {
        decimals?: number;
        currency?: string;
        locale?: string;
    }
): string {
    const num = Number(value ?? 0);
    if (isNaN(num)) return '';

    const locale = options?.locale ?? currentConfig.locale;
    const currency = options?.currency ?? currentConfig.currency;
    const decimals = options?.decimals ?? 0;

    return new Intl.NumberFormat(locale, {
        style: 'currency',
        currency,
        currencyDisplay: 'code',
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
    }).format(num);
}

// =============================
// 🔢 Number
// =============================
export function formatNumber(
    value: number | string | null | undefined,
    options?: {
        decimals?: number;
        locale?: string;
    }
): string {
    const num = Number(value ?? 0);
    if (isNaN(num)) return '';

    const locale = options?.locale ?? currentConfig.locale;
    const decimals = options?.decimals ?? 0;

    const key = `${locale}-number-${decimals}`;

    let formatter = numberFormatCache.get(key);

    if (!formatter) {
        formatter = new Intl.NumberFormat(locale, {
            minimumFractionDigits: decimals,
            maximumFractionDigits: decimals,
        });

        setCache(numberFormatCache, key, formatter);
    }

    return formatter.format(num);
}

// =============================
// 📊 Percent
// =============================
export function formatPercent(
    value: number | string | null | undefined,
    options?: {
        decimals?: number;
        locale?: string;
    }
): string {
    const num = Number(value ?? 0);
    if (isNaN(num)) return '';

    const locale = options?.locale ?? currentConfig.locale;
    const decimals = options?.decimals ?? 2;

    const key = `${locale}-percent-${decimals}`;

    let formatter = numberFormatCache.get(key);

    if (!formatter) {
        formatter = new Intl.NumberFormat(locale, {
            style: 'percent',
            minimumFractionDigits: decimals,
            maximumFractionDigits: decimals,
        });

        setCache(numberFormatCache, key, formatter);
    }

    return formatter.format(num);
}

// =============================
// 📉 Compact number (1K, 1M)
// =============================
export function formatCompactNumber(
    value: number | string | null | undefined,
    options?: {
        locale?: string;
    }
): string {
    const num = Number(value ?? 0);
    if (isNaN(num)) return '';

    const locale = options?.locale ?? currentConfig.locale;

    const key = `${locale}-compact`;

    let formatter = numberFormatCache.get(key);

    if (!formatter) {
        formatter = new Intl.NumberFormat(locale, {
            notation: 'compact',
        });

        setCache(numberFormatCache, key, formatter);
    }

    return formatter.format(num);
}

// =============================
// 📅 Date
// =============================
export function formatDate(
    value: string | number | Date | null | undefined,
    options?: {
        locale?: string;
        format?: Intl.DateTimeFormatOptions;
    }
): string {
    if (!value) return '';

    try {
        const date = new Date(value);
        if (isNaN(date.getTime())) return '';

        const locale = options?.locale ?? currentConfig.locale;
        const format = options?.format ?? {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
        };

        const key = `${locale}-${JSON.stringify(format)}`;

        let formatter = dateFormatCache.get(key);

        if (!formatter) {
            formatter = new Intl.DateTimeFormat(locale, format);
            setCache(dateFormatCache, key, formatter);
        }

        return formatter.format(date);
    } catch {
        return '';
    }
}

// =============================
// 📅 DateTime
// =============================
export function formatDateTime(
    value: string | number | Date | null | undefined,
    options?: {
        locale?: string;
    }
): string {
    return formatDate(value, {
        locale: options?.locale,
        format: {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
        },
    });
}

// =============================
// ⏱ Relative time
// =============================
export function formatRelativeTime(
    value: number,
    unit: Intl.RelativeTimeFormatUnit,
    options?: {
        locale?: string;
    }
): string {
    const locale = options?.locale ?? currentConfig.locale;

    const key = `${locale}-relative`;

    let formatter = relativeTimeCache.get(key);

    if (!formatter) {
        formatter = new Intl.RelativeTimeFormat(locale, {
            numeric: 'auto',
        });

        setCache(relativeTimeCache, key, formatter);
    }

    return formatter.format(value, unit);
}

// =============================
// 📦 File size
// =============================
export function formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';

    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));

    return `${(bytes / Math.pow(1024, i)).toFixed(2)} ${sizes[i]}`;
}