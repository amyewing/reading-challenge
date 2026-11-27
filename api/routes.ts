import { verifyRequest } from './auth';
import { asUser, type Query } from './db';
import { HttpError, badRequest, notFound } from './http';

export interface ApiRequest {
  method: string;
  path: string;
  headers: Record<string, string | undefined>;
  body: string;
}
export interface ApiResponse {
  status: number;
  body?: unknown;
}

type Params = Record<string, string>;
type Handler = (ctx: { q: Query; params: Params; body: any }) => Promise<unknown>;

// ---------------------------------------------------------------------------
// Input checks (the database checks again; these give friendlier messages)
// ---------------------------------------------------------------------------

const UUID = '([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})';

function text(value: unknown, field: string, { max = 1000, required = false } = {}): string | null {
  if (value === undefined || value === null || value === '') {
    if (required) throw badRequest(`${field} is required.`);
    return null;
  }
  if (typeof value !== 'string') throw badRequest(`${field} must be text.`);
  const trimmed = value.trim();
  if (required && !trimmed) throw badRequest(`${field} is required.`);
  if (trimmed.length > max) throw badRequest(`${field} is too long (max ${max} characters).`);
  return trimmed || null;
}

function date(value: unknown, field: string): string | null {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) throw badRequest(`${field} must be a date.`);
  return value;
}

function rating(value: unknown): number | null {
  if (value === undefined || value === null) return null;
  if (!Number.isInteger(value) || (value as number) < 1 || (value as number) > 5) throw badRequest('Rating must be 1 to 5 stars.');
  return value as number;
}

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

const routes: [method: string, pattern: RegExp, keys: string[], handler: Handler][] = [];
function route(method: string, path: string, handler: Handler) {
  const keys: string[] = [];
  const pattern = new RegExp(
    '^' +
      path.replace(/:(\w+)/g, (_, key) => {
        keys.push(key);
        return key === 'code' ? '([A-Za-z0-9_-]{1,64})' : UUID;
      }) +
      '$',
  );
  routes.push([method, pattern, keys, handler]);
}

// The signed-in person's profile, refreshed from Kinde's details on each sign-in
route('PUT', '/api/me', async ({ q, body }) => {
  await q('select upsert_profile($1, $2)', [
    text(body.displayName, 'Name', { max: 80 }) ?? 'Reader',
    text(body.email, 'Email', { max: 320 }),
  ]);
  return { ok: true };
});

// Groups you belong to
route('GET', '/api/groups', async ({ q }) =>
  q(`
    select g.id, g.name, g.description,
           (select count(*)::int from group_members m where m.group_id = g.id) as member_count,
           (select count(*)::int from challenges c where c.group_id = g.id) as challenge_count
    from groups g
    order by g.created_at`),
);

route('POST', '/api/groups', async ({ q, body }) => {
  const [row] = await q('select create_group($1, $2) as id', [
    text(body.name, 'Group name', { max: 100, required: true }),
    text(body.description, 'Description', { max: 500 }),
  ]);
  return { id: row.id };
});

route('GET', '/api/groups/:groupId', async ({ q, params }) => {
  const [group] = await q('select id, name, description from groups where id = $1', [params.groupId]);
  if (!group) throw notFound("This group doesn't exist or you're not a member.");
  const members = await q(
    `select m.user_id, m.role, m.joined_at,
            json_build_object('display_name', p.display_name, 'email', p.email) as profiles
     from group_members m join profiles p on p.id = m.user_id
     where m.group_id = $1
     order by m.joined_at`,
    [params.groupId],
  );
  const challenges = await q(
    `select c.id, c.group_id, c.title, c.description, c.starts_on::text, c.ends_on::text, c.created_by,
            c.status, c.launched_at,
            (select count(*)::int from prompts p where p.challenge_id = c.id) as prompt_count
     from challenges c where c.group_id = $1
     order by (c.status = 'draft') desc, c.created_at desc`,
    [params.groupId],
  );
  return { group, members, challenges };
});

