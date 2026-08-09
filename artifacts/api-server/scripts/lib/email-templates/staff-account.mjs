// staff — 계정·권한·승인 (staff.*)
//
// 수신자는 **내부 직원**이다. 고객 존대를 걷어내고 업무 알림 밀도로 쓴다.
// "~해 주시기 바랍니다" 대신 "~해 주세요", 인사말은 최소한만.
//
// ⚠️ 직원 메일이라도 고객 개인정보는 최소로 담는다. 이름과 건 번호까지만 쓰고
//    연락처·주민번호·계좌는 넣지 않는다 — 메일함은 통제 범위 밖이고 전달·유출된다.
//    필요한 정보는 링크 너머 관리자 화면에서 권한을 확인하고 보여 준다.
// 한국어는 humanize-korean 통과본. 영어에서 재기계번역 금지.
import { vars } from "./_shared.mjs";

export const STAFF_ACCOUNT = [
  {
    key: "staff.invitation",
    name: "직원 초대",
    description: "새 직원을 워크스페이스에 초대. 만료 시간을 명시한다.",
    vars: vars("recipient", "inviter_name", "role", "url", "expiry_date"),
    tr: {
      ko: {
        subject: "{{inviter_name}} 님이 초대했습니다",
        body:
          `<p class="lead">{{recipient}} 님, 안녕하세요.</p>` +
          `<p>{{inviter_name}} 님이 {{role}} 권한으로 초대했습니다.</p>` +
          `<a class="btn" href="{{url}}">초대 수락하기</a>` +
          `<p class="muted">링크는 {{expiry_date}}까지 유효합니다. 만료되면 초대한 분에게 다시 요청해 주세요.</p>`,
      },
      en: {
        subject: "{{inviter_name}} has invited you",
        body:
          `<p class="lead">Hi {{recipient}},</p>` +
          `<p>{{inviter_name}} has invited you with the {{role}} role.</p>` +
          `<a class="btn" href="{{url}}">Accept the invitation</a>` +
          `<p class="muted">The link is valid until {{expiry_date}}. If it lapses, ask them to send a new one.</p>`,
      },
      ja: {
        subject: "{{inviter_name}} さんから招待が届いています",
        body:
          `<p class="lead">{{recipient}} さん</p>` +
          `<p>{{inviter_name}} さんが {{role}} 権限で招待しました。</p>` +
          `<a class="btn" href="{{url}}">招待を承認する</a>` +
          `<p class="muted">リンクの有効期限は {{expiry_date}} です。期限切れの場合は、招待した方に再送を依頼してください。</p>`,
      },
      zh: {
        subject: "{{inviter_name}} 邀请您加入",
        body:
          `<p class="lead">{{recipient}} 您好，</p>` +
          `<p>{{inviter_name}} 以 {{role}} 权限邀请您加入。</p>` +
          `<a class="btn" href="{{url}}">接受邀请</a>` +
          `<p class="muted">链接有效期至 {{expiry_date}}。若已失效，请向邀请人重新申请。</p>`,
      },
      th: {
        subject: "{{inviter_name}} เชิญคุณเข้าร่วม",
        body:
          `<p class="lead">สวัสดีคุณ{{recipient}}</p>` +
          `<p>{{inviter_name}} เชิญคุณเข้าร่วมด้วยสิทธิ์ {{role}}</p>` +
          `<a class="btn" href="{{url}}">ตอบรับคำเชิญ</a>` +
          `<p class="muted">ลิงก์ใช้ได้ถึง {{expiry_date}} หากหมดอายุ กรุณาขอให้ผู้เชิญส่งใหม่</p>`,
      },
      vi: {
        subject: "{{inviter_name}} đã mời bạn",
        body:
          `<p class="lead">Chào {{recipient}},</p>` +
          `<p>{{inviter_name}} đã mời bạn với quyền {{role}}.</p>` +
          `<a class="btn" href="{{url}}">Chấp nhận lời mời</a>` +
          `<p class="muted">Liên kết có hiệu lực đến {{expiry_date}}. Nếu hết hạn, hãy nhờ người mời gửi lại.</p>`,
      },
    },
  },

  {
    key: "staff.welcome",
    name: "직원 온보딩 안내",
    description: "첫 로그인 후 무엇부터 해야 하는지. 목록으로 짧게.",
    vars: vars("recipient", "role", "url", "manager_name"),
    tr: {
      ko: {
        subject: "시작하기 전에 확인할 것",
        body:
          `<p class="lead">{{recipient}} 님, 환영합니다.</p>` +
          `<p>{{role}} 권한으로 계정이 열렸습니다. 아래 세 가지부터 해 주세요.</p>` +
          `<ul>` +
          `<li>비밀번호를 바꾸고 2단계 인증을 켜 주세요.</li>` +
          `<li>프로필에 연락처와 담당 업무를 채워 주세요.</li>` +
          `<li>알림 설정에서 받을 메일 종류를 골라 주세요.</li>` +
          `</ul>` +
          `<a class="btn" href="{{url}}">시작하기</a>` +
          `<p class="muted">권한이 모자라 막히는 화면이 있으면 {{manager_name}} 님에게 알려 주세요.</p>`,
      },
      en: {
        subject: "Before you start",
        body:
          `<p class="lead">Welcome, {{recipient}}.</p>` +
          `<p>Your account is open with the {{role}} role. Start with these.</p>` +
          `<ul>` +
          `<li>Change your password and turn on two-factor authentication.</li>` +
          `<li>Fill in your contact details and what you handle.</li>` +
          `<li>Pick which notification emails you want.</li>` +
          `</ul>` +
          `<a class="btn" href="{{url}}">Get started</a>` +
          `<p class="muted">If a screen looks like you should have access and don't, tell {{manager_name}}.</p>`,
      },
      ja: {
        subject: "始める前に確認すること",
        body:
          `<p class="lead">{{recipient}} さん、ようこそ。</p>` +
          `<p>{{role}} 権限でアカウントを開設しました。まずこちらからお願いします。</p>` +
          `<ul>` +
          `<li>パスワードを変更し、二段階認証を有効にしてください。</li>` +
          `<li>プロフィールに連絡先と担当業務を入力してください。</li>` +
          `<li>通知設定で受け取るメールの種類を選んでください。</li>` +
          `</ul>` +
          `<a class="btn" href="{{url}}">はじめる</a>` +
          `<p class="muted">権限が足りないと思われる画面があれば、{{manager_name}} さんに伝えてください。</p>`,
      },
      zh: {
        subject: "开始之前请先完成",
        body:
          `<p class="lead">{{recipient}} 您好，欢迎加入。</p>` +
          `<p>已为您开通 {{role}} 权限账户。请先完成以下几项。</p>` +
          `<ul>` +
          `<li>修改密码并开启两步验证。</li>` +
          `<li>在个人资料中填写联系方式与负责业务。</li>` +
          `<li>在通知设置中选择要接收的邮件类型。</li>` +
          `</ul>` +
          `<a class="btn" href="{{url}}">开始使用</a>` +
          `<p class="muted">若某个页面显示权限不足，请告知 {{manager_name}}。</p>`,
      },
      th: {
        subject: "ก่อนเริ่มใช้งาน",
        body:
          `<p class="lead">ยินดีต้อนรับ คุณ{{recipient}}</p>` +
          `<p>เปิดบัญชีให้แล้วด้วยสิทธิ์ {{role}} เริ่มจากรายการเหล่านี้ก่อน</p>` +
          `<ul>` +
          `<li>เปลี่ยนรหัสผ่านและเปิดการยืนยันตัวตนสองชั้น</li>` +
          `<li>กรอกข้อมูลติดต่อและงานที่รับผิดชอบในโปรไฟล์</li>` +
          `<li>เลือกประเภทอีเมลแจ้งเตือนที่ต้องการรับ</li>` +
          `</ul>` +
          `<a class="btn" href="{{url}}">เริ่มใช้งาน</a>` +
          `<p class="muted">หากหน้าจอใดขึ้นว่าไม่มีสิทธิ์ทั้งที่ควรมี แจ้ง {{manager_name}} ได้เลย</p>`,
      },
      vi: {
        subject: "Trước khi bắt đầu",
        body:
          `<p class="lead">Chào mừng {{recipient}}.</p>` +
          `<p>Tài khoản của bạn đã mở với quyền {{role}}. Hãy bắt đầu với những việc sau.</p>` +
          `<ul>` +
          `<li>Đổi mật khẩu và bật xác thực hai bước.</li>` +
          `<li>Điền thông tin liên hệ và mảng công việc bạn phụ trách.</li>` +
          `<li>Chọn loại email thông báo bạn muốn nhận.</li>` +
          `</ul>` +
          `<a class="btn" href="{{url}}">Bắt đầu</a>` +
          `<p class="muted">Nếu màn hình nào báo thiếu quyền dù lẽ ra bạn phải có, hãy báo {{manager_name}}.</p>`,
      },
    },
  },

  {
    key: "staff.role_changed",
    name: "권한 변경 알림",
    description: "역할이 바뀌었을 때. 무엇이 늘고 줄었는지 밝힌다.",
    vars: vars("recipient", "old_role", "new_role", "changed_by", "date", "url"),
    tr: {
      ko: {
        subject: "권한이 변경되었습니다",
        body:
          `<p class="lead">{{recipient}} 님, 안녕하세요.</p>` +
          `<p>{{changed_by}} 님이 {{date}}에 권한을 변경했습니다.</p>` +
          `<table class="kv">` +
          `<tr><td class="k">이전</td><td>{{old_role}}</td></tr>` +
          `<tr><td class="k">현재</td><td>{{new_role}}</td></tr></table>` +
          `<p>바뀐 권한은 다음 로그인부터 적용됩니다.</p>` +
          `<a class="btn" href="{{url}}">내 권한 확인하기</a>` +
          `<p class="muted">필요한 화면이 안 보이거나 안 보여야 할 화면이 보이면 알려 주세요.</p>`,
      },
      en: {
        subject: "Your access has changed",
        body:
          `<p class="lead">Hi {{recipient}},</p>` +
          `<p>{{changed_by}} changed your role on {{date}}.</p>` +
          `<table class="kv">` +
          `<tr><td class="k">Was</td><td>{{old_role}}</td></tr>` +
          `<tr><td class="k">Now</td><td>{{new_role}}</td></tr></table>` +
          `<p>The change applies from your next sign-in.</p>` +
          `<a class="btn" href="{{url}}">Check your access</a>` +
          `<p class="muted">Tell us if something you need is missing — or if you can see something you shouldn't.</p>`,
      },
      ja: {
        subject: "権限が変更されました",
        body:
          `<p class="lead">{{recipient}} さん</p>` +
          `<p>{{changed_by}} さんが {{date}} に権限を変更しました。</p>` +
          `<table class="kv">` +
          `<tr><td class="k">変更前</td><td>{{old_role}}</td></tr>` +
          `<tr><td class="k">現在</td><td>{{new_role}}</td></tr></table>` +
          `<p>変更後の権限は次回ログインから適用されます。</p>` +
          `<a class="btn" href="{{url}}">自分の権限を確認する</a>` +
          `<p class="muted">必要な画面が見えない場合、または見えてはいけない画面が見える場合はお知らせください。</p>`,
      },
      zh: {
        subject: "您的权限已变更",
        body:
          `<p class="lead">{{recipient}} 您好，</p>` +
          `<p>{{changed_by}} 于 {{date}} 变更了您的权限。</p>` +
          `<table class="kv">` +
          `<tr><td class="k">此前</td><td>{{old_role}}</td></tr>` +
          `<tr><td class="k">当前</td><td>{{new_role}}</td></tr></table>` +
          `<p>变更自您下次登录起生效。</p>` +
          `<a class="btn" href="{{url}}">查看我的权限</a>` +
          `<p class="muted">若所需页面看不到，或看到了不该看到的页面，请告知我们。</p>`,
      },
      th: {
        subject: "สิทธิ์การใช้งานของคุณเปลี่ยนแปลง",
        body:
          `<p class="lead">สวัสดีคุณ{{recipient}}</p>` +
          `<p>{{changed_by}} เปลี่ยนสิทธิ์ของคุณเมื่อวันที่ {{date}}</p>` +
          `<table class="kv">` +
          `<tr><td class="k">เดิม</td><td>{{old_role}}</td></tr>` +
          `<tr><td class="k">ปัจจุบัน</td><td>{{new_role}}</td></tr></table>` +
          `<p>สิทธิ์ใหม่จะมีผลตั้งแต่การเข้าสู่ระบบครั้งถัดไป</p>` +
          `<a class="btn" href="{{url}}">ตรวจสอบสิทธิ์ของฉัน</a>` +
          `<p class="muted">หากมองไม่เห็นหน้าที่ต้องใช้ หรือเห็นหน้าที่ไม่ควรเห็น กรุณาแจ้ง</p>`,
      },
      vi: {
        subject: "Quyền của bạn đã thay đổi",
        body:
          `<p class="lead">Chào {{recipient}},</p>` +
          `<p>{{changed_by}} đã đổi quyền của bạn vào ngày {{date}}.</p>` +
          `<table class="kv">` +
          `<tr><td class="k">Trước</td><td>{{old_role}}</td></tr>` +
          `<tr><td class="k">Hiện tại</td><td>{{new_role}}</td></tr></table>` +
          `<p>Thay đổi có hiệu lực từ lần đăng nhập kế tiếp.</p>` +
          `<a class="btn" href="{{url}}">Kiểm tra quyền của tôi</a>` +
          `<p class="muted">Nếu thiếu màn hình bạn cần, hoặc thấy màn hình lẽ ra không được xem, hãy báo cho chúng tôi.</p>`,
      },
    },
  },

  {
    key: "staff.offboarding",
    name: "접근 권한 해제·인수인계",
    description: "퇴사·전보로 접근이 닫힐 때. 남은 인수인계 항목을 알린다.",
    vars: vars("recipient", "end_date", "handover_items", "manager_name", "url"),
    tr: {
      ko: {
        subject: "계정 접근이 {{end_date}}에 종료됩니다",
        body:
          `<p class="lead">{{recipient}} 님, 안녕하세요.</p>` +
          `<p>{{end_date}}자로 시스템 접근 권한이 해제됩니다.</p>` +
          `<div class="box"><div class="label">인수인계가 남은 항목</div><div>{{handover_items}}</div></div>` +
          `<p>그 전에 담당 건을 넘기고 개인 파일이 남아 있으면 정리해 주세요.</p>` +
          `<a class="btn" href="{{url}}">내 담당 건 보기</a>` +
          `<p class="muted">인수인계는 {{manager_name}} 님과 상의해 주세요. 그동안 함께 일해 주셔서 감사합니다.</p>`,
      },
      en: {
        subject: "Your access ends on {{end_date}}",
        body:
          `<p class="lead">Hi {{recipient}},</p>` +
          `<p>Your system access will be removed on {{end_date}}.</p>` +
          `<div class="box"><div class="label">Still to hand over</div><div>{{handover_items}}</div></div>` +
          `<p>Before then, please pass on the cases you own and clear out any personal files.</p>` +
          `<a class="btn" href="{{url}}">See what you own</a>` +
          `<p class="muted">Talk to {{manager_name}} about the handover. Thank you for your work with us.</p>`,
      },
      ja: {
        subject: "アカウントのアクセスが {{end_date}} に終了します",
        body:
          `<p class="lead">{{recipient}} さん</p>` +
          `<p>{{end_date}} をもって、システムへのアクセス権限を解除いたします。</p>` +
          `<div class="box"><div class="label">引き継ぎが残っている項目</div><div>{{handover_items}}</div></div>` +
          `<p>それまでに担当案件を引き継ぎ、個人のファイルが残っていれば整理してください。</p>` +
          `<a class="btn" href="{{url}}">自分の担当案件を見る</a>` +
          `<p class="muted">引き継ぎについては {{manager_name}} さんとご相談ください。これまでありがとうございました。</p>`,
      },
      zh: {
        subject: "您的账户访问权限将于 {{end_date}} 终止",
        body:
          `<p class="lead">{{recipient}} 您好，</p>` +
          `<p>系统访问权限将于 {{end_date}} 解除。</p>` +
          `<div class="box"><div class="label">尚待交接事项</div><div>{{handover_items}}</div></div>` +
          `<p>请在此之前交接您负责的案件，并清理个人文件。</p>` +
          `<a class="btn" href="{{url}}">查看我负责的案件</a>` +
          `<p class="muted">交接事宜请与 {{manager_name}} 商议。感谢您一直以来的付出。</p>`,
      },
      th: {
        subject: "สิทธิ์เข้าใช้งานของคุณจะสิ้นสุดวันที่ {{end_date}}",
        body:
          `<p class="lead">สวัสดีคุณ{{recipient}}</p>` +
          `<p>สิทธิ์เข้าใช้ระบบจะถูกยกเลิกในวันที่ {{end_date}}</p>` +
          `<div class="box"><div class="label">งานที่ยังต้องส่งมอบ</div><div>{{handover_items}}</div></div>` +
          `<p>ก่อนถึงวันดังกล่าว กรุณาส่งมอบงานที่รับผิดชอบและจัดการไฟล์ส่วนตัวที่ค้างอยู่</p>` +
          `<a class="btn" href="{{url}}">ดูงานที่ฉันรับผิดชอบ</a>` +
          `<p class="muted">เรื่องการส่งมอบงาน ปรึกษา {{manager_name}} ได้ ขอบคุณสำหรับการทำงานร่วมกันที่ผ่านมา</p>`,
      },
      vi: {
        subject: "Quyền truy cập của bạn kết thúc ngày {{end_date}}",
        body:
          `<p class="lead">Chào {{recipient}},</p>` +
          `<p>Quyền truy cập hệ thống sẽ được gỡ vào ngày {{end_date}}.</p>` +
          `<div class="box"><div class="label">Còn phải bàn giao</div><div>{{handover_items}}</div></div>` +
          `<p>Trước ngày đó, hãy bàn giao các hồ sơ bạn phụ trách và dọn các tệp cá nhân còn lại.</p>` +
          `<a class="btn" href="{{url}}">Xem hồ sơ tôi phụ trách</a>` +
          `<p class="muted">Về việc bàn giao, hãy trao đổi với {{manager_name}}. Cảm ơn bạn đã đồng hành.</p>`,
      },
    },
  },

  {
    key: "staff.approval_request",
    name: "승인 요청",
    description: "할인·환불·수선비 등 승인 요청. 금액과 요청자를 앞에 둔다.",
    vars: vars("recipient", "requester", "request_type", "amount", "reason", "ref", "url"),
    tr: {
      ko: {
        subject: "[승인 요청] {{request_type}} {{amount}}",
        body:
          `<p class="lead">{{requester}} 님이 승인을 요청했습니다.</p>` +
          `<table class="kv">` +
          `<tr><td class="k">종류</td><td>{{request_type}}</td></tr>` +
          `<tr><td class="k">금액</td><td>{{amount}}</td></tr>` +
          `<tr><td class="k">관련 건</td><td>{{ref}}</td></tr></table>` +
          `<div class="box"><div class="label">사유</div><div>{{reason}}</div></div>` +
          `<a class="btn" href="{{url}}">승인 또는 반려하기</a>` +
          `<p class="muted">결정하면 요청자에게 자동으로 알림이 갑니다.</p>`,
      },
      en: {
        subject: "[Approval] {{request_type}} {{amount}}",
        body:
          `<p class="lead">{{requester}} has requested your approval.</p>` +
          `<table class="kv">` +
          `<tr><td class="k">Type</td><td>{{request_type}}</td></tr>` +
          `<tr><td class="k">Amount</td><td>{{amount}}</td></tr>` +
          `<tr><td class="k">Related to</td><td>{{ref}}</td></tr></table>` +
          `<div class="box"><div class="label">Reason</div><div>{{reason}}</div></div>` +
          `<a class="btn" href="{{url}}">Approve or decline</a>` +
          `<p class="muted">The requester is notified automatically once you decide.</p>`,
      },
      ja: {
        subject: "【承認依頼】{{request_type}} {{amount}}",
        body:
          `<p class="lead">{{requester}} さんから承認の依頼が届いています。</p>` +
          `<table class="kv">` +
          `<tr><td class="k">種別</td><td>{{request_type}}</td></tr>` +
          `<tr><td class="k">金額</td><td>{{amount}}</td></tr>` +
          `<tr><td class="k">関連案件</td><td>{{ref}}</td></tr></table>` +
          `<div class="box"><div class="label">理由</div><div>{{reason}}</div></div>` +
          `<a class="btn" href="{{url}}">承認または却下する</a>` +
          `<p class="muted">判断すると、依頼者へ自動で通知が届きます。</p>`,
      },
      zh: {
        subject: "【审批】{{request_type}} {{amount}}",
        body:
          `<p class="lead">{{requester}} 提交了审批申请。</p>` +
          `<table class="kv">` +
          `<tr><td class="k">类型</td><td>{{request_type}}</td></tr>` +
          `<tr><td class="k">金额</td><td>{{amount}}</td></tr>` +
          `<tr><td class="k">关联单据</td><td>{{ref}}</td></tr></table>` +
          `<div class="box"><div class="label">事由</div><div>{{reason}}</div></div>` +
          `<a class="btn" href="{{url}}">通过或驳回</a>` +
          `<p class="muted">您作出决定后，系统会自动通知申请人。</p>`,
      },
      th: {
        subject: "[ขออนุมัติ] {{request_type}} {{amount}}",
        body:
          `<p class="lead">{{requester}} ขออนุมัติจากคุณ</p>` +
          `<table class="kv">` +
          `<tr><td class="k">ประเภท</td><td>{{request_type}}</td></tr>` +
          `<tr><td class="k">จำนวนเงิน</td><td>{{amount}}</td></tr>` +
          `<tr><td class="k">เรื่องที่เกี่ยวข้อง</td><td>{{ref}}</td></tr></table>` +
          `<div class="box"><div class="label">เหตุผล</div><div>{{reason}}</div></div>` +
          `<a class="btn" href="{{url}}">อนุมัติหรือปฏิเสธ</a>` +
          `<p class="muted">เมื่อคุณตัดสินใจแล้ว ระบบจะแจ้งผู้ขอโดยอัตโนมัติ</p>`,
      },
      vi: {
        subject: "[Phê duyệt] {{request_type}} {{amount}}",
        body:
          `<p class="lead">{{requester}} đề nghị bạn phê duyệt.</p>` +
          `<table class="kv">` +
          `<tr><td class="k">Loại</td><td>{{request_type}}</td></tr>` +
          `<tr><td class="k">Số tiền</td><td>{{amount}}</td></tr>` +
          `<tr><td class="k">Liên quan đến</td><td>{{ref}}</td></tr></table>` +
          `<div class="box"><div class="label">Lý do</div><div>{{reason}}</div></div>` +
          `<a class="btn" href="{{url}}">Duyệt hoặc từ chối</a>` +
          `<p class="muted">Sau khi bạn quyết định, người đề nghị sẽ được thông báo tự động.</p>`,
      },
    },
  },

  {
    key: "staff.approval_decision",
    name: "승인 결과 통보",
    description: "요청자에게 가는 결과. 반려면 사유가 반드시 있어야 한다.",
    vars: vars("recipient", "request_type", "amount", "decision", "approver", "note", "url"),
    tr: {
      ko: {
        subject: "[{{decision}}] {{request_type}} {{amount}}",
        body:
          `<p class="lead">{{recipient}} 님, 요청하신 건의 결과입니다.</p>` +
          `<table class="kv">` +
          `<tr><td class="k">종류</td><td>{{request_type}}</td></tr>` +
          `<tr><td class="k">금액</td><td>{{amount}}</td></tr>` +
          `<tr><td class="k">결과</td><td>{{decision}}</td></tr>` +
          `<tr><td class="k">결정</td><td>{{approver}}</td></tr></table>` +
          `<div class="box"><div class="label">의견</div><div>{{note}}</div></div>` +
          `<a class="btn" href="{{url}}">상세 보기</a>`,
      },
      en: {
        subject: "[{{decision}}] {{request_type}} {{amount}}",
        body:
          `<p class="lead">Hi {{recipient}}, here's the outcome of your request.</p>` +
          `<table class="kv">` +
          `<tr><td class="k">Type</td><td>{{request_type}}</td></tr>` +
          `<tr><td class="k">Amount</td><td>{{amount}}</td></tr>` +
          `<tr><td class="k">Outcome</td><td>{{decision}}</td></tr>` +
          `<tr><td class="k">Decided by</td><td>{{approver}}</td></tr></table>` +
          `<div class="box"><div class="label">Comment</div><div>{{note}}</div></div>` +
          `<a class="btn" href="{{url}}">Open the request</a>`,
      },
      ja: {
        subject: "【{{decision}}】{{request_type}} {{amount}}",
        body:
          `<p class="lead">{{recipient}} さん、ご依頼の件の結果です。</p>` +
          `<table class="kv">` +
          `<tr><td class="k">種別</td><td>{{request_type}}</td></tr>` +
          `<tr><td class="k">金額</td><td>{{amount}}</td></tr>` +
          `<tr><td class="k">結果</td><td>{{decision}}</td></tr>` +
          `<tr><td class="k">決裁者</td><td>{{approver}}</td></tr></table>` +
          `<div class="box"><div class="label">コメント</div><div>{{note}}</div></div>` +
          `<a class="btn" href="{{url}}">詳細を見る</a>`,
      },
      zh: {
        subject: "【{{decision}}】{{request_type}} {{amount}}",
        body:
          `<p class="lead">{{recipient}} 您好，这是您申请的结果。</p>` +
          `<table class="kv">` +
          `<tr><td class="k">类型</td><td>{{request_type}}</td></tr>` +
          `<tr><td class="k">金额</td><td>{{amount}}</td></tr>` +
          `<tr><td class="k">结果</td><td>{{decision}}</td></tr>` +
          `<tr><td class="k">决定人</td><td>{{approver}}</td></tr></table>` +
          `<div class="box"><div class="label">意见</div><div>{{note}}</div></div>` +
          `<a class="btn" href="{{url}}">查看详情</a>`,
      },
      th: {
        subject: "[{{decision}}] {{request_type}} {{amount}}",
        body:
          `<p class="lead">คุณ{{recipient}} นี่คือผลของคำขอที่คุณยื่น</p>` +
          `<table class="kv">` +
          `<tr><td class="k">ประเภท</td><td>{{request_type}}</td></tr>` +
          `<tr><td class="k">จำนวนเงิน</td><td>{{amount}}</td></tr>` +
          `<tr><td class="k">ผล</td><td>{{decision}}</td></tr>` +
          `<tr><td class="k">ผู้ตัดสิน</td><td>{{approver}}</td></tr></table>` +
          `<div class="box"><div class="label">ความเห็น</div><div>{{note}}</div></div>` +
          `<a class="btn" href="{{url}}">ดูรายละเอียด</a>`,
      },
      vi: {
        subject: "[{{decision}}] {{request_type}} {{amount}}",
        body:
          `<p class="lead">Chào {{recipient}}, đây là kết quả đề nghị của bạn.</p>` +
          `<table class="kv">` +
          `<tr><td class="k">Loại</td><td>{{request_type}}</td></tr>` +
          `<tr><td class="k">Số tiền</td><td>{{amount}}</td></tr>` +
          `<tr><td class="k">Kết quả</td><td>{{decision}}</td></tr>` +
          `<tr><td class="k">Người quyết định</td><td>{{approver}}</td></tr></table>` +
          `<div class="box"><div class="label">Ý kiến</div><div>{{note}}</div></div>` +
          `<a class="btn" href="{{url}}">Xem chi tiết</a>`,
      },
    },
  },
];
