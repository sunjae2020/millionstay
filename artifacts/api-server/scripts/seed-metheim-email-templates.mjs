/**
 * seed-metheim-email-templates.mjs
 *
 * Metheim 인스턴스의 업무 이메일 템플릿 카탈로그를 document_templates /
 * document_template_translations 에 시드한다. 정본 = docs/EMAIL_TEMPLATE_SPEC.md
 *
 * 규칙 (스펙 §1·§2·§3):
 *   - key       `<domain>.<event>` — 점 1개. kind 는 키에 넣지 않는다.
 *   - category  수신자 그룹 slug: common | customer | owner | partner | host | staff | marketing
 *   - locale    ko(원본) / en / ja / zh / th / vi — 6개국어 전부 채운다
 *   - body      셸(renderEmailShell) 안쪽 조각만. <!DOCTYPE>·<style>·색 리터럴·로고·
 *               브랜드명 금지. 셸이 제공하는 클래스(lead/box/btn/muted/kv)를 쓴다.
 *
 * 한국어 본문은 humanize-korean 을 통과한 문안이다 — 영어에서 재기계번역 금지.
 * 회사명·로고·주소·문의처는 렌더 시점에 Settings → Organisation 에서 해석되므로
 * 문안에 절대 넣지 않는다.
 *
 * 멱등: (kind, key) 로 upsert, 로케일은 (template_id, locale) 로 upsert.
 * 기존 문안을 덮어쓰므로 운영자가 Studio 에서 수정한 내용이 있으면 사라진다.
 * → 재실행 전 확인. KEEP_EXISTING=1 이면 이미 있는 키는 건너뛴다.
 *
 * Usage:  DATABASE_URL=<metheim> node scripts/seed-metheim-email-templates.mjs
 *         DATABASE_URL=<metheim> ONLY=common node scripts/seed-metheim-email-templates.mjs
 *         DATABASE_URL=<metheim> DRY_RUN=1 node scripts/seed-metheim-email-templates.mjs
 */
import pg from "pg";

const { Pool } = pg;
const LOCALES = ["ko", "en", "ja", "zh", "th", "vi"];

// ─────────────────────────────────────────────────────────────────────────────
// 공용 변수 세트
// ─────────────────────────────────────────────────────────────────────────────
const V = {
  recipient: { type: "string", required: true },   // 수신자 이름
  brand:     { type: "string" },                   // 테넌트 상호 (셸이 채움)
  url:       { type: "url" },
  ref:       { type: "string" },
  date:      { type: "date" },
  amount:    { type: "string" },
};

const vars = (...names) => Object.fromEntries(names.map((n) => [n, V[n] ?? { type: "string" }]));

