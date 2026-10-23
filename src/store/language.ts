import { create } from 'zustand';
import { storage, StorageKeys } from '@/services/storage';
import {
  LanguageCode,
  LanguageInfo,
  SUPPORTED_LANGUAGES,
  TranslationKey,
  translations,
} from '@/i18n/translations';

interface LanguageState {
  language: LanguageCode;
  isHydrated: boolean;
  setLanguage: (lang: LanguageCode) => Promise<void>;
  initLanguage: () => Promise<void>;
  t: (key: TranslationKey, params?: Record<string, string | number>) => string;
}

const createTranslate = (lang: LanguageCode) => {
  return (key: TranslationKey, params?: Record<string, string | number>): string => {
    const langDict = translations[lang] || translations.en;
    let text: string = langDict[key] || translations.en[key] || key;
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        text = text.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v));
      }
    }
    return text;
  };
};

export const useLanguage = create<LanguageState>((set) => ({
  language: 'en',
  isHydrated: false,
  t: createTranslate('en'),

  setLanguage: async (lang: LanguageCode) => {
    set({ language: lang, t: createTranslate(lang) });
    try {
      await storage.set(StorageKeys.language, lang);
    } catch {
      // ignore storage write failure
    }
  },

  initLanguage: async () => {
    try {
      const saved = await storage.get(StorageKeys.language);
      if (saved && (saved === 'en' || saved === 'fr' || saved === 'es' || saved === 'rw' || saved === 'sw')) {
        const validLang = saved as LanguageCode;
        set({
          language: validLang,
          isHydrated: true,
          t: createTranslate(validLang),
        });
        return;
      }
    } catch {
      // fallback to default
    }
    set({ isHydrated: true });
  },
}));

// Initialize language preference immediately upon module load
useLanguage.getState().initLanguage();

export { SUPPORTED_LANGUAGES, LanguageCode, LanguageInfo, TranslationKey };
