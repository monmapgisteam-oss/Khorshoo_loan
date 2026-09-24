/* ---------- Дашбоардын өгөгдөл татах, график зурах гол логик ----------
   (хуучин js/app.js-ийн 4–6-р хэсэг). DOM-той шууд харьцахгүй: KPI, тоо зэрэг
   утгыг store-д бичиж, график нь canvas id-гаар зурагдана. */

import { AREA_COLOR, BAR_COLOR, F, KPIS, SOUM_LIMIT, SVC, purposeCode } from './config';
import {
  andWhere, buildWhere, filters, fmtMoneyStr, fmtNum, grouped, queryCount, queryStats, sqlStr,
  toggleFilterValue, toggleSoumFilter, type Attributes
} from './data';
import { areaChart, donutChart, hBarChart, type HBarOpts, type Row } from './charts';
import { setMapWhere } from './map';
import { kpiStore, mapCountStore } from './store';

/* ===== Он-оор бүлэглэх туслах ===== */
export async function statsByYear(url: string, dateField: string, valueField: string, where: string): Promise<Row[]> {
  const rows = await queryStats(url, {
    where: andWhere(where, `${dateField} IS NOT NULL`),
    groupBy: `EXTRACT(YEAR FROM "${dateField}")`,
    stats: [{ onStatisticField: valueField, statisticType: 'sum', outStatisticFieldName: 'v' }]
  });
  return rows
    .map(r => ({ key: r.EXPR_1 != null ? r.EXPR_1 : r.EXPR_0, value: r.v || 0 }))
    .filter(r => r.key != null)
    .sort((a, b) => a.key - b.key);
}

/* ===== Графикаас шүүх ===== */
/* Багана дээр дарахад холбогдох толгойн шүүлтүүр асаж/унтарна. Тухайн график
   өөрийнхөө талбарыг шүүлтээс хассан тул дарсны дараа ч бүх ангилал хэвээр
   харагдаж, өөр ангилал руу шууд дарах боломжтой (сонгосон нь тодорно). */

const picked = (field: typeof F.aimag | typeof F.soum | typeof F.purpose | typeof F.bank) =>
  (k: string) => filters[field].has(k);

/**
 * Сумаар бүлэглэсэн баганан график.
 * Сумын нэр аймаг хооронд давхардана (жишээ нь "Булган" 6 аймагт) тул
 * аймаг-сумын хосоор бүлэглэж, зөвхөн давхардсан нэрэнд аймгийг нь хавсаргана.
 */
function soumChart(id: string, where: string, statField: string, statType: 'sum' | 'count', opts: HBarOpts){
  return queryStats(SVC.loans, {
    where,
    groupBy: `${F.soum},${F.aimag}`,
    stats: [{ onStatisticField: statField, statisticType: statType, outStatisticFieldName: 'v' }],
    orderBy: 'v DESC', limit: SOUM_LIMIT
  }).then(rows => {
    const valid = rows.filter(r => r[F.soum]);
    const seen: Record<string, number> = {};
    valid.forEach(r => { seen[r[F.soum]] = (seen[r[F.soum]] || 0) + 1; });

    const short = new Map<string, string>();
    const parts = new Map<string, { soum: string; aimag: string }>();
    const data: Row[] = valid.map(r => {
      const key = `${r[F.soum]}, ${r[F.aimag]}`;
      short.set(key, seen[r[F.soum]] > 1 ? `${r[F.soum]} (${r[F.aimag]})` : r[F.soum]);
      parts.set(key, { soum: r[F.soum], aimag: r[F.aimag] });
      return { key, value: r.v || 0 };
    });
    hBarChart(id, data, Object.assign({
      axisLabel: (k: string) => short.get(k) || k,
      selected:  (k: string) => filters[F.soum].has((parts.get(k) || {} as any).soum),
      onSelect:  (k: string) => { const p = parts.get(k); if (p) toggleSoumFilter(p.soum, p.aimag); }
    }, opts));
  });
}

function setKpi(index: number, text: string){
  kpiStore.set(prev => prev[index] === text ? prev : { ...prev, [index]: text });
}

