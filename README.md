# Хоршооны зээлийн мэдээлэл — Web App (Next.js)

ArcGIS Dashboard `bfb940a423854fb992e1df8a26e01cf0`-ийн бүтцийг давтсан веб апп.
Next.js (App Router, TypeScript) дээр бичигдсэн бөгөөд **статик экспорт** хийгддэг —
сервер хэрэггүй, `out/` хавтсыг дурын статик хостинг дээр тавихад ажиллана.
Бүх тоо ArcGIS REST `query` (outStatistics) хүсэлтээр хөтчөөс шууд сервисээс
уншигдана — локал хуулбар дата байхгүй.

## Дата эх сурвалж

| Виджет | Сервис |
|---|---|
| Зээлийн цэгүүд, KPI, аймаг/банк/зориулалт/явц, огнооны график | `Khorshoo/FeatureServer/0` |
| Батлагдсан төсөв / гүйцэтгэл (6 үзүүлэлт) | `Зээлийн_тайлан1/FeatureServer/0` |
| 2024 / 2025 онд олгосон зээлийн төлөлт | `Хоршоо_хэрэгжилт/FeatureServer/0` |
| Малын тоо аймгаар | `livestock_soum_auto_1778573077/FeatureServer/0` |
| Аймгийн хил (лавлагаа давхарга) | `ZTHT_ALL_Data/FeatureServer/11` |

## Ажиллуулах

```
npm install
npm run dev        # http://localhost:3000 — хөгжүүлэлт (hot reload)
npm run build      # статик экспорт -> out/
npm start          # out/ хавтсыг локал сервер дээр харах
```

Node.js 20+ шаардлагатай. Production-д зөвхөн `out/` хавтсыг байршуулна.

### GitHub Pages

`.github/workflows/deploy.yml` нь `main` руу push хийх бүрд build хийж Pages руу
байршуулна. Repo Settings → Pages → Source-ыг **GitHub Actions** гэж сонгосон
байх ёстой. Pages нь `https://<user>.github.io/<repo>/` гэсэн дэд замтай тул
workflow нь `NEXT_PUBLIC_BASE_PATH=/<repo>` гэж тохируулж build хийдэг.
Өөр домэйн дээр root-оос үйлчлэх бол энэ хувьсагчийг тавихгүй.

## ArcGIS Online нэвтрэлт (заавал биш)

`NEXT_PUBLIC_ARCGIS_CLIENT_ID` орчны хувьсагч тавигдсан үед л идэвхжинэ. Хоосон бол
апп нэвтрэлтгүй, нээлттэй ажиллана.

1. ArcGIS Online → Content → New item → **Developer credentials** → **OAuth 2.0 credentials**.
2. Redirect URLs: аппын хаяг (`https://khorshoo-loan.vercel.app/`, `https://khorshoo-loan.vercel.app`)
   ба хөгжүүлэлтэд `http://localhost:3000`. Application environment: Browser. URL: аппын хаяг.
3. Үүссэн **Client ID**-г Vercel → Settings → Environment Variables дээр
   `NEXT_PUBLIC_ARCGIS_CLIENT_ID` нэрээр нэмж, дахин deploy хийнэ. Локалд `.env.local` файлд бичнэ
   (`.env.example`-ийг хар). Client Secret хэрэггүй.

Нэвтэрсний дараа `@arcgis/core`-ийн бүх хүсэлт (вэб зураг, давхарга) болон аппын REST
асуулгууд (`lib/data.ts`) token-той явна. Тиймээс сервисүүдийг AGOL дээр private болгож,
нэвтэрсэн хэрэглэгчдэд хуваалцсан ч апп ажиллана. Сервис public хэвээр бол нэвтрэлт нь
зөвхөн хуудсыг хаах бөгөөд REST хаягаар шууд хандахаас хамгаалахгүй.

Холбогдох файлууд: `lib/auth.ts` (IdentityManager + OAuthInfo), `components/AuthGate.tsx`
(нэвтрэх дэлгэц), `components/UserBadge.tsx` (нэр + Гарах товч).

## Бүтэц

```
app/layout.tsx          <html lang="mn">, ArcGIS dark сэдвийн CSS, globals.css
app/page.tsx            App-ыг зөвхөн клиент дээр (ssr:false) ачаална
.env.example            ArcGIS нэвтрэлтийн орчны хувьсагчийн жишээ
app/globals.css         dark сэдэв, grid layout
components/
  App.tsx               AuthGate + Dashboard
  AuthGate.tsx          ArcGIS Online нэвтрэлтийн хаалт (Client ID байхгүй бол алгасна)
  UserBadge.tsx         нэвтэрсэн хэрэглэгчийн нэр, Гарах товч
  Dashboard.tsx         3 багана, KPI мөрүүд; init (газрын зураг, статик виджет) ба refresh
  Header.tsx            гарчиг, сонгогчид, огноо, Тайлан, цэвэрлэх; цэсний нээлт/хаалт
  Selector.tsx          олон сонголттой, хайлттай, каскад сонгогч
  DateSelector.tsx      ОЛГОСОН ОГНОО-ны хугацаа
  ReportButton.tsx      .docx тайлан татах товч
  KpiRow.tsx            толгойн 7 үзүүлэлт (дүрс + тоо)
  YearKpiRow.tsx        он тус бүрийн төсөв / гүйцэтгэл
  Tabs.tsx              табтай самбар (‹ › сум, гарчиг = идэвхтэй таб), энгийн графикийн самбар
  MapPanel.tsx          газрын зураг 2D/3D, тохирох хоршооны тоо
  Loading.tsx           хүсэлт явж байх үеийн spinner
lib/
  auth.ts               OAuth 2.0 нэвтрэлт (IdentityManager, OAuthInfo), token
  config.ts             сервисийн URL, талбарын нэр, KPI/сонгогчийн тодорхойлолт, текст
  icons.ts              KPI-ийн SVG дүрсүүд (эх дашбоардын iconInfo)
  store.ts              жижиг гадаад store (useSyncExternalStore): busy, KPI, map count/title
  data.ts               ArcGIS REST асуулга, шүүлтүүрийн төлөв, WHERE үүсгэгч, формат
  charts.ts             Chart.js — хэвтээ/босоо багана, талбайт, бөгж диаграм + плагинууд
  map.ts                @arcgis/core 4.31 — WebMap 2D/3D, definitionExpression, zoom
  dashboard.ts          refresh(): бүх виджетийн асуулга; статик виджетүүд
  report.ts             .docx тайлан угсрах (docx сан dynamic import)
```

