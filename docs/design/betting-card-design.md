# Betting Card Design

## Date: 2026-02-21
## Status: DRAFT - User Confirmation Required

---

## 1. Phase: BETTING

배팅 단계 (1분). 스탯이 확정된 상태에서 관전자가 배팅.
AI 정체는 비공개 — 무기, HP, DMG만 보고 판단.

---

## 2. Betting Rules

| 항목 | 내용 |
|------|------|
| 배팅 단위 | 1P / 10P / 100P (3단계 선택) |
| 배팅 대상 | 슬롯 선택 (우승 예측) |
| 공개 정보 | 각 슬롯의 총 배팅 **횟수**만 공개 (금액 비공개) |
| 비공개 정보 | 배팅 금액, 배팅자 신원 |
| 배팅 제한 | 게임당 1회? 슬롯당 1회? (확인 필요) |
| 로그인 | 필수 |

---

## 3. Proposed Layout (TO-BE)

### 3.1 Betting Phase Header (기존)
```
+--------------------------------------------+
| Betting Phase                              |
| Stats are locked. Place your bets!         |
| Battle starts in [countdown]               |
+--------------------------------------------+
```

### 3.2 Betting Slot Card
```
+------------------------------------+
| Slot 0              ⚔️ Sword       |  header
+------------------------------------+
| HP  100        DMG  10             |  stats (확정)
+------------------------------------+
|                                    |
|        🦞 (3rem, 배경)              |  visual area
|           ⚔️ (1.5rem, 겹침)        |  weapon overlay
|                                    |
+------------------------------------+
| 🎯 Bets: 3                        |  배팅 횟수 (타인 배팅 포함)
+------------------------------------+
| [1P] [10P] [100P]                  |  배팅 버튼 (로그인 시)
+------------------------------------+
```

### 3.3 Betting Buttons
- 3개 버튼: `1P`, `10P`, `100P`
- 클릭 시 해당 금액으로 배팅
- 이미 배팅한 슬롯은 버튼 비활성 + "Bet placed ✓" 표시
- 비로그인 시: "Log in to bet" 안내

### 3.4 Betting Count Display
- `🎯 Bets: N` — 해당 슬롯에 배팅한 총 횟수
- 금액은 비공개 (1P든 100P든 1회로 카운트)
- 실시간 업데이트 (WS or 10초 폴링)

### 3.5 내가 배팅한 슬롯 표시
```
+------------------------------------+
| Slot 2              🗡️ Dagger      |
+------------------------------------+
| HP  100        DMG  6              |
+------------------------------------+
|        🦞       ⚔️                 |
+------------------------------------+
| 🎯 Bets: 5                        |
+------------------------------------+
| ✅ You bet 10P                     |  내 배팅 표시 (본인만)
+------------------------------------+
```

---

## 4. API Design (Backend)

### POST /api/v1/games/:id/bet
```json
Request:
{
  "slot": 2,
  "amount": 10
}
// amount: 1 | 10 | 100 만 허용

Response:
{
  "id": "uuid",
  "game_id": "uuid",
  "slot": 2,
  "amount": 10,
  "created_at": "..."
}
```

### GET /api/v1/games/:id/bets
```json
Response:
{
  "bets": [
    { "slot": 0, "count": 3 },
    { "slot": 1, "count": 1 },
    { "slot": 2, "count": 5 }
  ],
  "my_bet": {
    "slot": 2,
    "amount": 10
  }
}
// count: 금액 무관 횟수만
// my_bet: 로그인 유저 본인의 배팅 (null if not bet)
```

---

## 5. DB Table

```sql
CREATE TABLE game_bets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id UUID NOT NULL REFERENCES games(id),
  user_id UUID NOT NULL REFERENCES users(id),
  slot SMALLINT NOT NULL,
  amount BIGINT NOT NULL CHECK (amount IN (1, 10, 100)),
  payout BIGINT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(game_id, user_id)  -- 게임당 1회 배팅
);
```

---

## 6. 정산 (Battle 종료 후)

| 결과 | 배당 |
|------|------|
| 1등 슬롯에 배팅 | 배팅금 x ? (확인 필요) |
| 그 외 | 배팅금 손실 |

---

## 7. WS Events (Optional)

```
// 배팅 발생 시 → 해당 게임 room에 브로드캐스트
io.to(`game:${gameId}`).emit('bet_update', {
  slot: 2,
  total_count: 6  // 금액 비공개, 횟수만
})
```

---

## 8. Open Questions

- [ ] 게임당 1회 배팅? 슬롯당 1회? 변경 가능?
- [ ] 정산 배당률 (고정 vs 풀 기반?)
- [ ] 무료 배팅 (비로그인) 지원 여부
- [ ] 배팅 최소 인원 (배팅 없으면 정산 skip?)

---

Please review and modify. Implementation will proceed after confirmation.
