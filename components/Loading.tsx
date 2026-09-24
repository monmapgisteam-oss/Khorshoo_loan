'use client';

import { busyStore, useStore } from '@/lib/store';

/** Идэвхтэй ArcGIS хүсэлт байгаа үед баруун дээд буланд эргэлдэнэ */
export default function Loading() {
  const pending = useStore(busyStore);
  return (
    <div className={'loading' + (pending > 0 ? ' on' : '')}>
      <div className="spinner" />
    </div>
  );
}
