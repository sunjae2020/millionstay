---
status: live
domain: 디자인
last_verified: 2026-08-11
---

# 외부 UI 저작물 표기

우리 코드에 들어온 외부 UI 저작물의 출처와 라이선스를 한곳에 모읍니다. 새 템플릿·블록·컴포넌트를
가져올 때마다 여기에 한 줄 추가하세요.

## Shadcn Space

- 출처: https://shadcnspace.com · https://github.com/shadcnspace/shadcnspace
- 라이선스: MIT — `Copyright (c) 2026 Shadcn Space`
- 사용 범위: CMS 블록 **레이아웃 변형(variant)** 의 구성 방식(섹션 헤더, 카드 배치,
  벤토 그리드, 분할 지표 카드, 요금제 강조)을 참고해 우리 렌더러에 다시 작성했습니다.
- 적용 파일:
  - [lib/cms-blocks/src/registry.ts](../lib/cms-blocks/src/registry.ts) — `variants` 정의 + `getDefaultVariant()`
  - [lib/cms-blocks/src/BlockRenderer.tsx](../lib/cms-blocks/src/BlockRenderer.tsx) — variant 렌더링
  - [artifacts/property-admin/src/pages/cms/BlockForm.tsx](../artifacts/property-admin/src/pages/cms/BlockForm.tsx) — 편집기 레이아웃 선택
- 가져오지 않은 것: 원본 코드 파일, 이미지 에셋, `@iconify/react`·`motion` 의존성.
  색·간격·모서리·서체는 전부 우리 `--cms-*` 디자인 토큰으로 치환했고, 스크롤 등장 효과는
  IntersectionObserver 기반 `Reveal`로 직접 구현했습니다(번들 증가 0).

## 기본 레이아웃 규칙

`BlockSpec.variants` 배열의 **첫 항목이 곧 기본값**입니다. 블록에 저장된 `style.variant`가 없으면
`getDefaultVariant()`가 첫 항목을 돌려주므로, 배열 순서를 바꾸는 것만으로 저장된 페이지 전체의
디자인이 바뀝니다 — 데이터 마이그레이션이 필요 없습니다.

| 블록 | 기본값 |
| --- | --- |
| 특징 목록 / 숫자 지표 / 서비스 소개 / 요금제 / FAQ / 고객 후기 / 팀 소개 | 새 레이아웃 |
| 히어로 배너 / CTA 배너 | 기존 레이아웃 (새 레이아웃은 선택) |

히어로 배너는 전면 사진 배치가 숙박·부동산에 더 맞고, CTA 배너의 라운드 패널은 섹션 배경을
'없음'으로 두어야 해서 기본값에서 제외했습니다. 편집기의 **모양 → 레이아웃**에서 블록마다
'기본 (이전)'을 고르면 즉시 되돌아갑니다.

## 가져오는 방법 (저장소를 클론하지 마세요)

블록 하나의 소스는 레지스트리 엔드포인트로 받습니다. 블록당 5~9KB이고, 임시 폴더에서 읽고 버립니다.

```bash
curl -s https://shadcnspace.com/r/<block-name>.json   # 예: testimonial-01
```

전체 목록은 `https://raw.githubusercontent.com/shadcnspace/shadcnspace/main/registry.json`
(약 270KB, 424개 항목)에 있습니다. 저장소 전체는 4.7MB짜리 Next.js 앱이라 우리 모노레포에
넣을 이유가 없습니다.
