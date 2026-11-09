import { StrictMode, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import { registerSW } from 'virtual:pwa-register';
import App from './App';
import { AuthProvider } from '@/auth/AuthProvider';
import { keys } from '@/data/hooks';
import { syncQueue } from '@/offline/queue';
import './index.css';

const client = new QueryClient({ defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: true } } });
function SyncRefresh() {
  const qc = useQueryClient();
  useEffect(() => { syncQueue.onSynced((ids) => ids.forEach((id) => qc.invalidateQueries({ queryKey: keys.bundle(id) }))); }, [qc]);
  return null;
}
if (import.meta.env.PROD) registerSW({ immediate: true });
createRoot(document.getElementById('root')!).render(
  <StrictMode><QueryClientProvider client={client}><BrowserRouter><AuthProvider><SyncRefresh /><App /></AuthProvider></BrowserRouter></QueryClientProvider></StrictMode>,
);
