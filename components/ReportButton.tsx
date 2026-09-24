'use client';

import { useState } from 'react';
import { downloadReport } from '@/lib/report';

/** Толгойн "Тайлан" товч — харагдаж буй үзүүлэлтүүдийг .docx болгон татна */
export default function ReportButton() {
  const [busy, setBusy] = useState(false);

  const onClick = async () => {
    if (busy) return;
    setBusy(true);
    try { await downloadReport(); }
    finally { setBusy(false); }
  };

  return (
    <button id="report-btn" title="Тайлан татах (Word)" disabled={busy} onClick={onClick}>
      <svg viewBox="0 0 24 24" strokeWidth="2">
        <path d="M12 3v12" />
        <path d="M7 10l5 5 5-5" />
        <path d="M5 21h14" />
      </svg>
      <span>{busy ? 'Бэлтгэж байна…' : 'Тайлан'}</span>
    </button>
  );
}
