import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import { DEFAULT_LOCALE, I18N_NAMESPACE } from "@mortly/core/i18nConfig";
// The SAME translation JSON the web serves at /locales/* — imported directly so
// the app and web share identical keys + copy. Metro bundles it from the
// monorepo (public/locales stays the single source; see @mortly/core/i18nConfig).
import ko from "../../../public/locales/ko/common.json";
import en from "../../../public/locales/en/common.json";

if (!i18n.isInitialized) {
  void i18n.use(initReactI18next).init({
    resources: {
      ko: { [I18N_NAMESPACE]: ko },
      en: { [I18N_NAMESPACE]: en },
    },
    lng: DEFAULT_LOCALE, // ko-default (TODO: device-locale detection via expo-localization)
    fallbackLng: DEFAULT_LOCALE,
    defaultNS: I18N_NAMESPACE,
    ns: [I18N_NAMESPACE],
    interpolation: { escapeValue: false },
    returnNull: false,
  });
}

export default i18n;