route('DELETE', '/api/groups/:groupId/membership', async ({ q, params }) => {
  const rows = await q(
    `delete from group_members where group_id = $1 and user_id = current_user_id() and role <> 'owner'
     returning group_id`,
    [params.groupId],
  );
  if (!rows.length) throw badRequest("You can't leave this group (owners can't leave their own group).");
  return { ok: true };
});

// Invites (owners and admins)
route('GET', '/api/groups/:groupId/invites', async ({ q, params }) =>
  q(
    `select id, code, expires_at from group_invites
     where group_id = $1 and revoked_at is null and expires_at > now()
     order by created_at desc`,
    [params.groupId],
  ),
);

route('POST', '/api/groups/:groupId/invites', async ({ q, params }) => {
  const [row] = await q('select create_invite($1, 14) as code', [params.groupId]);
  return { code: row.code };
});

route('POST', '/api/invites/:inviteId/revoke', async ({ q, params }) => {
  const rows = await q('update group_invites set revoked_at = now() where id = $1 and revoked_at is null returning id', [
    params.inviteId,
  ]);
  if (!rows.length) throw notFound('That invite link was not found.');
  return { ok: true };
});

route('GET', '/api/invites/by-code/:code', async ({ q, params }) => {
  const [invite] = await q('select * from get_invite($1)', [params.code]);
  return invite ?? null;
});

route('POST', '/api/invites/by-code/:code/accept', async ({ q, params }) => {
  const [row] = await q('select accept_invite($1) as group_id', [params.code]);
  return { groupId: row.group_id };
});

// Challenges
//
// A challenge starts as a draft that only its creator and group admins can see. It can be
// edited (details and prompts) at any time; launching it shows it to the whole group and
// opens it for logging books.

interface PromptInput {
  id: string | null;
  title: string;
  description: string | null;
}

/** Validate challenge details and prompts from a create/edit form. Blank prompts are dropped. */
function challengeInput(body: any) {
  const raw = Array.isArray(body.prompts) ? body.prompts : [];
  if (raw.length > 200) throw badRequest('A challenge can have up to 200 prompts.');
  const prompts: PromptInput[] = [];
  raw.forEach((p: any, i: number) => {
    const item = typeof p === 'string' ? { title: p } : p ?? {};
    const title = text(item.title, `Prompt ${i + 1}`, { max: 300 });
    if (!title) return;
    const id = typeof item.id === 'string' && new RegExp(`^${UUID}$`).test(item.id) ? item.id : null;
    prompts.push({ id, title, description: text(item.description, `Prompt ${i + 1} details`, { max: 1000 }) });
  });
  const startsOn = date(body.startsOn, 'Start date');
  const endsOn = date(body.endsOn, 'End date');
  if (startsOn && endsOn && endsOn < startsOn) throw badRequest('The end date is before the start date.');
  return {
    title: text(body.title, 'Title', { max: 150, required: true })!,
    description: text(body.description, 'Description', { max: 2000 }),
    startsOn,
    endsOn,
    prompts,
  };
}

/** Load a challenge the current user may edit, or explain why not. */
async function manageableChallenge(q: Query, challengeId: string) {
  const [row] = await q('select id, group_id, status, can_manage_challenge(id) as can_manage from challenges where id = $1', [
    challengeId,
  ]);
  if (!row) throw notFound("This challenge doesn't exist or you can't see it.");
  if (!row.can_manage) throw new HttpError(403, 'Only the person who created this challenge or a group admin can change it.');
  return row as { id: string; group_id: string; status: 'draft' | 'active' };
}

route('POST', '/api/groups/:groupId/challenges', async ({ q, params, body }) => {
  const input = challengeInput(body);
  const [challenge] = await q(
    `insert into challenges (group_id, title, description, starts_on, ends_on, created_by, status)
     values ($1, $2, $3, $4, $5, current_user_id(), 'draft')
     returning id`,
    [params.groupId, input.title, input.description, input.startsOn, input.endsOn],
  );
  for (const [i, p] of input.prompts.entries()) {
    await q('insert into prompts (challenge_id, position, title, description) values ($1, $2, $3, $4)', [
      challenge.id,
      i + 1,
      p.title,
      p.description,
    ]);
  }
  return { id: challenge.id };
});

