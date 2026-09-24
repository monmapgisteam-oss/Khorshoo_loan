'use client';

import { useEffect, useState } from 'react';
import { filterVersion, filters, setDateFilter } from '@/lib/data';
import { useStore } from '@/lib/store';

const CAL_ICON = 'M1 16h13V6H1v10zm10-9h2v2h-2V7zm0 3h2v2h-2v-2zm0 3h2v2h-2v-2zM8 7h2v2H8V7zm0 3h2v2H8v-2zm0 3h2v2H8v-2zM5 7h2v2H5V7zm0 3h2v2H5v-2zm0 3h2v2H5v-2zM2 7h2v2H2V7zm0 3h2v2H2v-2zm0 3h2v2H2v-2zm9-12V0h-1v1H5V0H4v1H1v4h13V1h-3zm2 3H2V2h2v1h1V2h5v1h1V2h2v2z';

interface Props {
  open: boolean;
  onToggle: () => void;
  onClose: () => void;
}

/** ОЛГОСОН ОГНОО-ны хугацааны шүүлтүүр (эхлэх / дуусах) */
export default function DateSelector({ open, onToggle, onClose }: Props) {
  useStore(filterVersion);
  const { dateFrom, dateTo } = filters;

  // Оролтын утга нь "Хэрэглэх" дартал шүүлтүүрт нөлөөлөхгүй ноорог
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  // Шүүлтүүр гаднаас өөрчлөгдвөл (жишээ нь Цэвэрлэх товч) оролтыг мөн тааруулна
  useEffect(() => { setFrom(dateFrom || ''); setTo(dateTo || ''); }, [dateFrom, dateTo]);

  const apply = () => { onClose(); setDateFilter(from || null, to || null); };
  const clear = () => { setFrom(''); setTo(''); onClose(); setDateFilter(null, null); };

  const state = (dateFrom || dateTo) ? `${dateFrom || '…'} — ${dateTo || '…'}` : 'No date selected';

  return (
    <div className={'sel date-sel' + (open ? ' open' : '')}>
      <button className="sel-btn" onClick={onToggle}>
        <svg className="sel-ico" viewBox="0 0 16 16"><path d={CAL_ICON} /></svg>
        <span className="sel-txt">
          <span className="sel-label">ОЛГОСОН ОГНОО</span>
          <span className="sel-state">{state}</span>
        </span>
      </button>
      <div className="sel-menu date-menu">
        <label>Эхлэх<input type="date" id="dateFrom" value={from} onChange={e => setFrom(e.target.value)} /></label>
        <label>Дуусах<input type="date" id="dateTo" value={to} onChange={e => setTo(e.target.value)} /></label>
        <div className="date-actions">
          <button className="mini-btn" onClick={apply}>Хэрэглэх</button>
          <button className="mini-btn ghost" onClick={clear}>Цэвэрлэх</button>
        </div>
      </div>
    </div>
  );
}
