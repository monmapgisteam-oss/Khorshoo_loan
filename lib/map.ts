/* ---------- Газрын зураг — эх вэб зураг хэвээрээ ---------- */
/* Дүрслэл, popup, давхаргын жагсаалт, суурь зураг бүгд зохиогчийнхөөрөө.
   Энд ямар ч symbology / featureReduction / popupTemplate дарж бичихгүй.
   Цорын ганц үйлдэл нь толгойн шүүлтүүрийг зээлийн давхаргад дамжуулах.

   Хуучин апп CDN-ийн AMD ачаалагч (require) ашигладаг байсан бол одоо
   @arcgis/core (ижил 4.31 хувилбар) npm багцыг dynamic import-оор
   зөвхөн хөтөч дээр, газрын зураг хэрэгтэй болсон үед л ачаална.
   Assets (worker, font, icon) нь анхдагчаар ArcGIS CDN-ээс уншигдана. */

import { WEBMAP_ID } from './config';
import { mapTitleStore } from './store';

interface MapApi {
  view2d: any;
  view3d: any;
  map2d: any;
  map3d: any;
  loanLayers2d: any[] | null;
  loanLayers3d: any[] | null;
}

let mapApi: MapApi | null = null;
let pendingWhere = '1=1';
let mapMode: '2d' | '3d' = '2d';
let homeViewpoint: any = null;   // шүүлтүүргүй үеийн анхны байрлал
let initToken = 0;               // StrictMode-ийн давхар mount-оос хамгаална

const LOAN_URL_PART = '/services/Khorshoo/FeatureServer';
export const MAP_CONTAINER_ID = 'mapView';

/** Вэб зургаас Khorshoo сервисийн давхаргуудыг олох (шүүлтүүр тавихад л хэрэгтэй) */
function findLoanLayers(map: any): any[] {
  return map.allLayers.filter((l: any) => l.url && l.url.indexOf(LOAN_URL_PART) > -1).toArray();
}

function applyWhere(layers: any[] | null){
  if (layers) layers.forEach(l => { l.definitionExpression = pendingWhere; });
}

/**
 * Дашбоардын зарчмаар: шүүлтүүрт тохирох цэгүүдийн хүрээ рүү шилжинэ.
 * Шүүлтүүр цэвэрлэгдвэл анхны байрлалдаа буцна.
 */
async function zoomToFilter(){
  if (!mapApi) return;
  const is3d  = mapMode === '3d';
  const view  = is3d ? mapApi.view3d : mapApi.view2d;
  const layer = ((is3d ? mapApi.loanLayers3d : mapApi.loanLayers2d) || [])[0];
  if (!view || !layer) return;

  try {
    if (pendingWhere === '1=1'){
      if (homeViewpoint) await view.goTo(homeViewpoint, { duration: 700 });
      return;
    }
    const { count, extent } = await layer.queryExtent({ where: pendingWhere });
    if (!count || !extent) return;

    // Ганц цэг эсвэл маш жижиг хүрээнд expand() ажиллахгүй тул масштабаар очно
    const tiny = !(extent.width > 1) && !(extent.height > 1);
    await view.goTo(tiny ? { target: extent.center, scale: 150000 }
                         : extent.clone().expand(1.35), { duration: 700 });
  } catch (err: any) {
    if (err && err.name !== 'AbortError') console.warn('Газрын зураг шилжүүлэхэд:', err);
  }
}

export async function initMap(){
  const my = ++initToken;
  const [{ default: WebMap }, { default: MapView }, { default: SceneView }] = await Promise.all([
    import('@arcgis/core/WebMap'),
    import('@arcgis/core/views/MapView'),
    import('@arcgis/core/views/SceneView')
  ]);
  // Ачаалж байх хооронд компонент unmount хийгдсэн бол (StrictMode) зогсооно
  if (my !== initToken) return;

  const map2d = new WebMap({ portalItem:{ id: WEBMAP_ID } });
  const view2d = new MapView({
    container: MAP_CONTAINER_ID, map: map2d,
    ui:{ components:['zoom','attribution'] }
  });

  const map3d = new WebMap({ portalItem:{ id: WEBMAP_ID } });
  const view3d = new SceneView({ map: map3d, ui:{ components:['zoom','attribution'] } });

  mapApi = { view2d, view3d, map2d, map3d, loanLayers2d:null, loanLayers3d:null };
  mapMode = '2d';

  view2d.when(() => { homeViewpoint = view2d.viewpoint.clone(); });

  map2d.when(() => {
    if (!mapApi || mapApi.map2d !== map2d) return;
    mapApi.loanLayers2d = findLoanLayers(map2d);
    applyWhere(mapApi.loanLayers2d);
    if (pendingWhere !== '1=1') zoomToFilter();
    if (map2d.portalItem && map2d.portalItem.title) mapTitleStore.set(map2d.portalItem.title);
  }, (err: any) => {
    console.error('WebMap ачаалж чадсангүй:', err);
    mapTitleStore.set('Вэб зураг ачаалагдсангүй');
  });

  map3d.when(() => {
    if (!mapApi || mapApi.map3d !== map3d) return;
    mapApi.loanLayers3d = findLoanLayers(map3d);
    applyWhere(mapApi.loanLayers3d);
  });
}

/** Dashboard unmount — view-үүдийг чөлөөлнө */
export function destroyMap(){
  initToken++;
  if (!mapApi) return;
  const { view2d, view3d, map2d, map3d } = mapApi;
  mapApi = null;
  homeViewpoint = null;
  mapMode = '2d';
  try { view2d.destroy(); } catch {}
  try { view3d.destroy(); } catch {}
  try { map2d.destroy(); } catch {}
  try { map3d.destroy(); } catch {}
}

export function setMapWhere(where: string){
  if (where === pendingWhere) return;
  pendingWhere = where;
  if (!mapApi) return;
  applyWhere(mapApi.loanLayers2d);
  applyWhere(mapApi.loanLayers3d);
  zoomToFilter();
}

/** 2D <-> 3D сэлгэх (нэг контейнерийг дамжуулна) */
export function setMapMode(mode: '2d' | '3d'){
  if (!mapApi || mode === mapMode) return;
  const from = mode === '3d' ? mapApi.view2d : mapApi.view3d;
  const to   = mode === '3d' ? mapApi.view3d : mapApi.view2d;
  const vp = from.viewpoint ? from.viewpoint.clone() : null;
  from.container = null;
  to.container = MAP_CONTAINER_ID;
  if (vp) to.viewpoint = vp;
  mapMode = mode;
}
