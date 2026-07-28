#!/usr/bin/env python3
"""임대리스트 시트 프로파일 — 이관 전에 기대값을 뽑아 두고 이관 후 DB와 대조한다.

사용:  python3 profile_sheet.py "<CSV 경로>"

임포터와 같은 규칙으로 읽는다: 0행 = 그룹 헤더, 1행 = 서브 헤더, 2행부터 데이터,
완전히 동일한 행은 중복으로 보고 1건만 센다.
"""
import csv
import io
import re
import sys
from collections import Counter

ALIASES = {
    "성함": ["성함", "성명", "이름", "임차인", "세입자"],
    "호수": ["호수", "호실", "세대"],
    "보증금": ["보증금"],
    "월세": ["월세", "임대료", "월임대료"],
    "계약금": ["계약금"],
    "잔금": ["잔금"],
    "입주일": ["입주일", "입주"],
    "퇴거일": ["퇴거일", "퇴거", "만료일"],
    "입주청소": ["입주청소", "입주 청소"],
    "임대수수료": ["임대수수료 입금", "임대수수료", "임대 수수료"],
    "부동산수수료": ["부동산 수수료 입금", "부동산수수료", "부동산 수수료", "중개수수료"],
}


def norm(v):
    return re.sub(r"\s+", " ", str(v or "")).strip()


def money(v):
    nums = re.findall(r"[\d,]{3,}", v or "")
    return int(nums[-1].replace(",", "")) if nums else 0


def main(path):
    rows = list(csv.reader(io.StringIO(open(path, encoding="utf-8").read())))
    group, sub, body = rows[0], rows[1], rows[2:]

    col = {}
    for key, names in ALIASES.items():
        col[key] = next(
            (i for i, h in enumerate(group)
             if norm(h).replace(" ", "") in [n.replace(" ", "") for n in names]),
            -1,
        )
    # 수수료 블록은 입금액 서브컬럼을 쓴다
    for fee in ("임대수수료", "부동산수수료"):
        start = col[fee]
        if start >= 0:
            for i in range(start, min(start + 4, len(sub))):
                if norm(sub[i]).replace(" ", "") == "입금액":
                    col[fee] = i
                    break

    months = {}
    for i, h in enumerate(sub):
        m = re.match(r"^(\d{1,2})\s*월$", norm(h))
        if m:
            months.setdefault(int(m.group(1)), i)

    year = next((m.group(1) for h in group if (m := re.search(r"(20\d{2})\s*년", norm(h)))), "?")

    seen, uniq, dup = set(), [], 0
    for r in body:
        if not any(norm(x) for x in r):
            continue
        key = tuple(norm(x) for x in r)
        if key in seen:
            dup += 1
            continue
        seen.add(key)
        uniq.append(r)

    def cell(r, i):
        return r[i] if 0 <= i < len(r) else ""

    print(f"연도            : {year}")
    print(f"고유 행         : {len(uniq)}  (중복 제외 {dup}행)")
    print(f"찾은 컬럼       : " + ", ".join(f"{k}={v}" for k, v in col.items() if v >= 0))
    missing = [k for k, v in col.items() if v < 0]
    if missing:
        print(f"⚠️  못 찾은 컬럼 : {', '.join(missing)} → HEADER_ALIASES 확인")
    print(f"월별 컬럼       : {sorted(months)}")
    print(f"고유 성함       : {len(set(norm(cell(r, col['성함'])) for r in uniq))}")

    for label in ("보증금", "월세", "계약금", "잔금", "입주청소", "임대수수료", "부동산수수료"):
        if col.get(label, -1) >= 0:
            print(f"{label:<15}: {sum(money(cell(r, col[label])) for r in uniq):,}")

    paid = unpaid = deduct = 0
    for r in uniq:
        for idx in months.values():
            v = norm(cell(r, idx))
            if not v or v == "-":
                continue
            if "미납" in v:
                unpaid += 1
            elif "보증금에서 차감" in v or "보증금 차감" in v:
                deduct += 1
            else:
                paid += 1
    print(f"월별 셀         : 입금 {paid} / 미납 {unpaid} / 보증금차감 {deduct} = {paid + unpaid + deduct}")

    units = Counter(norm(cell(r, col["호수"])) for r in uniq)
    repeated = {u: c for u, c in units.items() if c > 1}
    if repeated:
        print(f"같은 호실 여러 계약: {repeated}  (재계약/승계 — 입주일로 구분됨)")


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(1)
    main(sys.argv[1])
