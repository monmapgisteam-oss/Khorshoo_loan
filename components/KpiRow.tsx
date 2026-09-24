'use client';

import { KPIS } from '@/lib/config';
import { KPI_ICONS } from '@/lib/icons';
import { kpiStore, useStore } from '@/lib/store';

/** Толгойн 7 үзүүлэлт — утга нь refresh() бүрд store-оор ирнэ */
export default function KpiRow() {
  const values = useStore(kpiStore);
  return (
    <div className="kpi-row">
      {KPIS.map((k, i) => (
        <div className="kpi" key={k.label}>
          <div className="k-label">{k.label}</div>
          <div className="k-main">
            <span className="k-icon" dangerouslySetInnerHTML={{ __html: KPI_ICONS[k.icon] || '' }} />
            <span className="k-value">{values[i] ?? '—'}</span>
          </div>
        </div>
      ))}
    </div>
  );
}
