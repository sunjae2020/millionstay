---
name: lease-list-migration
description: Metheim 여수 "임대리스트" 엑셀/CSV(연도별)를 연락처·계정·계약서·관련비용·월세 인보이스로 이관한다. 트리거 — "임대리스트 마이그레이션", "2023/2024/2025년 임대리스트 넣어줘", "임대 엑셀 데이터 이관", "세입자 자료 업로드", "월세 입금 현황 등록". 기존 세입자·건물주는 새로 만들지 않고 기존 레코드에 연결·보강한다.
---

# 임대리스트 데이터 마이그레이션

연도별 임대리스트 시트를 운영 테이블로 이관하는 절차. 2026년 시트로 확립했고
(98계약·213 관련비용·359 월세 인보이스), 2023~2025 시트도 같은 절차로 처리한다.

## 절대 원칙 — 중복 금지

과거 시트에는 이미 이관된 세입자·건물주·계약이 그대로 다시 등장한다. **새로 만들지
않고 기존 레코드에 연결·보강한다.** 스크립트가 아래 신원 규칙으로 자동 처리한다.

| 대상 | 신원 판정 | 이미 있으면 |
|---|---|---|
| 연락처 | 성+이름 + 휴대폰 (한쪽 번호가 비면 이름만으로 동일인) | 빈 칸만 채움(덮어쓰지 않음) |
| 계정 | 같은 이름 (타입 무관 — 건물주 계정이 세입자여도 재사용) | 연락처 연결 + 빈 칸만 채움 |
| 계약 | **같은 호실 + 같은 입주일** | 시트에 값이 있는 칸만 채움, 종료일은 더 나중 값이 승리 |
| 관련비용 | 계약+항목+송금일+금액 | 건너뜀 |
| 월세 인보이스 | 계약당 월 1건 | 건너뜀 |
| 세대 상태 | — | 시트가 아니라 DB의 최신 계약으로 재계산 |

즉 2024년에 시작해 2026년까지 이어진 계약은 시트 3장에 나와도 **계약 1건**으로 남고,
같은 시트를 다시 돌려도 아무것도 변하지 않는다(검증 완료).

## 실행 절차

### 0. 준비
```bash
cd /Users/sunkim/Claude-Code/Millionstay
set -a && source .env.local && set +a          # METHEIM_DATABASE_URL / PRIMARY_DATABASE_URL
```
원본 CSV는 저장소에 커밋하지 않는다(성명·연락처·주소 = 개인정보).

### 1. 시트 프로파일 (이관 전 기대값 계산)
행 수, 고유 성함, 금액 합계, 월별 셀 분포를 먼저 뽑아 두고 이관 후 대조한다.
```bash
python3 .claude/skills/lease-list-migration/references/profile_sheet.py "<CSV 경로>"
```

### 2. Dry-run (기본값 — 아무것도 쓰지 않음)
```bash
cd artifacts/api-server
DATABASE_URL="$METHEIM_DATABASE_URL" node scripts/import-lease-list.mjs \
  --csv "<CSV 경로>" [--year 2025] --report /tmp/dryrun.json
```
리포트에서 반드시 확인할 것:
- `db.matching.unit_not_found` = 0 (호수 매칭 실패 없음)
- `db.matching.no_move_in_date` = 0 (입주일 없으면 계약 신원 판정 불가 → 원본 확인)
- `db.report.contracts_linked` = `rows_in_scope`
- `db.matching.matched_existing_other_year` — 다른 연도 시트에서 이미 들어온 계약 수
  (과거 시트를 넣을 때 커야 정상. 0이면 신원 규칙이 안 걸린 것이니 입주일을 의심)
- `parsed.related_costs` / `parsed.monthly_entries` 가 1단계 프로파일과 일치
- `db.contacts` 샘플의 성/이름 분리와 주소 분해가 정상