route('PUT', '/api/challenges/:challengeId', async ({ q, params, body }) => {
  const challenge = await manageableChallenge(q, params.challengeId);
  const input = challengeInput(body);
  if (challenge.status === 'active' && input.prompts.length === 0) {
    throw badRequest('A launched challenge needs at least one prompt.');
  }

  await q('update challenges set title = $2, description = $3, starts_on = $4, ends_on = $5 where id = $1', [
    challenge.id,
    input.title,
    input.description,
    input.startsOn,
    input.endsOn,
  ]);

  const existing = await q<{ id: string; title: string; entry_count: number }>(
    `select p.id, p.title, (select count(distinct e.user_id)::int from entries e where e.prompt_id = p.id) as entry_count
     from prompts p where p.challenge_id = $1`,
    [challenge.id],
  );
  const existingIds = new Set(existing.map((p) => p.id));
  for (const p of input.prompts) {
    if (p.id && !existingIds.has(p.id)) throw badRequest('One of the prompts no longer exists. Reload and try again.');
  }

  // Remove prompts that were taken out, unless someone has already logged a book for them
  const keptIds = new Set(input.prompts.map((p) => p.id).filter(Boolean));
  const removed = existing.filter((p) => !keptIds.has(p.id));
  const blocked = removed.find((p) => p.entry_count > 0);
  if (blocked) {
    throw badRequest(
      `"${blocked.title}" can't be removed because ${blocked.entry_count === 1 ? 'someone has' : `${blocked.entry_count} people have`} logged a book for it.`,
    );
  }
  for (const p of removed) await q('delete from prompts where id = $1', [p.id]);

  // Update the rest in their new order, and add new ones
  for (const [i, p] of input.prompts.entries()) {
    if (p.id) {
      await q('update prompts set position = $2, title = $3, description = $4 where id = $1', [p.id, i + 1, p.title, p.description]);
    } else {
      await q('insert into prompts (challenge_id, position, title, description) values ($1, $2, $3, $4)', [
        challenge.id,
        i + 1,
        p.title,
        p.description,
      ]);
    }
  }
  return { id: challenge.id };
});

route('POST', '/api/challenges/:challengeId/launch', async ({ q, params }) => {
  const challenge = await manageableChallenge(q, params.challengeId);
  if (challenge.status === 'active') return { ok: true };
  const [{ n }] = await q('select count(*)::int as n from prompts where challenge_id = $1', [challenge.id]);
  if (n === 0) throw badRequest('Add at least one prompt before launching.');
  await q("update challenges set status = 'active', launched_at = now() where id = $1 and status = 'draft'", [challenge.id]);
  return { ok: true };
});

route('GET', '/api/challenges/:challengeId', async ({ q, params }) => {
  const [challenge] = await q(
    `select c.id, c.group_id, c.title, c.description, c.starts_on::text, c.ends_on::text, c.created_by,
            c.status, c.launched_at, can_manage_challenge(c.id) as can_manage,
            g.name as group_name
     from challenges c join groups g on g.id = c.group_id
     where c.id = $1`,
    [params.challengeId],
  );
  if (!challenge) throw notFound("This challenge doesn't exist or you're not in its group.");
  const prompts = await q(
    'select id, position, title, description from prompts where challenge_id = $1 order by position, created_at',
    [params.challengeId],
  );
  const entries = await q(
    `select e.id, e.prompt_id, e.user_id, e.finished_on::text, e.rating, e.notes,
            json_build_object('id', b.id, 'title', b.title, 'author', b.author, 'cover_url', b.cover_url) as books,
            json_build_object('display_name', p.display_name) as profiles
     from entries e
     join books b on b.id = e.book_id
     join profiles p on p.id = e.user_id
     where e.challenge_id = $1
     order by e.created_at`,
    [params.challengeId],
  );
  const considerations = await q(
    `select c.id, c.prompt_id, c.user_id, c.reason, c.created_at,
            json_build_object('id', b.id, 'title', b.title, 'author', b.author, 'cover_url', b.cover_url) as books,
            json_build_object('display_name', p.display_name) as profiles
     from considerations c
     join books b on b.id = c.book_id
     join profiles p on p.id = c.user_id
     where c.challenge_id = $1
     order by c.created_at`,
    [params.challengeId],
  );
  const members = await q(
    `select m.user_id, m.role, m.joined_at,
            json_build_object('display_name', p.display_name, 'email', p.email) as profiles
     from group_members m join profiles p on p.id = m.user_id
     where m.group_id = $1
     order by m.joined_at`,
    [challenge.group_id],
  );
  // Tags on the books read or considered in this challenge
  const bookTags = await q(
    `select bt.book_id, t.id, t.name, t.category, count(*)::int as count,
            bool_or(bt.user_id = current_user_id()) as mine
     from book_tags bt join tags t on t.id = bt.tag_id
     where bt.book_id in (select book_id from entries where challenge_id = $1
                          union select book_id from considerations where challenge_id = $1)
     group by bt.book_id, t.id
     order by count(*) desc, t.name`,
    [params.challengeId],
  );
  return { challenge, prompts, entries, considerations, members, bookTags };
});

