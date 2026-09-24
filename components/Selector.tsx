'use client';

import { useEffect, useRef, useState } from 'react';
import { SVC, type SelectorDef } from '@/lib/config';
import { buildWhere, commitFilters, filterVersion, filters, fmtNum, queryStats, toggleFilterValue } from '@/lib/data';
import { useStore } from '@/lib/store';

const SEARCH_ICON = 'M15.364 14.636L9.735 9.008a5.5 5.5 0 1 0-.706.708l5.628 5.627.707-.707zM1 5.5C1 3.019 3.019 1 5.5 1S10 3.019 10 5.5 7.981 10 5.5 10 1 7.981 1 5.5z';

interface Option { raw: string; label: string; n: number }

interface Props {
  cfg: SelectorDef;
  open: boolean;
  onToggle: () => void;
}

/**
 * Олон сонголттой, хайлттай шүүлтүүрийн сонгогч.
 * Жагсаалт нь бусад шүүлтүүрээр каскадлагдана (өөрийн талбарыг алгасна) —
 * АЙМАГ сонгоход СУМ-ын жагсаалт нарийсна. Хамгийн сүүлд ачаалсан WHERE-ийг
 * кэшлэж, өөрчлөгдөөгүй бол дахин татахгүй.
 */
export default function Selector({ cfg, open, onToggle }: Props) {
  // Шүүлтүүр өөрчлөгдөх бүрд шошго, чагт дахин зурагдана
  useStore(filterVersion);
  const [options, setOptions] = useState<Option[] | null>(null);
  const [q, setQ] = useState('');
  const loadedWhere = useRef<string | null>(null);
  const reqId = useRef(0);

  const where = buildWhere([cfg.field]);

  /* Нээлттэй үед л ачаална; WHERE өөрчлөгдөөгүй бол хуучин жагсаалтаа хэрэглэнэ */
  useEffect(() => {
    if (!open || loadedWhere.current === where) return;
    const my = ++reqId.current;
    queryStats(SVC.loans, {
      where,
      groupBy: cfg.field,
      stats: [{ onStatisticField: 'OBJECTID', statisticType: 'count', outStatisticFieldName: 'n' }],
      orderBy: cfg.field + ' ASC',
      limit: 1000
    }).then(rows => {
      if (my !== reqId.current) return;
      loadedWhere.current = where;
      setOptions(rows
        .filter(r => r[cfg.field] != null && r[cfg.field] !== '')
        .map(r => {
          const raw = String(r[cfg.field]);
          return { raw, label: (cfg.labelOverrides && cfg.labelOverrides[raw]) || raw, n: r.n };
        }));
    }).catch(err => console.error('Сонгогчийн жагсаалт ачаалахад:', err));
  }, [open, where, cfg]);

  const set = filters[cfg.field];
  const selected = [...set];
  const lbl = (v: string) => (cfg.labelOverrides && cfg.labelOverrides[v]) || v;
  const state = !selected.length ? 'No category selected'
    : selected.length === 1 ? lbl(selected[0])
    : `${selected.length} сонгосон`;

  const ql = q.toLowerCase();
  // Хуучин апп мөрийн бүх текстээр (нэр + тоо) хайдаг байсан
  const visible = (options || []).filter(o => (o.label + fmtNum(o.n)).toLowerCase().includes(ql));

  const selectAllVisible = () => commitFilters(() => { visible.forEach(o => set.add(o.raw)); });
  const clearAll = () => commitFilters(() => { set.clear(); });

  return (
    <div className={'sel' + (open ? ' open' : '')} data-field={cfg.field}>
      <button className="sel-btn" onClick={onToggle}>
        <svg className="sel-ico" viewBox="0 0 16 16"><path d={SEARCH_ICON} /></svg>
        <span className="sel-txt">
          <span className="sel-label">{cfg.label}</span>
          <span className="sel-state">{state}</span>
        </span>
      </button>
      <div className="sel-menu">
        {options === null ? (
          <div className="sel-empty">Уншиж байна…</div>
        ) : (
          <>
            <div className="sel-head">
              <div className="sel-search-wrap">
                <svg className="sel-search-ico" viewBox="0 0 16 16"><path d={SEARCH_ICON} /></svg>
                <input className="sel-search" type="text" placeholder="Хайх…"
                       value={q} onChange={e => setQ(e.target.value)} />
              </div>
              <div className="sel-tools">
                <button className="sel-act" onClick={selectAllVisible}>Бүгдийг сонгох</button>
                <button className="sel-act" onClick={clearAll}>Цэвэрлэх</button>
                <span className="sel-total">{options.length}</span>
              </div>
            </div>
            <div className="sel-list">
              {options.length === 0 && <div className="sel-empty">Утга олдсонгүй</div>}
              {options.map(o => {
                const on = set.has(o.raw);
                const shown = visible.includes(o);
                return (
                  <label key={o.raw} className={'sel-item' + (on ? ' selected' : '')}
                         style={shown ? undefined : { display: 'none' }}>
                    <input type="checkbox" value={o.raw} checked={on}
                           onChange={() => toggleFilterValue(cfg.field, o.raw)} />
                    <span className="cbx" />
                    <span className="nm">{o.label}</span>
                    <span className="n">{fmtNum(o.n)}</span>
                  </label>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
