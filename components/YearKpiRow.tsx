import { YEAR_KPIS } from '@/lib/config';
import { fmtMoneyStr } from '@/lib/data';

/* Он бүр нэг нүд: төсөв ба гүйцэтгэл зэрэгцэн, хажууд нь гүйцэтгэлийн хувь */
export default function YearKpiRow() {
  return (
    <div className="kpi-row kpi-row-2">
      {YEAR_KPIS.map(y => {
        const pct = y.budget ? Math.round(y.actual / y.budget * 100) : null;
        return (
          <div className="kpi year-kpi" key={y.year}>
            <div className="y-year">{y.year} ОН</div>
            <div className="y-rows">
              <span className="y-key">Төсөв</span><span className="y-val">{fmtMoneyStr(y.budget)}</span>
              <span className="y-key">Гүйцэтгэл</span><span className="y-val y-act">{fmtMoneyStr(y.actual)}</span>
              <span className="y-key">Хувь</span><span className="y-val y-pct">{pct == null ? '—' : pct + '%'}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