route('DELETE', '/api/challenges/:challengeId', async ({ q, params }) => {
  const rows = await q('delete from challenges where id = $1 returning group_id', [params.challengeId]);
  if (!rows.length) throw new HttpError(403, 'Only the person who created this challenge or a group admin can delete it.');
  return { groupId: rows[0].group_id };
});

/** Load a prompt you can see, with its challenge's status. */
async function visiblePrompt(q: Query, promptId: string) {
  const [prompt] = await q<{ challenge_id: string; status: 'draft' | 'active' }>(
    'select p.challenge_id, c.status from prompts p join challenges c on c.id = p.challenge_id where p.id = $1',
    [promptId],
  );
  if (!prompt) throw notFound('That prompt was not found.');
  return prompt;
}

/**
 * Find the book a request refers to: an existing book by id, or one picked from Open Library
 * or typed in by hand (added to the shared catalog, or reused if it's already there).
 */
async function resolveBook(q: Query, book: any): Promise<string> {
  if (typeof book !== 'object' || book === null) throw badRequest('Choose a book first.');
  if (typeof book.id === 'string') {
    if (!new RegExp(`^${UUID}$`).test(book.id)) throw badRequest('That book was not found.');
    const [existing] = await q('select id from books where id = $1', [book.id]);
    if (!existing) throw badRequest('That book was not found.');
    return existing.id;
  }
  const year = Number.isInteger(book.year) ? book.year : null;
  const coverUrl = text(book.coverUrl, 'Cover', { max: 500 });
  if (coverUrl && !coverUrl.startsWith('https://covers.openlibrary.org/')) throw badRequest('Unsupported cover image.');
  const [row] = await q('select upsert_book($1, $2, $3, $4, $5) as id', [
    text(book.title, 'Book title', { max: 300, required: true }),
    text(book.author, 'Author', { max: 300 }),
    coverUrl,
    text(book.openLibraryKey, 'Open Library key', { max: 100 }),
    year,
  ]);
  return row.id;
}

// Logging books. Several different books can count toward the same prompt.

const MAX_BOOKS_PER_PROMPT = 20;
const NOT_LAUNCHED = "This challenge hasn't been launched yet, so books can't be logged.";

function entryDetails(body: any) {
  return {
    finishedOn: date(body.finishedOn, 'Finished date'),
    rating: rating(body.rating),
    notes: text(body.notes, 'Notes', { max: 5000 }),
  };
}

/** Refuse a book you've already logged for this prompt (other than the entry being edited). */
async function checkNotLoggedTwice(q: Query, promptId: string, bookId: string, exceptEntryId: string | null) {
  const [dup] = await q(
    `select 1 from entries where prompt_id = $1 and user_id = current_user_id() and book_id = $2
       and ($3::uuid is null or id <> $3::uuid)`,
    [promptId, bookId, exceptEntryId],
  );
  if (dup) throw new HttpError(409, "You've already logged that book for this prompt.");
}

