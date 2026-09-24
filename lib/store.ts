/* ---------- Жижиг гадаад store ----------
   Хуучин апп нь `filters`, `charts` гэх мэт модулийн түвшний хувьсагчаар
   ажилладаг байсан. React-д тэр л семантикийг хадгалахын тулд өгөгдлийн
   логик модулийн түвшний төлөвөө хэвээр хэрэглэж, харин компонентууд
   useSyncExternalStore-оор өөрчлөлтийг нь сонсдог болгов. */

import { useSyncExternalStore } from 'react';

export interface Store<T> {
  get(): T;
  set(next: T | ((prev: T) => T)): void;
  subscribe(fn: () => void): () => void;
}

export function createStore<T>(initial: T): Store<T> {
  let value = initial;
  const listeners = new Set<() => void>();
  return {
    get: () => value,
    set(next) {
      const v = typeof next === 'function' ? (next as (p: T) => T)(value) : next;
      if (Object.is(v, value)) return;
      value = v;
      listeners.forEach(l => l());
    },
    subscribe(fn) {
      listeners.add(fn);
      return () => { listeners.delete(fn); };
    }
  };
}

export function useStore<T>(store: Store<T>): T {
  return useSyncExternalStore(store.subscribe, store.get, store.get);
}

/* ---------- Дэлгэцийн төлөвүүд ---------- */

/** Идэвхтэй ArcGIS хүсэлтийн тоо — 0-ээс их бол spinner харагдана */
export const busyStore = createStore(0);

/** KPI мөр 1-ийн утгууд (index -> форматласан текст) */
export const kpiStore = createStore<Record<number, string>>({});

/** Газрын зургийн доод шошго: шүүлтүүрт тохирох хоршооны тоо */
export const mapCountStore = createStore<string>('—');

/** Газрын зургийн гарчиг (вэб зургийн portalItem.title-аар солигдоно) */
export const mapTitleStore = createStore<string>('Хоршооны мэдээлэл');
