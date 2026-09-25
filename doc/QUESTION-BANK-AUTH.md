# Cloud AI question bank and accounts

The application keeps built-in questions, browser AI history, wrong-book entries,
favorites, attempts, and learning records in the browser. Render PostgreSQL stores
only AI-generated questions in `ai_question_bank`; old local data is not migrated.

## Render variables

Set these variables on the web service:

* `DATABASE_URL`: the Render PostgreSQL internal connection string.
* `QUESTION_BANK_ADMIN_TOKEN`: a long random value used only by trusted server-side
  import/edit clients. It is never sent to the browser or stored in localStorage.
* `ACTIVATION_ADMIN_TOKEN`: a separate long random value for activation-code management.
* `ADMIN_USERNAME`: the exact username that receives the in-site administrator role.
* `REQUIRE_ACTIVATION=true`: turns on the login gate for the normal website and AI APIs.

`render.yaml` declares both variables as secret (`sync: false`). The application
creates the account, session, and question-bank tables on startup.

## Public and protected endpoints

* `GET /api/question-bank` is public and supports `search`, `chapter`, `type`,
  `difficulty`, `school`, `limit`, and `offset`.
* `POST /api/question-bank` requires `Authorization: Bearer <QUESTION_BANK_ADMIN_TOKEN>`
  or `X-Question-Bank-Admin-Token`.
* `PATCH /api/question-bank/:id` uses the same token check.
* Successful `POST /api/ai/questions` returns the generated questions together with a
  `persistence` object. Its `status` is `saved`, `partial`, `failed`, or
  `unavailable`, so the browser can distinguish cloud persistence from local history.
  Calculator metadata is stored in the `calculator` JSONB field and is returned by
  `GET /api/question-bank` for one-click calculator handoff. Writes are bounded and
  do not block the response indefinitely; a failed cloud write does not discard the
  generated result.

## Accounts

`POST /api/auth/register`, `POST /api/auth/login`, `GET /api/auth/me`, and
`POST /api/auth/logout` provide the account flow. Passwords use `crypto.scrypt`;
sessions are server-side and represented by an HttpOnly, SameSite cookie. In local
development without `DATABASE_URL`, an in-memory account store is enabled. In
production, configure PostgreSQL before using account login.

Registration also requires a one-time activation code. Set `ACTIVATION_ADMIN_TOKEN`
on Render (it may be the same secret as `QUESTION_BANK_ADMIN_TOKEN`, but a separate
random value is recommended). The protected admin endpoints are:

* `POST /api/admin/activation-codes` with `{ "count": 10, "expiresInDays": 30,
  "label": "batch-1" }`; the response contains the new codes once.
* `GET /api/admin/activation-codes` to inspect hints, expiry, and usage status. Full
  codes are never returned after creation.
* `POST /api/admin/activation-codes/:id/revoke` to invalidate an unused code.

Send the admin secret as `Authorization: Bearer <ACTIVATION_ADMIN_TOKEN>` or
`X-Question-Bank-Admin-Token`. With `REQUIRE_ACTIVATION=true`, AI generation requires
a logged-in activated account, and the normal `/` page serves the login/register gate.
The administrator can open `/admin.html` after logging in. Local offline use remains
available when the gate is disabled in development.

The top-right login control is used after the gate is disabled; production visitors
must authenticate before entering the normal site. Public question queries remain
available to server clients as an API contract, while the normal browser page is gated.
