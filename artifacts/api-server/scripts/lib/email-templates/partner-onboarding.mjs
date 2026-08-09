// partner — 제휴 가입·계약·관계 관리 (agent.*)
//
// 수신자는 부동산·여행 에이전트, 학교, 기업의 **담당자**다. B2C 세입자와 호칭·격식이
// 다르므로 별도 키를 쓴다(스펙 §2.2 분리 기준 ①). "고객님"이 아니라 "담당자님",
// 개인의 생활이 아니라 회사 간 거래를 다룬다.
//
// ⚠️ 파트너 담당자는 사람이 바뀐다. 문안에 개인 이름을 전제한 표현을 넣지 말고
//    {{partner_company}} 를 함께 노출해 인수인계된 담당자도 맥락을 잡을 수 있게 한다.
// 한국어는 humanize-korean 통과본. 영어에서 재기계번역 금지.
import { vars } from "./_shared.mjs";

export const PARTNER_ONBOARDING = [
  {
    key: "agent.application_received",
    name: "제휴 신청 접수",
    description: "파트너 가입 신청이 들어왔을 때의 확인. 심사 항목과 기간을 알린다.",
    vars: vars("recipient", "partner_company", "ref", "review_days", "required_docs", "url"),
    tr: {
      ko: {
        subject: "제휴 신청을 접수했습니다 ({{ref}})",
        body:
          `<p class="lead">{{recipient}} 담당자님, 안녕하세요.</p>` +
          `<p>{{partner_company}}의 제휴 신청을 접수했습니다.</p>` +
          `<div class="box"><div class="label">접수번호</div><div class="ref">{{ref}}</div></div>` +
          `<p>사업자 정보와 자격 요건을 확인한 뒤 {{review_days}}영업일 안에 결과를 알려 드리겠습니다.</p>` +
          `<table class="kv"><tr><td class="k">제출이 필요한 서류</td><td>{{required_docs}}</td></tr></table>` +
          `<a class="btn" href="{{url}}">신청 내역 보기</a>` +
          `<p class="muted">서류가 갖춰지지 않으면 심사를 시작할 수 없습니다. 준비가 어려우시면 미리 알려 주세요.</p>`,
      },
      en: {
        subject: "Your partnership application is received ({{ref}})",
        body:
          `<p class="lead">Dear {{recipient}},</p>` +
          `<p>We've received the partnership application from {{partner_company}}.</p>` +
          `<div class="box"><div class="label">Reference</div><div class="ref">{{ref}}</div></div>` +
          `<p>Once we've verified your business details and eligibility, we'll come back to you within {{review_days}} business days.</p>` +
          `<table class="kv"><tr><td class="k">Documents required</td><td>{{required_docs}}</td></tr></table>` +
          `<a class="btn" href="{{url}}">View the application</a>` +
          `<p class="muted">Assessment can't begin until the documents are complete. Tell us early if any of them are difficult to obtain.</p>`,
      },
      ja: {
        subject: "提携のお申し込みを受け付けました（{{ref}}）",
        body:
          `<p class="lead">{{recipient}} ご担当者様</p>` +
          `<p>{{partner_company}} 様よりご提出いただきました提携のお申し込みを受け付けました。</p>` +
          `<div class="box"><div class="label">受付番号</div><div class="ref">{{ref}}</div></div>` +
          `<p>事業者情報と要件を確認のうえ、{{review_days}} 営業日以内に結果をご連絡いたします。</p>` +
          `<table class="kv"><tr><td class="k">ご提出が必要な書類</td><td>{{required_docs}}</td></tr></table>` +
          `<a class="btn" href="{{url}}">お申し込み内容を確認する</a>` +
          `<p class="muted">書類が揃いませんと審査を開始できません。ご準備が難しい書類がございましたら、事前にお知らせください。</p>`,
      },
      zh: {
        subject: "已受理合作申请（{{ref}}）",
        body:
          `<p class="lead">{{recipient}} 负责人，您好：</p>` +
          `<p>我们已收到 {{partner_company}} 提交的合作申请。</p>` +
          `<div class="box"><div class="label">受理编号</div><div class="ref">{{ref}}</div></div>` +
          `<p>核实企业信息与资质条件后，我们会在 {{review_days}} 个工作日内答复。</p>` +
          `<table class="kv"><tr><td class="k">需提交的材料</td><td>{{required_docs}}</td></tr></table>` +
          `<a class="btn" href="{{url}}">查看申请内容</a>` +
          `<p class="muted">材料不齐将无法启动审核。如某项材料准备困难，请提前告知我们。</p>`,
      },
      th: {
        subject: "รับเรื่องสมัครเป็นพันธมิตรแล้ว ({{ref}})",
        body:
          `<p class="lead">เรียน ผู้ประสานงาน{{recipient}}</p>` +
          `<p>เราได้รับใบสมัครเป็นพันธมิตรจาก {{partner_company}} แล้ว</p>` +
          `<div class="box"><div class="label">หมายเลขรับเรื่อง</div><div class="ref">{{ref}}</div></div>` +
          `<p>หลังตรวจสอบข้อมูลนิติบุคคลและคุณสมบัติแล้ว เราจะแจ้งผลภายใน {{review_days}} วันทำการ</p>` +
          `<table class="kv"><tr><td class="k">เอกสารที่ต้องยื่น</td><td>{{required_docs}}</td></tr></table>` +
          `<a class="btn" href="{{url}}">ดูรายละเอียดใบสมัคร</a>` +
          `<p class="muted">หากเอกสารไม่ครบ จะยังเริ่มพิจารณาไม่ได้ หากเตรียมรายการใดลำบาก กรุณาแจ้งล่วงหน้า</p>`,
      },
      vi: {
        subject: "Đã tiếp nhận hồ sơ hợp tác ({{ref}})",
        body:
          `<p class="lead">Kính gửi ông/bà {{recipient}},</p>` +
          `<p>Chúng tôi đã nhận hồ sơ đăng ký hợp tác của {{partner_company}}.</p>` +
          `<div class="box"><div class="label">Số tiếp nhận</div><div class="ref">{{ref}}</div></div>` +
          `<p>Sau khi xác minh thông tin doanh nghiệp và điều kiện, chúng tôi sẽ phản hồi trong vòng {{review_days}} ngày làm việc.</p>` +
          `<table class="kv"><tr><td class="k">Giấy tờ cần nộp</td><td>{{required_docs}}</td></tr></table>` +
          `<a class="btn" href="{{url}}">Xem hồ sơ</a>` +
          `<p class="muted">Chưa đủ giấy tờ thì chưa thể bắt đầu thẩm định. Nếu khó chuẩn bị mục nào, xin báo sớm.</p>`,
      },
    },
  },

  {
    key: "agent.approved",
    name: "제휴 승인",
    description: "파트너 승인 통보. 수수료 조건과 포털 접속 경로를 함께 준다.",
    vars: vars("recipient", "partner_company", "ref", "commission_terms", "start_date", "url"),
    tr: {
      ko: {
        subject: "제휴가 승인되었습니다 ({{partner_company}})",
        body:
          `<p class="lead">{{recipient}} 담당자님, 안녕하세요.</p>` +
          `<p>{{partner_company}}의 제휴 신청이 승인되었습니다. 함께 일하게 되어 반갑습니다.</p>` +
          `<table class="kv">` +
          `<tr><td class="k">제휴번호</td><td>{{ref}}</td></tr>` +
          `<tr><td class="k">개시일</td><td>{{start_date}}</td></tr>` +
          `<tr><td class="k">수수료 조건</td><td>{{commission_terms}}</td></tr></table>` +
          `<a class="btn" href="{{url}}">파트너 포털 접속하기</a>` +
          `<p>포털에서 매물 현황을 확인하고 고객을 소개하실 수 있습니다. 계약서는 별도로 보내 드리니 서명해 주세요.</p>` +
          `<p class="muted">사용법이 궁금하시면 언제든 답장 주세요. 필요할 때는 화상으로 안내해 드리겠습니다.</p>`,
      },
      en: {
        subject: "Your partnership is approved ({{partner_company}})",
        body:
          `<p class="lead">Dear {{recipient}},</p>` +
          `<p>The partnership application from {{partner_company}} has been approved. We're glad to be working with you.</p>` +
          `<table class="kv">` +
          `<tr><td class="k">Partner ID</td><td>{{ref}}</td></tr>` +
          `<tr><td class="k">Start date</td><td>{{start_date}}</td></tr>` +
          `<tr><td class="k">Commission</td><td>{{commission_terms}}</td></tr></table>` +
          `<a class="btn" href="{{url}}">Open the partner portal</a>` +
          `<p>The portal shows current availability and lets you refer clients. The agreement follows separately for signature.</p>` +
          `<p class="muted">Any questions about how it works, just reply. We're happy to walk you through it on a call.</p>`,
      },
      ja: {
        subject: "提携が承認されました（{{partner_company}}）",
        body:
          `<p class="lead">{{recipient}} ご担当者様</p>` +
          `<p>{{partner_company}} 様の提携のお申し込みが承認されました。ご一緒できますこと、うれしく存じます。</p>` +
          `<table class="kv">` +
          `<tr><td class="k">提携番号</td><td>{{ref}}</td></tr>` +
          `<tr><td class="k">開始日</td><td>{{start_date}}</td></tr>` +
          `<tr><td class="k">手数料条件</td><td>{{commission_terms}}</td></tr></table>` +
          `<a class="btn" href="{{url}}">パートナーポータルへ</a>` +
          `<p>ポータルでは空室状況をご覧いただき、お客様をご紹介いただけます。契約書は別途お送りいたしますので、ご署名をお願いいたします。</p>` +
          `<p class="muted">ご不明な点がございましたら、いつでもご返信ください。ご希望でしたらオンラインでご案内いたします。</p>`,
      },
      zh: {
        subject: "合作申请已获批准（{{partner_company}}）",
        body:
          `<p class="lead">{{recipient}} 负责人，您好：</p>` +
          `<p>{{partner_company}} 的合作申请已获批准，很高兴与您携手。</p>` +
          `<table class="kv">` +
          `<tr><td class="k">合作编号</td><td>{{ref}}</td></tr>` +
          `<tr><td class="k">起始日</td><td>{{start_date}}</td></tr>` +
          `<tr><td class="k">佣金条件</td><td>{{commission_terms}}</td></tr></table>` +
          `<a class="btn" href="{{url}}">进入合作伙伴门户</a>` +
          `<p>门户中可查看房源状况并推荐客户。合同将另行发送，请您签署。</p>` +
          `<p class="muted">使用上如有疑问，随时回复本邮件。需要的话我们可以线上为您讲解。</p>`,
      },
      th: {
        subject: "อนุมัติการเป็นพันธมิตรแล้ว ({{partner_company}})",
        body:
          `<p class="lead">เรียน ผู้ประสานงาน{{recipient}}</p>` +
          `<p>ใบสมัครเป็นพันธมิตรของ {{partner_company}} ได้รับอนุมัติแล้ว ยินดีที่ได้ร่วมงานกัน</p>` +
          `<table class="kv">` +
          `<tr><td class="k">รหัสพันธมิตร</td><td>{{ref}}</td></tr>` +
          `<tr><td class="k">วันเริ่ม</td><td>{{start_date}}</td></tr>` +
          `<tr><td class="k">เงื่อนไขค่าคอมมิชชัน</td><td>{{commission_terms}}</td></tr></table>` +
          `<a class="btn" href="{{url}}">เข้าสู่พอร์ทัลพันธมิตร</a>` +
          `<p>ในพอร์ทัลดูสถานะห้องว่างและแนะนำลูกค้าได้ สัญญาจะส่งให้ต่างหากเพื่อลงนาม</p>` +
          `<p class="muted">มีข้อสงสัยเรื่องการใช้งาน ตอบกลับมาได้ตลอด หากต้องการ เรายินดีอธิบายผ่านออนไลน์</p>`,
      },
      vi: {
        subject: "Hợp tác đã được phê duyệt ({{partner_company}})",
        body:
          `<p class="lead">Kính gửi ông/bà {{recipient}},</p>` +
          `<p>Hồ sơ hợp tác của {{partner_company}} đã được duyệt. Rất vui được đồng hành cùng quý công ty.</p>` +
          `<table class="kv">` +
          `<tr><td class="k">Mã đối tác</td><td>{{ref}}</td></tr>` +
          `<tr><td class="k">Ngày bắt đầu</td><td>{{start_date}}</td></tr>` +
          `<tr><td class="k">Điều kiện hoa hồng</td><td>{{commission_terms}}</td></tr></table>` +
          `<a class="btn" href="{{url}}">Vào cổng đối tác</a>` +
          `<p>Trên cổng, quý công ty xem được tình trạng phòng trống và giới thiệu khách. Hợp đồng sẽ gửi riêng để ký.</p>` +
          `<p class="muted">Có thắc mắc về cách dùng, xin cứ trả lời email. Nếu cần, chúng tôi sẵn sàng hướng dẫn trực tuyến.</p>`,
      },
    },
  },

  {
    key: "agent.rejected",
    name: "제휴 신청 반려",
    description: "반려 통보. 사유를 밝히고 재신청 가능 여부를 분명히 한다.",
    vars: vars("recipient", "partner_company", "ref", "reason", "reapply_after"),
    tr: {
      ko: {
        subject: "제휴 신청 결과 안내 ({{ref}})",
        body:
          `<p class="lead">{{recipient}} 담당자님, 안녕하세요.</p>` +
          `<p>{{partner_company}}의 제휴 신청을 검토했으나 이번에는 제휴를 맺기 어렵다는 결론에 이르렀습니다.</p>` +
          `<div class="box"><div class="label">사유</div><div>{{reason}}</div></div>` +
          `<p>{{reapply_after}} 이후에는 다시 신청하실 수 있습니다. 요건이 갖춰지면 언제든 다시 검토하겠습니다.</p>` +
          `<p class="muted">판단 근거를 더 알고 싶으시면 답장 주세요. 담당자가 설명해 드리겠습니다.</p>`,
      },
      en: {
        subject: "About your partnership application ({{ref}})",
        body:
          `<p class="lead">Dear {{recipient}},</p>` +
          `<p>We've reviewed the application from {{partner_company}} and, on this occasion, we're not able to proceed with a partnership.</p>` +
          `<div class="box"><div class="label">Reason</div><div>{{reason}}</div></div>` +
          `<p>You're welcome to apply again after {{reapply_after}}. If the position changes, we'll gladly look at it afresh.</p>` +
          `<p class="muted">If you'd like more detail on the decision, reply and we'll explain.</p>`,
      },
      ja: {
        subject: "提携お申し込みの結果について（{{ref}}）",
        body:
          `<p class="lead">{{recipient}} ご担当者様</p>` +
          `<p>{{partner_company}} 様のお申し込みを検討いたしましたが、今回は提携を見送らせていただく結論となりました。</p>` +
          `<div class="box"><div class="label">理由</div><div>{{reason}}</div></div>` +
          `<p>{{reapply_after}} 以降であれば、改めてお申し込みいただけます。要件が整いましたら、いつでも再度検討いたします。</p>` +
          `<p class="muted">判断の根拠について詳しくお知りになりたい場合は、ご返信ください。担当者よりご説明いたします。</p>`,
      },
      zh: {
        subject: "关于合作申请的结果（{{ref}}）",
        body:
          `<p class="lead">{{recipient}} 负责人，您好：</p>` +
          `<p>我们审阅了 {{partner_company}} 的申请，很遗憾此次未能建立合作关系。</p>` +
          `<div class="box"><div class="label">原因</div><div>{{reason}}</div></div>` +
          `<p>{{reapply_after}} 之后您可以重新申请。条件具备后，我们随时乐意再次评估。</p>` +
          `<p class="muted">若想进一步了解判断依据，请回复本邮件，负责专员会向您说明。</p>`,
      },
      th: {
        subject: "แจ้งผลการสมัครเป็นพันธมิตร ({{ref}})",
        body:
          `<p class="lead">เรียน ผู้ประสานงาน{{recipient}}</p>` +
          `<p>เราได้พิจารณาใบสมัครของ {{partner_company}} แล้ว แต่ครั้งนี้ยังไม่สามารถร่วมเป็นพันธมิตรกันได้</p>` +
          `<div class="box"><div class="label">เหตุผล</div><div>{{reason}}</div></div>` +
          `<p>ท่านสมัครใหม่ได้ตั้งแต่ {{reapply_after}} เป็นต้นไป เมื่อคุณสมบัติครบถ้วน เรายินดีพิจารณาอีกครั้ง</p>` +
          `<p class="muted">หากต้องการทราบเหตุผลโดยละเอียด ตอบกลับมาได้ เจ้าหน้าที่จะอธิบายให้</p>`,
      },
      vi: {
        subject: "Kết quả hồ sơ hợp tác ({{ref}})",
        body:
          `<p class="lead">Kính gửi ông/bà {{recipient}},</p>` +
          `<p>Chúng tôi đã xem xét hồ sơ của {{partner_company}}, nhưng lần này chưa thể thiết lập quan hệ hợp tác.</p>` +
          `<div class="box"><div class="label">Lý do</div><div>{{reason}}</div></div>` +
          `<p>Sau {{reapply_after}}, quý công ty có thể nộp lại. Khi điều kiện thay đổi, chúng tôi sẵn sàng xem xét lại.</p>` +
          `<p class="muted">Nếu muốn biết rõ hơn về quyết định, xin trả lời email để chúng tôi giải thích.</p>`,
      },
    },
  },

  {
    key: "agent.agreement_sent",
    name: "제휴 계약서 서명 요청",
    description: "제휴 계약 전자서명 요청. 수수료·정산 주기 등 핵심 조건을 미리 요약해 준다.",
    vars: vars("recipient", "partner_company", "ref", "url", "expiry_date", "key_terms"),
    tr: {
      ko: {
        subject: "제휴 계약서에 서명해 주세요 ({{ref}})",
        body:
          `<p class="lead">{{recipient}} 담당자님, 안녕하세요.</p>` +
          `<p>{{partner_company}}와의 제휴 계약서를 준비했습니다. 아래에서 확인하고 서명해 주세요.</p>` +
          `<div class="box"><div class="label">핵심 조건</div><div>{{key_terms}}</div></div>` +
          `<a class="btn" href="{{url}}">계약서 확인하고 서명하기</a>` +
          `<p>조건 중 조정이 필요한 부분이 있으면 서명 대신 답장을 주세요. 협의한 뒤 다시 보내 드리겠습니다.</p>` +
          `<p class="muted">링크는 {{expiry_date}}까지 열려 있으며 서명 권한이 있는 분이 진행해 주셔야 합니다.</p>`,
      },
      en: {
        subject: "Please sign the partnership agreement ({{ref}})",
        body:
          `<p class="lead">Dear {{recipient}},</p>` +
          `<p>The partnership agreement for {{partner_company}} is ready. Please review and sign below.</p>` +
          `<div class="box"><div class="label">Key terms</div><div>{{key_terms}}</div></div>` +
          `<a class="btn" href="{{url}}">Review and sign</a>` +
          `<p>If any term needs adjusting, reply rather than signing. We'll discuss it and send a revised version.</p>` +
          `<p class="muted">The link is open until {{expiry_date}} and should be completed by someone authorised to sign.</p>`,
      },
      ja: {
        subject: "提携契約書へのご署名のお願い（{{ref}}）",
        body:
          `<p class="lead">{{recipient}} ご担当者様</p>` +
          `<p>{{partner_company}} 様との提携契約書をご用意いたしました。下記よりご確認のうえ、ご署名ください。</p>` +
          `<div class="box"><div class="label">主な条件</div><div>{{key_terms}}</div></div>` +
          `<a class="btn" href="{{url}}">契約書を確認して署名する</a>` +
          `<p>条件に調整が必要な点がございましたら、ご署名の前にご返信ください。協議のうえ、改めてお送りいたします。</p>` +
          `<p class="muted">リンクは {{expiry_date}} まで有効です。ご署名権限のある方にお進めいただきますようお願いいたします。</p>`,
      },
      zh: {
        subject: "请签署合作协议（{{ref}}）",
        body:
          `<p class="lead">{{recipient}} 负责人，您好：</p>` +
          `<p>与 {{partner_company}} 的合作协议已准备好，请在下方查阅并签署。</p>` +
          `<div class="box"><div class="label">主要条款</div><div>{{key_terms}}</div></div>` +
          `<a class="btn" href="{{url}}">查阅并签署</a>` +
          `<p>如某项条款需要调整，请先回复本邮件，暂不签署。协商后我们会重新发送。</p>` +
          `<p class="muted">链接有效期至 {{expiry_date}}，须由具备签署权限的人员完成。</p>`,
      },
      th: {
        subject: "กรุณาลงนามในสัญญาความร่วมมือ ({{ref}})",
        body:
          `<p class="lead">เรียน ผู้ประสานงาน{{recipient}}</p>` +
          `<p>สัญญาความร่วมมือกับ {{partner_company}} พร้อมแล้ว กรุณาตรวจสอบและลงนามด้านล่าง</p>` +
          `<div class="box"><div class="label">เงื่อนไขสำคัญ</div><div>{{key_terms}}</div></div>` +
          `<a class="btn" href="{{url}}">ตรวจสอบและลงนาม</a>` +
          `<p>หากมีเงื่อนไขใดที่ต้องปรับ กรุณาตอบกลับก่อนลงนาม เราจะหารือแล้วส่งฉบับแก้ไขให้ใหม่</p>` +
          `<p class="muted">ลิงก์เปิดถึงวันที่ {{expiry_date}} และควรดำเนินการโดยผู้มีอำนาจลงนาม</p>`,
      },
      vi: {
        subject: "Xin ký hợp đồng hợp tác ({{ref}})",
        body:
          `<p class="lead">Kính gửi ông/bà {{recipient}},</p>` +
          `<p>Hợp đồng hợp tác với {{partner_company}} đã sẵn sàng. Xin quý công ty xem và ký ở bên dưới.</p>` +
          `<div class="box"><div class="label">Điều khoản chính</div><div>{{key_terms}}</div></div>` +
          `<a class="btn" href="{{url}}">Xem và ký</a>` +
          `<p>Nếu cần điều chỉnh điều khoản nào, xin trả lời email thay vì ký. Chúng tôi sẽ trao đổi rồi gửi lại bản sửa.</p>` +
          `<p class="muted">Liên kết mở đến ngày {{expiry_date}} và cần người có thẩm quyền ký thực hiện.</p>`,
      },
    },
  },

  {
    key: "agent.portal_welcome",
    name: "파트너 포털 사용 안내",
    description: "계약 체결 후 실무 안내. 무엇을 어디서 하는지 한 장에 정리한다.",
    vars: vars("recipient", "partner_company", "url", "contact_name", "contact_phone"),
    tr: {
      ko: {
        subject: "파트너 포털 사용 안내",
        body:
          `<p class="lead">{{recipient}} 담당자님, 안녕하세요.</p>` +
          `<p>{{partner_company}} 계정이 열렸습니다. 포털에서 이런 일을 하실 수 있습니다.</p>` +
          `<ul>` +
          `<li>공실과 임대 조건 실시간 확인</li>` +
          `<li>고객 소개와 진행 상황 추적</li>` +
          `<li>성사된 계약의 수수료 내역 확인</li>` +
          `<li>필요한 문서 내려받기</li>` +
          `</ul>` +
          `<a class="btn" href="{{url}}">포털 접속하기</a>` +
          `<p class="muted">담당은 {{contact_name}} ({{contact_phone}})입니다. 쓰시다 막히는 부분이 있으면 바로 연락 주세요.</p>`,
      },
      en: {
        subject: "Getting started with the partner portal",
        body:
          `<p class="lead">Dear {{recipient}},</p>` +
          `<p>The account for {{partner_company}} is now open. Here's what you can do in the portal.</p>` +
          `<ul>` +
          `<li>See current vacancies and letting terms in real time.</li>` +
          `<li>Refer clients and follow their progress.</li>` +
          `<li>Check commission on deals that have completed.</li>` +
          `<li>Download the documents you need.</li>` +
          `</ul>` +
          `<a class="btn" href="{{url}}">Open the portal</a>` +
          `<p class="muted">Your contact is {{contact_name}} on {{contact_phone}}. If anything gets in your way, call them directly.</p>`,
      },
      ja: {
        subject: "パートナーポータルのご利用案内",
        body:
          `<p class="lead">{{recipient}} ご担当者様</p>` +
          `<p>{{partner_company}} 様のアカウントを開設いたしました。ポータルでは下記のことが行えます。</p>` +
          `<ul>` +
          `<li>空室状況と賃貸条件をリアルタイムでご確認いただけます。</li>` +
          `<li>お客様をご紹介いただき、進捗を追跡できます。</li>` +
          `<li>ご成約分の手数料明細をご覧いただけます。</li>` +
          `<li>必要な書類をダウンロードいただけます。</li>` +
          `</ul>` +
          `<a class="btn" href="{{url}}">ポータルへ</a>` +
          `<p class="muted">担当は {{contact_name}}（{{contact_phone}}）です。実務でお困りの際は、直接ご連絡ください。</p>`,
      },
      zh: {
        subject: "合作伙伴门户使用指引",
        body:
          `<p class="lead">{{recipient}} 负责人，您好：</p>` +
          `<p>{{partner_company}} 的账户已开通。门户中可以完成以下事项。</p>` +
          `<ul>` +
          `<li>实时查看空置房源与租赁条件。</li>` +
          `<li>推荐客户并跟踪进展。</li>` +
          `<li>查看已成交案件的佣金明细。</li>` +
          `<li>下载所需文件。</li>` +
          `</ul>` +
          `<a class="btn" href="{{url}}">进入门户</a>` +
          `<p class="muted">对接人为 {{contact_name}}（{{contact_phone}}）。业务中如遇阻碍，请直接联系。</p>`,
      },
      th: {
        subject: "แนะนำการใช้งานพอร์ทัลพันธมิตร",
        body:
          `<p class="lead">เรียน ผู้ประสานงาน{{recipient}}</p>` +
          `<p>บัญชีของ {{partner_company}} เปิดใช้งานแล้ว ในพอร์ทัลท่านทำสิ่งเหล่านี้ได้</p>` +
          `<ul>` +
          `<li>ดูห้องว่างและเงื่อนไขการเช่าแบบเรียลไทม์</li>` +
          `<li>แนะนำลูกค้าและติดตามความคืบหน้า</li>` +
          `<li>ดูรายละเอียดค่าคอมมิชชันของดีลที่ปิดแล้ว</li>` +
          `<li>ดาวน์โหลดเอกสารที่ต้องใช้</li>` +
          `</ul>` +
          `<a class="btn" href="{{url}}">เข้าสู่พอร์ทัล</a>` +
          `<p class="muted">ผู้ประสานงานคือ {{contact_name}} ({{contact_phone}}) หากติดขัดระหว่างทำงาน ติดต่อได้โดยตรง</p>`,
      },
      vi: {
        subject: "Hướng dẫn dùng cổng đối tác",
        body:
          `<p class="lead">Kính gửi ông/bà {{recipient}},</p>` +
          `<p>Tài khoản của {{partner_company}} đã mở. Trên cổng, quý công ty có thể làm những việc sau.</p>` +
          `<ul>` +
          `<li>Xem phòng trống và điều kiện cho thuê theo thời gian thực.</li>` +
          `<li>Giới thiệu khách và theo dõi tiến độ.</li>` +
          `<li>Xem hoa hồng của các giao dịch đã hoàn tất.</li>` +
          `<li>Tải các tài liệu cần thiết.</li>` +
          `</ul>` +
          `<a class="btn" href="{{url}}">Vào cổng</a>` +
          `<p class="muted">Người phụ trách là {{contact_name}} ({{contact_phone}}). Vướng mắc gì trong công việc, xin liên hệ trực tiếp.</p>`,
      },
    },
  },

  {
    key: "agent.agreement_renewal",
    name: "제휴 계약 갱신 안내",
    description: "만료 전 갱신 제안. 지난 기간 실적을 함께 보여 협의 근거로 삼는다.",
    vars: vars("recipient", "partner_company", "end_date", "referrals_count", "commission_total", "new_terms", "reply_by", "url"),
    tr: {
      ko: {
        subject: "제휴 계약 갱신 안내 ({{partner_company}})",
        body:
          `<p class="lead">{{recipient}} 담당자님, 안녕하세요.</p>` +
          `<p>{{partner_company}}와의 제휴 계약이 {{end_date}}에 만료됩니다.</p>` +
          `<table class="kv">` +
          `<tr><td class="k">지난 기간 소개</td><td>{{referrals_count}}건</td></tr>` +
          `<tr><td class="k">지급 수수료</td><td>{{commission_total}}</td></tr></table>` +
          `<div class="box"><div class="label">갱신 조건</div><div>{{new_terms}}</div></div>` +
          `<p>{{reply_by}}까지 의향을 알려 주시면 새 계약서를 준비하겠습니다. 조건을 조정하고 싶으시면 편하게 말씀해 주세요.</p>` +
          `<a class="btn" href="{{url}}">갱신 여부 알리기</a>` +
          `<p class="muted">회신이 없으면 만료일에 제휴가 종료되며 포털 접속도 함께 닫힙니다.</p>`,
      },
      en: {
        subject: "Renewing our partnership with {{partner_company}}",
        body:
          `<p class="lead">Dear {{recipient}},</p>` +
          `<p>Our agreement with {{partner_company}} ends on {{end_date}}.</p>` +
          `<table class="kv">` +
          `<tr><td class="k">Referrals in the period</td><td>{{referrals_count}}</td></tr>` +
          `<tr><td class="k">Commission paid</td><td>{{commission_total}}</td></tr></table>` +
          `<div class="box"><div class="label">Renewal terms</div><div>{{new_terms}}</div></div>` +
          `<p>Let us know by {{reply_by}} and we'll draw up the new agreement. If you'd like to renegotiate the terms, say so.</p>` +
          `<a class="btn" href="{{url}}">Tell us your decision</a>` +
          `<p class="muted">Without a reply, the partnership ends on the expiry date and portal access closes with it.</p>`,
      },
      ja: {
        subject: "提携契約更新のご案内（{{partner_company}}）",
        body:
          `<p class="lead">{{recipient}} ご担当者様</p>` +
          `<p>{{partner_company}} 様との提携契約は {{end_date}} に満了いたします。</p>` +
          `<table class="kv">` +
          `<tr><td class="k">期間中のご紹介</td><td>{{referrals_count}} 件</td></tr>` +
          `<tr><td class="k">お支払い手数料</td><td>{{commission_total}}</td></tr></table>` +
          `<div class="box"><div class="label">更新条件</div><div>{{new_terms}}</div></div>` +
          `<p>{{reply_by}} までにご意向をお知らせいただければ、新しい契約書をご用意いたします。条件のご相談をご希望でしたら、お気軽にお申し付けください。</p>` +
          `<a class="btn" href="{{url}}">更新のご意向を伝える</a>` +
          `<p class="muted">ご返信がない場合、満了日をもって提携が終了し、ポータルへのアクセスも閉じられます。</p>`,
      },
      zh: {
        subject: "合作协议续签通知（{{partner_company}}）",
        body:
          `<p class="lead">{{recipient}} 负责人，您好：</p>` +
          `<p>我们与 {{partner_company}} 的合作协议将于 {{end_date}} 到期。</p>` +
          `<table class="kv">` +
          `<tr><td class="k">本期推荐</td><td>{{referrals_count}} 件</td></tr>` +
          `<tr><td class="k">已付佣金</td><td>{{commission_total}}</td></tr></table>` +
          `<div class="box"><div class="label">续签条件</div><div>{{new_terms}}</div></div>` +
          `<p>请在 {{reply_by}} 前告知意向，我们会着手准备新协议。若希望调整条件，也请直接提出。</p>` +
          `<a class="btn" href="{{url}}">告知续签意向</a>` +
          `<p class="muted">若未收到回复，合作将于到期日终止，门户访问权限同时关闭。</p>`,
      },
      th: {
        subject: "แจ้งการต่อสัญญาความร่วมมือ ({{partner_company}})",
        body:
          `<p class="lead">เรียน ผู้ประสานงาน{{recipient}}</p>` +
          `<p>สัญญาความร่วมมือกับ {{partner_company}} จะสิ้นสุดในวันที่ {{end_date}}</p>` +
          `<table class="kv">` +
          `<tr><td class="k">การแนะนำในช่วงที่ผ่านมา</td><td>{{referrals_count}} ราย</td></tr>` +
          `<tr><td class="k">ค่าคอมมิชชันที่จ่ายแล้ว</td><td>{{commission_total}}</td></tr></table>` +
          `<div class="box"><div class="label">เงื่อนไขการต่อสัญญา</div><div>{{new_terms}}</div></div>` +
          `<p>แจ้งความประสงค์ภายใน {{reply_by}} เราจะจัดเตรียมสัญญาฉบับใหม่ให้ หากต้องการปรับเงื่อนไข แจ้งได้ตามสะดวก</p>` +
          `<a class="btn" href="{{url}}">แจ้งความประสงค์</a>` +
          `<p class="muted">หากไม่ได้รับการตอบกลับ ความร่วมมือจะสิ้นสุดในวันครบกำหนด และสิทธิ์เข้าพอร์ทัลจะปิดตามไปด้วย</p>`,
      },
      vi: {
        subject: "Gia hạn hợp tác với {{partner_company}}",
        body:
          `<p class="lead">Kính gửi ông/bà {{recipient}},</p>` +
          `<p>Hợp đồng hợp tác với {{partner_company}} sẽ hết hạn ngày {{end_date}}.</p>` +
          `<table class="kv">` +
          `<tr><td class="k">Số khách giới thiệu</td><td>{{referrals_count}}</td></tr>` +
          `<tr><td class="k">Hoa hồng đã trả</td><td>{{commission_total}}</td></tr></table>` +
          `<div class="box"><div class="label">Điều kiện gia hạn</div><div>{{new_terms}}</div></div>` +
          `<p>Xin phản hồi trước {{reply_by}} để chúng tôi soạn hợp đồng mới. Nếu muốn thương lượng lại điều khoản, xin cứ nêu.</p>` +
          `<a class="btn" href="{{url}}">Cho biết quyết định</a>` +
          `<p class="muted">Không có phản hồi, hợp tác sẽ kết thúc vào ngày hết hạn và quyền truy cập cổng cũng đóng theo.</p>`,
      },
    },
  },

  {
    key: "agent.inactive",
    name: "무실적 파트너 재활성 안내",
    description: "90일 무실적. 책망하지 않고 걸림돌을 묻는 어조로 쓴다.",
    vars: vars("recipient", "partner_company", "days_inactive", "contact_name", "contact_phone", "url"),
    tr: {
      ko: {
        subject: "근황을 여쭙습니다 ({{partner_company}})",
        body:
          `<p class="lead">{{recipient}} 담당자님, 안녕하세요.</p>` +
          `<p>{{partner_company}}에서 고객을 소개해 주신 지 {{days_inactive}}일 정도 되어 안부 여쭙습니다.</p>` +
          `<p>저희 쪽 매물이나 조건이 맞지 않았거나 포털이 쓰기 불편하셨을 수도 있겠습니다. 어떤 부분이 걸리는지 알려 주시면 맞춰 보겠습니다.</p>` +
          `<a class="btn" href="{{url}}">현재 매물 보기</a>` +
          `<p class="muted">{{contact_name}} ({{contact_phone}})에게 편하게 말씀해 주세요. 당분간 소개가 어려우시면 그 사정을 알려 주셔도 좋습니다.</p>`,
      },
      en: {
        subject: "Checking in with {{partner_company}}",
        body:
          `<p class="lead">Dear {{recipient}},</p>` +
          `<p>It's been about {{days_inactive}} days since {{partner_company}} last referred a client, so we thought we'd get in touch.</p>` +
          `<p>Perhaps our stock or terms haven't suited your clients, or the portal has been awkward to use. Tell us what's getting in the way and we'll try to work with it.</p>` +
          `<a class="btn" href="{{url}}">See what's available</a>` +
          `<p class="muted">Speak to {{contact_name}} on {{contact_phone}}. If referrals just aren't possible for now, that's useful to know too.</p>`,
      },
      ja: {
        subject: "その後のご様子をお伺いいたします（{{partner_company}}）",
        body:
          `<p class="lead">{{recipient}} ご担当者様</p>` +
          `<p>{{partner_company}} 様よりお客様をご紹介いただいてから {{days_inactive}} 日ほど経ちましたので、ご様子をお伺いいたします。</p>` +
          `<p>弊社の物件や条件がお客様に合わなかったのかもしれませんし、ポータルが使いにくかったのかもしれません。お差し支えなければ、どのあたりが障りになっているかお聞かせください。できる範囲で合わせてまいります。</p>` +
          `<a class="btn" href="{{url}}">現在の物件を見る</a>` +
          `<p class="muted">{{contact_name}}（{{contact_phone}}）まで、お気軽にお申し付けください。しばらくご紹介が難しいご事情であれば、それをお知らせいただくだけでも助かります。</p>`,
      },
      zh: {
        subject: "近来可好（{{partner_company}}）",
        body:
          `<p class="lead">{{recipient}} 负责人，您好：</p>` +
          `<p>距 {{partner_company}} 上次推荐客户已约 {{days_inactive}} 天，特此问候。</p>` +
          `<p>或许是我们的房源、条件与您的客户不匹配，也可能是门户用起来不够顺手。若方便，请告诉我们症结所在，我们会尽量配合调整。</p>` +
          `<a class="btn" href="{{url}}">查看现有房源</a>` +
          `<p class="muted">请随时联系 {{contact_name}}（{{contact_phone}}）。若近期确实不便推荐，告知我们这一情况也很有帮助。</p>`,
      },
      th: {
        subject: "ช่วงนี้เป็นอย่างไรบ้าง ({{partner_company}})",
        body:
          `<p class="lead">เรียน ผู้ประสานงาน{{recipient}}</p>` +
          `<p>ผ่านมาราว {{days_inactive}} วันนับจากที่ {{partner_company}} แนะนำลูกค้าครั้งล่าสุด เราจึงขอทักทายสอบถาม</p>` +
          `<p>อาจเป็นเพราะห้องพักหรือเงื่อนไขของเรายังไม่ตรงกับลูกค้าของท่าน หรือพอร์ทัลใช้งานไม่สะดวก หากสะดวก กรุณาบอกเราว่าติดขัดตรงไหน เราจะพยายามปรับให้</p> ` +
          `<a class="btn" href="{{url}}">ดูห้องพักที่มีอยู่</a>` +
          `<p class="muted">ติดต่อ {{contact_name}} ({{contact_phone}}) ได้ตามสะดวก หากช่วงนี้ยังแนะนำลูกค้าไม่ได้ เพียงแจ้งให้ทราบก็เป็นประโยชน์กับเราแล้ว</p>`,
      },
      vi: {
        subject: "Hỏi thăm {{partner_company}}",
        body:
          `<p class="lead">Kính gửi ông/bà {{recipient}},</p>` +
          `<p>Đã khoảng {{days_inactive}} ngày kể từ lần {{partner_company}} giới thiệu khách gần nhất, nên chúng tôi xin hỏi thăm.</p>` +
          `<p>Có thể nguồn phòng hay điều kiện của chúng tôi chưa hợp với khách của quý công ty, hoặc cổng đối tác dùng chưa thuận tiện. Nếu tiện, xin cho biết vướng ở đâu để chúng tôi điều chỉnh.</p>` +
          `<a class="btn" href="{{url}}">Xem phòng hiện có</a>` +
          `<p class="muted">Xin cứ trao đổi với {{contact_name}} ({{contact_phone}}). Nếu thời gian này chưa thể giới thiệu khách, cho chúng tôi biết cũng đã rất hữu ích.</p>`,
      },
    },
  },
];