/* ===== Шүүлтүүрт хамаарах виджетүүд ===== */
export function refresh() {
  const where = buildWhere();
  // График өөрийн талбараа шүүхгүй — эс тэгвээс дарсны дараа ганц багана үлдэж,
  // өөр ангилал руу дарах боломжгүй болно
  const wNoAimag   = buildWhere([F.aimag]);
  const wNoSoum    = buildWhere([F.soum]);
  const wNoBank    = buildWhere([F.bank]);
  const wNoPurpose = buildWhere([F.purpose]);
  setMapWhere(where);

  /* --- KPI мөр 1: нийлбэрүүд нэг асуулгаар --- */
  const sumFields = KPIS.filter(k => k.stat === 'sum');
  queryStats(SVC.loans, {
    where,
    stats: sumFields.map((k, i) => ({ onStatisticField: k.field, statisticType: 'sum', outStatisticFieldName: 's' + i }))
  }).then(rows => {
    const a = rows[0] || {};
    sumFields.forEach((k, i) => setKpi(KPIS.indexOf(k), fmtMoneyStr(a['s' + i] || 0)));
  });

  KPIS.forEach((k, i) => {
    if (k.kind !== 'count') return;
    queryCount(SVC.loans, andWhere(where, k.extraWhere))
      .then(n => setKpi(i, fmtNum(n)));
  });
  queryCount(SVC.loans, where).then(n => mapCountStore.set(fmtNum(n)));

  /* --- Аймгаар: олгосон дүн / зээлийн тоо --- */
  queryStats(SVC.loans, {
    where: wNoAimag, groupBy: F.aimag,
    stats: [{ onStatisticField: F.issuedAmt, statisticType: 'sum', outStatisticFieldName: 'v' }],
    orderBy: 'v DESC', limit: 1000
  }).then(rows => hBarChart('chartAimagAmount',
    rows.filter(r => r[F.aimag]).map(r => ({ key: r[F.aimag], value: r.v || 0 })),
    { valueFmt: fmtMoneyStr, labelFmt: fmtMoneyStr, color: BAR_COLOR, measure: 'Олгосон зээлийн дүн',
      selected: picked(F.aimag), onSelect: k => toggleFilterValue(F.aimag, k) }));

  queryStats(SVC.loans, {
    where: wNoAimag, groupBy: F.aimag,
    stats: [{ onStatisticField: 'OBJECTID', statisticType: 'count', outStatisticFieldName: 'v' }],
    orderBy: 'v DESC', limit: 1000
  }).then(rows => hBarChart('chartAimagCount',
    rows.filter(r => r[F.aimag]).map(r => ({ key: r[F.aimag], value: r.v || 0 })),
    { valueFmt: fmtNum, labelFmt: fmtNum, color: BAR_COLOR, measure: 'Зээлийн тоо',
      selected: picked(F.aimag), onSelect: k => toggleFilterValue(F.aimag, k) }));

  /* --- Банкаар --- */
  queryStats(SVC.loans, {
    where: wNoBank, groupBy: F.bank,
    stats: [{ onStatisticField: F.issuedAmt, statisticType: 'sum', outStatisticFieldName: 'v' }],
    orderBy: 'v DESC', limit: 1000
  }).then(rows => hBarChart('chartBank',
    rows.filter(r => r[F.bank]).map(r => ({ key: r[F.bank], value: r.v || 0 })),
    { valueFmt: fmtMoneyStr, labelFmt: fmtMoneyStr, color: BAR_COLOR, measure: 'Олгосон зээлийн дүн',
      selected: picked(F.bank), onSelect: k => toggleFilterValue(F.bank, k) }));

  /* --- Зээлийн зориулалтаар --- */
  queryStats(SVC.loans, {
    where: andWhere(wNoPurpose, `${F.purpose} <> '-'`), groupBy: F.purpose,
    stats: [{ onStatisticField: F.issuedAmt, statisticType: 'sum', outStatisticFieldName: 'v' }],
    orderBy: 'v DESC', limit: 1000
  }).then(rows => hBarChart('chartPurpose',
    rows.filter(r => r[F.purpose]).map(r => ({ key: r[F.purpose], value: r.v || 0 })),
    { valueFmt: fmtMoneyStr, labelFmt: fmtMoneyStr, color: BAR_COLOR, axisLabel: purposeCode, measure: 'Олгосон зээлийн дүн',
      selected: picked(F.purpose), onSelect: k => toggleFilterValue(F.purpose, k) }));

  drawLivestock();

  /* --- Сумаар: олгосон дүн / зээлийн тоо --- */
  soumChart('chartSoumAmount', wNoSoum, F.issuedAmt, 'sum',
    { valueFmt: fmtMoneyStr, labelFmt: fmtMoneyStr, color: BAR_COLOR, measure: 'Олгосон зээлийн дүн' });
  soumChart('chartSoumCount', wNoSoum, 'OBJECTID', 'count',
    { valueFmt: fmtNum, labelFmt: fmtNum, color: BAR_COLOR, measure: 'Зээлийн тоо' });

  /* --- Огноогоор --- */
  statsByYear(SVC.loans, F.issuedDate, F.issuedAmt, where)
    .then(rows => hBarChart('chartIssuedYear', rows,
      { valueFmt: fmtMoneyStr, labelFmt: fmtMoneyStr, color: BAR_COLOR, measure: 'Олгосон зээлийн дүн' }));
  statsByYear(SVC.loans, F.dueDate, F.issuedAmt, where)
    .then(rows => areaChart('chartDueYear', rows, { color: AREA_COLOR, measure: 'Төлөгдөх дүн' }));

  /* --- Өргөдлийн явц --- */
  queryStats(SVC.loans, {
    where: andWhere(where, `${F.status} IS NOT NULL`), groupBy: F.status,
    stats: [{ onStatisticField: 'OBJECTID', statisticType: 'count', outStatisticFieldName: 'v' }],
    orderBy: 'v DESC', limit: 100
  }).then(rows => donutChart('chartStatus',
    rows.map(r => ({ key: r[F.status], value: r.v || 0 })), { valueFmt: fmtNum, measure: 'Өргөдлийн тоо' }));
}

