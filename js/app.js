/* ---------- Апп-ын гол логик ---------- */

const $  = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];

/* ===== 1. Статик агуулга ===== */
$('#richText').innerHTML    = RICH_TEXT;

$('#kpiRow').innerHTML = KPIS.map((k, i) =>
  `<div class="kpi"><div class="k-label">${k.label}</div>
     <div class="k-main">
       <span class="k-icon">${KPI_ICONS[k.icon] || ''}</span>
       <span class="k-value" id="kpi${i}">—</span>
     </div></div>`).join('');

/* Он бүр нэг нүд: төсөв ба гүйцэтгэл зэрэгцэн, хажууд нь гүйцэтгэлийн хувь */
$('#kpiRow2').innerHTML = YEAR_KPIS.map(y => {
  const pct = y.budget ? Math.round(y.actual / y.budget * 100) : null;
  return `<div class="kpi year-kpi">
    <div class="y-year">${y.year} ОН</div>
    <div class="y-rows">
      <span class="y-key">Төсөв</span><span class="y-val">${fmtMoneyStr(y.budget)}</span>
      <span class="y-key">Гүйцэтгэл</span><span class="y-val y-act">${fmtMoneyStr(y.actual)}</span>
      <span class="y-key">Хувь</span><span class="y-val y-pct">${pct == null ? '—' : pct + '%'}</span>
    </div>
  </div>`;
}).join('');

/* ===== 2. Табууд (самбарын доод талд, гарчиг нь идэвхтэй табын нэр) ===== */
function activateTab(group, btn){
  group.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t === btn));
  const panel = group.parentElement;
  panel.querySelectorAll('.tab-pane').forEach(p =>
    p.classList.toggle('active', p.dataset.pane === btn.dataset.tab));
  const title = panel.querySelector(`[data-title-for="${group.dataset.tabs}"]`);
  if (title) title.textContent = btn.textContent;
  if (group.dataset.tabs === 'map') setMapMode(btn.dataset.tab === 'm3d' ? '3d' : '2d');
  // Далд байсан canvas-ыг зөв хэмжээнд оруулах
  Object.values(charts).forEach(c => c.resize());
}

$$('.tabs').forEach(group => {
  const strip = group.querySelector('.tab-strip');
  group.addEventListener('click', e => {
    const nav = e.target.closest('.tab-nav');
    if (nav){ strip.scrollBy({ left: nav.classList.contains('prev') ? -110 : 110, behavior:'smooth' }); return; }
    const btn = e.target.closest('.tab');
    if (btn) activateTab(group, btn);
  });
  // Багтахгүй үед л ‹ › сумыг харуулна
  const syncNav = () => group.classList.toggle('overflowing', strip.scrollWidth > strip.clientWidth + 2);
  new ResizeObserver(syncNav).observe(strip);
  syncNav();
  activateTab(group, group.querySelector('.tab.active'));
});

