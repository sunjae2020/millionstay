/** 캘리브레이션 전용 엔트리 — 계약 데이터 매퍼를 그대로 태워 실제 발급 경로를 검증한다. */
export { buildMltStandardLeasePdf } from "../../src/lib/documents/forms/mltStandardLeaseForm";
export { fillPdfForm } from "../../src/lib/documents/forms/pdfFormOverlay";
export { MLT_STANDARD_LEASE_FIELDS, MLT_STANDARD_LEASE_FORM } from "../../src/lib/documents/forms/mltStandardLeaseFields";

import { fillPdfForm } from "../../src/lib/documents/forms/pdfFormOverlay";
import { MLT_STANDARD_LEASE_FIELDS, MLT_STANDARD_LEASE_FORM } from "../../src/lib/documents/forms/mltStandardLeaseFields";
import type { FillOptions } from "../../src/lib/documents/forms/pdfFormOverlay";
import type { MltStandardLeaseValues } from "../../src/lib/documents/forms/mltStandardLeaseFields";

/** 좌표 확인용 — 필드 값을 직접 넣는다. */
export function fillMltStandardLease(values: MltStandardLeaseValues, opts: FillOptions = {}) {
  return fillPdfForm(MLT_STANDARD_LEASE_FORM, MLT_STANDARD_LEASE_FIELDS, values, opts);
}
