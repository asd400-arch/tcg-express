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
  // Cookie takes priority: /id/login explicitly sets locale=id cookie,
  // which should override the stored DB value for the session.
  const locale = getCookieLocale() || user?.locale || 'sg';
  return { locale, config: getLocaleConfig(locale) };
}
