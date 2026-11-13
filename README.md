# DineDesk API – access control and secrets

A small Node.js / Express API for DineDesk, a restaurant chain with two
branches in Addis Ababa (Bole and Piassa). It was built for Assignment 7
(Authentication, Authorization and Secrets Management) and replaces an old
API that had broken authentication, missing authorization and leaked secrets.

Staff roles: **waiter**, **cashier**, **manager** (one branch) and
**admin** (whole chain, no branch).

The API uses in-memory seed data, with passwords stored as bcrypt hashes.

## What it does

| Layer | How it is done |
|---|---|
| Authentication | `POST /api/auth/login` checks the password with bcrypt, gives one generic error for a wrong email or password, and issues a JWT with minimal claims, an issuer, an audience and a short expiry (15 minutes by default). |
| Token checking | The `authenticate` middleware accepts only `Authorization: Bearer <token>` and uses `jwt.verify` with an algorithm allowlist, issuer and audience. Every bad token gets **401**. `req.user` comes only from the verified token and our own user records. |
| Roles and permissions | A role → permission table. Routes check a permission such as `orders:create`, not a list of role names. An unknown role has no permissions. Denied requests get **403**. |
| Branch-level access | One policy function, `canAccessOrder(user, order)` in `src/policies/orderPolicy.js`. Non-admin staff see only their own branch's orders. Another branch's order returns **404**, so nothing leaks about whether it exists. |
| Reports | `GET /api/reports/branch` is built from `req.user.branchId`. A `?branchId=` in the URL changes nothing. |
| Secrets | All configuration is read in one config module from environment variables. The API refuses to start if a value is missing or `JWT_SECRET` is shorter than 32 characters. The error names the setting and never prints a value. |

## Endpoints

| Method | Path | Needs |
|---|---|---|
| POST | `/api/auth/login` | – |
| GET | `/api/orders` | any authenticated staff (scoped to the user's branch) |
| GET | `/api/orders/:id` | `orders:read` (branch check) |
| POST | `/api/orders` | `orders:create` |
| POST | `/api/payments` | `payments:create` |
| GET | `/api/reports/branch` | `reports:read` |
| GET | `/api/admin/users` | role `admin` |

## Running it locally

Requires Node.js.

```powershell
npm install
Copy-Item .env.example .env
```

Generate a strong signing key and put it in `.env` as `JWT_SECRET`:

```powershell
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

Your `.env` needs these settings (see `.env.example`):

```
JWT_SECRET=<random string of at least 32 characters>
JWT_ISSUER=dinedesk-api
JWT_AUDIENCE=dinedesk-staff
```

Then start the API:

```powershell
npm start
```

**Never commit `.env`.** It is listed in `.gitignore`. Only `.env.example`,
which holds names and placeholders, is committed.

## Tests

```powershell
npm test
```

There are 19 Jest + Supertest tests. They cover allowed **and** denied
requests: no token, a token signed with the wrong key, an expired token,
waiter vs admin on the admin route, order creation by waiter and cashier,
branch isolation for managers, and the `?branchId=` report case.

The tests get their signing key from `tests/setup-env.js`, which sets
`JWT_SECRET` to a fake test-only value, so they need no real secret.

## GitHub Actions

| Workflow | When it runs | What it does |
|---|---|---|
| Tests | every push and pull request | Runs `npm test`. Uses `permissions: contents: read` and needs no repository secret. |
| `check-secret.yml` (Verify demo secret) | manually (`workflow_dispatch`) | Confirms that a repository secret named `DINEDESK_DEMO_KEY` is configured **without printing it**. The secret is passed to one step through `env:`. |

## Assignment answers

The written answers for all six tasks are in
[`docs/assignment7-answers.txt`](docs/assignment7-answers.txt).

## Security notes

- No real password, key, token or connection string is stored in this
  repository. Every value is invented.
- Access tokens last at most 15 minutes. A dismissed user keeps access
  until their token expires, because there are no refresh tokens and the
  user record is not re-checked on each request. Revocable refresh tokens
  and an "is this user still active?" check would close that gap.