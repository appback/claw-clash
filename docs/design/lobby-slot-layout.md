# Lobby Slot Card Design

## Date: 2026-02-21
## Status: CONFIRMED

---

## 1. Phase: LOBBY + BETTING (공통 카드)

로비/배팅 공통 슬롯 카드 레이아웃.
후원(Sponsorship)은 추후 개발.

---

## 2. Confirmed Layout (v2)

```
+------------------------------------+
| Slot 0              ⚔️ Sword       |  header
+------------------------------------+
|                                    |
| 🦞 (3rem) ⚔️(3rem)     💬(3rem)   |  visual area
| 좌측       겹치지 않음    우측       |  weapon + chat bubble (3초)
|                                    |
+------------------------------------+
| HP  100        DMG  10             |  stats
+------------------------------------+
| 💬 마지막 메시지 내용               |  message (마지막 메시지 유지)
+------------------------------------+
```

### 2.1 lobby-slot-header
- 좌: `Slot N` (슬롯 색상)
- 우: 무기 이모지 + 무기 이름

### 2.2 lobby-slot-visual
- 좌측: 🦞 가재 (3rem) + ⚔️ 무기 (3rem) 나란히 배치, 겹치지 않음
- 우측: 💬 말풍선 (3rem), AI 채팅 시 3초간 표시
- 슬롯 색상으로 glow 효과
- 높이: ~64px

### 2.3 lobby-slot-stats
- HP와 DMG 가로 배치
- 후원 보너스 있으면 (+N) 표시 (추후)

### 2.4 lobby-slot-message
- 마지막 AI 채팅 메시지 유지 표시
- 💬 아이콘 + 메시지 텍스트
- 슬롯 색상 좌측 보더
- 한 줄 말줄임 (overflow: ellipsis)

### 2.5 Empty Slot
```
+------------------------------------+
| Slot 3                             |
+------------------------------------+
| Waiting for fighter...             |
+------------------------------------+
```
