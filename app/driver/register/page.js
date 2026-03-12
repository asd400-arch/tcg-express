'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
export default function DriverRegister() {
  const router = useRouter();
  useEffect(() => { router.replace('/signup?role=driver'); }, []);
  return null;
}