### Төлөвийн зарчим

Шүүлтүүр (`lib/data.ts` дэх `filters`) нь хуучин апптай адил нэг мутацлагдах
объект — `buildWhere()`, тайлан, график бүгд үүнийг шууд уншина. Өөрчлөлт бүрийн
дараа `commitFilters()` нь `filterVersion`-ийг нэмэгдүүлж, түүнийг сонсож буй
компонентууд (сонгогчийн шошго, `Dashboard`-ын `refresh()` effect) дахин ажиллана.
Графикууд canvas id-гаар зурагддаг тул бүх таб-pane DOM-д үлдэж, зөвхөн идэвхтэй нь
харагдана.

## Шүүлтүүр

АЙМАГ · СУМ · ЗОРИУЛАЛТ · БАНК (олон сонголт, хайлттай) + ОЛГОСОН ОГНОО-ны хугацаа.
Сонгогчид хоорондоо каскад — АЙМАГ сонгоход СУМ-ын жагсаалт нарийсна.
Графикийн багана дээр дарахад холбогдох шүүлтүүр асаж/унтарна.
Шүүлтүүр нь Khorshoo сервис дээр суурилсан бүх виджет болон газрын зурагт үйлчилнэ;
Зээлийн тайлан, төлөлт, малын тооны виджет (эх дашбоардын нэгэн адил) шүүлтүүрээс хамаарахгүй.

## Газрын зураг

Эх дашбоардын **вэб зургийг хэвээр нь** ачаална
(`c9f54d5718934201bd690f921e69abe1`) — Khorshoo сервис нь түүний давхарга.
Дүрслэл, popup, давхаргын жагсаалт, суурь зураг бүгд зохиогчийнхөөрөө:
апп ямар ч symbology / featureReduction / popupTemplate дарж бичихгүй.

Цорын ганц үйлдэл нь толгойн шүүлтүүрийг зээлийн давхаргад
`definitionExpression` болгон дамжуулах явдал.
2D / 3D таб нь ижил вэб зургийг MapView / SceneView-д харуулна.
ArcGIS-ийн модулиуд `@arcgis/core` npm багцаас (4.31), asset-ууд нь ArcGIS CDN-ээс ачаалагдана.

## Дүрслэлийн нийцэл

Эх дашбоардын тохиргооноос шууд авсан зүйлс:
- Үзүүлэлтийн **нэр ба SVG дүрс** (`indicator.topSection` / `iconInfo` → `lib/icons.ts`)
- **Тооны формат** (`numberPrefixOverrides`): `их наяд · тэрбум · сая · k`, тоо ба
  нэгжийн хооронд зайгүй — `908.9тэрбум`, `1их наяд`
- Самбарын **гарчиг голлуулсан**, табууд **доод талд** ‹ › сумтай, гарчиг нь
  идэвхтэй табын нэрийг дагана
- Сонгогч бүр дүрс + шошго + төлөв (`No category selected`)

## Тайлан татах

Толгойн **Тайлан** товч нь дэлгэц дээр харагдаж буй бүх үзүүлэлтийг идэвхтэй
шүүлтүүрийн хамт `.docx` болгон татна. Жишээ нь АЙМАГ: Архангай гэж шүүсэн бол
`Khorshoo_tailan_Архангай_20260903.docx` нэртэй, зөвхөн Архангайн тоо бүхий
тайлан бууна.

Бүтэц нь `Khorshoo_tailan_*.docx` загварыг дагасан — гарчиг, огноо,
шүүлтийн нөхцөл, дараа нь дугаарласан бүлэг бүрд нэг өгүүлбэр тайлбар + хүснэгт:

1. Үндсэн үзүүлэлт · 2. Олгосон зээлийн дүн аймгаар · 3. Зээлийн тоо аймгаар
4. Олгосон дүн сумаар · 5. Зээлийн тоо сумаар · 6. Зориулалтаар (ҮАЧ кодтой)
7. Банк · 8. Зээл олгосон огноо · 9. Төлөлтийн огноо · 10. Явц
11. Зээлийн тайлан · 12. Малын тоо

11, 12-р бүлэг нь улсын хэмжээний үзүүлэлт тул шүүлтүүрээс хамаарахгүй — тайланд
ингэж тэмдэглэгдсэн байдаг.

`docx` санг dynamic import-оор зөвхөн товч дарах үед нэг удаа ачаална (тусдаа chunk),
тул нүүр хуудасны ачаалалд нөлөөлөхгүй.
