/* ---------- Word тайлан ----------
   Дэлгэц дээр харагдаж буй бүх үзүүлэлтийг идэвхтэй шүүлтүүрийн хамт
   .docx болгон татаж авна. Бүтэц нь Khorshoo_tailan_*.docx загварыг дагасан.

   `docx` санг dynamic import-оор зөвхөн товч дарах үед ачаална — Next.js
   үүнийг тусдаа chunk болгодог тул нүүр хуудасны ачаалалд нөлөөлөхгүй
   (хуучин CDN-ээс script нэмдэг байсантай ижил зарчим). */

import { F, KPIS, NUM_PREFIX, SELECTORS, SOUM_LIMIT, SVC, YEAR_KPIS, purposeCode } from './config';
import {
  andWhere, buildWhere, filters, fmtExact, fmtMoneyStr, fmtNum, grouped,
  queryCount, queryDistinctCount, queryStats, sqlStr, type Attributes
} from './data';
import { statsByYear } from './dashboard';

type Docx = typeof import('docx');

let _docxPromise: Promise<Docx> | null = null;
function loadDocx(): Promise<Docx> {
  if (!_docxPromise) _docxPromise = import('docx').catch(err => {
    _docxPromise = null;
    throw new Error('docx сан ачаалагдсангүй: ' + (err && err.message ? err.message : err));
  });
  return _docxPromise;
}

/* ---------- Туслах форматууд ---------- */

/** Хүснэгтэд: "73.8 тэрбум₮" */
function fmtMoneyDoc(v: any){
  if (v == null || isNaN(v)) return '—';
  const a = Math.abs(v);
  for (const [mul, unit] of NUM_PREFIX){
    if (a >= mul) return grouped(v / mul) + ' ' + unit + '₮';
  }
  return grouped(v, 0) + '₮';
}

