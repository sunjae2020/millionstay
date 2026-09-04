---
status: live
domain: 디자인
last_verified: 2026-09-04
---

# 모바일 사진 첨부 — 전역 최적화 + 촬영 경로

사진 업로드는 46개 화면에 흩어져 있다(공간·건물 사진, 하자, 작업지시, 세대점검,
명함·신분증, CS 답변, 서류함, 영수증…). 화면마다 손으로 고치면 새로 생기는 화면은
또 빠지므로, **한 번 걸면 전부에 걸리는 층**을 하나 두고 그 위에 촬영 버튼을 얹었다.

## 1. 전역 최적화기 (`src/lib/photo.ts`)

`installPhotoOptimizer()` 를 각 앱 `main.tsx` 에서 한 번 호출한다. 파일 입력의
`change` 를 **document 캡처 단계**에서 가로채 사진을 줄인 뒤 같은 이벤트를 다시
쏜다. React 18 은 루트 컨테이너에 리스너를 위임하므로 document 캡처가 항상 먼저다
— 앱 핸들러는 이미 줄어든 파일만 본다. 코드는 한 줄도 바꾸지 않는다.

- **사진만 줄인다**: JPEG/HEIC/HEIF. PNG·SVG·GIF·WebP 는 손대지 않는다 — 로고·도장·
  파비콘은 투명도가 살아야 하고 JPEG 로 바꾸면 배경이 흰색이 된다. 폰 카메라 결과물은
  전부 JPEG/HEIC 라 이 규칙만으로 촬영 경로는 100% 덮인다.
- 긴 변 1600px · JPEG q0.82 (`DEFAULT_MAX_EDGE`). 판독을 태우는 이미지는 2400px
  (`OCR_MAX_EDGE`) — 명함·신분증은 글자가 남아야 한다.
- 개별 입력 제어: `data-no-photo-optimize`(끄기), `data-photo-max-edge="2400"`(상한).
- 디코딩 실패(HEIC 미지원 브라우저)나 오히려 커지는 경우 **원본을 그대로 넘긴다**.
  최적화 때문에 사진을 잃는 일은 없어야 한다.

실측(2400×2400 사진, headless Chrome):

| 입력 | 결과 |
| --- | --- |
| JPEG 5.38MB | **1.03MB** (5×) |
| PNG 17.3MB | 손대지 않음 |
| `data-photo-max-edge="2400"` JPEG | 2.50MB (해상도 유지) |
| `data-no-photo-optimize` | 원본 그대로 |
| 사진+PNG 혼합 | 사진만 축소, 핸들러 호출 1회 |

## 2. 촬영 버튼 (`src/components/CameraButton.tsx`)

`capture="environment"` 로 갤러리를 거치지 않고 후면 카메라를 연다. 터치 기기에서만
렌더한다(데스크톱에는 의미가 없다).

- `CameraButton` — 파일 배열을 받는 핸들러가 있는 화면용.
- `CameraInput` — 이미 `onChange={handleFileChange}` 로 도는 화면에 그대로 얹는 라벨형.
  핸들러를 리팩터링하지 않아도 된다.

붙인 곳: 공간/건물 사진, 하자(건별), 작업지시 사진, 서비스 결과 사진, 명함·신분증(2400px),
범용 서류함(EntityDocuments — 계약·계정·연락처·공간·작업지시·거래 어디서나), CS 답변,
파트너 3종 지원 문의, 게스트 포털 문의.

## 3. 거래내역 영수증 첨부

거래(`transactions`)에는 첨부 자리가 아예 없었다. 범용 문서 첨부에 `transaction` 을
등록하고(`ATTACHABLE_ENTITIES`), 거래 편집 창에 `EntityDocuments`(기본 doc_type
`receipt`, 보존 5년)를 얹었다. 저장된 거래에만 붙는다 — 첨부는 거래 id 를 요구한다.
