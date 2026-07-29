# Metheim 세대(호실) 인벤토리 기준

**정본 세대 수: 269세대** — 메트하임 여수(`properties.id = 1`) 관리대장 기준.
대시보드·리포트·점유율 등 모든 집계는 이 269세대만 세야 한다.

최종 정리: 2026-07-28

## 1. spaces 테이블에 실제로 들어 있는 것

| 구분 | 건수 | space id | 성격 |
| --- | --- | --- | --- |
| 실제 호실 (property_id=1) | **269** | 7–275 | 관리대장 269세대. 각 행은 `parent_space_id` → 타입 행을 가리킨다 |
| 타입 상위 공간 | 8 | 276–283 | `A타입 / A-1타입 / B타입 / C타입 / D타입 / D-1타입 / E타입 / E-1타입`. 임대 단위가 아니라 **타입 마스터**(면적·기준 임대료 보관용) |
| 오너 포털 데모 호실 | 11 | 284–294 | 2026-07-26 시드로 생성 → **2026-07-28 소프트 삭제(보관함)** |

## 2. 데모 호실 11개가 생긴 이유와 처리

[tenants/metheim/owner-sample-properties.seed.sql](../../../tenants/metheim/owner-sample-properties.seed.sql) 이
오너 포털 재설계 당시 `demo.owner@metheim.com`(신영부동산신탁112) 대시보드에 그릴 데이터를 만들려고
**가상 건물 3동 + 호실 11개 + 예약 7 / 계약 7 / 인보이스 52 / 문서 17건**을 넣었다.

- `여수 웰카운티 아파트`(property 2) — 101동 1203·1204·1401·PH01호
- `여수 디오션 오피스텔`(property 3) — A동 908·1005·1210·1503호
- `여수 엑스포 레지던스`(property 4) — 201·305·402호

여수 메트하임에는 `101동`, `A동` 같은 동 이름이 없다. 즉 **기존 269세대와 대응되는 호실이 없어 병합 대상이 아니다.**
그래서 병합 대신 [tenants/metheim/archive-owner-sample-properties.sql](../../../tenants/metheim/archive-owner-sample-properties.sql)
로 관련 레코드에 `deleted_at`을 찍어 보관함으로 내렸다(되돌리기는 같은 파일 하단 롤백 블록).

시드 파일의 멱등성 가드는 `description = 'SAMPLE-OWNER-SEED'` 행의 존재만 보므로, 소프트 삭제 후에도
시드를 다시 실행해도 재생성되지 않는다.

## 3. 타입 상위 공간을 집계에서 빼는 규칙

타입 8행은 Spaces 목록에서는 **계속 보이고 편집도 가능**해야 한다(면적·기준 임대료 마스터).
빠지는 곳은 대시보드와 리포트다.

판별 규칙 — **타입 컨테이너 = 살아 있는 자식이 `parent_space_id`로 가리키면서, 그 자식의
`custom_type_name`이 부모의 `name`과 같은 행.**

```sql
not exists (
  select 1 from spaces c
   where c.parent_space_id = s.id
     and c.deleted_at is null
     and c.custom_type_name = s.name
)
```

`custom_type_name = name` 조건이 핵심이다. MillionStay 본진 데이터도 `parent_space_id`를 쓰지만
거기서는 부모가 "Entire Apartment"(그 자체로 임대되는 공간)이고 자식 방들이 부모를 타입으로 부르지
않는다. 따라서 이 규칙은 본진 집계를 건드리지 않는다(검증: 본진 33 → 33, 메트하임 277 → 269).

구현 위치:

| 레이어 | 파일 | 적용 지점 |
| --- | --- | --- |
| API | [artifacts/api-server/src/lib/unitScope.ts](../../../artifacts/api-server/src/lib/unitScope.ts) | `countableUnitFilter` SSOT |
| API | [artifacts/api-server/src/routes/dashboard.ts](../../../artifacts/api-server/src/routes/dashboard.ts) | `/v1/dashboard/stats`, `/v1/dashboard/overview/kpis`, `/v1/dashboard/floor-board` |
| Admin | [artifacts/property-admin/src/lib/unitScope.ts](../../../artifacts/property-admin/src/lib/unitScope.ts) | `unitSpaces()` — 목록 응답에서 클라이언트 판별 |
| Admin | dashboard `OverviewTab` / `OperationsTab` / `ReservationsTab` | 세대 수 타일, 점유율, 예약 생성 시 호실 선택 |

클라이언트 판별을 위해 `GET /v1/spaces` 응답에 `custom_type_name`을 추가했다(OpenAPI 스펙 +
api-zod/api-client 재생성 포함).

## 4. 새 집계 화면을 만들 때

- 세대 수·점유율·층별 보드 등 **호실을 세는 화면은 반드시** 서버는 `countableUnitFilter`,
  프론트는 `unitSpaces()`를 거친다. 원본 목록을 그대로 `.length` 하지 않는다.
- Spaces 목록, 상세, 프로퍼티 상세의 하위 공간 탭은 예외 — 타입 행을 그대로 보여준다(마스터 편집 대상).
- 기대값: 메트하임 여수 대시보드 세대 수 = **269**. 이 숫자가 277 또는 280으로 보이면 위 규칙이
  빠진 화면이 있다는 뜻이다.