/** A book on your "considering" list for this prompt is read now, so take it off the list. */
async function graduateConsideration(q: Query, promptId: string, bookId: string) {
  await q('delete from considerations where prompt_id = $1 and user_id = current_user_id() and book_id = $2', [
    promptId,
    bookId,
  ]);
}

route('POST', '/api/prompts/:promptId/entries', async ({ q, params, body }) => {
  const prompt = await visiblePrompt(q, params.promptId);
  if (prompt.status !== 'active') throw badRequest(NOT_LAUNCHED);
  const bookId = await resolveBook(q, body.book);
  const details = entryDetails(body);
  await checkNotLoggedTwice(q, params.promptId, bookId, null);

  const [{ n }] = await q('select count(*)::int as n from entries where prompt_id = $1 and user_id = current_user_id()', [
    params.promptId,
  ]);
  if (n >= MAX_BOOKS_PER_PROMPT) throw badRequest(`You can log up to ${MAX_BOOKS_PER_PROMPT} books for one prompt.`);

  const [entry] = await q(
    `insert into entries (challenge_id, prompt_id, user_id, book_id, finished_on, rating, notes)
     values ($1, $2, current_user_id(), $3, $4, $5, $6)
     returning id`,
    [prompt.challenge_id, params.promptId, bookId, details.finishedOn, details.rating, details.notes],
  );
  await graduateConsideration(q, params.promptId, bookId);
  return { id: entry.id, bookId };
});

route('PUT', '/api/entries/:entryId', async ({ q, params, body }) => {
  const [entry] = await q(
    `select e.id, e.prompt_id, c.status from entries e join challenges c on c.id = e.challenge_id
     where e.id = $1 and e.user_id = current_user_id()`,
    [params.entryId],
  );
  if (!entry) throw notFound('That logged book was not found. Reload and try again.');
  if (entry.status !== 'active') throw badRequest(NOT_LAUNCHED);
  const bookId = await resolveBook(q, body.book);
  const details = entryDetails(body);
  await checkNotLoggedTwice(q, entry.prompt_id, bookId, entry.id);

  await q(
    `update entries set book_id = $2, finished_on = $3, rating = $4, notes = $5, updated_at = now()
     where id = $1`,
    [entry.id, bookId, details.finishedOn, details.rating, details.notes],
  );
  await graduateConsideration(q, entry.prompt_id, bookId);
  return { id: entry.id, bookId };
});

route('DELETE', '/api/entries/:entryId', async ({ q, params }) => {
  await q('delete from entries where id = $1 and user_id = current_user_id()', [params.entryId]);
  return { ok: true };
});

// Considering: books you might read for a prompt, with why. Everyone who can see the
// challenge sees everyone's lists; you change only your own.

const MAX_CONSIDERING_PER_PROMPT = 20;

route('POST', '/api/prompts/:promptId/considerations', async ({ q, params, body }) => {
  const prompt = await visiblePrompt(q, params.promptId);
  const bookId = await resolveBook(q, body.book);
  const reason = text(body.reason, 'Why it might fit', { max: 2000 });

  const [{ n }] = await q(
    'select count(*)::int as n from considerations where prompt_id = $1 and user_id = current_user_id() and book_id <> $2',
    [params.promptId, bookId],
  );
  if (n >= MAX_CONSIDERING_PER_PROMPT) {
    throw badRequest(`You can consider up to ${MAX_CONSIDERING_PER_PROMPT} books per prompt. Remove one to add another.`);
  }

  // Adding a book that's already on your list for this prompt just updates the reason
  const [row] = await q(
    `insert into considerations (challenge_id, prompt_id, user_id, book_id, reason)
     values ($1, $2, current_user_id(), $3, $4)
     on conflict (prompt_id, user_id, book_id) do update
       set reason = coalesce(excluded.reason, considerations.reason), updated_at = now()
     returning id`,
    [prompt.challenge_id, params.promptId, bookId, reason],
  );
  return { id: row.id, bookId };
});

