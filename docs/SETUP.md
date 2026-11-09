# Setup

You need a Supabase project, a Netlify site, a GitHub repo, a Google Cloud project, and (for Apple sign-in) a paid Apple Developer account. Below, `APP_URL` is your Netlify URL and `REF` is your Supabase project ref.

## 1. Supabase database
Using the CLI (recommended):
```bash
npx supabase login
npx supabase link --project-ref REF
npx supabase db push
```
Or open the SQL Editor and run each file in `supabase/migrations` in filename order.

This creates all tables, RLS, the private `event-files` bucket, the `avatars` bucket, and Realtime publication. No demo data is added.

## 2. Supabase Auth settings
Authentication > URL Configuration:
- Site URL: `APP_URL`
- Redirect URLs: `APP_URL/auth/callback`, `http://localhost:5173/auth/callback`

Authentication > Sign In / Providers: turn on **Allow manual linking** so people can connect Google and Apple from Profile.

Authentication > Email Templates > Magic Link: add the code so sign-in works inside the installed iPhone app (a link opens in Safari, outside the app):
```html
<h2>Sign in</h2>
<p><a href="{{ .ConfirmationURL }}">Tap to sign in</a></p>
<p>Or enter this code in the app: <strong>{{ .Token }}</strong></p>
```
Supabase's built-in email is rate limited to a few messages per hour. For regular use, add custom SMTP under Authentication > Emails.

## 3. Google sign-in
1. Google Cloud Console > APIs & Services > OAuth consent screen: configure the app.
2. Credentials > Create OAuth client ID > Web application.
3. Authorized JavaScript origins: `APP_URL`
4. Authorized redirect URI: `https://REF.supabase.co/auth/v1/callback`
5. Paste the client ID and secret into Supabase > Authentication > Providers > Google.

## 4. Sign in with Apple
Requires the Apple Developer Program.
1. Certificates, IDs & Profiles > Identifiers > App IDs: create an App ID with **Sign in with Apple** enabled.
2. Identifiers > Services IDs: create one, for example `com.yourfamily.compandra.web`. Enable Sign in with Apple and configure it:
   - Domain: `REF.supabase.co`
   - Return URL: `https://REF.supabase.co/auth/v1/callback`
3. Keys: create a key with Sign in with Apple, download the `.p8` once, and note the Key ID and Team ID.
4. Supabase > Authentication > Providers > Apple: enter the Services ID as the client ID and generate the secret from the `.p8` (the dashboard provides a tool).

**The Apple client secret expires after at most six months. Set a calendar reminder to regenerate it.** Keep the `.p8` out of the repo.

Hide My Email works: the account uses the relay address and the app asks for a name during setup. If someone uses Hide My Email with Apple and later signs in with Google, those are separate accounts unless they connect both from Profile.

Until a provider is configured, set `VITE_AUTH_APPLE=false` or `VITE_AUTH_GOOGLE=false` to hide its button.

## 5. Netlify
1. Push this folder to GitHub.
2. Netlify > Add new site > Import from GitHub. Build settings come from `netlify.toml`.
3. Site configuration > Environment variables:
   - `VITE_SUPABASE_URL` = `https://REF.supabase.co`
   - `VITE_SUPABASE_PUBLISHABLE_KEY` = from Supabase > Settings > API
   - optional: `VITE_BRAND_NAME`, `VITE_BRAND_THEME_COLOR`, `VITE_AUTH_GOOGLE`, `VITE_AUTH_APPLE`
4. Deploy.

## Server-only secrets (never in Netlify env or `VITE_` variables)
Supabase service-role key, Apple `.p8` and generated secret, Google client secret, SMTP password. Google's and Apple's go in the Supabase dashboard only. The app does not use the service-role key at all.

## 6. First use
1. Sign in, name your family space.
2. Profile > Invite: send links to family. Links go through your share sheet or email app; the app doesn't send email itself.
3. Optional: Profile > Sample event > "Starting today" shows Go Mode.
4. On iPhone: open `APP_URL` in Safari > Share > Add to Home Screen.

## Deployment checklist
- [ ] Migrations applied without errors
- [ ] Site URL and redirect URLs set
- [ ] Manual linking on; email template includes the code
- [ ] Google tested; Apple tested, including Hide My Email
- [ ] Netlify env vars set and site deployed
- [ ] Two phones signed in as different people: a change on one appears on the other (confirms Realtime)
- [ ] Installed to the home screen; airplane mode test: open an event, tick packing, reconnect
- [ ] Upload a PDF and open it; confirm a non-member can't see the event
- [ ] Apple secret renewal reminder set
