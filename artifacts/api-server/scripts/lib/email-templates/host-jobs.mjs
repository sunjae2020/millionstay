// host — 작업 배정·완료 보고·정산 (host.* / survey.host_csat)
//
// 현장에서 휴대폰으로 읽는다. **주소·시간·연락처를 맨 위에**, 설명은 뒤에 둔다.
//
// ⚠️ 세입자 개인정보: 작업 지시에는 세대 호수와 출입 방법까지만 담는다. 세입자 이름·
//    연락처는 대면이 필요한 작업에서만 변수로 넣고, 그렇지 않으면 넣지 않는다.
//    청소·정비는 대개 세입자가 없을 때 진행되므로 이름이 필요 없다.
// 한국어는 humanize-korean 통과본. 영어에서 재기계번역 금지.
import { vars } from "./_shared.mjs";

export const HOST_JOBS = [
  {
    key: "host.job_assigned",
    name: "작업 배정",
    description: "새 작업 지시. 언제·어디서·무엇을 세 줄 안에 알린다.",
    vars: vars("recipient", "ref", "job_type", "date", "time_window", "address", "space_name", "access_note", "url"),
    tr: {
      ko: {
        subject: "[작업] {{date}} {{space_name}} {{job_type}}",
        body:
          `<p class="lead">{{recipient}} 님, 새 작업이 배정되었습니다.</p>` +
          `<table class="kv">` +
          `<tr><td class="k">일시</td><td>{{date}} {{time_window}}</td></tr>` +
          `<tr><td class="k">장소</td><td>{{address}} {{space_name}}</td></tr>` +
          `<tr><td class="k">작업</td><td>{{job_type}}</td></tr>` +
          `<tr><td class="k">출입</td><td>{{access_note}}</td></tr>` +
          `<tr><td class="k">지시번호</td><td>{{ref}}</td></tr></table>` +
          `<a class="btn" href="{{url}}">작업 상세 보기</a>` +
          `<p class="muted">일정이 어려우시면 되도록 빨리 알려 주세요. 다른 분께 배정해야 합니다.</p>`,
      },
      en: {
        subject: "[Job] {{job_type}} at {{space_name}}, {{date}}",
        body:
          `<p class="lead">Hi {{recipient}}, a new job has been assigned to you.</p>` +
          `<table class="kv">` +
          `<tr><td class="k">When</td><td>{{date}} {{time_window}}</td></tr>` +
          `<tr><td class="k">Where</td><td>{{address}} {{space_name}}</td></tr>` +
          `<tr><td class="k">Job</td><td>{{job_type}}</td></tr>` +
          `<tr><td class="k">Access</td><td>{{access_note}}</td></tr>` +
          `<tr><td class="k">Job no.</td><td>{{ref}}</td></tr></table>` +
          `<a class="btn" href="{{url}}">Open the job</a>` +
          `<p class="muted">If you can't make it, tell us as soon as you can so we can reassign it.</p>`,
      },
      ja: {
        subject: "【作業】{{date}} {{space_name}} {{job_type}}",
        body:
          `<p class="lead">{{recipient}} 様、新しい作業が割り当てられました。</p>` +
          `<table class="kv">` +
          `<tr><td class="k">日時</td><td>{{date}} {{time_window}}</td></tr>` +
          `<tr><td class="k">場所</td><td>{{address}} {{space_name}}</td></tr>` +
          `<tr><td class="k">作業</td><td>{{job_type}}</td></tr>` +
          `<tr><td class="k">入室</td><td>{{access_note}}</td></tr>` +
          `<tr><td class="k">指示番号</td><td>{{ref}}</td></tr></table>` +
          `<a class="btn" href="{{url}}">作業内容を確認する</a>` +
          `<p class="muted">ご都合が合わない場合は、できるだけ早めにお知らせください。ほかの方に割り当てる必要がございます。</p>`,
      },
      zh: {
        subject: "【派单】{{date}} {{space_name}} {{job_type}}",
        body:
          `<p class="lead">{{recipient}} 您好，有一份新派单。</p>` +
          `<table class="kv">` +
          `<tr><td class="k">时间</td><td>{{date}} {{time_window}}</td></tr>` +
          `<tr><td class="k">地点</td><td>{{address}} {{space_name}}</td></tr>` +
          `<tr><td class="k">作业</td><td>{{job_type}}</td></tr>` +
          `<tr><td class="k">进门方式</td><td>{{access_note}}</td></tr>` +
          `<tr><td class="k">派单号</td><td>{{ref}}</td></tr></table>` +
          `<a class="btn" href="{{url}}">查看派单详情</a>` +
          `<p class="muted">若时间不便，请尽快告知，我们需要改派他人。</p>`,
      },
      th: {
        subject: "[งาน] {{date}} {{space_name}} {{job_type}}",
        body:
          `<p class="lead">คุณ{{recipient}} มีงานใหม่มอบหมายให้ท่าน</p>` +
          `<table class="kv">` +
          `<tr><td class="k">วันเวลา</td><td>{{date}} {{time_window}}</td></tr>` +
          `<tr><td class="k">สถานที่</td><td>{{address}} {{space_name}}</td></tr>` +
          `<tr><td class="k">งาน</td><td>{{job_type}}</td></tr>` +
          `<tr><td class="k">การเข้าห้อง</td><td>{{access_note}}</td></tr>` +
          `<tr><td class="k">เลขที่งาน</td><td>{{ref}}</td></tr></table>` +
          `<a class="btn" href="{{url}}">ดูรายละเอียดงาน</a>` +
          `<p class="muted">หากไม่สะดวก กรุณาแจ้งโดยเร็วที่สุด เราต้องมอบหมายให้ผู้อื่นแทน</p>`,
      },
      vi: {
        subject: "[Việc] {{date}} {{space_name}} {{job_type}}",
        body:
          `<p class="lead">Chào {{recipient}}, bạn có công việc mới.</p>` +
          `<table class="kv">` +
          `<tr><td class="k">Thời gian</td><td>{{date}} {{time_window}}</td></tr>` +
          `<tr><td class="k">Địa điểm</td><td>{{address}} {{space_name}}</td></tr>` +
          `<tr><td class="k">Công việc</td><td>{{job_type}}</td></tr>` +
          `<tr><td class="k">Cách vào</td><td>{{access_note}}</td></tr>` +
          `<tr><td class="k">Mã việc</td><td>{{ref}}</td></tr></table>` +
          `<a class="btn" href="{{url}}">Xem chi tiết</a>` +
          `<p class="muted">Nếu bạn không thu xếp được, xin báo sớm để chúng tôi giao cho người khác.</p>`,
      },
    },
  },

  {
    key: "host.job_reminder",
    name: "작업 전일 알림",
    description: "내일 작업 리마인더. 준비물과 도착 시간만 짧게.",
    vars: vars("recipient", "ref", "job_type", "date", "time_window", "address", "space_name", "supplies"),
    tr: {
      ko: {
        subject: "[내일] {{space_name}} {{job_type}}",
        body:
          `<p class="lead">{{recipient}} 님, 내일 작업 안내드립니다.</p>` +
          `<table class="kv">` +
          `<tr><td class="k">일시</td><td>{{date}} {{time_window}}</td></tr>` +
          `<tr><td class="k">장소</td><td>{{address}} {{space_name}}</td></tr>` +
          `<tr><td class="k">준비물</td><td>{{supplies}}</td></tr></table>` +
          `<p class="muted">지시번호 {{ref}}. 늦어지실 것 같으면 미리 연락 주세요.</p>`,
      },
      en: {
        subject: "[Tomorrow] {{job_type}} at {{space_name}}",
        body:
          `<p class="lead">Hi {{recipient}}, a reminder about tomorrow.</p>` +
          `<table class="kv">` +
          `<tr><td class="k">When</td><td>{{date}} {{time_window}}</td></tr>` +
          `<tr><td class="k">Where</td><td>{{address}} {{space_name}}</td></tr>` +
          `<tr><td class="k">Bring</td><td>{{supplies}}</td></tr></table>` +
          `<p class="muted">Job {{ref}}. If you're going to be late, call ahead.</p>`,
      },
      ja: {
        subject: "【明日】{{space_name}} {{job_type}}",
        body:
          `<p class="lead">{{recipient}} 様、明日の作業のご案内です。</p>` +
          `<table class="kv">` +
          `<tr><td class="k">日時</td><td>{{date}} {{time_window}}</td></tr>` +
          `<tr><td class="k">場所</td><td>{{address}} {{space_name}}</td></tr>` +
          `<tr><td class="k">お持ちいただくもの</td><td>{{supplies}}</td></tr></table>` +
          `<p class="muted">指示番号 {{ref}}。遅れそうな場合は事前にご連絡ください。</p>`,
      },
      zh: {
        subject: "【明天】{{space_name}} {{job_type}}",
        body:
          `<p class="lead">{{recipient}} 您好，提醒您明天的作业。</p>` +
          `<table class="kv">` +
          `<tr><td class="k">时间</td><td>{{date}} {{time_window}}</td></tr>` +
          `<tr><td class="k">地点</td><td>{{address}} {{space_name}}</td></tr>` +
          `<tr><td class="k">需带物品</td><td>{{supplies}}</td></tr></table>` +
          `<p class="muted">派单号 {{ref}}。若可能迟到，请提前联系。</p>`,
      },
      th: {
        subject: "[พรุ่งนี้] {{space_name}} {{job_type}}",
        body:
          `<p class="lead">คุณ{{recipient}} ขอแจ้งเตือนงานพรุ่งนี้</p>` +
          `<table class="kv">` +
          `<tr><td class="k">วันเวลา</td><td>{{date}} {{time_window}}</td></tr>` +
          `<tr><td class="k">สถานที่</td><td>{{address}} {{space_name}}</td></tr>` +
          `<tr><td class="k">สิ่งที่ต้องนำไป</td><td>{{supplies}}</td></tr></table>` +
          `<p class="muted">เลขที่งาน {{ref}} หากคาดว่าจะไปสาย กรุณาโทรแจ้งล่วงหน้า</p>`,
      },
      vi: {
        subject: "[Ngày mai] {{space_name}} {{job_type}}",
        body:
          `<p class="lead">Chào {{recipient}}, nhắc bạn công việc ngày mai.</p>` +
          `<table class="kv">` +
          `<tr><td class="k">Thời gian</td><td>{{date}} {{time_window}}</td></tr>` +
          `<tr><td class="k">Địa điểm</td><td>{{address}} {{space_name}}</td></tr>` +
          `<tr><td class="k">Mang theo</td><td>{{supplies}}</td></tr></table>` +
          `<p class="muted">Mã việc {{ref}}. Nếu bạn đến muộn, xin gọi báo trước.</p>`,
      },
    },
  },

  {
    key: "host.job_changed",
    name: "작업 일정·내용 변경",
    description: "변경 통보. 바뀐 것만 눈에 띄게 보여 준다.",
    vars: vars("recipient", "ref", "changed_items", "date", "time_window", "address", "space_name"),
    tr: {
      ko: {
        subject: "[변경] {{space_name}} 작업 일정",
        body:
          `<p class="lead">{{recipient}} 님, 작업 내용이 바뀌었습니다.</p>` +
          `<div class="box"><div class="label">바뀐 내용</div><div>{{changed_items}}</div></div>` +
          `<table class="kv">` +
          `<tr><td class="k">변경 후 일시</td><td>{{date}} {{time_window}}</td></tr>` +
          `<tr><td class="k">장소</td><td>{{address}} {{space_name}}</td></tr></table>` +
          `<p class="muted">지시번호 {{ref}}. 바뀐 일정이 어려우시면 알려 주세요.</p>`,
      },
      en: {
        subject: "[Changed] job at {{space_name}}",
        body:
          `<p class="lead">Hi {{recipient}}, this job has changed.</p>` +
          `<div class="box"><div class="label">What changed</div><div>{{changed_items}}</div></div>` +
          `<table class="kv">` +
          `<tr><td class="k">New time</td><td>{{date}} {{time_window}}</td></tr>` +
          `<tr><td class="k">Where</td><td>{{address}} {{space_name}}</td></tr></table>` +
          `<p class="muted">Job {{ref}}. Tell us if the new time doesn't work for you.</p>`,
      },
      ja: {
        subject: "【変更】{{space_name}} の作業日程",
        body:
          `<p class="lead">{{recipient}} 様、作業内容に変更がございます。</p>` +
          `<div class="box"><div class="label">変更内容</div><div>{{changed_items}}</div></div>` +
          `<table class="kv">` +
          `<tr><td class="k">変更後の日時</td><td>{{date}} {{time_window}}</td></tr>` +
          `<tr><td class="k">場所</td><td>{{address}} {{space_name}}</td></tr></table>` +
          `<p class="muted">指示番号 {{ref}}。変更後の日程がご都合に合わない場合はお知らせください。</p>`,
      },
      zh: {
        subject: "【变更】{{space_name}} 作业安排",
        body:
          `<p class="lead">{{recipient}} 您好，该派单有变更。</p>` +
          `<div class="box"><div class="label">变更内容</div><div>{{changed_items}}</div></div>` +
          `<table class="kv">` +
          `<tr><td class="k">变更后时间</td><td>{{date}} {{time_window}}</td></tr>` +
          `<tr><td class="k">地点</td><td>{{address}} {{space_name}}</td></tr></table>` +
          `<p class="muted">派单号 {{ref}}。若新时间不便，请告知我们。</p>`,
      },
      th: {
        subject: "[เปลี่ยนแปลง] งานที่ {{space_name}}",
        body:
          `<p class="lead">คุณ{{recipient}} งานนี้มีการเปลี่ยนแปลง</p>` +
          `<div class="box"><div class="label">สิ่งที่เปลี่ยน</div><div>{{changed_items}}</div></div>` +
          `<table class="kv">` +
          `<tr><td class="k">เวลาใหม่</td><td>{{date}} {{time_window}}</td></tr>` +
          `<tr><td class="k">สถานที่</td><td>{{address}} {{space_name}}</td></tr></table>` +
          `<p class="muted">เลขที่งาน {{ref}} หากเวลาใหม่ไม่สะดวก กรุณาแจ้ง</p>`,
      },
      vi: {
        subject: "[Thay đổi] công việc tại {{space_name}}",
        body:
          `<p class="lead">Chào {{recipient}}, công việc này có thay đổi.</p>` +
          `<div class="box"><div class="label">Nội dung thay đổi</div><div>{{changed_items}}</div></div>` +
          `<table class="kv">` +
          `<tr><td class="k">Giờ mới</td><td>{{date}} {{time_window}}</td></tr>` +
          `<tr><td class="k">Địa điểm</td><td>{{address}} {{space_name}}</td></tr></table>` +
          `<p class="muted">Mã việc {{ref}}. Nếu giờ mới không tiện, xin báo cho chúng tôi.</p>`,
      },
    },
  },

  {
    key: "host.job_cancelled",
    name: "작업 취소",
    description: "취소 통보. 이미 출발했을 수 있으므로 보상 여부를 함께 밝힌다.",
    vars: vars("recipient", "ref", "job_type", "date", "space_name", "reason", "compensation"),
    tr: {
      ko: {
        subject: "[취소] {{date}} {{space_name}} {{job_type}}",
        body:
          `<p class="lead">{{recipient}} 님, 작업이 취소되었습니다.</p>` +
          `<table class="kv">` +
          `<tr><td class="k">취소된 작업</td><td>{{date}} {{space_name}} {{job_type}}</td></tr>` +
          `<tr><td class="k">사유</td><td>{{reason}}</td></tr>` +
          `<tr><td class="k">보상</td><td>{{compensation}}</td></tr></table>` +
          `<p class="muted">지시번호 {{ref}}. 이미 현장으로 출발하셨다면 바로 연락 주세요. 이동에 든 시간은 따로 정산해 드리겠습니다.</p>`,
      },
      en: {
        subject: "[Cancelled] {{job_type}} at {{space_name}}, {{date}}",
        body:
          `<p class="lead">Hi {{recipient}}, this job has been cancelled.</p>` +
          `<table class="kv">` +
          `<tr><td class="k">Cancelled</td><td>{{date}} {{space_name}} {{job_type}}</td></tr>` +
          `<tr><td class="k">Reason</td><td>{{reason}}</td></tr>` +
          `<tr><td class="k">Compensation</td><td>{{compensation}}</td></tr></table>` +
          `<p class="muted">Job {{ref}}. If you've already set off, call us — we'll settle your travel time separately.</p>`,
      },
      ja: {
        subject: "【取消】{{date}} {{space_name}} {{job_type}}",
        body:
          `<p class="lead">{{recipient}} 様、作業が取り消されました。</p>` +
          `<table class="kv">` +
          `<tr><td class="k">取消された作業</td><td>{{date}} {{space_name}} {{job_type}}</td></tr>` +
          `<tr><td class="k">理由</td><td>{{reason}}</td></tr>` +
          `<tr><td class="k">補償</td><td>{{compensation}}</td></tr></table>` +
          `<p class="muted">指示番号 {{ref}}。すでに現場へ向かわれている場合は、すぐにご連絡ください。移動にかかったお時間は別途精算いたします。</p>`,
      },
      zh: {
        subject: "【取消】{{date}} {{space_name}} {{job_type}}",
        body:
          `<p class="lead">{{recipient}} 您好，该派单已取消。</p>` +
          `<table class="kv">` +
          `<tr><td class="k">取消的作业</td><td>{{date}} {{space_name}} {{job_type}}</td></tr>` +
          `<tr><td class="k">原因</td><td>{{reason}}</td></tr>` +
          `<tr><td class="k">补偿</td><td>{{compensation}}</td></tr></table>` +
          `<p class="muted">派单号 {{ref}}。若您已出发前往现场，请立即联系我们，路途时间将另行结算。</p>`,
      },
      th: {
        subject: "[ยกเลิก] {{date}} {{space_name}} {{job_type}}",
        body:
          `<p class="lead">คุณ{{recipient}} งานนี้ถูกยกเลิกแล้ว</p>` +
          `<table class="kv">` +
          `<tr><td class="k">งานที่ยกเลิก</td><td>{{date}} {{space_name}} {{job_type}}</td></tr>` +
          `<tr><td class="k">เหตุผล</td><td>{{reason}}</td></tr>` +
          `<tr><td class="k">ค่าชดเชย</td><td>{{compensation}}</td></tr></table>` +
          `<p class="muted">เลขที่งาน {{ref}} หากท่านออกเดินทางไปแล้ว กรุณาโทรแจ้งทันที เราจะคิดค่าเวลาเดินทางให้ต่างหาก</p>`,
      },
      vi: {
        subject: "[Hủy] {{date}} {{space_name}} {{job_type}}",
        body:
          `<p class="lead">Chào {{recipient}}, công việc này đã bị hủy.</p>` +
          `<table class="kv">` +
          `<tr><td class="k">Việc bị hủy</td><td>{{date}} {{space_name}} {{job_type}}</td></tr>` +
          `<tr><td class="k">Lý do</td><td>{{reason}}</td></tr>` +
          `<tr><td class="k">Bồi thường</td><td>{{compensation}}</td></tr></table>` +
          `<p class="muted">Mã việc {{ref}}. Nếu bạn đã lên đường, xin gọi cho chúng tôi — thời gian di chuyển sẽ được tính riêng.</p>`,
      },
    },
  },

  {
    key: "host.job_overdue",
    name: "작업 기한 초과",
    description: "완료 보고가 없을 때. 추궁이 아니라 상황을 묻는 어조로 쓴다.",
    vars: vars("recipient", "ref", "job_type", "space_name", "due_time", "contact_phone", "url"),
    tr: {
      ko: {
        subject: "{{space_name}} 작업 상황을 알려 주세요",
        body:
          `<p class="lead">{{recipient}} 님, 안녕하세요.</p>` +
          `<p>{{space_name}} {{job_type}} 작업이 {{due_time}}까지였는데 완료 보고가 아직 올라오지 않았습니다.</p>` +
          `<p>작업은 끝내셨고 보고만 남았다면 아래에서 올려 주세요. 현장에 문제가 생긴 거라면 알려 주세요. 함께 처리하겠습니다.</p>` +
          `<a class="btn" href="{{url}}">완료 보고하기</a>` +
          `<p class="muted">지시번호 {{ref}}. 급하시면 {{contact_phone}}으로 전화 주세요.</p>`,
      },
      en: {
        subject: "How is the job at {{space_name}} going?",
        body:
          `<p class="lead">Hi {{recipient}},</p>` +
          `<p>The {{job_type}} at {{space_name}} was due by {{due_time}} and we haven't had the completion report yet.</p>` +
          `<p>If the work is done and only the report is outstanding, you can file it below. If something went wrong on site, tell us and we'll sort it out together.</p>` +
          `<a class="btn" href="{{url}}">File the report</a>` +
          `<p class="muted">Job {{ref}}. If it's urgent, call {{contact_phone}}.</p>`,
      },
      ja: {
        subject: "{{space_name}} の作業状況をお知らせください",
        body:
          `<p class="lead">{{recipient}} 様</p>` +
          `<p>{{space_name}} の {{job_type}} は {{due_time}} が期限でしたが、完了報告がまだ届いておりません。</p>` +
          `<p>作業はお済みで報告のみ残っている場合は、下記よりご登録ください。現場で問題が生じている場合は、お知らせいただければ一緒に対応いたします。</p>` +
          `<a class="btn" href="{{url}}">完了報告をする</a>` +
          `<p class="muted">指示番号 {{ref}}。お急ぎの場合は {{contact_phone}} までお電話ください。</p>`,
      },
      zh: {
        subject: "请告知 {{space_name}} 的作业情况",
        body:
          `<p class="lead">{{recipient}} 您好，</p>` +
          `<p>{{space_name}} 的{{job_type}}原定 {{due_time}} 前完成，但我们尚未收到完工报告。</p>` +
          `<p>若作业已完成、只是报告未提交，可在下方补交。若现场出现问题，请告知我们，我们一起处理。</p>` +
          `<a class="btn" href="{{url}}">提交完工报告</a>` +
          `<p class="muted">派单号 {{ref}}。情况紧急请拨 {{contact_phone}}。</p>`,
      },
      th: {
        subject: "ขอทราบสถานะงานที่ {{space_name}}",
        body:
          `<p class="lead">เรียน คุณ{{recipient}}</p>` +
          `<p>งาน{{job_type}}ที่ {{space_name}} กำหนดเสร็จภายใน {{due_time}} แต่เรายังไม่ได้รับรายงานการทำงาน</p> ` +
          `<p>หากทำงานเสร็จแล้วเหลือแค่รายงาน ส่งได้จากลิงก์ด้านล่าง หากหน้างานมีปัญหา แจ้งมาได้ เราจะช่วยจัดการด้วยกัน</p>` +
          `<a class="btn" href="{{url}}">ส่งรายงาน</a>` +
          `<p class="muted">เลขที่งาน {{ref}} หากเร่งด่วน โทร {{contact_phone}}</p>`,
      },
      vi: {
        subject: "Công việc tại {{space_name}} thế nào rồi?",
        body:
          `<p class="lead">Chào {{recipient}},</p>` +
          `<p>Việc {{job_type}} tại {{space_name}} đến hạn {{due_time}} nhưng chúng tôi chưa nhận được báo cáo hoàn thành.</p>` +
          `<p>Nếu bạn đã làm xong và chỉ còn báo cáo, xin gửi ở bên dưới. Nếu có trục trặc tại hiện trường, xin báo để cùng xử lý.</p>` +
          `<a class="btn" href="{{url}}">Gửi báo cáo</a>` +
          `<p class="muted">Mã việc {{ref}}. Nếu gấp, xin gọi {{contact_phone}}.</p>`,
      },
    },
  },

  {
    key: "host.report_required",
    name: "완료 보고·사진 제출 요청",
    description: "작업 후 보고 요청. 사진이 정산 근거임을 밝혀 제출률을 높인다.",
    vars: vars("recipient", "ref", "job_type", "space_name", "photo_count", "due_time", "url"),
    tr: {
      ko: {
        subject: "완료 보고를 올려 주세요 ({{ref}})",
        body:
          `<p class="lead">{{recipient}} 님, 수고하셨습니다.</p>` +
          `<p>{{space_name}} {{job_type}} 작업의 완료 보고를 올려 주세요.</p>` +
          `<table class="kv"><tr><td class="k">사진</td><td>{{photo_count}}장 이상</td></tr>` +
          `<tr><td class="k">기한</td><td>{{due_time}}</td></tr></table>` +
          `<a class="btn" href="{{url}}">완료 보고하기</a>` +
          `<p class="muted">사진은 정산의 근거가 됩니다. 보고가 없으면 이번 회차 정산에 반영되지 않습니다.</p>`,
      },
      en: {
        subject: "Please file your completion report ({{ref}})",
        body:
          `<p class="lead">Hi {{recipient}}, thanks for your work today.</p>` +
          `<p>Please file the completion report for the {{job_type}} at {{space_name}}.</p>` +
          `<table class="kv"><tr><td class="k">Photos</td><td>{{photo_count}} or more</td></tr>` +
          `<tr><td class="k">By</td><td>{{due_time}}</td></tr></table>` +
          `<a class="btn" href="{{url}}">File the report</a>` +
          `<p class="muted">The photos are what your payment is based on. Without a report, the job won't make this settlement run.</p>`,
      },
      ja: {
        subject: "完了報告のご登録をお願いいたします（{{ref}}）",
        body:
          `<p class="lead">{{recipient}} 様、お疲れさまでした。</p>` +
          `<p>{{space_name}} の {{job_type}} について、完了報告をご登録ください。</p>` +
          `<table class="kv"><tr><td class="k">写真</td><td>{{photo_count}} 枚以上</td></tr>` +
          `<tr><td class="k">期限</td><td>{{due_time}}</td></tr></table>` +
          `<a class="btn" href="{{url}}">完了報告をする</a>` +
          `<p class="muted">写真は精算の根拠となります。ご報告がない場合、今回の精算には反映されません。</p>`,
      },
      zh: {
        subject: "请提交完工报告（{{ref}}）",
        body:
          `<p class="lead">{{recipient}} 您好，辛苦了。</p>` +
          `<p>请提交 {{space_name}} {{job_type}} 的完工报告。</p>` +
          `<table class="kv"><tr><td class="k">照片</td><td>{{photo_count}} 张以上</td></tr>` +
          `<tr><td class="k">截止</td><td>{{due_time}}</td></tr></table>` +
          `<a class="btn" href="{{url}}">提交完工报告</a>` +
          `<p class="muted">照片是结算的依据。未提交报告的作业不会计入本期结算。</p>`,
      },
      th: {
        subject: "กรุณาส่งรายงานการทำงาน ({{ref}})",
        body:
          `<p class="lead">คุณ{{recipient}} ขอบคุณสำหรับงานวันนี้</p>` +
          `<p>กรุณาส่งรายงานการทำงานของ{{job_type}}ที่ {{space_name}}</p>` +
          `<table class="kv"><tr><td class="k">ภาพถ่าย</td><td>{{photo_count}} ภาพขึ้นไป</td></tr>` +
          `<tr><td class="k">ภายใน</td><td>{{due_time}}</td></tr></table>` +
          `<a class="btn" href="{{url}}">ส่งรายงาน</a>` +
          `<p class="muted">ภาพถ่ายใช้เป็นหลักฐานในการคิดค่าจ้าง หากไม่มีรายงาน งานนี้จะไม่เข้ารอบจ่ายเงินครั้งนี้</p>`,
      },
      vi: {
        subject: "Xin gửi báo cáo hoàn thành ({{ref}})",
        body:
          `<p class="lead">Chào {{recipient}}, cảm ơn bạn đã làm việc.</p>` +
          `<p>Xin gửi báo cáo hoàn thành cho việc {{job_type}} tại {{space_name}}.</p>` +
          `<table class="kv"><tr><td class="k">Ảnh</td><td>từ {{photo_count}} ảnh</td></tr>` +
          `<tr><td class="k">Trước</td><td>{{due_time}}</td></tr></table>` +
          `<a class="btn" href="{{url}}">Gửi báo cáo</a>` +
          `<p class="muted">Ảnh là căn cứ tính tiền công. Không có báo cáo, việc này sẽ không vào kỳ thanh toán lần này.</p>`,
      },
    },
  },

  {
    key: "host.report_accepted",
    name: "작업 완료 승인",
    description: "보고 승인 통보. 정산 반영 시점을 함께 알린다.",
    vars: vars("recipient", "ref", "job_type", "space_name", "amount", "settlement_period"),
    tr: {
      ko: {
        subject: "작업이 승인되었습니다 ({{ref}})",
        body:
          `<p class="lead">{{recipient}} 님, 수고하셨습니다.</p>` +
          `<p>{{space_name}} {{job_type}} 작업을 확인하고 승인했습니다.</p>` +
          `<table class="kv">` +
          `<tr><td class="k">작업비</td><td>{{amount}}</td></tr>` +
          `<tr><td class="k">정산 반영</td><td>{{settlement_period}}</td></tr></table>` +
          `<p class="muted">금액이 예상과 다르면 알려 주세요. 정산 전에 확인해 드리겠습니다.</p>`,
      },
      en: {
        subject: "Job approved ({{ref}})",
        body:
          `<p class="lead">Hi {{recipient}}, nice work.</p>` +
          `<p>The {{job_type}} at {{space_name}} has been checked and approved.</p>` +
          `<table class="kv">` +
          `<tr><td class="k">Fee</td><td>{{amount}}</td></tr>` +
          `<tr><td class="k">Included in</td><td>{{settlement_period}}</td></tr></table>` +
          `<p class="muted">If the amount isn't what you expected, tell us and we'll check before the payment run.</p>`,
      },
      ja: {
        subject: "作業が承認されました（{{ref}}）",
        body:
          `<p class="lead">{{recipient}} 様、お疲れさまでした。</p>` +
          `<p>{{space_name}} の {{job_type}} を確認のうえ、承認いたしました。</p>` +
          `<table class="kv">` +
          `<tr><td class="k">作業料</td><td>{{amount}}</td></tr>` +
          `<tr><td class="k">精算対象</td><td>{{settlement_period}}</td></tr></table>` +
          `<p class="muted">金額が想定と異なる場合はお知らせください。精算前に確認いたします。</p>`,
      },
      zh: {
        subject: "作业已通过审核（{{ref}}）",
        body:
          `<p class="lead">{{recipient}} 您好，辛苦了。</p>` +
          `<p>{{space_name}} 的{{job_type}}已核实并通过审核。</p>` +
          `<table class="kv">` +
          `<tr><td class="k">作业费</td><td>{{amount}}</td></tr>` +
          `<tr><td class="k">计入结算</td><td>{{settlement_period}}</td></tr></table>` +
          `<p class="muted">若金额与您预期不符，请告知我们，结算前会为您核对。</p>`,
      },
      th: {
        subject: "งานได้รับการอนุมัติแล้ว ({{ref}})",
        body:
          `<p class="lead">คุณ{{recipient}} ขอบคุณสำหรับงานที่ทำ</p>` +
          `<p>งาน{{job_type}}ที่ {{space_name}} ผ่านการตรวจสอบและอนุมัติแล้ว</p>` +
          `<table class="kv">` +
          `<tr><td class="k">ค่าจ้าง</td><td>{{amount}}</td></tr>` +
          `<tr><td class="k">เข้ารอบจ่าย</td><td>{{settlement_period}}</td></tr></table>` +
          `<p class="muted">หากยอดไม่ตรงกับที่คาดไว้ กรุณาแจ้ง เราจะตรวจสอบก่อนรอบจ่ายเงิน</p>`,
      },
      vi: {
        subject: "Công việc đã được duyệt ({{ref}})",
        body:
          `<p class="lead">Chào {{recipient}}, bạn đã làm tốt.</p>` +
          `<p>Việc {{job_type}} tại {{space_name}} đã được kiểm tra và duyệt.</p>` +
          `<table class="kv">` +
          `<tr><td class="k">Tiền công</td><td>{{amount}}</td></tr>` +
          `<tr><td class="k">Tính vào kỳ</td><td>{{settlement_period}}</td></tr></table>` +
          `<p class="muted">Nếu số tiền khác dự kiến, xin báo để chúng tôi kiểm tra trước kỳ chi trả.</p>`,
      },
    },
  },

  {
    key: "host.settlement_statement",
    name: "월 정산 명세서",
    description: "정산 명세 송부. 건별 내역은 첨부, 메일에는 합계만.",
    vars: vars("recipient", "period", "job_count", "gross_amount", "deduction", "net_amount", "payout_date", "url"),
    tr: {
      ko: {
        subject: "{{period}} 정산 명세서",
        body:
          `<p class="lead">{{recipient}} 님, 안녕하세요.</p>` +
          `<p>{{period}} 정산 명세서를 보내 드립니다. 건별 내역은 첨부한 파일에서 확인해 주세요.</p>` +
          `<table class="kv">` +
          `<tr><td class="k">작업 건수</td><td>{{job_count}}건</td></tr>` +
          `<tr><td class="k">작업비 합계</td><td>{{gross_amount}}</td></tr>` +
          `<tr><td class="k">공제</td><td>{{deduction}}</td></tr>` +
          `<tr><td class="k">지급액</td><td>{{net_amount}}</td></tr>` +
          `<tr><td class="k">지급 예정일</td><td>{{payout_date}}</td></tr></table>` +
          `<a class="btn" href="{{url}}">정산 내역 보기</a>` +
          `<p class="muted">빠진 작업이나 맞지 않는 금액이 있으면 지급일 전에 알려 주세요.</p>`,
      },
      en: {
        subject: "Statement for {{period}}",
        body:
          `<p class="lead">Hi {{recipient}},</p>` +
          `<p>Here's your statement for {{period}}. The job-by-job breakdown is attached.</p>` +
          `<table class="kv">` +
          `<tr><td class="k">Jobs</td><td>{{job_count}}</td></tr>` +
          `<tr><td class="k">Fees</td><td>{{gross_amount}}</td></tr>` +
          `<tr><td class="k">Deductions</td><td>{{deduction}}</td></tr>` +
          `<tr><td class="k">Net</td><td>{{net_amount}}</td></tr>` +
          `<tr><td class="k">Payment date</td><td>{{payout_date}}</td></tr></table>` +
          `<a class="btn" href="{{url}}">View your earnings</a>` +
          `<p class="muted">If a job is missing or an amount looks wrong, tell us before the payment date.</p>`,
      },
      ja: {
        subject: "{{period}} 精算明細書",
        body:
          `<p class="lead">{{recipient}} 様</p>` +
          `<p>{{period}} の精算明細書をお送りいたします。案件ごとの内訳は添付の明細書をご確認ください。</p>` +
          `<table class="kv">` +
          `<tr><td class="k">作業件数</td><td>{{job_count}} 件</td></tr>` +
          `<tr><td class="k">作業料合計</td><td>{{gross_amount}}</td></tr>` +
          `<tr><td class="k">控除</td><td>{{deduction}}</td></tr>` +
          `<tr><td class="k">お支払額</td><td>{{net_amount}}</td></tr>` +
          `<tr><td class="k">お支払予定日</td><td>{{payout_date}}</td></tr></table>` +
          `<a class="btn" href="{{url}}">精算内容を確認する</a>` +
          `<p class="muted">抜けている作業や金額の相違がございましたら、お支払日までにお知らせください。</p>`,
      },
      zh: {
        subject: "{{period}} 结算单",
        body:
          `<p class="lead">{{recipient}} 您好，</p>` +
          `<p>现将 {{period}} 的结算单发送给您。逐单明细请见随附结算单。</p>` +
          `<table class="kv">` +
          `<tr><td class="k">作业笔数</td><td>{{job_count}} 笔</td></tr>` +
          `<tr><td class="k">作业费合计</td><td>{{gross_amount}}</td></tr>` +
          `<tr><td class="k">扣除</td><td>{{deduction}}</td></tr>` +
          `<tr><td class="k">应付金额</td><td>{{net_amount}}</td></tr>` +
          `<tr><td class="k">预计支付日</td><td>{{payout_date}}</td></tr></table>` +
          `<a class="btn" href="{{url}}">查看结算明细</a>` +
          `<p class="muted">若有遗漏的作业或金额不符，请在支付日前告知我们。</p>`,
      },
      th: {
        subject: "ใบสรุปค่าจ้างงวด {{period}}",
        body:
          `<p class="lead">เรียน คุณ{{recipient}}</p>` +
          `<p>ขอส่งใบสรุปค่าจ้างงวด {{period}} รายละเอียดรายงานดูได้จากเอกสารที่แนบ</p>` +
          `<table class="kv">` +
          `<tr><td class="k">จำนวนงาน</td><td>{{job_count}} งาน</td></tr>` +
          `<tr><td class="k">ค่าจ้างรวม</td><td>{{gross_amount}}</td></tr>` +
          `<tr><td class="k">รายการหัก</td><td>{{deduction}}</td></tr>` +
          `<tr><td class="k">ยอดจ่ายสุทธิ</td><td>{{net_amount}}</td></tr>` +
          `<tr><td class="k">วันที่จ่าย</td><td>{{payout_date}}</td></tr></table>` +
          `<a class="btn" href="{{url}}">ดูรายละเอียดค่าจ้าง</a>` +
          `<p class="muted">หากมีงานตกหล่นหรือยอดไม่ตรง กรุณาแจ้งก่อนวันจ่าย</p>`,
      },
      vi: {
        subject: "Bảng kê kỳ {{period}}",
        body:
          `<p class="lead">Chào {{recipient}},</p>` +
          `<p>Đây là bảng kê kỳ {{period}}. Chi tiết từng việc xin xem tệp đính kèm.</p>` +
          `<table class="kv">` +
          `<tr><td class="k">Số việc</td><td>{{job_count}}</td></tr>` +
          `<tr><td class="k">Tổng tiền công</td><td>{{gross_amount}}</td></tr>` +
          `<tr><td class="k">Khấu trừ</td><td>{{deduction}}</td></tr>` +
          `<tr><td class="k">Thực nhận</td><td>{{net_amount}}</td></tr>` +
          `<tr><td class="k">Ngày chi trả</td><td>{{payout_date}}</td></tr></table>` +
          `<a class="btn" href="{{url}}">Xem thu nhập</a>` +
          `<p class="muted">Nếu thiếu việc nào hoặc số tiền chưa đúng, xin báo trước ngày chi trả.</p>`,
      },
    },
  },

  {
    key: "host.payout_sent",
    name: "정산금 지급 완료",
    description: "송금 완료 통보. 계좌 끝자리와 송금일로 대사를 돕는다.",
    vars: vars("recipient", "period", "net_amount", "paid_date", "account_tail", "url"),
    tr: {
      ko: {
        subject: "{{period}} 정산금을 보내 드렸습니다",
        body:
          `<p class="lead">{{recipient}} 님, 안녕하세요.</p>` +
          `<p>{{period}} 정산금을 아래와 같이 송금했습니다.</p>` +
          `<table class="kv">` +
          `<tr><td class="k">지급액</td><td>{{net_amount}}</td></tr>` +
          `<tr><td class="k">송금일</td><td>{{paid_date}}</td></tr>` +
          `<tr><td class="k">입금 계좌</td><td>끝자리 {{account_tail}}</td></tr></table>` +
          `<a class="btn" href="{{url}}">지급 내역 보기</a>` +
          `<p class="muted">은행 사정에 따라 하루 이틀 걸릴 수 있습니다. 그 뒤에도 입금이 확인되지 않으면 알려 주세요.</p>`,
      },
      en: {
        subject: "Your {{period}} payment is on its way",
        body:
          `<p class="lead">Hi {{recipient}},</p>` +
          `<p>Your payment for {{period}} has been transferred.</p>` +
          `<table class="kv">` +
          `<tr><td class="k">Amount</td><td>{{net_amount}}</td></tr>` +
          `<tr><td class="k">Sent on</td><td>{{paid_date}}</td></tr>` +
          `<tr><td class="k">To account ending</td><td>{{account_tail}}</td></tr></table>` +
          `<a class="btn" href="{{url}}">View the payment</a>` +
          `<p class="muted">Banks can take a day or two. If it hasn't arrived after that, let us know.</p>`,
      },
      ja: {
        subject: "{{period}} の精算金をお振込みしました",
        body:
          `<p class="lead">{{recipient}} 様</p>` +
          `<p>{{period}} の精算金を下記のとおりお振込みいたしました。</p>` +
          `<table class="kv">` +
          `<tr><td class="k">お支払額</td><td>{{net_amount}}</td></tr>` +
          `<tr><td class="k">お振込日</td><td>{{paid_date}}</td></tr>` +
          `<tr><td class="k">お振込先</td><td>下4桁 {{account_tail}}</td></tr></table>` +
          `<a class="btn" href="{{url}}">お支払い内容を確認する</a>` +
          `<p class="muted">金融機関の処理により1～2日かかる場合がございます。その後も入金が確認できない場合はお知らせください。</p>`,
      },
      zh: {
        subject: "{{period}} 结算款已汇出",
        body:
          `<p class="lead">{{recipient}} 您好，</p>` +
          `<p>{{period}} 的结算款已按以下方式汇出。</p>` +
          `<table class="kv">` +
          `<tr><td class="k">支付金额</td><td>{{net_amount}}</td></tr>` +
          `<tr><td class="k">汇款日</td><td>{{paid_date}}</td></tr>` +
          `<tr><td class="k">收款账户</td><td>尾号 {{account_tail}}</td></tr></table>` +
          `<a class="btn" href="{{url}}">查看支付记录</a>` +
          `<p class="muted">银行处理可能需要一两天。若之后仍未到账，请告知我们。</p>`,
      },
      th: {
        subject: "โอนค่าจ้างงวด {{period}} แล้ว",
        body:
          `<p class="lead">เรียน คุณ{{recipient}}</p>` +
          `<p>เราได้โอนค่าจ้างงวด {{period}} ตามรายละเอียดด้านล่างแล้ว</p>` +
          `<table class="kv">` +
          `<tr><td class="k">ยอดจ่าย</td><td>{{net_amount}}</td></tr>` +
          `<tr><td class="k">วันที่โอน</td><td>{{paid_date}}</td></tr>` +
          `<tr><td class="k">บัญชีปลายทาง</td><td>เลขท้าย {{account_tail}}</td></tr></table>` +
          `<a class="btn" href="{{url}}">ดูรายการจ่าย</a>` +
          `<p class="muted">ธนาคารอาจใช้เวลาหนึ่งถึงสองวัน หากพ้นกำหนดแล้วเงินยังไม่เข้า กรุณาแจ้งเรา</p>`,
      },
      vi: {
        subject: "Đã chuyển tiền kỳ {{period}}",
        body:
          `<p class="lead">Chào {{recipient}},</p>` +
          `<p>Tiền công kỳ {{period}} đã được chuyển như sau.</p>` +
          `<table class="kv">` +
          `<tr><td class="k">Số tiền</td><td>{{net_amount}}</td></tr>` +
          `<tr><td class="k">Ngày chuyển</td><td>{{paid_date}}</td></tr>` +
          `<tr><td class="k">Tài khoản nhận</td><td>đuôi {{account_tail}}</td></tr></table>` +
          `<a class="btn" href="{{url}}">Xem giao dịch</a>` +
          `<p class="muted">Ngân hàng có thể mất một hai ngày. Sau đó vẫn chưa thấy, xin báo cho chúng tôi.</p>`,
      },
    },
  },

  {
    key: "survey.host_csat",
    name: "서비스 호스트 만족도",
    description: "일하기 어땠는지 조사. 단가·일정·소통 중 불만을 조기에 잡는다.",
    vars: vars("recipient", "url", "minutes", "close_date"),
    tr: {
      ko: {
        subject: "일하시면서 불편한 점은 없으셨나요",
        body:
          `<p class="lead">{{recipient}} 님, 안녕하세요.</p>` +
          `<p>그동안 저희 작업을 맡아 주셔서 감사합니다. 일하시면서 불편했던 점이 있었는지 여쭙습니다.</p>` +
          `<a class="btn" href="{{url}}">설문 참여하기</a>` +
          `<p>{{minutes}}분이면 됩니다. 단가, 일정 통보, 현장 정보, 정산 속도 가운데 아쉬웠던 점을 솔직하게 적어 주세요.</p>` +
          `<p class="muted">답변이 배정이나 단가에 불리하게 쓰이는 일은 없습니다. {{close_date}}까지 열려 있습니다.</p>`,
      },
      en: {
        subject: "How has the work been for you?",
        body:
          `<p class="lead">Hi {{recipient}},</p>` +
          `<p>Thank you for taking on our jobs. We'd like to know if anything has been difficult on your side.</p>` +
          `<a class="btn" href="{{url}}">Take the survey</a>` +
          `<p>It takes {{minutes}} minutes. Be honest about rates, how much notice you get, how accurate the site information is, and how quickly you're paid.</p>` +
          `<p class="muted">Your answers are never used against you when jobs or rates are decided. Open until {{close_date}}.</p>`,
      },
      ja: {
        subject: "作業でご不便な点はございませんでしたか",
        body:
          `<p class="lead">{{recipient}} 様</p>` +
          `<p>いつも作業をお引き受けいただき、ありがとうございます。お仕事のなかでご不便な点がなかったか、お伺いしたく存じます。</p>` +
          `<a class="btn" href="{{url}}">アンケートに答える</a>` +
          `<p>{{minutes}} 分ほどで終わります。単価、日程のご連絡時期、現場情報の正確さ、精算の早さについて、率直にお書きください。</p>` +
          `<p class="muted">ご回答が作業の割り当てや単価に不利に働くことはございません。{{close_date}} まで受け付けております。</p>`,
      },
      zh: {
        subject: "工作中有什么不便之处吗？",
        body:
          `<p class="lead">{{recipient}} 您好，</p>` +
          `<p>感谢您一直承接我们的作业。想请教您在工作中是否遇到不便。</p>` +
          `<a class="btn" href="{{url}}">参与问卷</a>` +
          `<p>约 {{minutes}} 分钟。请就单价、派单通知的提前量、现场信息准确度、结算速度等方面坦率反馈。</p>` +
          `<p class="muted">您的答复不会在派单或定价上对您不利。问卷开放至 {{close_date}}。</p>`,
      },
      th: {
        subject: "ทำงานแล้วมีอะไรไม่สะดวกบ้างไหม",
        body:
          `<p class="lead">เรียน คุณ{{recipient}}</p>` +
          `<p>ขอบคุณที่รับงานกับเราเสมอมา เราอยากทราบว่าระหว่างทำงานมีเรื่องใดไม่สะดวกบ้าง</p>` +
          `<a class="btn" href="{{url}}">ตอบแบบสอบถาม</a>` +
          `<p>ใช้เวลาราว {{minutes}} นาที กรุณาบอกตรง ๆ เรื่องอัตราค่าจ้าง การแจ้งงานล่วงหน้า ความถูกต้องของข้อมูลหน้างาน และความเร็วในการจ่ายเงิน</p>` +
          `<p class="muted">คำตอบของท่านจะไม่ถูกนำไปใช้ในทางลบต่อการมอบหมายงานหรืออัตราค่าจ้าง เปิดรับถึง {{close_date}}</p>`,
      },
      vi: {
        subject: "Công việc có gì bất tiện không?",
        body:
          `<p class="lead">Chào {{recipient}},</p>` +
          `<p>Cảm ơn bạn đã nhận việc của chúng tôi. Chúng tôi muốn biết bạn có gặp khó khăn gì không.</p>` +
          `<a class="btn" href="{{url}}">Trả lời khảo sát</a>` +
          `<p>Chỉ mất {{minutes}} phút. Xin nói thẳng về đơn giá, việc báo lịch sớm hay muộn, độ chính xác của thông tin hiện trường và tốc độ thanh toán.</p>` +
          `<p class="muted">Câu trả lời không bao giờ bị dùng bất lợi cho bạn khi giao việc hay định giá. Mở đến ngày {{close_date}}.</p>`,
      },
    },
  },
];
