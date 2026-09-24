'use client';

import { useEffect } from 'react';
import { RICH_TEXT } from '@/lib/config';
import { filterVersion } from '@/lib/data';
import { useStore } from '@/lib/store';
import { destroyAllCharts, resizeAllCharts } from '@/lib/charts';
import { destroyMap, initMap } from '@/lib/map';
import { loadStaticWidgets, refresh } from '@/lib/dashboard';
import Header from './Header';
import KpiRow from './KpiRow';
import YearKpiRow from './YearKpiRow';
import { ChartPanel, TabbedPanel } from './Tabs';
import MapPanel from './MapPanel';
import Loading from './Loading';

export default function Dashboard() {
  const version = useStore(filterVersion);

  /* Эхлүүлэх: газрын зураг, шүүлтүүрээс хамаарахгүй виджетүүд, цонхны хэмжээ */
  useEffect(() => {
    initMap();
    loadStaticWidgets();

    let timer: ReturnType<typeof setTimeout> | undefined;
    const onResize = () => {
      clearTimeout(timer);
      timer = setTimeout(resizeAllCharts, 150);
    };
    window.addEventListener('resize', onResize);
    return () => {
      window.removeEventListener('resize', onResize);
      clearTimeout(timer);
      destroyMap();
      destroyAllCharts();
    };
  }, []);

  /* Шүүлтүүр өөрчлөгдөх бүрд (эхний ачаалалд ч) бүх виджетийг шинэчилнэ */
  useEffect(() => { refresh(); }, [version]);

  return (
    <>
      <Header />

      <main className="grid">
        {/* ЗҮҮН БАГАНА */}
        <TabbedPanel
          className="col col-left panel"
          tabs={[
            { id: 'l1', label: 'ОЛГОСОН ДҮН', pane: <canvas id="chartAimagAmount" /> },
            { id: 'l2', label: 'ОЛГОСОН ТОО', pane: <canvas id="chartAimagCount" /> },
            { id: 'l3', label: 'МАЛЫН ТОО',   pane: <canvas id="chartLivestock" /> }
          ]}
        />

        {/* ТӨВ БАГАНА */}
        <section className="col col-center">
          <KpiRow />

          <div className="mid-row">
            <div className="panel richtext" dangerouslySetInnerHTML={{ __html: RICH_TEXT }} />

            <MapPanel />

            <div className="mid-right">
              <ChartPanel title="ЗЭЭЛ ОЛГОСОН БАНК"><canvas id="chartBank" /></ChartPanel>
              <ChartPanel title="ЗЭЭЛ ОЛГОСОН ОГНОО"><canvas id="chartIssuedYear" /></ChartPanel>
            </div>
          </div>

          <YearKpiRow />

          <div className="bottom-row">
            <TabbedPanel
              className="panel"
              tabs={[
                { id: 'b1', label: 'ТӨЛӨЛТИЙН ОГНОО',                  pane: <canvas id="chartDueYear" /> },
                { id: 'b2', label: '2024 ОНД ОЛГОСОН ЗЭЭЛИЙН ТӨЛӨЛТ', pane: <canvas id="chartRepay2024" /> },
                { id: 'b3', label: '2025 ОНД ОЛГОСОН ЗЭЭЛИЙН ТӨЛӨЛТ', pane: <canvas id="chartRepay2025" /> }
              ]}
            />
            <ChartPanel title="ЯВЦ"><canvas id="chartStatus" /></ChartPanel>
          </div>
        </section>

        {/* БАРУУН БАГАНА */}
        <TabbedPanel
          className="col col-right panel"
          tabs={[
            { id: 'r1', label: 'ЗЭЭЛИЙН ЗОРИУЛАЛТ', pane: <canvas id="chartPurpose" /> },
            { id: 'r2', label: 'ОЛГОСОН ДҮН СУМААР', pane: <canvas id="chartSoumAmount" /> },
            { id: 'r3', label: 'ОЛГОСОН ТОО СУМААР', pane: <canvas id="chartSoumCount" /> }
          ]}
        />
      </main>

      <Loading />
    </>
  );
}
