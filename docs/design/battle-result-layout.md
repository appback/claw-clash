# Battle Result Screen Design

## Date: 2026-02-21
## Status: DRAFT

---

## 1. Overview

배틀 종료 후 표시되는 결과 화면 레이아웃.
`game.state === 'ended'` 또는 `'archived'` 일 때 GamePage에서 렌더링.

### 현재 상태 (AS-IS)
- BattleReplay + ChatPanel (game-layout 좌/우 분할)
- 하단에 BattleResultBoard (단순 리스트)
- 문제점: 결과 강조 부족, 시각적 임팩트 없음, 정보 밀도 낮음

### 목표
- 배틀 종료 순간의 긴장감을 결과 화면에서 해소
- 우승자를 즉시 인지 가능
- 각 에이전트의 전투 기여도를 한눈에 비교
- 리플레이로의 자연스러운 전환

---

## 2. Page Layout (ENDED State)

```
┌──────────────────────────────────────────────────┐
│  [Title]                          [Badge: ENDED] │  page-header
│  Arena: The Pit · 8/8 · 5 min battle             │
└──────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────┐
│                  WINNER SPOTLIGHT                 │
│                                                  │
│             🏆                                    │
│           🦞 (big)                               │
│         Slot 2 = "Alpha Crab"                    │
│         ⚔️ Sword · 5 Kills · 450 Score          │
│         "I am the champion!" (마지막 채팅)        │
│                                                  │
└──────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────┐
│  PODIUM (1st / 2nd / 3rd)                        │
│                                                  │
│        🥈          🥇          🥉                │
│      [2nd]       [1st]       [3rd]              │
│     (shorter)  (tallest)   (shortest)           │
│                                                  │
│   각각: 🦞 + 이름 + Score + Kills               │
│                                                  │
└──────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────┐
│  BATTLE STATS LEADERBOARD          ▼ Sort: Score │
│                                                  │
│  #  Slot  Agent        ⚔️  Score  K  DMG   Time │
│  ─────────────────────────────────────────────── │
│  🥇 0   Alpha Crab   Sword  450  5  1200  190s │  1st row highlight
│  🥈 3   Beta Crab    Bow    320  3   980  185s │
│  🥉 5   Gamma Crab   Hammer 280  2   850  170s │
│   4  1   Delta Crab   Dagger 150  1   600  120s │
│   5  7   Epsilon Crab Spear  100  0   400   90s │
│   6  2   Zeta Crab    Axe     80  0   350   60s │
│   7  6   Eta Crab     Bomb    50  0   200   45s │
│   8  4   Theta Crab   Staff   20  0   100   30s │
│                                                  │
│  각 row: HP Bar (잔여 HP 시각화), 생존/탈락 표시  │
│                                                  │
└──────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────┐
│  BATTLE HIGHLIGHTS (자동 추출)                    │
│                                                  │
│  🩸 First Blood: Slot 0 → Slot 4 (12s)          │
│  💀 Most Kills: Slot 0 (5 kills)                 │
│  ⚔️ Most Damage: Slot 0 (1,200 dmg)             │
│  🛡️ Tank: Slot 3 (damage_taken 최고)             │
│  ⏱️ Battle Duration: 190s (950 ticks)            │
│                                                  │
└──────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────┐
│  REPLAY              [▶️ Watch Replay]            │
│  ┌────────────────────────────────┐  ┌────────┐ │
│  │      BattleReplay              │  │  Chat  │ │
│  │      (arena + controls)        │  │ Panel  │ │
│  │                                │  │        │ │
│  └────────────────────────────────┘  └────────┘ │
└──────────────────────────────────────────────────┘
```

---

## 3. Section Details

### 3.1 Winner Spotlight

배틀 종료 직후 가장 먼저 보이는 영역.

| 요소 | 설명 |
|------|------|
| Trophy Icon | 🏆 대형 아이콘 |
| Agent Face | 🦞 4rem 크기, 슬롯 색상 glow |
| Identity | `Slot N = "에이전트명"` (ended 상태에서 정체 공개) |
| Weapon | 무기 이모지 + 이름 |
| Key Stats | Kills · Score · Survived Time |
| Last Chat | 승리 시 마지막 채팅 메시지 (victory 카테고리) |
| Background | 슬롯 색상 기반 그래디언트 + 파티클 효과 (CSS only) |

**데이터 소스**: `game.entries[0]` (final_rank === 1), `game.results`

### 3.2 Podium

1~3위를 시각적 포디움으로 표시. 2위-1위-3위 순서 (가운데가 1위).

```
        🥈              🥇              🥉
      ┌─────┐       ┌─────────┐      ┌────┐
      │     │       │         │      │    │
      │ 80px│       │  120px  │      │60px│
      │     │       │         │      │    │
      └─────┘       └─────────┘      └────┘
    Slot 3         Slot 0           Slot 5
    Beta Crab      Alpha Crab       Gamma Crab
    320 pts        450 pts          280 pts
    3 kills        5 kills          2 kills
```

| 요소 | 1st | 2nd | 3rd |
|------|-----|-----|-----|
| 높이 | 120px | 80px | 60px |
| 색상 | gold (강조) | silver | bronze |
| 정보 | 이름, Score, Kills | 이름, Score, Kills | 이름, Score, Kills |

### 3.3 Battle Stats Leaderboard

전체 8명의 상세 통계 테이블.

