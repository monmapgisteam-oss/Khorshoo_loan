'use client';

import dynamic from 'next/dynamic';

/* Апп бүхэлдээ хөтчийн API (canvas, Chart.js, ArcGIS view, IdentityManager)
   дээр тулгуурладаг тул серверт render хийхгүй, зөвхөн клиент дээр ачаална. */
const App = dynamic(() => import('@/components/App'), { ssr: false });

export default function Page() {
  return <App />;
}
