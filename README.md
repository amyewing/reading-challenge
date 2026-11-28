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
- **Manage group** (owners and admins): edit the group's name and description and remove members. The owner can also make members admins (or not) and delete the group. Deleting asks you to type the group's name, and removes its challenges and everyone's logged books for them.
- **Hand over** a group (the owner makes another member the owner and stays on as an admin) or a challenge (its organiser or a group admin picks a new organiser from the group, on the Edit challenge page)
- Anyone in a group can create a challenge: a title, dates, and prompts (type them one by one or paste several at once). Each prompt can have an **About this prompt** note (up to 5,000 characters) to explain what a genre is, why the prompt was chosen, or give examples. Paragraphs are kept, web addresses become links, and notes longer than three lines fold behind "Read more".
- New challenges start as **drafts**, visible only to their creator and the group's admins. Edit them as often as you like (reword, reorder, add or remove prompts), then **launch** them for the group. Launched challenges can still be edited, but a prompt with logged books can't be removed.
- **Consider** books while planning: add books you might read for a prompt, with why they'd fit. Everyone in the group sees each other's lists, and can add someone else's idea (or a book someone already read) to their own list with one click. When you log a book from your list, it comes off the list.
- Log a book against a prompt: search Open Library (by anything, title only, or author only) or type it in, then add a finish date, a rating and notes. Several different books can count toward the same prompt.
- **Tag** books with genre, mood, pace and more. The suggested tags are based on Goodreads' genres and StoryGraph's moods, pace and story questions, plus popular reader tags and content notes ([db/tags_seed.sql](db/tags_seed.sql)). Anyone can add their own tags too. Each person's tags are counted separately, so a book shows how many people chose each tag.
- **Find books** by tag (books with all the chosen tags), title or author. Each result shows its tags and who in your groups read it, is considering it or has been discussing it (the latest messages, with a link to join the discussion), and for which prompt.
- **Covers**: a book with no cover shows a "+ Cover" tile. Click it to choose from the covers Open Library has for that book, or upload a picture (move and zoom it to frame a 2:3 cover; it is stored as a small JPEG and served by our own API at a public address, since covers are not private). A cover can only be added to a book that has none; after that only the person who added it, or a **site admin**, can change or remove it (a cover that came with the book from Open Library can only be changed by a site admin). Removing a cover makes the book "missing" again. Covers are shared, so everyone in every group sees the same one.
- **Find it** links on every book (under it on a challenge, on Find books, and on a featured book): Amazon, Bookshop.org, Goodreads and Open Library. They are searches built from the title and author (or Open Library's own page when the book came from there), so nothing is stored and nobody has to paste links.
- **Start reading** a book (from your list or a new one) and say roughly how far through it you are (a rough percentage, updated whenever you like). Logging it as read finishes it. Everyone sees who is reading what, who has started a challenge, and who has not.
- **Discuss** each prompt: a general thread for how to interpret the prompt, and a thread for each book that lives right under that book (under each book, one compact line shows its top tags, "+ Tags", and a Discussion button with the comment count and how many are new to you). Messages can be marked as containing spoilers, which stay blurred until someone taps to show them. You edit and delete your own messages; a challenge's organiser and group admins can delete any. Threads about a book that is no longer on the prompt stay reachable under "Also discussed".
- See everyone's progress (books read, plus prompts they have a book in mind for), and what others read or are considering for each prompt. Hide the prompts you've finished to focus on what's left.
- **Profiles**: "My profile" in the top bar (next to Home and Find books) opens your profile, where the numbers at the top jump to each section. It shows your groups, your challenges (with how far you are in each), and every book you have read, are reading or are considering. Click anyone's name to see theirs: you only see the groups and challenges you share with them, and never their email. On your own profile, **Edit profile** lets you change your display name (it stays when you sign in again), add a profile picture (a photo you can move and zoom to frame before it is saved, then shrunk to a small square in your browser, or one of the built-in literary icons: open book, quill, owl, teacup and more), and feature a book with a note on why: it needn't be your favourite, just one you are enthusiastic about right now. Your picture shows beside your name in group member lists and challenge progress.
- A **Back to top** link at the bottom of any page that scrolls.
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
2. On a new database, run [db/schema.sql](db/schema.sql) and then [db/tags_seed.sql](db/tags_seed.sql) in the SQL Editor. The existing database was created with an earlier version and has been brought up to date with the files in [db/migrations/](db/migrations/), in order (002 to 012, with the tag seed after 006). Read each file's header first: 005 must be applied only after the API that goes with it is deployed, and 009 (needs PostgreSQL 15 or newer), 010, 011 and 012 must be applied before the API that goes with them is deployed. The tag seed can be re-run at any time to add new suggested tags.
   **Site admins** (people who can change or remove any book's cover; not the same as group admins) are a short list kept in the database and added by hand, because nothing in the app can create one. In the SQL Editor, find the person by their sign-in email:
   ```sql
   insert into site_admins (user_id) select id from profiles where lower(email) = lower('someone@example.com');
   delete from site_admins where user_id = (select id from profiles where lower(email) = lower('someone@example.com'));
   ```
   (The first adds one, the second removes one. They must have signed in at least once.)
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
src/pages/               screens: Home, GroupPage, GroupSettings, NewChallenge, EditChallenge,
                         ChallengePage, ProfilePage, FindBooks, InvitePage
src/components/          BookPicker (Open Library search), LogBookDialog, ConsiderDialog,
                         Logo, ReadingProgressDialog, PromptChat, TagPicker, TagChips, BookTagsDialog,
                         ChallengeEditor, BookCover, RichText (notes with links), MiniBar, PersonLink,
                         ChatMessage, Avatar (photo, icon or initial), EditProfileDialog, BackToTop, FindItLinks, CoverDialog, PhotoCropper (frames photos and covers)
```

## Ideas for next steps

- Import past years from Google Sheets
- Longer reviews, and suggesting books for a prompt from their tags
- Email reminders (a scheduled Function, like the board game app's)
