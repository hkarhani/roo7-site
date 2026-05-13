# Frontend User UI

This file is the canonical user-facing frontend summary.

## Main Pages

| Page | Purpose |
| --- | --- |
| `index.html`, `landingpage.html` | Public entry and marketing pages |
| `auth.html` | Login, registration, magic link, password reset |
| `dashboard.html` | User trading dashboard |
| `troubleshoot.html` | Account diagnostics detail view |
| `invoices.html` | Subscription and invoice management |
| `referrals.html` | Referral code and earnings view |
| `market-insights.html` | Market data and insights |
| `platformvsbenchmark.html`, `portfoliovsbenchmark.html` | Performance comparison views |

## Dashboard Workflow

The user dashboard separates account setup from strategy assignment.

1. User creates an exchange account.
2. The account can exist without a strategy; backend schedules analytics/data collection.
3. User assigns one strategy to the account later.
4. Backend syncs account and strategy into `active_jobs`.
5. Observer executes the scheduled destination replication job.

## Account Creation

Supported account creation options:

- Binance SPOT
- Binance FUTURES
- OKX SPOT
- OKX FUTURES

Credential fields:

- Binance: API key and API secret.
- OKX: API key, API secret, and API passphrase.

The OKX passphrase field is shown only when exchange is OKX. Binance setup remains unchanged.

## Strategy Assignment

Strategy assignment:

- Is opened from the account row/action.
- Filters strategies by account exchange and type.
- Preserves a 1-account-to-1-strategy model.
- Allows strategy parameters/custom portfolio configuration where the backend strategy definition supports it.

## Troubleshoot

The frontend calls backend troubleshoot endpoints. Backend dispatches the exchange-specific logic:

- Binance accounts use Binance readers/troubleshoot.
- OKX accounts use OKX snapshot/troubleshoot.
- Generic troubleshoot connection-test labels are exchange-neutral; exchange-specific diagnostics remain owned by the backend response.
- Portfolio tables normalize Binance and OKX position/order fields before rendering, so OKX `position_amount`/`instId`/`ordType` and Binance `positionAmt`/`symbol`/`type` display through the same user UI.
- Futures accounts show an account warning icon only when the backend cannot automatically switch the destination account to the required source position mode before replication. Unsupported-token, renormalization, soft-skip, and small-trade warnings stay out of the user dashboard.

## Cache Busting

When changing JavaScript behavior, update the affected HTML script version query string so deployed users fetch the new file.
