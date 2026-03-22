'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function IdClientDashboard() {
  const router = useRouter();
  useEffect(() => {
    document.cookie = 'locale=id;path=/;max-age=86400';
    router.replace('/client/dashboard');
  }, []);
  return null;
}
