'use client';
import { useAuth } from './AuthContext';
import { getLocaleConfig } from '../../lib/locale/config';

function getCookieLocale() {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(/(?:^|;\s*)locale=([^;]+)/);
  return match?.[1] || null;
}

export default function useLocale() {
  const { user } = useAuth();
  const locale = user?.locale || getCookieLocale() || 'sg';
  return { locale, config: getLocaleConfig(locale) };
}
