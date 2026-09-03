/* ---------- Газрын зураг — эх вэб зураг хэвээрээ ---------- */
/* Дүрслэл, popup, давхаргын жагсаалт, суурь зураг бүгд зохиогчийнхөөрөө.
   Энд ямар ч symbology / featureReduction / popupTemplate дарж бичихгүй.
   Цорын ганц үйлдэл нь толгойн шүүлтүүрийг зээлийн давхаргад дамжуулах. */

let mapApi = null;          // { view2d, view3d, loanLayers2d, loanLayers3d }
let pendingWhere = '1=1';
let mapMode = '2d';
let homeViewpoint = null;   // шүүлтүүргүй үеийн анхны байрлал

const LOAN_URL_PART = '/services/Khorshoo/FeatureServer';

/** Вэб зургаас Khorshoo сервисийн давхаргуудыг олох (шүүлтүүр тавихад л хэрэгтэй) */
function findLoanLayers(map){
  return map.allLayers.filter(l => l.url && l.url.indexOf(LOAN_URL_PART) > -1).toArray();
}

function applyWhere(layers){
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
  } catch (err) {
    if (err && err.name !== 'AbortError') console.warn('Газрын зураг шилжүүлэхэд:', err);
  }
}

function initMap(){
  require(['esri/WebMap', 'esri/views/MapView', 'esri/views/SceneView'],
  function(WebMap, MapView, SceneView){

    const map2d = new WebMap({ portalItem:{ id: WEBMAP_ID } });
    const view2d = new MapView({
      container:'mapView', map:map2d,
      ui:{ components:['zoom','attribution'] }
    });

    const map3d = new WebMap({ portalItem:{ id: WEBMAP_ID } });
    const view3d = new SceneView({ map:map3d, ui:{ components:['zoom','attribution'] } });

    mapApi = { view2d, view3d, loanLayers2d:null, loanLayers3d:null };

    view2d.when(() => { homeViewpoint = view2d.viewpoint.clone(); });

    map2d.when(() => {
      mapApi.loanLayers2d = findLoanLayers(map2d);
      applyWhere(mapApi.loanLayers2d);
      if (pendingWhere !== '1=1') zoomToFilter();
      const t = document.getElementById('mapTitle');
      if (t && map2d.portalItem) t.textContent = map2d.portalItem.title;
    }, err => {
      console.error('WebMap ачаалж чадсангүй:', err);
      const t = document.getElementById('mapTitle');
      if (t) t.textContent = 'Вэб зураг ачаалагдсангүй';
    });

    map3d.when(() => {
      mapApi.loanLayers3d = findLoanLayers(map3d);
      applyWhere(mapApi.loanLayers3d);
    });
  });
}

function setMapWhere(where){
  if (where === pendingWhere) return;
  pendingWhere = where;
  if (!mapApi) return;
  applyWhere(mapApi.loanLayers2d);
  applyWhere(mapApi.loanLayers3d);
  zoomToFilter();
}

/** 2D <-> 3D сэлгэх (нэг контейнерийг дамжуулна) */
function setMapMode(mode){
  if (!mapApi || mode === mapMode) return;
  const from = mode === '3d' ? mapApi.view2d : mapApi.view3d;
  const to   = mode === '3d' ? mapApi.view3d : mapApi.view2d;
  const vp = from.viewpoint ? from.viewpoint.clone() : null;
  from.container = null;
  to.container = 'mapView';
  if (vp) to.viewpoint = vp;
  mapMode = mode;
}

window.initMap = initMap;
window.setMapWhere = setMapWhere;
window.setMapMode = setMapMode;
