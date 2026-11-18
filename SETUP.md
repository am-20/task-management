# Putting Hearth online

This guide takes Hearth from code on GitHub to a private web app at your own
address, signed in with your account, synced between your laptop and phone, and
installed on your home screen.

**What you will use**

| Need | Service | Cost |
| --- | --- | --- |
| Login + database | [Supabase](https://supabase.com) | Free plan |
| Hosting | [Cloudflare Pages](https://pages.cloudflare.com) | Free |
| Domain name | Cloudflare Registrar (or any registrar) | ~$10–15 a year for a `.com` |

Allow about an hour. The steps are in order; each one says what you need from the
step before.

> Dashboards get redesigned from time to time. If a button has moved, look for the
> same words nearby; the settings themselves don't change.

---

## 1. Merge the code into `main`

The web-app work is on the `web-app` branch.

1. Open https://github.com/am-20/task-management.
2. GitHub shows a yellow bar: **web-app had recent pushes → Compare & pull request**.
   Click it, then **Create pull request**, then **Merge pull request → Confirm merge**.

Cloudflare will deploy from `main`, so this needs to happen first.

---

## 2. Create the database and your login (Supabase)

### 2.1 Create the project

1. Sign up at https://supabase.com (signing in with GitHub is easiest).
2. **New project**:
   - **Name:** `hearth`
   - **Database password:** click **Generate a password** and save it in your
     password manager. You won't need it day to day.
   - **Region:** the one closest to you.
3. Wait a minute or two while the project starts.

### 2.2 Create the table

1. In the left sidebar open **SQL Editor** and click **New query**.
2. Open [`supabase/schema.sql`](supabase/schema.sql) in this repository, copy all of
   it, paste it into the editor, and click **Run**.
3. You should see **Success. No rows returned.**

This creates one private table. Row Level Security makes sure each account can
only ever read or change its own data, and visitors who are not signed in get
nothing.

### 2.3 Lock sign-up and create your account

Nobody should be able to create an account except you.

1. **Authentication → Sign In / Providers** (sometimes under **Authentication →
   Settings**):
   - Make sure **Email** is enabled.
   - Turn **off** **Allow new users to sign up**. Save.
2. **Authentication → Users → Add user → Create new user**:
   - Your email and a strong password.
   - Tick **Auto Confirm User**.
   - **Create user**.

This email and password are what you will type into Hearth.

### 2.4 Copy the two keys

You need two values for step 3. Click the **Connect** button at the top of the
project, or go to **Project Settings → API Keys**:

- **Project URL** – looks like `https://abcdefghijkl.supabase.co`
- **Publishable key** – starts with `sb_publishable_`. (Older projects call it the
  **anon public** key; that works too.)

Both are safe to put in a website: they only identify the project. Your data is
protected by the login and the table rules. **Never** use the `secret` /
`service_role` key in the app.

---

## 3. Host the site (Cloudflare Pages)

1. Sign up at https://dash.cloudflare.com.
2. Go to **Workers & Pages → Create → Pages → Import an existing Git repository**.
3. Connect GitHub and choose **am-20/task-management**.
4. Build settings:
   - **Production branch:** `main`
   - **Framework preset:** `Vite` (or `None`)
   - **Build command:** `npm run build`
   - **Build output directory:** `dist`
5. **Environment variables** (same screen, expand it):

   | Name | Value |
   | --- | --- |
   | `VITE_SUPABASE_URL` | the Project URL from 2.4 |
   | `VITE_SUPABASE_PUBLISHABLE_KEY` | the Publishable key from 2.4 |
   | `NODE_VERSION` | `22` |

6. **Save and Deploy**. After a minute you get an address like
   `https://hearth-xyz.pages.dev`. Open it: you should see the Hearth sign-in
   screen. Sign in with the account from 2.3.

From now on, every change merged into `main` on GitHub is deployed automatically.

> If you ever change the environment variables, redeploy (**Deployments → … →
> Retry deployment**) because they are baked in at build time.

---

## 4. Your own domain

### 4.1 Buy it

Easiest is to buy it inside Cloudflare so everything is in one place:

1. **Domain Registration → Register Domains**, search for a name, buy it.
   Cloudflare sells at cost with no markup on renewals.

Already have a domain elsewhere (Namecheap, GoDaddy, Porkbun…)? That works too:
in Cloudflare choose **Add a domain**, then change the nameservers at your
registrar to the two Cloudflare gives you. It can take a few hours to switch over.

### 4.2 Point it at Hearth

1. **Workers & Pages → your project → Custom domains → Set up a custom domain**.
2. Enter the domain (for example `hearth.yourname.com` or `yourname.com`) and
   confirm. Cloudflare adds the DNS record and the HTTPS certificate for you.
3. Wait until the status says **Active** (usually a few minutes).

### 4.3 Tell Supabase about the address

This makes the **Forgot password?** email link back to your site.

1. Supabase → **Authentication → URL Configuration**.
2. **Site URL:** `https://your-domain` (exactly what you set up in 4.2).
3. **Redirect URLs → Add URL:** `https://your-domain/**`. Save.

---

## 5. Install it on your devices

Open your domain once in a browser, then:

**iPhone / iPad**
1. Open the site in **Safari**.
2. Tap **Share** (the square with an arrow) → **Add to Home Screen** → **Add**.
3. Open Hearth from the new icon and **sign in there**. The home-screen app keeps
   its own login, separate from Safari, so you sign in once more.

**Android**
1. Open the site in **Chrome**.
2. Tap **⋮ → Install app** (or **Add to Home screen**).
3. Open it from the icon and sign in.

**Laptop (optional)**
- In Chrome or Edge, click the **install** icon at the right of the address bar to
  get Hearth in its own window and in your dock / Start menu.

---

## 6. Check everything works

- [ ] The site shows the sign-in screen, not your data, in a private window.
- [ ] Signing in with a wrong password is refused.
- [ ] Add a task on your phone; within a few seconds it appears on your laptop
      (or the next time you switch back to that window).
- [ ] Turn on airplane mode, open Hearth from the home screen: it opens, shows
      **Offline**, and still lets you add things. Turn airplane mode off: it shows
      **Synced** and the laptop gets the change.
- [ ] **Your data → Export backup** downloads a file.

---

## Good to know

**How sync works.** Every change is saved on the device straight away, then sent
to Supabase about a second later. Other signed-in devices receive it live. If two
devices changed things at the same time, Hearth merges them item by item, so a task
added on the phone and a page edited on the laptop both survive. If the very same
item was edited on both, the most recent save wins.

**Free-plan pause.** Supabase pauses free projects after **7 days without any
activity**. Using Hearth counts as activity, so this only matters after a long
break. If it happens, Hearth keeps working offline on your devices; sign in to
Supabase and click **Restore project**, and syncing picks up again. To avoid it
entirely, upgrade the project to the Pro plan.

**Backups.** Use **Your data → Export backup** now and then and keep the file
somewhere safe. **Import backup** restores it.

**Forgot your password?** Use **Forgot password?** on the sign-in screen; the
email comes from Supabase. The built-in email sender only allows a few emails per
hour, which is fine for a personal app. You can also send a reset from Supabase →
**Authentication → Users → … → Send password recovery**.

**Search engines and bots.** The site tells search engines not to index it
(`robots.txt` plus a `noindex` header), and without signing in there is nothing to
see but the sign-in screen. Your data only ever leaves Supabase for a signed-in
session.

**Signing out** (**Your data → Sign out**) removes your data from that device. Do
this on any computer that isn't yours.

---

## Working on the code locally

```bash
npm install
cp .env.example .env.local   # then paste your Project URL and Publishable key
npm run dev
```

Without `.env.local` the app runs in local-only mode: no login, data stays in the
browser. Handy for trying changes.
