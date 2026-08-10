// customer — 점검·하자 리포트 (inspection.*) + 만족도 (survey.*)
//
// ⚠️ survey.review_request 는 공개 리뷰를 부탁하는 마케팅성 메일이다.
//    「정보통신망법」 제50조 대상이므로 (광고) 표기·수신거부·동의 출처가 필요하고,
//    셸이 category 로 판단해 자동 삽입한다(스펙 §6). 이 템플릿의 category 는
//    'customer' 지만 발송부에서 마케팅 수신동의를 확인해야 한다 — 동의 없는 수신자에게
//    보내면 안 된다.
// 한국어는 humanize-korean 통과본. 영어에서 재기계번역 금지.
import { vars } from "./_shared.mjs";

export const CUSTOMER_SERVICE = [
  {
    key: "inspection.report_sent",
    name: "점검 결과 리포트",
    description: "정기·수시 점검 결과 통보. 조치가 필요한 항목과 일정을 함께 준다.",
    vars: vars("recipient", "space_name", "date", "summary", "action_items", "url"),
    tr: {
      ko: {
        subject: "점검 결과 안내 ({{space_name}})",
        body:
          `<p class="lead">{{recipient}} 님, 안녕하세요.</p>` +
          `<p>{{date}}에 진행한 {{space_name}} 점검 결과를 알려 드립니다. 자세한 내용은 첨부한 리포트를 봐 주세요.</p>` +
          `<div class="box"><div class="label">요약</div><div>{{summary}}</div></div>` +
          `<table class="kv"><tr><td class="k">조치할 항목</td><td>{{action_items}}</td></tr></table>` +
          `<a class="btn" href="{{url}}">점검 리포트 보기</a>` +
          `<p class="muted">조치가 필요한 항목은 일정을 잡아 따로 안내드리겠습니다.</p>`,
      },
      en: {
        subject: "Inspection results for {{space_name}}",
        body:
          `<p class="lead">Hi {{recipient}},</p>` +
          `<p>Here are the results of the {{space_name}} inspection carried out on {{date}}. The full report is attached.</p>` +
          `<div class="box"><div class="label">Summary</div><div>{{summary}}</div></div>` +
          `<table class="kv"><tr><td class="k">To be actioned</td><td>{{action_items}}</td></tr></table>` +
          `<a class="btn" href="{{url}}">View the report</a>` +
          `<p class="muted">We'll book in the items that need work and let you know the dates separately.</p>`,
      },
      ja: {
        subject: "点検結果のご案内（{{space_name}}）",
        body:
          `<p class="lead">{{recipient}} 様</p>` +
          `<p>{{date}} に実施いたしました {{space_name}} の点検結果をご案内いたします。詳細は添付のレポートをご覧ください。</p>` +
          `<div class="box"><div class="label">概要</div><div>{{summary}}</div></div>` +
          `<table class="kv"><tr><td class="k">対応が必要な項目</td><td>{{action_items}}</td></tr></table>` +
          `<a class="btn" href="{{url}}">点検レポートを見る</a>` +
          `<p class="muted">対応が必要な項目につきましては、日程を調整のうえ改めてご案内いたします。</p>`,
      },
      zh: {
        subject: "检查结果通知（{{space_name}}）",
        body:
          `<p class="lead">{{recipient}} 您好，</p>` +
          `<p>现将 {{date}} 对 {{space_name}} 进行检查的结果告知您，详细内容请见随附报告。</p>` +
          `<div class="box"><div class="label">概要</div><div>{{summary}}</div></div>` +
          `<table class="kv"><tr><td class="k">需处理事项</td><td>{{action_items}}</td></tr></table>` +
          `<a class="btn" href="{{url}}">查看检查报告</a>` +
          `<p class="muted">需要处理的事项，我们会安排时间后另行通知您。</p>`,
      },
      th: {
        subject: "แจ้งผลการตรวจ ({{space_name}})",
        body:
          `<p class="lead">เรียน คุณ{{recipient}}</p>` +
          `<p>ขอแจ้งผลการตรวจ {{space_name}} ที่ดำเนินการเมื่อวันที่ {{date}} รายละเอียดดูได้จากรายงานที่แนบมา</p>` +
          `<div class="box"><div class="label">สรุป</div><div>{{summary}}</div></div>` +
          `<table class="kv"><tr><td class="k">รายการที่ต้องดำเนินการ</td><td>{{action_items}}</td></tr></table>` +
          `<a class="btn" href="{{url}}">ดูรายงานการตรวจ</a>` +
          `<p class="muted">รายการที่ต้องแก้ไข เราจะนัดวันแล้วแจ้งให้ทราบอีกครั้ง</p>`,
      },
      vi: {
        subject: "Kết quả kiểm tra ({{space_name}})",
        body:
          `<p class="lead">Kính gửi {{recipient}},</p>` +
          `<p>Chúng tôi xin thông báo kết quả kiểm tra {{space_name}} thực hiện ngày {{date}}. Chi tiết xin xem báo cáo đính kèm.</p>` +
          `<div class="box"><div class="label">Tóm tắt</div><div>{{summary}}</div></div>` +
          `<table class="kv"><tr><td class="k">Hạng mục cần xử lý</td><td>{{action_items}}</td></tr></table>` +
          `<a class="btn" href="{{url}}">Xem báo cáo</a>` +
          `<p class="muted">Với các hạng mục cần sửa, chúng tôi sẽ sắp lịch và báo lại riêng.</p>`,
      },
    },
  },

  {
    key: "inspection.defect_registered",
    name: "하자 접수 확인",
    description: "세입자가 신고한 하자를 접수했을 때. 방문 예정과 임시 조치를 안내한다.",
    vars: vars("recipient", "ref", "defect_summary", "priority", "visit_date", "contact_phone"),
    tr: {
      ko: {
        subject: "하자 신고를 접수했습니다 ({{ref}})",
        body:
          `<p class="lead">{{recipient}} 님, 안녕하세요.</p>` +
          `<p>알려 주신 내용을 접수했습니다.</p>` +
          `<table class="kv">` +
          `<tr><td class="k">접수번호</td><td>{{ref}}</td></tr>` +
          `<tr><td class="k">신고 내용</td><td>{{defect_summary}}</td></tr>` +
          `<tr><td class="k">긴급도</td><td>{{priority}}</td></tr>` +
          `<tr><td class="k">방문 예정</td><td>{{visit_date}}</td></tr></table>` +
          `<p>방문 전날 다시 한번 시간을 확인해 드리겠습니다.</p>` +
          `<p class="muted">누수나 정전처럼 생활이 어려운 상황이면 기다리지 마시고 {{contact_phone}}으로 바로 전화 주세요.</p>`,
      },
      en: {
        subject: "We've logged the fault ({{ref}})",
        body:
          `<p class="lead">Hi {{recipient}},</p>` +
          `<p>Thanks for letting us know — it's logged.</p>` +
          `<table class="kv">` +
          `<tr><td class="k">Reference</td><td>{{ref}}</td></tr>` +
          `<tr><td class="k">Reported</td><td>{{defect_summary}}</td></tr>` +
          `<tr><td class="k">Priority</td><td>{{priority}}</td></tr>` +
          `<tr><td class="k">Visit planned</td><td>{{visit_date}}</td></tr></table>` +
          `<p>We'll confirm the time again the day before.</p>` +
          `<p class="muted">If it's something that makes the place unliveable — a leak, no power — don't wait. Call {{contact_phone}} straight away.</p>`,
      },
      ja: {
        subject: "不具合のご連絡を受け付けました（{{ref}}）",
        body:
          `<p class="lead">{{recipient}} 様</p>` +
          `<p>お知らせいただいた内容を受け付けました。</p>` +
          `<table class="kv">` +
          `<tr><td class="k">受付番号</td><td>{{ref}}</td></tr>` +
          `<tr><td class="k">ご申告内容</td><td>{{defect_summary}}</td></tr>` +
          `<tr><td class="k">緊急度</td><td>{{priority}}</td></tr>` +
          `<tr><td class="k">訪問予定</td><td>{{visit_date}}</td></tr></table>` +
          `<p>ご訪問の前日に、改めてお時間を確認いたします。</p>` +
          `<p class="muted">水漏れや停電など生活に支障がある状況でしたら、お待ちにならず {{contact_phone}} まですぐにお電話ください。</p>`,
      },
      zh: {
        subject: "已受理您的报修（{{ref}}）",
        body:
          `<p class="lead">{{recipient}} 您好，</p>` +
          `<p>您反映的情况我们已经受理。</p>` +
          `<table class="kv">` +
          `<tr><td class="k">受理编号</td><td>{{ref}}</td></tr>` +
          `<tr><td class="k">报修内容</td><td>{{defect_summary}}</td></tr>` +
          `<tr><td class="k">紧急程度</td><td>{{priority}}</td></tr>` +
          `<tr><td class="k">预计上门</td><td>{{visit_date}}</td></tr></table>` +
          `<p>上门前一天我们会再次与您确认时间。</p>` +
          `<p class="muted">如遇漏水、停电等影响正常居住的情况，请不要等待，立即拨打 {{contact_phone}}。</p>`,
      },
      th: {
        subject: "รับแจ้งปัญหาแล้ว ({{ref}})",
        body:
          `<p class="lead">เรียน คุณ{{recipient}}</p>` +
          `<p>เราได้รับแจ้งเรื่องที่ท่านแจ้งมาแล้ว</p>` +
          `<table class="kv">` +
          `<tr><td class="k">หมายเลขรับเรื่อง</td><td>{{ref}}</td></tr>` +
          `<tr><td class="k">เรื่องที่แจ้ง</td><td>{{defect_summary}}</td></tr>` +
          `<tr><td class="k">ระดับความเร่งด่วน</td><td>{{priority}}</td></tr>` +
          `<tr><td class="k">กำหนดเข้าตรวจ</td><td>{{visit_date}}</td></tr></table>` +
          `<p>เราจะยืนยันเวลาอีกครั้งในวันก่อนเข้าตรวจ</p>` +
          `<p class="muted">หากเป็นเรื่องที่กระทบการอยู่อาศัย เช่น น้ำรั่วหรือไฟดับ กรุณาอย่ารอ โทร {{contact_phone}} ได้ทันที</p>`,
      },
      vi: {
        subject: "Đã ghi nhận sự cố ({{ref}})",
        body:
          `<p class="lead">Kính gửi {{recipient}},</p>` +
          `<p>Cảm ơn Quý khách đã báo — chúng tôi đã ghi nhận.</p>` +
          `<table class="kv">` +
          `<tr><td class="k">Số tiếp nhận</td><td>{{ref}}</td></tr>` +
          `<tr><td class="k">Nội dung báo</td><td>{{defect_summary}}</td></tr>` +
          `<tr><td class="k">Mức độ khẩn</td><td>{{priority}}</td></tr>` +
          `<tr><td class="k">Dự kiến đến</td><td>{{visit_date}}</td></tr></table>` +
          `<p>Chúng tôi sẽ xác nhận lại giờ vào ngày hôm trước.</p>` +
          `<p class="muted">Nếu là sự cố ảnh hưởng sinh hoạt như rò nước hay mất điện, xin đừng chờ — gọi ngay {{contact_phone}}.</p>`,
      },
    },
  },

  {
    key: "inspection.defect_resolved",
    name: "하자 처리 완료",
    description: "수리가 끝났을 때. 무엇을 고쳤는지와 비용 부담 주체를 밝힌다.",
    vars: vars("recipient", "ref", "work_done", "completed_date", "cost_bearer", "url"),
    tr: {
      ko: {
        subject: "하자 처리가 완료되었습니다 ({{ref}})",
        body:
          `<p class="lead">{{recipient}} 님, 안녕하세요.</p>` +
          `<p>{{completed_date}}에 수리를 마쳤습니다.</p>` +
          `<div class="box"><div class="label">작업 내용</div><div>{{work_done}}</div></div>` +
          `<table class="kv"><tr><td class="k">비용 부담</td><td>{{cost_bearer}}</td></tr></table>` +
          `<a class="btn" href="{{url}}">작업 내역 보기</a>` +
          `<p class="muted">써 보시고 제대로 고쳐지지 않았거나 같은 문제가 다시 생기면 알려 주세요. 다시 봐 드리겠습니다.</p>`,
      },
      en: {
        subject: "The repair is done ({{ref}})",
        body:
          `<p class="lead">Hi {{recipient}},</p>` +
          `<p>The work was completed on {{completed_date}}.</p>` +
          `<div class="box"><div class="label">What was done</div><div>{{work_done}}</div></div>` +
          `<table class="kv"><tr><td class="k">Cost borne by</td><td>{{cost_bearer}}</td></tr></table>` +
          `<a class="btn" href="{{url}}">View the job</a>` +
          `<p class="muted">Give it a try — if it isn't properly fixed, or the same thing happens again, tell us and we'll come back.</p>`,
      },
      ja: {
        subject: "不具合の対応が完了いたしました（{{ref}}）",
        body:
          `<p class="lead">{{recipient}} 様</p>` +
          `<p>{{completed_date}} に修繕を完了いたしました。</p>` +
          `<div class="box"><div class="label">作業内容</div><div>{{work_done}}</div></div>` +
          `<table class="kv"><tr><td class="k">費用のご負担</td><td>{{cost_bearer}}</td></tr></table>` +
          `<a class="btn" href="{{url}}">作業内容を確認する</a>` +
          `<p class="muted">実際にお使いになって、直っていない場合や同じ事象が再発した場合は、お知らせください。改めて対応いたします。</p>`,
      },
      zh: {
        subject: "维修已完成（{{ref}}）",
        body:
          `<p class="lead">{{recipient}} 您好，</p>` +
          `<p>维修已于 {{completed_date}} 完成。</p>` +
          `<div class="box"><div class="label">作业内容</div><div>{{work_done}}</div></div>` +
          `<table class="kv"><tr><td class="k">费用承担</td><td>{{cost_bearer}}</td></tr></table>` +
          `<a class="btn" href="{{url}}">查看作业记录</a>` +
          `<p class="muted">请您试用一下，若仍未修好或问题再次出现，请告知我们，我们会再上门处理。</p>`,
      },
      th: {
        subject: "ซ่อมแซมเสร็จเรียบร้อยแล้ว ({{ref}})",
        body:
          `<p class="lead">เรียน คุณ{{recipient}}</p>` +
          `<p>งานซ่อมแล้วเสร็จเมื่อวันที่ {{completed_date}}</p>` +
          `<div class="box"><div class="label">รายละเอียดงาน</div><div>{{work_done}}</div></div>` +
          `<table class="kv"><tr><td class="k">ผู้รับผิดชอบค่าใช้จ่าย</td><td>{{cost_bearer}}</td></tr></table>` +
          `<a class="btn" href="{{url}}">ดูรายละเอียดงาน</a>` +
          `<p class="muted">ลองใช้งานดู หากยังไม่เรียบร้อยหรือเกิดปัญหาเดิมซ้ำ กรุณาแจ้ง เราจะกลับไปดูให้อีกครั้ง</p>`,
      },
      vi: {
        subject: "Đã sửa xong ({{ref}})",
        body:
          `<p class="lead">Kính gửi {{recipient}},</p>` +
          `<p>Công việc đã hoàn thành vào ngày {{completed_date}}.</p>` +
          `<div class="box"><div class="label">Nội dung đã làm</div><div>{{work_done}}</div></div>` +
          `<table class="kv"><tr><td class="k">Bên chịu chi phí</td><td>{{cost_bearer}}</td></tr></table>` +
          `<a class="btn" href="{{url}}">Xem chi tiết công việc</a>` +
          `<p class="muted">Xin Quý khách dùng thử — nếu chưa ổn hoặc sự cố lặp lại, xin báo để chúng tôi quay lại xử lý.</p>`,
      },
    },
  },

  {
    key: "survey.service_csat",
    name: "입주 초기 만족도",
    description: "입주 후 일주일. 초기 불만을 조기에 잡는 창구이므로 문항을 짧게 둔다.",
    vars: vars("recipient", "space_name", "url", "minutes"),
    tr: {
      ko: {
        subject: "지내기 시작하신 소감을 들려주세요",
        body:
          `<p class="lead">{{recipient}} 님, 안녕하세요.</p>` +
          `<p>{{space_name}}에서 지내신 지 일주일이 되었습니다. 첫인상이 어떠셨는지 여쭙고 싶습니다.</p>` +
          `<a class="btn" href="{{url}}">설문 참여하기</a>` +
          `<p>{{minutes}}분이면 끝납니다. 문항도 몇 개 되지 않습니다. 좋았던 점보다 불편했던 점을 적어 주시면 더 도움이 됩니다.</p>` +
          `<p class="muted">지금 바로 고쳐야 할 일이 있으면 설문 대신 답장으로 알려 주세요. 그편이 빠릅니다.</p>`,
      },
      en: {
        subject: "How have your first days been?",
        body:
          `<p class="lead">Hi {{recipient}},</p>` +
          `<p>You've been at {{space_name}} a week now, and we'd like to hear how it's been so far.</p>` +
          `<a class="btn" href="{{url}}">Take the survey</a>` +
          `<p>It takes about {{minutes}} minutes and there are only a handful of questions. What didn't work is more useful to us than what did.</p>` +
          `<p class="muted">If something needs fixing right now, reply to this email instead — that's quicker.</p>`,
      },
      ja: {
        subject: "お住まいはじめのご感想をお聞かせください",
        body:
          `<p class="lead">{{recipient}} 様</p>` +
          `<p>{{space_name}} でお過ごしになって一週間が経ちました。最初のご印象はいかがでしたでしょうか。</p>` +
          `<a class="btn" href="{{url}}">アンケートに答える</a>` +
          `<p>{{minutes}} 分ほどで終わり、設問もわずかです。よかった点よりも、ご不便だった点をお書きいただけますと、より参考になります。</p>` +
          `<p class="muted">今すぐ対応が必要なことがございましたら、アンケートではなくご返信でお知らせください。そのほうが早く対応できます。</p>`,
      },
      zh: {
        subject: "入住这几天感觉如何？",
        body:
          `<p class="lead">{{recipient}} 您好，</p>` +
          `<p>您在 {{space_name}} 已住满一周，我们想听听您最初的感受。</p>` +
          `<a class="btn" href="{{url}}">参与问卷</a>` +
          `<p>大约 {{minutes}} 分钟即可完成，问题不多。比起满意的地方，写下不便之处对我们更有帮助。</p>` +
          `<p class="muted">若有需要立即处理的事，请直接回复本邮件，这样更快。</p>`,
      },
      th: {
        subject: "ช่วงแรกของการเข้าอยู่เป็นอย่างไรบ้าง",
        body:
          `<p class="lead">เรียน คุณ{{recipient}}</p>` +
          `<p>ท่านพักที่ {{space_name}} ครบหนึ่งสัปดาห์แล้ว เราอยากทราบความรู้สึกในช่วงแรก</p>` +
          `<a class="btn" href="{{url}}">ตอบแบบสอบถาม</a>` +
          `<p>ใช้เวลาราว {{minutes}} นาที มีคำถามไม่กี่ข้อ หากเขียนสิ่งที่ไม่สะดวกมาด้วย จะเป็นประโยชน์กับเรามากกว่าเรื่องที่ดีอยู่แล้ว</p>` +
          `<p class="muted">หากมีเรื่องต้องแก้ไขทันที กรุณาตอบกลับอีเมลนี้แทนการทำแบบสอบถาม จะเร็วกว่า</p>`,
      },
      vi: {
        subject: "Những ngày đầu của Quý khách thế nào?",
        body:
          `<p class="lead">Kính gửi {{recipient}},</p>` +
          `<p>Quý khách đã ở {{space_name}} được một tuần. Chúng tôi muốn nghe cảm nhận ban đầu của Quý khách.</p>` +
          `<a class="btn" href="{{url}}">Trả lời khảo sát</a>` +
          `<p>Chỉ mất khoảng {{minutes}} phút với vài câu hỏi. Những điều chưa ổn sẽ hữu ích cho chúng tôi hơn là những điều đã tốt.</p>` +
          `<p class="muted">Nếu có việc cần xử lý ngay, xin trả lời email này thay vì làm khảo sát — sẽ nhanh hơn.</p>`,
      },
    },
  },

  {
    key: "survey.midterm",
    name: "거주 중간 만족도",
    description: "계약 중간 시점. 갱신 의사를 가늠하는 신호로도 쓴다.",
    vars: vars("recipient", "space_name", "url", "minutes"),
    tr: {
      ko: {
        subject: "지내시면서 느끼신 점을 들려주세요",
        body:
          `<p class="lead">{{recipient}} 님, 안녕하세요.</p>` +
          `<p>{{space_name}}에서 지내신 지 절반쯤 지났습니다. 그동안 느끼신 점을 들려주시면 남은 기간을 더 낫게 만드는 데 쓰겠습니다.</p>` +
          `<a class="btn" href="{{url}}">설문 참여하기</a>` +
          `<p>{{minutes}}분이면 됩니다. 관리·시설·응대 가운데 아쉬웠던 부분을 솔직하게 적어 주세요.</p>` +
          `<p class="muted">답변은 담당자만 봅니다. 이웃이나 다른 입주자에게 공유되지 않습니다.</p>`,
      },
      en: {
        subject: "How's it going so far?",
        body:
          `<p class="lead">Hi {{recipient}},</p>` +
          `<p>You're about halfway through your time at {{space_name}}. Telling us how it's gone helps us make the rest of it better.</p>` +
          `<a class="btn" href="{{url}}">Take the survey</a>` +
          `<p>It takes {{minutes}} minutes. Be honest about what has fallen short — building, facilities or how we've dealt with you.</p>` +
          `<p class="muted">Only your case handler sees the answers. Nothing is shared with neighbours or other residents.</p>`,
      },
      ja: {
        subject: "お住まいのご感想をお聞かせください",
        body:
          `<p class="lead">{{recipient}} 様</p>` +
          `<p>{{space_name}} でのご入居期間も半ばを過ぎました。これまでお感じになった点をお聞かせいただければ、残りの期間をより良くするために活かしてまいります。</p>` +
          `<a class="btn" href="{{url}}">アンケートに答える</a>` +
          `<p>{{minutes}} 分ほどで終わります。管理・設備・対応のうち、物足りなかった点を率直にお書きください。</p>` +
          `<p class="muted">ご回答は担当者のみが確認いたします。近隣の方や他のご入居者に共有されることはございません。</p>`,
      },
      zh: {
        subject: "住到现在感觉怎么样？",
        body:
          `<p class="lead">{{recipient}} 您好，</p>` +
          `<p>您在 {{space_name}} 的居住期已过半。告诉我们这段时间的感受，我们会用来改善剩余的日子。</p>` +
          `<a class="btn" href="{{url}}">参与问卷</a>` +
          `<p>约 {{minutes}} 分钟即可完成。请坦率写下管理、设施或服务方面不足之处。</p>` +
          `<p class="muted">答复仅负责专员可见，不会与邻居或其他住户分享。</p>`,
      },
      th: {
        subject: "อยู่มาถึงตอนนี้รู้สึกอย่างไรบ้าง",
        body:
          `<p class="lead">เรียน คุณ{{recipient}}</p>` +
          `<p>ระยะเวลาพักที่ {{space_name}} ผ่านมาราวครึ่งทางแล้ว หากท่านเล่าความรู้สึกที่ผ่านมาให้ฟัง เราจะนำไปปรับปรุงช่วงเวลาที่เหลือ</p>` +
          `<a class="btn" href="{{url}}">ตอบแบบสอบถาม</a>` +
          `<p>ใช้เวลาราว {{minutes}} นาที กรุณาเขียนอย่างตรงไปตรงมาว่าด้านการดูแล สิ่งอำนวยความสะดวก หรือการให้บริการ ยังขาดตรงไหน</p>` +
          `<p class="muted">คำตอบมีเพียงผู้ดูแลที่เห็น ไม่มีการเปิดเผยต่อเพื่อนบ้านหรือผู้พักอาศัยรายอื่น</p>`,
      },
      vi: {
        subject: "Đến giờ Quý khách thấy thế nào?",
        body:
          `<p class="lead">Kính gửi {{recipient}},</p>` +
          `<p>Thời gian ở {{space_name}} của Quý khách đã qua khoảng một nửa. Chia sẻ cảm nhận sẽ giúp chúng tôi làm tốt hơn cho quãng còn lại.</p>` +
          `<a class="btn" href="{{url}}">Trả lời khảo sát</a>` +
          `<p>Chỉ mất {{minutes}} phút. Xin Quý khách nói thẳng những điểm chưa ổn về quản lý, tiện ích hay cách chúng tôi phục vụ.</p>` +
          `<p class="muted">Chỉ người phụ trách xem câu trả lời. Không chia sẻ với hàng xóm hay cư dân khác.</p>`,
      },
    },
  },

  {
    key: "survey.exit",
    name: "퇴거 만족도",
    description: "퇴거 직후. 재이용·추천 의향을 함께 묻는다.",
    vars: vars("recipient", "space_name", "url", "minutes"),
    tr: {
      ko: {
        subject: "지내신 동안 어떠셨는지 들려주세요",
        body:
          `<p class="lead">{{recipient}} 님, 안녕하세요.</p>` +
          `<p>{{space_name}} 생활을 마치셨습니다. 그동안 어떠셨는지 마지막으로 여쭙고 싶습니다.</p>` +
          `<a class="btn" href="{{url}}">설문 참여하기</a>` +
          `<p>{{minutes}}분이면 됩니다. 아쉬웠던 점을 적어 주시면 다음 분들이 같은 불편을 겪지 않도록 고치겠습니다.</p>` +
          `<p class="muted">그동안 함께해 주셔서 감사했습니다.</p>`,
      },
      en: {
        subject: "How was your stay?",
        body:
          `<p class="lead">Hi {{recipient}},</p>` +
          `<p>Your time at {{space_name}} has come to an end, and we'd like to ask how it was, one last time.</p>` +
          `<a class="btn" href="{{url}}">Take the survey</a>` +
          `<p>It takes {{minutes}} minutes. Telling us what fell short is how we stop the next person running into the same thing.</p>` +
          `<p class="muted">Thank you for staying with us.</p>`,
      },
      ja: {
        subject: "ご滞在はいかがでしたでしょうか",
        body:
          `<p class="lead">{{recipient}} 様</p>` +
          `<p>{{space_name}} でのご生活を終えられました。最後に、これまでのご感想をお伺いしたく存じます。</p>` +
          `<a class="btn" href="{{url}}">アンケートに答える</a>` +
          `<p>{{minutes}} 分ほどで終わります。物足りなかった点をお書きいただければ、次の方が同じご不便を感じないよう改善してまいります。</p>` +
          `<p class="muted">これまでご利用いただき、誠にありがとうございました。</p>`,
      },
      zh: {
        subject: "这段居住体验如何？",
        body:
          `<p class="lead">{{recipient}} 您好，</p>` +
          `<p>您在 {{space_name}} 的居住已告一段落。最后想请教您这段时间的感受。</p>` +
          `<a class="btn" href="{{url}}">参与问卷</a>` +
          `<p>约 {{minutes}} 分钟。写下不足之处，我们会加以改进，让后来的住户不再遇到同样的问题。</p>` +
          `<p class="muted">感谢您这段时间的信赖。</p>`,
      },
      th: {
        subject: "การเข้าพักที่ผ่านมาเป็นอย่างไรบ้าง",
        body:
          `<p class="lead">เรียน คุณ{{recipient}}</p>` +
          `<p>การพักอาศัยที่ {{space_name}} ของท่านสิ้นสุดลงแล้ว เราขอถามความรู้สึกที่ผ่านมาเป็นครั้งสุดท้าย</p>` +
          `<a class="btn" href="{{url}}">ตอบแบบสอบถาม</a>` +
          `<p>ใช้เวลาราว {{minutes}} นาที หากท่านเขียนสิ่งที่ยังไม่ดีพอ เราจะแก้ไขเพื่อไม่ให้ผู้พักคนต่อไปเจอปัญหาเดียวกัน</p>` +
          `<p class="muted">ขอบคุณที่อยู่กับเราตลอดมา</p>`,
      },
      vi: {
        subject: "Thời gian lưu trú của Quý khách thế nào?",
        body:
          `<p class="lead">Kính gửi {{recipient}},</p>` +
          `<p>Quãng thời gian ở {{space_name}} của Quý khách đã khép lại. Chúng tôi xin hỏi lần cuối về cảm nhận của Quý khách.</p>` +
          `<a class="btn" href="{{url}}">Trả lời khảo sát</a>` +
          `<p>Chỉ mất {{minutes}} phút. Những điểm chưa ổn Quý khách nêu ra sẽ giúp người sau không gặp lại điều tương tự.</p>` +
          `<p class="muted">Cảm ơn Quý khách đã đồng hành cùng chúng tôi.</p>`,
      },
    },
  },

  {
    key: "survey.reminder",
    name: "설문 재안내",
    description: "미응답 5일 후 한 번만. 두 번 이상 보내지 않는다.",
    vars: vars("recipient", "url", "minutes", "close_date"),
    tr: {
      ko: {
        subject: "설문이 아직 열려 있습니다",
        body:
          `<p class="lead">{{recipient}} 님, 안녕하세요.</p>` +
          `<p>얼마 전 보내 드린 설문이 {{close_date}}까지 열려 있어 한 번 더 알려 드립니다. {{minutes}}분이면 끝납니다.</p>` +
          `<a class="btn" href="{{url}}">설문 참여하기</a>` +
          `<p class="muted">참여가 어려우시면 그냥 두셔도 됩니다. 이 건으로 다시 보내지는 않습니다.</p>`,
      },
      en: {
        subject: "The survey is still open",
        body:
          `<p class="lead">Hi {{recipient}},</p>` +
          `<p>The survey we sent a few days ago is open until {{close_date}}, so here's one more nudge. It takes {{minutes}} minutes.</p>` +
          `<a class="btn" href="{{url}}">Take the survey</a>` +
          `<p class="muted">If you'd rather not, that's fine — we won't write about this again.</p>`,
      },
      ja: {
        subject: "アンケートはまだ受け付けております",
        body:
          `<p class="lead">{{recipient}} 様</p>` +
          `<p>先日お送りしたアンケートは {{close_date}} まで受け付けておりますので、改めてご案内いたします。{{minutes}} 分ほどで終わります。</p>` +
          `<a class="btn" href="{{url}}">アンケートに答える</a>` +
          `<p class="muted">ご都合が合わない場合は、そのままで結構です。本件について再度お送りすることはございません。</p>`,
      },
      zh: {
        subject: "问卷仍在开放中",
        body:
          `<p class="lead">{{recipient}} 您好，</p>` +
          `<p>此前发送的问卷开放至 {{close_date}}，再提醒您一次。约 {{minutes}} 分钟即可完成。</p>` +
          `<a class="btn" href="{{url}}">参与问卷</a>` +
          `<p class="muted">若不便参与，忽略即可。此事我们不会再次发信。</p>`,
      },
      th: {
        subject: "แบบสอบถามยังเปิดรับอยู่",
        body:
          `<p class="lead">เรียน คุณ{{recipient}}</p>` +
          `<p>แบบสอบถามที่ส่งไปก่อนหน้านี้ยังเปิดถึงวันที่ {{close_date}} จึงขอแจ้งอีกครั้ง ใช้เวลาราว {{minutes}} นาที</p>` +
          `<a class="btn" href="{{url}}">ตอบแบบสอบถาม</a>` +
          `<p class="muted">หากไม่สะดวก ปล่อยผ่านได้เลย เราจะไม่ส่งเรื่องนี้อีก</p>`,
      },
      vi: {
        subject: "Khảo sát vẫn đang mở",
        body:
          `<p class="lead">Kính gửi {{recipient}},</p>` +
          `<p>Khảo sát chúng tôi gửi hôm trước còn mở đến ngày {{close_date}}, xin nhắc lại một lần. Chỉ mất {{minutes}} phút.</p>` +
          `<a class="btn" href="{{url}}">Trả lời khảo sát</a>` +
          `<p class="muted">Nếu Quý khách không muốn, xin cứ bỏ qua — chúng tôi sẽ không gửi lại về việc này.</p>`,
      },
    },
  },

  {
    key: "survey.review_request",
    name: "리뷰 요청 (마케팅성)",
    description: "만족도 응답이 좋았던 고객에게만. 마케팅 수신동의 확인 후 발송한다.",
    vars: vars("recipient", "space_name", "url", "unsubscribe_url"),
    tr: {
      ko: {
        subject: "좋게 봐 주신 이야기를 나눠 주시겠어요?",
        body:
          `<p class="lead">{{recipient}} 님, 안녕하세요.</p>` +
          `<p>얼마 전 설문에서 좋은 말씀을 남겨 주셔서 감사했습니다. 괜찮으시면 그 이야기를 다른 분들도 볼 수 있는 곳에 남겨 주시겠어요?</p>` +
          `<a class="btn" href="{{url}}">리뷰 남기기</a>` +
          `<p>집을 구하는 분들에게는 실제로 살아 본 사람의 이야기가 가장 도움이 됩니다. 몇 줄이면 충분합니다.</p>` +
          `<p class="muted">부담되시면 안 하셔도 괜찮습니다. 지내시는 데는 아무 영향이 없습니다.</p>`,
      },
      en: {
        subject: "Would you share what you told us?",
        body:
          `<p class="lead">Hi {{recipient}},</p>` +
          `<p>Thank you for the kind words in your survey. If you're willing, would you put them somewhere other people can see?</p>` +
          `<a class="btn" href="{{url}}">Write a review</a>` +
          `<p>For someone looking for a place, hearing from a person who actually lived there counts for more than anything we could say. A few lines is plenty.</p>` +
          `<p class="muted">No pressure at all — it makes no difference to your tenancy either way.</p>`,
      },
      ja: {
        subject: "いただいたお言葉を、ほかの方にもお届けできませんか",
        body:
          `<p class="lead">{{recipient}} 様</p>` +
          `<p>先日のアンケートで温かいお言葉をいただき、ありがとうございました。差し支えなければ、そのお話をほかの方の目に触れる場所にも残していただけませんでしょうか。</p>` +
          `<a class="btn" href="{{url}}">レビューを書く</a>` +
          `<p>お住まいをお探しの方にとっては、実際に暮らされた方のお話がいちばん参考になります。数行で十分です。</p>` +
          `<p class="muted">ご負担でしたら、もちろん結構です。ご入居に影響することは一切ございません。</p>`,
      },
      zh: {
        subject: "方便把您的评价分享出来吗？",
        body:
          `<p class="lead">{{recipient}} 您好，</p>` +
          `<p>感谢您在问卷中留下的好评。若方便，可否把这些话也留在其他人能看到的地方呢？</p>` +
          `<a class="btn" href="{{url}}">撰写评价</a>` +
          `<p>对正在找房的人来说，真正住过的人怎么说，比我们的任何介绍都更有参考价值。写上几句就足够了。</p>` +
          `<p class="muted">若觉得为难，不写也完全没关系，这与您的租住毫无关联。</p>`,
      },
      th: {
        subject: "ขอแบ่งปันความเห็นดี ๆ ของท่านได้ไหม",
        body:
          `<p class="lead">เรียน คุณ{{recipient}}</p>` +
          `<p>ขอบคุณสำหรับคำชมในแบบสอบถามที่ผ่านมา หากท่านสะดวก จะช่วยเขียนสิ่งที่ท่านบอกเราไว้ในที่ที่คนอื่นเห็นได้ด้วยไหม</p>` +
          `<a class="btn" href="{{url}}">เขียนรีวิว</a>` +
          `<p>สำหรับคนที่กำลังหาที่พัก เสียงจากคนที่เคยอยู่จริงมีค่ากว่าคำโฆษณาใด ๆ เขียนเพียงไม่กี่บรรทัดก็พอ</p>` +
          `<p class="muted">หากรู้สึกลำบากใจ ไม่เขียนก็ได้ ไม่มีผลต่อการเช่าของท่านแต่อย่างใด</p>`,
      },
      vi: {
        subject: "Quý khách chia sẻ nhận xét đó được không?",
        body:
          `<p class="lead">Kính gửi {{recipient}},</p>` +
          `<p>Cảm ơn Quý khách đã dành lời khen trong khảo sát vừa rồi. Nếu tiện, Quý khách chia sẻ điều đó ở nơi người khác cũng đọc được nhé?</p>` +
          `<a class="btn" href="{{url}}">Viết nhận xét</a>` +
          `<p>Với người đang tìm chỗ ở, lời của người từng sống thật có giá trị hơn mọi lời giới thiệu của chúng tôi. Vài dòng là đủ.</p>` +
          `<p class="muted">Nếu thấy phiền thì Quý khách cứ bỏ qua — điều đó không ảnh hưởng gì đến việc thuê nhà.</p>`,
      },
    },
  },
];
