'use client';
import { getLocaleConfig } from '../../lib/locale/config';

export default function useLocale() {
  return { locale: 'sg', config: getLocaleConfig('sg') };
}
