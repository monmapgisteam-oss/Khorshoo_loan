'use client';

import dynamic from 'next/dynamic';

/* Дашбоард бүхэлдээ хөтчийн API (canvas, Chart.js, ArcGIS view) дээр
   тулгуурладаг тул серверт render хийхгүй, зөвхөн клиент дээр ачаална. */
const Dashboard = dynamic(() => import('@/components/Dashboard'), { ssr: false });

export default function Page() {
  return <Dashboard />;
}
