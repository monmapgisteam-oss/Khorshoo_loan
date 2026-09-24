'use client';

import { useLayoutEffect, useState } from 'react';
import { MAP_CONTAINER_ID, setMapMode } from '@/lib/map';
import { resizeAllCharts } from '@/lib/charts';
import { mapCountStore, mapTitleStore, useStore } from '@/lib/store';
import { Tabs } from './Tabs';

const MAP_TABS = [
  { id: 'm2d', label: '2D' },
  { id: 'm3d', label: '3D' }
];

export default function MapPanel() {
  const [active, setActive] = useState('m2d');
  const title = useStore(mapTitleStore);
  const count = useStore(mapCountStore);

  useLayoutEffect(() => {
    setMapMode(active === 'm3d' ? '3d' : '2d');
    resizeAllCharts();
  }, [active]);

  return (
    <div className="panel map-panel">
      <div className="panel-title">{title}</div>
      <div className="tab-body">
        <div id={MAP_CONTAINER_ID} className="map-host" />
        <div className="map-legend">Шүүлтүүрт тохирох хоршоо <b>{count}</b></div>
      </div>
      <Tabs tabs={MAP_TABS} active={active} onChange={setActive} nav={false} />
    </div>
  );
}
