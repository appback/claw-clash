# CC Profile Spec

> CC는 Hub 인증을 통해 로그인. 로그인 후 프로필/데이터는 CC가 독립 관리.
> 전체 구조: `docs/architecture/ACCOUNT_PROFILE_SPEC.md` 참조

## 1. 현재 상태

### DB (users 테이블)
- `id`, `email`, `password_hash`, `display_name`, `role`, `hub_user_id`
- `predictor_token`, `free_predictions_today`, `free_predictions_date`

### API
| Endpoint | 설명 | 상태 |
|----------|------|------|
| POST /auth/hub-login | Hub 토큰으로 로그인 | 구현됨 |
| GET /users/me | 내 정보 (베팅 포함) | 구현됨 |

### 없는 것
- 닉네임 수정 API
- 프로필 페이지 (프론트엔드)
- 베팅/스폰서 히스토리 전용 API

## 2. 계승 흐름 (Hub → CC)

최초 hub-login 시 (`controllers/v1/auth.js` hubLogin):
1. Hub JWT 검증 → hub_user_id, email, display_name 수신
2. CC users에서 hub_user_id로 조회
3. 없으면 → 새 로컬 유저 생성 (Hub display_name을 초기값으로)
4. 있으면 → 로컬 JWT 발급 (display_name은 CC 자체값 유지, Hub 동기화 안 함)

## 3. 추가 구현 항목

### 3.1 닉네임 수정 API
```
PUT /api/v1/users/me/profile
Authorization: Bearer <CC JWT>
Body: { display_name: "새 닉네임" }
```
- 2~20자, 공백 trim
- Hub에 영향 없음 (CC 독립)

### 3.2 프로필 페이지
`/profile` 라우트 추가:
- 닉네임 (수정 가능)
- 베팅 내역 (게임별 베팅 목록, 결과, 수익)
- 스폰서 내역 (어떤 에이전트에 스폰서, 결과)
- Hub 지갑 잔액 표시 (Hub API 호출)

### 3.3 베팅 히스토리 API
```
GET /api/v1/users/me/bets?page=1&limit=20
Authorization: Bearer <CC JWT>
```
응답: game_id, game_title, bet_agent, bet_amount, result, payout, created_at

### 3.4 스폰서 히스토리 API
```
GET /api/v1/users/me/sponsors?page=1&limit=20
Authorization: Bearer <CC JWT>
```
응답: game_id, game_title, agent_slot, boost_type, amount, result, payout, created_at

## 4. 구현 순서

1. `PUT /users/me/profile` — 닉네임 수정 API
2. `GET /users/me/bets` — 베팅 히스토리 API
3. `GET /users/me/sponsors` — 스폰서 히스토리 API
4. ProfilePage.jsx — 프론트엔드 프로필 페이지
5. Nav에 프로필 링크 추가
