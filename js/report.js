/* ---------- Word тайлан ----------
   Дэлгэц дээр харагдаж буй бүх үзүүлэлтийг идэвхтэй шүүлтүүрийн хамт
   .docx болгон татаж авна. Бүтэц нь Khorshoo_tailan_*.docx загварыг дагасан. */

const DOCX_CDN = 'https://cdn.jsdelivr.net/npm/docx@9.7.1/dist/index.iife.min.js';

/** docx санг зөвхөн товч дарах үед нэг удаа ачаална (408KB) */
let _docxPromise = null;
function loadDocx(){
  if (window.docx) return Promise.resolve(window.docx);
  if (!_docxPromise) _docxPromise = new Promise((resolve, reject) => {
    const el = document.createElement('script');
    el.src = DOCX_CDN;
    el.onload  = () => resolve(window.docx);
    el.onerror = () => { _docxPromise = null; reject(new Error('docx сан ачаалагдсангүй')); };
    document.head.appendChild(el);
  });
  return _docxPromise;
}

/* ---------- Туслах форматууд ---------- */

/** Хүснэгтэд: "73.8 тэрбум₮" */
function fmtMoneyDoc(v){
  if (v == null || isNaN(v)) return '—';
  const a = Math.abs(v);
  for (const [mul, unit] of NUM_PREFIX){
    if (a >= mul) return grouped(v / mul) + ' ' + unit + '₮';
  }
  return grouped(v, 0) + '₮';
}

