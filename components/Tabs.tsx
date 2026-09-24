'use client';

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { resizeAllCharts } from '@/lib/charts';

export interface TabDef { id: string; label: string }

interface TabsProps {
  tabs: TabDef[];
  active: string;
  onChange: (id: string) => void;
  /** Багтахгүй үед харагдах ‹ › сумнууд */
  nav?: boolean;
}

/** Самбарын доод талын таб мөр (‹ › сумтай, гарчиг нь идэвхтэй табын нэр) */
export function Tabs({ tabs, active, onChange, nav = true }: TabsProps) {
  const stripRef = useRef<HTMLDivElement>(null);
  const [overflowing, setOverflowing] = useState(false);

  // Багтахгүй үед л ‹ › сумыг харуулна
  useEffect(() => {
    const strip = stripRef.current;
    if (!strip || !nav) return;
    const syncNav = () => setOverflowing(strip.scrollWidth > strip.clientWidth + 2);
    const ro = new ResizeObserver(syncNav);
    ro.observe(strip);
    syncNav();
    return () => ro.disconnect();
  }, [nav]);

  const scroll = (dir: -1 | 1) =>
    stripRef.current?.scrollBy({ left: dir * 110, behavior: 'smooth' });

  return (
    <div className={'tabs' + (overflowing ? ' overflowing' : '')}>
      {nav && <button className="tab-nav prev" onClick={() => scroll(-1)}>&#8249;</button>}
      <div className="tab-strip" ref={stripRef}>
        {tabs.map(t => (
          <button key={t.id}
                  className={'tab' + (t.id === active ? ' active' : '')}
                  onClick={() => onChange(t.id)}>
            {t.label}
          </button>
        ))}
      </div>
      {nav && <button className="tab-nav next" onClick={() => scroll(1)}>&#8250;</button>}
    </div>
  );
}

interface TabbedPanelProps {
  className?: string;
  tabs: (TabDef & { pane: ReactNode })[];
}

/**
 * Табтай самбар: гарчиг = идэвхтэй табын нэр, бүх pane DOM-д үлдэнэ
 * (далд canvas дээр график зурагдсан хэвээр байх ёстой), идэвхтэй нь л харагдана.
 */
export function TabbedPanel({ className = 'panel', tabs }: TabbedPanelProps) {
  const [active, setActive] = useState(tabs[0].id);
  const activeTab = tabs.find(t => t.id === active) || tabs[0];

  // Далд байсан canvas-ыг зөв хэмжээнд оруулах (хуучин activateTab-тай ижил)
  useLayoutEffect(() => { resizeAllCharts(); }, [active]);

  return (
    <section className={className}>
      <div className="panel-title">{activeTab.label}</div>
      <div className="tab-body">
        {tabs.map(t => (
          <div key={t.id} className={'tab-pane' + (t.id === active ? ' active' : '')}>
            {t.pane}
          </div>
        ))}
      </div>
      <Tabs tabs={tabs} active={active} onChange={setActive} />
    </section>
  );
}

/** Гарчигтай энгийн графикийн самбар */
export function ChartPanel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="panel chart-panel">
      <div className="panel-title">{title}</div>
      <div className="chart-wrap">{children}</div>
    </div>
  );
}
