# Frontend Admin UI

This file is the canonical admin-facing frontend summary.

## Main Pages

| Page | Purpose |
| --- | --- |
| `admin-dashboard.html` | Platform/admin overview, source accounts, high-level KPIs |
| `admin-accounts.html` | User trading account management and detailed troubleshoot |
| `admin-jobs-manager.html` | Active jobs, execution history, Run Now, log viewing |
| `admin-users.html` | User management |
| `admin-portfolioanalytics.html` | Portfolio analytics and source/user performance views |
| `admin-audit-management.html`, `admin-auth-logs.html` | Audit/security log views |
| `admin_b2b.html` | B2B partner management surface |

## Admin Jobs Manager

Implemented behavior:

- Active jobs table includes account owner username.
- Execution history includes account owner username.
- Filters support owner username, account name, and job type.
- Run Now marks a job due; observer picks it up through fast due-job dispatch.
- Log viewer opens job execution logs for operator inspection.

Important behavior:

- Run Now does not directly trade in the browser.
- Run Now should not mutate exchange credentials except for backend repair of missing derived active-job encrypted fields.
- Destination execution remains owned by backend jobs/observer logic.

## Admin Accounts

Implemented behavior:

- Lists user trading accounts with owner username, account name, exchange, type, strategy, and status.
- Supports detailed troubleshoot for user destination accounts.
- Active trading accounts show an admin-only OKX futures alert icon when latest job warnings include unsupported-token removal, renormalization, soft-skipped order/instrument rejections, or an OKX account-mode advisory.
- Clicking an active trading account opens account details; OKX futures accounts include latest futures job status and source-vs-destination futures weightage when snapshots are available.
- Troubleshoot must not modify the user-controlled `exchange` field.
- Disabled/revoked account troubleshoot is diagnostic-only on the backend.

## Admin Source Accounts

Source accounts are admin Binance accounts only. They are strategy sources for replication. OKX accounts are user/destination accounts only.

Source verification uses backend source-account verification and saves source snapshots for strategy use.

## B2B Admin

The B2B page is wired to partner management APIs, but additional partner UI polish remains tracked in `../../dbsetup/REMAINING_WORK.md`.

## Cache Busting

When changing admin JavaScript behavior, update the affected HTML script version query string.
