import type { NextConfig } from 'next';

/* Хуучин апп шиг цэвэр статик файл болгож экспортлоно (`out/` хавтас).
   Бүх өгөгдөл хөтчөөс шууд ArcGIS REST рүү явдаг тул сервер хэрэггүй.
   GitHub Pages дээр дэд замтай (жишээ нь /Khorshoo_loan) байршуулах бол
   NEXT_PUBLIC_BASE_PATH орчны хувьсагчаар зааж өгнө. */
const basePath = process.env.NEXT_PUBLIC_BASE_PATH || '';

const nextConfig: NextConfig = {
  output: 'export',
  basePath,
  assetPrefix: basePath || undefined,
  images: { unoptimized: true },
  reactStrictMode: true,
  // @arcgis/core ESM нь олон зуун chunk-тай — build-ийн лог хэт урт болохоос сэргийлнэ
  productionBrowserSourceMaps: false
};

export default nextConfig;
