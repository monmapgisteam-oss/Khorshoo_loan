'use client';

import { useCallback, useEffect, useState } from 'react';
import { SELECTORS } from '@/lib/config';
import { resetFilters } from '@/lib/data';
import Selector from './Selector';
import DateSelector from './DateSelector';
import ReportButton from './ReportButton';

/** Нээлттэй цэсний түлхүүр: сонгогчийн талбар | 'date' | null */
export type MenuKey = string | null;

export default function Header() {
  const [open, setOpen] = useState<MenuKey>(null);

  // Цэсний гадна дарахад бүх цэс хаагдана (хуучин document click-тэй ижил)
  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      const t = e.target as Element | null;
      if (t && t.closest && t.closest('.sel')) return;
      setOpen(null);
    };
    document.addEventListener('click', onDocClick);
    return () => document.removeEventListener('click', onDocClick);
  }, []);

  const toggle = useCallback((key: string) => setOpen(cur => (cur === key ? null : key)), []);
  const close  = useCallback(() => setOpen(null), []);

  return (
    <header className="topbar">
      <h1>ХОРШООНЫ ЗЭЭЛИЙН МЭДЭЭЛЭЛ</h1>
      <div className="selectors">
        {SELECTORS.map(cfg => (
          <Selector key={cfg.field} cfg={cfg} open={open === cfg.field} onToggle={() => toggle(cfg.field)} />
        ))}
        <DateSelector open={open === 'date'} onToggle={() => toggle('date')} onClose={close} />
        <ReportButton />
        <button id="resetBtn" className="icon-btn" title="Шүүлтүүр цэвэрлэх" onClick={resetFilters}>&#10227;</button>
      </div>
    </header>
  );
}