route('PUT', '/api/considerations/:considerationId', async ({ q, params, body }) => {
  const [existing] = await q('select id, prompt_id from considerations where id = $1 and user_id = current_user_id()', [
    params.considerationId,
  ]);
  if (!existing) throw notFound("That book isn't on your list any more.");
  const bookId = await resolveBook(q, body.book);
  const reason = text(body.reason, 'Why it might fit', { max: 2000 });

  const [duplicate] = await q(
    'select id from considerations where prompt_id = $1 and user_id = current_user_id() and book_id = $2 and id <> $3',
    [existing.prompt_id, bookId, existing.id],
  );
  if (duplicate) throw new HttpError(409, "That book is already on your list for this prompt.");

  await q('update considerations set book_id = $2, reason = $3, updated_at = now() where id = $1', [
    existing.id,
    bookId,
    reason,
  ]);
  return { id: existing.id, bookId };
});

route('DELETE', '/api/considerations/:considerationId', async ({ q, params }) => {
  await q('delete from considerations where id = $1 and user_id = current_user_id()', [params.considerationId]);
  return { ok: true };
});

// Tags. A suggested library (db/tags_seed.sql) plus tags people add. Each person tags books
// separately; a book's tags are shown with how many people chose each one.

const MAX_TAGS_PER_BOOK = 30;

/** Every tag, with how many books carry it */
route('GET', '/api/tags', async ({ q }) =>
  q(`
    select t.id, t.name, t.category, t.suggested, t.position,
           (select count(distinct bt.book_id)::int from book_tags bt where bt.tag_id = t.id) as book_count
    from tags t
    order by t.name`),
);

/** Add your own tag (or get the existing one with the same name) */
route('POST', '/api/tags', async ({ q, body }) => {
  const name = text(body.name, 'Tag', { max: 40, required: true })!.replace(/\s+/g, ' ');
  const slug = name.toLowerCase();
  await q(
    `insert into tags (name, slug, category, suggested, created_by)
     values ($1, $2, 'custom', false, current_user_id())
     on conflict (slug) do nothing`,
    [name, slug],
  );
  const [tag] = await q('select id, name, category, suggested, position from tags where slug = $1', [slug]);
  return { ...tag, book_count: 0 };
});

/** A book's tags: how many people chose each, and whether you did */
async function bookTagSummary(q: Query, bookId: string) {
  return q(
    `select t.id, t.name, t.category, count(*)::int as count, bool_or(bt.user_id = current_user_id()) as mine
     from book_tags bt join tags t on t.id = bt.tag_id
     where bt.book_id = $1
     group by t.id
     order by count(*) desc, t.name`,
    [bookId],
  );
}

route('GET', '/api/books/:bookId/tags', async ({ q, params }) => bookTagSummary(q, params.bookId));

/** Replace your tags on a book */
route('PUT', '/api/books/:bookId/my-tags', async ({ q, params, body }) => {
  const raw = Array.isArray(body.tagIds) ? body.tagIds : null;
  if (!raw) throw badRequest('tagIds must be a list.');
  if (!raw.every((id: unknown) => typeof id === 'string' && new RegExp(`^${UUID}$`).test(id))) {
    throw badRequest('One of the tags is not valid.');
  }
  const tagIds = [...new Set(raw as string[])];
  if (tagIds.length > MAX_TAGS_PER_BOOK) throw badRequest(`You can put up to ${MAX_TAGS_PER_BOOK} tags on a book.`);

  const [book] = await q('select id from books where id = $1', [params.bookId]);
  if (!book) throw notFound('That book was not found.');

  await q('delete from book_tags where book_id = $1 and user_id = current_user_id() and not (tag_id = any($2::uuid[]))', [
    book.id,
    tagIds,
  ]);
  await q(
    `insert into book_tags (book_id, tag_id, user_id)
     select $1, t.id, current_user_id() from tags t where t.id = any($2::uuid[])
     on conflict do nothing`,
    [book.id, tagIds],
  );
  return bookTagSummary(q, book.id);
});

/**
 * Find books by tags (books carrying all of them) and/or title or author text.
 * With no filters: books with tags, or read or considered in your groups, most recent first.
 * Each result lists its tags and who in your groups read or is considering it.
 */
