import * as React from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Mail } from 'lucide-react';
import { toast } from 'sonner';
import { CoverArt } from '@/components/CoverArt';
import { CompanyLogo } from '@/components/CompanyLogo';
import { Button } from '@/components/ui/button';
import { EmptyState, Field, Input, PageLoader, Spinner } from '@/components/ui/misc';
import { useAuth } from '@/auth/AuthProvider';
import { authProviders, brand } from '@/config/brand';
import { friendlyError, rpc } from '@/data/api';
import { authRedirectUrl } from '@/lib/platform';
import { isConfigured, supabase } from '@/lib/supabase';
import { Compass } from 'lucide-react';

const NEXT = `${brand.storagePrefix}-next`;
const setNext = (p: string) => { try { sessionStorage.setItem(NEXT, p); localStorage.setItem(NEXT, p); } catch { /* optional */ } };
const takeNext = () => { let v: string | null = null; try { v = sessionStorage.getItem(NEXT) ?? localStorage.getItem(NEXT); sessionStorage.removeItem(NEXT); localStorage.removeItem(NEXT); } catch { /* optional */ } return v && v.startsWith('/') ? v : '/'; };

const Apple = () => <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor" aria-hidden><path d="M16.4 12.6c0-2.3 1.9-3.4 2-3.5-1.1-1.6-2.8-1.8-3.4-1.8-1.4-.1-2.8.9-3.5.9s-1.9-.8-3.1-.8c-1.6 0-3.1.9-3.9 2.3-1.7 2.9-.4 7.2 1.2 9.5.8 1.1 1.8 2.4 3 2.4s1.7-.8 3.1-.8 1.9.8 3.1.8 2.1-1.2 2.9-2.3c.9-1.3 1.3-2.6 1.3-2.7 0 0-2.7-1-2.7-4zM14 5.6c.7-.8 1.1-1.9 1-3-1 0-2.1.6-2.8 1.5-.6.7-1.2 1.9-1 3 1.1.1 2.1-.6 2.8-1.5z" /></svg>;
const Google = () => <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden><path fill="#4285F4" d="M22.5 12.3c0-.8-.1-1.5-.2-2.3H12v4.4h5.9c-.3 1.4-1 2.5-2.2 3.3v2.8h3.6c2-1.9 3.2-4.7 3.2-8.2z" /><path fill="#34A853" d="M12 23c3 0 5.4-1 7.2-2.7l-3.6-2.8c-1 .7-2.2 1.1-3.7 1.1-2.8 0-5.2-1.9-6.1-4.5H2.2v2.9C4 20.6 7.7 23 12 23z" /><path fill="#FBBC05" d="M5.9 14.1c-.2-.7-.4-1.4-.4-2.1s.1-1.4.4-2.1V7H2.2C1.4 8.5 1 10.2 1 12s.4 3.5 1.2 5l3.7-2.9z" /><path fill="#EA4335" d="M12 5.4c1.6 0 3 .6 4.1 1.6l3.1-3.1C17.4 2.1 15 1 12 1 7.7 1 4 3.4 2.2 7l3.7 2.9c.9-2.6 3.3-4.5 6.1-4.5z" /></svg>;

