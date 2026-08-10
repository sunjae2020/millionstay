// customer — 신청서 접수·심사 (application.*)
//
// 신청자가 폼을 낸 순간부터 승인/반려까지의 안내. 접수번호({{ref}})는 모든 단계에서
// 같은 값을 쓴다 — 고객이 문의할 때 대는 유일한 식별자다.
// 한국어는 humanize-korean 통과본. 영어에서 재기계번역 금지.
import { vars } from "./_shared.mjs";

export const CUSTOMER_APPLICATION = [
  {
    key: "application.received",
    name: "신청서 접수 확인",
    description: "신청서가 제출된 직후 자동 발송. 접수번호와 다음 절차·소요 기간을 알린다.",
    vars: vars("recipient", "ref", "application_type", "date", "url", "review_days"),
    tr: {
      ko: {
        subject: "신청서가 접수되었습니다 ({{ref}})",
        body:
          `<p class="lead">{{recipient}} 님, 안녕하세요.</p>` +
          `<p>{{application_type}} 신청서를 잘 받았습니다. 접수번호는 아래와 같습니다.</p>` +
          `<div class="box"><div class="label">접수번호</div><div class="ref">{{ref}}</div></div>` +
          `<p>담당자가 내용을 확인한 뒤 {{review_days}}영업일 안에 결과를 알려 드립니다. 서류가 더 필요하면 그 전에 따로 연락드리겠습니다.</p>` +
          `<a class="btn" href="{{url}}">신청 내역 보기</a>` +
          `<p class="muted">문의하실 때 접수번호를 알려 주시면 더 빠르게 확인해 드릴 수 있습니다.</p>`,
      },
      en: {
        subject: "We've received your application ({{ref}})",
        body:
          `<p class="lead">Hi {{recipient}},</p>` +
          `<p>Your {{application_type}} application has arrived safely. Here is your reference number.</p>` +
          `<div class="box"><div class="label">Reference</div><div class="ref">{{ref}}</div></div>` +
          `<p>Someone will go through it and come back to you within {{review_days}} business days. If we need more documents, we'll get in touch before then.</p>` +
          `<a class="btn" href="{{url}}">View your application</a>` +
          `<p class="muted">Quoting the reference number when you contact us helps us find your file faster.</p>`,
      },
      ja: {
        subject: "お申し込みを受け付けました（{{ref}}）",
        body:
          `<p class="lead">{{recipient}} 様</p>` +
          `<p>{{application_type}} のお申込書を確かに承りました。受付番号は下記のとおりです。</p>` +
          `<div class="box"><div class="label">受付番号</div><div class="ref">{{ref}}</div></div>` +
          `<p>担当者が内容を確認のうえ、{{review_days}} 営業日以内に結果をご連絡いたします。追加の書類が必要な場合は、それまでに別途ご連絡いたします。</p>` +
          `<a class="btn" href="{{url}}">お申し込み内容を確認する</a>` +
          `<p class="muted">お問い合わせの際に受付番号をお知らせいただけますと、すぐにお調べできます。</p>`,
      },
      zh: {
        subject: "已收到您的申请（{{ref}}）",
        body:
          `<p class="lead">{{recipient}} 您好，</p>` +
          `<p>我们已收到您提交的{{application_type}}申请。受理编号如下。</p>` +
          `<div class="box"><div class="label">受理编号</div><div class="ref">{{ref}}</div></div>` +
          `<p>专员核对后会在 {{review_days}} 个工作日内答复您。如需补充材料，我们会提前与您联系。</p>` +
          `<a class="btn" href="{{url}}">查看申请内容</a>` +
          `<p class="muted">咨询时提供受理编号，我们可以更快地为您查询。</p>`,
      },
      th: {
        subject: "ได้รับใบสมัครของท่านแล้ว ({{ref}})",
        body:
          `<p class="lead">เรียน คุณ{{recipient}}</p>` +
          `<p>เราได้รับใบสมัคร{{application_type}}ของท่านเรียบร้อยแล้ว หมายเลขรับเรื่องมีดังนี้</p>` +
          `<div class="box"><div class="label">หมายเลขรับเรื่อง</div><div class="ref">{{ref}}</div></div>` +
          `<p>เจ้าหน้าที่จะตรวจสอบและแจ้งผลให้ทราบภายใน {{review_days}} วันทำการ หากต้องการเอกสารเพิ่มเติม เราจะติดต่อท่านก่อนหน้านั้น</p>` +
          `<a class="btn" href="{{url}}">ดูรายละเอียดใบสมัคร</a>` +
          `<p class="muted">เมื่อติดต่อสอบถาม กรุณาแจ้งหมายเลขรับเรื่องเพื่อให้เราค้นหาข้อมูลได้เร็วขึ้น</p>`,
      },
      vi: {
        subject: "Đã nhận hồ sơ của Quý khách ({{ref}})",
        body:
          `<p class="lead">Kính gửi {{recipient}},</p>` +
          `<p>Chúng tôi đã nhận được hồ sơ {{application_type}} của Quý khách. Số tiếp nhận như sau.</p>` +
          `<div class="box"><div class="label">Số tiếp nhận</div><div class="ref">{{ref}}</div></div>` +
          `<p>Nhân viên phụ trách sẽ xem xét và phản hồi trong vòng {{review_days}} ngày làm việc. Nếu cần bổ sung giấy tờ, chúng tôi sẽ liên hệ trước.</p>` +
          `<a class="btn" href="{{url}}">Xem hồ sơ</a>` +
          `<p class="muted">Khi liên hệ, xin Quý khách cho biết số tiếp nhận để chúng tôi tra cứu nhanh hơn.</p>`,
      },
    },
  },

  {
    key: "application.incomplete",
    name: "신청서 미비 — 보완 요청",
    description: "필수 항목이 비었을 때. 무엇이 비었는지 목록으로 정확히 알린다.",
    vars: vars("recipient", "ref", "missing_items", "url", "due_date"),
    tr: {
      ko: {
        subject: "신청서에 빠진 항목이 있습니다 ({{ref}})",
        body:
          `<p class="lead">{{recipient}} 님, 안녕하세요.</p>` +
          `<p>접수번호 {{ref}} 신청서를 확인했습니다. 다만 아래 항목이 비어 있어 아직 심사를 시작하지 못했습니다.</p>` +
          `<div class="box"><div class="label">보완이 필요한 항목</div><div>{{missing_items}}</div></div>` +
          `<p>{{due_date}}까지 채워 주시면 그대로 심사에 들어갑니다.</p>` +
          `<a class="btn" href="{{url}}">신청서 이어서 작성하기</a>` +
          `<p class="muted">작성 중 막히는 부분이 있으면 이 메일에 답장해 주세요.</p>`,
      },
      en: {
        subject: "Your application is missing a few things ({{ref}})",
        body:
          `<p class="lead">Hi {{recipient}},</p>` +
          `<p>We looked at application {{ref}} but can't start the review yet — the items below are still blank.</p>` +
          `<div class="box"><div class="label">Still needed</div><div>{{missing_items}}</div></div>` +
          `<p>Fill them in by {{due_date}} and we'll take it straight to review.</p>` +
          `<a class="btn" href="{{url}}">Finish your application</a>` +
          `<p class="muted">If you get stuck on any of it, just reply to this email.</p>`,
      },
      ja: {
        subject: "お申込書に未記入の項目がございます（{{ref}}）",
        body:
          `<p class="lead">{{recipient}} 様</p>` +
          `<p>受付番号 {{ref}} のお申込書を拝見しましたが、下記の項目が未記入のため審査を開始できておりません。</p>` +
          `<div class="box"><div class="label">ご記入が必要な項目</div><div>{{missing_items}}</div></div>` +
          `<p>{{due_date}} までにご記入いただければ、そのまま審査に進みます。</p>` +
          `<a class="btn" href="{{url}}">お申込書の続きを入力する</a>` +
          `<p class="muted">ご記入の途中でご不明な点がございましたら、本メールにご返信ください。</p>`,
      },
      zh: {
        subject: "您的申请尚有项目未填写（{{ref}}）",
        body:
          `<p class="lead">{{recipient}} 您好，</p>` +
          `<p>我们查看了受理编号 {{ref}} 的申请，但以下项目仍为空白，暂时无法启动审核。</p>` +
          `<div class="box"><div class="label">需要补充的项目</div><div>{{missing_items}}</div></div>` +
          `<p>请在 {{due_date}} 前填写完毕，我们会立即转入审核。</p>` +
          `<a class="btn" href="{{url}}">继续填写申请</a>` +
          `<p class="muted">填写过程中如遇到问题，直接回复本邮件即可。</p>`,
      },
      th: {
        subject: "ใบสมัครของท่านยังกรอกไม่ครบ ({{ref}})",
        body:
          `<p class="lead">เรียน คุณ{{recipient}}</p>` +
          `<p>เราตรวจใบสมัครหมายเลข {{ref}} แล้ว แต่ยังเริ่มพิจารณาไม่ได้เนื่องจากรายการด้านล่างยังว่างอยู่</p>` +
          `<div class="box"><div class="label">รายการที่ต้องกรอกเพิ่ม</div><div>{{missing_items}}</div></div>` +
          `<p>หากกรอกครบภายในวันที่ {{due_date}} เราจะนำเข้าสู่การพิจารณาทันที</p>` +
          `<a class="btn" href="{{url}}">กรอกใบสมัครต่อ</a>` +
          `<p class="muted">หากติดขัดตรงไหน ตอบกลับอีเมลฉบับนี้ได้เลย</p>`,
      },
      vi: {
        subject: "Hồ sơ của Quý khách còn thiếu một số mục ({{ref}})",
        body:
          `<p class="lead">Kính gửi {{recipient}},</p>` +
          `<p>Chúng tôi đã xem hồ sơ số {{ref}} nhưng chưa thể bắt đầu xét duyệt vì các mục dưới đây còn để trống.</p>` +
          `<div class="box"><div class="label">Cần bổ sung</div><div>{{missing_items}}</div></div>` +
          `<p>Xin Quý khách điền đầy đủ trước ngày {{due_date}}, chúng tôi sẽ chuyển ngay sang xét duyệt.</p>` +
          `<a class="btn" href="{{url}}">Hoàn tất hồ sơ</a>` +
          `<p class="muted">Nếu gặp khó khăn ở mục nào, xin trả lời email này.</p>`,
      },
    },
  },

  {
    key: "application.document_request",
    name: "서류 요청",
    description: "심사에 필요한 증빙 서류를 요청. 개인정보 보관 기간을 함께 고지한다.",
    vars: vars("recipient", "ref", "document_list", "url", "due_date"),
    tr: {
      ko: {
        subject: "제출해 주실 서류 안내 ({{ref}})",
        body:
          `<p class="lead">{{recipient}} 님, 안녕하세요.</p>` +
          `<p>접수번호 {{ref}} 심사에는 아래 서류가 필요합니다.</p>` +
          `<div class="box"><div class="label">필요한 서류</div><div>{{document_list}}</div></div>` +
          `<p>{{due_date}}까지 아래에서 올려 주세요. 사진으로 찍으셔도 되지만 네 귀퉁이와 글자가 또렷하게 나와야 합니다.</p>` +
          `<a class="btn" href="{{url}}">서류 올리기</a>` +
          `<p class="muted">제출하신 서류는 심사 목적으로만 쓰고 보관 기간이 지나면 파기합니다.</p>`,
      },
      en: {
        subject: "Documents we need from you ({{ref}})",
        body:
          `<p class="lead">Hi {{recipient}},</p>` +
          `<p>To review application {{ref}} we need the documents below.</p>` +
          `<div class="box"><div class="label">What to send</div><div>{{document_list}}</div></div>` +
          `<p>Please upload them by {{due_date}}. Photos are fine as long as all four corners and the text are clear.</p>` +
          `<a class="btn" href="{{url}}">Upload documents</a>` +
          `<p class="muted">We use these only to assess your application and destroy them once the retention period ends.</p>`,
      },
      ja: {
        subject: "ご提出いただく書類のご案内（{{ref}}）",
        body:
          `<p class="lead">{{recipient}} 様</p>` +
          `<p>受付番号 {{ref}} の審査にあたり、下記の書類が必要です。</p>` +
          `<div class="box"><div class="label">必要な書類</div><div>{{document_list}}</div></div>` +
          `<p>{{due_date}} までに下記からアップロードしてください。写真でも構いませんが、四隅と文字がはっきり写るようお願いいたします。</p>` +
          `<a class="btn" href="{{url}}">書類をアップロードする</a>` +
          `<p class="muted">ご提出の書類は審査の目的にのみ使用し、保管期間の経過後に廃棄いたします。</p>`,
      },
      zh: {
        subject: "需要您提交的材料（{{ref}}）",
        body:
          `<p class="lead">{{recipient}} 您好，</p>` +
          `<p>为审核受理编号 {{ref}} 的申请，我们需要以下材料。</p>` +
          `<div class="box"><div class="label">所需材料</div><div>{{document_list}}</div></div>` +
          `<p>请在 {{due_date}} 前通过下方上传。拍照上传亦可，但四角和文字须清晰可辨。</p>` +
          `<a class="btn" href="{{url}}">上传材料</a>` +
          `<p class="muted">所提交材料仅用于审核，保存期限届满后即行销毁。</p>`,
      },
      th: {
        subject: "เอกสารที่ต้องขอจากท่าน ({{ref}})",
        body:
          `<p class="lead">เรียน คุณ{{recipient}}</p>` +
          `<p>เพื่อพิจารณาใบสมัครหมายเลข {{ref}} เราต้องขอเอกสารดังต่อไปนี้</p>` +
          `<div class="box"><div class="label">เอกสารที่ต้องใช้</div><div>{{document_list}}</div></div>` +
          `<p>กรุณาอัปโหลดภายในวันที่ {{due_date}} จะถ่ายภาพส่งก็ได้ แต่ต้องเห็นมุมทั้งสี่และตัวอักษรชัดเจน</p>` +
          `<a class="btn" href="{{url}}">อัปโหลดเอกสาร</a>` +
          `<p class="muted">เราใช้เอกสารเหล่านี้เพื่อการพิจารณาเท่านั้น และจะทำลายเมื่อพ้นระยะเวลาเก็บรักษา</p>`,
      },
      vi: {
        subject: "Giấy tờ cần Quý khách cung cấp ({{ref}})",
        body:
          `<p class="lead">Kính gửi {{recipient}},</p>` +
          `<p>Để xét duyệt hồ sơ số {{ref}}, chúng tôi cần các giấy tờ sau.</p>` +
          `<div class="box"><div class="label">Giấy tờ cần nộp</div><div>{{document_list}}</div></div>` +
          `<p>Xin tải lên trước ngày {{due_date}}. Quý khách có thể chụp ảnh, miễn là thấy rõ bốn góc và chữ.</p>` +
          `<a class="btn" href="{{url}}">Tải giấy tờ lên</a>` +
          `<p class="muted">Chúng tôi chỉ dùng giấy tờ này để xét duyệt và sẽ hủy khi hết thời hạn lưu trữ.</p>`,
      },
    },
  },

  {
    key: "application.document_received",
    name: "서류 접수 완료",
    description: "제출 서류가 확인됐을 때. 다음 단계와 남은 서류를 함께 알린다.",
    vars: vars("recipient", "ref", "received_items", "pending_items", "url"),
    tr: {
      ko: {
        subject: "서류를 확인했습니다 ({{ref}})",
        body:
          `<p class="lead">{{recipient}} 님, 안녕하세요.</p>` +
          `<p>보내 주신 서류를 확인했습니다.</p>` +
          `<table class="kv">` +
          `<tr><td class="k">접수 완료</td><td>{{received_items}}</td></tr>` +
          `<tr><td class="k">남은 서류</td><td>{{pending_items}}</td></tr></table>` +
          `<p>남은 서류까지 들어오면 심사를 시작합니다.</p>` +
          `<a class="btn" href="{{url}}">진행 상황 보기</a>`,
      },
      en: {
        subject: "Your documents have been checked ({{ref}})",
        body:
          `<p class="lead">Hi {{recipient}},</p>` +
          `<p>We've been through the documents you sent.</p>` +
          `<table class="kv">` +
          `<tr><td class="k">Received</td><td>{{received_items}}</td></tr>` +
          `<tr><td class="k">Still outstanding</td><td>{{pending_items}}</td></tr></table>` +
          `<p>Once the rest arrives, the review starts.</p>` +
          `<a class="btn" href="{{url}}">Check progress</a>`,
      },
      ja: {
        subject: "書類を確認いたしました（{{ref}}）",
        body:
          `<p class="lead">{{recipient}} 様</p>` +
          `<p>お送りいただいた書類を確認いたしました。</p>` +
          `<table class="kv">` +
          `<tr><td class="k">受領済み</td><td>{{received_items}}</td></tr>` +
          `<tr><td class="k">未着の書類</td><td>{{pending_items}}</td></tr></table>` +
          `<p>残りの書類が届き次第、審査を開始いたします。</p>` +
          `<a class="btn" href="{{url}}">進捗を確認する</a>`,
      },
      zh: {
        subject: "已核对您提交的材料（{{ref}}）",
        body:
          `<p class="lead">{{recipient}} 您好，</p>` +
          `<p>我们已核对您提交的材料。</p>` +
          `<table class="kv">` +
          `<tr><td class="k">已收到</td><td>{{received_items}}</td></tr>` +
          `<tr><td class="k">尚未收到</td><td>{{pending_items}}</td></tr></table>` +
          `<p>其余材料到齐后，我们即启动审核。</p>` +
          `<a class="btn" href="{{url}}">查看进度</a>`,
      },
      th: {
        subject: "ตรวจรับเอกสารของท่านแล้ว ({{ref}})",
        body:
          `<p class="lead">เรียน คุณ{{recipient}}</p>` +
          `<p>เราได้ตรวจเอกสารที่ท่านส่งมาแล้ว</p>` +
          `<table class="kv">` +
          `<tr><td class="k">รับเรียบร้อย</td><td>{{received_items}}</td></tr>` +
          `<tr><td class="k">ยังขาด</td><td>{{pending_items}}</td></tr></table>` +
          `<p>เมื่อได้รับเอกสารส่วนที่เหลือครบ เราจะเริ่มพิจารณาทันที</p>` +
          `<a class="btn" href="{{url}}">ดูความคืบหน้า</a>`,
      },
      vi: {
        subject: "Đã kiểm tra giấy tờ của Quý khách ({{ref}})",
        body:
          `<p class="lead">Kính gửi {{recipient}},</p>` +
          `<p>Chúng tôi đã xem qua các giấy tờ Quý khách gửi.</p>` +
          `<table class="kv">` +
          `<tr><td class="k">Đã nhận</td><td>{{received_items}}</td></tr>` +
          `<tr><td class="k">Còn thiếu</td><td>{{pending_items}}</td></tr></table>` +
          `<p>Khi nhận đủ phần còn lại, chúng tôi sẽ bắt đầu xét duyệt.</p>` +
          `<a class="btn" href="{{url}}">Xem tiến độ</a>`,
      },
    },
  },

  {
    key: "application.document_rejected",
    name: "서류 반려 — 재제출 요청",
    description: "제출 서류를 쓸 수 없을 때. 반려 사유를 구체적으로 적어야 같은 실수가 반복되지 않는다.",
    vars: vars("recipient", "ref", "document_name", "reason", "url", "due_date"),
    tr: {
      ko: {
        subject: "서류를 다시 보내 주셔야 합니다 ({{ref}})",
        body:
          `<p class="lead">{{recipient}} 님, 안녕하세요.</p>` +
          `<p>보내 주신 {{document_name}}을(를) 그대로 쓰기 어려워 다시 요청드립니다.</p>` +
          `<div class="box"><div class="label">사유</div><div>{{reason}}</div></div>` +
          `<p>{{due_date}}까지 다시 올려 주시면 이어서 진행하겠습니다.</p>` +
          `<a class="btn" href="{{url}}">다시 올리기</a>` +
          `<p class="muted">어떻게 준비해야 할지 잘 모르시겠으면 답장 주세요. 예시를 보내 드리겠습니다.</p>`,
      },
      en: {
        subject: "We need that document again ({{ref}})",
        body:
          `<p class="lead">Hi {{recipient}},</p>` +
          `<p>We can't use the {{document_name}} you sent, so we have to ask for it again.</p>` +
          `<div class="box"><div class="label">Reason</div><div>{{reason}}</div></div>` +
          `<p>Send a new copy by {{due_date}} and we'll carry on from there.</p>` +
          `<a class="btn" href="{{url}}">Upload again</a>` +
          `<p class="muted">If you're unsure what form it should take, reply and we'll send an example.</p>`,
      },
      ja: {
        subject: "書類の再提出をお願いいたします（{{ref}}）",
        body:
          `<p class="lead">{{recipient}} 様</p>` +
          `<p>お送りいただいた {{document_name}} をそのまま使用することが難しく、改めてお願い申し上げます。</p>` +
          `<div class="box"><div class="label">理由</div><div>{{reason}}</div></div>` +
          `<p>{{due_date}} までに再度アップロードいただければ、そのまま手続きを進めます。</p>` +
          `<a class="btn" href="{{url}}">再度アップロードする</a>` +
          `<p class="muted">どのような形式でご用意すればよいかご不明な場合は、ご返信ください。見本をお送りいたします。</p>`,
      },
      zh: {
        subject: "需要您重新提交材料（{{ref}}）",
        body:
          `<p class="lead">{{recipient}} 您好，</p>` +
          `<p>您提交的{{document_name}}无法直接使用，需要请您重新提供。</p>` +
          `<div class="box"><div class="label">原因</div><div>{{reason}}</div></div>` +
          `<p>请在 {{due_date}} 前重新上传，我们会继续为您办理。</p>` +
          `<a class="btn" href="{{url}}">重新上传</a>` +
          `<p class="muted">如不确定该以何种形式准备，请回复本邮件，我们会发送样例。</p>`,
      },
      th: {
        subject: "กรุณาส่งเอกสารใหม่อีกครั้ง ({{ref}})",
        body:
          `<p class="lead">เรียน คุณ{{recipient}}</p>` +
          `<p>{{document_name}}ที่ท่านส่งมาไม่สามารถใช้ได้ จึงต้องขอรบกวนส่งใหม่อีกครั้ง</p>` +
          `<div class="box"><div class="label">เหตุผล</div><div>{{reason}}</div></div>` +
          `<p>หากส่งใหม่ภายในวันที่ {{due_date}} เราจะดำเนินการต่อให้ทันที</p>` +
          `<a class="btn" href="{{url}}">อัปโหลดใหม่</a>` +
          `<p class="muted">หากไม่แน่ใจว่าต้องเตรียมในรูปแบบใด ตอบกลับมาได้ เราจะส่งตัวอย่างให้</p>`,
      },
      vi: {
        subject: "Xin Quý khách gửi lại giấy tờ ({{ref}})",
        body:
          `<p class="lead">Kính gửi {{recipient}},</p>` +
          `<p>{{document_name}} Quý khách gửi chưa dùng được, nên chúng tôi xin phép đề nghị gửi lại.</p>` +
          `<div class="box"><div class="label">Lý do</div><div>{{reason}}</div></div>` +
          `<p>Xin gửi bản mới trước ngày {{due_date}} để chúng tôi tiếp tục xử lý.</p>` +
          `<a class="btn" href="{{url}}">Tải lại</a>` +
          `<p class="muted">Nếu chưa rõ cần chuẩn bị theo mẫu nào, xin trả lời email này để chúng tôi gửi ví dụ.</p>`,
      },
    },
  },

  {
    key: "application.under_review",
    name: "심사 착수",
    description: "서류가 모두 갖춰져 심사에 들어갔을 때. 대기 기간을 명확히 준다.",
    vars: vars("recipient", "ref", "review_days", "url"),
    tr: {
      ko: {
        subject: "심사가 시작되었습니다 ({{ref}})",
        body:
          `<p class="lead">{{recipient}} 님, 안녕하세요.</p>` +
          `<p>서류가 모두 갖춰져 접수번호 {{ref}} 심사를 시작했습니다.</p>` +
          `<p>결과는 {{review_days}}영업일 안에 알려 드립니다. 그동안 따로 하실 일은 없습니다.</p>` +
          `<a class="btn" href="{{url}}">진행 상황 보기</a>` +
          `<p class="muted">중간에 확인할 사항이 생기면 담당자가 연락드립니다.</p>`,
      },
      en: {
        subject: "Your application is under review ({{ref}})",
        body:
          `<p class="lead">Hi {{recipient}},</p>` +
          `<p>Everything is in, so review of application {{ref}} has started.</p>` +
          `<p>We'll have an answer for you within {{review_days}} business days. There's nothing you need to do in the meantime.</p>` +
          `<a class="btn" href="{{url}}">Check progress</a>` +
          `<p class="muted">If anything needs clarifying along the way, your case handler will be in touch.</p>`,
      },
      ja: {
        subject: "審査を開始いたしました（{{ref}}）",
        body:
          `<p class="lead">{{recipient}} 様</p>` +
          `<p>書類がすべて揃いましたので、受付番号 {{ref}} の審査を開始いたしました。</p>` +
          `<p>結果は {{review_days}} 営業日以内にご連絡いたします。それまで特にお手続きは不要です。</p>` +
          `<a class="btn" href="{{url}}">進捗を確認する</a>` +
          `<p class="muted">途中で確認事項が生じた場合は、担当者よりご連絡いたします。</p>`,
      },
      zh: {
        subject: "已开始审核（{{ref}}）",
        body:
          `<p class="lead">{{recipient}} 您好，</p>` +
          `<p>材料齐备，受理编号 {{ref}} 的审核已经启动。</p>` +
          `<p>我们会在 {{review_days}} 个工作日内告知结果。在此期间您无需另行操作。</p>` +
          `<a class="btn" href="{{url}}">查看进度</a>` +
          `<p class="muted">若中途需要核实事项，负责专员会与您联系。</p>`,
      },
      th: {
        subject: "เริ่มพิจารณาใบสมัครแล้ว ({{ref}})",
        body:
          `<p class="lead">เรียน คุณ{{recipient}}</p>` +
          `<p>เอกสารครบถ้วนแล้ว เราจึงเริ่มพิจารณาใบสมัครหมายเลข {{ref}}</p>` +
          `<p>จะแจ้งผลให้ทราบภายใน {{review_days}} วันทำการ ระหว่างนี้ท่านไม่ต้องดำเนินการใด ๆ</p>` +
          `<a class="btn" href="{{url}}">ดูความคืบหน้า</a>` +
          `<p class="muted">หากมีเรื่องต้องสอบถามระหว่างพิจารณา เจ้าหน้าที่จะติดต่อท่าน</p>`,
      },
      vi: {
        subject: "Hồ sơ đang được xét duyệt ({{ref}})",
        body:
          `<p class="lead">Kính gửi {{recipient}},</p>` +
          `<p>Giấy tờ đã đầy đủ nên chúng tôi bắt đầu xét duyệt hồ sơ số {{ref}}.</p>` +
          `<p>Chúng tôi sẽ báo kết quả trong vòng {{review_days}} ngày làm việc. Trong thời gian này Quý khách không cần làm gì thêm.</p>` +
          `<a class="btn" href="{{url}}">Xem tiến độ</a>` +
          `<p class="muted">Nếu có điểm cần làm rõ, nhân viên phụ trách sẽ liên hệ với Quý khách.</p>`,
      },
    },
  },

  {
    key: "application.approved",
    name: "신청 승인",
    description: "승인 통보. 다음 절차(계약·납부)로 곧바로 이어지도록 링크를 준다.",
    vars: vars("recipient", "ref", "next_step", "url", "due_date"),
    tr: {
      ko: {
        subject: "신청이 승인되었습니다 ({{ref}})",
        body:
          `<p class="lead">{{recipient}} 님, 안녕하세요.</p>` +
          `<p>접수번호 {{ref}} 신청이 승인되었습니다.</p>` +
          `<div class="box"><div class="label">다음 절차</div><div>{{next_step}}</div></div>` +
          `<p>{{due_date}}까지 아래에서 진행해 주세요. 기한이 지나면 승인이 취소될 수 있습니다.</p>` +
          `<a class="btn" href="{{url}}">다음 단계 진행하기</a>` +
          `<p class="muted">궁금한 점이 있으면 언제든 답장 주세요.</p>`,
      },
      en: {
        subject: "Your application is approved ({{ref}})",
        body:
          `<p class="lead">Hi {{recipient}},</p>` +
          `<p>Application {{ref}} has been approved.</p>` +
          `<div class="box"><div class="label">What happens next</div><div>{{next_step}}</div></div>` +
          `<p>Please take care of it by {{due_date}} — the approval can lapse after that date.</p>` +
          `<a class="btn" href="{{url}}">Continue</a>` +
          `<p class="muted">Any questions, just reply to this email.</p>`,
      },
      ja: {
        subject: "お申し込みが承認されました（{{ref}}）",
        body:
          `<p class="lead">{{recipient}} 様</p>` +
          `<p>受付番号 {{ref}} のお申し込みが承認されました。</p>` +
          `<div class="box"><div class="label">次のお手続き</div><div>{{next_step}}</div></div>` +
          `<p>{{due_date}} までに下記よりお進みください。期限を過ぎますと承認が失効する場合がございます。</p>` +
          `<a class="btn" href="{{url}}">次のステップに進む</a>` +
          `<p class="muted">ご不明な点がございましたら、いつでもご返信ください。</p>`,
      },
      zh: {
        subject: "您的申请已获批准（{{ref}}）",
        body:
          `<p class="lead">{{recipient}} 您好，</p>` +
          `<p>受理编号 {{ref}} 的申请已获批准。</p>` +
          `<div class="box"><div class="label">后续步骤</div><div>{{next_step}}</div></div>` +
          `<p>请在 {{due_date}} 前通过下方办理，逾期批准可能失效。</p>` +
          `<a class="btn" href="{{url}}">进入下一步</a>` +
          `<p class="muted">如有疑问，随时回复本邮件。</p>`,
      },
      th: {
        subject: "ใบสมัครของท่านได้รับอนุมัติแล้ว ({{ref}})",
        body:
          `<p class="lead">เรียน คุณ{{recipient}}</p>` +
          `<p>ใบสมัครหมายเลข {{ref}} ได้รับการอนุมัติแล้ว</p>` +
          `<div class="box"><div class="label">ขั้นตอนถัดไป</div><div>{{next_step}}</div></div>` +
          `<p>กรุณาดำเนินการผ่านลิงก์ด้านล่างภายในวันที่ {{due_date}} หากเกินกำหนด การอนุมัติอาจสิ้นผล</p>` +
          `<a class="btn" href="{{url}}">ดำเนินการขั้นต่อไป</a>` +
          `<p class="muted">มีข้อสงสัยประการใด ตอบกลับอีเมลนี้ได้ตลอด</p>`,
      },
      vi: {
        subject: "Hồ sơ của Quý khách đã được duyệt ({{ref}})",
        body:
          `<p class="lead">Kính gửi {{recipient}},</p>` +
          `<p>Hồ sơ số {{ref}} đã được duyệt.</p>` +
          `<div class="box"><div class="label">Bước tiếp theo</div><div>{{next_step}}</div></div>` +
          `<p>Xin Quý khách hoàn tất trước ngày {{due_date}}; quá hạn, phê duyệt có thể hết hiệu lực.</p>` +
          `<a class="btn" href="{{url}}">Tiếp tục</a>` +
          `<p class="muted">Có thắc mắc gì, xin trả lời email này bất cứ lúc nào.</p>`,
      },
    },
  },

  {
    key: "application.rejected",
    name: "신청 반려",
    description: "반려 통보. 사유를 밝히고 재신청 가능 여부를 분명히 한다.",
    vars: vars("recipient", "ref", "reason", "reapply_after", "url"),
    tr: {
      ko: {
        subject: "신청 결과 안내 ({{ref}})",
        body:
          `<p class="lead">{{recipient}} 님, 안녕하세요.</p>` +
          `<p>접수번호 {{ref}} 신청을 검토했으나 이번에는 승인해 드리지 못하게 되었습니다.</p>` +
          `<div class="box"><div class="label">사유</div><div>{{reason}}</div></div>` +
          `<p>{{reapply_after}} 이후에는 다시 신청하실 수 있습니다. 사정이 달라지면 그때 다시 검토해 드리겠습니다.</p>` +
          `<p class="muted">결과를 더 자세히 알고 싶으시면 답장 주세요. 담당자가 설명해 드리겠습니다.</p>`,
      },
      en: {
        subject: "About your application ({{ref}})",
        body:
          `<p class="lead">Hi {{recipient}},</p>` +
          `<p>We've reviewed application {{ref}}, and unfortunately we can't take it forward this time.</p>` +
          `<div class="box"><div class="label">Reason</div><div>{{reason}}</div></div>` +
          `<p>You're welcome to apply again after {{reapply_after}}. If your circumstances change, we'll gladly look at it afresh.</p>` +
          `<p class="muted">If you'd like more detail on the decision, reply and your case handler will explain.</p>`,
      },
      ja: {
        subject: "審査結果のご案内（{{ref}}）",
        body:
          `<p class="lead">{{recipient}} 様</p>` +
          `<p>受付番号 {{ref}} のお申し込みを検討いたしましたが、今回はお受けすることが難しい結果となりました。</p>` +
          `<div class="box"><div class="label">理由</div><div>{{reason}}</div></div>` +
          `<p>{{reapply_after}} 以降であれば、改めてお申し込みいただけます。ご事情が変わりましたら、その際に再度検討いたします。</p>` +
          `<p class="muted">結果について詳しくお知りになりたい場合は、ご返信ください。担当者よりご説明いたします。</p>`,
      },
      zh: {
        subject: "关于您的申请结果（{{ref}}）",
        body:
          `<p class="lead">{{recipient}} 您好，</p>` +
          `<p>我们审核了受理编号 {{ref}} 的申请，很遗憾这次无法继续办理。</p>` +
          `<div class="box"><div class="label">原因</div><div>{{reason}}</div></div>` +
          `<p>{{reapply_after}} 之后您可以重新申请。若情况有所变化，我们会再次为您审核。</p>` +
          `<p class="muted">如想进一步了解结果，请回复本邮件，负责专员会向您说明。</p>`,
      },
      th: {
        subject: "แจ้งผลการพิจารณาใบสมัคร ({{ref}})",
        body:
          `<p class="lead">เรียน คุณ{{recipient}}</p>` +
          `<p>เราได้พิจารณาใบสมัครหมายเลข {{ref}} แล้ว แต่ครั้งนี้ยังไม่สามารถดำเนินการต่อได้</p>` +
          `<div class="box"><div class="label">เหตุผล</div><div>{{reason}}</div></div>` +
          `<p>ท่านสามารถยื่นใหม่ได้ตั้งแต่ {{reapply_after}} เป็นต้นไป หากสถานการณ์เปลี่ยนแปลง เรายินดีพิจารณาอีกครั้ง</p>` +
          `<p class="muted">หากต้องการทราบรายละเอียดเพิ่มเติม ตอบกลับมาได้ เจ้าหน้าที่จะอธิบายให้ทราบ</p>`,
      },
      vi: {
        subject: "Thông báo kết quả hồ sơ ({{ref}})",
        body:
          `<p class="lead">Kính gửi {{recipient}},</p>` +
          `<p>Chúng tôi đã xem xét hồ sơ số {{ref}}, nhưng rất tiếc lần này chưa thể tiếp nhận.</p>` +
          `<div class="box"><div class="label">Lý do</div><div>{{reason}}</div></div>` +
          `<p>Sau ngày {{reapply_after}}, Quý khách có thể nộp lại. Nếu hoàn cảnh thay đổi, chúng tôi sẽ xem xét lại.</p>` +
          `<p class="muted">Nếu muốn biết thêm chi tiết về quyết định này, xin trả lời email để nhân viên phụ trách giải thích.</p>`,
      },
    },
  },

  {
    key: "application.withdrawn",
    name: "신청 취소 확인",
    description: "신청자가 취소했을 때의 확인. 제출 서류 처리 방침을 함께 알린다.",
    vars: vars("recipient", "ref", "date", "url"),
    tr: {
      ko: {
        subject: "신청이 취소되었습니다 ({{ref}})",
        body:
          `<p class="lead">{{recipient}} 님, 안녕하세요.</p>` +
          `<p>요청하신 대로 접수번호 {{ref}} 신청을 {{date}}에 취소 처리했습니다.</p>` +
          `<p>제출하신 서류는 보관 기간이 지나면 파기합니다. 더 빨리 파기해 드리기를 원하시면 알려 주세요.</p>` +
          `<a class="btn" href="{{url}}">다시 신청하기</a>` +
          `<p class="muted">취소하신 적이 없다면 바로 연락 주세요. 확인해 드리겠습니다.</p>`,
      },
      en: {
        subject: "Your application has been withdrawn ({{ref}})",
        body:
          `<p class="lead">Hi {{recipient}},</p>` +
          `<p>As you asked, we withdrew application {{ref}} on {{date}}.</p>` +
          `<p>The documents you sent will be destroyed once the retention period ends. Tell us if you'd like them removed sooner.</p>` +
          `<a class="btn" href="{{url}}">Apply again</a>` +
          `<p class="muted">If you didn't ask to withdraw, contact us right away and we'll check.</p>`,
      },
      ja: {
        subject: "お申し込みを取り消しました（{{ref}}）",
        body:
          `<p class="lead">{{recipient}} 様</p>` +
          `<p>ご依頼のとおり、受付番号 {{ref}} のお申し込みを {{date}} に取り消しいたしました。</p>` +
          `<p>ご提出の書類は保管期間の経過後に廃棄いたします。より早い削除をご希望の場合はお知らせください。</p>` +
          `<a class="btn" href="{{url}}">改めて申し込む</a>` +
          `<p class="muted">取り消しのご依頼にお心当たりがない場合は、すぐにご連絡ください。確認いたします。</p>`,
      },
      zh: {
        subject: "您的申请已取消（{{ref}}）",
        body:
          `<p class="lead">{{recipient}} 您好，</p>` +
          `<p>按照您的要求，受理编号 {{ref}} 的申请已于 {{date}} 取消。</p>` +
          `<p>您提交的材料将在保存期限届满后销毁。如希望提前删除，请告知我们。</p>` +
          `<a class="btn" href="{{url}}">重新申请</a>` +
          `<p class="muted">如果您并未申请取消，请立即联系我们，我们会为您核实。</p>`,
      },
      th: {
        subject: "ยกเลิกใบสมัครเรียบร้อยแล้ว ({{ref}})",
        body:
          `<p class="lead">เรียน คุณ{{recipient}}</p>` +
          `<p>ตามที่ท่านแจ้ง เราได้ยกเลิกใบสมัครหมายเลข {{ref}} เมื่อวันที่ {{date}}</p>` +
          `<p>เอกสารที่ท่านส่งมาจะถูกทำลายเมื่อพ้นระยะเวลาเก็บรักษา หากต้องการให้ลบเร็วกว่านั้น กรุณาแจ้งให้ทราบ</p>` +
          `<a class="btn" href="{{url}}">ยื่นใบสมัครใหม่</a>` +
          `<p class="muted">หากท่านไม่ได้ขอยกเลิก กรุณาติดต่อเราทันที เราจะตรวจสอบให้</p>`,
      },
      vi: {
        subject: "Hồ sơ của Quý khách đã được hủy ({{ref}})",
        body:
          `<p class="lead">Kính gửi {{recipient}},</p>` +
          `<p>Theo yêu cầu của Quý khách, chúng tôi đã hủy hồ sơ số {{ref}} vào ngày {{date}}.</p>` +
          `<p>Giấy tờ Quý khách đã nộp sẽ được hủy khi hết thời hạn lưu trữ. Nếu muốn xóa sớm hơn, xin báo cho chúng tôi.</p>` +
          `<a class="btn" href="{{url}}">Nộp hồ sơ mới</a>` +
          `<p class="muted">Nếu Quý khách không yêu cầu hủy, xin liên hệ ngay để chúng tôi kiểm tra.</p>`,
      },
    },
  },
];
