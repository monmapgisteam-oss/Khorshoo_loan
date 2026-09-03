/* ---------- ArcGIS REST асуулга ---------- */

let _pending = 0;
function busy(on){
  _pending += on ? 1 : -1;
  document.getElementById('loading').classList.toggle('on', _pending > 0);
}

async function esriQuery(url, params){
  const body = new URLSearchParams({ f:'json', sqlFormat:'standard', ...params });
  busy(true);
  try{
    const r = await fetch(url + '/query', {
      method:'POST',
      headers:{ 'Content-Type':'application/x-www-form-urlencoded; charset=UTF-8' },
      body
    });
    const j = await r.json();
    if (j.error) throw new Error(j.error.message || 'Query error');
    return j;
  } finally { busy(false); }
}

/** Бүлэглэсэн статистик асуулга -> [{key, value}] */
async function queryStats(url, { where='1=1', groupBy, stats, orderBy, limit } = {}){
  const params = {
    where,
    outStatistics: JSON.stringify(stats),
    returnGeometry:'false'
  };
  if (groupBy) params.groupByFieldsForStatistics = groupBy;
  if (orderBy) params.orderByFields = orderBy;
  if (limit)   params.resultRecordCount = limit;
  const j = await esriQuery(url, params);
  return (j.features || []).map(f => f.attributes);
}

/** Ганц тоон утга */
async function queryScalar(url, { where='1=1', field, stat='sum' } = {}){
  const rows = await queryStats(url, {
    where,
    stats:[{ onStatisticField: field, statisticType: stat, outStatisticFieldName:'v' }]
  });
  return rows.length ? (rows[0].v ?? 0) : 0;
}

async function queryCount(url, where='1=1'){
  const j = await esriQuery(url, { where, returnCountOnly:'true' });
  return j.count || 0;
}

/**
 * Талбарын ялгаатай утгын тоо (жишээ нь давхардаагүй хоршооны тоо).
 * ArcGIS-ийн returnDistinctValues нь NULL-ийг алгасдаг тул хоосон утгыг
 * нэг бүлэг гэж тусад нь нэмнэ — жишиг хүснэгтийн тоололтой ингэж нийцнэ.
 */
async function queryDistinctCount(url, field, where = '1=1'){
  const [distinct, nulls] = await Promise.all([
    esriQuery(url, { where, outFields: field,
                     returnDistinctValues: 'true', returnCountOnly: 'true' }),
    esriQuery(url, { where: andWhere(where, `${field} IS NULL`), returnCountOnly: 'true' })
  ]);
  return (distinct.count || 0) + (nulls.count > 0 ? 1 : 0);
}

/* ---------- Шүүлтүүрийн төлөв ---------- */

const filters = {
  [F.aimag]:   new Set(),
  [F.soum]:    new Set(),
  [F.purpose]: new Set(),
  [F.bank]:    new Set(),
  dateFrom: null,
  dateTo:   null
};

const sqlStr = v => "'" + String(v).replace(/'/g, "''") + "'";

/**
 * Идэвхтэй шүүлтүүрээс WHERE үүсгэнэ.
 * @param {string[]} except - алгасах талбарууд (сонгогчийн өөрийн жагсаалтад)
 */
function buildWhere(except = []){
  const parts = [];
  for (const f of [F.aimag, F.soum, F.purpose, F.bank]){
    if (except.includes(f)) continue;
    const s = filters[f];
    if (s && s.size) parts.push(`${f} IN (${[...s].map(sqlStr).join(',')})`);
  }
  if (filters.dateFrom) parts.push(`${F.issuedDate} >= timestamp '${filters.dateFrom} 00:00:00'`);
  if (filters.dateTo)   parts.push(`${F.issuedDate} <= timestamp '${filters.dateTo} 23:59:59'`);
  return parts.length ? parts.join(' AND ') : '1=1';
}

const andWhere = (a, b) => (!b ? a : a === '1=1' ? b : `(${a}) AND (${b})`);

/* ---------- Форматлах ---------- */
/* ArcGIS Dashboards-ийн numberPrefixOverrides-той ижил: 908.9тэрбум, 1их наяд, 104сая */

const grouped = (v, dp = 1) => Number(v).toLocaleString('en-US', { maximumFractionDigits: dp });

/** Товчилсон мөнгөн дүн — тоо ба нэгжийн хооронд зай байхгүй */
function fmtMoneyStr(v){
  if (v == null || isNaN(v)) return '—';
  const a = Math.abs(v);
  for (const [mul, unit] of NUM_PREFIX){
    if (a >= mul) return grouped(v / mul) + unit;
  }
  return grouped(v, 0);
}

/** Тэнхлэгийн шошго — мөн адил товчлол */
const fmtAxis   = v => fmtMoneyStr(v);
const fmtAxisMn = v => fmtMoneyStr(v);

/** Бүтэн, бутархайтай дүн: 31,895,296,309.6 */
const fmtExact = v => grouped(v);

const fmtNum = v => (v == null || isNaN(v)) ? '—' : Number(v).toLocaleString('en-US');

const truncate = (s, n=26) => { s = s == null ? '(хоосон)' : String(s); return s.length > n ? s.slice(0, n-1) + '…' : s; };
