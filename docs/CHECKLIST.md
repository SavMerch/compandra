# Implementation checklist

## Built and verified by automated tests
- Schema, RLS, workspace isolation, roles, private events, event-only guests
- Secure invitations: hashed, single use, expiring, preview, acceptance
- Storage policies and private bucket
- Event creation wizard with templates, automatic days
- Itinerary: add, edit, delete, move between days and Ideas, drag on desktop
- Flight, stay, and session linking with no duplicates
- Packing: multi-line entry, tick, viewer limits
- Offline: encrypted cache, reload while offline, queue replay, wipe at sign-out
- Concurrent edit detection, attribution, notifications, permission-filtered search
- Sample event, event duplication
- Phone and desktop layouts, screenshots reviewed

## Built, needs your live test (can't run without your accounts)
| Item | Why |
|---|---|
| Google and Apple sign-in, identity linking | Needs provider credentials |
| Magic link and code email | Needs real Supabase Auth |
| Realtime updates between devices | Needs real Supabase Realtime |
| Real Supabase Storage uploads | Tested against a stub that applies the real policies |
| Installed-app behaviour on a physical iPhone | Tested in Chromium iPhone emulation, not Safari |

## Deliberately limited
- **Invitations** are delivered by share sheet, link, or your email app. The app does not send email itself.
- **Reminders** are in-app and fire only while the app is open.
- **Email notifications and push** are not built. The Profile page says so.
- **Flight status** is not tracked live.
- Only **packing checkmarks** save offline. Other edits need a connection and say so.
- Timed activities stay in time order; drag reordering within a day applies to untimed items. Change the time to move a timed one.

## Planned next
Automated email via a Supabase Edge Function and an email provider; server-side reminders with `pg_cron`; Capacitor iOS wrapper with native Apple sign-in and push.
