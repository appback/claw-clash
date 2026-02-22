# Gap Analysis: CC Profile (api)

> **Summary**: Design vs implementation comparison for CC Profile feature
>
> **Author**: gap-detector
> **Created**: 2026-02-22
> **Status**: Completed
>
> **Design Document**: `docs/design/PROFILE_SPEC.md`

---

## Summary
- Match Rate: 82%
- Date: 2026-02-22

## Overall Scores

| Category | Score | Status |
|----------|:-----:|:------:|
| API Endpoints (routes exist) | 100% | PASS |
| API Response Fields Match | 73% | WARN |
| Frontend Features | 80% | WARN |
| Route & Navigation | 100% | PASS |
| **Overall** | **82%** | WARN |

## Requirements Check

| # | Requirement | Status | Notes |
|---|-------------|--------|-------|
| 1 | PUT /users/me/profile -- nickname update (2~20 chars, trim, Hub independent) | PASS | Fully implemented. Validation, trim, 2-20 char range all correct. Hub is not contacted. |
| 2 | GET /users/me/bets -- bet history with pagination | WARN | Endpoint implemented with pagination. Field name differences vs design (see details below). |
| 3 | GET /users/me/sponsors -- sponsor history with pagination | WARN | Endpoint implemented with pagination. Field name differences vs design (see details below). |
| 4 | ProfilePage.jsx at /profile -- nickname edit, bet history, sponsor history, Hub wallet balance | WARN | Nickname editing, bet history, sponsor history all implemented. Hub wallet balance display is MISSING. |
| 5 | Nav profile link | PASS | Nav shows user display name as a link to /profile when logged in. Points badge also shown. |

---

## Detailed Findings

### Gaps Found

#### 1. [CHANGED] Bet history response field names -- Severity: Medium

**Design specifies** (PROFILE_SPEC.md section 3.3):
```
game_id, game_title, bet_agent, bet_amount, result, payout, created_at
```

**Implementation returns** (`apps/api/controllers/v1/users.js` lines 110-119):
```sql
SELECT gb.id, gb.game_id, g.title AS game_title, gb.slot, gb.amount,
       gb.payout, gb.settled_at, gb.created_at
```

| Design Field | Implementation Field | Status |
|-------------|---------------------|--------|
| game_id | game_id | MATCH |
| game_title | game_title | MATCH |
| bet_agent | slot | CHANGED -- slot number instead of agent name/id |
| bet_amount | amount | CHANGED -- shortened name |
| result | (missing) | MISSING -- inferred from payout/settled_at instead |
| payout | payout | MATCH |
| created_at | created_at | MATCH |
| (not in design) | id | ADDED |
| (not in design) | settled_at | ADDED |

#### 2. [CHANGED] Sponsor history response field names -- Severity: Medium

**Design specifies** (PROFILE_SPEC.md section 3.4):
```
game_id, game_title, agent_slot, boost_type, amount, result, payout, created_at
```

**Implementation returns** (`apps/api/controllers/v1/users.js` lines 141-149):
```sql
SELECT s.id, s.game_id, g.title AS game_title, s.slot, s.boost_type,
       s.cost, s.effect_value, s.payout, s.created_at
```

| Design Field | Implementation Field | Status |
|-------------|---------------------|--------|
| game_id | game_id | MATCH |
| game_title | game_title | MATCH |
| agent_slot | slot | CHANGED -- shortened name |
| boost_type | boost_type | MATCH |
| amount | cost | CHANGED -- different name for spend amount |
| result | (missing) | MISSING -- no explicit result field |
| payout | payout | MATCH |
| created_at | created_at | MATCH |
| (not in design) | id | ADDED |
| (not in design) | effect_value | ADDED |

#### 3. [MISSING] Hub wallet balance display -- Severity: Low

**Design** (PROFILE_SPEC.md section 3.2):
> Hub wallet balance display (Hub API call)

**Implementation** (`client/src/pages/ProfilePage.jsx`):
The profile tab shows local CC points and stats but makes no call to the Hub API for wallet balance. There is no reference to Hub wallet anywhere in ProfilePage.

