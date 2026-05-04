import { afterEach, describe, expect, it } from "vitest";
import {
    clearFormatCache,
    formatFileSize,
    formatMoney,
    formatNumber,
    formatPercent,
    getFormatConfig,
    setFormatConfig,
} from "../../src";

describe("utils/formats", () => {
    const initialConfig = getFormatConfig();

    afterEach(() => {
        setFormatConfig(initialConfig);
        clearFormatCache();
    });

    it("updates and exposes global format configuration", () => {
        setFormatConfig({ locale: "en-US", currency: "USD" });

        expect(getFormatConfig()).toEqual({
            locale: "en-US",
            currency: "USD",
        });
    });

    it("formats money and numbers consistently", () => {
        setFormatConfig({ locale: "en-US", currency: "USD" });

        expect(formatMoney(1234.5, { decimals: 2 })).toBe("$1,234.50");
        expect(formatNumber(1234.5, { decimals: 1, locale: "en-US" })).toBe("1,234.5");
        expect(formatPercent(0.125, { decimals: 1, locale: "en-US" })).toBe("12.5%");
    });

    it("returns an empty string for invalid numeric values", () => {
        expect(formatMoney("not-a-number")).toBe("");
        expect(formatNumber(undefined)).toBe("0");
    });

    it("formats file sizes into readable units", () => {
        expect(formatFileSize(0)).toBe("0 Bytes");
        expect(formatFileSize(1024)).toBe("1.00 KB");
        expect(formatFileSize(1024 * 1024)).toBe("1.00 MB");
    });
});