route('POST', '/api/books/search', async ({ q, body }) => {
  const tagIds = Array.isArray(body.tagIds)
    ? body.tagIds.filter((id: unknown) => typeof id === 'string' && new RegExp(`^${UUID}$`).test(id)).slice(0, 20)
    : [];
  const words = text(body.q, 'Search', { max: 200 });
  const like = words ? `%${words.replace(/[\\%_]/g, (c) => `\\${c}`)}%` : null;

  return q(
    `select b.id, b.title, b.author, b.cover_url,
            coalesce((select json_agg(x order by x.count desc, x.name) from (
                select t.id, t.name, t.category, count(*)::int as count, bool_or(bt.user_id = current_user_id()) as mine
                from book_tags bt join tags t on t.id = bt.tag_id
                where bt.book_id = b.id group by t.id) x), '[]') as tags,
            coalesce((select json_agg(r order by r.created_at desc) from (
                select e.created_at, e.rating, p.display_name, pr.title as prompt_title,
                       c.id as challenge_id, c.title as challenge_title
                from entries e
                join profiles p on p.id = e.user_id
                join prompts pr on pr.id = e.prompt_id
                join challenges c on c.id = e.challenge_id
                where e.book_id = b.id
                order by e.created_at desc limit 10) r), '[]') as reads,
            coalesce((select json_agg(r order by r.created_at desc) from (
                select k.created_at, k.reason, p.display_name, pr.title as prompt_title,
                       c.id as challenge_id, c.title as challenge_title
                from considerations k
                join profiles p on p.id = k.user_id
                join prompts pr on pr.id = k.prompt_id
                join challenges c on c.id = k.challenge_id
                where k.book_id = b.id
                order by k.created_at desc limit 10) r), '[]') as considering
     from books b
     where (cardinality($1::uuid[]) = 0
            or (select count(distinct bt.tag_id) from book_tags bt
                where bt.book_id = b.id and bt.tag_id = any($1::uuid[])) = cardinality($1::uuid[]))
       and ($2::text is null or b.title ilike $2 or b.author ilike $2)
       and (cardinality($1::uuid[]) > 0 or $2::text is not null
            or exists (select 1 from book_tags bt where bt.book_id = b.id)
            or exists (select 1 from entries e where e.book_id = b.id)
            or exists (select 1 from considerations k where k.book_id = b.id))
     order by greatest(
       (select max(created_at) from book_tags where book_id = b.id),
       (select max(created_at) from entries where book_id = b.id),
       (select max(created_at) from considerations where book_id = b.id),
       b.created_at) desc
     limit 60`,
    [tagIds, like],
  );
});

// ---------------------------------------------------------------------------
// Dispatch
// ---------------------------------------------------------------------------

export async function handle(req: ApiRequest): Promise<ApiResponse> {
  try {
    const path = req.path.split('?')[0].replace(/\/+$/, '') || '/';
    if (path === '/api/health') return { status: 200, body: { ok: true } };

    let matched: { handler: Handler; params: Params } | null = null;
    let pathExists = false;
    for (const [method, pattern, keys, handler] of routes) {
      const m = pattern.exec(path);
      if (!m) continue;
      pathExists = true;
      if (method !== req.method.toUpperCase()) continue;
      matched = { handler, params: Object.fromEntries(keys.map((k, i) => [k, m[i + 1]])) };
      break;
    }
    if (!matched) return { status: pathExists ? 405 : 404, body: { error: pathExists ? 'Method not allowed' : 'Not found' } };

    let body: any = {};
    if (req.body) {
      if (req.body.length > 100_000) throw badRequest('Request is too large.');
      try {
        body = JSON.parse(req.body);
      } catch {
        throw badRequest('Request body must be JSON.');
      }
      if (typeof body !== 'object' || body === null) throw badRequest('Request body must be a JSON object.');
    }

    const userId = await verifyRequest(req.headers['authorization']);
    const { handler, params } = matched;
    const result = await asUser(userId, (q) => handler({ q, params, body }));
    return { status: 200, body: result };
  } catch (e: any) {
    if (e instanceof HttpError) return { status: e.status, body: { error: e.message } };
    console.error(e);
    return { status: 500, body: { error: 'Something went wrong. Please try again.' } };
  }
}