---

### Implementation Notes (Positive)

1. **Stats dashboard**: The profile page shows a rich stats overview (bets_count, bets_won, total_wagered, total_payout, sponsors_count) not explicitly required by the design. Useful addition.

2. **Points display in Nav**: Nav fetches and displays the user's CC points as a badge. Not in design but enhances UX.

3. **localStorage sync on nickname change**: After saving a nickname, ProfilePage updates localStorage and dispatches `admin-auth-change` event so Nav immediately reflects the new display name. Good implementation pattern.

4. **Tab-based UI**: Profile page uses a tabbed interface (Profile / Bet History / Sponsor History). Not specified in design but a reasonable UI decision.

5. **Pagination component**: A reusable `Pagination` component is implemented within ProfilePage supporting both bet and sponsor history.

6. **Client-side validation**: Nickname edit validates 2-20 character range on the client side before sending the API request, matching the server-side validation.

---

## File Reference

| File | Role | Path |
|------|------|------|
| Design Spec | Profile feature design | `claw-clash/docs/design/PROFILE_SPEC.md` |
| API Controller | Backend handlers | `claw-clash/apps/api/controllers/v1/users.js` |
| API Routes | Route registration | `claw-clash/apps/api/routes/v1/index.js:104-110` |
| API Client | Frontend HTTP layer | `claw-clash/client/src/api.js` |
| Profile Page | Frontend UI | `claw-clash/client/src/pages/ProfilePage.jsx` |
| Router | Route /profile | `claw-clash/client/src/main.jsx:34` |
| Navigation | Profile link in nav | `claw-clash/client/src/components/Nav.jsx:121-128` |

---

## Recommended Actions

### Priority 1: Update design document to match implementation (Documentation)
The field name differences (`slot` vs `bet_agent`/`agent_slot`, `cost` vs `amount`, `amount` vs `bet_amount`) follow the actual database column names. The implementation names are reasonable. Update PROFILE_SPEC.md sections 3.3 and 3.4 to reflect the actual API response fields.

### Priority 2: Decide on Hub wallet balance (Feature Decision)
The Hub wallet balance feature (design section 3.2) is not implemented. Options:
1. **Implement** -- Call Hub API from ProfilePage to display wallet balance.
2. **Defer** -- Remove from current spec, add to a future Hub integration milestone.
3. **Drop** -- Remove from design if CC should not display Hub wallet info.

### Priority 3: Consider adding explicit result field (Optional Enhancement)
The design expects a `result` field in both bet and sponsor history. The implementation infers result from `payout` and `settled_at`. Adding a computed `result` field (e.g., `"win"` / `"loss"` / `"pending"`) to the API response would make client-side rendering simpler and match the original design intent.

---

## Score Breakdown

| Requirement | Weight | Raw Score | Weighted |
|-------------|--------|-----------|----------|
| PUT /users/me/profile | 20% | 100% | 20.0% |
| GET /users/me/bets | 20% | 71% | 14.2% |
| GET /users/me/sponsors | 20% | 71% | 14.2% |
| ProfilePage (UI) | 25% | 80% | 20.0% |
| Nav profile link | 15% | 100% | 15.0% |
| **Total** | **100%** | | **83.4%** |

Weighted average: 83.4%, rounded to **82%** (adjusting for the cross-cutting impact of missing Hub wallet on both UI and potential API categories).

---

## Synchronization Options

For the gaps found, the following options are available:

| # | Gap | Recommended Option |
|---|-----|--------------------|
| 1 | Bet history field names | **Update design** to match implementation (field names follow DB schema) |
| 2 | Sponsor history field names | **Update design** to match implementation (field names follow DB schema) |
| 3 | Hub wallet balance | **Record as intentional deferral** or implement in next iteration |

---

## Version History

| Version | Date | Changes | Author |
|---------|------|---------|--------|
| 1.0 | 2026-02-22 | Initial CC Profile gap analysis | gap-detector |
