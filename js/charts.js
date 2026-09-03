/* ---------- Chart.js тохиргоо ---------- */

if (typeof Chart === 'undefined') {
  console.error('Chart.js ачаалагдсангүй — CDN хаягаа шалгана уу. График харагдахгүй.');
}

Chart.defaults.color = '#89a0ac';
Chart.defaults.font.family = '"Segoe UI",Roboto,Arial,sans-serif';
Chart.defaults.font.size = 11;
Chart.defaults.maintainAspectRatio = false;
Chart.defaults.animation.duration = 350;

const charts = {};

/* Бүх графикийн утгын шошго: цагаан, тод биш */
const LABEL_FONT  = '10px "Segoe UI",Roboto,Arial,sans-serif';
const LABEL_COLOR = '#ffffff';

/** '#22d3ee' -> 'rgba(34,211,238,a)' */
function alpha(hex, a){
  const h = hex.replace('#','');
  const n = parseInt(h.length === 3 ? h.split('').map(c => c + c).join('') : h, 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

const FILL_ALPHA = .18;

/** Текстийн өргөнийг графикаас гадуур хэмжих туслах canvas */
const _measureCtx = document.createElement('canvas').getContext('2d');
function textWidth(t, font = LABEL_FONT){ _measureCtx.font = font; return _measureCtx.measureText(t).width; }

/** Урт нэрийг тултипт багтаахаар мөр болгон таслана */
function wrapForTooltip(text, maxChars = 42){
  const words = String(text).split(/\s+/);
  const lines = [];
  let cur = '';
  for (const w of words){
    const t = cur ? cur + ' ' + w : w;
    if (cur && t.length > maxChars){ lines.push(cur); cur = w; }
    else cur = t;
  }
  if (cur) lines.push(cur);
  return lines;
}

/** Идэвхтэй мөрийн өнгийг тултипын цэгэнд ашиглах */
function tooltipDotColor(it){
  const bc = it.dataset.borderColor;
  const c = Array.isArray(bc) ? bc[it.dataIndex] : bc;
  return { borderColor: c, backgroundColor: c, borderWidth: 0 };
}

/**
 * @param {'x'|'y'} valueAxis - утга уншигдах тэнхлэг
 * @param {string} [measure]  - утгын өмнө бичих хэмжигдэхүүний нэр
 */
function tooltipCfg(valueFmt, valueAxis, measure){
  return {
    backgroundColor:'#060c10',
    borderColor: PALETTE[0], borderWidth:1, cornerRadius:6,
    padding:{ top:9, bottom:9, left:11, right:11 },
    titleColor:'#e6f0f4', titleFont:{ size:11.5, weight:'600' }, titleMarginBottom:6,
    bodyColor: PALETTE[0], bodyFont:{ size:14, weight:'700' },
    displayColors:true, usePointStyle:true, boxWidth:7, boxHeight:7, boxPadding:5,
    caretSize:6,
    callbacks:{
      labelColor: tooltipDotColor,
      title: items => {
        const full = items[0].chart.$full;
        const t = (full && full[items[0].dataIndex]) || items[0].label;
        const lines = wrapForTooltip(Array.isArray(t) ? t.join(' ') : t);
        return lines.map((l, i) => (i === 0 ? '• ' : '   ') + l);
      },
      label: it => (measure ? measure + ': ' : '') + valueFmt(it.parsed[valueAxis])
    }
  };
}

/* ---------- Плагин: багана / цэг дээрх утгын шошго ---------- */
const dataLabels = {
  id:'dataLabels',
  afterDatasetsDraw(chart, _args, opts){
    if (!opts || !opts.formatter) return;
    const { ctx } = chart;
    const ds = chart.data.datasets[0];
    ctx.save();
    ctx.font = opts.font || LABEL_FONT;
    ctx.textBaseline = 'middle';
    ctx.fillStyle = opts.color || LABEL_COLOR;

    chart.getDatasetMeta(0).data.forEach((el, i) => {
      const raw = ds.data[i];
      const v = (raw && typeof raw === 'object') ? raw[opts.axis] : raw;
      if (v == null) return;
      const text = opts.formatter(v);
      if (!text) return;
      const w = ctx.measureText(text).width;

      if (opts.axis === 'x'){                       // хэвтээ багана — үзүүрийн АРД (дотогш оруулахгүй)
        const x = Math.min(el.x + 6, chart.width - w - 2);
        ctx.textAlign = 'left';
        ctx.fillText(text, x, el.y);
      } else {                                      // area — үргэлж цэгийн дээр
        // Доош хөрвүүлэхгүй; оронд нь дээд зайг нэмсэн тул зөвхөн ирмэгт наана
        const y = Math.max(9, el.y - 15);
        const x = Math.min(chart.width - w/2 - 2, Math.max(w/2 + 2, el.x));
        ctx.textAlign = 'center';
        // Дүүргэлт/шугам дээр уншигдахуйц болгох зөөлөн хүрээ
        ctx.lineWidth = 3.5;
        ctx.lineJoin = 'round';
        ctx.strokeStyle = opts.halo || '#111b22';
        ctx.strokeText(text, x, y);
        ctx.fillText(text, x, y);
      }
    });
    ctx.restore();
  }
};

/* ---------- Плагин: бөгжний гадна талын шошго + холбоос шугам ---------- */
const donutLabels = {
  id:'donutLabels',
  afterDatasetsDraw(chart, _args, opts){
    if (!opts || opts.display === false) return;
    const { ctx } = chart;
    const ds = chart.data.datasets[0];
    const total = ds.data.reduce((a, b) => a + b, 0) || 1;
    const minPct = opts.minPercent != null ? opts.minPercent : 2;
    const maxW = opts.maxWidth || 74;
    const LH = 12;

    ctx.save();
    ctx.font = LABEL_FONT;
    ctx.textBaseline = 'middle';

    chart.getDatasetMeta(0).data.forEach((arc, i) => {
      const v = ds.data[i];
      const pct = v / total * 100;
      if (!v || pct < minPct) return;

      const ang = (arc.startAngle + arc.endAngle) / 2;
      const cos = Math.cos(ang), sin = Math.sin(ang);
      const r = arc.outerRadius;
      const dir = cos >= 0 ? 1 : -1;
      const x0 = arc.x + cos * r,        y0 = arc.y + sin * r;
      const x1 = arc.x + cos * (r + 9),  y1 = arc.y + sin * (r + 9);
      const x2 = x1 + dir * 11;
      const color = Array.isArray(ds.borderColor) ? ds.borderColor[i] : ds.borderColor;

      ctx.strokeStyle = color;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.lineTo(x2, y1);
      ctx.stroke();

      const avail = (dir > 0 ? chart.width - x2 : x2) - 8;
      const lines = wrapLines(String(chart.data.labels[i]), Math.max(38, Math.min(maxW, avail)));
      lines.push(pct.toFixed(2) + '%');

      ctx.fillStyle = LABEL_COLOR;
      ctx.textAlign = dir > 0 ? 'left' : 'right';
      let ty = y1 - (lines.length - 1) * LH / 2;
      for (const t of lines){ ctx.fillText(t, x2 + dir * 4, ty); ty += LH; }
    });
    ctx.restore();
  }
};

/** Үгээр таслан мөр болгох */
function wrapLines(text, maxW){
  const lines = [];
  let cur = '';
  for (const w of text.split(/\s+/)){
    const t = cur ? cur + ' ' + w : w;
    if (cur && textWidth(t) > maxW){ lines.push(cur); cur = w; }
    else cur = t;
    // Ганц үг мөрөнд багтахгүй бол хатуу таслана
    while (textWidth(cur) > maxW && cur.length > 2){
      let n = cur.length;
      while (n > 2 && textWidth(cur.slice(0, n) + '…') > maxW) n--;
      lines.push(cur.slice(0, n) + '…');
      cur = cur.slice(n);
    }
  }
  if (cur) lines.push(cur);
  return lines;
}

/* Шошгонд зориулсан баруун зайг зурах бүрд бодит өргөнд тааруулна.
   Далд таб идэвхжих, цонх томрох үед ч шошго багана дээр давхцахгүй. */
const barPadding = {
  id:'barPadding',
  beforeLayout(chart){
    if (!chart.$padRight) return;
    chart.options.layout.padding.right = chart.width
      ? Math.min(chart.$padRight, chart.width * .45)
      : chart.$padRight;
  }
};

Chart.register(dataLabels, donutLabels, barPadding);

/* ---------- Хэвтээ баганан график ---------- */
/**
 * @param {object} o
 * @param {function} [o.axisLabel] - тэнхлэгт харагдах богино нэр (hover дээр бүтнээрээ)
 * @param {function} [o.selected]  - key => сонгогдсон эсэх (тодруулж харуулна)
 * @param {function} [o.onSelect]  - багана дээр дарахад key-гээр дуудагдана
 * @param {number} [o.wrapLabels] - ангиллын нэрийг энэ өргөнд багтаан мөр болгож таслах
 */
function hBarChart(id, rows, { valueFmt = fmtMoneyStr, labelFmt, color = PALETTE[0],
                               measure, axisLabel, wrapLabels, selected, onSelect } = {}){
  const ctx = document.getElementById(id);
  if (!ctx) return;
  const fmtLbl = labelFmt || valueFmt;
  const full   = rows.map(r => r.key == null ? '(хоосон)' : String(r.key));
  const labels = full.map(t =>
    axisLabel ? axisLabel(t)
    : wrapLabels ? wrapLines(t, wrapLabels)
    : truncate(t));
  const values = rows.map(r => r.value);

  // Зөвхөн шошгын өргөнөөс хамаарна; графикийн бодит өргөнд тааруулах ажлыг
  // barPadding плагин зурах бүрд хийнэ (далд таб дээр өргөн нь 0 байдаг).
  const padRight = Math.min(130, Math.max(...values.map(v => textWidth(fmtLbl(v))), 0) + 12);

  const isOn   = k => !!(selected && selected(k));
  const fills  = full.map(k => alpha(color, isOn(k) ? .55 : FILL_ALPHA));
  const strokes = full.map(k => isOn(k) ? '#ffffff' : color);

  if (charts[id]){
    const c = charts[id];
    c.$full = full;
    c.$onSelect = onSelect;
    c.data.labels = labels;
    c.data.datasets[0].data = values;
    c.data.datasets[0].backgroundColor = fills;
    c.data.datasets[0].borderColor = strokes;
    c.$padRight = padRight;
    c.update();
    c.resize();
    return;
  }
  charts[id] = new Chart(ctx, {
    type:'bar',
    data:{ labels, datasets:[{
      data: values,
      backgroundColor: fills,
      borderColor: strokes, borderWidth:1, borderSkipped:false,
      hoverBackgroundColor: alpha(color, .38),
      borderRadius:2, barPercentage:.82, categoryPercentage:.9
    }] },
    options:{
      indexAxis:'y',
      layout:{ padding:{ right:padRight } },
      onClick(evt, els, chart){
        if (!chart.$onSelect || !els.length) return;
        chart.$onSelect(chart.$full[els[0].index]);
      },
      onHover(evt, els, chart){
        if (chart.$onSelect) chart.canvas.style.cursor = els.length ? 'pointer' : 'default';
      },
      plugins:{
        legend:{ display:false },
        tooltip: tooltipCfg(valueFmt, 'x', measure),
        dataLabels:{ axis:'x', formatter:fmtLbl }
      },
      scales:{
        x:{ grid:{ display:false }, border:{ display:false },
            ticks:{ callback:fmtAxis, maxTicksLimit:4, font:{ size:9 } } },
        y:{ grid:{ display:false }, border:{ display:false },
            ticks:{ autoSkip:false, font:{ size:10 } } }
      }
    }
  });
  charts[id].$full = full;
  charts[id].$onSelect = onSelect;
  charts[id].$padRight = padRight;
}

/* ---------- Талбайт график (он / хугацааны цуваа) ---------- */

/** Утгын хүрээ 100 дахин зөрөх ба бүгд эерэг үед логарифм тэнхлэг тохиромжтой */
function shouldUseLog(values){
  const pos = values.filter(v => v > 0);
  if (pos.length < values.length || pos.length < 3) return false;
  return Math.max(...pos) / Math.min(...pos) > 100;
}

const areaFill = color => c => {
  const { chart } = c;
  if (!chart.chartArea) return alpha(color, .2);
  const g = chart.ctx.createLinearGradient(0, chart.chartArea.top, 0, chart.chartArea.bottom);
  g.addColorStop(0, alpha(color, .45));
  g.addColorStop(1, alpha(color, 0));
  return g;
};

function areaChart(id, rows, { valueFmt = fmtMoneyStr, labelFmt, color = PALETTE[0], measure } = {}){
  const ctx = document.getElementById(id);
  if (!ctx) return;
  const labels = rows.map(r => String(r.key));
  const values = rows.map(r => r.value);
  const useLog = shouldUseLog(values);

  if (charts[id]){
    charts[id].data.labels = labels;
    charts[id].data.datasets[0].data = values;
    charts[id].options.scales.y.type = useLog ? 'logarithmic' : 'linear';
    charts[id].update();
    return;
  }
  charts[id] = new Chart(ctx, {
    type:'line',
    data:{ labels, datasets:[{
      data: values,
      borderColor: color, borderWidth:2,
      fill: true, backgroundColor: areaFill(color),
      tension:.35,
      pointRadius:4, pointHoverRadius:6,
      pointBackgroundColor: alpha(color, .95),
      pointBorderColor:'#ffffff', pointBorderWidth:1.2
    }] },
    options:{
      layout:{ padding:{ top:28, right:8 } },
      plugins:{
        legend:{ display:false },
        tooltip: tooltipCfg(valueFmt, 'y', measure),
        dataLabels:{ axis:'y', formatter: labelFmt || valueFmt }
      },
      scales:{
        y:{ type: useLog ? 'logarithmic' : 'linear',
            grid:{ display:false }, border:{ display:false },
            ticks:{ callback:fmtAxisMn, maxTicksLimit:6, font:{ size:9 } } },
        x:{ grid:{ display:false }, border:{ display:false } }
      }
    }
  });
}

/* ---------- Бөгж диаграм ---------- */
function donutChart(id, rows, { valueFmt = fmtNum, measure } = {}){
  const ctx = document.getElementById(id);
  if (!ctx) return;
  const labels = rows.map(r => r.key == null ? '(хоосон)' : String(r.key));
  const values = rows.map(r => r.value);
  const colors = rows.map((_, i) => PALETTE[i % PALETTE.length]);
  const fills = colors.map(c => alpha(c, FILL_ALPHA));

  if (charts[id]){
    charts[id].data.labels = labels;
    charts[id].data.datasets[0].data = values;
    charts[id].data.datasets[0].backgroundColor = fills;
    charts[id].data.datasets[0].borderColor = colors;
    charts[id].data.datasets[0].hoverBackgroundColor = colors.map(c => alpha(c, .38));
    charts[id].update();
    return;
  }
  charts[id] = new Chart(ctx, {
    type:'doughnut',
    data:{ labels, datasets:[{
      data:values, backgroundColor:fills, borderColor:colors, borderWidth:1,
      hoverBackgroundColor: colors.map(c => alpha(c, .38)), hoverOffset:4
    }] },
    options:{
      radius:'58%', cutout:'56%',
      layout:{ padding:{ left:58, right:58, top:16, bottom:16 } },
      plugins:{
        legend:{ display:false },
        donutLabels:{ minPercent:2, maxWidth:74 },
        tooltip:{
          backgroundColor:'#060c10', borderColor: PALETTE[0], borderWidth:1, cornerRadius:6,
          padding:{ top:9, bottom:9, left:11, right:11 },
          titleColor:'#e6f0f4', titleFont:{ size:11.5, weight:'600' }, titleMarginBottom:6,
          bodyColor:'#e6f0f4', bodyFont:{ size:13, weight:'700' },
          displayColors:true, usePointStyle:true, boxWidth:7, boxHeight:7, boxPadding:5,
          callbacks:{
            labelColor: tooltipDotColor,
            title: items => wrapForTooltip(items[0].label).map((l, i) => (i === 0 ? '• ' : '   ') + l),
            label: it => {
              const sum = it.dataset.data.reduce((a, b) => a + b, 0) || 1;
              const pct = (it.parsed / sum * 100).toFixed(2);
              return `${measure ? measure + ': ' : ''}${valueFmt(it.parsed)} (${pct}%)`;
            }
          }
        }
      }
    }
  });
}
