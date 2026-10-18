import { storage, StorageKeys } from '@/services/storage';
import { useLanguage } from './language';

jest.mock('@/services/storage', () => ({
  storage: {
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue(undefined),
  },
  StorageKeys: {
    language: 'app.language',
  },
}));

describe('language store', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    await useLanguage.getState().setLanguage('en');
  });

  it('defaults to English and returns English translations', () => {
    expect(useLanguage.getState().language).toBe('en');
    expect(useLanguage.getState().t('welcomeBack')).toBe('Welcome back');
    expect(useLanguage.getState().t('signInBtn')).toBe('Sign in');
  });

  it('updates language and persists to storage', async () => {
    await useLanguage.getState().setLanguage('fr');
    expect(useLanguage.getState().language).toBe('fr');
    expect(storage.set).toHaveBeenCalledWith(StorageKeys.language, 'fr');
    expect(useLanguage.getState().t('welcomeBack')).toBe('Bon retour');
    expect(useLanguage.getState().t('signInBtn')).toBe('Se connecter');
  });

  it('switches to Spanish and returns Spanish translations', async () => {
    await useLanguage.getState().setLanguage('es');
    expect(useLanguage.getState().language).toBe('es');
    expect(storage.set).toHaveBeenCalledWith(StorageKeys.language, 'es');
    expect(useLanguage.getState().t('welcomeBack')).toBe('Bienvenido de nuevo');
    expect(useLanguage.getState().t('signInBtn')).toBe('Iniciar sesión');
  });

  it('hydrates language from storage on initLanguage', async () => {
    (storage.get as jest.Mock).mockResolvedValueOnce('es');
    await useLanguage.getState().initLanguage();
    expect(useLanguage.getState().language).toBe('es');
    expect(useLanguage.getState().isHydrated).toBe(true);
  });

  it('interpolates parameters correctly in translations', () => {
    expect(useLanguage.getState().t('profileCompletionSub', { count: 85 })).toBe(
      'Your profile is 85% finished. Tap to add details.'
    );
  });
});
