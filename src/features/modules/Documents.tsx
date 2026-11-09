import * as React from 'react';
import { useSearchParams } from 'react-router-dom';
import { ExternalLink, FileText, FileUp, ImageIcon, Star, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/misc';
import { confirmDialog } from '@/components/ui/confirm';
import { deleteDocument, friendlyError, signedUrl, updateRow, uploadDocument, type DocLink } from '@/data/api';
import { useRun } from '@/data/hooks';
import { formatBytes } from '@/lib/utils';
import { openExternal } from '@/lib/platform';
import { useEvent } from '../event/EventContext';
import type { DocumentRow } from '@/domain/types';

const ACCEPT = 'application/pdf,image/*,.doc,.docx,.txt,.heic';
export function UploadButton({ eventId, link, label, icon, variant = 'primary', autoOpen }: { eventId: string; link?: DocLink; label: string; icon?: React.ReactNode; variant?: 'primary' | 'soft' | 'outline'; autoOpen?: boolean }) {
  const ref = React.useRef<HTMLInputElement>(null);
  const [busy, setBusy] = React.useState(false);
  const run = useRun(eventId);
  React.useEffect(() => { if (autoOpen) ref.current?.click(); }, [autoOpen]);
  return <>
    <input ref={ref} type="file" hidden multiple accept={ACCEPT} aria-label="Choose files" data-testid="file-input" onChange={async (e) => {
      const files = [...(e.target.files ?? [])]; e.target.value = ''; if (!files.length) return;
      setBusy(true); await run(async () => { for (const f of files) await uploadDocument(eventId, f, link); return true; }, files.length > 1 ? `${files.length} files uploaded` : 'File uploaded'); setBusy(false);
    }} />
    <Button variant={variant} disabled={busy} onClick={() => ref.current?.click()}>{icon ?? <FileUp className="h-5 w-5" />}{busy ? 'Uploading…' : label}</Button>
  </>;
}
export async function openDoc(d: DocumentRow) {
  // Open synchronously so iOS Safari does not block the popup, then point it at the short-lived URL.
  const w = window.open('', '_blank');
  try { const u = await signedUrl(d.storage_path, 300); if (w) w.location.href = u; else openExternal(u); }
  catch (e) { w?.close(); toast.error(/not found/i.test((e as Error).message) ? "This file isn't available." : friendlyError(e)); }
}
export function DocList({ docs, manage }: { docs: DocumentRow[]; manage?: boolean }) {
  const { canEdit, run } = useEvent();
  return (
    <ul className="space-y-2">{docs.map((d) => {
      const I = d.mime_type?.startsWith('image/') ? ImageIcon : FileText;
      return (
        <li key={d.id} className="flex items-center rounded-2xl bg-card shadow-soft">
          <button onClick={() => openDoc(d)} className="flex min-h-16 min-w-0 flex-1 items-center gap-3 p-3 text-left">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-teal-soft text-teal"><I className="h-5 w-5" aria-hidden /></span>
            <span className="min-w-0"><span className="block truncate font-semibold">{d.name}</span><span className="text-[15px] capitalize text-ink-soft">{[d.doc_type === 'other' ? '' : d.doc_type, formatBytes(d.size_bytes)].filter(Boolean).join(', ') || 'File'}</span></span>
            <ExternalLink className="ml-auto h-4 w-4 shrink-0 text-ink-soft" aria-hidden />
          </button>
          {manage && canEdit && <>
            <Button size="icon" variant="ghost" aria-pressed={d.is_important} aria-label={d.is_important ? `Remove ${d.name} from Passes` : `Add ${d.name} to Passes`} onClick={() => run(() => updateRow('documents', d.id, { is_important: !d.is_important }).then(() => true))}><Star className={d.is_important ? 'h-5 w-5 fill-gold text-gold' : 'h-5 w-5'} /></Button>
            <Button size="icon" variant="ghost" aria-label={`Delete ${d.name}`} onClick={async () => { if (await confirmDialog({ title: `Delete ${d.name}?`, body: 'The file is removed for everyone.', action: 'Delete', destructive: true })) void run(() => deleteDocument(d).then(() => true), 'Deleted'); }}><Trash2 className="h-5 w-5" /></Button>
          </>}
        </li>
      );
    })}</ul>
  );
}
export function DocumentsPage() {
  const { b, canEdit } = useEvent();
  const [sp, setSp] = useSearchParams();
  const auto = sp.get('upload') === '1';
  React.useEffect(() => { if (auto) setSp({}, { replace: true }); }, [auto, setSp]);
  return (
    <div className="mx-auto max-w-2xl p-4 lg:p-6">
      <div className="mb-3 flex items-center justify-between"><h2 className="font-display text-[26px] font-bold">Documents</h2>{canEdit && <UploadButton eventId={b.event.id} label="Upload" autoOpen={auto} />}</div>
      {b.documents.length ? <><p className="mb-3 text-ink-soft">Star tickets and confirmations to keep them in Passes.</p><DocList docs={b.documents} manage /></> : <EmptyState icon={FileText} title="No documents yet" body="Upload tickets, confirmations, venue maps, and schedules. Only people on this event can open them." />}
    </div>
  );
}