const fmtHerd = (v: any) => grouped(v) + ' мян.толгой';

let livestockRows: Row[] | null = null;

function drawLivestock(){
  if (!livestockRows) return;
  hBarChart('chartLivestock', livestockRows,
    { valueFmt: fmtHerd, labelFmt: fmtHerd, color: BAR_COLOR, measure: 'Малын тоо',
      selected: picked(F.aimag), onSelect: k => toggleFilterValue(F.aimag, k) });
}

/* ===== Шүүлтүүрт хамаарахгүй виджетүүд (нэг удаа) ===== */
export function loadStaticWidgets() {
  // Малын тоо аймгаар — тоо нь шүүлтүүрээс хамаарахгүй ч сонгосон аймаг
  // тодрох ёстой тул нэг удаа татаад кэшлэнэ
  queryStats(SVC.livestock, {
    groupBy: 'aimag_name_boundary',
    stats: [{ onStatisticField: 'last_y', statisticType: 'sum', outStatisticFieldName: 'v' }],
    orderBy: 'v DESC', limit: 1000
  }).then((rows: Attributes[]) => {
    livestockRows = rows.filter(r => r.aimag_name_boundary)
      .map(r => ({ key: r.aimag_name_boundary, value: r.v || 0 }));
    drawLivestock();
  });

  // 2024 / 2025 онд олгосон зээлийн төлөлт
  const repay = (type: string, id: string, color: string) => queryStats(SVC.progress, {
    where: `Зээлийн_төрөл = ${sqlStr(type)}`,
    groupBy: 'Он',
    stats: [{ onStatisticField: 'Зээлийн_дүн', statisticType: 'sum', outStatisticFieldName: 'v' }],
    orderBy: 'Он ASC', limit: 200
  }).then(rows => areaChart(id,
    rows.filter(r => r['Он'] != null).map(r => ({ key: r['Он'], value: r.v || 0 })),
    { color, measure: 'Зээлийн дүн' }));

  repay('2024 онд олгосон зээл', 'chartRepay2024', AREA_COLOR);
  repay('2025 онд олгосон зээл', 'chartRepay2025', AREA_COLOR);
}