// ─────────────────────────────────────────────────────────────────────────────
// common — 공통 (전 수신자 공용)
// ─────────────────────────────────────────────────────────────────────────────
const COMMON = [
  {
    key: "account.password_reset",
    name: "비밀번호 재설정",
    description: "비밀번호 재설정을 요청했을 때 보내는 링크 메일. 유효시간을 반드시 명시한다.",
    vars: vars("recipient", "url", "expiry_minutes", "product_label"),
    tr: {
      ko: {
        subject: "비밀번호 재설정 안내",
        body:
          `<p class="lead">{{recipient}} 님, 안녕하세요.</p>` +
          `<p>{{product_label}} 계정의 비밀번호를 새로 설정해 달라는 요청을 받았습니다. 아래 버튼을 눌러 진행해 주세요.</p>` +
          `<a class="btn" href="{{url}}">비밀번호 재설정하기</a>` +
          `<p class="muted">이 링크는 {{expiry_minutes}}분 뒤에 만료됩니다. 요청하신 적이 없다면 이 메일은 그냥 두셔도 됩니다. 비밀번호는 바뀌지 않습니다.</p>` +
          `<p class="muted">버튼이 동작하지 않으면 아래 주소를 브라우저에 붙여 넣어 주세요.<br/>{{url}}</p>`,
      },
      en: {
        subject: "Reset your password",
        body:
          `<p class="lead">Hi {{recipient}},</p>` +
          `<p>We received a request to set a new password for your {{product_label}} account. Use the button below to continue.</p>` +
          `<a class="btn" href="{{url}}">Reset my password</a>` +
          `<p class="muted">The link expires in {{expiry_minutes}} minutes. If you didn't ask for this, you can ignore this email — your password stays as it is.</p>` +
          `<p class="muted">If the button doesn't work, paste this address into your browser:<br/>{{url}}</p>`,
      },
      ja: {
        subject: "パスワード再設定のご案内",
        body:
          `<p class="lead">{{recipient}} 様</p>` +
          `<p>{{product_label}} アカウントのパスワード再設定のご依頼を承りました。下のボタンからお進みください。</p>` +
          `<a class="btn" href="{{url}}">パスワードを再設定する</a>` +
          `<p class="muted">このリンクは {{expiry_minutes}} 分で期限切れとなります。お心当たりがない場合は、このメールを破棄していただいて構いません。パスワードは変更されません。</p>` +
          `<p class="muted">ボタンが動作しない場合は、次のアドレスをブラウザに貼り付けてください。<br/>{{url}}</p>`,
      },
      zh: {
        subject: "重置密码",
        body:
          `<p class="lead">{{recipient}} 您好，</p>` +
          `<p>我们收到了为您的 {{product_label}} 账户重新设置密码的请求。请点击下方按钮继续。</p>` +
          `<a class="btn" href="{{url}}">重置密码</a>` +
          `<p class="muted">该链接将在 {{expiry_minutes}} 分钟后失效。如果这不是您本人的操作，请忽略本邮件，您的密码不会有任何变化。</p>` +
          `<p class="muted">如果按钮无法点击，请将以下地址复制到浏览器中打开：<br/>{{url}}</p>`,
      },
      th: {
        subject: "ตั้งรหัสผ่านใหม่",
        body:
          `<p class="lead">เรียน คุณ{{recipient}}</p>` +
          `<p>เราได้รับคำขอตั้งรหัสผ่านใหม่สำหรับบัญชี {{product_label}} ของท่าน กรุณากดปุ่มด้านล่างเพื่อดำเนินการต่อ</p>` +
          `<a class="btn" href="{{url}}">ตั้งรหัสผ่านใหม่</a>` +
          `<p class="muted">ลิงก์นี้จะหมดอายุใน {{expiry_minutes}} นาที หากท่านไม่ได้เป็นผู้ส่งคำขอ สามารถละเว้นอีเมลฉบับนี้ได้ รหัสผ่านของท่านจะไม่เปลี่ยนแปลง</p>` +
          `<p class="muted">หากกดปุ่มไม่ได้ กรุณาคัดลอกที่อยู่นี้ไปวางในเบราว์เซอร์<br/>{{url}}</p>`,
      },
      vi: {
        subject: "Đặt lại mật khẩu",
        body:
          `<p class="lead">Kính gửi {{recipient}},</p>` +
          `<p>Chúng tôi đã nhận được yêu cầu đặt lại mật khẩu cho tài khoản {{product_label}} của Quý khách. Vui lòng nhấn nút bên dưới để tiếp tục.</p>` +
          `<a class="btn" href="{{url}}">Đặt lại mật khẩu</a>` +
          `<p class="muted">Liên kết sẽ hết hạn sau {{expiry_minutes}} phút. Nếu Quý khách không gửi yêu cầu này, xin bỏ qua email — mật khẩu vẫn được giữ nguyên.</p>` +
          `<p class="muted">Nếu nút không hoạt động, vui lòng dán địa chỉ sau vào trình duyệt:<br/>{{url}}</p>`,
      },
    },
  },

  {
    key: "account.welcome",
    name: "계정 생성 완료",
    description: "계정이 만들어진 직후 보내는 환영 메일. 로그인 경로와 첫 할 일을 안내한다.",
    vars: vars("recipient", "url", "login_id", "product_label"),
    tr: {
      ko: {
        subject: "계정이 개설되었습니다",
        body:
          `<p class="lead">{{recipient}} 님, 환영합니다.</p>` +
          `<p>{{product_label}} 계정이 개설됐습니다. 아래 정보로 로그인하실 수 있습니다.</p>` +
          `<table class="kv"><tr><td class="k">아이디</td><td>{{login_id}}</td></tr></table>` +
          `<a class="btn" href="{{url}}">로그인하기</a>` +
          `<p>처음 로그인하시면 비밀번호를 바꾸고 연락처를 확인해 주세요. 이후 계약·청구·문의 내역을 한곳에서 보실 수 있습니다.</p>` +
          `<p class="muted">계정을 신청하신 적이 없다면 알려 주세요. 바로 확인하겠습니다.</p>`,
      },
      en: {
        subject: "Your account is ready",
        body:
          `<p class="lead">Welcome, {{recipient}}.</p>` +
          `<p>Your {{product_label}} account has been created. You can sign in with the details below.</p>` +
          `<table class="kv"><tr><td class="k">Sign-in ID</td><td>{{login_id}}</td></tr></table>` +
          `<a class="btn" href="{{url}}">Sign in</a>` +
          `<p>On your first visit, please change your password and check your contact details. From then on your agreements, invoices and enquiries all live in one place.</p>` +
          `<p class="muted">If you didn't request an account, let us know and we'll look into it straight away.</p>`,
      },
      ja: {
        subject: "アカウントを開設しました",
        body:
          `<p class="lead">{{recipient}} 様、ようこそ。</p>` +
          `<p>{{product_label}} のアカウントを開設いたしました。下記の情報でログインいただけます。</p>` +
          `<table class="kv"><tr><td class="k">ログインID</td><td>{{login_id}}</td></tr></table>` +
          `<a class="btn" href="{{url}}">ログインする</a>` +
          `<p>初回ログイン時にパスワードのご変更と連絡先のご確認をお願いいたします。以降は契約・請求・お問い合わせの履歴をまとめてご覧いただけます。</p>` +
          `<p class="muted">お申し込みにお心当たりがない場合は、お手数ですがご一報ください。すぐに確認いたします。</p>`,
      },
      zh: {
        subject: "账户已开通",
        body:
          `<p class="lead">{{recipient}} 您好，欢迎您。</p>` +
          `<p>您的 {{product_label}} 账户已开通，可使用以下信息登录。</p>` +
          `<table class="kv"><tr><td class="k">登录账号</td><td>{{login_id}}</td></tr></table>` +
          `<a class="btn" href="{{url}}">登录</a>` +
          `<p>首次登录后，请修改密码并核对联系方式。之后您可以在同一处查看合同、账单和咨询记录。</p>` +
          `<p class="muted">如果您并未申请账户，请告知我们，我们会立即核实。</p>`,
      },
      th: {
        subject: "เปิดบัญชีเรียบร้อยแล้ว",
        body:
          `<p class="lead">ยินดีต้อนรับ คุณ{{recipient}}</p>` +
          `<p>บัญชี {{product_label}} ของท่านเปิดใช้งานแล้ว สามารถเข้าสู่ระบบด้วยข้อมูลด้านล่าง</p>` +
          `<table class="kv"><tr><td class="k">ชื่อผู้ใช้</td><td>{{login_id}}</td></tr></table>` +
          `<a class="btn" href="{{url}}">เข้าสู่ระบบ</a>` +
          `<p>เมื่อเข้าสู่ระบบครั้งแรก กรุณาเปลี่ยนรหัสผ่านและตรวจสอบข้อมูลติดต่อ จากนั้นท่านจะดูสัญญา ใบแจ้งหนี้ และประวัติการติดต่อได้ในที่เดียว</p>` +
          `<p class="muted">หากท่านไม่ได้สมัครบัญชีนี้ กรุณาแจ้งให้เราทราบ เราจะตรวจสอบทันที</p>`,
      },
      vi: {
        subject: "Tài khoản đã được mở",
        body:
          `<p class="lead">Xin chào {{recipient}},</p>` +
          `<p>Tài khoản {{product_label}} của Quý khách đã được mở. Quý khách có thể đăng nhập bằng thông tin dưới đây.</p>` +
          `<table class="kv"><tr><td class="k">Tên đăng nhập</td><td>{{login_id}}</td></tr></table>` +
          `<a class="btn" href="{{url}}">Đăng nhập</a>` +
          `<p>Trong lần đăng nhập đầu tiên, xin Quý khách đổi mật khẩu và kiểm tra thông tin liên hệ. Sau đó, hợp đồng, hóa đơn và lịch sử liên hệ đều nằm ở cùng một nơi.</p>` +
          `<p class="muted">Nếu Quý khách không đăng ký tài khoản này, xin báo cho chúng tôi để kiểm tra ngay.</p>`,
      },
    },
  },
  {
    key: "account.email_verify",
    name: "이메일 인증",
    description: "가입·주소 변경 시 본인 확인용 인증 링크.",
    vars: vars("recipient", "url", "expiry_minutes"),
    tr: {
      ko: {
        subject: "이메일 주소를 확인해 주세요",
        body:
          `<p class="lead">{{recipient}} 님, 안녕하세요.</p>` +
          `<p>이 주소가 본인 것이 맞는지 확인이 필요합니다. 아래 버튼을 눌러 주시면 인증이 끝납니다.</p>` +
          `<a class="btn" href="{{url}}">이메일 인증하기</a>` +
          `<p class="muted">링크는 {{expiry_minutes}}분간 유효합니다. 인증을 마쳐야 알림과 청구 안내를 받으실 수 있습니다.</p>`,
      },
      en: {
        subject: "Confirm your email address",
        body:
          `<p class="lead">Hi {{recipient}},</p>` +
          `<p>We need to check that this address belongs to you. One tap on the button below finishes it.</p>` +
          `<a class="btn" href="{{url}}">Confirm my email</a>` +
          `<p class="muted">The link is valid for {{expiry_minutes}} minutes. Notices and billing emails can only reach you once this is confirmed.</p>`,
      },
      ja: {
        subject: "メールアドレスのご確認",
        body:
          `<p class="lead">{{recipient}} 様</p>` +
          `<p>このアドレスがご本人のものかどうか確認させてください。下のボタンを押していただければ完了します。</p>` +
          `<a class="btn" href="{{url}}">メールアドレスを確認する</a>` +
          `<p class="muted">リンクの有効期限は {{expiry_minutes}} 分です。確認が済むと、各種お知らせやご請求のご案内をお届けできるようになります。</p>`,
      },
      zh: {
        subject: "请确认您的邮箱地址",
        body:
          `<p class="lead">{{recipient}} 您好，</p>` +
          `<p>我们需要确认这个邮箱是否为您本人所有。点击下方按钮即可完成。</p>` +
          `<a class="btn" href="{{url}}">确认邮箱</a>` +
          `<p class="muted">链接有效期为 {{expiry_minutes}} 分钟。完成确认后，我们才能向您发送通知和账单提醒。</p>`,
      },
      th: {
        subject: "กรุณายืนยันอีเมลของท่าน",
        body:
          `<p class="lead">เรียน คุณ{{recipient}}</p>` +
          `<p>เราต้องการยืนยันว่าอีเมลนี้เป็นของท่านจริง เพียงกดปุ่มด้านล่างก็เสร็จสิ้น</p>` +
          `<a class="btn" href="{{url}}">ยืนยันอีเมล</a>` +
          `<p class="muted">ลิงก์มีอายุ {{expiry_minutes}} นาที เมื่อยืนยันแล้ว เราจึงจะส่งประกาศและใบแจ้งหนี้ถึงท่านได้</p>`,
      },
      vi: {
        subject: "Vui lòng xác nhận địa chỉ email",
        body:
          `<p class="lead">Kính gửi {{recipient}},</p>` +
          `<p>Chúng tôi cần xác nhận địa chỉ này đúng là của Quý khách. Chỉ cần nhấn nút bên dưới là xong.</p>` +
          `<a class="btn" href="{{url}}">Xác nhận email</a>` +
          `<p class="muted">Liên kết có hiệu lực trong {{expiry_minutes}} phút. Sau khi xác nhận, chúng tôi mới có thể gửi thông báo và hóa đơn đến Quý khách.</p>`,
      },
    },
  },

  {
    key: "account.login_new_device",
    name: "새 기기 로그인 알림",
    description: "평소와 다른 기기·위치에서 로그인했을 때 보내는 보안 알림.",
    vars: vars("recipient", "date", "device", "location", "url"),
    tr: {
      ko: {
        subject: "새로운 기기에서 로그인되었습니다",
        body:
          `<p class="lead">{{recipient}} 님, 안녕하세요.</p>` +
          `<p>평소와 다른 기기에서 계정에 접속한 기록이 있어 알려 드립니다.</p>` +
          `<table class="kv">` +
          `<tr><td class="k">일시</td><td>{{date}}</td></tr>` +
          `<tr><td class="k">기기</td><td>{{device}}</td></tr>` +
          `<tr><td class="k">접속 위치</td><td>{{location}}</td></tr></table>` +
          `<p>본인이 하신 접속이라면 따로 하실 일은 없습니다.</p>` +
          `<p class="muted">기억에 없는 접속이라면 지금 바로 비밀번호를 바꾸고 저희에게 알려 주세요.</p>` +
          `<a class="btn" href="{{url}}">비밀번호 변경하기</a>`,
      },
      en: {
        subject: "New sign-in to your account",
        body:
          `<p class="lead">Hi {{recipient}},</p>` +
          `<p>Your account was accessed from a device we haven't seen before, so we wanted to let you know.</p>` +
          `<table class="kv">` +
          `<tr><td class="k">When</td><td>{{date}}</td></tr>` +
          `<tr><td class="k">Device</td><td>{{device}}</td></tr>` +
          `<tr><td class="k">Location</td><td>{{location}}</td></tr></table>` +
          `<p>If this was you, there's nothing to do.</p>` +
          `<p class="muted">If you don't recognise it, change your password now and tell us.</p>` +
          `<a class="btn" href="{{url}}">Change my password</a>`,
      },
      ja: {
        subject: "新しい端末からのログインがありました",
        body:
          `<p class="lead">{{recipient}} 様</p>` +
          `<p>普段とは異なる端末からアカウントへのアクセスがありましたので、お知らせいたします。</p>` +
          `<table class="kv">` +
          `<tr><td class="k">日時</td><td>{{date}}</td></tr>` +
          `<tr><td class="k">端末</td><td>{{device}}</td></tr>` +
          `<tr><td class="k">接続元</td><td>{{location}}</td></tr></table>` +
          `<p>お客様ご自身の操作であれば、特にご対応は不要です。</p>` +
          `<p class="muted">お心当たりがない場合は、直ちにパスワードを変更のうえ、当社までご連絡ください。</p>` +
          `<a class="btn" href="{{url}}">パスワードを変更する</a>`,
      },
      zh: {
        subject: "有新设备登录了您的账户",
        body:
          `<p class="lead">{{recipient}} 您好，</p>` +
          `<p>我们发现有一台此前未使用过的设备登录了您的账户，特此告知。</p>` +
          `<table class="kv">` +
          `<tr><td class="k">时间</td><td>{{date}}</td></tr>` +
          `<tr><td class="k">设备</td><td>{{device}}</td></tr>` +
          `<tr><td class="k">登录地点</td><td>{{location}}</td></tr></table>` +
          `<p>如果是您本人操作，无需任何处理。</p>` +
          `<p class="muted">如果您对此没有印象，请立即修改密码并联系我们。</p>` +
          `<a class="btn" href="{{url}}">修改密码</a>`,
      },
      th: {
        subject: "มีการเข้าสู่ระบบจากอุปกรณ์ใหม่",
        body:
          `<p class="lead">เรียน คุณ{{recipient}}</p>` +
          `<p>มีการเข้าใช้บัญชีของท่านจากอุปกรณ์ที่ไม่เคยใช้มาก่อน เราจึงแจ้งให้ทราบ</p>` +
          `<table class="kv">` +
          `<tr><td class="k">เวลา</td><td>{{date}}</td></tr>` +
          `<tr><td class="k">อุปกรณ์</td><td>{{device}}</td></tr>` +
          `<tr><td class="k">ตำแหน่ง</td><td>{{location}}</td></tr></table>` +
          `<p>หากเป็นการเข้าใช้ของท่านเอง ไม่ต้องดำเนินการใด ๆ</p>` +
          `<p class="muted">หากท่านไม่ได้เป็นผู้เข้าใช้ กรุณาเปลี่ยนรหัสผ่านทันทีและแจ้งให้เราทราบ</p>` +
          `<a class="btn" href="{{url}}">เปลี่ยนรหัสผ่าน</a>`,
      },
      vi: {
        subject: "Có đăng nhập từ thiết bị mới",
        body:
          `<p class="lead">Kính gửi {{recipient}},</p>` +
          `<p>Tài khoản của Quý khách vừa được truy cập từ một thiết bị lạ, nên chúng tôi xin thông báo.</p>` +
          `<table class="kv">` +
          `<tr><td class="k">Thời gian</td><td>{{date}}</td></tr>` +
          `<tr><td class="k">Thiết bị</td><td>{{device}}</td></tr>` +
          `<tr><td class="k">Vị trí</td><td>{{location}}</td></tr></table>` +
          `<p>Nếu đó là Quý khách, không cần làm gì thêm.</p>` +
          `<p class="muted">Nếu Quý khách không nhận ra lần truy cập này, xin đổi mật khẩu ngay và báo cho chúng tôi.</p>` +
          `<a class="btn" href="{{url}}">Đổi mật khẩu</a>`,
      },
    },
  },

  {
    key: "account.privacy_update",
    name: "개인정보처리방침·약관 변경 고지",
    description: "방침이나 약관을 개정했을 때 시행일 전에 보내는 고지 메일.",
    vars: vars("recipient", "url", "date", "summary"),
    tr: {
      ko: {
        subject: "개인정보처리방침 변경 안내",
        body:
          `<p class="lead">{{recipient}} 님, 안녕하세요.</p>` +
          `<p>개인정보처리방침과 이용약관 일부를 변경했습니다. 바뀐 내용은 {{date}}부터 적용됩니다.</p>` +
          `<div class="box"><div class="label">주요 변경 사항</div><div>{{summary}}</div></div>` +
          `<a class="btn" href="{{url}}">전문 보기</a>` +
          `<p class="muted">변경 내용에 동의하지 않으시면 시행일 전에 알려 주세요. 이용 중단 절차를 안내해 드리겠습니다.</p>`,
      },
      en: {
        subject: "Changes to our privacy policy",
        body:
          `<p class="lead">Hi {{recipient}},</p>` +
          `<p>We've revised parts of our privacy policy and terms of use. The changes take effect on {{date}}.</p>` +
          `<div class="box"><div class="label">What changed</div><div>{{summary}}</div></div>` +
          `<a class="btn" href="{{url}}">Read the full text</a>` +
          `<p class="muted">If you'd rather not accept the changes, tell us before the effective date and we'll walk you through closing your account.</p>`,
      },
      ja: {
        subject: "個人情報保護方針の変更について",
        body:
          `<p class="lead">{{recipient}} 様</p>` +
          `<p>個人情報保護方針および利用規約の一部を改定いたしました。変更内容は {{date}} より適用されます。</p>` +
          `<div class="box"><div class="label">主な変更点</div><div>{{summary}}</div></div>` +
          `<a class="btn" href="{{url}}">全文を確認する</a>` +
          `<p class="muted">変更内容にご同意いただけない場合は、適用日までにご連絡ください。ご解約の手続きをご案内いたします。</p>`,
      },
      zh: {
        subject: "隐私政策变更通知",
        body:
          `<p class="lead">{{recipient}} 您好，</p>` +
          `<p>我们对隐私政策和使用条款作了部分修订，变更内容自 {{date}} 起生效。</p>` +
          `<div class="box"><div class="label">主要变更</div><div>{{summary}}</div></div>` +
          `<a class="btn" href="{{url}}">查看全文</a>` +
          `<p class="muted">如果您不同意变更内容，请在生效日前告知我们，我们会为您说明终止使用的流程。</p>`,
      },
      th: {
        subject: "แจ้งการเปลี่ยนแปลงนโยบายความเป็นส่วนตัว",
        body:
          `<p class="lead">เรียน คุณ{{recipient}}</p>` +
          `<p>เราได้ปรับปรุงนโยบายความเป็นส่วนตัวและข้อกำหนดการใช้งานบางส่วน โดยจะมีผลตั้งแต่วันที่ {{date}}</p>` +
          `<div class="box"><div class="label">สาระสำคัญที่เปลี่ยนแปลง</div><div>{{summary}}</div></div>` +
          `<a class="btn" href="{{url}}">อ่านฉบับเต็ม</a>` +
          `<p class="muted">หากท่านไม่ประสงค์จะยอมรับการเปลี่ยนแปลง กรุณาแจ้งก่อนวันมีผลบังคับใช้ เราจะชี้แจงขั้นตอนการยุติการใช้บริการให้ทราบ</p>`,
      },
      vi: {
        subject: "Thông báo thay đổi chính sách bảo mật",
        body:
          `<p class="lead">Kính gửi {{recipient}},</p>` +
          `<p>Chúng tôi đã sửa đổi một phần chính sách bảo mật và điều khoản sử dụng. Nội dung mới có hiệu lực từ ngày {{date}}.</p>` +
          `<div class="box"><div class="label">Những thay đổi chính</div><div>{{summary}}</div></div>` +
          `<a class="btn" href="{{url}}">Xem toàn văn</a>` +
          `<p class="muted">Nếu Quý khách không đồng ý với thay đổi, xin báo trước ngày hiệu lực để chúng tôi hướng dẫn thủ tục ngừng sử dụng.</p>`,
      },
    },
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// 카탈로그 조립 — 카테고리별 묶음
// ─────────────────────────────────────────────────────────────────────────────
const CATALOGUE = [
  ...COMMON.map((t) => ({ ...t, kind: "email", category: "common" })),
];

// ─────────────────────────────────────────────────────────────────────────────
// 시드 실행
// ─────────────────────────────────────────────────────────────────────────────
function validate(rows) {
  const problems = [];
  const seen = new Set();
  const BANNED = /<!DOCTYPE|<style|#[0-9a-fA-F]{6}\b|MillionStay|Metheim|<img/i;

  for (const t of rows) {
    const id = `${t.kind}/${t.key}`;
    if (seen.has(id)) problems.push(`${id}: 중복 키`);
    seen.add(id);
    if (!/^[a-z][a-z0-9_]*\.[a-z][a-z0-9_]*$/.test(t.key)) {
      problems.push(`${id}: 키가 <domain>.<event> 형식이 아님`);
    }
    for (const loc of LOCALES) {
      const tr = t.tr[loc];
      if (!tr?.subject?.trim() || !tr?.body?.trim()) {
        problems.push(`${id}: ${loc} 로케일 누락`);
        continue;
      }
      if (BANNED.test(tr.body)) {
        problems.push(`${id}: ${loc} 본문에 셸이 소유해야 할 요소(DOCTYPE/style/색/로고/브랜드명)가 있음`);
      }
    }
  }
  return problems;
}

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL 이 필요합니다");

  const only = process.env.ONLY?.trim();
  const rows = only ? CATALOGUE.filter((t) => t.category === only) : CATALOGUE;
  if (rows.length === 0) throw new Error(`대상 템플릿이 없습니다 (ONLY=${only})`);

  const problems = validate(rows);
  if (problems.length) {
    console.error("✗ 검증 실패:");
    for (const p of problems) console.error(`  - ${p}`);
    process.exit(1);
  }
  console.log(`✓ 검증 통과 — ${rows.length}개 템플릿 × ${LOCALES.length}개 로케일`);

  if (process.env.DRY_RUN) {
    for (const t of rows) console.log(`  [dry] ${t.category.padEnd(9)} ${t.kind}/${t.key}`);
    return;
  }

  const pool = new Pool({ connectionString: url, ssl: { rejectUnauthorized: false } });
  const keepExisting = !!process.env.KEEP_EXISTING;
  let created = 0, updated = 0, skipped = 0;

  try {
    for (const t of rows) {
      if (keepExisting) {
        const { rowCount } = await pool.query(
          "SELECT 1 FROM document_templates WHERE kind=$1 AND key=$2", [t.kind, t.key]);
        if (rowCount) { skipped++; console.log(`· ${t.kind}/${t.key} — 이미 존재, 건너뜀`); continue; }
      }

      const { rows: [tpl] } = await pool.query(
        `INSERT INTO document_templates (kind, key, name, description, category, variables_schema, status, version)
         VALUES ($1,$2,$3,$4,$5,$6,'published',1)
         ON CONFLICT (kind, key) DO UPDATE SET
           name=EXCLUDED.name, description=EXCLUDED.description, category=EXCLUDED.category,
           variables_schema=EXCLUDED.variables_schema, status='published', updated_at=NOW()
         RETURNING id, (xmax = 0) AS inserted`,
        [t.kind, t.key, t.name, t.description, t.category, JSON.stringify(t.vars)]);

      for (const loc of LOCALES) {
        const { subject, body } = t.tr[loc];
        await pool.query(
          `INSERT INTO document_template_translations (template_id, locale, subject, body_html)
           VALUES ($1,$2,$3,$4)
           ON CONFLICT (template_id, locale) DO UPDATE SET
             subject=EXCLUDED.subject, body_html=EXCLUDED.body_html, updated_at=NOW()`,
          [tpl.id, loc, subject, body]);
      }

      tpl.inserted ? created++ : updated++;
      console.log(`✓ ${t.category.padEnd(9)} ${t.kind}/${t.key} (#${tpl.id}) — ${LOCALES.length} 로케일`);
    }
    console.log(`\n완료 — 신규 ${created} · 갱신 ${updated} · 건너뜀 ${skipped}`);
  } finally {
    await pool.end();
  }
}

main().catch((err) => { console.error(err); process.exit(1); });
