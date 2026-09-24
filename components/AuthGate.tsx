'use client';

import { useEffect, type ReactNode } from 'react';
import { authStore, initAuth, signIn } from '@/lib/auth';
import { useStore } from '@/lib/store';

/**
 * Нэвтрэлтийн хаалт. NEXT_PUBLIC_ARCGIS_CLIENT_ID байхгүй бол (status 'disabled')
 * шууд дашбоардыг харуулна; байвал ArcGIS Online-оор нэвтэрсний дараа л харуулна.
 */
export default function AuthGate({ children }: { children: ReactNode }) {
  const auth = useStore(authStore);

  useEffect(() => { initAuth(); }, []);

  if (auth.status === 'disabled' || auth.status === 'signed-in') return <>{children}</>;

  return (
    <div className="auth-screen">
      <div className="auth-card">
        <h1>ХОРШООНЫ ЗЭЭЛИЙН МЭДЭЭЛЭЛ</h1>
        {auth.status === 'loading' && (
          <>
            <div className="spinner auth-spinner" />
            <p>Нэвтрэлт шалгаж байна…</p>
          </>
        )}
        {auth.status === 'signed-out' && (
          <>
            {auth.error && <p className="auth-error">{auth.error}</p>}
            <button className="auth-btn" onClick={signIn}>ArcGIS Online-оор нэвтрэх</button>
          </>
        )}
        {auth.status === 'error' && (
          <>
            <p className="auth-error">Нэвтрэлт шалгахад алдаа гарлаа: {auth.error}</p>
            <button className="auth-btn" onClick={() => window.location.reload()}>Дахин оролдох</button>
          </>
        )}
      </div>
    </div>
  );
}