/** Огноог YYYY.MM.DD болгох (ArcGIS UTC миллисекунд буцаадаг) */
function fmtDate(ms: number | null | undefined){
  if (ms == null) return '';
  const d = new Date(ms);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getUTCFullYear()}.${p(d.getUTCMonth() + 1)}.${p(d.getUTCDate())}`;
}

/** Хугацааны муж: ижил бол нэг огноо */
function fmtDateRange(min: number | null | undefined, max: number | null | undefined){
  const a = fmtDate(min), b = fmtDate(max);
  if (!a && !b) return '';
  return a === b ? a : `${a} - ${b}`;
}

/** Зэрэг явуулах хүсэлтийн тоог хязгаарлан гүйцэтгэнэ */
async function withLimit<T, R>(items: T[], limit: number, fn: (item: T, i: number) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length){
      const i = next++;
      out[i] = await fn(items[i], i);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return out;
}

/** Идэвхтэй шүүлтүүрийн тайлбар */
export function filterSummary(){
  const parts: string[] = [];
  SELECTORS.forEach(c => {
    const sel = [...filters[c.field]];
    if (!sel.length) return;
    const lbl = (v: string) => (c.labelOverrides && c.labelOverrides[v]) || v;
    parts.push(`${c.label}: ${sel.map(lbl).join(', ')}`);
  });
  if (filters.dateFrom || filters.dateTo){
    parts.push(`ОЛГОСОН ОГНОО: ${filters.dateFrom || '…'} — ${filters.dateTo || '…'}`);
  }
  return parts.length ? parts.join(' | ') : 'Шүүлтгүй — бүх өгөгдөл';
}

/** Файлын нэр: Khorshoo_tailan_[Аймаг_]YYYYMMDD.docx */
function reportFileName(){
  const d = new Date();
  const stamp = d.getFullYear() +
    String(d.getMonth() + 1).padStart(2, '0') +
    String(d.getDate()).padStart(2, '0');
  const aimags = [...filters[F.aimag]];
  const tag = aimags.length === 1 ? aimags[0].replace(/[\\/:*?"<>|\s]+/g, '_') + '_' : '';
  return `Khorshoo_tailan_${tag}${stamp}.docx`;
}

/* ---------- Өгөгдөл цуглуулах ---------- */

interface MainRow { name: string; coops: number; members: number; dmin: number | null; dmax: number | null; gua: number; amt: number; bal: number }

async function collectReportData(){
  const where   = buildWhere();
  const cntKpi  = KPIS.find(k => k.id === 'loanCount')!;
  const sumKpis = KPIS.filter(k => k.stat === 'sum');

  const byField = (field: string, extra?: string) => queryStats(SVC.loans, {
    where: extra ? andWhere(where, extra) : where,
    groupBy: field,
    stats: [{ onStatisticField: F.issuedAmt, statisticType: 'sum', outStatisticFieldName: 'v' }],
    orderBy: 'v DESC', limit: 1000
  });

  // Сумын нэр аймаг хооронд давхардна тул аймаг-сумын хосоор бүлэглэнэ
  const bySoum = (field: string, type: 'sum' | 'count') => queryStats(SVC.loans, {
    where, groupBy: `${F.soum},${F.aimag}`,
    stats: [{ onStatisticField: field, statisticType: type, outStatisticFieldName: 'v' }],
    orderBy: 'v DESC', limit: SOUM_LIMIT
  });

  const [sums, loanCount, totalCount, coopCount, borrowerCount, aimagAmt, aimagCnt, soumAmt, soumCnt, purpose, bank,
         issuedYear, dueYear, status, livestock] = await Promise.all([
    queryStats(SVC.loans, { where, stats: sumKpis.map((k, i) =>
      ({ onStatisticField: k.field, statisticType: 'sum' as const, outStatisticFieldName: 's' + i })) }),
    queryCount(SVC.loans, andWhere(where, cntKpi.extraWhere)),
    queryCount(SVC.loans, where),
    queryDistinctCount(SVC.loans, F.coopId, where),
    queryDistinctCount(SVC.loans, F.borrower, where),
    byField(F.aimag),
    queryStats(SVC.loans, { where, groupBy: F.aimag,
      stats: [{ onStatisticField: 'OBJECTID', statisticType: 'count', outStatisticFieldName: 'v' }],
      orderBy: 'v DESC', limit: 1000 }),
    bySoum(F.issuedAmt, 'sum'),
    bySoum('OBJECTID', 'count'),
    byField(F.purpose, `${F.purpose} <> '-'`),
    byField(F.bank),
    statsByYear(SVC.loans, F.issuedDate, F.issuedAmt, where),
    statsByYear(SVC.loans, F.dueDate,    F.issuedAmt, where),
    queryStats(SVC.loans, { where: andWhere(where, `${F.status} IS NOT NULL`), groupBy: F.status,
      stats: [{ onStatisticField: 'OBJECTID', statisticType: 'count', outStatisticFieldName: 'v' }],
      orderBy: 'v DESC', limit: 100 }),
    queryStats(SVC.livestock, { groupBy: 'aimag_name_boundary',
      stats: [{ onStatisticField: 'last_y', statisticType: 'sum', outStatisticFieldName: 'v' }],
      orderBy: 'v DESC', limit: 1000 })
  ]);

  // 1-р бүлгийн задаргаа: нэг аймаг сонгосон бол сумаар, эс бөгөөс аймгаар
  const aimags = [...filters[F.aimag]];
  const oneAimag   = aimags.length === 1 ? aimags[0] : null;
  const groupField = oneAimag ? F.soum : F.aimag;

  const breakdown = await queryStats(SVC.loans, {
    where, groupBy: groupField,
    stats: [
      { onStatisticField: F.issuedAmt,     statisticType: 'sum', outStatisticFieldName: 'amt'  },
      { onStatisticField: F.guaranteedAmt, statisticType: 'sum', outStatisticFieldName: 'gua'  },
      { onStatisticField: F.balance,       statisticType: 'sum', outStatisticFieldName: 'bal'  },
      { onStatisticField: F.issuedDate,    statisticType: 'min', outStatisticFieldName: 'dmin' },
      { onStatisticField: F.issuedDate,    statisticType: 'max', outStatisticFieldName: 'dmax' }
    ],
    orderBy: groupField + ' ASC', limit: 1000
  });

  // Давхардаагүй тоог бүлэг тус бүрд нь сервер талд тоолуулна
  const groups: string[] = breakdown.filter(r => r[groupField]).map(r => r[groupField]);
  const counts = await withLimit(groups, 6, async g => {
    const w = andWhere(where, `${groupField} = ${sqlStr(g)}`);
    const [coops, members] = await Promise.all([
      queryDistinctCount(SVC.loans, F.coopId, w),
      queryDistinctCount(SVC.loans, F.borrower, w)
    ]);
    return { coops, members };
  });

  const rowsMain: MainRow[] = groups.map((g, i) => {
    const r = breakdown.find(x => x[groupField] === g)!;
    return { name: g, coops: counts[i].coops, members: counts[i].members,
             dmin: r.dmin, dmax: r.dmax, gua: r.gua || 0, amt: r.amt || 0, bal: r.bal || 0 };
  });

  const clean = (rows: Attributes[], field: string): [string, number][] =>
    rows.filter(r => r[field]).map(r => [r[field], r.v || 0]);
  // Дараалал нь хүснэгтийн баганатай ижил: Аймаг -> Сум -> утга
  const soumRows = (rows: Attributes[]): [string, string, number][] => rows.filter(r => r[F.soum])
    .map(r => [r[F.aimag], r[F.soum], r.v || 0]);
  const s0 = sums[0] || {};

  return {
    where, loanCount, totalCount, coopCount, borrowerCount,
    groupHeader: oneAimag ? `${oneAimag} аймаг` : 'Аймаг',
    rowsMain,
    kpi: sumKpis.map((k, i) => [k.label, s0['s' + i] || 0] as [string, number]),
    aimagAmt:  clean(aimagAmt, F.aimag),
    aimagCnt:  clean(aimagCnt, F.aimag),
    soumAmt:   soumRows(soumAmt),
    soumCnt:   soumRows(soumCnt),
    purpose:   clean(purpose,  F.purpose),
    bank:      clean(bank,     F.bank),
    issuedYear: issuedYear.map(r => [r.key, r.value] as [any, number]),
    dueYear:    dueYear.map(r => [r.key, r.value] as [any, number]),
    status:    clean(status,   F.status),
    // Он бүрийн төсөв/гүйцэтгэл — тогтмол утгууд
    years:     YEAR_KPIS.map(y => [y.year, y.budget, y.actual,
                 y.budget ? Math.round(y.actual / y.budget * 100) : null] as [string, number, number, number | null]),
    livestock: clean(livestock, 'aimag_name_boundary')
  };
}

type ReportData = Awaited<ReturnType<typeof collectReportData>>;

/* ---------- Баримт угсрах ---------- */

const HDR_FILL = 'E2EAEE';

type Cell = string | number;

function docTable(D: Docx, headers: string[], rows: Cell[][], widths: number[], rightCols: number[]){
  const { Table, TableRow, TableCell, Paragraph, TextRun, WidthType, AlignmentType } = D;
  const cell = (text: Cell, i: number, bold: boolean) => new TableCell({
    width: { size: widths[i], type: WidthType.PERCENTAGE },
    shading: bold ? { fill: HDR_FILL } : undefined,
    margins: { top: 60, bottom: 60, left: 90, right: 90 },
    children: [new Paragraph({
      alignment: rightCols.includes(i) ? AlignmentType.RIGHT : AlignmentType.LEFT,
      children: [new TextRun({ text: String(text), bold: !!bold, size: 19 })]
    })]
  });
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({ tableHeader: true, children: headers.map((h, i) => cell(h, i, true)) }),
      ...rows.map(r => new TableRow({ children: r.map((c, i) => cell(c, i, false)) }))
    ]
  });
}

/** Сүүлийн мөрийг тодруулсан хүснэгт (нийт дүн) */
function docTableWithTotal(D: Docx, headers: string[], rows: Cell[][], totalRow: Cell[], widths: number[], rightCols: number[]){
  const { Table, TableRow, TableCell, Paragraph, TextRun, WidthType, AlignmentType } = D;
  const cell = (text: Cell, i: number, bold: boolean) => new TableCell({
    width: { size: widths[i], type: WidthType.PERCENTAGE },
    shading: bold ? { fill: HDR_FILL } : undefined,
    margins: { top: 60, bottom: 60, left: 90, right: 90 },
    children: [new Paragraph({
      alignment: rightCols.includes(i) ? AlignmentType.RIGHT : AlignmentType.LEFT,
      children: [new TextRun({ text: String(text), bold: !!bold, size: 19 })]
    })]
  });
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({ tableHeader: true, children: headers.map((h, i) => cell(h, i, true)) }),
      ...rows.map(r => new TableRow({ children: r.map((c, i) => cell(c, i, false)) })),
      new TableRow({ children: totalRow.map((c, i) => cell(c, i, true)) })
    ]
  });
}

function docSection(D: Docx, title: string, intro: string, table: InstanceType<Docx['Table']>){
  const { Paragraph, TextRun, HeadingLevel } = D;
  const out: (InstanceType<Docx['Paragraph']> | InstanceType<Docx['Table']>)[] = [new Paragraph({
    heading: HeadingLevel.HEADING_1, spacing: { before: 300, after: 120 },
    children: [new TextRun({ text: title, bold: true, size: 25, color: '111111' })]
  })];
  if (intro) out.push(new Paragraph({ spacing: { after: 140 },
    children: [new TextRun({ text: intro, size: 19 })] }));
  if (table) out.push(table);
  return out;
}

function buildDocument(D: Docx, d: ReportData){
  const { Document, Paragraph, TextRun, AlignmentType } = D;
  const money = (v: number) => fmtMoneyDoc(v);
  const kids: (InstanceType<Docx['Paragraph']> | InstanceType<Docx['Table']>)[] = [];

  kids.push(new Paragraph({
    alignment: AlignmentType.CENTER, spacing: { after: 100 },
    children: [new TextRun({ text: 'ХОРШООНЫ ЗЭЭЛИЙН МЭДЭЭЛЭЛ ТАЙЛАН', bold: true, size: 30 })]
  }));
  kids.push(new Paragraph({ spacing: { after: 40 },
    children: [new TextRun({ text: 'Огноо: ' + new Date().toLocaleString('mn-MN'), size: 19 })] }));
  kids.push(new Paragraph({ spacing: { after: 60 },
    children: [new TextRun({ text: 'Шүүлтийн нөхцөл: ' + filterSummary(), size: 19, bold: true })] }));

  const kpiVal = (name: string) => (d.kpi.find(k => k[0] === name) || [, 0])[1] as number;
  const rm = d.rowsMain;
  const sumOf = (f: 'gua' | 'amt' | 'bal') => rm.reduce((a, r) => a + (r[f] || 0), 0);
  const allMin = rm.reduce<number | null>((a, r) => (r.dmin != null && (a == null || r.dmin < a)) ? r.dmin : a, null);
  const allMax = rm.reduce<number | null>((a, r) => (r.dmax != null && (a == null || r.dmax > a)) ? r.dmax : a, null);

  kids.push(...docSection(D, '1. Үндсэн үзүүлэлт',
    `Нийт ${fmtNum(d.totalCount)} өргөдөл бүртгэгдэж, ` +
    `${fmtNum(d.coopCount)} хоршооны ${fmtNum(d.borrowerCount)} гишүүнд ` +
    `${fmtMoneyStr(kpiVal('ОЛГОСОН ЗЭЭЛ'))} зээл олгосон. ` +
    `Хүссэн зээлийн дүн ${fmtMoneyStr(kpiVal('ХҮССЭН ЗЭЭЛИЙН ДҮН'))}, ` +
    `батлагдсан ${fmtMoneyStr(kpiVal('БАТЛАГДСАН ЗЭЭЛ'))}, ` +
    `батлан даасан дүн ${fmtMoneyStr(kpiVal('БАТЛАН ДААСАН ДҮН'))}, ` +
    `зээлийн үлдэгдэл ${fmtMoneyStr(kpiVal('ЗЭЭЛИЙН ҮЛДЭГДЭЛ'))} байна.`,
    docTableWithTotal(D,
      [d.groupHeader, 'Зээл авсан хоршооны тоо', 'Зээл авсан гишүүний тоо',
       'Зээл авсан огноо', 'Зээлийн батлан даасан дүн', 'Зээлийн дүн', 'Зээлийн үлдэгдэл'],
      rm.map(r => [r.name, fmtNum(r.coops), fmtNum(r.members), fmtDateRange(r.dmin, r.dmax),
                   grouped(r.gua, 0), grouped(r.amt, 0), grouped(r.bal, 0)]),
      // Хоршоо/гишүүний нийт нь баганын нийлбэр биш, бүхэлдээ давхардаагүй тоо
      ['Нийт', fmtNum(d.coopCount), fmtNum(d.borrowerCount), fmtDateRange(allMin, allMax),
       grouped(sumOf('gua'), 0), grouped(sumOf('amt'), 0), grouped(sumOf('bal'), 0)],
      [16, 12, 12, 17, 15, 14, 14], [1, 2, 4, 5, 6])));

  kids.push(...docSection(D, '2. Олгосон зээлийн дүн, аймгаар',
    'Доорх хүснэгтэд аймаг тус бүрд олгосон зээлийн нийт дүнг буурах эрэмбээр харуулав.',
    docTable(D, ['Аймаг', 'Дүн'], d.aimagAmt.map(([k, v]) => [k, money(v)]), [60, 40], [1])));

  kids.push(...docSection(D, '3. Зээлийн тоо, аймгаар',
    'Доорх хүснэгтэд аймаг тус бүрд олгосон зээлийн тоог буурах эрэмбээр харуулав.',
    docTable(D, ['Аймаг', 'Тоо'], d.aimagCnt.map(([k, v]) => [k, fmtNum(v)]), [60, 40], [1])));

  const soumNote = (rows: unknown[]) => rows.length >= SOUM_LIMIT
    ? ` Хамгийн өндөр ${SOUM_LIMIT} сумыг оруулав.` : '';

  kids.push(...docSection(D, '4. Олгосон зээлийн дүн, сумаар',
    'Доорх хүснэгтэд сум тус бүрд олгосон зээлийн нийт дүнг буурах эрэмбээр харуулав.' +
    soumNote(d.soumAmt),
    docTable(D, ['Аймаг', 'Сум', 'Дүн'],
      d.soumAmt.map(([a, s1, v]) => [a, s1, money(v)]), [30, 34, 36], [2])));

  kids.push(...docSection(D, '5. Зээлийн тоо, сумаар',
    'Доорх хүснэгтэд сум тус бүрд олгосон зээлийн тоог буурах эрэмбээр харуулав.' +
    soumNote(d.soumCnt),
    docTable(D, ['Аймаг', 'Сум', 'Тоо'],
      d.soumCnt.map(([a, s1, v]) => [a, s1, fmtNum(v)]), [30, 34, 36], [2])));

  kids.push(...docSection(D, '6. Зээл олгосон дүн, зориулалтаар',
    'Доорх хүснэгтэд зээлийн зориулалт тус бүрд олгосон нийт дүнг буурах эрэмбээр харуулав.',
    docTable(D, ['ҮАЧ', 'Зориулалт', 'Дүн'],
      // Код олдоогүй зориулалтад нэрийг нь давхардуулж бичихгүй
      d.purpose.map(([k, v]) => {
        const code = purposeCode(k);
        return [code === k ? '—' : code, k, money(v)];
      }), [10, 62, 28], [2])));

  kids.push(...docSection(D, '7. Зээл олгосон банк',
    'Доорх хүснэгтэд банк тус бүрийн олгосон зээлийн нийт дүнг харуулав.',
    docTable(D, ['Банк', 'Дүн'], d.bank.map(([k, v]) => [k, money(v)]), [60, 40], [1])));

  kids.push(...docSection(D, '8. Зээл олгосон огноо',
    'Доорх хүснэгтэд зээл олгосон он тус бүрийн нийт дүнг харуулав.',
    docTable(D, ['Он', 'Дүн'], d.issuedYear.map(([k, v]) => [k, money(v)]), [60, 40], [1])));

  kids.push(...docSection(D, '9. Төлөлтийн огноо',
    'Доорх хүснэгтэд зээл төлөгдөх он тус бүрд ногдох дүнг харуулав.',
    docTable(D, ['Он', 'Дүн'], d.dueYear.map(([k, v]) => [k, money(v)]), [60, 40], [1])));

  kids.push(...docSection(D, '10. Явц (Өргөдлийг шийдвэрлэсэн эсэх)',
    'Доорх хүснэгтэд өргөдлийн явцын байдлыг тоогоор харуулав.',
    docTable(D, ['Хариулт', 'Тоо'], d.status.map(([k, v]) => [k, fmtNum(v)]), [60, 40], [1])));

  kids.push(...docSection(D, '11. Зээлийн тайлан (төсөв, гүйцэтгэл)',
    'Улсын хэмжээний үзүүлэлт — дээрх шүүлтүүрээс хамаарахгүй.',
    docTable(D, ['Он', 'Төсөв', 'Гүйцэтгэл', 'Хувь'],
      d.years.map(([y, b, a, p]) => [y, fmtExact(b) + '₮', fmtExact(a) + '₮',
                                     p == null ? '—' : p + '%']),
      [16, 30, 30, 24], [1, 2, 3])));

  kids.push(...docSection(D, '12. Малын тоо, аймгаар',
    'Улсын хэмжээний үзүүлэлт — дээрх шүүлтүүрээс хамаарахгүй.',
    docTable(D, ['Аймаг', 'Мянган толгой'],
      d.livestock.map(([k, v]) => [k, grouped(v)]), [60, 40], [1])));

  return new Document({
    styles: { default: { document: { run: { font: 'Times New Roman', size: 19 } } } },
    sections: [{ properties: {}, children: kids }]
  });
}

/* ---------- Товч ---------- */

/** Тайланг угсарч татна. Алдаа гарвал alert харуулна (товчны төлөвийг компонент удирдана). */
export async function downloadReport(): Promise<void> {
  try {
    const [D, data] = await Promise.all([loadDocx(), collectReportData()]);
    const blob = await D.Packer.toBlob(buildDocument(D, data));
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = reportFileName();
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  } catch (err: any) {
    console.error(err);
    alert('Тайлан үүсгэхэд алдаа гарлаа: ' + (err && err.message ? err.message : err));
  }
}