/* ===== 3. Шүүлтүүрийн сонгогчид ===== */
const escHtml = s => String(s).replace(/[&<>]/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;' }[c]));
const escAttr = s => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

const selEls = {};
SELECTORS.forEach(cfg => {
  const el = $(`.sel[data-field="${cfg.field}"]`);
  selEls[cfg.field] = el;
  el.querySelector('.sel-btn').addEventListener('click', e => {
    e.stopPropagation();
    const wasOpen = el.classList.contains('open');
    closeAllMenus();
    if (!wasOpen) { el.classList.add('open'); loadSelectorOptions(cfg); }
  });
  el.querySelector('.sel-menu').addEventListener('click', e => e.stopPropagation());
});

$('.date-sel .sel-btn').addEventListener('click', e => {
  e.stopPropagation();
  const el = $('.date-sel');
  const wasOpen = el.classList.contains('open');
  closeAllMenus();
  if (!wasOpen) el.classList.add('open');
});
$('.date-menu').addEventListener('click', e => e.stopPropagation());
document.addEventListener('click', closeAllMenus);

function closeAllMenus() { $$('.sel').forEach(s => s.classList.remove('open')); }

async function loadSelectorOptions(cfg) {
  const menu = selEls[cfg.field].querySelector('.sel-menu');
  const where = buildWhere([cfg.field]);
  if (menu.dataset.loadedWhere === where) return;
  if (!menu.dataset.loadedWhere) menu.innerHTML = '<div class="sel-empty">Уншиж байна…</div>';

  const rows = await queryStats(SVC.loans, {
    where,
    groupBy: cfg.field,
    stats: [{ onStatisticField: 'OBJECTID', statisticType: 'count', outStatisticFieldName: 'n' }],
    orderBy: cfg.field + ' ASC',
    limit: 1000
  });

  menu.dataset.loadedWhere = where;
  const opts = rows.filter(r => r[cfg.field] != null && r[cfg.field] !== '');
  const items = opts.map(r => {
    const raw = r[cfg.field];
    const label = (cfg.labelOverrides && cfg.labelOverrides[raw]) || raw;
    const on = filters[cfg.field].has(raw);
    return `<label class="sel-item${on ? ' selected' : ''}">
        <input type="checkbox" value="${escAttr(raw)}" ${on ? 'checked' : ''}><span class="cbx"></span>
        <span class="nm">${escHtml(label)}</span><span class="n">${fmtNum(r.n)}</span></label>`;
  }).join('');

  menu.innerHTML = `
    <div class="sel-head">
      <div class="sel-search-wrap">
        <svg class="sel-search-ico" viewBox="0 0 16 16"><path d="M15.364 14.636L9.735 9.008a5.5 5.5 0 1 0-.706.708l5.628 5.627.707-.707zM1 5.5C1 3.019 3.019 1 5.5 1S10 3.019 10 5.5 7.981 10 5.5 10 1 7.981 1 5.5z"/></svg>
        <input class="sel-search" type="text" placeholder="Хайх…">
      </div>
      <div class="sel-tools">
        <button class="sel-act" data-act="all">Бүгдийг сонгох</button>
        <button class="sel-act" data-act="none">Цэвэрлэх</button>
        <span class="sel-total">${opts.length}</span>
      </div>
    </div>
    <div class="sel-list">${items || '<div class="sel-empty">Утга олдсонгүй</div>'}</div>`;

  const list = menu.querySelector('.sel-list');
  const boxes = [...list.querySelectorAll('input[type=checkbox]')];
  const visible = () => boxes.filter(cb => cb.closest('.sel-item').style.display !== 'none');

  const apply = () => {
    boxes.forEach(cb => cb.closest('.sel-item').classList.toggle('selected', cb.checked));
    invalidateSelectorCaches(cfg.field);
    updateSelectorBadges();
    refresh();
  };

  menu.querySelector('.sel-search').addEventListener('input', e => {
    const q = e.target.value.toLowerCase();
    list.querySelectorAll('.sel-item').forEach(it => {
      it.style.display = it.textContent.toLowerCase().includes(q) ? '' : 'none';
    });
  });

  menu.querySelector('.sel-tools').addEventListener('click', e => {
    const btn = e.target.closest('.sel-act');
    if (!btn) return;
    if (btn.dataset.act === 'all'){
      // Зөвхөн хайлтад тохирсон, харагдаж буй утгуудыг сонгоно
      visible().forEach(cb => { cb.checked = true; filters[cfg.field].add(cb.value); });
    } else {
      boxes.forEach(cb => { cb.checked = false; });
      filters[cfg.field].clear();
    }
    apply();
  });

  boxes.forEach(cb => cb.addEventListener('change', () => {
    if (cb.checked) filters[cfg.field].add(cb.value);
    else filters[cfg.field].delete(cb.value);
    apply();
  }));
}

/** Нэг шүүлтүүр өөрчлөгдвөл бусад сонгогчийн жагсаалтыг дахин ачаална */
function invalidateSelectorCaches(changedField) {
  SELECTORS.forEach(c => {
    if (c.field === changedField) return;
    delete selEls[c.field].querySelector('.sel-menu').dataset.loadedWhere;
  });
}

function updateSelectorBadges() {
  SELECTORS.forEach(c => {
    const sel = [...filters[c.field]];
    const lbl = v => (c.labelOverrides && c.labelOverrides[v]) || v;
    selEls[c.field].querySelector('.sel-state').textContent =
      !sel.length ? 'No category selected'
      : sel.length === 1 ? lbl(sel[0])
      : `${sel.length} сонгосон`;
  });
  const { dateFrom: a, dateTo: b } = filters;
  $('.date-sel .sel-state').textContent =
    (a || b) ? `${a || '…'} — ${b || '…'}` : 'No date selected';
}

$('#dateApply').onclick = () => {
  filters.dateFrom = $('#dateFrom').value || null;
  filters.dateTo   = $('#dateTo').value   || null;
  closeAllMenus(); invalidateSelectorCaches(''); updateSelectorBadges(); refresh();
};
$('#dateClear').onclick = () => {
  $('#dateFrom').value = ''; $('#dateTo').value = '';
  filters.dateFrom = filters.dateTo = null;
  closeAllMenus(); invalidateSelectorCaches(''); updateSelectorBadges(); refresh();
};
$('#report-btn').onclick = downloadReport;

$('#resetBtn').onclick = () => {
  [F.aimag, F.soum, F.purpose, F.bank].forEach(f => filters[f].clear());
  filters.dateFrom = filters.dateTo = null;
  $('#dateFrom').value = ''; $('#dateTo').value = '';
  invalidateSelectorCaches(''); updateSelectorBadges(); refresh();
};

/* ===== 4. Он-оор бүлэглэх туслах ===== */
async function statsByYear(url, dateField, valueField, where) {
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

function toggleFilter(field, value){
  const set = filters[field];
  if (set.has(value)) set.delete(value); else set.add(value);
  invalidateSelectorCaches('');
  updateSelectorBadges();
  refresh();
}

/** Сумын нэр аймаг хооронд давхардах тул сум сонгоход аймгийг нь мөн онооно */
function toggleSoum(soum, aimag){
  const set = filters[F.soum];
  if (set.has(soum)) set.delete(soum);
  else { set.add(soum); filters[F.aimag].add(aimag); }
  invalidateSelectorCaches('');
  updateSelectorBadges();
  refresh();
}

const picked = field => k => filters[field].has(k);

/**
 * Сумаар бүлэглэсэн баганан график.
 * Сумын нэр аймаг хооронд давхардана (жишээ нь "Булган" 6 аймагт) тул
 * аймаг-сумын хосоор бүлэглэж, зөвхөн давхардсан нэрэнд аймгийг нь хавсаргана.
 */
function soumChart(id, where, statField, statType, opts){
  return queryStats(SVC.loans, {
    where,
    groupBy: `${F.soum},${F.aimag}`,
    stats: [{ onStatisticField: statField, statisticType: statType, outStatisticFieldName: 'v' }],
    orderBy: 'v DESC', limit: SOUM_LIMIT
  }).then(rows => {
    const valid = rows.filter(r => r[F.soum]);
    const seen = {};
    valid.forEach(r => { seen[r[F.soum]] = (seen[r[F.soum]] || 0) + 1; });

    const short = new Map();
    const parts = new Map();
    const data = valid.map(r => {
      const key = `${r[F.soum]}, ${r[F.aimag]}`;
      short.set(key, seen[r[F.soum]] > 1 ? `${r[F.soum]} (${r[F.aimag]})` : r[F.soum]);
      parts.set(key, { soum: r[F.soum], aimag: r[F.aimag] });
      return { key, value: r.v || 0 };
    });
    hBarChart(id, data, Object.assign({
      axisLabel: k => short.get(k) || k,
      selected:  k => filters[F.soum].has((parts.get(k) || {}).soum),
      onSelect:  k => { const p = parts.get(k); if (p) toggleSoum(p.soum, p.aimag); }
    }, opts));
  });
}

/* ===== 5. Шүүлтүүрт хамаарах виджетүүд ===== */
function refresh() {
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
    sumFields.forEach((k, i) => setKpi('#kpi' + KPIS.indexOf(k), a['s' + i] || 0));
  });

  KPIS.forEach((k, i) => {
    if (k.kind !== 'count') return;
    queryCount(SVC.loans, andWhere(where, k.extraWhere))
      .then(n => { $('#kpi' + i).textContent = fmtNum(n); });
  });
  queryCount(SVC.loans, where).then(n => { $('#mapCount').textContent = fmtNum(n); });

  /* --- Аймгаар: олгосон дүн / зээлийн тоо --- */
  queryStats(SVC.loans, {
    where: wNoAimag, groupBy: F.aimag,
    stats: [{ onStatisticField: F.issuedAmt, statisticType: 'sum', outStatisticFieldName: 'v' }],
    orderBy: 'v DESC', limit: 1000
  }).then(rows => hBarChart('chartAimagAmount',
    rows.filter(r => r[F.aimag]).map(r => ({ key: r[F.aimag], value: r.v || 0 })),
    { valueFmt: fmtMoneyStr, labelFmt: fmtMoneyStr, color: BAR_COLOR, measure: 'Олгосон зээлийн дүн',
      selected: picked(F.aimag), onSelect: k => toggleFilter(F.aimag, k) }));

  queryStats(SVC.loans, {
    where: wNoAimag, groupBy: F.aimag,
    stats: [{ onStatisticField: 'OBJECTID', statisticType: 'count', outStatisticFieldName: 'v' }],
    orderBy: 'v DESC', limit: 1000
  }).then(rows => hBarChart('chartAimagCount',
    rows.filter(r => r[F.aimag]).map(r => ({ key: r[F.aimag], value: r.v || 0 })),
    { valueFmt: fmtNum, labelFmt: fmtNum, color: BAR_COLOR, measure: 'Зээлийн тоо',
      selected: picked(F.aimag), onSelect: k => toggleFilter(F.aimag, k) }));

  /* --- Банкаар --- */
  queryStats(SVC.loans, {
    where: wNoBank, groupBy: F.bank,
    stats: [{ onStatisticField: F.issuedAmt, statisticType: 'sum', outStatisticFieldName: 'v' }],
    orderBy: 'v DESC', limit: 1000
  }).then(rows => hBarChart('chartBank',
    rows.filter(r => r[F.bank]).map(r => ({ key: r[F.bank], value: r.v || 0 })),
    { valueFmt: fmtMoneyStr, labelFmt: fmtMoneyStr, color: BAR_COLOR, measure: 'Олгосон зээлийн дүн',
      selected: picked(F.bank), onSelect: k => toggleFilter(F.bank, k) }));

  /* --- Зээлийн зориулалтаар --- */
  queryStats(SVC.loans, {
    where: andWhere(wNoPurpose, `${F.purpose} <> '-'`), groupBy: F.purpose,
    stats: [{ onStatisticField: F.issuedAmt, statisticType: 'sum', outStatisticFieldName: 'v' }],
    orderBy: 'v DESC', limit: 1000
  }).then(rows => hBarChart('chartPurpose',
    rows.filter(r => r[F.purpose]).map(r => ({ key: r[F.purpose], value: r.v || 0 })),
    { valueFmt: fmtMoneyStr, labelFmt: fmtMoneyStr, color: BAR_COLOR, axisLabel: purposeCode, measure: 'Олгосон зээлийн дүн',
      selected: picked(F.purpose), onSelect: k => toggleFilter(F.purpose, k) }));

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

const fmtHerd = v => grouped(v) + ' мян.толгой';

let livestockRows = null;

function drawLivestock(){
  if (!livestockRows) return;
  hBarChart('chartLivestock', livestockRows,
    { valueFmt: fmtHerd, labelFmt: fmtHerd, color: BAR_COLOR, measure: 'Малын тоо',
      selected: picked(F.aimag), onSelect: k => toggleFilter(F.aimag, k) });
}

function setKpi(sel, value)      { $(sel).textContent = fmtMoneyStr(value); }

/* ===== 6. Шүүлтүүрт хамаарахгүй виджетүүд (нэг удаа) ===== */
function loadStaticWidgets() {
  // Малын тоо аймгаар — тоо нь шүүлтүүрээс хамаарахгүй ч сонгосон аймаг
  // тодрох ёстой тул нэг удаа татаад кэшлэнэ
  queryStats(SVC.livestock, {
    groupBy: 'aimag_name_boundary',
    stats: [{ onStatisticField: 'last_y', statisticType: 'sum', outStatisticFieldName: 'v' }],
    orderBy: 'v DESC', limit: 1000
  }).then(rows => {
    livestockRows = rows.filter(r => r.aimag_name_boundary)
      .map(r => ({ key: r.aimag_name_boundary, value: r.v || 0 }));
    drawLivestock();
  });

  // 2024 / 2025 онд олгосон зээлийн төлөлт
  const repay = (type, id, color) => queryStats(SVC.progress, {
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

/* ===== 7. Эхлүүлэх ===== */
updateSelectorBadges();
loadStaticWidgets();
refresh();

let _resizeTimer;
window.addEventListener('resize', () => {
  clearTimeout(_resizeTimer);
  _resizeTimer = setTimeout(() => Object.values(charts).forEach(c => c.resize()), 150);
});
