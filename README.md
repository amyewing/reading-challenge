# Reading Challenge

A small web app for running group reading challenges. People sign in, create a **group**, invite others with a link, create **challenges** made of prompts, and **log the books** they read against each prompt.

## How it fits together

```
Browser (React app)  ──►  our API (api/, a DigitalOcean Function)  ──►  Postgres (Neon)
   Kinde sign-in             checks the Kinde token, then runs the
   (access token)            request as the restricted app_user role
```

- **Front end** ([src/](src/)): a React app, hosted as a free DigitalOcean static site.
- **API** ([api/](api/)): checks each request's Kinde access token (signature, issuer, and that it was issued for our API's *audience*). It then opens a database transaction as the restricted `app_user` role, with the verified user id in `app.user_id`.
- **Database** ([db/schema.sql](db/schema.sql)): tables, plus Row Level Security rules that only let people see and change what they should. These rules are a second layer behind the API's own checks.
- **Books**: searched on Open Library straight from the browser.

The database connection string is a secret that lives only on the server. The browser never talks to the database.

## What it does today

- Sign up or sign in with Google, Facebook, or an email code (Kinde)
- Create groups (you become the **owner**)
- Owners and admins create invite links that last 14 days, and can revoke them
- Anyone in a group can create a challenge: a title, dates, and prompts (type them one by one or paste several at once). Prompts can have optional details.
- New challenges start as **drafts**, visible only to their creator and the group's admins. Edit them as often as you like (reword, reorder, add or remove prompts), then **launch** them for the group. Launched challenges can still be edited, but a prompt with logged books can't be removed.
- **Consider** books while planning: add books you might read for a prompt, with why they'd fit. Everyone in the group sees each other's lists, and can add someone else's idea (or a book someone already read) to their own list with one click. When you log a book from your list, it comes off the list.
- Log a book against a prompt: search Open Library (by anything, title only, or author only) or type it in, then add a finish date, a rating and notes. Several different books can count toward the same prompt.
- **Tag** books with genre, mood, pace and more. The suggested tags are based on Goodreads' genres and StoryGraph's moods, pace and story questions, plus popular reader tags and content notes ([db/tags_seed.sql](db/tags_seed.sql)). Anyone can add their own tags too. Each person's tags are counted separately, so a book shows how many people chose each tag.
- **Find books** by tag (books with all the chosen tags), title or author. Each result shows its tags and who in your groups read it or is considering it, and for which prompt.
- See everyone's progress (books read, plus prompts they have a book in mind for), and what others read or are considering for each prompt. Hide the prompts you've finished to focus on what's left.
- Leave a group. Challenge creators and admins can delete a challenge

---

## Run it locally

You need Node.js 22 or newer.

1. Copy `.env.example` to `.env.local` and fill it in (see the comments in the file).
2. Install packages:
   ```powershell
   npm install
   ```
3. Start the API and the app in two terminals:
   ```powershell
   npm run dev:api
   ```
   ```powershell
   npm run dev
   ```
4. Open http://localhost:5173. Vite forwards `/api` calls to the API on port 8787.

Check everything compiles with `npm run typecheck`.

## One-time service setup

### Kinde (sign-in)
1. **Application:** a *Front-end and mobile* app (React).
   - Allowed callback URLs and allowed logout redirect URLs: `http://localhost:5173` plus your live URL.
   - **Authentication:** turn on Google, Facebook and email.
2. **API:** Settings → APIs → Add API, with audience `https://api.readingchallenge`. Then open **Applications** and authorize your app.
3. **Before inviting people:**
   - Under Settings → Authentication → Google / Facebook, add your own client keys instead of Kinde's shared test keys.
   - Set up a **Kinde custom domain** (for example `auth.yourdomain.com`) so people stay signed in when they reload the page. Then use that domain for `VITE_KINDE_DOMAIN` and `KINDE_DOMAIN`.

### Neon (database)
1. Create a project.
2. On a new database, run [db/schema.sql](db/schema.sql) and then [db/tags_seed.sql](db/tags_seed.sql) in the SQL Editor. The existing database was created with an earlier version and has been brought up to date with the files in [db/migrations/](db/migrations/), in order (002 to 006, then the tag seed). Read each file's header first: 005 must be applied only after the API that goes with it is deployed. The tag seed can be re-run at any time to add new suggested tags.
3. For `DATABASE_URL`, use **Connect**, role `neondb_owner`, with **Connection pooling** on.
4. The Neon **Data API** is not used and should stay disabled.

## Deploy to DigitalOcean

The app follows the same layout as [bmewing/boardgamemeetups](https://github.com/bmewing/boardgamemeetups): a static site plus one Function, in one App Platform app.

1. Bundle the API and commit the result. DigitalOcean deploys the bundled function folder [functions/packages/core/api/](functions/packages/core/api/) as-is.
   ```powershell
   npm run build:api
   ```
2. Push the project to GitHub (a private repository is fine).
3. In DigitalOcean, create an App from the repository using [.do/app.yaml](.do/app.yaml), with your GitHub username filled in. Then add `DATABASE_URL` as an **encrypted** environment variable on the `api` function.
4. Add the live URL to Kinde's allowed callback and logout URLs.

## Troubleshooting

- **"Couldn't reach the server"**: is `npm run dev:api` running? Its terminal shows the real error.
- **"Please sign in again."**: the token didn't pass the API's checks. Make sure `VITE_KINDE_AUDIENCE` matches the API audience in Kinde, and that the app is authorized for that API. Then sign out and back in to get a fresh token.
- **"permission denied" / "role app_user does not exist"**: the database setup or migration didn't finish. Re-run it in the Neon SQL Editor.

## Project layout

```
api/                     the API: auth.ts (token check), db.ts (transaction as app_user),
                         routes.ts (all endpoints), dev-server.ts, function.ts (DigitalOcean)
functions/               DigitalOcean Functions project (project.yml + bundled api.js)
db/schema.sql            tables, access rules, and database functions
db/migrations/           changes applied to the existing database
src/lib/api.ts           front-end API client (adds the Kinde token, refreshes it when needed)
src/pages/               screens: Home, GroupPage, NewChallenge, EditChallenge, ChallengePage,
                         FindBooks, InvitePage
src/components/          BookPicker (Open Library search), LogBookDialog, ConsiderDialog,
                         TagPicker, TagChips, BookTagsDialog, ChallengeEditor, BookCover
```

## Ideas for next steps

- Promote members to admin from the members list
- Import past years from Google Sheets
- Longer reviews, and suggesting books for a prompt from their tags
- Email reminders (a scheduled Function, like the board game app's)
