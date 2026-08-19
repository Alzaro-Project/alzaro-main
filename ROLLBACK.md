# ROLLBACK.md — how to roll an Alzaro vertical back

Each vertical (SoloOps, GarageOps, TyreOps, PropertyOps, ServiceOps) versions
**independently**. The little `v1.0.0` chip in each app's sidebar is a
**label only** — it reads `VERSION` out of that vertical's `src/version.js`.
Changing the badge does **not** bring code back; it just tells the truth about
whatever build is live. To actually roll back, you re-serve or rebuild old code.

There are two kinds of rollback: an **emergency** one (no code, ~10 seconds) and
a **permanent** one (git). Read the Supabase warning near the bottom before you
touch data.

---

## 1. Emergency rollback (fastest — Vercel, no code, no git)

Use this when a bad deploy is live right now and you just need the previous good
version back.

1. Open the **Vercel dashboard** for the affected project.
2. Go to **Deployments**.
3. Find the last deployment you know was good (check the timestamp / commit).
4. Open its **⋯** menu → **Promote to Production**.

Vercel re-serves that older build in about 10 seconds. No code change, no git,
no rebuild. It's fully reversible — promote a newer deployment again to go
forward. The version badge will show whatever `version.js` was in that build, so
it stays honest automatically.

> This only rewinds the **frontend build**. It does **not** touch the database
> (see the Supabase note below).

---

## 2. Permanent rollback (git — revert a vertical to a tag)

Use this when you want the rollback to stick: the repo itself should go back to a
known-good version of one vertical, then rebuild and deploy normally.

Every shipped version is tagged `<vertical>-v<x.y.z>` (see the table below). That
tag is your rollback point. You revert **only that vertical's folder** to its tag
— the other verticals are untouched, because they version independently.

**Ready-to-paste Claude Code instruction** (replace `GarageOps`, `garageops`, and
the version with the real ones):

```
On a new branch `rollback-garageops-1.0.0`, restore the GarageOps/ folder to its
garageops-v1.0.0 tag (git checkout garageops-v1.0.0 -- GarageOps), then
cd GarageOps && npm install && npm run build to confirm it builds clean. Do NOT
touch any other vertical and do NOT run any SQL. Commit and open a PR to main
titled "Rollback: GarageOps → v1.0.0".
```

Doing it by hand instead:

```bash
git fetch --tags
git checkout -b rollback-garageops-1.0.0 origin/main
git checkout garageops-v1.0.0 -- GarageOps
cd GarageOps && npm install && npm run build   # verify it builds
git commit -am "Rollback: GarageOps → v1.0.0"
git push -u origin rollback-garageops-1.0.0
# then open a PR to main
```

Merging that PR redeploys the vertical from the old code. If you want the badge to
read correctly, make sure the reverted `version.js` reflects the version you rolled
back to (reverting the folder to the tag already does this).

---

## ⚠️ Rolling back code does NOT roll back Supabase

**This is the important part.** Both rollback methods above move **code only**.
They do **not** undo anything in the database.

Rolling back code is safe here **only because every migration is additive and
non-destructive** — migrations use `ADD COLUMN IF NOT EXISTS` and similar, and
**never `DROP` / `DELETE`**. So old code simply ignores newer columns; nothing
breaks by rewinding the build.

If you actually need to undo **data** (rows changed or deleted), that is a
separate, careful job: **Supabase point-in-time recovery (PITR)**. It is not part
of a code rollback and can lose data if done carelessly. **Ask before attempting a
Supabase restore.**

---

## 3. The normal ship loop (for reference)

Rolling back is the exception. Normal shipping for a vertical is:

1. **Bump** `VERSION` in `<Vertical>/src/version.js`
   (`PATCH` = a fix, `MINOR` = a new feature, `MAJOR` = a big/breaking release).
2. **Add one entry** to the top of `CHANGELOG` in the same file (newest first).
3. **Merge** to `main`.
4. **Tag** the release: `<vertical>-v<version>` (e.g. `garageops-v1.1.0`).

That tag is both the release marker and the rollback point for section 2 above.
Bumping one vertical never touches another.

---

## 4. Tag naming

Per-vertical tags — one vertical's versions move on their own:

| Vertical     | Tag prefix      | Example            |
| ------------ | --------------- | ------------------ |
| SoloOps      | `soloops-v`     | `soloops-v1.0.0`     |
| GarageOps    | `garageops-v`   | `garageops-v1.0.0`   |
| TyreOps      | `tyreops-v`     | `tyreops-v1.0.0`     |
| PropertyOps  | `propertyops-v` | `propertyops-v1.0.0` |
| ServiceOps   | `serviceops-v`  | `serviceops-v1.0.0`  |

> StockOps is a placeholder (only an `index.html`, no app) and is not versioned.
