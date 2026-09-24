'use client';

import { authStore, signOut } from '@/lib/auth';
import { useStore } from '@/lib/store';

/** Толгойд нэвтэрсэн хэрэглэгчийн нэр + Гарах товч (нэвтрэлт идэвхтэй үед л) */
export default function UserBadge() {
  const auth = useStore(authStore);
  if (auth.status !== 'signed-in') return null;
  return (
    <div className="user-badge" title={auth.user}>
      <span className="user-name">{auth.fullName || auth.user}</span>
      <button className="icon-btn user-out" title="Гарах" onClick={signOut}>Гарах</button>
    </div>
  );
}
