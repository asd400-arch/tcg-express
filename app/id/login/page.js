'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function IDLogin() {
  const router = useRouter();
  useEffect(() => {
    document.cookie = 'locale=id; path=/; max-age=31536000';
    router.replace('/login');
  }, []);
  return null;
}