### 3. 반영
```bash
DATABASE_URL="$METHEIM_DATABASE_URL" node scripts/import-lease-list.mjs \
  --csv "<CSV 경로>" --commit --report /tmp/commit.json
```
`--cleanup-tests` 는 최초 1회만(테스트/샘플 데이터 정리). 파트너 포털 데모 계정까지
지우려면 `--purge-demo` — 데모 로그인이 깨지므로 기본은 유지다.

### 4. 사후 검증 (필수)
```bash
psql "$(printf '%s' "$METHEIM_DATABASE_URL" | sed -E 's/[?&](pgbouncer|uselibpqcompat|sslnegotiation)=[^&]*//g')" \
  -f .claude/skills/lease-list-migration/references/verify.sql
```
모든 항목이 0이어야 한다. 하나라도 걸리면 원인을 고치고 다시 돌린다(멱등).
1단계 프로파일 합계와 DB 합계도 직접 대조한다.

## 시트 필드가 다를 때

컬럼은 위치가 아니라 **헤더 문구**로 찾는다(`HEADER_ALIASES` in
`artifacts/api-server/scripts/import-lease-list.mjs`). 새 표현이 나오면 별칭만 추가한다.
```js
name: ["성함", "성명", "이름", "임차인", "세입자"],   // ← 여기에 추가
```
- 필수 컬럼은 `성함`, `호수` 둘뿐 — 없으면 즉시 에러로 알려준다.
- 월별 입금 컬럼은 서브헤더 `1월`…`12월` 로 찾고, 연도는 `YYYY년 월세 입금 현황`
  헤더에서 읽는다. 헤더에 연도가 없으면 `--year` 로 넘긴다.
- 없는 컬럼은 빈 값으로 처리되고, 파싱 못 한 원문은 계약 비고에 `… 원문:` 으로 보존된다.

## 알려진 함정

- **원격 DB 왕복이 느리다** (서울 풀러, 쿼리당 ~1초). 행별 쿼리 방식은 100행에 50분+.
  스크립트는 전체를 단일 왕복 SQL로 실행한다(10초). 이 구조를 깨지 말 것.
- **금액 컬럼은 numeric** 이어야 한다. Metheim DB는 과거 `real` 이었고 합계에서 오차가
  났다(₩7.3억에 32원). 마이그레이션 0027로 정리됨 — 새 테넌트 DB도 확인할 것.
- **월세 자동청구는 납입일이 계약 기간 안에 있을 때만** 청구한다. 월 겹침만 보면 종료
  월에 한 달치가 과다 청구된다(과거 18건 발생 → 수정 완료).
- **테스트 데이터 정리 시 인보이스도 함께** 소프트삭제해야 한다(계약만 지우면 재무
  대시보드 수치가 부풀려짐).
- **`--commit` 은 단일 트랜잭션**이라 실패 시 전부 롤백된다. dry-run이 통과하면 커밋도
  통과한다고 보면 된다.

## 이관 후 자동으로 붙는 것들

이관된 계약은 아래 기능이 바로 동작한다(별도 작업 불필요).
- 계약 상세 **월세 입금** 탭 — 12개월 현황, 영수증 PDF, 입금 처리(회계 GL 반영)
- **월세 자동 청구** — `LEASE_RENT_INVOICES_ENABLED`, 매일 03:00, 계약별 납입일 기준
- 재무 대시보드 **월세 미납** 카드
- 보증금 차감 → **보증금 정산서 초안** (계약 상세 버튼)
- 설정 → 임대 수수료 기준표 **대사** (기준액 vs 실지급)

## 코드를 고쳤다면 배포

`git push origin HEAD:main` 이 CI 자동배포를 태운다(api-server/Railway, admin·Metheim
프론트/Vercel). 로컬 브랜치가 main보다 뒤처져 있으면 **격리 워크트리를 origin/main에서**
만들어 변경을 재적용하고 typecheck/build 후 푸시한다 — 다른 세션의 미커밋 변경이 섞이지
않게 한다.
