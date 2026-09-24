/* ---------- ArcGIS REST асуулга ---------- */

import { F, FILTER_FIELDS, NUM_PREFIX, type FilterField } from './config';
import { busyStore, createStore } from './store';

function busy(on: boolean) {
  busyStore.set(n => n + (on ? 1 : -1));
}

export type Attributes = Record<string, any>;

export interface StatDef {
  onStatisticField: string;
  statisticType: 'count' | 'sum' | 'min' | 'max' | 'avg' | 'stddev' | 'var';
  outStatisticFieldName: string;
}

export async function esriQuery(url: string, params: Record<string, string>): Promise<any> {
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

export interface StatsOpts {
  where?: string;
  groupBy?: string;
  stats: StatDef[];
  orderBy?: string;
  limit?: number;
}

/** Бүлэглэсэн статистик асуулга -> [{key, value}] */
export async function queryStats(url: string, { where='1=1', groupBy, stats, orderBy, limit }: StatsOpts): Promise<Attributes[]> {
  const params: Record<string, string> = {
    where,
    outStatistics: JSON.stringify(stats),
    returnGeometry:'false'
  };
  if (groupBy) params.groupByFieldsForStatistics = groupBy;
  if (orderBy) params.orderByFields = orderBy;
  if (limit)   params.resultRecordCount = String(limit);
  const j = await esriQuery(url, params);
  return (j.features || []).map((f: any) => f.attributes);
}

/** Ганц тоон утга */
export async function queryScalar(url: string, { where='1=1', field, stat='sum' }: { where?: string; field: string; stat?: StatDef['statisticType'] }): Promise<number> {
  const rows = await queryStats(url, {
    where,
    stats:[{ onStatisticField: field, statisticType: stat, outStatisticFieldName:'v' }]
  });
  return rows.length ? (rows[0].v ?? 0) : 0;
}

export async function queryCount(url: string, where='1=1'): Promise<number> {
  const j = await esriQuery(url, { where, returnCountOnly:'true' });
  return j.count || 0;
}

/**
 * Талбарын ялгаатай утгын тоо (жишээ нь давхардаагүй хоршооны тоо).
 * ArcGIS-ийн returnDistinctValues нь NULL-ийг алгасдаг тул хоосон утгыг
 * нэг бүлэг гэж тусад нь нэмнэ — жишиг хүснэгтийн тоололтой ингэж нийцнэ.
 */
export async function queryDistinctCount(url: string, field: string, where = '1=1'): Promise<number> {
  const [distinct, nulls] = await Promise.all([
    esriQuery(url, { where, outFields: field,
                     returnDistinctValues: 'true', returnCountOnly: 'true' }),
    esriQuery(url, { where: andWhere(where, `${field} IS NULL`), returnCountOnly: 'true' })
  ]);
  return (distinct.count || 0) + (nulls.count > 0 ? 1 : 0);
}

/* ---------- Шүүлтүүрийн төлөв ---------- */

export interface Filters {
  [F.aimag]: Set<string>;
  [F.soum]: Set<string>;
  [F.purpose]: Set<string>;
  [F.bank]: Set<string>;
  dateFrom: string | null;
  dateTo: string | null;
}

/* Хуучин апп шиг нэг мутацлагдах объект — буildWhere, тайлан, график бүгд
   үүнийг шууд уншина. Өөрчлөлт бүрийн дараа filterVersion-ийг нэмэгдүүлснээр
   React компонентууд (сонгогчийн шошго, refresh) дахин ажиллана. */
export const filters: Filters = {
  [F.aimag]:   new Set(),
  [F.soum]:    new Set(),
  [F.purpose]: new Set(),
  [F.bank]:    new Set(),
  dateFrom: null,
  dateTo:   null
};

export const filterVersion = createStore(0);

/** Шүүлтүүрийг мутацлаад бүх сонсогчид мэдэгдэнэ */
export function commitFilters(mutate?: () => void) {
  if (mutate) mutate();
  filterVersion.set(v => v + 1);
}

export function toggleFilterValue(field: FilterField, value: string) {
  commitFilters(() => {
    const set = filters[field];
    if (set.has(value)) set.delete(value); else set.add(value);
  });
}

/** Сумын нэр аймаг хооронд давхардах тул сум сонгоход аймгийг нь мөн онооно */
export function toggleSoumFilter(soum: string, aimag: string) {
  commitFilters(() => {
    const set = filters[F.soum];
    if (set.has(soum)) set.delete(soum);
    else { set.add(soum); filters[F.aimag].add(aimag); }
  });
}

export function setDateFilter(from: string | null, to: string | null) {
  commitFilters(() => { filters.dateFrom = from; filters.dateTo = to; });
}

export function resetFilters() {
  commitFilters(() => {
    FILTER_FIELDS.forEach(f => filters[f].clear());
    filters.dateFrom = filters.dateTo = null;
  });
}

export const sqlStr = (v: unknown) => "'" + String(v).replace(/'/g, "''") + "'";

/**
 * Идэвхтэй шүүлтүүрээс WHERE үүсгэнэ.
 * @param except - алгасах талбарууд (сонгогчийн өөрийн жагсаалтад)
 */
export function buildWhere(except: string[] = []): string {
  const parts: string[] = [];
  for (const f of FILTER_FIELDS){
    if (except.includes(f)) continue;
    const s = filters[f];
    if (s && s.size) parts.push(`${f} IN (${[...s].map(sqlStr).join(',')})`);
  }
  if (filters.dateFrom) parts.push(`${F.issuedDate} >= timestamp '${filters.dateFrom} 00:00:00'`);
  if (filters.dateTo)   parts.push(`${F.issuedDate} <= timestamp '${filters.dateTo} 23:59:59'`);
  return parts.length ? parts.join(' AND ') : '1=1';
}

export const andWhere = (a: string, b?: string) => (!b ? a : a === '1=1' ? b : `(${a}) AND (${b})`);

/* ---------- Форматлах ---------- */
/* ArcGIS Dashboards-ийн numberPrefixOverrides-той ижил: 908.9тэрбум, 1их наяд, 104сая */

export const grouped = (v: number | string, dp = 1) => Number(v).toLocaleString('en-US', { maximumFractionDigits: dp });

/** Товчилсон мөнгөн дүн — тоо ба нэгжийн хооронд зай байхгүй */
export function fmtMoneyStr(v: any): string {
  if (v == null || isNaN(v)) return '—';
  const a = Math.abs(v);
  for (const [mul, unit] of NUM_PREFIX){
    if (a >= mul) return grouped(v / mul) + unit;
  }
  return grouped(v, 0);
}

/** Тэнхлэгийн шошго — мөн адил товчлол */
export const fmtAxis   = (v: any) => fmtMoneyStr(v);
export const fmtAxisMn = (v: any) => fmtMoneyStr(v);

/** Бүтэн, бутархайтай дүн: 31,895,296,309.6 */
export const fmtExact = (v: number) => grouped(v);

export const fmtNum = (v: any) => (v == null || isNaN(v)) ? '—' : Number(v).toLocaleString('en-US');

export const truncate = (s: unknown, n=26) => { const t = s == null ? '(хоосон)' : String(s); return t.length > n ? t.slice(0, n-1) + '…' : t; };
