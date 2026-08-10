// staff — 업무 배정·알림·다이제스트 (staff.*)
//
// 내부 직원용. 제목에 [배정] [기한] [SLA] 같은 말머리를 두어 받은편지함에서 걸러 읽게 한다.
//
// ⚠️ 다이제스트류(daily/weekly/monthly/overdue)는 **매일 온다**. 문장을 늘리면 아무도
//    읽지 않는다. 숫자와 링크만 남기고 인사말은 최소한으로.
// ⚠️ 고객 개인정보는 이름·건 번호까지만. 연락처·금융정보는 링크 너머에서 권한 확인 후 보여 준다.
// 한국어는 humanize-korean 통과본. 영어에서 재기계번역 금지.
import { vars } from "./_shared.mjs";

export const STAFF_WORK = [
  {
    key: "staff.lead_assigned",
    name: "리드 배정",
    description: "새 문의가 나에게 배정됨. 첫 응대 기한을 함께 준다.",
    vars: vars("recipient", "ref", "lead_name", "inquiry_type", "source", "respond_by", "url"),
    tr: {
      ko: {
        subject: "[배정] 신규 문의 {{ref}}",
        body:
          `<p class="lead">{{recipient}} 님, 새 문의가 배정되었습니다.</p>` +
          `<table class="kv">` +
          `<tr><td class="k">문의자</td><td>{{lead_name}}</td></tr>` +
          `<tr><td class="k">종류</td><td>{{inquiry_type}}</td></tr>` +
          `<tr><td class="k">유입</td><td>{{source}}</td></tr>` +
          `<tr><td class="k">1차 응대 기한</td><td>{{respond_by}}</td></tr></table>` +
          `<a class="btn" href="{{url}}">문의 열기</a>`,
      },
      en: {
        subject: "[Assigned] new enquiry {{ref}}",
        body:
          `<p class="lead">Hi {{recipient}}, a new enquiry is yours.</p>` +
          `<table class="kv">` +
          `<tr><td class="k">From</td><td>{{lead_name}}</td></tr>` +
          `<tr><td class="k">Type</td><td>{{inquiry_type}}</td></tr>` +
          `<tr><td class="k">Source</td><td>{{source}}</td></tr>` +
          `<tr><td class="k">First reply by</td><td>{{respond_by}}</td></tr></table>` +
          `<a class="btn" href="{{url}}">Open the enquiry</a>`,
      },
      ja: {
        subject: "【割当】新規問い合わせ {{ref}}",
        body:
          `<p class="lead">{{recipient}} さん、新しい問い合わせが割り当てられました。</p>` +
          `<table class="kv">` +
          `<tr><td class="k">問い合わせ者</td><td>{{lead_name}}</td></tr>` +
          `<tr><td class="k">種別</td><td>{{inquiry_type}}</td></tr>` +
          `<tr><td class="k">流入元</td><td>{{source}}</td></tr>` +
          `<tr><td class="k">初回対応期限</td><td>{{respond_by}}</td></tr></table>` +
          `<a class="btn" href="{{url}}">問い合わせを開く</a>`,
      },
      zh: {
        subject: "【分配】新咨询 {{ref}}",
        body:
          `<p class="lead">{{recipient}} 您好，有一条新咨询分配给您。</p>` +
          `<table class="kv">` +
          `<tr><td class="k">咨询人</td><td>{{lead_name}}</td></tr>` +
          `<tr><td class="k">类型</td><td>{{inquiry_type}}</td></tr>` +
          `<tr><td class="k">来源</td><td>{{source}}</td></tr>` +
          `<tr><td class="k">首次响应期限</td><td>{{respond_by}}</td></tr></table>` +
          `<a class="btn" href="{{url}}">打开咨询</a>`,
      },
      th: {
        subject: "[มอบหมาย] เรื่องสอบถามใหม่ {{ref}}",
        body:
          `<p class="lead">คุณ{{recipient}} มีเรื่องสอบถามใหม่มอบหมายให้คุณ</p>` +
          `<table class="kv">` +
          `<tr><td class="k">ผู้สอบถาม</td><td>{{lead_name}}</td></tr>` +
          `<tr><td class="k">ประเภท</td><td>{{inquiry_type}}</td></tr>` +
          `<tr><td class="k">ที่มา</td><td>{{source}}</td></tr>` +
          `<tr><td class="k">ตอบกลับภายใน</td><td>{{respond_by}}</td></tr></table>` +
          `<a class="btn" href="{{url}}">เปิดเรื่อง</a>`,
      },
      vi: {
        subject: "[Giao việc] yêu cầu mới {{ref}}",
        body:
          `<p class="lead">Chào {{recipient}}, có một yêu cầu mới giao cho bạn.</p>` +
          `<table class="kv">` +
          `<tr><td class="k">Người hỏi</td><td>{{lead_name}}</td></tr>` +
          `<tr><td class="k">Loại</td><td>{{inquiry_type}}</td></tr>` +
          `<tr><td class="k">Nguồn</td><td>{{source}}</td></tr>` +
          `<tr><td class="k">Phản hồi trước</td><td>{{respond_by}}</td></tr></table>` +
          `<a class="btn" href="{{url}}">Mở yêu cầu</a>`,
      },
    },
  },

  {
    key: "staff.application_assigned",
    name: "신청서 배정",
    description: "심사할 신청서가 배정됨. 마감과 누락 서류를 알린다.",
    vars: vars("recipient", "ref", "applicant_name", "application_type", "due_date", "missing_docs", "url"),
    tr: {
      ko: {
        subject: "[배정] 신청서 {{ref}}",
        body:
          `<p class="lead">{{recipient}} 님, 심사할 신청서가 배정되었습니다.</p>` +
          `<table class="kv">` +
          `<tr><td class="k">신청자</td><td>{{applicant_name}}</td></tr>` +
          `<tr><td class="k">종류</td><td>{{application_type}}</td></tr>` +
          `<tr><td class="k">심사 마감</td><td>{{due_date}}</td></tr>` +
          `<tr><td class="k">누락 서류</td><td>{{missing_docs}}</td></tr></table>` +
          `<a class="btn" href="{{url}}">신청서 열기</a>`,
      },
      en: {
        subject: "[Assigned] application {{ref}}",
        body:
          `<p class="lead">Hi {{recipient}}, an application is yours to review.</p>` +
          `<table class="kv">` +
          `<tr><td class="k">Applicant</td><td>{{applicant_name}}</td></tr>` +
          `<tr><td class="k">Type</td><td>{{application_type}}</td></tr>` +
          `<tr><td class="k">Due</td><td>{{due_date}}</td></tr>` +
          `<tr><td class="k">Missing</td><td>{{missing_docs}}</td></tr></table>` +
          `<a class="btn" href="{{url}}">Open the application</a>`,
      },
      ja: {
        subject: "【割当】申込書 {{ref}}",
        body:
          `<p class="lead">{{recipient}} さん、審査する申込書が割り当てられました。</p>` +
          `<table class="kv">` +
          `<tr><td class="k">申込者</td><td>{{applicant_name}}</td></tr>` +
          `<tr><td class="k">種別</td><td>{{application_type}}</td></tr>` +
          `<tr><td class="k">審査期限</td><td>{{due_date}}</td></tr>` +
          `<tr><td class="k">未着書類</td><td>{{missing_docs}}</td></tr></table>` +
          `<a class="btn" href="{{url}}">申込書を開く</a>`,
      },
      zh: {
        subject: "【分配】申请 {{ref}}",
        body:
          `<p class="lead">{{recipient}} 您好，有一份申请分配给您审核。</p>` +
          `<table class="kv">` +
          `<tr><td class="k">申请人</td><td>{{applicant_name}}</td></tr>` +
          `<tr><td class="k">类型</td><td>{{application_type}}</td></tr>` +
          `<tr><td class="k">审核截止</td><td>{{due_date}}</td></tr>` +
          `<tr><td class="k">缺少材料</td><td>{{missing_docs}}</td></tr></table>` +
          `<a class="btn" href="{{url}}">打开申请</a>`,
      },
      th: {
        subject: "[มอบหมาย] ใบสมัคร {{ref}}",
        body:
          `<p class="lead">คุณ{{recipient}} มีใบสมัครมอบหมายให้คุณพิจารณา</p>` +
          `<table class="kv">` +
          `<tr><td class="k">ผู้สมัคร</td><td>{{applicant_name}}</td></tr>` +
          `<tr><td class="k">ประเภท</td><td>{{application_type}}</td></tr>` +
          `<tr><td class="k">กำหนดพิจารณา</td><td>{{due_date}}</td></tr>` +
          `<tr><td class="k">เอกสารที่ขาด</td><td>{{missing_docs}}</td></tr></table>` +
          `<a class="btn" href="{{url}}">เปิดใบสมัคร</a>`,
      },
      vi: {
        subject: "[Giao việc] hồ sơ {{ref}}",
        body:
          `<p class="lead">Chào {{recipient}}, có hồ sơ giao cho bạn xét duyệt.</p>` +
          `<table class="kv">` +
          `<tr><td class="k">Người nộp</td><td>{{applicant_name}}</td></tr>` +
          `<tr><td class="k">Loại</td><td>{{application_type}}</td></tr>` +
          `<tr><td class="k">Hạn xét</td><td>{{due_date}}</td></tr>` +
          `<tr><td class="k">Thiếu giấy tờ</td><td>{{missing_docs}}</td></tr></table>` +
          `<a class="btn" href="{{url}}">Mở hồ sơ</a>`,
      },
    },
  },

  {
    key: "staff.task_assigned",
    name: "업무 배정",
    description: "일반 업무 항목 배정.",
    vars: vars("recipient", "ref", "task_title", "assigner", "due_date", "priority", "url"),
    tr: {
      ko: {
        subject: "[배정] {{task_title}}",
        body:
          `<p class="lead">{{assigner}} 님이 업무를 배정했습니다.</p>` +
          `<table class="kv">` +
          `<tr><td class="k">업무</td><td>{{task_title}}</td></tr>` +
          `<tr><td class="k">기한</td><td>{{due_date}}</td></tr>` +
          `<tr><td class="k">우선순위</td><td>{{priority}}</td></tr>` +
          `<tr><td class="k">번호</td><td>{{ref}}</td></tr></table>` +
          `<a class="btn" href="{{url}}">업무 열기</a>`,
      },
      en: {
        subject: "[Assigned] {{task_title}}",
        body:
          `<p class="lead">{{assigner}} has assigned you a task.</p>` +
          `<table class="kv">` +
          `<tr><td class="k">Task</td><td>{{task_title}}</td></tr>` +
          `<tr><td class="k">Due</td><td>{{due_date}}</td></tr>` +
          `<tr><td class="k">Priority</td><td>{{priority}}</td></tr>` +
          `<tr><td class="k">Ref</td><td>{{ref}}</td></tr></table>` +
          `<a class="btn" href="{{url}}">Open the task</a>`,
      },
      ja: {
        subject: "【割当】{{task_title}}",
        body:
          `<p class="lead">{{assigner}} さんが業務を割り当てました。</p>` +
          `<table class="kv">` +
          `<tr><td class="k">業務</td><td>{{task_title}}</td></tr>` +
          `<tr><td class="k">期限</td><td>{{due_date}}</td></tr>` +
          `<tr><td class="k">優先度</td><td>{{priority}}</td></tr>` +
          `<tr><td class="k">番号</td><td>{{ref}}</td></tr></table>` +
          `<a class="btn" href="{{url}}">業務を開く</a>`,
      },
      zh: {
        subject: "【分配】{{task_title}}",
        body:
          `<p class="lead">{{assigner}} 给您分配了一项任务。</p>` +
          `<table class="kv">` +
          `<tr><td class="k">任务</td><td>{{task_title}}</td></tr>` +
          `<tr><td class="k">期限</td><td>{{due_date}}</td></tr>` +
          `<tr><td class="k">优先级</td><td>{{priority}}</td></tr>` +
          `<tr><td class="k">编号</td><td>{{ref}}</td></tr></table>` +
          `<a class="btn" href="{{url}}">打开任务</a>`,
      },
      th: {
        subject: "[มอบหมาย] {{task_title}}",
        body:
          `<p class="lead">{{assigner}} มอบหมายงานให้คุณ</p>` +
          `<table class="kv">` +
          `<tr><td class="k">งาน</td><td>{{task_title}}</td></tr>` +
          `<tr><td class="k">กำหนดส่ง</td><td>{{due_date}}</td></tr>` +
          `<tr><td class="k">ความสำคัญ</td><td>{{priority}}</td></tr>` +
          `<tr><td class="k">เลขที่</td><td>{{ref}}</td></tr></table>` +
          `<a class="btn" href="{{url}}">เปิดงาน</a>`,
      },
      vi: {
        subject: "[Giao việc] {{task_title}}",
        body:
          `<p class="lead">{{assigner}} đã giao cho bạn một việc.</p>` +
          `<table class="kv">` +
          `<tr><td class="k">Công việc</td><td>{{task_title}}</td></tr>` +
          `<tr><td class="k">Hạn</td><td>{{due_date}}</td></tr>` +
          `<tr><td class="k">Ưu tiên</td><td>{{priority}}</td></tr>` +
          `<tr><td class="k">Mã</td><td>{{ref}}</td></tr></table>` +
          `<a class="btn" href="{{url}}">Mở công việc</a>`,
      },
    },
  },

  {
    key: "staff.task_overdue",
    name: "기한 초과 업무",
    description: "기한을 넘긴 업무 알림. 목록으로 짧게.",
    vars: vars("recipient", "overdue_count", "task_list", "url"),
    tr: {
      ko: {
        subject: "[기한] 초과된 업무 {{overdue_count}}건",
        body:
          `<p class="lead">{{recipient}} 님, 기한이 지난 업무가 {{overdue_count}}건 있습니다.</p>` +
          `<div class="box"><div class="label">초과 업무</div><div>{{task_list}}</div></div>` +
          `<a class="btn" href="{{url}}">내 업무 보기</a>` +
          `<p class="muted">처리가 어려운 사정이 있으면 기한을 조정하거나 담당을 넘겨 주세요. 그대로 두면 알림이 계속 갑니다.</p>`,
      },
      en: {
        subject: "[Overdue] {{overdue_count}} tasks past due",
        body:
          `<p class="lead">Hi {{recipient}}, {{overdue_count}} of your tasks are past their due date.</p>` +
          `<div class="box"><div class="label">Overdue</div><div>{{task_list}}</div></div>` +
          `<a class="btn" href="{{url}}">See your tasks</a>` +
          `<p class="muted">If something can't be done, move the date or hand it over. Left as is, the reminders keep coming.</p>`,
      },
      ja: {
        subject: "【期限】超過した業務 {{overdue_count}} 件",
        body:
          `<p class="lead">{{recipient}} さん、期限を過ぎた業務が {{overdue_count}} 件あります。</p>` +
          `<div class="box"><div class="label">期限超過</div><div>{{task_list}}</div></div>` +
          `<a class="btn" href="{{url}}">自分の業務を見る</a>` +
          `<p class="muted">対応が難しい事情があれば、期限を変更するか担当を引き継いでください。そのままですと通知が届き続けます。</p>`,
      },
      zh: {
        subject: "【逾期】{{overdue_count}} 项任务已过期",
        body:
          `<p class="lead">{{recipient}} 您好，您有 {{overdue_count}} 项任务已过期限。</p>` +
          `<div class="box"><div class="label">逾期任务</div><div>{{task_list}}</div></div>` +
          `<a class="btn" href="{{url}}">查看我的任务</a>` +
          `<p class="muted">若确有难处，请调整期限或转交他人。保持原状会持续收到提醒。</p>`,
      },
      th: {
        subject: "[เกินกำหนด] งานค้าง {{overdue_count}} รายการ",
        body:
          `<p class="lead">คุณ{{recipient}} มีงานเกินกำหนด {{overdue_count}} รายการ</p>` +
          `<div class="box"><div class="label">งานที่เกินกำหนด</div><div>{{task_list}}</div></div>` +
          `<a class="btn" href="{{url}}">ดูงานของฉัน</a>` +
          `<p class="muted">หากมีเหตุที่ทำไม่ได้ กรุณาเลื่อนกำหนดหรือส่งต่อให้ผู้อื่น ถ้าปล่อยไว้ ระบบจะแจ้งเตือนต่อไปเรื่อย ๆ</p>`,
      },
      vi: {
        subject: "[Quá hạn] {{overdue_count}} công việc",
        body:
          `<p class="lead">Chào {{recipient}}, bạn có {{overdue_count}} công việc quá hạn.</p>` +
          `<div class="box"><div class="label">Quá hạn</div><div>{{task_list}}</div></div>` +
          `<a class="btn" href="{{url}}">Xem công việc của tôi</a>` +
          `<p class="muted">Nếu không làm được, hãy dời hạn hoặc bàn giao. Để nguyên thì nhắc nhở sẽ tiếp tục.</p>`,
      },
    },
  },

  {
    key: "staff.cs_ticket_assigned",
    name: "CS 티켓 배정",
    description: "고객 문의 배정. SLA 시한을 앞에 둔다.",
    vars: vars("recipient", "ref", "customer_name", "category", "priority", "respond_by", "url"),
    tr: {
      ko: {
        subject: "[CS] {{ref}} — {{respond_by}}까지",
        body:
          `<p class="lead">{{recipient}} 님, CS 티켓이 배정되었습니다.</p>` +
          `<table class="kv">` +
          `<tr><td class="k">고객</td><td>{{customer_name}}</td></tr>` +
          `<tr><td class="k">분류</td><td>{{category}}</td></tr>` +
          `<tr><td class="k">긴급도</td><td>{{priority}}</td></tr>` +
          `<tr><td class="k">응답 기한</td><td>{{respond_by}}</td></tr></table>` +
          `<a class="btn" href="{{url}}">티켓 열기</a>`,
      },
      en: {
        subject: "[CS] {{ref}} — due {{respond_by}}",
        body:
          `<p class="lead">Hi {{recipient}}, a support ticket is yours.</p>` +
          `<table class="kv">` +
          `<tr><td class="k">Customer</td><td>{{customer_name}}</td></tr>` +
          `<tr><td class="k">Category</td><td>{{category}}</td></tr>` +
          `<tr><td class="k">Priority</td><td>{{priority}}</td></tr>` +
          `<tr><td class="k">Respond by</td><td>{{respond_by}}</td></tr></table>` +
          `<a class="btn" href="{{url}}">Open the ticket</a>`,
      },
      ja: {
        subject: "【CS】{{ref}} — {{respond_by}} まで",
        body:
          `<p class="lead">{{recipient}} さん、CS チケットが割り当てられました。</p>` +
          `<table class="kv">` +
          `<tr><td class="k">お客様</td><td>{{customer_name}}</td></tr>` +
          `<tr><td class="k">分類</td><td>{{category}}</td></tr>` +
          `<tr><td class="k">緊急度</td><td>{{priority}}</td></tr>` +
          `<tr><td class="k">応答期限</td><td>{{respond_by}}</td></tr></table>` +
          `<a class="btn" href="{{url}}">チケットを開く</a>`,
      },
      zh: {
        subject: "【客服】{{ref}} — {{respond_by}} 前",
        body:
          `<p class="lead">{{recipient}} 您好，有一张客服工单分配给您。</p>` +
          `<table class="kv">` +
          `<tr><td class="k">客户</td><td>{{customer_name}}</td></tr>` +
          `<tr><td class="k">分类</td><td>{{category}}</td></tr>` +
          `<tr><td class="k">紧急程度</td><td>{{priority}}</td></tr>` +
          `<tr><td class="k">响应期限</td><td>{{respond_by}}</td></tr></table>` +
          `<a class="btn" href="{{url}}">打开工单</a>`,
      },
      th: {
        subject: "[CS] {{ref}} — ภายใน {{respond_by}}",
        body:
          `<p class="lead">คุณ{{recipient}} มีเรื่องร้องเรียนมอบหมายให้คุณ</p>` +
          `<table class="kv">` +
          `<tr><td class="k">ลูกค้า</td><td>{{customer_name}}</td></tr>` +
          `<tr><td class="k">ประเภท</td><td>{{category}}</td></tr>` +
          `<tr><td class="k">ความเร่งด่วน</td><td>{{priority}}</td></tr>` +
          `<tr><td class="k">ตอบภายใน</td><td>{{respond_by}}</td></tr></table>` +
          `<a class="btn" href="{{url}}">เปิดเรื่อง</a>`,
      },
      vi: {
        subject: "[CS] {{ref}} — hạn {{respond_by}}",
        body:
          `<p class="lead">Chào {{recipient}}, có một yêu cầu hỗ trợ giao cho bạn.</p>` +
          `<table class="kv">` +
          `<tr><td class="k">Khách hàng</td><td>{{customer_name}}</td></tr>` +
          `<tr><td class="k">Phân loại</td><td>{{category}}</td></tr>` +
          `<tr><td class="k">Mức ưu tiên</td><td>{{priority}}</td></tr>` +
          `<tr><td class="k">Trả lời trước</td><td>{{respond_by}}</td></tr></table>` +
          `<a class="btn" href="{{url}}">Mở yêu cầu</a>`,
      },
    },
  },

  {
    key: "staff.cs_sla_breach",
    name: "SLA 임박·초과",
    description: "응답 기한이 임박하거나 지났을 때. 담당자와 관리자 모두에게.",
    vars: vars("recipient", "ref", "customer_name", "hours_overdue", "respond_by", "url"),
    tr: {
      ko: {
        subject: "[SLA] {{ref}} 응답 기한 초과",
        body:
          `<p class="lead">{{recipient}} 님, {{ref}} 응답 기한이 지났습니다.</p>` +
          `<table class="kv">` +
          `<tr><td class="k">고객</td><td>{{customer_name}}</td></tr>` +
          `<tr><td class="k">기한</td><td>{{respond_by}}</td></tr>` +
          `<tr><td class="k">초과</td><td>{{hours_overdue}}시간</td></tr></table>` +
          `<a class="btn" href="{{url}}">티켓 열기</a>` +
          `<p class="muted">바로 처리가 어려우면 진행 상황이라도 고객에게 알려 주세요. 기다리는 쪽이 가장 답답합니다.</p>`,
      },
      en: {
        subject: "[SLA] {{ref}} response overdue",
        body:
          `<p class="lead">Hi {{recipient}}, {{ref}} is past its response deadline.</p>` +
          `<table class="kv">` +
          `<tr><td class="k">Customer</td><td>{{customer_name}}</td></tr>` +
          `<tr><td class="k">Was due</td><td>{{respond_by}}</td></tr>` +
          `<tr><td class="k">Overdue by</td><td>{{hours_overdue}} hours</td></tr></table>` +
          `<a class="btn" href="{{url}}">Open the ticket</a>` +
          `<p class="muted">If you can't resolve it now, at least tell the customer where it stands. Waiting in silence is the worst part.</p>`,
      },
      ja: {
        subject: "【SLA】{{ref}} 応答期限超過",
        body:
          `<p class="lead">{{recipient}} さん、{{ref}} の応答期限を過ぎています。</p>` +
          `<table class="kv">` +
          `<tr><td class="k">お客様</td><td>{{customer_name}}</td></tr>` +
          `<tr><td class="k">期限</td><td>{{respond_by}}</td></tr>` +
          `<tr><td class="k">超過</td><td>{{hours_overdue}} 時間</td></tr></table>` +
          `<a class="btn" href="{{url}}">チケットを開く</a>` +
          `<p class="muted">すぐに解決できない場合でも、状況だけはお客様にお伝えください。待たされる側にとって、それがいちばんつらい状態です。</p>`,
      },
      zh: {
        subject: "【SLA】{{ref}} 响应超时",
        body:
          `<p class="lead">{{recipient}} 您好，{{ref}} 已超过响应期限。</p>` +
          `<table class="kv">` +
          `<tr><td class="k">客户</td><td>{{customer_name}}</td></tr>` +
          `<tr><td class="k">原期限</td><td>{{respond_by}}</td></tr>` +
          `<tr><td class="k">超时</td><td>{{hours_overdue}} 小时</td></tr></table>` +
          `<a class="btn" href="{{url}}">打开工单</a>` +
          `<p class="muted">若一时无法解决，至少先把进展告知客户。干等着最让人难受。</p>`,
      },
      th: {
        subject: "[SLA] {{ref}} เกินกำหนดตอบกลับ",
        body:
          `<p class="lead">คุณ{{recipient}} เรื่อง {{ref}} เกินกำหนดตอบกลับแล้ว</p>` +
          `<table class="kv">` +
          `<tr><td class="k">ลูกค้า</td><td>{{customer_name}}</td></tr>` +
          `<tr><td class="k">กำหนดเดิม</td><td>{{respond_by}}</td></tr>` +
          `<tr><td class="k">เกินมา</td><td>{{hours_overdue}} ชั่วโมง</td></tr></table>` +
          `<a class="btn" href="{{url}}">เปิดเรื่อง</a>` +
          `<p class="muted">หากยังแก้ไม่ได้ทันที อย่างน้อยแจ้งความคืบหน้าให้ลูกค้าทราบ การรอโดยไม่รู้อะไรเลยคือสิ่งที่แย่ที่สุด</p>`,
      },
      vi: {
        subject: "[SLA] {{ref}} quá hạn phản hồi",
        body:
          `<p class="lead">Chào {{recipient}}, {{ref}} đã quá hạn phản hồi.</p>` +
          `<table class="kv">` +
          `<tr><td class="k">Khách hàng</td><td>{{customer_name}}</td></tr>` +
          `<tr><td class="k">Hạn cũ</td><td>{{respond_by}}</td></tr>` +
          `<tr><td class="k">Quá</td><td>{{hours_overdue}} giờ</td></tr></table>` +
          `<a class="btn" href="{{url}}">Mở yêu cầu</a>` +
          `<p class="muted">Nếu chưa xử lý ngay được, ít nhất hãy báo tiến độ cho khách. Chờ mà không biết gì mới là điều khó chịu nhất.</p>`,
      },
    },
  },

  {
    key: "staff.payment_received",
    name: "담당 계약 입금 발생",
    description: "내가 담당하는 계약에 입금이 들어옴.",
    vars: vars("recipient", "ref", "customer_name", "amount", "paid_date", "balance", "url"),
    tr: {
      ko: {
        subject: "[입금] {{customer_name}} {{amount}}",
        body:
          `<p class="lead">{{recipient}} 님, 담당 건에 입금이 들어왔습니다.</p>` +
          `<table class="kv">` +
          `<tr><td class="k">고객</td><td>{{customer_name}}</td></tr>` +
          `<tr><td class="k">입금액</td><td>{{amount}}</td></tr>` +
          `<tr><td class="k">입금일</td><td>{{paid_date}}</td></tr>` +
          `<tr><td class="k">잔액</td><td>{{balance}}</td></tr>` +
          `<tr><td class="k">건 번호</td><td>{{ref}}</td></tr></table>` +
          `<a class="btn" href="{{url}}">건 열기</a>`,
      },
      en: {
        subject: "[Payment] {{customer_name}} {{amount}}",
        body:
          `<p class="lead">Hi {{recipient}}, a payment landed on one of your cases.</p>` +
          `<table class="kv">` +
          `<tr><td class="k">Customer</td><td>{{customer_name}}</td></tr>` +
          `<tr><td class="k">Paid</td><td>{{amount}}</td></tr>` +
          `<tr><td class="k">On</td><td>{{paid_date}}</td></tr>` +
          `<tr><td class="k">Balance</td><td>{{balance}}</td></tr>` +
          `<tr><td class="k">Ref</td><td>{{ref}}</td></tr></table>` +
          `<a class="btn" href="{{url}}">Open the case</a>`,
      },
      ja: {
        subject: "【入金】{{customer_name}} {{amount}}",
        body:
          `<p class="lead">{{recipient}} さん、担当案件に入金が確認されました。</p>` +
          `<table class="kv">` +
          `<tr><td class="k">お客様</td><td>{{customer_name}}</td></tr>` +
          `<tr><td class="k">入金額</td><td>{{amount}}</td></tr>` +
          `<tr><td class="k">入金日</td><td>{{paid_date}}</td></tr>` +
          `<tr><td class="k">残額</td><td>{{balance}}</td></tr>` +
          `<tr><td class="k">案件番号</td><td>{{ref}}</td></tr></table>` +
          `<a class="btn" href="{{url}}">案件を開く</a>`,
      },
      zh: {
        subject: "【到账】{{customer_name}} {{amount}}",
        body:
          `<p class="lead">{{recipient}} 您好，您负责的案件已确认到账。</p>` +
          `<table class="kv">` +
          `<tr><td class="k">客户</td><td>{{customer_name}}</td></tr>` +
          `<tr><td class="k">到账金额</td><td>{{amount}}</td></tr>` +
          `<tr><td class="k">到账日</td><td>{{paid_date}}</td></tr>` +
          `<tr><td class="k">余额</td><td>{{balance}}</td></tr>` +
          `<tr><td class="k">单据编号</td><td>{{ref}}</td></tr></table>` +
          `<a class="btn" href="{{url}}">打开案件</a>`,
      },
      th: {
        subject: "[รับชำระ] {{customer_name}} {{amount}}",
        body:
          `<p class="lead">คุณ{{recipient}} มีเงินเข้าในเรื่องที่คุณดูแล</p>` +
          `<table class="kv">` +
          `<tr><td class="k">ลูกค้า</td><td>{{customer_name}}</td></tr>` +
          `<tr><td class="k">ยอดที่รับ</td><td>{{amount}}</td></tr>` +
          `<tr><td class="k">วันที่รับ</td><td>{{paid_date}}</td></tr>` +
          `<tr><td class="k">ยอดคงเหลือ</td><td>{{balance}}</td></tr>` +
          `<tr><td class="k">เลขที่เรื่อง</td><td>{{ref}}</td></tr></table>` +
          `<a class="btn" href="{{url}}">เปิดเรื่อง</a>`,
      },
      vi: {
        subject: "[Thu tiền] {{customer_name}} {{amount}}",
        body:
          `<p class="lead">Chào {{recipient}}, có khoản thu trên hồ sơ bạn phụ trách.</p>` +
          `<table class="kv">` +
          `<tr><td class="k">Khách hàng</td><td>{{customer_name}}</td></tr>` +
          `<tr><td class="k">Số tiền</td><td>{{amount}}</td></tr>` +
          `<tr><td class="k">Ngày</td><td>{{paid_date}}</td></tr>` +
          `<tr><td class="k">Còn lại</td><td>{{balance}}</td></tr>` +
          `<tr><td class="k">Mã hồ sơ</td><td>{{ref}}</td></tr></table>` +
          `<a class="btn" href="{{url}}">Mở hồ sơ</a>`,
      },
    },
  },

  {
    key: "staff.overdue_digest",
    name: "미납 현황 일일 요약",
    description: "연체 건 일일 집계. 숫자와 링크만.",
    vars: vars("recipient", "date", "overdue_count", "overdue_total", "new_today", "url"),
    tr: {
      ko: {
        subject: "[미납] {{date}} — {{overdue_count}}건 {{overdue_total}}",
        body:
          `<p class="lead">{{date}} 미납 현황입니다.</p>` +
          `<table class="kv">` +
          `<tr><td class="k">미납 건수</td><td>{{overdue_count}}건</td></tr>` +
          `<tr><td class="k">미납 총액</td><td>{{overdue_total}}</td></tr>` +
          `<tr><td class="k">오늘 신규</td><td>{{new_today}}건</td></tr></table>` +
          `<a class="btn" href="{{url}}">미납 목록 보기</a>`,
      },
      en: {
        subject: "[Arrears] {{date}} — {{overdue_count}} / {{overdue_total}}",
        body:
          `<p class="lead">Arrears as at {{date}}.</p>` +
          `<table class="kv">` +
          `<tr><td class="k">Overdue accounts</td><td>{{overdue_count}}</td></tr>` +
          `<tr><td class="k">Total outstanding</td><td>{{overdue_total}}</td></tr>` +
          `<tr><td class="k">New today</td><td>{{new_today}}</td></tr></table>` +
          `<a class="btn" href="{{url}}">See the list</a>`,
      },
      ja: {
        subject: "【未納】{{date}} — {{overdue_count}} 件 {{overdue_total}}",
        body:
          `<p class="lead">{{date}} 時点の未納状況です。</p>` +
          `<table class="kv">` +
          `<tr><td class="k">未納件数</td><td>{{overdue_count}} 件</td></tr>` +
          `<tr><td class="k">未納総額</td><td>{{overdue_total}}</td></tr>` +
          `<tr><td class="k">本日新規</td><td>{{new_today}} 件</td></tr></table>` +
          `<a class="btn" href="{{url}}">未納一覧を見る</a>`,
      },
      zh: {
        subject: "【欠费】{{date}} — {{overdue_count}} 笔 {{overdue_total}}",
        body:
          `<p class="lead">{{date}} 的欠费情况。</p>` +
          `<table class="kv">` +
          `<tr><td class="k">欠费笔数</td><td>{{overdue_count}} 笔</td></tr>` +
          `<tr><td class="k">欠费总额</td><td>{{overdue_total}}</td></tr>` +
          `<tr><td class="k">今日新增</td><td>{{new_today}} 笔</td></tr></table>` +
          `<a class="btn" href="{{url}}">查看欠费清单</a>`,
      },
      th: {
        subject: "[ค้างชำระ] {{date}} — {{overdue_count}} ราย {{overdue_total}}",
        body:
          `<p class="lead">สถานะค้างชำระ ณ วันที่ {{date}}</p>` +
          `<table class="kv">` +
          `<tr><td class="k">จำนวนรายที่ค้าง</td><td>{{overdue_count}} ราย</td></tr>` +
          `<tr><td class="k">ยอดค้างรวม</td><td>{{overdue_total}}</td></tr>` +
          `<tr><td class="k">เพิ่มใหม่วันนี้</td><td>{{new_today}} ราย</td></tr></table>` +
          `<a class="btn" href="{{url}}">ดูรายการค้างชำระ</a>`,
      },
      vi: {
        subject: "[Nợ] {{date}} — {{overdue_count}} khoản {{overdue_total}}",
        body:
          `<p class="lead">Tình hình nợ đến ngày {{date}}.</p>` +
          `<table class="kv">` +
          `<tr><td class="k">Số khoản quá hạn</td><td>{{overdue_count}}</td></tr>` +
          `<tr><td class="k">Tổng còn nợ</td><td>{{overdue_total}}</td></tr>` +
          `<tr><td class="k">Mới hôm nay</td><td>{{new_today}}</td></tr></table>` +
          `<a class="btn" href="{{url}}">Xem danh sách</a>`,
      },
    },
  },

  {
    key: "staff.daily_digest",
    name: "오늘 일정·업무 요약",
    description: "아침 다이제스트. 매일 오므로 최대한 짧게.",
    vars: vars("recipient", "date", "appointments", "tasks_due", "tickets_open", "url"),
    tr: {
      ko: {
        subject: "[오늘] {{date}}",
        body:
          `<p class="lead">{{recipient}} 님, 오늘 할 일입니다.</p>` +
          `<table class="kv">` +
          `<tr><td class="k">방문·상담</td><td>{{appointments}}건</td></tr>` +
          `<tr><td class="k">기한 업무</td><td>{{tasks_due}}건</td></tr>` +
          `<tr><td class="k">열린 티켓</td><td>{{tickets_open}}건</td></tr></table>` +
          `<a class="btn" href="{{url}}">오늘 일정 보기</a>`,
      },
      en: {
        subject: "[Today] {{date}}",
        body:
          `<p class="lead">Hi {{recipient}}, here's your day.</p>` +
          `<table class="kv">` +
          `<tr><td class="k">Appointments</td><td>{{appointments}}</td></tr>` +
          `<tr><td class="k">Tasks due</td><td>{{tasks_due}}</td></tr>` +
          `<tr><td class="k">Open tickets</td><td>{{tickets_open}}</td></tr></table>` +
          `<a class="btn" href="{{url}}">Open your day</a>`,
      },
      ja: {
        subject: "【本日】{{date}}",
        body:
          `<p class="lead">{{recipient}} さん、本日の予定です。</p>` +
          `<table class="kv">` +
          `<tr><td class="k">訪問・面談</td><td>{{appointments}} 件</td></tr>` +
          `<tr><td class="k">期限業務</td><td>{{tasks_due}} 件</td></tr>` +
          `<tr><td class="k">未対応チケット</td><td>{{tickets_open}} 件</td></tr></table>` +
          `<a class="btn" href="{{url}}">本日の予定を見る</a>`,
      },
      zh: {
        subject: "【今日】{{date}}",
        body:
          `<p class="lead">{{recipient}} 您好，这是今天的安排。</p>` +
          `<table class="kv">` +
          `<tr><td class="k">拜访·面谈</td><td>{{appointments}} 项</td></tr>` +
          `<tr><td class="k">到期任务</td><td>{{tasks_due}} 项</td></tr>` +
          `<tr><td class="k">未结工单</td><td>{{tickets_open}} 张</td></tr></table>` +
          `<a class="btn" href="{{url}}">查看今日安排</a>`,
      },
      th: {
        subject: "[วันนี้] {{date}}",
        body:
          `<p class="lead">คุณ{{recipient}} นี่คืองานของวันนี้</p>` +
          `<table class="kv">` +
          `<tr><td class="k">นัดหมาย</td><td>{{appointments}} รายการ</td></tr>` +
          `<tr><td class="k">งานถึงกำหนด</td><td>{{tasks_due}} รายการ</td></tr>` +
          `<tr><td class="k">เรื่องที่ยังเปิด</td><td>{{tickets_open}} เรื่อง</td></tr></table>` +
          `<a class="btn" href="{{url}}">ดูงานวันนี้</a>`,
      },
      vi: {
        subject: "[Hôm nay] {{date}}",
        body:
          `<p class="lead">Chào {{recipient}}, đây là việc hôm nay.</p>` +
          `<table class="kv">` +
          `<tr><td class="k">Lịch hẹn</td><td>{{appointments}}</td></tr>` +
          `<tr><td class="k">Việc đến hạn</td><td>{{tasks_due}}</td></tr>` +
          `<tr><td class="k">Yêu cầu đang mở</td><td>{{tickets_open}}</td></tr></table>` +
          `<a class="btn" href="{{url}}">Mở lịch hôm nay</a>`,
      },
    },
  },

  {
    key: "staff.weekly_report",
    name: "주간 실적 요약",
    description: "주간 파이프라인 요약.",
    vars: vars("recipient", "week", "new_leads", "contracts_signed", "revenue", "open_items", "url"),
    tr: {
      ko: {
        subject: "[주간] {{week}} 실적",
        body:
          `<p class="lead">{{recipient}} 님, {{week}} 실적입니다.</p>` +
          `<table class="kv">` +
          `<tr><td class="k">신규 문의</td><td>{{new_leads}}건</td></tr>` +
          `<tr><td class="k">계약 체결</td><td>{{contracts_signed}}건</td></tr>` +
          `<tr><td class="k">수납</td><td>{{revenue}}</td></tr>` +
          `<tr><td class="k">남은 건</td><td>{{open_items}}건</td></tr></table>` +
          `<a class="btn" href="{{url}}">자세히 보기</a>`,
      },
      en: {
        subject: "[Weekly] {{week}}",
        body:
          `<p class="lead">Hi {{recipient}}, your week in numbers.</p>` +
          `<table class="kv">` +
          `<tr><td class="k">New enquiries</td><td>{{new_leads}}</td></tr>` +
          `<tr><td class="k">Contracts signed</td><td>{{contracts_signed}}</td></tr>` +
          `<tr><td class="k">Collected</td><td>{{revenue}}</td></tr>` +
          `<tr><td class="k">Still open</td><td>{{open_items}}</td></tr></table>` +
          `<a class="btn" href="{{url}}">See the detail</a>`,
      },
      ja: {
        subject: "【週次】{{week}} 実績",
        body:
          `<p class="lead">{{recipient}} さん、{{week}} の実績です。</p>` +
          `<table class="kv">` +
          `<tr><td class="k">新規問い合わせ</td><td>{{new_leads}} 件</td></tr>` +
          `<tr><td class="k">ご成約</td><td>{{contracts_signed}} 件</td></tr>` +
          `<tr><td class="k">入金</td><td>{{revenue}}</td></tr>` +
          `<tr><td class="k">未処理</td><td>{{open_items}} 件</td></tr></table>` +
          `<a class="btn" href="{{url}}">詳しく見る</a>`,
      },
      zh: {
        subject: "【周报】{{week}}",
        body:
          `<p class="lead">{{recipient}} 您好，本周业绩如下。</p>` +
          `<table class="kv">` +
          `<tr><td class="k">新增咨询</td><td>{{new_leads}} 条</td></tr>` +
          `<tr><td class="k">签约</td><td>{{contracts_signed}} 单</td></tr>` +
          `<tr><td class="k">收款</td><td>{{revenue}}</td></tr>` +
          `<tr><td class="k">未结事项</td><td>{{open_items}} 项</td></tr></table>` +
          `<a class="btn" href="{{url}}">查看详情</a>`,
      },
      th: {
        subject: "[รายสัปดาห์] {{week}}",
        body:
          `<p class="lead">คุณ{{recipient}} นี่คือผลงานสัปดาห์ {{week}}</p>` +
          `<table class="kv">` +
          `<tr><td class="k">เรื่องสอบถามใหม่</td><td>{{new_leads}} ราย</td></tr>` +
          `<tr><td class="k">ทำสัญญา</td><td>{{contracts_signed}} ราย</td></tr>` +
          `<tr><td class="k">รับชำระ</td><td>{{revenue}}</td></tr>` +
          `<tr><td class="k">ค้างอยู่</td><td>{{open_items}} รายการ</td></tr></table>` +
          `<a class="btn" href="{{url}}">ดูรายละเอียด</a>`,
      },
      vi: {
        subject: "[Tuần] {{week}}",
        body:
          `<p class="lead">Chào {{recipient}}, kết quả tuần của bạn.</p>` +
          `<table class="kv">` +
          `<tr><td class="k">Yêu cầu mới</td><td>{{new_leads}}</td></tr>` +
          `<tr><td class="k">Hợp đồng đã ký</td><td>{{contracts_signed}}</td></tr>` +
          `<tr><td class="k">Đã thu</td><td>{{revenue}}</td></tr>` +
          `<tr><td class="k">Còn tồn</td><td>{{open_items}}</td></tr></table>` +
          `<a class="btn" href="{{url}}">Xem chi tiết</a>`,
      },
    },
  },

  {
    key: "staff.monthly_kpi",
    name: "월간 KPI",
    description: "월간 목표 대비 실적. 목표 미달이어도 사실만 보여 준다.",
    vars: vars("recipient", "month", "target", "achieved", "achievement_rate", "commission", "url"),
    tr: {
      ko: {
        subject: "[월간] {{month}} KPI",
        body:
          `<p class="lead">{{recipient}} 님, {{month}} KPI입니다.</p>` +
          `<table class="kv">` +
          `<tr><td class="k">목표</td><td>{{target}}</td></tr>` +
          `<tr><td class="k">실적</td><td>{{achieved}}</td></tr>` +
          `<tr><td class="k">달성률</td><td>{{achievement_rate}}</td></tr>` +
          `<tr><td class="k">인센티브</td><td>{{commission}}</td></tr></table>` +
          `<a class="btn" href="{{url}}">자세히 보기</a>` +
          `<p class="muted">숫자가 실제와 다르면 알려 주세요. 정산 전에 바로잡습니다.</p>`,
      },
      en: {
        subject: "[Monthly] {{month}} KPI",
        body:
          `<p class="lead">Hi {{recipient}}, your {{month}} numbers.</p>` +
          `<table class="kv">` +
          `<tr><td class="k">Target</td><td>{{target}}</td></tr>` +
          `<tr><td class="k">Achieved</td><td>{{achieved}}</td></tr>` +
          `<tr><td class="k">Rate</td><td>{{achievement_rate}}</td></tr>` +
          `<tr><td class="k">Incentive</td><td>{{commission}}</td></tr></table>` +
          `<a class="btn" href="{{url}}">See the detail</a>` +
          `<p class="muted">If a figure doesn't match what you did, tell us and we'll correct it before payroll.</p>`,
      },
      ja: {
        subject: "【月次】{{month}} KPI",
        body:
          `<p class="lead">{{recipient}} さん、{{month}} の KPI です。</p>` +
          `<table class="kv">` +
          `<tr><td class="k">目標</td><td>{{target}}</td></tr>` +
          `<tr><td class="k">実績</td><td>{{achieved}}</td></tr>` +
          `<tr><td class="k">達成率</td><td>{{achievement_rate}}</td></tr>` +
          `<tr><td class="k">インセンティブ</td><td>{{commission}}</td></tr></table>` +
          `<a class="btn" href="{{url}}">詳しく見る</a>` +
          `<p class="muted">数字が実態と異なる場合はお知らせください。精算前に修正いたします。</p>`,
      },
      zh: {
        subject: "【月报】{{month}} KPI",
        body:
          `<p class="lead">{{recipient}} 您好，这是您 {{month}} 的 KPI。</p>` +
          `<table class="kv">` +
          `<tr><td class="k">目标</td><td>{{target}}</td></tr>` +
          `<tr><td class="k">实绩</td><td>{{achieved}}</td></tr>` +
          `<tr><td class="k">达成率</td><td>{{achievement_rate}}</td></tr>` +
          `<tr><td class="k">奖金</td><td>{{commission}}</td></tr></table>` +
          `<a class="btn" href="{{url}}">查看详情</a>` +
          `<p class="muted">若数字与实际不符，请告知我们，结算前会为您更正。</p>`,
      },
      th: {
        subject: "[รายเดือน] KPI {{month}}",
        body:
          `<p class="lead">คุณ{{recipient}} นี่คือ KPI เดือน {{month}}</p>` +
          `<table class="kv">` +
          `<tr><td class="k">เป้าหมาย</td><td>{{target}}</td></tr>` +
          `<tr><td class="k">ผลงานจริง</td><td>{{achieved}}</td></tr>` +
          `<tr><td class="k">อัตราบรรลุ</td><td>{{achievement_rate}}</td></tr>` +
          `<tr><td class="k">อินเซนทีฟ</td><td>{{commission}}</td></tr></table>` +
          `<a class="btn" href="{{url}}">ดูรายละเอียด</a>` +
          `<p class="muted">หากตัวเลขไม่ตรงกับที่ทำจริง กรุณาแจ้ง เราจะแก้ก่อนรอบจ่ายเงิน</p>`,
      },
      vi: {
        subject: "[Tháng] KPI {{month}}",
        body:
          `<p class="lead">Chào {{recipient}}, KPI tháng {{month}} của bạn.</p>` +
          `<table class="kv">` +
          `<tr><td class="k">Mục tiêu</td><td>{{target}}</td></tr>` +
          `<tr><td class="k">Đạt được</td><td>{{achieved}}</td></tr>` +
          `<tr><td class="k">Tỷ lệ</td><td>{{achievement_rate}}</td></tr>` +
          `<tr><td class="k">Thưởng</td><td>{{commission}}</td></tr></table>` +
          `<a class="btn" href="{{url}}">Xem chi tiết</a>` +
          `<p class="muted">Nếu con số không khớp thực tế, hãy báo để chúng tôi sửa trước kỳ tính lương.</p>`,
      },
    },
  },

  {
    key: "staff.inspection_due",
    name: "점검 예정 세대",
    description: "이번 주 점검 대상 목록.",
    vars: vars("recipient", "week", "inspection_count", "unit_list", "url"),
    tr: {
      ko: {
        subject: "[점검] {{week}} 예정 {{inspection_count}}세대",
        body:
          `<p class="lead">{{recipient}} 님, 이번 주 점검 예정입니다.</p>` +
          `<div class="box"><div class="label">대상 세대</div><div>{{unit_list}}</div></div>` +
          `<a class="btn" href="{{url}}">점검 일정 보기</a>` +
          `<p class="muted">세대 안에 들어가는 점검은 세입자에게 미리 통지해야 합니다. 통지가 안 된 건이 있으면 먼저 보내 주세요.</p>`,
      },
      en: {
        subject: "[Inspections] {{inspection_count}} due in {{week}}",
        body:
          `<p class="lead">Hi {{recipient}}, inspections are due this week.</p>` +
          `<div class="box"><div class="label">Units</div><div>{{unit_list}}</div></div>` +
          `<a class="btn" href="{{url}}">See the schedule</a>` +
          `<p class="muted">Anything that means entering a unit has to be notified to the tenant first. Send the notice for any that haven't had one.</p>`,
      },
      ja: {
        subject: "【点検】{{week}} 予定 {{inspection_count}} 室",
        body:
          `<p class="lead">{{recipient}} さん、今週の点検予定です。</p>` +
          `<div class="box"><div class="label">対象のお部屋</div><div>{{unit_list}}</div></div>` +
          `<a class="btn" href="{{url}}">点検日程を見る</a>` +
          `<p class="muted">室内に立ち入る点検は、入居者様への事前通知が必要です。未通知の件があれば、先にお送りください。</p>`,
      },
      zh: {
        subject: "【检查】{{week}} 预定 {{inspection_count}} 户",
        body:
          `<p class="lead">{{recipient}} 您好，本周有检查安排。</p>` +
          `<div class="box"><div class="label">目标单元</div><div>{{unit_list}}</div></div>` +
          `<a class="btn" href="{{url}}">查看检查日程</a>` +
          `<p class="muted">需要进入室内的检查必须事先通知承租人。若有尚未通知的，请先发出通知。</p>`,
      },
      th: {
        subject: "[ตรวจห้อง] {{week}} จำนวน {{inspection_count}} ห้อง",
        body:
          `<p class="lead">คุณ{{recipient}} สัปดาห์นี้มีกำหนดตรวจห้อง</p>` +
          `<div class="box"><div class="label">ห้องที่ต้องตรวจ</div><div>{{unit_list}}</div></div>` +
          `<a class="btn" href="{{url}}">ดูตารางตรวจ</a>` +
          `<p class="muted">การตรวจที่ต้องเข้าไปในห้องต้องแจ้งผู้เช่าล่วงหน้า หากรายใดยังไม่ได้แจ้ง กรุณาส่งหนังสือแจ้งก่อน</p>`,
      },
      vi: {
        subject: "[Kiểm tra] {{week}} — {{inspection_count}} căn",
        body:
          `<p class="lead">Chào {{recipient}}, tuần này có lịch kiểm tra.</p>` +
          `<div class="box"><div class="label">Các căn</div><div>{{unit_list}}</div></div>` +
          `<a class="btn" href="{{url}}">Xem lịch kiểm tra</a>` +
          `<p class="muted">Việc kiểm tra cần vào bên trong căn hộ phải báo trước cho người thuê. Căn nào chưa báo, hãy gửi thông báo trước.</p>`,
      },
    },
  },

  {
    key: "staff.contract_expiring",
    name: "만료 임박 계약",
    description: "갱신 협의를 시작해야 할 계약 목록.",
    vars: vars("recipient", "days_ahead", "expiring_count", "contract_list", "url"),
    tr: {
      ko: {
        subject: "[만료] {{days_ahead}}일 내 {{expiring_count}}건",
        body:
          `<p class="lead">{{recipient}} 님, {{days_ahead}}일 안에 만료되는 계약이 {{expiring_count}}건 있습니다.</p>` +
          `<div class="box"><div class="label">대상 계약</div><div>{{contract_list}}</div></div>` +
          `<a class="btn" href="{{url}}">계약 목록 보기</a>` +
          `<p class="muted">갱신 의사를 먼저 확인하고 소유주와 조건을 정한 뒤 세입자에게 제안해 주세요.</p>`,
      },
      en: {
        subject: "[Expiring] {{expiring_count}} within {{days_ahead}} days",
        body:
          `<p class="lead">Hi {{recipient}}, {{expiring_count}} agreements expire within {{days_ahead}} days.</p>` +
          `<div class="box"><div class="label">Agreements</div><div>{{contract_list}}</div></div>` +
          `<a class="btn" href="{{url}}">See the list</a>` +
          `<p class="muted">Sound out whether they want to stay, agree the terms with the owner, then put the offer to the tenant.</p>`,
      },
      ja: {
        subject: "【満了】{{days_ahead}} 日以内 {{expiring_count}} 件",
        body:
          `<p class="lead">{{recipient}} さん、{{days_ahead}} 日以内に満了する契約が {{expiring_count}} 件あります。</p>` +
          `<div class="box"><div class="label">対象契約</div><div>{{contract_list}}</div></div>` +
          `<a class="btn" href="{{url}}">契約一覧を見る</a>` +
          `<p class="muted">まず更新のご意向を確認し、オーナー様と条件を決めたうえで、入居者様にご提案してください。</p>`,
      },
      zh: {
        subject: "【到期】{{days_ahead}} 天内 {{expiring_count}} 份",
        body:
          `<p class="lead">{{recipient}} 您好，{{days_ahead}} 天内有 {{expiring_count}} 份合同到期。</p>` +
          `<div class="box"><div class="label">相关合同</div><div>{{contract_list}}</div></div>` +
          `<a class="btn" href="{{url}}">查看合同清单</a>` +
          `<p class="muted">请先了解续租意向，与业主商定条件后再向承租人提出方案。</p>`,
      },
      th: {
        subject: "[ครบกำหนด] ภายใน {{days_ahead}} วัน {{expiring_count}} ฉบับ",
        body:
          `<p class="lead">คุณ{{recipient}} มีสัญญาครบกำหนดภายใน {{days_ahead}} วัน จำนวน {{expiring_count}} ฉบับ</p>` +
          `<div class="box"><div class="label">สัญญาที่เกี่ยวข้อง</div><div>{{contract_list}}</div></div>` +
          `<a class="btn" href="{{url}}">ดูรายการสัญญา</a>` +
          `<p class="muted">สอบถามความต้องการต่อสัญญาก่อน ตกลงเงื่อนไขกับเจ้าของทรัพย์ แล้วจึงเสนอผู้เช่า</p>`,
      },
      vi: {
        subject: "[Hết hạn] {{expiring_count}} hợp đồng trong {{days_ahead}} ngày",
        body:
          `<p class="lead">Chào {{recipient}}, có {{expiring_count}} hợp đồng hết hạn trong {{days_ahead}} ngày.</p>` +
          `<div class="box"><div class="label">Hợp đồng</div><div>{{contract_list}}</div></div>` +
          `<a class="btn" href="{{url}}">Xem danh sách</a>` +
          `<p class="muted">Hãy thăm dò ý định ở tiếp, thống nhất điều kiện với chủ nhà, rồi mới đề nghị với người thuê.</p>`,
      },
    },
  },

  {
    key: "staff.system_alert",
    name: "시스템 오류 알림",
    description: "잡 실패·연동 오류. 운영 담당에게. 무엇이 멈췄고 무엇이 영향받는지.",
    vars: vars("recipient", "job_name", "error_summary", "failed_at", "impact", "url"),
    tr: {
      ko: {
        subject: "[오류] {{job_name}} 실패",
        body:
          `<p class="lead">{{job_name}}이(가) {{failed_at}}에 실패했습니다.</p>` +
          `<div class="box"><div class="label">오류</div><div>{{error_summary}}</div></div>` +
          `<table class="kv"><tr><td class="k">영향</td><td>{{impact}}</td></tr></table>` +
          `<a class="btn" href="{{url}}">로그 보기</a>` +
          `<p class="muted">자동 재시도는 하지 않습니다. 원인을 확인하고 수동으로 다시 실행해 주세요.</p>`,
      },
      en: {
        subject: "[Error] {{job_name}} failed",
        body:
          `<p class="lead">{{job_name}} failed at {{failed_at}}.</p>` +
          `<div class="box"><div class="label">Error</div><div>{{error_summary}}</div></div>` +
          `<table class="kv"><tr><td class="k">Impact</td><td>{{impact}}</td></tr></table>` +
          `<a class="btn" href="{{url}}">View the log</a>` +
          `<p class="muted">There is no automatic retry. Check the cause and run it again manually.</p>`,
      },
      ja: {
        subject: "【エラー】{{job_name}} が失敗しました",
        body:
          `<p class="lead">{{job_name}} が {{failed_at}} に失敗しました。</p>` +
          `<div class="box"><div class="label">エラー</div><div>{{error_summary}}</div></div>` +
          `<table class="kv"><tr><td class="k">影響</td><td>{{impact}}</td></tr></table>` +
          `<a class="btn" href="{{url}}">ログを見る</a>` +
          `<p class="muted">自動再実行は行いません。原因を確認のうえ、手動で再実行してください。</p>`,
      },
      zh: {
        subject: "【错误】{{job_name}} 执行失败",
        body:
          `<p class="lead">{{job_name}} 已于 {{failed_at}} 执行失败。</p>` +
          `<div class="box"><div class="label">错误</div><div>{{error_summary}}</div></div>` +
          `<table class="kv"><tr><td class="k">影响范围</td><td>{{impact}}</td></tr></table>` +
          `<a class="btn" href="{{url}}">查看日志</a>` +
          `<p class="muted">系统不会自动重试。请确认原因后手动重新执行。</p>`,
      },
      th: {
        subject: "[ข้อผิดพลาด] {{job_name}} ทำงานล้มเหลว",
        body:
          `<p class="lead">{{job_name}} ล้มเหลวเมื่อ {{failed_at}}</p>` +
          `<div class="box"><div class="label">ข้อผิดพลาด</div><div>{{error_summary}}</div></div>` +
          `<table class="kv"><tr><td class="k">ผลกระทบ</td><td>{{impact}}</td></tr></table>` +
          `<a class="btn" href="{{url}}">ดูบันทึก</a>` +
          `<p class="muted">ระบบไม่ลองใหม่อัตโนมัติ กรุณาตรวจสอบสาเหตุแล้วสั่งรันใหม่ด้วยตนเอง</p>`,
      },
      vi: {
        subject: "[Lỗi] {{job_name}} thất bại",
        body:
          `<p class="lead">{{job_name}} đã thất bại lúc {{failed_at}}.</p>` +
          `<div class="box"><div class="label">Lỗi</div><div>{{error_summary}}</div></div>` +
          `<table class="kv"><tr><td class="k">Ảnh hưởng</td><td>{{impact}}</td></tr></table>` +
          `<a class="btn" href="{{url}}">Xem nhật ký</a>` +
          `<p class="muted">Hệ thống không tự chạy lại. Hãy kiểm tra nguyên nhân và chạy lại thủ công.</p>`,
      },
    },
  },
];