export function SignInPanel({ next }: { next?: string }) {
  const [email, setEmail] = React.useState(''); const [sent, setSent] = React.useState(false); const [code, setCode] = React.useState(''); const [busy, setBusy] = React.useState(false);
  const oauth = async (provider: 'google' | 'apple') => { if (next) setNext(next); const { error } = await supabase.auth.signInWithOAuth({ provider, options: { redirectTo: authRedirectUrl(), queryParams: provider === 'google' ? { prompt: 'select_account' } : undefined } }); if (error) toast.error(friendlyError(error)); };
  const send = async (e: React.FormEvent) => { e.preventDefault(); if (next) setNext(next); setBusy(true); const { error } = await supabase.auth.signInWithOtp({ email: email.trim(), options: { emailRedirectTo: authRedirectUrl() } }); setBusy(false); if (error) toast.error(friendlyError(error)); else setSent(true); };
  const verify = async (e: React.FormEvent) => { e.preventDefault(); setBusy(true); const { error } = await supabase.auth.verifyOtp({ email: email.trim(), token: code.trim(), type: 'email' }); setBusy(false); if (error) toast.error('That code is incorrect or has expired. Check it or send a new one.'); };
  if (sent) return <div className="space-y-3"><p>We sent a sign-in email to <strong>{email}</strong>. Tap the link, or enter the code from the email to stay in the installed app.</p><form onSubmit={verify} className="space-y-3"><Field label="Sign-in code" htmlFor="c"><Input id="c" inputMode="numeric" autoComplete="one-time-code" value={code} onChange={(e) => setCode(e.target.value)} /></Field><Button type="submit" size="lg" className="w-full" disabled={busy || !code.trim()}>Sign in with code</Button></form><Button variant="ghost" className="w-full" onClick={() => setSent(false)}>Use a different email</Button></div>;
  return <div className="space-y-2.5">
    {authProviders.apple && <Button variant="ink" size="lg" className="w-full bg-black hover:bg-black" onClick={() => oauth('apple')}><Apple />Continue with Apple</Button>}
    {authProviders.google && <Button variant="outline" size="lg" className="w-full" onClick={() => oauth('google')}><Google />Continue with Google</Button>}
    <form onSubmit={send} className="space-y-2.5 pt-3"><Field label="Or use your email" htmlFor="e"><Input id="e" type="email" required autoCapitalize="off" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@example.com" /></Field><Button type="submit" variant="soft" size="lg" className="w-full" disabled={busy}><Mail className="h-5 w-5" />Email me a sign-in link</Button></form>
  </div>;
}
export function LoginPage() {
  const { session, loading } = useAuth();
  if (loading) return <PageLoader />;
  if (session) return <Navigate to={takeNext()} replace />;
  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-2">
      <div className="relative h-[34dvh] lg:h-dvh"><CoverArt scene="coast" /></div>
      <div className="mx-auto w-full max-w-md px-5 pb-8 pt-6 lg:flex lg:flex-col lg:justify-center">
        <h1 className="font-display text-[38px] font-bold">{brand.name}</h1>
        <p className="mb-6 mt-1 text-[18px] text-ink-soft">Plan it together. Then know exactly where to be.</p>
        {!isConfigured && <p role="alert" className="mb-4 rounded-2xl bg-accent-soft p-3 text-danger">This app isn't connected to Supabase yet. Add the values from .env.example.</p>}
        <SignInPanel />
        <CompanyLogo className="mx-auto mt-8" />
      </div>
    </div>
  );
}
export function AuthCallback() {
  const { session, loading } = useAuth();
  const [failed, setFailed] = React.useState(() => new URLSearchParams(window.location.search).get('error_description'));
  React.useEffect(() => { const t = setTimeout(() => setFailed((f) => f ?? 'Sign-in timed out. Try again.'), 12000); return () => clearTimeout(t); }, []);
  if (session) return <Navigate to={takeNext()} replace />;
  if (failed && !loading) return <EmptyState icon={Compass} title="Sign-in didn't finish" body={failed}><Button asChild><Link to="/login">Back to sign-in</Link></Button></EmptyState>;
  return <div className="grid min-h-dvh place-items-center"><Spinner className="h-8 w-8" /></div>;
}
export function InvitePage() {
  const { token = '' } = useParams();
  const { session, loading, refresh } = useAuth();
  const nav = useNavigate(); const [busy, setBusy] = React.useState(false);
  const q = useQuery({ queryKey: ['invite', token], queryFn: () => rpc<any>('get_invitation_preview', { p_token: token }), retry: false });
  if (loading || q.isLoading) return <PageLoader />;
  if (!q.data?.valid) return <EmptyState icon={Compass} title="This invitation isn't valid" body="It may have expired or already been used. Ask for a new link."><Button asChild><Link to="/">Go home</Link></Button></EmptyState>;
  const accept = async () => { setBusy(true); try { const r = await rpc<any>('accept_invitation', { p_token: token }); await refresh(); toast.success('You joined'); nav(r.event_id ? `/events/${r.event_id}` : '/', { replace: true }); } catch (e) { toast.error(friendlyError(e)); setBusy(false); } };
  return <div className="mx-auto max-w-md space-y-5 px-5 py-10"><div className="h-40 overflow-hidden rounded-3xl"><CoverArt scene="garden" /></div><h1 className="font-display text-[30px] font-bold leading-tight">{q.data.invited_by || 'Someone'} invited you to {q.data.event ?? q.data.workspace}</h1>{session ? <Button size="lg" className="w-full" disabled={busy} onClick={accept}>{busy ? 'Joining…' : 'Accept invitation'}</Button> : <SignInPanel next={`/invite/${token}`} />}</div>;
}
export function OnboardingPage() {
  const { profile, userId, refresh, workspace } = useAuth();
  const [you, setYou] = React.useState(''); const [fam, setFam] = React.useState(''); const [busy, setBusy] = React.useState(false);
  React.useEffect(() => { if (profile?.display_name) setYou(profile.display_name); }, [profile?.display_name]);
  if (workspace) return <Navigate to="/" replace />;
  return <div className="mx-auto max-w-md space-y-5 px-5 py-10"><h1 className="font-display text-[32px] font-bold leading-tight">Set up your family space</h1><p className="text-ink-soft">Events you create here can be shared with everyone you invite.</p>
    <form className="space-y-4" onSubmit={async (e) => { e.preventDefault(); if (!you.trim() || !fam.trim()) return; setBusy(true); try { await supabase.from('profiles').update({ display_name: you.trim() }).eq('id', userId); await rpc('create_workspace', { p_name: fam.trim() }); await refresh(); } catch (err) { toast.error(friendlyError(err)); } finally { setBusy(false); } }}>
      <Field label="Your name" htmlFor="y"><Input id="y" required value={you} onChange={(e) => setYou(e.target.value)} /></Field><Field label="Family name" htmlFor="f"><Input id="f" required value={fam} onChange={(e) => setFam(e.target.value)} placeholder="The Rivera family" /></Field><Button type="submit" size="lg" className="w-full" disabled={busy}>{busy ? 'Creating…' : 'Continue'}</Button></form></div>;
}
