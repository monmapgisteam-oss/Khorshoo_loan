import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Хоршооны зээлийн мэдээлэл',
  description: 'Хоршооны зээлийн мэдээлэл — ArcGIS dashboard-ийн веб апп'
};

export const viewport: Viewport = { width: 'device-width', initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="mn">
      <head>
        {/* ArcGIS Maps SDK-ийн dark сэдэв — @arcgis/core 4.31-тэй ижил хувилбар */}
        <link rel="stylesheet" href="https://js.arcgis.com/4.31/esri/themes/dark/main.css" />
      </head>
      <body>{children}</body>
    </html>
  );
}
