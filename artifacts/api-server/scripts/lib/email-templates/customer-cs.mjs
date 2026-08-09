// customer — 고객 문의 (cs.*)
//
// 접수번호({{ref}})는 접수부터 종결까지 같은 값을 쓴다. 고객이 전화로 문의할 때
// 대는 유일한 식별자이므로 모든 단계 메일에 노출한다.
//
// ⚠️ 파트너(에이전트·호스트) 문의는 호칭과 담긴 정보가 달라 별도 키를 쓴다
//    (cs.partner_ticket_* — partner 모듈). 이 파일은 B2C 세입자·게스트 전용이다.
// 한국어는 humanize-korean 통과본. 영어에서 재기계번역 금지.
import { vars } from "./_shared.mjs";

export const CUSTOMER_CS = [
  {
    key: "cs.ticket_received",
    name: "문의 접수 확인",
    description: "문의가 등록된 직후 자동 회신. 접수번호와 응답 목표 시간을 준다.",
    vars: vars("recipient", "ref", "subject_line", "category", "response_hours", "url"),
    tr: {
      ko: {
        subject: "문의를 접수했습니다 ({{ref}})",
        body:
          `<p class="lead">{{recipient}} 님, 안녕하세요.</p>` +
          `<p>보내 주신 문의를 접수했습니다.</p>` +
          `<div class="box"><div class="label">접수번호</div><div class="ref">{{ref}}</div></div>` +
          `<table class="kv">` +
          `<tr><td class="k">문의 내용</td><td>{{subject_line}}</td></tr>` +
          `<tr><td class="k">분류</td><td>{{category}}</td></tr></table>` +
          `<p>{{response_hours}}시간 안에 담당자가 회신드립니다. 급한 일이면 답장으로 알려 주세요.</p>` +
          `<a class="btn" href="{{url}}">문의 내역 보기</a>` +
          `<p class="muted">이 메일에 그대로 답장하시면 같은 문의에 이어서 기록됩니다.</p>`,
      },
      en: {
        subject: "We've received your enquiry ({{ref}})",
        body:
          `<p class="lead">Hi {{recipient}},</p>` +
          `<p>Thanks for getting in touch — your enquiry is logged.</p>` +
          `<div class="box"><div class="label">Reference</div><div class="ref">{{ref}}</div></div>` +
          `<table class="kv">` +
          `<tr><td class="k">About</td><td>{{subject_line}}</td></tr>` +
          `<tr><td class="k">Category</td><td>{{category}}</td></tr></table>` +
          `<p>Someone will reply within {{response_hours}} hours. If it's urgent, say so in a reply.</p>` +
          `<a class="btn" href="{{url}}">View your enquiry</a>` +
          `<p class="muted">Replying to this email adds to the same enquiry, so nothing gets lost.</p>`,
      },
      ja: {
        subject: "お問い合わせを受け付けました（{{ref}}）",
        body:
          `<p class="lead">{{recipient}} 様</p>` +
          `<p>お問い合わせを承りました。</p>` +
          `<div class="box"><div class="label">受付番号</div><div class="ref">{{ref}}</div></div>` +
          `<table class="kv">` +
          `<tr><td class="k">お問い合わせ内容</td><td>{{subject_line}}</td></tr>` +
          `<tr><td class="k">分類</td><td>{{category}}</td></tr></table>` +
          `<p>{{response_hours}} 時間以内に担当者よりご返信いたします。お急ぎの場合は、ご返信にてお知らせください。</p>` +
          `<a class="btn" href="{{url}}">お問い合わせ内容を確認する</a>` +
          `<p class="muted">本メールにそのままご返信いただくと、同じお問い合わせに続けて記録されます。</p>`,
      },
      zh: {
        subject: "已收到您的咨询（{{ref}}）",
        body:
          `<p class="lead">{{recipient}} 您好，</p>` +
          `<p>您的咨询已登记受理。</p>` +
          `<div class="box"><div class="label">受理编号</div><div class="ref">{{ref}}</div></div>` +
          `<table class="kv">` +
          `<tr><td class="k">咨询内容</td><td>{{subject_line}}</td></tr>` +
          `<tr><td class="k">分类</td><td>{{category}}</td></tr></table>` +
          `<p>专员会在 {{response_hours}} 小时内回复您。若情况紧急，请在回复中说明。</p>` +
          `<a class="btn" href="{{url}}">查看咨询记录</a>` +
          `<p class="muted">直接回复本邮件即可接续同一条咨询记录。</p>`,
      },
      th: {
        subject: "รับเรื่องสอบถามของท่านแล้ว ({{ref}})",
        body:
          `<p class="lead">เรียน คุณ{{recipient}}</p>` +
          `<p>เราได้รับเรื่องที่ท่านสอบถามมาแล้ว</p>` +
          `<div class="box"><div class="label">หมายเลขรับเรื่อง</div><div class="ref">{{ref}}</div></div>` +
          `<table class="kv">` +
          `<tr><td class="k">เรื่อง</td><td>{{subject_line}}</td></tr>` +
          `<tr><td class="k">ประเภท</td><td>{{category}}</td></tr></table>` +
          `<p>เจ้าหน้าที่จะตอบกลับภายใน {{response_hours}} ชั่วโมง หากเป็นเรื่องเร่งด่วน กรุณาแจ้งในการตอบกลับ</p>` +
          `<a class="btn" href="{{url}}">ดูเรื่องที่สอบถาม</a>` +
          `<p class="muted">ตอบกลับอีเมลฉบับนี้ได้เลย ระบบจะบันทึกต่อในเรื่องเดียวกัน</p>`,
      },
      vi: {
        subject: "Đã tiếp nhận yêu cầu của Quý khách ({{ref}})",
        body:
          `<p class="lead">Kính gửi {{recipient}},</p>` +
          `<p>Chúng tôi đã ghi nhận yêu cầu của Quý khách.</p>` +
          `<div class="box"><div class="label">Số tiếp nhận</div><div class="ref">{{ref}}</div></div>` +
          `<table class="kv">` +
          `<tr><td class="k">Nội dung</td><td>{{subject_line}}</td></tr>` +
          `<tr><td class="k">Phân loại</td><td>{{category}}</td></tr></table>` +
          `<p>Nhân viên sẽ phản hồi trong vòng {{response_hours}} giờ. Nếu gấp, xin nói rõ khi trả lời.</p>` +
          `<a class="btn" href="{{url}}">Xem yêu cầu</a>` +
          `<p class="muted">Trả lời ngay email này sẽ được ghi tiếp vào cùng một yêu cầu.</p>`,
      },
    },
  },

  {
    key: "cs.ticket_assigned",
    name: "담당자 배정",
    description: "누가 처리하는지 알린다. 이름이 붙으면 고객의 불안이 줄어든다.",
    vars: vars("recipient", "ref", "agent_name", "agent_role", "expected_date", "url"),
    tr: {
      ko: {
        subject: "담당자가 배정되었습니다 ({{ref}})",
        body:
          `<p class="lead">{{recipient}} 님, 안녕하세요.</p>` +
          `<p>접수번호 {{ref}} 문의는 {{agent_name}}({{agent_role}})이(가) 맡아 처리합니다.</p>` +
          `<p>{{expected_date}}까지 결과를 알려 드리는 것을 목표로 합니다. 진행 중에 확인할 사항이 생기면 담당자가 직접 연락드립니다.</p>` +
          `<a class="btn" href="{{url}}">진행 상황 보기</a>`,
      },
      en: {
        subject: "Your enquiry has an owner ({{ref}})",
        body:
          `<p class="lead">Hi {{recipient}},</p>` +
          `<p>{{agent_name}} ({{agent_role}}) is now looking after enquiry {{ref}}.</p>` +
          `<p>We're aiming to have an answer for you by {{expected_date}}. If anything needs clarifying along the way, they'll contact you directly.</p>` +
          `<a class="btn" href="{{url}}">Check progress</a>`,
      },
      ja: {
        subject: "担当者が決まりました（{{ref}}）",
        body:
          `<p class="lead">{{recipient}} 様</p>` +
          `<p>受付番号 {{ref}} のお問い合わせは、{{agent_name}}（{{agent_role}}）が担当いたします。</p>` +
          `<p>{{expected_date}} までに結果をご連絡することを目標としております。進行中に確認事項が生じた場合は、担当者より直接ご連絡いたします。</p>` +
          `<a class="btn" href="{{url}}">進捗を確認する</a>`,
      },
      zh: {
        subject: "已指派专员处理（{{ref}}）",
        body:
          `<p class="lead">{{recipient}} 您好，</p>` +
          `<p>受理编号 {{ref}} 的咨询由 {{agent_name}}（{{agent_role}}）负责处理。</p>` +
          `<p>我们的目标是在 {{expected_date}} 前给您答复。处理过程中若需核实事项，专员会直接与您联系。</p>` +
          `<a class="btn" href="{{url}}">查看进度</a>`,
      },
      th: {
        subject: "มอบหมายผู้รับผิดชอบแล้ว ({{ref}})",
        body:
          `<p class="lead">เรียน คุณ{{recipient}}</p>` +
          `<p>เรื่องหมายเลข {{ref}} มี {{agent_name}} ({{agent_role}}) เป็นผู้ดูแล</p>` +
          `<p>เราตั้งเป้าแจ้งผลให้ท่านทราบภายในวันที่ {{expected_date}} หากมีเรื่องต้องสอบถามระหว่างดำเนินการ ผู้ดูแลจะติดต่อท่านโดยตรง</p>` +
          `<a class="btn" href="{{url}}">ดูความคืบหน้า</a>`,
      },
      vi: {
        subject: "Đã phân công người phụ trách ({{ref}})",
        body:
          `<p class="lead">Kính gửi {{recipient}},</p>` +
          `<p>Yêu cầu số {{ref}} do {{agent_name}} ({{agent_role}}) phụ trách.</p>` +
          `<p>Chúng tôi đặt mục tiêu phản hồi trước ngày {{expected_date}}. Nếu có điểm cần làm rõ, người phụ trách sẽ liên hệ trực tiếp với Quý khách.</p>` +
          `<a class="btn" href="{{url}}">Xem tiến độ</a>`,
      },
    },
  },

  {
    key: "cs.ticket_update",
    name: "진행 상황 업데이트",
    description: "중간 경과 보고. 아직 안 끝났어도 진행 중임을 알리는 것이 핵심.",
    vars: vars("recipient", "ref", "update_note", "next_step", "expected_date", "url"),
    tr: {
      ko: {
        subject: "문의 진행 상황 안내 ({{ref}})",
        body:
          `<p class="lead">{{recipient}} 님, 안녕하세요.</p>` +
          `<p>접수번호 {{ref}} 문의 진행 상황을 알려 드립니다.</p>` +
          `<div class="box"><div class="label">진행 내용</div><div>{{update_note}}</div></div>` +
          `<table class="kv">` +
          `<tr><td class="k">다음 단계</td><td>{{next_step}}</td></tr>` +
          `<tr><td class="k">예상 완료</td><td>{{expected_date}}</td></tr></table>` +
          `<a class="btn" href="{{url}}">문의 내역 보기</a>` +
          `<p class="muted">더 알고 싶은 부분이 있으면 답장 주세요.</p>`,
      },
      en: {
        subject: "Update on your enquiry ({{ref}})",
        body:
          `<p class="lead">Hi {{recipient}},</p>` +
          `<p>Here's where enquiry {{ref}} stands.</p>` +
          `<div class="box"><div class="label">What's happened</div><div>{{update_note}}</div></div>` +
          `<table class="kv">` +
          `<tr><td class="k">Next</td><td>{{next_step}}</td></tr>` +
          `<tr><td class="k">Expected by</td><td>{{expected_date}}</td></tr></table>` +
          `<a class="btn" href="{{url}}">View your enquiry</a>` +
          `<p class="muted">Reply if there's anything you'd like to know more about.</p>`,
      },
      ja: {
        subject: "お問い合わせの進捗のご案内（{{ref}}）",
        body:
          `<p class="lead">{{recipient}} 様</p>` +
          `<p>受付番号 {{ref}} のお問い合わせについて、進捗をご案内いたします。</p>` +
          `<div class="box"><div class="label">これまでの経過</div><div>{{update_note}}</div></div>` +
          `<table class="kv">` +
          `<tr><td class="k">次のステップ</td><td>{{next_step}}</td></tr>` +
          `<tr><td class="k">完了予定</td><td>{{expected_date}}</td></tr></table>` +
          `<a class="btn" href="{{url}}">お問い合わせ内容を確認する</a>` +
          `<p class="muted">さらにお知りになりたい点がございましたら、ご返信ください。</p>`,
      },
      zh: {
        subject: "咨询进度通知（{{ref}}）",
        body:
          `<p class="lead">{{recipient}} 您好，</p>` +
          `<p>现将受理编号 {{ref}} 的处理进度告知您。</p>` +
          `<div class="box"><div class="label">进展情况</div><div>{{update_note}}</div></div>` +
          `<table class="kv">` +
          `<tr><td class="k">下一步</td><td>{{next_step}}</td></tr>` +
          `<tr><td class="k">预计完成</td><td>{{expected_date}}</td></tr></table>` +
          `<a class="btn" href="{{url}}">查看咨询记录</a>` +
          `<p class="muted">如有想进一步了解的地方，请回复本邮件。</p>`,
      },
      th: {
        subject: "แจ้งความคืบหน้าเรื่องที่สอบถาม ({{ref}})",
        body:
          `<p class="lead">เรียน คุณ{{recipient}}</p>` +
          `<p>ขอแจ้งความคืบหน้าของเรื่องหมายเลข {{ref}}</p>` +
          `<div class="box"><div class="label">ความคืบหน้า</div><div>{{update_note}}</div></div>` +
          `<table class="kv">` +
          `<tr><td class="k">ขั้นตอนถัดไป</td><td>{{next_step}}</td></tr>` +
          `<tr><td class="k">คาดว่าจะเสร็จ</td><td>{{expected_date}}</td></tr></table>` +
          `<a class="btn" href="{{url}}">ดูเรื่องที่สอบถาม</a>` +
          `<p class="muted">หากต้องการทราบรายละเอียดเพิ่มเติม ตอบกลับมาได้เลย</p>`,
      },
      vi: {
        subject: "Cập nhật tiến độ yêu cầu ({{ref}})",
        body:
          `<p class="lead">Kính gửi {{recipient}},</p>` +
          `<p>Chúng tôi xin báo tiến độ của yêu cầu số {{ref}}.</p>` +
          `<div class="box"><div class="label">Đã thực hiện</div><div>{{update_note}}</div></div>` +
          `<table class="kv">` +
          `<tr><td class="k">Bước tiếp theo</td><td>{{next_step}}</td></tr>` +
          `<tr><td class="k">Dự kiến xong</td><td>{{expected_date}}</td></tr></table>` +
          `<a class="btn" href="{{url}}">Xem yêu cầu</a>` +
          `<p class="muted">Nếu Quý khách muốn biết thêm điều gì, xin trả lời email này.</p>`,
      },
    },
  },

  {
    key: "cs.info_needed",
    name: "고객 회신 대기",
    description: "정보가 없어 멈춘 상태. 무엇이 필요한지 구체적으로 묻고 대기 기한을 준다.",
    vars: vars("recipient", "ref", "needed_info", "reply_by", "url"),
    tr: {
      ko: {
        subject: "확인이 필요한 내용이 있습니다 ({{ref}})",
        body:
          `<p class="lead">{{recipient}} 님, 안녕하세요.</p>` +
          `<p>접수번호 {{ref}} 문의를 처리하려면 아래 내용이 필요합니다.</p>` +
          `<div class="box"><div class="label">알려 주실 내용</div><div>{{needed_info}}</div></div>` +
          `<p>답장으로 알려 주시면 바로 이어서 진행하겠습니다.</p>` +
          `<a class="btn" href="{{url}}">문의 내역 보기</a>` +
          `<p class="muted">{{reply_by}}까지 회신이 없으면 문의를 일단 보류합니다. 나중에 다시 열어 드릴 수 있으니 걱정하지 않으셔도 됩니다.</p>`,
      },
      en: {
        subject: "We need a bit more from you ({{ref}})",
        body:
          `<p class="lead">Hi {{recipient}},</p>` +
          `<p>To move enquiry {{ref}} along, we need the following.</p>` +
          `<div class="box"><div class="label">What we need</div><div>{{needed_info}}</div></div>` +
          `<p>Just reply and we'll pick it straight back up.</p>` +
          `<a class="btn" href="{{url}}">View your enquiry</a>` +
          `<p class="muted">If we haven't heard by {{reply_by}} we'll put the enquiry on hold. It can be reopened later, so nothing is lost.</p>`,
      },
      ja: {
        subject: "ご確認いただきたい点がございます（{{ref}}）",
        body:
          `<p class="lead">{{recipient}} 様</p>` +
          `<p>受付番号 {{ref}} のお問い合わせを進めるにあたり、下記の内容が必要です。</p>` +
          `<div class="box"><div class="label">お知らせいただきたい内容</div><div>{{needed_info}}</div></div>` +
          `<p>ご返信いただければ、そのまま対応を続けます。</p>` +
          `<a class="btn" href="{{url}}">お問い合わせ内容を確認する</a>` +
          `<p class="muted">{{reply_by}} までにご返信がない場合は、いったん保留とさせていただきます。後日改めて再開できますので、ご安心ください。</p>`,
      },
      zh: {
        subject: "有需要向您核实的内容（{{ref}}）",
        body:
          `<p class="lead">{{recipient}} 您好，</p>` +
          `<p>为继续处理受理编号 {{ref}} 的咨询，我们需要以下信息。</p>` +
          `<div class="box"><div class="label">需要您告知</div><div>{{needed_info}}</div></div>` +
          `<p>回复本邮件即可，我们会立即接续处理。</p>` +
          `<a class="btn" href="{{url}}">查看咨询记录</a>` +
          `<p class="muted">若 {{reply_by}} 前未收到回复，我们会暂时挂起该咨询。日后可以重新开启，请放心。</p>`,
      },
      th: {
        subject: "มีข้อมูลที่ต้องขอเพิ่มเติม ({{ref}})",
        body:
          `<p class="lead">เรียน คุณ{{recipient}}</p>` +
          `<p>เพื่อดำเนินเรื่องหมายเลข {{ref}} ต่อ เราต้องขอข้อมูลดังนี้</p>` +
          `<div class="box"><div class="label">ข้อมูลที่ต้องขอ</div><div>{{needed_info}}</div></div>` +
          `<p>เพียงตอบกลับมา เราจะดำเนินการต่อทันที</p>` +
          `<a class="btn" href="{{url}}">ดูเรื่องที่สอบถาม</a>` +
          `<p class="muted">หากไม่ได้รับการตอบกลับภายใน {{reply_by}} เราจะพักเรื่องไว้ก่อน สามารถเปิดเรื่องใหม่ได้ภายหลัง ไม่ต้องกังวล</p>`,
      },
      vi: {
        subject: "Chúng tôi cần thêm thông tin ({{ref}})",
        body:
          `<p class="lead">Kính gửi {{recipient}},</p>` +
          `<p>Để tiếp tục xử lý yêu cầu số {{ref}}, chúng tôi cần những thông tin sau.</p>` +
          `<div class="box"><div class="label">Thông tin cần có</div><div>{{needed_info}}</div></div>` +
          `<p>Quý khách chỉ cần trả lời email, chúng tôi sẽ xử lý tiếp ngay.</p>` +
          `<a class="btn" href="{{url}}">Xem yêu cầu</a>` +
          `<p class="muted">Nếu đến {{reply_by}} chưa nhận được phản hồi, chúng tôi tạm dừng yêu cầu. Sau này vẫn mở lại được nên Quý khách đừng lo.</p>`,
      },
    },
  },

  {
    key: "cs.ticket_escalated",
    name: "상급자 이관",
    description: "처리가 지연되거나 사안이 커졌을 때. 이관 사실과 새 담당자를 밝힌다.",
    vars: vars("recipient", "ref", "manager_name", "reason", "expected_date", "contact_phone"),
    tr: {
      ko: {
        subject: "문의를 상급자에게 넘겼습니다 ({{ref}})",
        body:
          `<p class="lead">{{recipient}} 님, 안녕하세요.</p>` +
          `<p>접수번호 {{ref}} 문의를 {{manager_name}}에게 넘겼습니다. 사유는 {{reason}}입니다.</p>` +
          `<p>{{expected_date}}까지 답을 드리겠습니다. 처리가 늦어져 불편을 드린 점 사과드립니다.</p>` +
          `<p class="muted">급하시면 {{contact_phone}}으로 전화 주세요. 바로 연결해 드리겠습니다.</p>`,
      },
      en: {
        subject: "Your enquiry has been escalated ({{ref}})",
        body:
          `<p class="lead">Hi {{recipient}},</p>` +
          `<p>Enquiry {{ref}} has been passed to {{manager_name}} — {{reason}}.</p>` +
          `<p>We'll come back to you by {{expected_date}}. We're sorry it has taken this long.</p>` +
          `<p class="muted">If you'd rather talk it through now, call {{contact_phone}} and we'll put you through.</p>`,
      },
      ja: {
        subject: "お問い合わせを上長へ引き継ぎました（{{ref}}）",
        body:
          `<p class="lead">{{recipient}} 様</p>` +
          `<p>受付番号 {{ref}} のお問い合わせを {{manager_name}} へ引き継ぎました。理由は {{reason}}です。</p>` +
          `<p>{{expected_date}} までにご回答いたします。ご対応が遅れ、ご不便をおかけしておりますこと、お詫び申し上げます。</p>` +
          `<p class="muted">お急ぎの場合は {{contact_phone}} までお電話ください。すぐにおつなぎいたします。</p>`,
      },
      zh: {
        subject: "咨询已转交上级处理（{{ref}}）",
        body:
          `<p class="lead">{{recipient}} 您好，</p>` +
          `<p>受理编号 {{ref}} 的咨询已转交 {{manager_name}} 处理，原因是{{reason}}。</p>` +
          `<p>我们会在 {{expected_date}} 前答复您。处理时间较长，给您带来不便，深表歉意。</p>` +
          `<p class="muted">如需尽快沟通，请拨打 {{contact_phone}}，我们会立即为您转接。</p>`,
      },
      th: {
        subject: "ส่งต่อเรื่องให้ผู้บังคับบัญชาแล้ว ({{ref}})",
        body:
          `<p class="lead">เรียน คุณ{{recipient}}</p>` +
          `<p>เรื่องหมายเลข {{ref}} ได้ส่งต่อให้ {{manager_name}} ดูแล เนื่องจาก{{reason}}</p>` +
          `<p>เราจะตอบกลับท่านภายในวันที่ {{expected_date}} ต้องขออภัยที่ใช้เวลานาน</p>` +
          `<p class="muted">หากต้องการพูดคุยทันที โทร {{contact_phone}} เราจะโอนสายให้</p>`,
      },
      vi: {
        subject: "Yêu cầu đã được chuyển lên cấp trên ({{ref}})",
        body:
          `<p class="lead">Kính gửi {{recipient}},</p>` +
          `<p>Yêu cầu số {{ref}} đã được chuyển cho {{manager_name}}, lý do là {{reason}}.</p>` +
          `<p>Chúng tôi sẽ phản hồi trước ngày {{expected_date}}. Thành thật xin lỗi vì đã để Quý khách chờ lâu.</p>` +
          `<p class="muted">Nếu muốn trao đổi ngay, xin gọi {{contact_phone}}, chúng tôi sẽ nối máy.</p>`,
      },
    },
  },

  {
    key: "cs.ticket_resolved",
    name: "처리 완료 — 조치 내역",
    description: "무엇을 어떻게 처리했는지 밝힌다. '해결했습니다'만으로는 부족하다.",
    vars: vars("recipient", "ref", "resolution", "action_taken", "url"),
    tr: {
      ko: {
        subject: "문의가 처리되었습니다 ({{ref}})",
        body:
          `<p class="lead">{{recipient}} 님, 안녕하세요.</p>` +
          `<p>접수번호 {{ref}} 문의를 처리했습니다.</p>` +
          `<div class="box"><div class="label">조치 내용</div><div>{{action_taken}}</div></div>` +
          `<table class="kv"><tr><td class="k">처리 결과</td><td>{{resolution}}</td></tr></table>` +
          `<a class="btn" href="{{url}}">처리 내역 보기</a>` +
          `<p class="muted">아직 해결되지 않았거나 다시 같은 문제가 생기면 이 메일에 답장해 주세요. 문의를 다시 열어 이어서 봐 드리겠습니다.</p>`,
      },
      en: {
        subject: "Your enquiry is resolved ({{ref}})",
        body:
          `<p class="lead">Hi {{recipient}},</p>` +
          `<p>Enquiry {{ref}} has been dealt with.</p>` +
          `<div class="box"><div class="label">What we did</div><div>{{action_taken}}</div></div>` +
          `<table class="kv"><tr><td class="k">Outcome</td><td>{{resolution}}</td></tr></table>` +
          `<a class="btn" href="{{url}}">View the details</a>` +
          `<p class="muted">If it isn't actually fixed, or the same thing happens again, reply here and we'll reopen it and carry on.</p>`,
      },
      ja: {
        subject: "お問い合わせに対応いたしました（{{ref}}）",
        body:
          `<p class="lead">{{recipient}} 様</p>` +
          `<p>受付番号 {{ref}} のお問い合わせに対応いたしました。</p>` +
          `<div class="box"><div class="label">対応内容</div><div>{{action_taken}}</div></div>` +
          `<table class="kv"><tr><td class="k">対応結果</td><td>{{resolution}}</td></tr></table>` +
          `<a class="btn" href="{{url}}">対応内容を確認する</a>` +
          `<p class="muted">解決に至っていない場合や、同じ事象が再発した場合は、本メールにご返信ください。お問い合わせを再開し、引き続き対応いたします。</p>`,
      },
      zh: {
        subject: "您的咨询已处理完毕（{{ref}}）",
        body:
          `<p class="lead">{{recipient}} 您好，</p>` +
          `<p>受理编号 {{ref}} 的咨询已处理完毕。</p>` +
          `<div class="box"><div class="label">处理措施</div><div>{{action_taken}}</div></div>` +
          `<table class="kv"><tr><td class="k">处理结果</td><td>{{resolution}}</td></tr></table>` +
          `<a class="btn" href="{{url}}">查看处理详情</a>` +
          `<p class="muted">若问题实际未解决，或同样情况再次发生，请回复本邮件，我们会重新开启并继续跟进。</p>`,
      },
      th: {
        subject: "ดำเนินการเรื่องของท่านเสร็จแล้ว ({{ref}})",
        body:
          `<p class="lead">เรียน คุณ{{recipient}}</p>` +
          `<p>เรื่องหมายเลข {{ref}} ดำเนินการเสร็จเรียบร้อยแล้ว</p>` +
          `<div class="box"><div class="label">สิ่งที่ดำเนินการ</div><div>{{action_taken}}</div></div>` +
          `<table class="kv"><tr><td class="k">ผลการดำเนินการ</td><td>{{resolution}}</td></tr></table>` +
          `<a class="btn" href="{{url}}">ดูรายละเอียดการดำเนินการ</a>` +
          `<p class="muted">หากยังไม่ได้รับการแก้ไขจริง หรือเกิดปัญหาเดิมซ้ำ กรุณาตอบกลับอีเมลนี้ เราจะเปิดเรื่องใหม่และดูแลต่อให้</p>`,
      },
      vi: {
        subject: "Yêu cầu của Quý khách đã được xử lý ({{ref}})",
        body:
          `<p class="lead">Kính gửi {{recipient}},</p>` +
          `<p>Yêu cầu số {{ref}} đã được xử lý xong.</p>` +
          `<div class="box"><div class="label">Việc đã làm</div><div>{{action_taken}}</div></div>` +
          `<table class="kv"><tr><td class="k">Kết quả</td><td>{{resolution}}</td></tr></table>` +
          `<a class="btn" href="{{url}}">Xem chi tiết</a>` +
          `<p class="muted">Nếu thực tế chưa được khắc phục, hoặc sự việc lặp lại, xin trả lời email này để chúng tôi mở lại và tiếp tục theo dõi.</p>`,
      },
    },
  },

  {
    key: "cs.ticket_closed",
    name: "문의 종결",
    description: "처리 후 일정 기간 무응답이면 종결. 재개 방법을 반드시 남긴다.",
    vars: vars("recipient", "ref", "closed_date", "reopen_days", "url"),
    tr: {
      ko: {
        subject: "문의를 종결했습니다 ({{ref}})",
        body:
          `<p class="lead">{{recipient}} 님, 안녕하세요.</p>` +
          `<p>추가 말씀이 없으셔서 접수번호 {{ref}} 문의를 {{closed_date}}자로 종결했습니다.</p>` +
          `<p>같은 사안이 다시 생기면 {{reopen_days}}일 안에는 이 메일에 답장하시는 것만으로 다시 열립니다. 기간이 지났으면 새로 접수해 주세요.</p>` +
          `<a class="btn" href="{{url}}">문의 내역 보기</a>` +
          `<p class="muted">아직 끝나지 않은 일이 있으면 알려 주세요. 다시 살펴보겠습니다.</p>`,
      },
      en: {
        subject: "Your enquiry is closed ({{ref}})",
        body:
          `<p class="lead">Hi {{recipient}},</p>` +
          `<p>We haven't heard back, so enquiry {{ref}} was closed on {{closed_date}}.</p>` +
          `<p>If the same thing comes up again, replying to this email within {{reopen_days}} days reopens it. After that, just start a new enquiry.</p>` +
          `<a class="btn" href="{{url}}">View your enquiry</a>` +
          `<p class="muted">If something was left unfinished, tell us and we'll look again.</p>`,
      },
      ja: {
        subject: "お問い合わせをクローズいたしました（{{ref}}）",
        body:
          `<p class="lead">{{recipient}} 様</p>` +
          `<p>その後のご連絡がございませんでしたので、受付番号 {{ref}} のお問い合わせを {{closed_date}} 付でクローズいたしました。</p>` +
          `<p>同じ事象が再び生じた場合、{{reopen_days}} 日以内であれば本メールへのご返信だけで再開いたします。期間を過ぎている場合は、改めてお問い合わせください。</p>` +
          `<a class="btn" href="{{url}}">お問い合わせ内容を確認する</a>` +
          `<p class="muted">まだ終わっていない件がございましたら、お知らせください。改めて確認いたします。</p>`,
      },
      zh: {
        subject: "咨询已结案（{{ref}}）",
        body:
          `<p class="lead">{{recipient}} 您好，</p>` +
          `<p>因未再收到您的回复，受理编号 {{ref}} 的咨询已于 {{closed_date}} 结案。</p>` +
          `<p>若同样的情况再次出现，{{reopen_days}} 天内回复本邮件即可重新开启。超过期限请另行提交新咨询。</p>` +
          `<a class="btn" href="{{url}}">查看咨询记录</a>` +
          `<p class="muted">若仍有未了事项，请告知我们，我们会重新核查。</p>`,
      },
      th: {
        subject: "ปิดเรื่องแล้ว ({{ref}})",
        body:
          `<p class="lead">เรียน คุณ{{recipient}}</p>` +
          `<p>เนื่องจากไม่ได้รับการติดต่อกลับ เราจึงปิดเรื่องหมายเลข {{ref}} เมื่อวันที่ {{closed_date}}</p>` +
          `<p>หากเกิดเรื่องเดิมขึ้นอีก เพียงตอบกลับอีเมลนี้ภายใน {{reopen_days}} วัน ระบบจะเปิดเรื่องใหม่ให้ หากพ้นกำหนดแล้ว กรุณาแจ้งเรื่องใหม่</p>` +
          `<a class="btn" href="{{url}}">ดูเรื่องที่สอบถาม</a>` +
          `<p class="muted">หากยังมีเรื่องค้างอยู่ กรุณาแจ้ง เราจะตรวจสอบให้อีกครั้ง</p>`,
      },
      vi: {
        subject: "Đã đóng yêu cầu ({{ref}})",
        body:
          `<p class="lead">Kính gửi {{recipient}},</p>` +
          `<p>Do không nhận được phản hồi thêm, yêu cầu số {{ref}} đã được đóng vào ngày {{closed_date}}.</p>` +
          `<p>Nếu sự việc tái diễn, chỉ cần trả lời email này trong vòng {{reopen_days}} ngày là mở lại được. Quá thời hạn, xin Quý khách gửi yêu cầu mới.</p>` +
          `<a class="btn" href="{{url}}">Xem yêu cầu</a>` +
          `<p class="muted">Nếu còn việc chưa xong, xin báo để chúng tôi xem lại.</p>`,
      },
    },
  },

  {
    key: "cs.sla_apology",
    name: "응답 지연 사과",
    description: "약속한 응답 시간을 넘겼을 때. 변명보다 새 기한과 담당자를 준다.",
    vars: vars("recipient", "ref", "days_waiting", "new_date", "contact_name", "contact_phone"),
    tr: {
      ko: {
        subject: "회신이 늦어져 죄송합니다 ({{ref}})",
        body:
          `<p class="lead">{{recipient}} 님, 안녕하세요.</p>` +
          `<p>접수번호 {{ref}} 문의를 주신 지 {{days_waiting}}일이 지났는데도 제대로 답을 드리지 못했습니다. 기다리게 해 드려 죄송합니다.</p>` +
          `<p>{{contact_name}}이(가) 직접 챙기고 있습니다. {{new_date}}까지는 반드시 답을 드리겠습니다.</p>` +
          `<p class="muted">그 전에 확인이 필요하시면 {{contact_phone}}으로 연락 주세요.</p>`,
      },
      en: {
        subject: "Sorry for the delay ({{ref}})",
        body:
          `<p class="lead">Hi {{recipient}},</p>` +
          `<p>It's been {{days_waiting}} days since you raised enquiry {{ref}} and we still haven't given you a proper answer. We're sorry to have kept you waiting.</p>` +
          `<p>{{contact_name}} has taken it on personally and will come back to you by {{new_date}} without fail.</p>` +
          `<p class="muted">If you need to check in before then, call {{contact_phone}}.</p>`,
      },
      ja: {
        subject: "ご返信が遅れており申し訳ございません（{{ref}}）",
        body:
          `<p class="lead">{{recipient}} 様</p>` +
          `<p>受付番号 {{ref}} のお問い合わせをいただいてから {{days_waiting}} 日が経過しておりますが、いまだ十分なご回答を差し上げられておりません。お待たせしており、誠に申し訳ございません。</p>` +
          `<p>{{contact_name}} が直接対応にあたっており、{{new_date}} までには必ずご回答いたします。</p>` +
          `<p class="muted">それ以前にご確認が必要な場合は、{{contact_phone}} までご連絡ください。</p>`,
      },
      zh: {
        subject: "回复延迟，深表歉意（{{ref}}）",
        body:
          `<p class="lead">{{recipient}} 您好，</p>` +
          `<p>受理编号 {{ref}} 的咨询已过去 {{days_waiting}} 天，我们仍未给您妥善答复，让您久等，非常抱歉。</p>` +
          `<p>{{contact_name}} 已亲自跟进，{{new_date}} 前必定给您答复。</p>` +
          `<p class="muted">在此之前如需了解情况，请拨打 {{contact_phone}}。</p>`,
      },
      th: {
        subject: "ขออภัยที่ตอบกลับล่าช้า ({{ref}})",
        body:
          `<p class="lead">เรียน คุณ{{recipient}}</p>` +
          `<p>ผ่านมา {{days_waiting}} วันนับจากที่ท่านแจ้งเรื่องหมายเลข {{ref}} แต่เรายังไม่ได้ให้คำตอบที่ชัดเจน ต้องขออภัยที่ทำให้ท่านรอ</p>` +
          `<p>{{contact_name}} รับดูแลเรื่องนี้ด้วยตนเอง และจะตอบกลับท่านภายในวันที่ {{new_date}} อย่างแน่นอน</p>` +
          `<p class="muted">หากต้องการสอบถามก่อนหน้านั้น โทร {{contact_phone}} ได้เลย</p>`,
      },
      vi: {
        subject: "Xin lỗi vì phản hồi chậm ({{ref}})",
        body:
          `<p class="lead">Kính gửi {{recipient}},</p>` +
          `<p>Đã {{days_waiting}} ngày kể từ khi Quý khách gửi yêu cầu số {{ref}} mà chúng tôi vẫn chưa trả lời thỏa đáng. Xin lỗi vì đã để Quý khách chờ.</p>` +
          `<p>{{contact_name}} đang trực tiếp theo dõi và chắc chắn sẽ phản hồi trước ngày {{new_date}}.</p>` +
          `<p class="muted">Nếu cần hỏi trước thời điểm đó, xin gọi {{contact_phone}}.</p>`,
      },
    },
  },
];
