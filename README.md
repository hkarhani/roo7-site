# ROO7 Frontend

This repository contains the static frontend for the ROO7 platform. It is Git-enabled separately from the backend `dbsetup` folder.

## Permanent Operational Rules

- Frontend edits are local only in this folder.
- Production `droplet2` must not be modified from Codex.
- Backend edits are local only in `../../dbsetup/`.
- The user commits, syncs, and restarts/deploys manually.
- JavaScript changes should include cache busting in the relevant HTML script references.

## UI Areas

| Area | Main files | Canonical docs |
| --- | --- | --- |
| User UI | `dashboard.html`, `dashboard.js`, `dashboard-modal.js`, `troubleshoot.html`, `invoices.html`, `referrals.html`, `market-insights.html` | `USER_UI.md` |
| Admin UI | `admin-dashboard.html`, `admin-accounts.html`, `admin-jobs-manager.html`, `admin-users.html`, `admin-portfolioanalytics.html`, `admin_b2b.html` | `ADMIN_UI.md` |
| Shared config/theme | `frontend-config.js`, `theme-manager.js`, `styles.css` | this file |

## Implemented Platform Support

- Users can create Binance and OKX accounts.
- OKX account setup shows the passphrase field only when OKX is selected.
- Account creation and strategy assignment are separate workflows.
- Strategy assignment filters by account exchange and account type.
- User dashboard displays exchange, type, strategy, value, status, troubleshoot, and strategy actions.
- Troubleshoot pages call backend troubleshoot endpoints; backend decides Binance vs OKX execution.
- Admin jobs manager shows account owner username and supports filters for owner username, account name, and job type.

## Backend Integration

Configured API bases live in `frontend-config.js`.

Core backend services:

- `auth-api`: auth, accounts, strategies, troubleshoot, admin APIs.
- `jobs-manager`: admin jobs APIs/log streaming.
- `market-data-service`: market data and symbol validation.
- `invoicing-api`: subscriptions, invoices, referrals.
- `b2bsync-service`: admin B2B partner APIs.

## Documentation Cleanup

Old user-guide/frontend long-form docs were consolidated into:

- `USER_UI.md`
- `ADMIN_UI.md`
- backend service READMEs in `../../dbsetup/`
- the single remaining-task list at `../../dbsetup/REMAINING_WORK.md`