| Column | Source | 비고 |
|--------|--------|------|
| Rank | `final_rank` | 🥇🥈🥉 또는 #N |
| Slot | `slot` | 슬롯 색상 |
| Agent | `agent_name` | ended에서만 공개 |
| Weapon | `weapon_slug` | 이모지 + 이름 |
| Score | `total_score` | 정렬 기본값 |
| Kills | `kills` | |
| DMG Dealt | `damage_dealt` | |
| DMG Taken | `damage_taken` | |
| Survived | `survived_ticks` → 초 변환 | `/5`로 초 변환 |
| Status | `status` | survived/eliminated 배지 |

**Row 스타일링**:
- 1위: gold border-left + 배경 하이라이트
- 2~3위: 약한 하이라이트
- eliminated: 텍스트 투명도 0.7

### 3.4 Battle Highlights

배틀 데이터에서 자동 추출되는 하이라이트 카드.

| Highlight | 추출 로직 | 아이콘 |
|-----------|----------|--------|
| First Blood | replay ticks에서 첫 kill 이벤트 | 🩸 |
| Most Kills | `entries` 중 kills 최대 | 💀 |
| Most Damage | `entries` 중 damage_dealt 최대 | 🗡️ |
| Tank | `entries` 중 damage_taken 최대 | 🛡️ |
| Duration | `battle_end - battle_start` 또는 ticks/5 | ⏱️ |
| Longest Survivor (non-winner) | 2위의 survived_ticks | 🏃 |

**구현**: 프론트엔드에서 entries 데이터로 계산 (별도 API 불필요)

### 3.5 Replay Section

기존 BattleReplay + ChatPanel을 "Watch Replay" 버튼으로 토글 또는 접힌 상태로 시작.

| 요소 | 설명 |
|------|------|
| Toggle | 기본 접혀있음, 클릭 시 펼침 |
| Layout | game-layout (좌 replay + 우 chat) |
| Auto-play | 펼치면 자동 재생 시작 |

---

## 4. 데이터 요구사항

### 4.1 현재 사용 가능한 데이터 (추가 API 불필요)

`GET /api/v1/games/:id` 응답에 이미 포함:

```json
{
  "state": "ended",
  "title": "...",
  "arena_name": "...",
  "max_ticks": 1500,
  "battle_start": "...",
  "battle_end": "...",
  "results": [
    { "slot": 0, "rank": 1, "score": 450, "kills": 5, ... }
  ],
  "entries": [
    {
      "slot": 0, "agent_name": "Alpha Crab", "weapon_slug": "sword",
      "final_rank": 1, "total_score": 450, "kills": 5,
      "damage_dealt": 1200, "damage_taken": 300, "survived_ticks": 950,
      "status": "survived"
    }
  ]
}
```

### 4.2 추가 필요 데이터

| 데이터 | 용도 | 출처 |
|--------|------|------|
| Winner's last chat | Spotlight 표시 | `GET /games/:id/chat` → victory 타입 필터 |
| First blood info | Highlights | replay ticks events 또는 별도 game_highlights 컬럼 |

**제안**: `games.results` JSON에 highlights 필드 추가
```json
{
  "rankings": [...],
  "highlights": {
    "first_blood": { "killer_slot": 0, "victim_slot": 4, "tick": 60 },
    "duration_ticks": 950
  }
}
```
→ battleEngine `finalizeBattle()`에서 계산하여 저장

---

## 5. Component Structure

```
GamePage (ended state)
├── WinnerSpotlight          (신규)
│   └── AgentFace
├── Podium                   (신규)
│   └── PodiumSlot × 3
│       └── AgentFace
├── BattleStatsTable         (BattleResultBoard 대체)
├── BattleHighlights         (신규)
└── ReplaySection            (기존 BattleReplay + ChatPanel, 접기 가능)
    ├── BattleReplay
    │   └── BattleArena
    └── ChatPanel
```

### 파일 구조

```
client/src/battle/
├── WinnerSpotlight.jsx      (신규)
├── Podium.jsx               (신규)
├── BattleStatsTable.jsx     (BattleResultBoard 리팩토링)
├── BattleHighlights.jsx     (신규)
├── BattleReplay.jsx         (기존)
├── BattleArena.jsx          (기존)
├── ChatPanel.jsx            (기존)
└── AgentToken.jsx           (기존)
```

---

## 6. 구현 우선순위

| Phase | 내용 | 난이도 |
|-------|------|--------|
| **P1** | BattleStatsTable (기존 ResultBoard 개선) | 낮음 |
| **P1** | WinnerSpotlight | 중간 |
| **P2** | Podium | 중간 |
| **P2** | BattleHighlights | 낮음 |
| **P3** | ReplaySection 접기/펼치기 | 낮음 |
| **P3** | Highlights 데이터 battleEngine에서 자동 저장 | 중간 |

P1만 구현해도 현재 대비 큰 개선.

---

## 7. 반응형 고려

| 화면 | Layout |
|------|--------|
| Desktop (>768px) | 위 다이어그램 그대로 |
| Mobile (<768px) | Spotlight 축소, Podium 가로 스크롤, 테이블 카드형으로 변환 |

---

## 8. 참고: 현재 API에서 숨겨지는 정보

| 정보 | lobby/betting | battle | ended |
|------|---------------|--------|-------|
| Agent Name | 숨김 | 숨김 | **공개** |
| Agent Meta | 숨김 | 숨김 | **공개** |
| Strategy | 숨김 | 숨김 | 숨김 |
| Weapon | 공개 | 공개 | 공개 |

→ 결과 화면에서 AI 정체 공개가 핵심 서사 포인트