/** Идэвхтэй шүүлтүүрийн тайлбар */
function filterSummary(){
  const parts = [];
  SELECTORS.forEach(c => {
    const sel = [...filters[c.field]];
    if (!sel.length) return;
    const lbl = v => (c.labelOverrides && c.labelOverrides[v]) || v;
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

async function collectReportData(){
  const where   = buildWhere();
  const cntKpi  = KPIS.find(k => k.kind === 'count');
  const sumKpis = KPIS.filter(k => k.stat === 'sum');

  const byField = (field, extra) => queryStats(SVC.loans, {
    where: extra ? andWhere(where, extra) : where,
    groupBy: field,
    stats: [{ onStatisticField: F.issuedAmt, statisticType: 'sum', outStatisticFieldName: 'v' }],
    orderBy: 'v DESC', limit: 1000
  });

  // Сумын нэр аймаг хооронд давхардна тул аймаг-сумын хосоор бүлэглэнэ
  const bySoum = (field, type) => queryStats(SVC.loans, {
    where, groupBy: `${F.soum},${F.aimag}`,
    stats: [{ onStatisticField: field, statisticType: type, outStatisticFieldName: 'v' }],
    orderBy: 'v DESC', limit: SOUM_LIMIT
  });

  const [sums, loanCount, totalCount, aimagAmt, aimagCnt, soumAmt, soumCnt, purpose, bank,
         issuedYear, dueYear, status, report, livestock] = await Promise.all([
    queryStats(SVC.loans, { where, stats: sumKpis.map((k, i) =>
      ({ onStatisticField: k.field, statisticType: 'sum', outStatisticFieldName: 's' + i })) }),
    queryCount(SVC.loans, andWhere(where, cntKpi.extraWhere)),
    queryCount(SVC.loans, where),
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
    queryStats(SVC.report, { stats: KPIS2.map((k, i) =>
      ({ onStatisticField: k.field, statisticType: 'sum', outStatisticFieldName: 's' + i })) }),
    queryStats(SVC.livestock, { groupBy: 'aimag_name_boundary',
      stats: [{ onStatisticField: 'last_y', statisticType: 'sum', outStatisticFieldName: 'v' }],
      orderBy: 'v DESC', limit: 1000 })
  ]);

  const clean = (rows, field) => rows.filter(r => r[field]).map(r => [r[field], r.v || 0]);
  // Дараалал нь хүснэгтийн баганатай ижил: Аймаг -> Сум -> утга
  const soumRows = rows => rows.filter(r => r[F.soum])
    .map(r => [r[F.aimag], r[F.soum], r.v || 0]);
  const s0 = sums[0] || {};

  return {
    where, loanCount, totalCount,
    kpi: sumKpis.map((k, i) => [k.label, s0['s' + i] || 0]),
    aimagAmt:  clean(aimagAmt, F.aimag),
    aimagCnt:  clean(aimagCnt, F.aimag),
    soumAmt:   soumRows(soumAmt),
    soumCnt:   soumRows(soumCnt),
    purpose:   clean(purpose,  F.purpose),
    bank:      clean(bank,     F.bank),
    issuedYear: issuedYear.map(r => [r.key, r.value]),
    dueYear:    dueYear.map(r => [r.key, r.value]),
    status:    clean(status,   F.status),
    report:    KPIS2.map((k, i) => [k.label, (report[0] || {})['s' + i] || 0]),
    livestock: clean(livestock, 'aimag_name_boundary')
  };
}

/* ---------- Баримт угсрах ---------- */

const HDR_FILL = 'E2EAEE';

function docTable(D, headers, rows, widths, rightCols){
  const { Table, TableRow, TableCell, Paragraph, TextRun, WidthType, AlignmentType } = D;
  const cell = (text, i, bold) => new TableCell({
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

function docSection(D, title, intro, table){
  const { Paragraph, TextRun, HeadingLevel } = D;
  const out = [new Paragraph({
    heading: HeadingLevel.HEADING_1, spacing: { before: 300, after: 120 },
    children: [new TextRun({ text: title, bold: true, size: 25, color: '111111' })]
  })];
  if (intro) out.push(new Paragraph({ spacing: { after: 140 },
    children: [new TextRun({ text: intro, size: 19 })] }));
  if (table) out.push(table);
  return out;
}

function buildDocument(D, d){
  const { Document, Paragraph, TextRun, AlignmentType } = D;
  const money = v => fmtMoneyDoc(v);
  const kids = [];

  kids.push(new Paragraph({
    alignment: AlignmentType.CENTER, spacing: { after: 100 },
    children: [new TextRun({ text: 'ХОРШООНЫ ЗЭЭЛИЙН МЭДЭЭЛЭЛ ТАЙЛАН', bold: true, size: 30 })]
  }));
  kids.push(new Paragraph({ spacing: { after: 40 },
    children: [new TextRun({ text: 'Огноо: ' + new Date().toLocaleString('mn-MN'), size: 19 })] }));
  kids.push(new Paragraph({ spacing: { after: 60 },
    children: [new TextRun({ text: 'Шүүлтийн нөхцөл: ' + filterSummary(), size: 19, bold: true })] }));

  const issued = (d.kpi.find(k => k[0] === 'ОЛГОСОН ЗЭЭЛ') || [, 0])[1];
  kids.push(...docSection(D, '1. Үндсэн үзүүлэлт',
    `Сонгогдсон нөхцөлд нийт ${fmtNum(d.totalCount)} өргөдөл бүртгэгдсэн бөгөөд ` +
    `${fmtNum(d.loanCount)} зээл олгогдож, олгосон нийт зээл ${fmtMoneyStr(issued)} болов.`,
    docTable(D, ['Үзүүлэлт', 'Утга'],
      [['Өргөдлийн тоо', fmtNum(d.totalCount)], ['Зээлийн тоо', fmtNum(d.loanCount)],
       ...d.kpi.map(([l, v]) => [l, money(v)])],
      [60, 40], [1])));

  kids.push(...docSection(D, '2. Олгосон зээлийн дүн, аймгаар',
    'Доорх хүснэгтэд аймаг тус бүрд олгосон зээлийн нийт дүнг буурах эрэмбээр харуулав.',
    docTable(D, ['Аймаг', 'Дүн'], d.aimagAmt.map(([k, v]) => [k, money(v)]), [60, 40], [1])));

  kids.push(...docSection(D, '3. Зээлийн тоо, аймгаар',
    'Доорх хүснэгтэд аймаг тус бүрд олгосон зээлийн тоог буурах эрэмбээр харуулав.',
    docTable(D, ['Аймаг', 'Тоо'], d.aimagCnt.map(([k, v]) => [k, fmtNum(v)]), [60, 40], [1])));

  const soumNote = rows => rows.length >= SOUM_LIMIT
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
    docTable(D, ['Үзүүлэлт', 'Утга'], d.report.map(([l, v]) => [l, fmtExact(v) + '₮']), [60, 40], [1])));

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

async function downloadReport(){
  const btn = document.getElementById('report-btn');
  const label = btn.querySelector('span');
  const was = label.textContent;
  btn.disabled = true;
  label.textContent = 'Бэлтгэж байна…';
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
  } catch (err) {
    console.error(err);
    alert('Тайлан үүсгэхэд алдаа гарлаа: ' + err.message);
  } finally {
    btn.disabled = false;
    label.textContent = was;
  }
}
