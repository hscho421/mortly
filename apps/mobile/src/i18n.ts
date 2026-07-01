import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import { getLocales } from "expo-localization";
import { DEFAULT_LOCALE, I18N_NAMESPACE, isLocale } from "@mortly/core/i18nConfig";
// The SAME translation JSON the web serves at /locales/* — imported directly so
// the app and web share identical keys + copy. Metro bundles it from the
// monorepo (public/locales stays the single source; see @mortly/core/i18nConfig).
import ko from "../../../public/locales/ko/common.json";
import en from "../../../public/locales/en/common.json";

/**
 * Initial language from the device: ko-default (Korean-first, like the web),
 * switching to a supported non-default locale (en) only when the device's
 * primary language matches one. No in-app switcher — web convention.
 */
function initialLocale(): string {
  const device = getLocales()[0]?.languageCode ?? "";
  return isLocale(device) ? device : DEFAULT_LOCALE;
}

if (!i18n.isInitialized) {
  void i18n.use(initReactI18next).init({
    resources: {
      ko: { [I18N_NAMESPACE]: ko },
      en: { [I18N_NAMESPACE]: en },
    },
    lng: initialLocale(),
    fallbackLng: DEFAULT_LOCALE,
    defaultNS: I18N_NAMESPACE,
    ns: [I18N_NAMESPACE],
    interpolation: { escapeValue: false },
    returnNull: false,
  });
}

export default i18n;
