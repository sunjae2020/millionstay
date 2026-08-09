// host — 서비스 호스트 가입·심사 (host.*)
//
// 수신자는 청소·기사·정비 파트너(`service_hosts`)다. 대부분 현장에서 휴대폰으로 읽으므로
// **문장을 짧게, 할 일을 앞에** 둔다. 표는 최소한만 쓴다.
//
// 🚨 `sendHomestayHostEmail()` / `homestay.*` 템플릿과 혼동 금지. 그쪽은 **홈스테이
//    호스트(민박 제공자)** 용이고 여기는 **서비스 호스트**다. 이름만 비슷한 다른 대상이며,
//    Metheim 은 홈스테이 모듈이 없어 homestay.* 는 오히려 제거 대상이다.
// 한국어는 humanize-korean 통과본. 영어에서 재기계번역 금지.
import { vars } from "./_shared.mjs";

export const HOST_ONBOARDING = [
  {
    key: "host.application_received",
    name: "서비스 호스트 지원 접수",
    description: "청소·기사·정비 파트너 지원 접수 확인. 심사 기간과 다음 단계를 짧게 알린다.",
    vars: vars("recipient", "ref", "service_type", "review_days", "url"),
    tr: {
      ko: {
        subject: "지원서를 접수했습니다 ({{ref}})",
        body:
          `<p class="lead">{{recipient}} 님, 안녕하세요.</p>` +
          `<p>{{service_type}} 지원서를 잘 받았습니다.</p>` +
          `<table class="kv"><tr><td class="k">접수번호</td><td>{{ref}}</td></tr></table>` +
          `<p>{{review_days}}영업일 안에 결과를 알려 드립니다. 서류가 더 필요하면 그 전에 연락드리겠습니다.</p>` +
          `<a class="btn" href="{{url}}">지원 내역 보기</a>`,
      },
      en: {
        subject: "We've received your application ({{ref}})",
        body:
          `<p class="lead">Hi {{recipient}},</p>` +
          `<p>Your {{service_type}} application has arrived.</p>` +
          `<table class="kv"><tr><td class="k">Reference</td><td>{{ref}}</td></tr></table>` +
          `<p>We'll let you know within {{review_days}} business days. If we need more documents, we'll call before then.</p>` +
          `<a class="btn" href="{{url}}">View your application</a>`,
      },
      ja: {
        subject: "ご応募を受け付けました（{{ref}}）",
        body:
          `<p class="lead">{{recipient}} 様</p>` +
          `<p>{{service_type}} のご応募を確かに承りました。</p>` +
          `<table class="kv"><tr><td class="k">受付番号</td><td>{{ref}}</td></tr></table>` +
          `<p>{{review_days}} 営業日以内に結果をご連絡いたします。追加の書類が必要な場合は、それまでにご連絡いたします。</p>` +
          `<a class="btn" href="{{url}}">応募内容を確認する</a>`,
      },
      zh: {
        subject: "已收到您的申请（{{ref}}）",
        body:
          `<p class="lead">{{recipient}} 您好，</p>` +
          `<p>我们已收到您的{{service_type}}申请。</p>` +
          `<table class="kv"><tr><td class="k">受理编号</td><td>{{ref}}</td></tr></table>` +
          `<p>我们会在 {{review_days}} 个工作日内告知结果。如需补充材料，会提前与您联系。</p>` +
          `<a class="btn" href="{{url}}">查看申请内容</a>`,
      },
      th: {
        subject: "รับใบสมัครของท่านแล้ว ({{ref}})",
        body:
          `<p class="lead">เรียน คุณ{{recipient}}</p>` +
          `<p>เราได้รับใบสมัคร{{service_type}}ของท่านแล้ว</p>` +
          `<table class="kv"><tr><td class="k">หมายเลขรับเรื่อง</td><td>{{ref}}</td></tr></table>` +
          `<p>จะแจ้งผลภายใน {{review_days}} วันทำการ หากต้องการเอกสารเพิ่ม เราจะติดต่อก่อนหน้านั้น</p>` +
          `<a class="btn" href="{{url}}">ดูใบสมัคร</a>`,
      },
      vi: {
        subject: "Đã nhận hồ sơ của bạn ({{ref}})",
        body:
          `<p class="lead">Chào {{recipient}},</p>` +
          `<p>Chúng tôi đã nhận hồ sơ {{service_type}} của bạn.</p>` +
          `<table class="kv"><tr><td class="k">Số tiếp nhận</td><td>{{ref}}</td></tr></table>` +
          `<p>Chúng tôi sẽ báo kết quả trong {{review_days}} ngày làm việc. Nếu cần thêm giấy tờ, chúng tôi sẽ gọi trước.</p>` +
          `<a class="btn" href="{{url}}">Xem hồ sơ</a>`,
      },
    },
  },

  {
    key: "host.docs_requested",
    name: "서류 요청",
    description: "신분증·보험·자격증 요청. 왜 필요한지 한 줄로 밝혀 거부감을 줄인다.",
    vars: vars("recipient", "ref", "document_list", "due_date", "url"),
    tr: {
      ko: {
        subject: "서류를 올려 주세요 ({{ref}})",
        body:
          `<p class="lead">{{recipient}} 님, 안녕하세요.</p>` +
          `<p>심사를 마치려면 아래 서류가 필요합니다.</p>` +
          `<div class="box"><div class="label">필요한 서류</div><div>{{document_list}}</div></div>` +
          `<a class="btn" href="{{url}}">서류 올리기</a>` +
          `<p>{{due_date}}까지 올려 주시면 됩니다. 사진으로 찍어 올리셔도 됩니다. 글자만 또렷하면 괜찮습니다.</p>` +
          `<p class="muted">보험과 자격 서류는 현장에서 사고가 났을 때 보상받는 데 필요합니다. 심사 목적으로만 쓰고 보관 기간이 지나면 파기합니다.</p>`,
      },
      en: {
        subject: "Please upload your documents ({{ref}})",
        body:
          `<p class="lead">Hi {{recipient}},</p>` +
          `<p>We need the documents below to finish your application.</p>` +
          `<div class="box"><div class="label">What we need</div><div>{{document_list}}</div></div>` +
          `<a class="btn" href="{{url}}">Upload documents</a>` +
          `<p>Please upload by {{due_date}}. Photos are fine as long as the text is readable.</p>` +
          `<p class="muted">Insurance and licence documents are what let you be covered if something goes wrong on site. We use them only to assess your application and destroy them once the retention period ends.</p>`,
      },
      ja: {
        subject: "書類のアップロードをお願いいたします（{{ref}}）",
        body:
          `<p class="lead">{{recipient}} 様</p>` +
          `<p>審査を完了するために、下記の書類が必要です。</p>` +
          `<div class="box"><div class="label">必要な書類</div><div>{{document_list}}</div></div>` +
          `<a class="btn" href="{{url}}">書類をアップロードする</a>` +
          `<p>{{due_date}} までにお願いいたします。写真での提出でも構いません。文字がはっきり読めれば大丈夫です。</p>` +
          `<p class="muted">保険と資格の書類は、現場で事故が起きた際に補償を受けるために必要です。審査の目的にのみ使用し、保管期間の経過後に廃棄いたします。</p>`,
      },
      zh: {
        subject: "请上传材料（{{ref}}）",
        body:
          `<p class="lead">{{recipient}} 您好，</p>` +
          `<p>完成审核需要以下材料。</p>` +
          `<div class="box"><div class="label">所需材料</div><div>{{document_list}}</div></div>` +
          `<a class="btn" href="{{url}}">上传材料</a>` +
          `<p>请在 {{due_date}} 前上传。拍照上传亦可，只要文字清晰可辨。</p>` +
          `<p class="muted">保险与资质材料是现场发生事故时获得赔付的依据。这些材料仅用于审核，保存期限届满后即行销毁。</p>`,
      },
      th: {
        subject: "กรุณาอัปโหลดเอกสาร ({{ref}})",
        body:
          `<p class="lead">เรียน คุณ{{recipient}}</p>` +
          `<p>เพื่อให้การพิจารณาเสร็จสมบูรณ์ เราต้องขอเอกสารดังนี้</p>` +
          `<div class="box"><div class="label">เอกสารที่ต้องใช้</div><div>{{document_list}}</div></div>` +
          `<a class="btn" href="{{url}}">อัปโหลดเอกสาร</a>` +
          `<p>กรุณาอัปโหลดภายในวันที่ {{due_date}} ถ่ายภาพส่งก็ได้ ขอเพียงตัวอักษรอ่านออกชัดเจน</p>` +
          `<p class="muted">เอกสารประกันและใบอนุญาตจำเป็นสำหรับการรับความคุ้มครองหากเกิดอุบัติเหตุหน้างาน เราใช้เพื่อการพิจารณาเท่านั้นและจะทำลายเมื่อพ้นระยะเวลาเก็บรักษา</p>`,
      },
      vi: {
        subject: "Vui lòng tải giấy tờ lên ({{ref}})",
        body:
          `<p class="lead">Chào {{recipient}},</p>` +
          `<p>Để hoàn tất xét duyệt, chúng tôi cần các giấy tờ sau.</p>` +
          `<div class="box"><div class="label">Giấy tờ cần nộp</div><div>{{document_list}}</div></div>` +
          `<a class="btn" href="{{url}}">Tải giấy tờ lên</a>` +
          `<p>Xin tải lên trước ngày {{due_date}}. Chụp ảnh cũng được, miễn là chữ đọc rõ.</p>` +
          `<p class="muted">Giấy tờ bảo hiểm và chứng chỉ là căn cứ để bạn được bồi thường nếu có sự cố tại hiện trường. Chúng tôi chỉ dùng để xét duyệt và hủy khi hết thời hạn lưu trữ.</p>`,
      },
    },
  },

  {
    key: "host.approved",
    name: "서비스 호스트 승인",
    description: "승인 통보. 단가·정산 주기·포털 접속을 한 번에 알린다.",
    vars: vars("recipient", "ref", "service_type", "rate_terms", "settlement_cycle", "start_date", "url"),
    tr: {
      ko: {
        subject: "승인되었습니다 — 함께 일하게 되어 반갑습니다",
        body:
          `<p class="lead">{{recipient}} 님, 안녕하세요.</p>` +
          `<p>{{service_type}} 파트너로 승인되었습니다. {{start_date}}부터 작업을 배정받으실 수 있습니다.</p>` +
          `<table class="kv">` +
          `<tr><td class="k">파트너번호</td><td>{{ref}}</td></tr>` +
          `<tr><td class="k">단가</td><td>{{rate_terms}}</td></tr>` +
          `<tr><td class="k">정산 주기</td><td>{{settlement_cycle}}</td></tr></table>` +
          `<a class="btn" href="{{url}}">포털 접속하기</a>` +
          `<p>작업이 배정되면 메일로 알려 드립니다. 포털에서 일정과 정산 내역을 보실 수 있습니다.</p>` +
          `<p class="muted">첫 작업 전에 포털에서 계좌와 연락처를 확인해 주세요.</p>`,
      },
      en: {
        subject: "You're approved — welcome aboard",
        body:
          `<p class="lead">Hi {{recipient}},</p>` +
          `<p>You've been approved as a {{service_type}} partner. Jobs can be assigned to you from {{start_date}}.</p>` +
          `<table class="kv">` +
          `<tr><td class="k">Partner ID</td><td>{{ref}}</td></tr>` +
          `<tr><td class="k">Rate</td><td>{{rate_terms}}</td></tr>` +
          `<tr><td class="k">Paid</td><td>{{settlement_cycle}}</td></tr></table>` +
          `<a class="btn" href="{{url}}">Open the portal</a>` +
          `<p>We'll email you whenever a job comes in. Your schedule and earnings live in the portal.</p>` +
          `<p class="muted">Before your first job, check your bank details and phone number in the portal.</p>`,
      },
      ja: {
        subject: "承認されました — どうぞよろしくお願いいたします",
        body:
          `<p class="lead">{{recipient}} 様</p>` +
          `<p>{{service_type}} のパートナーとして承認されました。{{start_date}} より作業の割り当てをお受けいただけます。</p>` +
          `<table class="kv">` +
          `<tr><td class="k">パートナー番号</td><td>{{ref}}</td></tr>` +
          `<tr><td class="k">単価</td><td>{{rate_terms}}</td></tr>` +
          `<tr><td class="k">精算サイクル</td><td>{{settlement_cycle}}</td></tr></table>` +
          `<a class="btn" href="{{url}}">ポータルへ</a>` +
          `<p>作業が割り当てられましたら、メールでお知らせいたします。日程と精算内容はポータルでご確認いただけます。</p>` +
          `<p class="muted">初回の作業前に、ポータルで口座情報とご連絡先をご確認ください。</p>`,
      },
      zh: {
        subject: "已通过审核 — 欢迎加入",
        body:
          `<p class="lead">{{recipient}} 您好，</p>` +
          `<p>您已通过{{service_type}}合作伙伴审核，自 {{start_date}} 起可接受派单。</p>` +
          `<table class="kv">` +
          `<tr><td class="k">伙伴编号</td><td>{{ref}}</td></tr>` +
          `<tr><td class="k">单价</td><td>{{rate_terms}}</td></tr>` +
          `<tr><td class="k">结算周期</td><td>{{settlement_cycle}}</td></tr></table>` +
          `<a class="btn" href="{{url}}">进入门户</a>` +
          `<p>有派单时我们会邮件通知您。日程与结算明细可在门户中查看。</p>` +
          `<p class="muted">首次作业前，请在门户中核对银行账户和联系电话。</p>`,
      },
      th: {
        subject: "ผ่านการอนุมัติแล้ว — ยินดีต้อนรับ",
        body:
          `<p class="lead">เรียน คุณ{{recipient}}</p>` +
          `<p>ท่านได้รับอนุมัติเป็นพันธมิตร{{service_type}} และรับงานได้ตั้งแต่วันที่ {{start_date}}</p>` +
          `<table class="kv">` +
          `<tr><td class="k">รหัสพันธมิตร</td><td>{{ref}}</td></tr>` +
          `<tr><td class="k">อัตราค่าจ้าง</td><td>{{rate_terms}}</td></tr>` +
          `<tr><td class="k">รอบจ่ายเงิน</td><td>{{settlement_cycle}}</td></tr></table>` +
          `<a class="btn" href="{{url}}">เข้าสู่พอร์ทัล</a>` +
          `<p>เมื่อมีงานมอบหมาย เราจะแจ้งทางอีเมล ตารางงานและยอดเงินดูได้ในพอร์ทัล</p>` +
          `<p class="muted">ก่อนเริ่มงานแรก กรุณาตรวจสอบเลขบัญชีและเบอร์ติดต่อในพอร์ทัล</p>`,
      },
      vi: {
        subject: "Bạn đã được duyệt — chào mừng",
        body:
          `<p class="lead">Chào {{recipient}},</p>` +
          `<p>Bạn đã được duyệt làm đối tác {{service_type}}. Từ ngày {{start_date}}, bạn có thể nhận công việc.</p>` +
          `<table class="kv">` +
          `<tr><td class="k">Mã đối tác</td><td>{{ref}}</td></tr>` +
          `<tr><td class="k">Đơn giá</td><td>{{rate_terms}}</td></tr>` +
          `<tr><td class="k">Kỳ thanh toán</td><td>{{settlement_cycle}}</td></tr></table>` +
          `<a class="btn" href="{{url}}">Vào cổng đối tác</a>` +
          `<p>Có việc mới chúng tôi sẽ gửi email. Lịch làm và thu nhập xem trong cổng.</p>` +
          `<p class="muted">Trước ca đầu tiên, xin kiểm tra số tài khoản và số điện thoại trong cổng.</p>`,
      },
    },
  },

  {
    key: "host.rejected",
    name: "서비스 호스트 지원 반려",
    description: "반려 통보. 사람의 자격이 아니라 이번 조건이 맞지 않았다는 틀로 쓴다.",
    vars: vars("recipient", "ref", "reason", "reapply_after"),
    tr: {
      ko: {
        subject: "지원 결과 안내 ({{ref}})",
        body:
          `<p class="lead">{{recipient}} 님, 안녕하세요.</p>` +
          `<p>지원서를 검토했으나 이번에는 함께 일하기 어렵게 되었습니다.</p>` +
          `<div class="box"><div class="label">사유</div><div>{{reason}}</div></div>` +
          `<p>{{reapply_after}} 이후에는 다시 지원하실 수 있습니다. 조건이 달라지거나 필요한 자격을 갖추시면 그때 다시 검토하겠습니다.</p>` +
          `<p class="muted">시간 내어 지원해 주셔서 감사합니다.</p>`,
      },
      en: {
        subject: "About your application ({{ref}})",
        body:
          `<p class="lead">Hi {{recipient}},</p>` +
          `<p>We've been through your application and, this time, we're not able to take it forward.</p>` +
          `<div class="box"><div class="label">Reason</div><div>{{reason}}</div></div>` +
          `<p>You're welcome to apply again after {{reapply_after}}. If your circumstances change or you gain the qualification, we'll look at it again.</p>` +
          `<p class="muted">Thank you for taking the time to apply.</p>`,
      },
      ja: {
        subject: "ご応募の結果について（{{ref}}）",
        body:
          `<p class="lead">{{recipient}} 様</p>` +
          `<p>ご応募内容を拝見いたしましたが、今回はご一緒することが難しい結果となりました。</p>` +
          `<div class="box"><div class="label">理由</div><div>{{reason}}</div></div>` +
          `<p>{{reapply_after}} 以降であれば、改めてご応募いただけます。条件が変わられたり、必要な資格を取得されましたら、その際に再度検討いたします。</p>` +
          `<p class="muted">お時間を割いてご応募いただき、ありがとうございました。</p>`,
      },
      zh: {
        subject: "关于您的申请结果（{{ref}}）",
        body:
          `<p class="lead">{{recipient}} 您好，</p>` +
          `<p>我们审阅了您的申请，很遗憾这次未能与您合作。</p>` +
          `<div class="box"><div class="label">原因</div><div>{{reason}}</div></div>` +
          `<p>{{reapply_after}} 之后您可以重新申请。若条件有所变化或取得相应资质，我们会再次评估。</p>` +
          `<p class="muted">感谢您抽出时间申请。</p>`,
      },
      th: {
        subject: "แจ้งผลการสมัคร ({{ref}})",
        body:
          `<p class="lead">เรียน คุณ{{recipient}}</p>` +
          `<p>เราได้พิจารณาใบสมัครของท่านแล้ว แต่ครั้งนี้ยังไม่สามารถร่วมงานกันได้</p>` +
          `<div class="box"><div class="label">เหตุผล</div><div>{{reason}}</div></div>` +
          `<p>ท่านสมัครใหม่ได้ตั้งแต่ {{reapply_after}} เป็นต้นไป หากเงื่อนไขเปลี่ยนหรือได้คุณวุฒิที่ต้องการ เราจะพิจารณาอีกครั้ง</p>` +
          `<p class="muted">ขอบคุณที่สละเวลาสมัคร</p>`,
      },
      vi: {
        subject: "Kết quả hồ sơ ứng tuyển ({{ref}})",
        body:
          `<p class="lead">Chào {{recipient}},</p>` +
          `<p>Chúng tôi đã xem hồ sơ của bạn, nhưng lần này chưa thể cùng làm việc.</p>` +
          `<div class="box"><div class="label">Lý do</div><div>{{reason}}</div></div>` +
          `<p>Sau {{reapply_after}}, bạn có thể nộp lại. Nếu hoàn cảnh thay đổi hoặc bạn có được chứng chỉ cần thiết, chúng tôi sẽ xem xét lại.</p>` +
          `<p class="muted">Cảm ơn bạn đã dành thời gian ứng tuyển.</p>`,
      },
    },
  },
];
