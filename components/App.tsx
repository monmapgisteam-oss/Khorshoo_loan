'use client';

import AuthGate from './AuthGate';
import Dashboard from './Dashboard';

/** Клиент талын үндсэн модны оройн цэг: нэвтрэлтийн хаалт + дашбоард */
export default function App() {
  return (
    <AuthGate>
      <Dashboard />
    </AuthGate>
  );
}
