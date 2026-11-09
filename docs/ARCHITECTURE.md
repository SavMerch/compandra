# Architecture

## Layers
| Folder | Responsibility |
|---|---|
| `src/domain` | Pure types and rules: time, schedule, packing parser, templates. No I/O; unit tested. |
| `src/data` | All Supabase access (`api.ts`) and query hooks (`hooks.ts`). |
| `src/auth` | Session, profile, workspace context. |
| `src/realtime` | Event and notification subscriptions. |
| `src/offline` | Encrypted store and packing sync queue. |
| `src/lib/platform.ts` | Maps, share, clipboard, redirect URLs. The Capacitor seam. |
| `src/components` | UI kit (`ui/`), app shell, forms, cover art. |
| `src/features` | Screens. |
| `supabase/migrations` | Schema, RLS, triggers, RPCs, storage policies. |

## Key decisions
**One agenda.** `itinerary_items` is the only agenda table. Travel, stays, and sessions are domain tables; triggers upsert their one linked item (unique indexes enforce one). A guard trigger stops direct edits to a linked item's title, day, or time. Location, people, notes, and status remain editable there.

**Plan and Go** are two navigation modes over the same rows. The chosen mode is a per-device preference.

**Time.** Local wall-clock values plus the event's IANA zone. "Now" is computed in the event's zone. Dates format in UTC so the device zone cannot shift a day.

**Access.** `event_role()` resolves the caller's role: workspace owner, then event member, then workspace role for workspace-visible events. Event-only invitees get a `guest` workspace row with no access to other events. Viewers are further limited by column guards to ticking packing items and completing their own tasks.

**Invitations.** 256-bit-class random token shown once; only its SHA-256 is stored; single use; 14-day expiry. The invited email isn't matched at acceptance, because Apple Hide My Email signs people in under a different address.

**Realtime.** Every change writes one `activity_log` row by trigger. Clients subscribe to that table per event and refetch the event bundle. This handles deletes (which filtered Realtime can't deliver), honours RLS, and doubles as attribution.

**Data loading.** One "bundle" query per event. Family-sized data keeps this cheap, and the bundle is also the offline snapshot.

**Conflicts.** A `version` column bumps only on content changes. Saves filter on the version the editor loaded; zero rows updated prompts "Replace with mine / Keep theirs". Packing ticks are idempotent and don't need versions.

**Offline.** Service worker precaches the app shell only, with no API or storage responses. Event snapshots and the queue are AES-GCM encrypted in IndexedDB under a non-extractable key, and wiped at sign-out or when another user signs in. Only packing ticks write offline.

**Files.** Private `event-files` bucket, paths start with the event id, policies call `can_view_event` / `can_edit_event`, access by short-lived signed URL. Avatars are in a public bucket at unguessable paths.

## Navigation
Global: Home, Events, Create, Alerts, Profile (bottom bar on phones, sidebar on desktop).
Event, Plan: Overview + three pinned sections + More. Event, Go: Today, Agenda, Passes, Tasks, More. Desktop uses a full tab strip and a multi-day drag board.

## Duplicate an event
Copies activities, packing lists (unchecked), tasks, notes, and people without accounts. Leaves bookings and files behind.

## Future iOS
Device calls go through `platform.ts`, auth redirects through `authRedirectUrl`, and routes have no server dependency. For Capacitor: swap those for plugins, use `signInWithIdToken` for native Apple sign-in, and add a push token table.
