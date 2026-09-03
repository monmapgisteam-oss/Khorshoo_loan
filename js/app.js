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

$('#kpiRow2').innerHTML = KPIS2.map((k, i) =>
  `<div class="kpi"><div class="k-label">${k.label}</div>
     <div class="k-value" id="kpi2_${i}">—</div></div>`).join('');

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

/* ===== 5. Шүүлтүүрт хамаарах виджетүүд ===== */
function refresh() {
  const where = buildWhere();
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

  const cnt = KPIS.find(k => k.kind === 'count');
  queryCount(SVC.loans, andWhere(where, cnt.extraWhere)).then(n => {
    $('#kpi' + KPIS.indexOf(cnt)).textContent = fmtNum(n);
  });
  queryCount(SVC.loans, where).then(n => { $('#mapCount').textContent = fmtNum(n); });

  /* --- Аймгаар: олгосон дүн / зээлийн тоо --- */
  queryStats(SVC.loans, {
    where, groupBy: F.aimag,
    stats: [{ onStatisticField: F.issuedAmt, statisticType: 'sum', outStatisticFieldName: 'v' }],
    orderBy: 'v DESC', limit: 1000
  }).then(rows => hBarChart('chartAimagAmount',
    rows.filter(r => r[F.aimag]).map(r => ({ key: r[F.aimag], value: r.v || 0 })),
    { valueFmt: fmtMoneyStr, labelFmt: fmtMoneyStr, color: BAR_COLOR, measure: 'Олгосон зээлийн дүн' }));

  queryStats(SVC.loans, {
    where, groupBy: F.aimag,
    stats: [{ onStatisticField: 'OBJECTID', statisticType: 'count', outStatisticFieldName: 'v' }],
    orderBy: 'v DESC', limit: 1000
  }).then(rows => hBarChart('chartAimagCount',
    rows.filter(r => r[F.aimag]).map(r => ({ key: r[F.aimag], value: r.v || 0 })),
    { valueFmt: fmtNum, labelFmt: fmtNum, color: BAR_COLOR, measure: 'Зээлийн тоо' }));

  /* --- Банкаар --- */
  queryStats(SVC.loans, {
    where, groupBy: F.bank,
    stats: [{ onStatisticField: F.issuedAmt, statisticType: 'sum', outStatisticFieldName: 'v' }],
    orderBy: 'v DESC', limit: 1000
  }).then(rows => hBarChart('chartBank',
    rows.filter(r => r[F.bank]).map(r => ({ key: r[F.bank], value: r.v || 0 })),
    { valueFmt: fmtMoneyStr, labelFmt: fmtMoneyStr, color: BAR_COLOR, measure: 'Олгосон зээлийн дүн' }));

  /* --- Зээлийн зориулалтаар --- */
  queryStats(SVC.loans, {
    where: andWhere(where, `${F.purpose} <> '-'`), groupBy: F.purpose,
    stats: [{ onStatisticField: F.issuedAmt, statisticType: 'sum', outStatisticFieldName: 'v' }],
    orderBy: 'v DESC', limit: 1000
  }).then(rows => hBarChart('chartPurpose',
    rows.filter(r => r[F.purpose]).map(r => ({ key: r[F.purpose], value: r.v || 0 })),
    { valueFmt: fmtMoneyStr, labelFmt: fmtMoneyStr, color: BAR_COLOR, axisLabel: purposeCode, measure: 'Олгосон зээлийн дүн' }));

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

function setKpi(sel, value)      { $(sel).textContent = fmtMoneyStr(value); }
function setKpiExact(sel, value) { $(sel).textContent = fmtExact(value); }

/* ===== 6. Шүүлтүүрт хамаарахгүй виджетүүд (нэг удаа) ===== */
function loadStaticWidgets() {
  // Зээлийн тайлангийн 6 үзүүлэлт
  queryStats(SVC.report, {
    stats: KPIS2.map((k, i) => ({ onStatisticField: k.field, statisticType: 'sum', outStatisticFieldName: 's' + i }))
  }).then(rows => {
    const a = rows[0] || {};
    KPIS2.forEach((k, i) => setKpiExact('#kpi2_' + i, a['s' + i] || 0));
  });

  // Малын тоо аймгаар
  queryStats(SVC.livestock, {
    groupBy: 'aimag_name_boundary',
    stats: [{ onStatisticField: 'last_y', statisticType: 'sum', outStatisticFieldName: 'v' }],
    orderBy: 'v DESC', limit: 1000
  }).then(rows => hBarChart('chartLivestock',
    rows.filter(r => r.aimag_name_boundary).map(r => ({ key: r.aimag_name_boundary, value: r.v || 0 })),
    { valueFmt: fmtHerd, labelFmt: fmtHerd, color: BAR_COLOR, measure: 'Малын тоо' }));

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
