// customer — 계약 체결·서명 (contract.*)
//
// ⚠️ 키 주의: kind=contract 에 이미 `contract.terms`(약관 본문)가 있다. 유니크는
// (kind, key) 라 충돌하지 않지만, Studio 목록에서 헷갈리지 않도록 이름을 명확히 둔다.
//
// 전자서명은 31일 이하 계약에만 열려 있다(docs 계약서 발행 흐름). 그보다 긴 계약은
// 서명본 스캔 보관 경로를 타므로 signature_request 를 보내지 않는다 — 발송부 조건 확인.
// 한국어는 humanize-korean 통과본. 영어에서 재기계번역 금지.
import { vars } from "./_shared.mjs";

export const CUSTOMER_CONTRACT = [
  {
    key: "contract.signature_request",
    name: "계약서 전자서명 요청",
    description: "전자서명 링크 발송. 링크는 무로그인 토큰이므로 만료와 취급 주의를 함께 알린다.",
    vars: vars("recipient", "ref", "contract_name", "url", "expiry_date", "space_name"),
    tr: {
      ko: {
        subject: "계약서에 서명해 주세요 ({{ref}})",
        body:
          `<p class="lead">{{recipient}} 님, 안녕하세요.</p>` +
          `<p>{{space_name}} {{contract_name}}를 준비했습니다. 아래에서 내용을 확인하고 서명해 주세요.</p>` +
          `<table class="kv"><tr><td class="k">계약번호</td><td>{{ref}}</td></tr></table>` +
          `<a class="btn" href="{{url}}">계약서 확인하고 서명하기</a>` +
          `<p>서명하시면 쌍방 서명본을 바로 보내 드립니다. 별도 프로그램을 설치하지 않아도 되고 휴대폰에서도 됩니다.</p>` +
          `<p class="muted">이 링크는 {{expiry_date}}까지 열려 있으며 받으신 분만 쓰실 수 있습니다. 다른 분에게 전달하지 마세요.</p>`,
      },
      en: {
        subject: "Please sign your agreement ({{ref}})",
        body:
          `<p class="lead">Hi {{recipient}},</p>` +
          `<p>Your {{contract_name}} for {{space_name}} is ready. Please read it through and sign below.</p>` +
          `<table class="kv"><tr><td class="k">Agreement</td><td>{{ref}}</td></tr></table>` +
          `<a class="btn" href="{{url}}">Read and sign</a>` +
          `<p>As soon as you sign, we'll send you the fully signed copy. Nothing to install, and it works on a phone.</p>` +
          `<p class="muted">The link stays open until {{expiry_date}} and is meant only for you. Please don't forward it.</p>`,
      },
      ja: {
        subject: "契約書へのご署名のお願い（{{ref}}）",
        body:
          `<p class="lead">{{recipient}} 様</p>` +
          `<p>{{space_name}} の{{contract_name}}をご用意いたしました。内容をご確認のうえ、下記よりご署名ください。</p>` +
          `<table class="kv"><tr><td class="k">契約番号</td><td>{{ref}}</td></tr></table>` +
          `<a class="btn" href="{{url}}">契約書を確認して署名する</a>` +
          `<p>ご署名いただき次第、双方署名済みの控えをお送りいたします。専用ソフトは不要で、スマートフォンからもご利用いただけます。</p>` +
          `<p class="muted">このリンクは {{expiry_date}} まで有効で、お受け取りになったご本人様専用です。第三者への転送はお控えください。</p>`,
      },
      zh: {
        subject: "请签署合同（{{ref}}）",
        body:
          `<p class="lead">{{recipient}} 您好，</p>` +
          `<p>{{space_name}} 的{{contract_name}}已准备好，请查阅内容并在下方签署。</p>` +
          `<table class="kv"><tr><td class="k">合同编号</td><td>{{ref}}</td></tr></table>` +
          `<a class="btn" href="{{url}}">查看并签署</a>` +
          `<p>您签署后，我们会立即发送双方签署完成的文本。无需安装任何软件，手机上也可以操作。</p>` +
          `<p class="muted">链接有效期至 {{expiry_date}}，仅供收件人本人使用，请勿转发他人。</p>`,
      },
      th: {
        subject: "กรุณาลงนามในสัญญา ({{ref}})",
        body:
          `<p class="lead">เรียน คุณ{{recipient}}</p>` +
          `<p>{{contract_name}}สำหรับ {{space_name}} พร้อมแล้ว กรุณาอ่านรายละเอียดและลงนามด้านล่าง</p>` +
          `<table class="kv"><tr><td class="k">เลขที่สัญญา</td><td>{{ref}}</td></tr></table>` +
          `<a class="btn" href="{{url}}">อ่านและลงนาม</a>` +
          `<p>เมื่อท่านลงนามแล้ว เราจะส่งฉบับที่ลงนามครบทั้งสองฝ่ายให้ทันที ไม่ต้องติดตั้งโปรแกรมใด ๆ และใช้บนมือถือได้</p>` +
          `<p class="muted">ลิงก์นี้เปิดถึงวันที่ {{expiry_date}} และใช้ได้เฉพาะผู้รับเท่านั้น กรุณาอย่าส่งต่อให้ผู้อื่น</p>`,
      },
      vi: {
        subject: "Xin Quý khách ký hợp đồng ({{ref}})",
        body:
          `<p class="lead">Kính gửi {{recipient}},</p>` +
          `<p>{{contract_name}} cho {{space_name}} đã sẵn sàng. Xin Quý khách đọc kỹ và ký ở bên dưới.</p>` +
          `<table class="kv"><tr><td class="k">Số hợp đồng</td><td>{{ref}}</td></tr></table>` +
          `<a class="btn" href="{{url}}">Đọc và ký</a>` +
          `<p>Ngay khi Quý khách ký, chúng tôi sẽ gửi bản có đủ chữ ký hai bên. Không cần cài đặt gì và có thể ký trên điện thoại.</p>` +
          `<p class="muted">Liên kết mở đến ngày {{expiry_date}} và chỉ dành riêng cho Quý khách. Xin đừng chuyển tiếp cho người khác.</p>`,
      },
    },
  },

  {
    key: "contract.signature_reminder",
    name: "계약서 서명 독촉",
    description: "미서명 2일·5일 후. 서명이 늦어지면 무엇이 밀리는지 알려 준다.",
    vars: vars("recipient", "ref", "contract_name", "url", "expiry_date", "blocked_step"),
    tr: {
      ko: {
        subject: "아직 서명이 완료되지 않았습니다 ({{ref}})",
        body:
          `<p class="lead">{{recipient}} 님, 안녕하세요.</p>` +
          `<p>보내 드린 {{contract_name}}에 아직 서명이 되지 않아 다시 안내드립니다.</p>` +
          `<a class="btn" href="{{url}}">계약서 확인하고 서명하기</a>` +
          `<p>서명이 끝나야 {{blocked_step}}(으)로 넘어갈 수 있습니다.</p>` +
          `<p class="muted">링크는 {{expiry_date}}까지 열려 있습니다. 내용 중 조정이 필요한 부분이 있으면 서명 대신 답장을 주세요.</p>`,
      },
      en: {
        subject: "Your agreement is still unsigned ({{ref}})",
        body:
          `<p class="lead">Hi {{recipient}},</p>` +
          `<p>The {{contract_name}} we sent hasn't been signed yet, so here's a nudge.</p>` +
          `<a class="btn" href="{{url}}">Read and sign</a>` +
          `<p>We can't move on to {{blocked_step}} until it's signed.</p>` +
          `<p class="muted">The link is open until {{expiry_date}}. If something in the agreement needs adjusting, reply instead of signing.</p>`,
      },
      ja: {
        subject: "契約書へのご署名がまだ完了しておりません（{{ref}}）",
        body:
          `<p class="lead">{{recipient}} 様</p>` +
          `<p>お送りした{{contract_name}}へのご署名がまだ確認できておりませんので、改めてご案内いたします。</p>` +
          `<a class="btn" href="{{url}}">契約書を確認して署名する</a>` +
          `<p>ご署名が完了しませんと、{{blocked_step}}へ進むことができません。</p>` +
          `<p class="muted">リンクは {{expiry_date}} まで有効です。内容に調整が必要な点がございましたら、ご署名の前にご返信ください。</p>`,
      },
      zh: {
        subject: "合同尚未完成签署（{{ref}}）",
        body:
          `<p class="lead">{{recipient}} 您好，</p>` +
          `<p>我们发送的{{contract_name}}尚未收到您的签署，特此再次提醒。</p>` +
          `<a class="btn" href="{{url}}">查看并签署</a>` +
          `<p>签署完成后，我们才能进入{{blocked_step}}环节。</p>` +
          `<p class="muted">链接有效期至 {{expiry_date}}。如合同内容需要调整，请先回复本邮件，暂不签署。</p>`,
      },
      th: {
        subject: "ยังไม่ได้ลงนามในสัญญา ({{ref}})",
        body:
          `<p class="lead">เรียน คุณ{{recipient}}</p>` +
          `<p>{{contract_name}}ที่เราส่งไปยังไม่ได้รับการลงนาม จึงขอแจ้งเตือนอีกครั้ง</p>` +
          `<a class="btn" href="{{url}}">อ่านและลงนาม</a>` +
          `<p>เมื่อลงนามเรียบร้อยแล้ว เราจึงจะดำเนินการ{{blocked_step}}ต่อได้</p>` +
          `<p class="muted">ลิงก์เปิดถึงวันที่ {{expiry_date}} หากมีข้อใดในสัญญาที่ต้องปรับ กรุณาตอบกลับก่อนลงนาม</p>`,
      },
      vi: {
        subject: "Hợp đồng vẫn chưa được ký ({{ref}})",
        body:
          `<p class="lead">Kính gửi {{recipient}},</p>` +
          `<p>{{contract_name}} chúng tôi gửi vẫn chưa được ký, nên xin nhắc lại.</p>` +
          `<a class="btn" href="{{url}}">Đọc và ký</a>` +
          `<p>Phải ký xong chúng tôi mới chuyển sang bước {{blocked_step}} được.</p>` +
          `<p class="muted">Liên kết mở đến ngày {{expiry_date}}. Nếu cần điều chỉnh nội dung nào, xin trả lời email thay vì ký.</p>`,
      },
    },
  },

  {
    key: "contract.signed_copy",
    name: "서명 완료 — 쌍방 서명본 송부",
    description: "양측 서명이 끝났을 때. 서명본 PDF 를 첨부하고 다음 절차를 안내한다.",
    vars: vars("recipient", "ref", "contract_name", "start_date", "end_date", "next_step", "url"),
    tr: {
      ko: {
        subject: "서명이 완료되었습니다 ({{ref}})",
        body:
          `<p class="lead">{{recipient}} 님, 안녕하세요.</p>` +
          `<p>양측 서명이 모두 끝나 {{contract_name}}가 성립되었습니다. 서명본을 첨부해 드립니다.</p>` +
          `<table class="kv">` +
          `<tr><td class="k">계약번호</td><td>{{ref}}</td></tr>` +
          `<tr><td class="k">계약 기간</td><td>{{start_date}} ~ {{end_date}}</td></tr></table>` +
          `<div class="box"><div class="label">다음 절차</div><div>{{next_step}}</div></div>` +
          `<a class="btn" href="{{url}}">계약 내역 보기</a>` +
          `<p class="muted">서명본은 계약 내역에서 언제든 다시 받으실 수 있습니다.</p>`,
      },
      en: {
        subject: "Your agreement is signed ({{ref}})",
        body:
          `<p class="lead">Hi {{recipient}},</p>` +
          `<p>Both parties have signed, so the {{contract_name}} is now in force. The signed copy is attached.</p>` +
          `<table class="kv">` +
          `<tr><td class="k">Agreement</td><td>{{ref}}</td></tr>` +
          `<tr><td class="k">Term</td><td>{{start_date}} – {{end_date}}</td></tr></table>` +
          `<div class="box"><div class="label">What happens next</div><div>{{next_step}}</div></div>` +
          `<a class="btn" href="{{url}}">View your agreement</a>` +
          `<p class="muted">You can download the signed copy again from your agreement page at any time.</p>`,
      },
      ja: {
        subject: "ご署名が完了いたしました（{{ref}}）",
        body:
          `<p class="lead">{{recipient}} 様</p>` +
          `<p>双方のご署名が完了し、{{contract_name}}が成立いたしました。署名済みの控えを添付いたします。</p>` +
          `<table class="kv">` +
          `<tr><td class="k">契約番号</td><td>{{ref}}</td></tr>` +
          `<tr><td class="k">契約期間</td><td>{{start_date}} ～ {{end_date}}</td></tr></table>` +
          `<div class="box"><div class="label">次のお手続き</div><div>{{next_step}}</div></div>` +
          `<a class="btn" href="{{url}}">契約内容を確認する</a>` +
          `<p class="muted">署名済みの控えは、契約内容のページからいつでも再取得いただけます。</p>`,
      },
      zh: {
        subject: "合同签署完成（{{ref}}）",
        body:
          `<p class="lead">{{recipient}} 您好，</p>` +
          `<p>双方均已签署，{{contract_name}}正式生效。随附签署完成的文本。</p>` +
          `<table class="kv">` +
          `<tr><td class="k">合同编号</td><td>{{ref}}</td></tr>` +
          `<tr><td class="k">合同期间</td><td>{{start_date}} 至 {{end_date}}</td></tr></table>` +
          `<div class="box"><div class="label">后续步骤</div><div>{{next_step}}</div></div>` +
          `<a class="btn" href="{{url}}">查看合同详情</a>` +
          `<p class="muted">签署文本可随时在合同详情页重新下载。</p>`,
      },
      th: {
        subject: "ลงนามในสัญญาครบถ้วนแล้ว ({{ref}})",
        body:
          `<p class="lead">เรียน คุณ{{recipient}}</p>` +
          `<p>ทั้งสองฝ่ายลงนามครบแล้ว {{contract_name}}จึงมีผลบังคับใช้ แนบฉบับที่ลงนามแล้วมาด้วย</p>` +
          `<table class="kv">` +
          `<tr><td class="k">เลขที่สัญญา</td><td>{{ref}}</td></tr>` +
          `<tr><td class="k">ระยะเวลา</td><td>{{start_date}} ถึง {{end_date}}</td></tr></table>` +
          `<div class="box"><div class="label">ขั้นตอนถัดไป</div><div>{{next_step}}</div></div>` +
          `<a class="btn" href="{{url}}">ดูรายละเอียดสัญญา</a>` +
          `<p class="muted">ท่านดาวน์โหลดฉบับที่ลงนามซ้ำได้ตลอดจากหน้ารายละเอียดสัญญา</p>`,
      },
      vi: {
        subject: "Hợp đồng đã được ký đầy đủ ({{ref}})",
        body:
          `<p class="lead">Kính gửi {{recipient}},</p>` +
          `<p>Hai bên đã ký xong nên {{contract_name}} chính thức có hiệu lực. Bản đã ký được đính kèm.</p>` +
          `<table class="kv">` +
          `<tr><td class="k">Số hợp đồng</td><td>{{ref}}</td></tr>` +
          `<tr><td class="k">Thời hạn</td><td>{{start_date}} – {{end_date}}</td></tr></table>` +
          `<div class="box"><div class="label">Bước tiếp theo</div><div>{{next_step}}</div></div>` +
          `<a class="btn" href="{{url}}">Xem chi tiết hợp đồng</a>` +
          `<p class="muted">Quý khách có thể tải lại bản đã ký bất cứ lúc nào từ trang chi tiết hợp đồng.</p>`,
      },
    },
  },

  {
    key: "contract.countersigned",
    name: "회사 날인 완료",
    description: "고객이 먼저 서명하고 회사 날인이 나중에 끝나는 경우의 통보.",
    vars: vars("recipient", "ref", "contract_name", "date", "url"),
    tr: {
      ko: {
        subject: "회사 날인이 완료되었습니다 ({{ref}})",
        body:
          `<p class="lead">{{recipient}} 님, 안녕하세요.</p>` +
          `<p>먼저 서명해 주신 {{contract_name}}에 {{date}} 회사 날인을 마쳤습니다. 이로써 계약이 완전히 성립되었습니다.</p>` +
          `<p>날인까지 끝난 최종본을 첨부해 드립니다.</p>` +
          `<a class="btn" href="{{url}}">계약 내역 보기</a>` +
          `<p class="muted">보관용으로 내려받아 두시면 좋습니다.</p>`,
      },
      en: {
        subject: "We've countersigned your agreement ({{ref}})",
        body:
          `<p class="lead">Hi {{recipient}},</p>` +
          `<p>The {{contract_name}} you signed was countersigned on our side on {{date}}, so the agreement is now complete.</p>` +
          `<p>The final, fully executed copy is attached.</p>` +
          `<a class="btn" href="{{url}}">View your agreement</a>` +
          `<p class="muted">Worth downloading a copy for your records.</p>`,
      },
      ja: {
        subject: "当社の押印が完了いたしました（{{ref}}）",
        body:
          `<p class="lead">{{recipient}} 様</p>` +
          `<p>先にご署名いただきました{{contract_name}}につきまして、{{date}} に当社の押印を完了いたしました。これをもって契約が成立いたしました。</p>` +
          `<p>押印済みの最終版を添付いたします。</p>` +
          `<a class="btn" href="{{url}}">契約内容を確認する</a>` +
          `<p class="muted">保管用にダウンロードしておかれることをお勧めいたします。</p>`,
      },
      zh: {
        subject: "我方已完成盖章（{{ref}}）",
        body:
          `<p class="lead">{{recipient}} 您好，</p>` +
          `<p>您先前签署的{{contract_name}}，我方已于 {{date}} 完成盖章，合同至此正式成立。</p>` +
          `<p>随附盖章完成的最终文本。</p>` +
          `<a class="btn" href="{{url}}">查看合同详情</a>` +
          `<p class="muted">建议下载一份留存备查。</p>`,
      },
      th: {
        subject: "บริษัทลงนามและประทับตราแล้ว ({{ref}})",
        body:
          `<p class="lead">เรียน คุณ{{recipient}}</p>` +
          `<p>{{contract_name}}ที่ท่านลงนามไว้ก่อนหน้านี้ ทางบริษัทได้ลงนามและประทับตราเมื่อวันที่ {{date}} สัญญาจึงสมบูรณ์แล้ว</p>` +
          `<p>แนบฉบับสมบูรณ์ที่ประทับตราแล้วมาด้วย</p>` +
          `<a class="btn" href="{{url}}">ดูรายละเอียดสัญญา</a>` +
          `<p class="muted">แนะนำให้ดาวน์โหลดเก็บไว้เป็นหลักฐาน</p>`,
      },
      vi: {
        subject: "Chúng tôi đã ký đóng dấu hợp đồng ({{ref}})",
        body:
          `<p class="lead">Kính gửi {{recipient}},</p>` +
          `<p>{{contract_name}} Quý khách đã ký nay được phía chúng tôi ký đóng dấu vào ngày {{date}}. Hợp đồng đã hoàn tất.</p>` +
          `<p>Bản cuối cùng có đầy đủ chữ ký và con dấu được đính kèm.</p>` +
          `<a class="btn" href="{{url}}">Xem chi tiết hợp đồng</a>` +
          `<p class="muted">Quý khách nên tải về lưu giữ.</p>`,
      },
    },
  },

  {
    key: "contract.renewal_offer",
    name: "계약 갱신 안내",
    description: "만료 60일 전. 갱신 조건과 회신 기한을 분명히 하고, 무응답 시 처리를 밝힌다.",
    vars: vars("recipient", "ref", "space_name", "end_date", "new_terms", "reply_by", "url"),
    tr: {
      ko: {
        subject: "계약 갱신 안내 ({{space_name}})",
        body:
          `<p class="lead">{{recipient}} 님, 안녕하세요.</p>` +
          `<p>{{space_name}} 계약이 {{end_date}}에 만료됩니다. 계속 지내실 생각이라면 아래 조건으로 갱신해 드리겠습니다.</p>` +
          `<div class="box"><div class="label">갱신 조건</div><div>{{new_terms}}</div></div>` +
          `<p>{{reply_by}}까지 알려 주시면 새 계약서를 준비하겠습니다.</p>` +
          `<a class="btn" href="{{url}}">갱신 여부 알리기</a>` +
          `<p class="muted">회신이 없으면 만료일에 계약이 종료되는 것으로 보고 퇴거 절차를 안내드립니다. 조건을 조정하고 싶으시면 편하게 말씀해 주세요.</p>`,
      },
      en: {
        subject: "Renewing your agreement for {{space_name}}",
        body:
          `<p class="lead">Hi {{recipient}},</p>` +
          `<p>Your agreement for {{space_name}} ends on {{end_date}}. If you'd like to stay on, here are the terms we can offer.</p>` +
          `<div class="box"><div class="label">Renewal terms</div><div>{{new_terms}}</div></div>` +
          `<p>Let us know by {{reply_by}} and we'll draw up the new agreement.</p>` +
          `<a class="btn" href="{{url}}">Tell us your decision</a>` +
          `<p class="muted">Without a reply we'll treat the agreement as ending on the expiry date and send move-out instructions. If you'd like to discuss the terms, just say so.</p>`,
      },
      ja: {
        subject: "契約更新のご案内（{{space_name}}）",
        body:
          `<p class="lead">{{recipient}} 様</p>` +
          `<p>{{space_name}} のご契約は {{end_date}} に満了いたします。引き続きご利用をお考えでしたら、下記の条件にて更新を承ります。</p>` +
          `<div class="box"><div class="label">更新条件</div><div>{{new_terms}}</div></div>` +
          `<p>{{reply_by}} までにお知らせいただければ、新しい契約書をご用意いたします。</p>` +
          `<a class="btn" href="{{url}}">更新のご意向を伝える</a>` +
          `<p class="muted">ご返信がない場合は満了日をもって契約終了と判断し、ご退去の手続きをご案内いたします。条件のご相談をご希望でしたら、お気軽にお申し付けください。</p>`,
      },
      zh: {
        subject: "合同续签通知（{{space_name}}）",
        body:
          `<p class="lead">{{recipient}} 您好，</p>` +
          `<p>{{space_name}} 的合同将于 {{end_date}} 到期。若您希望继续居住，我们可按以下条件为您续签。</p>` +
          `<div class="box"><div class="label">续签条件</div><div>{{new_terms}}</div></div>` +
          `<p>请在 {{reply_by}} 前告知我们，我们会着手准备新合同。</p>` +
          `<a class="btn" href="{{url}}">告知续签意向</a>` +
          `<p class="muted">若未收到回复，我们将视为合同于到期日终止，并向您说明退租流程。如希望商谈条件，请随时告知。</p>`,
      },
      th: {
        subject: "แจ้งการต่อสัญญา ({{space_name}})",
        body:
          `<p class="lead">เรียน คุณ{{recipient}}</p>` +
          `<p>สัญญาสำหรับ {{space_name}} จะสิ้นสุดในวันที่ {{end_date}} หากท่านประสงค์จะอยู่ต่อ เรายินดีต่อสัญญาตามเงื่อนไขด้านล่าง</p>` +
          `<div class="box"><div class="label">เงื่อนไขการต่อสัญญา</div><div>{{new_terms}}</div></div>` +
          `<p>กรุณาแจ้งภายในวันที่ {{reply_by}} เราจะจัดเตรียมสัญญาฉบับใหม่ให้</p>` +
          `<a class="btn" href="{{url}}">แจ้งความประสงค์</a>` +
          `<p class="muted">หากไม่ได้รับการตอบกลับ เราจะถือว่าสัญญาสิ้นสุดในวันครบกำหนดและจะแจ้งขั้นตอนการย้ายออก หากต้องการเจรจาเงื่อนไข แจ้งได้ตามสะดวก</p>`,
      },
      vi: {
        subject: "Thông báo gia hạn hợp đồng ({{space_name}})",
        body:
          `<p class="lead">Kính gửi {{recipient}},</p>` +
          `<p>Hợp đồng cho {{space_name}} sẽ hết hạn ngày {{end_date}}. Nếu Quý khách muốn ở tiếp, chúng tôi xin đề xuất các điều kiện sau.</p>` +
          `<div class="box"><div class="label">Điều kiện gia hạn</div><div>{{new_terms}}</div></div>` +
          `<p>Xin Quý khách phản hồi trước ngày {{reply_by}} để chúng tôi soạn hợp đồng mới.</p>` +
          `<a class="btn" href="{{url}}">Cho biết quyết định</a>` +
          `<p class="muted">Nếu không nhận được phản hồi, chúng tôi coi hợp đồng kết thúc vào ngày hết hạn và sẽ gửi hướng dẫn trả nhà. Nếu muốn trao đổi về điều kiện, xin cứ cho biết.</p>`,
      },
    },
  },

  {
    key: "contract.terminated",
    name: "계약 해지 확인",
    description: "중도 해지나 만료 종료의 확인. 보증금 정산 일정과 남은 의무를 함께 알린다.",
    vars: vars("recipient", "ref", "space_name", "end_date", "settlement_date", "url"),
    tr: {
      ko: {
        subject: "계약이 종료되었습니다 ({{ref}})",
        body:
          `<p class="lead">{{recipient}} 님, 안녕하세요.</p>` +
          `<p>{{space_name}} 계약이 {{end_date}}에 종료되었습니다.</p>` +
          `<p>보증금 정산은 퇴거 점검을 마친 뒤 {{settlement_date}}까지 처리해 드립니다. 정산 내역서를 따로 보내 드리니 확인해 주세요.</p>` +
          `<a class="btn" href="{{url}}">계약 내역 보기</a>` +
          `<p class="muted">그동안 이용해 주셔서 감사합니다. 다시 찾아 주시면 반갑게 맞이하겠습니다.</p>`,
      },
      en: {
        subject: "Your agreement has ended ({{ref}})",
        body:
          `<p class="lead">Hi {{recipient}},</p>` +
          `<p>Your agreement for {{space_name}} ended on {{end_date}}.</p>` +
          `<p>Once the move-out inspection is done, we'll settle the bond by {{settlement_date}}. A statement will follow separately for you to check.</p>` +
          `<a class="btn" href="{{url}}">View your agreement</a>` +
          `<p class="muted">Thank you for staying with us. You'd be very welcome back.</p>`,
      },
      ja: {
        subject: "ご契約が終了いたしました（{{ref}}）",
        body:
          `<p class="lead">{{recipient}} 様</p>` +
          `<p>{{space_name}} のご契約は {{end_date}} をもって終了いたしました。</p>` +
          `<p>敷金の精算は、退去時のお立ち会い確認のうえ {{settlement_date}} までに対応いたします。精算明細は別途お送りいたしますので、ご確認ください。</p>` +
          `<a class="btn" href="{{url}}">契約内容を確認する</a>` +
          `<p class="muted">これまでご利用いただき、誠にありがとうございました。またのお越しを心よりお待ちしております。</p>`,
      },
      zh: {
        subject: "您的合同已终止（{{ref}}）",
        body:
          `<p class="lead">{{recipient}} 您好，</p>` +
          `<p>{{space_name}} 的合同已于 {{end_date}} 终止。</p>` +
          `<p>押金将在退租验房完成后，于 {{settlement_date}} 前结算完毕。结算明细我们会另行发送，请您查收核对。</p>` +
          `<a class="btn" href="{{url}}">查看合同详情</a>` +
          `<p class="muted">感谢您一直以来的信赖，期待日后再次为您服务。</p>`,
      },
      th: {
        subject: "สัญญาของท่านสิ้นสุดแล้ว ({{ref}})",
        body:
          `<p class="lead">เรียน คุณ{{recipient}}</p>` +
          `<p>สัญญาสำหรับ {{space_name}} สิ้นสุดลงเมื่อวันที่ {{end_date}}</p>` +
          `<p>เงินประกันจะคืนหลังตรวจสภาพห้องเมื่อย้ายออก โดยดำเนินการให้แล้วเสร็จภายในวันที่ {{settlement_date}} เราจะส่งใบสรุปการหักคืนให้ตรวจสอบต่างหาก</p>` +
          `<a class="btn" href="{{url}}">ดูรายละเอียดสัญญา</a>` +
          `<p class="muted">ขอบคุณที่เลือกพักกับเรา หวังว่าจะได้ต้อนรับท่านอีกครั้ง</p>`,
      },
      vi: {
        subject: "Hợp đồng của Quý khách đã kết thúc ({{ref}})",
        body:
          `<p class="lead">Kính gửi {{recipient}},</p>` +
          `<p>Hợp đồng cho {{space_name}} đã kết thúc vào ngày {{end_date}}.</p>` +
          `<p>Sau khi kiểm tra bàn giao, chúng tôi sẽ hoàn tất quyết toán tiền cọc trước ngày {{settlement_date}}. Bảng quyết toán sẽ được gửi riêng để Quý khách đối chiếu.</p>` +
          `<a class="btn" href="{{url}}">Xem chi tiết hợp đồng</a>` +
          `<p class="muted">Cảm ơn Quý khách đã lưu trú cùng chúng tôi. Rất mong được đón tiếp Quý khách lần sau.</p>`,
      },
    },
  },
];
