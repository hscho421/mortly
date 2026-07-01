import type { TFunction } from "i18next";
import {
  getProductsForCategory,
  INCOME_TYPES,
  TIMELINE_OPTIONS,
  PROVINCES,
  PRODUCT_LABEL_KEYS,
  INCOME_TYPE_LABEL_KEYS,
  TIMELINE_LABEL_KEYS,
} from "@mortly/core/requestConfig";
import type { Option } from "@/components/form";

/**
 * Picker option lists for the create-request form, built from the shared
 * @mortly/core config + the SAME `request.*` i18n keys the web uses (so labels
 * are already translated in common.json — no new keys).
 */

export function productOptions(category: string, t: TFunction): Option<string>[] {
  return getProductsForCategory(category).map((value) => ({
    value,
    label: t(PRODUCT_LABEL_KEYS[value] ?? value, value),
  }));
}

export function incomeOptions(t: TFunction): Option<string>[] {
  return INCOME_TYPES.map((value) => ({
    value,
    label: t(INCOME_TYPE_LABEL_KEYS[value] ?? value, value),
  }));
}

export function timelineOptions(t: TFunction): Option<string>[] {
  return TIMELINE_OPTIONS.map((value) => ({
    value,
    label: t(TIMELINE_LABEL_KEYS[value] ?? value, value),
  }));
}

export function provinceOptions(): Option<string>[] {
  return PROVINCES.map((value) => ({ value, label: value }));
}

export function categoryOptions(t: TFunction): Option<"RESIDENTIAL" | "COMMERCIAL">[] {
  return [
    { value: "RESIDENTIAL", label: t("request.categoryResidential", "주거용") },
    { value: "COMMERCIAL", label: t("request.categoryCommercial", "상업용") },
  ];
}
