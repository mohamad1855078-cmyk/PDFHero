import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

export type DateFormat = 'gregorian' | 'hijri';
export type NumberFormat = 'western' | 'arabic';
export type TextSize = 'small' | 'medium' | 'large' | 'xlarge';
export type ColorTheme = 'green' | 'blue' | 'purple' | 'orange';

export interface UserPreferences {
  dateFormat: DateFormat;
  numberFormat: NumberFormat;
  textSize: TextSize;
  colorTheme: ColorTheme;
  highContrast: boolean;
  reducedMotion: boolean;
  showTooltips: boolean;
  favoriteTools: string[];
  tutorialCompleted: boolean;
  defaultPageSize: 'A4' | 'Letter';
}

const defaultPreferences: UserPreferences = {
  dateFormat: 'gregorian',
  numberFormat: 'western',
  textSize: 'medium',
  colorTheme: 'green',
  highContrast: false,
  reducedMotion: false,
  showTooltips: true,
  favoriteTools: [],
  tutorialCompleted: false,
  defaultPageSize: 'A4',
};

interface PreferencesContextType {
  preferences: UserPreferences;
  updatePreference: <K extends keyof UserPreferences>(key: K, value: UserPreferences[K]) => void;
  resetPreferences: () => void;
  toggleFavorite: (toolId: string) => void;
  isFavorite: (toolId: string) => boolean;
  formatNumber: (num: number) => string;
  formatDate: (date: Date) => string;
}

const PreferencesContext = createContext<PreferencesContextType | undefined>(undefined);

const STORAGE_KEY = 'pdf-master-preferences';

const arabicNumerals = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];

function toArabicNumerals(num: number): string {
  return num.toString().split('').map(digit => {
    const n = parseInt(digit);
    return isNaN(n) ? digit : arabicNumerals[n];
  }).join('');
}

function toHijriDate(date: Date, locale: 'ar' | 'en'): string {
  try {
    return new Intl.DateTimeFormat(locale === 'ar' ? 'ar-SA-u-ca-islamic' : 'en-u-ca-islamic', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }).format(date);
  } catch {
    return date.toLocaleDateString(locale === 'ar' ? 'ar-SA' : 'en-US');
  }
}

function toGregorianDate(date: Date, locale: 'ar' | 'en'): string {
  return new Intl.DateTimeFormat(locale === 'ar' ? 'ar-SA' : 'en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(date);
}

export function PreferencesProvider({ children }: { children: React.ReactNode }) {
  const [preferences, setPreferences] = useState<UserPreferences>(() => {
    if (typeof window === 'undefined') return defaultPreferences;
    
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        return { ...defaultPreferences, ...parsed };
      }
    } catch (e) {
      console.error('Failed to load preferences:', e);
    }
    return defaultPreferences;
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences));
    } catch (e) {
      console.error('Failed to save preferences:', e);
    }

    const root = document.documentElement;
    
    root.setAttribute('data-text-size', preferences.textSize);
    root.setAttribute('data-high-contrast', preferences.highContrast.toString());
    root.setAttribute('data-reduced-motion', preferences.reducedMotion.toString());
    root.setAttribute('data-color-theme', preferences.colorTheme);

    if (preferences.highContrast) {
      root.classList.add('high-contrast');
    } else {
      root.classList.remove('high-contrast');
    }
    
    if (preferences.reducedMotion) {
      root.classList.add('reduced-motion');
    } else {
      root.classList.remove('reduced-motion');
    }
  }, [preferences]);

  const updatePreference = useCallback(<K extends keyof UserPreferences>(
    key: K,
    value: UserPreferences[K]
  ) => {
    setPreferences(prev => ({ ...prev, [key]: value }));
  }, []);

  const resetPreferences = useCallback(() => {
    setPreferences(defaultPreferences);
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  const toggleFavorite = useCallback((toolId: string) => {
    setPreferences(prev => {
      const favorites = prev.favoriteTools.includes(toolId)
        ? prev.favoriteTools.filter(id => id !== toolId)
        : [...prev.favoriteTools, toolId];
      return { ...prev, favoriteTools: favorites };
    });
  }, []);

  const isFavorite = useCallback((toolId: string) => {
    return preferences.favoriteTools.includes(toolId);
  }, [preferences.favoriteTools]);

  const formatNumber = useCallback((num: number): string => {
    if (preferences.numberFormat === 'arabic') {
      return toArabicNumerals(num);
    }
    return num.toLocaleString('en-US');
  }, [preferences.numberFormat]);

  const formatDate = useCallback((date: Date): string => {
    const storedLang = localStorage.getItem('pdf-master-language') || 'en';
    const locale = storedLang as 'ar' | 'en';
    
    if (preferences.dateFormat === 'hijri') {
      return toHijriDate(date, locale);
    }
    return toGregorianDate(date, locale);
  }, [preferences.dateFormat]);

  return (
    <PreferencesContext.Provider value={{
      preferences,
      updatePreference,
      resetPreferences,
      toggleFavorite,
      isFavorite,
      formatNumber,
      formatDate,
    }}>
      {children}
    </PreferencesContext.Provider>
  );
}

export function usePreferences() {
  const context = useContext(PreferencesContext);
  if (!context) {
    throw new Error('usePreferences must be used within a PreferencesProvider');
  }
  return context;
}
