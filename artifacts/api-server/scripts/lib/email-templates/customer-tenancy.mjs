// customer — 입주·거주·퇴거 (tenancy.*)
//
// 장기 임대 세입자의 생활 주기 전체. 점검표 서명 링크는 무로그인 토큰이라
// 만료·취급 주의를 반드시 함께 적는다(unit-inspections 서명 흐름).
// 퇴거 정산 금액은 전부 변수로만 넣는다 — 정산 내역서 PDF 와 숫자가 갈라지면 안 된다.
// 한국어는 humanize-korean 통과본. 영어에서 재기계번역 금지.
import { vars } from "./_shared.mjs";

export const CUSTOMER_TENANCY = [
  {
    key: "tenancy.movein_info",
    name: "입주 안내",
    description: "입주 전 안내. 주소·열쇠 수령·관리비·연락처를 한 장에 모은다.",
    vars: vars("recipient", "space_name", "address", "movein_date", "key_pickup", "contact_name", "contact_phone", "url"),
    tr: {
      ko: {
        subject: "입주 안내 ({{space_name}})",
        body:
          `<p class="lead">{{recipient}} 님, 안녕하세요.</p>` +
          `<p>{{movein_date}} 입주를 앞두고 필요한 내용을 정리해 드립니다.</p>` +
          `<table class="kv">` +
          `<tr><td class="k">주소</td><td>{{address}}</td></tr>` +
          `<tr><td class="k">세대</td><td>{{space_name}}</td></tr>` +
          `<tr><td class="k">열쇠 수령</td><td>{{key_pickup}}</td></tr>` +
          `<tr><td class="k">담당</td><td>{{contact_name}} ({{contact_phone}})</td></tr></table>` +
          `<p>입주 당일에는 세대 점검표를 함께 작성합니다. 미리 보내 드릴 링크로 사진을 남겨 두시면 나중에 정산할 때 근거가 됩니다.</p>` +
          `<a class="btn" href="{{url}}">입주 정보 보기</a>` +
          `<p class="muted">도착 시간이 정해지면 담당자에게 알려 주세요. 맞춰서 준비하겠습니다.</p>`,
      },
      en: {
        subject: "Moving in to {{space_name}}",
        body:
          `<p class="lead">Hi {{recipient}},</p>` +
          `<p>Here's everything you need before you move in on {{movein_date}}.</p>` +
          `<table class="kv">` +
          `<tr><td class="k">Address</td><td>{{address}}</td></tr>` +
          `<tr><td class="k">Unit</td><td>{{space_name}}</td></tr>` +
          `<tr><td class="k">Keys</td><td>{{key_pickup}}</td></tr>` +
          `<tr><td class="k">Contact</td><td>{{contact_name}} ({{contact_phone}})</td></tr></table>` +
          `<p>On the day we'll fill in the condition report together. Taking photos through the link we send beforehand gives you evidence if anything is queried at settlement.</p>` +
          `<a class="btn" href="{{url}}">View your move-in details</a>` +
          `<p class="muted">Let your contact know what time you expect to arrive so we can be ready.</p>`,
      },
      ja: {
        subject: "ご入居のご案内（{{space_name}}）",
        body:
          `<p class="lead">{{recipient}} 様</p>` +
          `<p>{{movein_date}} のご入居に向けて、必要な事項をまとめてご案内いたします。</p>` +
          `<table class="kv">` +
          `<tr><td class="k">住所</td><td>{{address}}</td></tr>` +
          `<tr><td class="k">お部屋</td><td>{{space_name}}</td></tr>` +
          `<tr><td class="k">鍵のお受け取り</td><td>{{key_pickup}}</td></tr>` +
          `<tr><td class="k">担当</td><td>{{contact_name}}（{{contact_phone}}）</td></tr></table>` +
          `<p>ご入居当日は、室内点検票を一緒に作成いたします。事前にお送りするリンクから写真を残しておいていただくと、後日の精算時の根拠になります。</p>` +
          `<a class="btn" href="{{url}}">入居情報を確認する</a>` +
          `<p class="muted">ご到着のお時間が決まりましたら、担当者までお知らせください。合わせて準備いたします。</p>`,
      },
      zh: {
        subject: "入住指引（{{space_name}}）",
        body:
          `<p class="lead">{{recipient}} 您好，</p>` +
          `<p>您将于 {{movein_date}} 入住，以下是需要提前了解的信息。</p>` +
          `<table class="kv">` +
          `<tr><td class="k">地址</td><td>{{address}}</td></tr>` +
          `<tr><td class="k">房源</td><td>{{space_name}}</td></tr>` +
          `<tr><td class="k">领取钥匙</td><td>{{key_pickup}}</td></tr>` +
          `<tr><td class="k">联系人</td><td>{{contact_name}}（{{contact_phone}}）</td></tr></table>` +
          `<p>入住当天我们会一起填写房屋状况确认表。通过我们提前发送的链接留存照片，日后结算时可作为依据。</p>` +
          `<a class="btn" href="{{url}}">查看入住信息</a>` +
          `<p class="muted">确定到达时间后请告知联系人，我们会提前做好准备。</p>`,
      },
      th: {
        subject: "ข้อมูลการเข้าอยู่ ({{space_name}})",
        body:
          `<p class="lead">เรียน คุณ{{recipient}}</p>` +
          `<p>ข้อมูลที่ท่านต้องทราบก่อนเข้าอยู่ในวันที่ {{movein_date}} มีดังนี้</p>` +
          `<table class="kv">` +
          `<tr><td class="k">ที่อยู่</td><td>{{address}}</td></tr>` +
          `<tr><td class="k">ห้องพัก</td><td>{{space_name}}</td></tr>` +
          `<tr><td class="k">รับกุญแจ</td><td>{{key_pickup}}</td></tr>` +
          `<tr><td class="k">ผู้ประสานงาน</td><td>{{contact_name}} ({{contact_phone}})</td></tr></table>` +
          `<p>ในวันเข้าอยู่ เราจะกรอกใบตรวจสภาพห้องร่วมกัน หากท่านถ่ายภาพเก็บไว้ผ่านลิงก์ที่เราส่งให้ล่วงหน้า จะใช้เป็นหลักฐานตอนคืนเงินประกันได้</p>` +
          `<a class="btn" href="{{url}}">ดูข้อมูลการเข้าอยู่</a>` +
          `<p class="muted">เมื่อทราบเวลาที่จะมาถึงแล้ว กรุณาแจ้งผู้ประสานงานเพื่อเตรียมการให้พร้อม</p>`,
      },
      vi: {
        subject: "Hướng dẫn nhận nhà ({{space_name}})",
        body:
          `<p class="lead">Kính gửi {{recipient}},</p>` +
          `<p>Dưới đây là những điều Quý khách cần biết trước ngày nhận nhà {{movein_date}}.</p>` +
          `<table class="kv">` +
          `<tr><td class="k">Địa chỉ</td><td>{{address}}</td></tr>` +
          `<tr><td class="k">Căn hộ</td><td>{{space_name}}</td></tr>` +
          `<tr><td class="k">Nhận chìa khóa</td><td>{{key_pickup}}</td></tr>` +
          `<tr><td class="k">Người phụ trách</td><td>{{contact_name}} ({{contact_phone}})</td></tr></table>` +
          `<p>Trong ngày nhận nhà, chúng ta sẽ cùng lập biên bản hiện trạng. Nếu Quý khách chụp ảnh lưu lại qua liên kết chúng tôi gửi trước, đó sẽ là căn cứ khi quyết toán sau này.</p>` +
          `<a class="btn" href="{{url}}">Xem thông tin nhận nhà</a>` +
          `<p class="muted">Khi biết giờ đến, xin Quý khách báo cho người phụ trách để chúng tôi chuẩn bị.</p>`,
      },
    },
  },

  {
    key: "tenancy.movein_checklist",
    name: "입주 점검표 서명 요청",
    description: "무로그인 토큰 링크로 세대 점검표에 사진·서명을 받는다. 만료를 명시한다.",
    vars: vars("recipient", "space_name", "url", "expiry_date", "movein_date"),
    tr: {
      ko: {
        subject: "입주 점검표를 작성해 주세요 ({{space_name}})",
        body:
          `<p class="lead">{{recipient}} 님, 안녕하세요.</p>` +
          `<p>{{movein_date}} 입주하신 {{space_name}}의 점검표입니다. 각 항목 상태를 확인하고 서명해 주세요.</p>` +
          `<a class="btn" href="{{url}}">점검표 작성하기</a>` +
          `<p>이미 파손되었거나 상태가 좋지 않은 곳은 사진을 함께 올려 주세요. 퇴거 정산에서 책임 범위를 가르는 근거가 됩니다.</p>` +
          `<p class="muted">링크는 {{expiry_date}}까지 열려 있고 받으신 분만 쓰실 수 있습니다. 로그인은 필요 없으니 다른 분에게 전달하지 마세요.</p>`,
      },
      en: {
        subject: "Please complete the condition report ({{space_name}})",
        body:
          `<p class="lead">Hi {{recipient}},</p>` +
          `<p>This is the condition report for {{space_name}}, which you moved into on {{movein_date}}. Please check each item and sign.</p>` +
          `<a class="btn" href="{{url}}">Fill in the report</a>` +
          `<p>Add photos of anything already damaged or worn. That's what decides who is responsible when the bond is settled.</p>` +
          `<p class="muted">The link is open until {{expiry_date}} and is meant only for you. No login is needed, so please don't forward it.</p>`,
      },
      ja: {
        subject: "入居時点検票のご記入をお願いいたします（{{space_name}}）",
        body:
          `<p class="lead">{{recipient}} 様</p>` +
          `<p>{{movein_date}} にご入居いただいた {{space_name}} の点検票です。各項目の状態をご確認のうえ、ご署名ください。</p>` +
          `<a class="btn" href="{{url}}">点検票を記入する</a>` +
          `<p>すでに破損している箇所や状態のよくない箇所は、写真も併せてご登録ください。退去時の精算で責任の範囲を判断する根拠となります。</p>` +
          `<p class="muted">リンクは {{expiry_date}} まで有効で、お受け取りになったご本人様専用です。ログインは不要ですので、第三者への転送はお控えください。</p>`,
      },
      zh: {
        subject: "请填写房屋状况确认表（{{space_name}}）",
        body:
          `<p class="lead">{{recipient}} 您好，</p>` +
          `<p>这是您于 {{movein_date}} 入住的 {{space_name}} 状况确认表。请逐项核对并签署。</p>` +
          `<a class="btn" href="{{url}}">填写确认表</a>` +
          `<p>已有破损或状况不佳的地方，请一并上传照片。退租结算时，这是划分责任的依据。</p>` +
          `<p class="muted">链接有效期至 {{expiry_date}}，仅供收件人本人使用。无需登录即可填写，请勿转发他人。</p>`,
      },
      th: {
        subject: "กรุณากรอกใบตรวจสภาพห้อง ({{space_name}})",
        body:
          `<p class="lead">เรียน คุณ{{recipient}}</p>` +
          `<p>นี่คือใบตรวจสภาพห้อง {{space_name}} ที่ท่านเข้าอยู่เมื่อวันที่ {{movein_date}} กรุณาตรวจสอบแต่ละรายการและลงนาม</p>` +
          `<a class="btn" href="{{url}}">กรอกใบตรวจสภาพ</a>` +
          `<p>จุดที่ชำรุดหรือสภาพไม่ดีอยู่แล้ว กรุณาแนบภาพถ่ายด้วย เพราะเป็นหลักฐานแบ่งความรับผิดชอบตอนคืนเงินประกัน</p>` +
          `<p class="muted">ลิงก์เปิดถึงวันที่ {{expiry_date}} และใช้ได้เฉพาะผู้รับเท่านั้น ไม่ต้องเข้าสู่ระบบ จึงกรุณาอย่าส่งต่อให้ผู้อื่น</p>`,
      },
      vi: {
        subject: "Xin Quý khách hoàn tất biên bản hiện trạng ({{space_name}})",
        body:
          `<p class="lead">Kính gửi {{recipient}},</p>` +
          `<p>Đây là biên bản hiện trạng của {{space_name}} mà Quý khách nhận ngày {{movein_date}}. Xin kiểm tra từng hạng mục và ký.</p>` +
          `<a class="btn" href="{{url}}">Điền biên bản</a>` +
          `<p>Những chỗ đã hư hỏng hoặc xuống cấp, xin Quý khách kèm ảnh. Đó là căn cứ phân định trách nhiệm khi quyết toán tiền cọc.</p>` +
          `<p class="muted">Liên kết mở đến ngày {{expiry_date}} và chỉ dành riêng cho Quý khách. Không cần đăng nhập nên xin đừng chuyển tiếp.</p>`,
      },
    },
  },

  {
    key: "tenancy.movein_confirmed",
    name: "입주 확정 — 최종 확인",
    description: "점검표까지 마무리된 뒤의 최종 확인. 계약·점검표·연락처를 한 번에 정리한다.",
    vars: vars("recipient", "space_name", "movein_date", "end_date", "ref", "contact_name", "contact_phone", "url"),
    tr: {
      ko: {
        subject: "입주가 확정되었습니다 ({{space_name}})",
        body:
          `<p class="lead">{{recipient}} 님, 안녕하세요.</p>` +
          `<p>계약과 점검표가 모두 마무리되어 입주가 확정되었습니다.</p>` +
          `<table class="kv">` +
          `<tr><td class="k">세대</td><td>{{space_name}}</td></tr>` +
          `<tr><td class="k">계약번호</td><td>{{ref}}</td></tr>` +
          `<tr><td class="k">거주 기간</td><td>{{movein_date}} ~ {{end_date}}</td></tr>` +
          `<tr><td class="k">담당</td><td>{{contact_name}} ({{contact_phone}})</td></tr></table>` +
          `<p>계약서와 점검표는 아래에서 언제든 다시 보실 수 있습니다.</p>` +
          `<a class="btn" href="{{url}}">내 계약 보기</a>` +
          `<p class="muted">지내시면서 불편한 점이 생기면 담당자에게 편하게 말씀해 주세요.</p>`,
      },
      en: {
        subject: "Your move-in is complete ({{space_name}})",
        body:
          `<p class="lead">Hi {{recipient}},</p>` +
          `<p>The agreement and condition report are both done, so your move-in is confirmed.</p>` +
          `<table class="kv">` +
          `<tr><td class="k">Unit</td><td>{{space_name}}</td></tr>` +
          `<tr><td class="k">Agreement</td><td>{{ref}}</td></tr>` +
          `<tr><td class="k">Term</td><td>{{movein_date}} – {{end_date}}</td></tr>` +
          `<tr><td class="k">Contact</td><td>{{contact_name}} ({{contact_phone}})</td></tr></table>` +
          `<p>You can look at the agreement and the report again any time below.</p>` +
          `<a class="btn" href="{{url}}">View my tenancy</a>` +
          `<p class="muted">If anything isn't right while you're living there, just tell your contact.</p>`,
      },
      ja: {
        subject: "ご入居が確定いたしました（{{space_name}}）",
        body:
          `<p class="lead">{{recipient}} 様</p>` +
          `<p>契約書と点検票がすべて整い、ご入居が確定いたしました。</p>` +
          `<table class="kv">` +
          `<tr><td class="k">お部屋</td><td>{{space_name}}</td></tr>` +
          `<tr><td class="k">契約番号</td><td>{{ref}}</td></tr>` +
          `<tr><td class="k">ご入居期間</td><td>{{movein_date}} ～ {{end_date}}</td></tr>` +
          `<tr><td class="k">担当</td><td>{{contact_name}}（{{contact_phone}}）</td></tr></table>` +
          `<p>契約書と点検票は、下記からいつでもご確認いただけます。</p>` +
          `<a class="btn" href="{{url}}">契約内容を確認する</a>` +
          `<p class="muted">お住まいの中で不都合が生じましたら、担当者までお気軽にお申し付けください。</p>`,
      },
      zh: {
        subject: "入住手续已完成（{{space_name}}）",
        body:
          `<p class="lead">{{recipient}} 您好，</p>` +
          `<p>合同与状况确认表均已办妥，入住正式确定。</p>` +
          `<table class="kv">` +
          `<tr><td class="k">房源</td><td>{{space_name}}</td></tr>` +
          `<tr><td class="k">合同编号</td><td>{{ref}}</td></tr>` +
          `<tr><td class="k">居住期间</td><td>{{movein_date}} 至 {{end_date}}</td></tr>` +
          `<tr><td class="k">联系人</td><td>{{contact_name}}（{{contact_phone}}）</td></tr></table>` +
          `<p>合同和确认表可随时在下方查阅。</p>` +
          `<a class="btn" href="{{url}}">查看我的租约</a>` +
          `<p class="muted">居住期间如有任何不便，请随时告知联系人。</p>`,
      },
      th: {
        subject: "การเข้าอยู่เสร็จสมบูรณ์แล้ว ({{space_name}})",
        body:
          `<p class="lead">เรียน คุณ{{recipient}}</p>` +
          `<p>สัญญาและใบตรวจสภาพห้องเรียบร้อยครบถ้วน การเข้าอยู่จึงยืนยันสมบูรณ์แล้ว</p>` +
          `<table class="kv">` +
          `<tr><td class="k">ห้องพัก</td><td>{{space_name}}</td></tr>` +
          `<tr><td class="k">เลขที่สัญญา</td><td>{{ref}}</td></tr>` +
          `<tr><td class="k">ระยะเวลาพัก</td><td>{{movein_date}} ถึง {{end_date}}</td></tr>` +
          `<tr><td class="k">ผู้ประสานงาน</td><td>{{contact_name}} ({{contact_phone}})</td></tr></table>` +
          `<p>ท่านเปิดดูสัญญาและใบตรวจสภาพได้ตลอดจากลิงก์ด้านล่าง</p>` +
          `<a class="btn" href="{{url}}">ดูสัญญาเช่าของฉัน</a>` +
          `<p class="muted">หากมีเรื่องไม่สะดวกระหว่างพักอาศัย แจ้งผู้ประสานงานได้ตามสบาย</p>`,
      },
      vi: {
        subject: "Đã hoàn tất nhận nhà ({{space_name}})",
        body:
          `<p class="lead">Kính gửi {{recipient}},</p>` +
          `<p>Hợp đồng và biên bản hiện trạng đều đã xong nên việc nhận nhà đã được xác nhận.</p>` +
          `<table class="kv">` +
          `<tr><td class="k">Căn hộ</td><td>{{space_name}}</td></tr>` +
          `<tr><td class="k">Số hợp đồng</td><td>{{ref}}</td></tr>` +
          `<tr><td class="k">Thời gian ở</td><td>{{movein_date}} – {{end_date}}</td></tr>` +
          `<tr><td class="k">Người phụ trách</td><td>{{contact_name}} ({{contact_phone}})</td></tr></table>` +
          `<p>Quý khách có thể xem lại hợp đồng và biên bản bất cứ lúc nào ở bên dưới.</p>` +
          `<a class="btn" href="{{url}}">Xem hợp đồng thuê của tôi</a>` +
          `<p class="muted">Trong thời gian ở, nếu có gì chưa ổn, xin cứ báo người phụ trách.</p>`,
      },
    },
  },

  {
    key: "tenancy.house_rules",
    name: "생활 안내·입주 수칙",
    description: "쓰레기 배출·소음·주차·공용부 이용 등 생활 규칙. 입주 직후 한 번 보낸다.",
    vars: vars("recipient", "space_name", "url", "contact_phone"),
    tr: {
      ko: {
        subject: "생활 안내 ({{space_name}})",
        body:
          `<p class="lead">{{recipient}} 님, 안녕하세요.</p>` +
          `<p>편하게 지내시는 데 도움이 될 만한 내용을 정리했습니다. 이웃과 함께 쓰는 건물이라 몇 가지만 지켜 주시면 됩니다.</p>` +
          `<ul>` +
          `<li>쓰레기는 분리해서 지정된 요일·장소에 내놓아 주세요.</li>` +
          `<li>밤 10시부터 아침 7시까지는 소음에 특히 신경 써 주세요.</li>` +
          `<li>주차는 배정된 자리만 이용하시고 방문 차량은 미리 알려 주세요.</li>` +
          `<li>고장이나 누수는 발견하는 대로 알려 주시면 빨리 고쳐 드립니다.</li>` +
          `</ul>` +
          `<a class="btn" href="{{url}}">전체 생활 안내 보기</a>` +
          `<p class="muted">급한 일은 {{contact_phone}}으로 전화 주세요.</p>`,
      },
      en: {
        subject: "Living at {{space_name}}",
        body:
          `<p class="lead">Hi {{recipient}},</p>` +
          `<p>A few notes to help you settle in. It's a shared building, so there are just a handful of things to keep in mind.</p>` +
          `<ul>` +
          `<li>Sort your rubbish and put it out on the marked day and spot.</li>` +
          `<li>Keep noise down between 10pm and 7am.</li>` +
          `<li>Use only your allocated parking space, and tell us in advance about visitor cars.</li>` +
          `<li>Report faults and leaks as soon as you notice them so we can fix them quickly.</li>` +
          `</ul>` +
          `<a class="btn" href="{{url}}">Read the full house rules</a>` +
          `<p class="muted">For anything urgent, call {{contact_phone}}.</p>`,
      },
      ja: {
        subject: "生活のご案内（{{space_name}}）",
        body:
          `<p class="lead">{{recipient}} 様</p>` +
          `<p>快適にお過ごしいただくための事項をまとめました。共同住宅ですので、いくつかの点にご配慮をお願いいたします。</p>` +
          `<ul>` +
          `<li>ごみは分別のうえ、指定の曜日・場所にお出しください。</li>` +
          `<li>夜10時から朝7時までは、特に音にご配慮ください。</li>` +
          `<li>駐車は割り当てられた区画のみをご利用いただき、来客の車は事前にお知らせください。</li>` +
          `<li>故障や水漏れにお気づきの際は、すぐにお知らせください。早急に対応いたします。</li>` +
          `</ul>` +
          `<a class="btn" href="{{url}}">生活のご案内をすべて見る</a>` +
          `<p class="muted">お急ぎの場合は {{contact_phone}} までお電話ください。</p>`,
      },
      zh: {
        subject: "生活须知（{{space_name}}）",
        body:
          `<p class="lead">{{recipient}} 您好，</p>` +
          `<p>为方便您安顿下来，整理了以下几点。这是与邻居共用的楼栋，只需留意几项即可。</p>` +
          `<ul>` +
          `<li>垃圾请分类，并按指定日期投放至指定地点。</li>` +
          `<li>晚上 10 点至早上 7 点，请特别注意控制音量。</li>` +
          `<li>停车请只使用分配给您的车位，访客车辆请提前告知。</li>` +
          `<li>发现故障或漏水，请随时告知，我们会尽快维修。</li>` +
          `</ul>` +
          `<a class="btn" href="{{url}}">查看完整生活须知</a>` +
          `<p class="muted">紧急情况请拨打 {{contact_phone}}。</p>`,
      },
      th: {
        subject: "ข้อแนะนำการอยู่อาศัย ({{space_name}})",
        body:
          `<p class="lead">เรียน คุณ{{recipient}}</p>` +
          `<p>เรารวบรวมข้อมูลที่จะช่วยให้ท่านอยู่อาศัยได้สะดวก อาคารนี้ใช้ร่วมกับเพื่อนบ้าน จึงขอความร่วมมือเพียงไม่กี่ข้อ</p>` +
          `<ul>` +
          `<li>กรุณาแยกขยะและนำไปทิ้งตามวันและจุดที่กำหนด</li>` +
          `<li>ช่วงสี่ทุ่มถึงเจ็ดโมงเช้า กรุณาระวังเรื่องเสียงเป็นพิเศษ</li>` +
          `<li>จอดรถเฉพาะช่องที่ได้รับจัดสรร และแจ้งล่วงหน้าหากมีรถผู้มาเยือน</li>` +
          `<li>พบจุดชำรุดหรือน้ำรั่ว กรุณาแจ้งทันที เราจะรีบซ่อมให้</li>` +
          `</ul>` +
          `<a class="btn" href="{{url}}">อ่านข้อแนะนำฉบับเต็ม</a>` +
          `<p class="muted">เรื่องเร่งด่วน โทร {{contact_phone}}</p>`,
      },
      vi: {
        subject: "Hướng dẫn sinh hoạt ({{space_name}})",
        body:
          `<p class="lead">Kính gửi {{recipient}},</p>` +
          `<p>Chúng tôi tổng hợp vài điều giúp Quý khách ổn định chỗ ở. Đây là tòa nhà dùng chung với hàng xóm nên chỉ cần lưu ý mấy điểm sau.</p>` +
          `<ul>` +
          `<li>Phân loại rác và bỏ đúng ngày, đúng vị trí quy định.</li>` +
          `<li>Từ 22 giờ đến 7 giờ sáng, xin đặc biệt giữ yên tĩnh.</li>` +
          `<li>Chỉ đỗ xe ở chỗ được phân, xe của khách xin báo trước.</li>` +
          `<li>Phát hiện hỏng hóc hay rò rỉ, xin báo ngay để chúng tôi sửa sớm.</li>` +
          `</ul>` +
          `<a class="btn" href="{{url}}">Xem đầy đủ nội quy</a>` +
          `<p class="muted">Việc gấp, xin gọi {{contact_phone}}.</p>`,
      },
    },
  },

  {
    key: "tenancy.midterm_checkin",
    name: "거주 중간 점검 안내",
    description: "거주 중간에 불편 사항을 먼저 묻는다. 불만이 CS로 터지기 전에 잡는 창구.",
    vars: vars("recipient", "space_name", "url", "contact_name"),
    tr: {
      ko: {
        subject: "지내시기 어떠신가요? ({{space_name}})",
        body:
          `<p class="lead">{{recipient}} 님, 안녕하세요.</p>` +
          `<p>{{space_name}}에서 지내신 지 얼마쯤 되어 안부 여쭙습니다. 불편한 곳은 없으신지요.</p>` +
          `<p>고쳐야 할 곳이나 관리가 필요한 부분이 있으면 아래에서 알려 주세요. 작은 것이라도 괜찮습니다. 미뤄 두면 나중에 더 커지는 경우가 많습니다.</p>` +
          `<a class="btn" href="{{url}}">불편한 점 알리기</a>` +
          `<p class="muted">따로 없으면 답장하지 않으셔도 됩니다. 필요할 때 {{contact_name}}에게 연락 주세요.</p>`,
      },
      en: {
        subject: "How are you finding {{space_name}}?",
        body:
          `<p class="lead">Hi {{recipient}},</p>` +
          `<p>You've been at {{space_name}} a little while now, so we thought we'd check in. Is everything working as it should?</p>` +
          `<p>If something needs fixing or looking after, tell us below. Small things count — they tend to grow if they're left.</p>` +
          `<a class="btn" href="{{url}}">Report something</a>` +
          `<p class="muted">Nothing to report? No reply needed. {{contact_name}} is there whenever you do.</p>`,
      },
      ja: {
        subject: "お住まいのご様子はいかがでしょうか（{{space_name}}）",
        body:
          `<p class="lead">{{recipient}} 様</p>` +
          `<p>{{space_name}} でお過ごしになって、しばらく経ちましたのでご様子をお伺いいたします。ご不便な点はございませんでしょうか。</p>` +
          `<p>修繕が必要な箇所や、手入れをしたほうがよい箇所がございましたら、下記よりお知らせください。小さなことでも構いません。放っておくと大きくなることが多うございます。</p>` +
          `<a class="btn" href="{{url}}">気になる点を伝える</a>` +
          `<p class="muted">特にございませんでしたら、ご返信は不要です。必要なときに {{contact_name}} までご連絡ください。</p>`,
      },
      zh: {
        subject: "住得还习惯吗？（{{space_name}}）",
        body:
          `<p class="lead">{{recipient}} 您好，</p>` +
          `<p>您在 {{space_name}} 已住了一段时间，我们想问候一下，不知住得是否顺心。</p>` +
          `<p>若有需要维修或打理的地方，请在下方告知我们。再小的事也没关系，拖久了往往会变大。</p>` +
          `<a class="btn" href="{{url}}">反馈问题</a>` +
          `<p class="muted">若暂时没有，无需回复。需要时联系 {{contact_name}} 即可。</p>`,
      },
      th: {
        subject: "อยู่แล้วเป็นอย่างไรบ้าง ({{space_name}})",
        body:
          `<p class="lead">เรียน คุณ{{recipient}}</p>` +
          `<p>ท่านพักอยู่ที่ {{space_name}} มาสักระยะแล้ว เราจึงขอสอบถามว่ามีเรื่องใดไม่สะดวกหรือไม่</p>` +
          `<p>หากมีจุดที่ต้องซ่อมหรือดูแล กรุณาแจ้งผ่านลิงก์ด้านล่าง เรื่องเล็กก็แจ้งได้ เพราะปล่อยไว้มักลุกลามเป็นเรื่องใหญ่</p>` +
          `<a class="btn" href="{{url}}">แจ้งปัญหา</a>` +
          `<p class="muted">หากไม่มีเรื่องใด ไม่ต้องตอบกลับก็ได้ เมื่อต้องการ ติดต่อ {{contact_name}} ได้เสมอ</p>`,
      },
      vi: {
        subject: "Quý khách ở có ổn không? ({{space_name}})",
        body:
          `<p class="lead">Kính gửi {{recipient}},</p>` +
          `<p>Quý khách đã ở {{space_name}} được một thời gian, chúng tôi xin hỏi thăm xem có gì bất tiện không.</p>` +
          `<p>Nếu có chỗ nào cần sửa hay cần chăm sóc, xin báo cho chúng tôi ở bên dưới. Việc nhỏ cũng được — để lâu thường thành việc lớn.</p>` +
          `<a class="btn" href="{{url}}">Báo vấn đề</a>` +
          `<p class="muted">Nếu không có gì, Quý khách không cần trả lời. Khi cần, xin liên hệ {{contact_name}}.</p>`,
      },
    },
  },

  {
    key: "tenancy.maintenance_notice",
    name: "공사·정전·단수 공지",
    description: "건물 전체에 영향을 주는 작업 사전 통지. 언제부터 언제까지 무엇이 멈추는지가 핵심.",
    vars: vars("recipient", "work_type", "date", "start_time", "end_time", "affected", "contact_phone"),
    tr: {
      ko: {
        subject: "{{date}} {{work_type}} 안내",
        body:
          `<p class="lead">{{recipient}} 님, 안녕하세요.</p>` +
          `<p>{{date}} {{start_time}}부터 {{end_time}}까지 {{work_type}} 작업이 있습니다.</p>` +
          `<div class="box"><div class="label">영향 범위</div><div>{{affected}}</div></div>` +
          `<p>작업 시간에는 해당 설비를 쓰실 수 없습니다. 필요한 물을 미리 받아 두시거나 일정을 조정해 두시면 좋겠습니다.</p>` +
          `<p class="muted">작업이 예정보다 길어지면 다시 알려 드리겠습니다. 문의는 {{contact_phone}}으로 주세요.</p>`,
      },
      en: {
        subject: "{{work_type}} on {{date}}",
        body:
          `<p class="lead">Hi {{recipient}},</p>` +
          `<p>{{work_type}} work is scheduled for {{date}}, from {{start_time}} to {{end_time}}.</p>` +
          `<div class="box"><div class="label">What's affected</div><div>{{affected}}</div></div>` +
          `<p>The service won't be available during that window. It's worth filling what you need beforehand or planning around the time.</p>` +
          `<p class="muted">If the work runs long we'll let you know. Questions to {{contact_phone}}.</p>`,
      },
      ja: {
        subject: "{{date}} {{work_type}}のお知らせ",
        body:
          `<p class="lead">{{recipient}} 様</p>` +
          `<p>{{date}} の {{start_time}} から {{end_time}} まで、{{work_type}}の作業を行います。</p>` +
          `<div class="box"><div class="label">影響範囲</div><div>{{affected}}</div></div>` +
          `<p>作業時間中は該当の設備をご利用いただけません。必要な分を事前におためになるか、ご予定の調整をお願いいたします。</p>` +
          `<p class="muted">作業が予定より長引く場合は、改めてお知らせいたします。お問い合わせは {{contact_phone}} までお願いいたします。</p>`,
      },
      zh: {
        subject: "{{date}} {{work_type}}通知",
        body:
          `<p class="lead">{{recipient}} 您好，</p>` +
          `<p>{{date}} {{start_time}} 至 {{end_time}} 将进行{{work_type}}作业。</p>` +
          `<div class="box"><div class="label">影响范围</div><div>{{affected}}</div></div>` +
          `<p>作业期间相关设施无法使用。建议您提前储备所需用水，或相应调整安排。</p>` +
          `<p class="muted">若作业时间延长，我们会再行通知。咨询请拨 {{contact_phone}}。</p>`,
      },
      th: {
        subject: "แจ้ง{{work_type}}วันที่ {{date}}",
        body:
          `<p class="lead">เรียน คุณ{{recipient}}</p>` +
          `<p>วันที่ {{date}} เวลา {{start_time}} ถึง {{end_time}} จะมีงาน{{work_type}}</p>` +
          `<div class="box"><div class="label">ขอบเขตที่กระทบ</div><div>{{affected}}</div></div>` +
          `<p>ระหว่างช่วงเวลาดังกล่าวจะใช้ระบบดังกล่าวไม่ได้ แนะนำให้สำรองน้ำไว้ล่วงหน้าหรือปรับกำหนดการของท่าน</p>` +
          `<p class="muted">หากงานล่าช้ากว่ากำหนด เราจะแจ้งให้ทราบอีกครั้ง สอบถามได้ที่ {{contact_phone}}</p>`,
      },
      vi: {
        subject: "Thông báo {{work_type}} ngày {{date}}",
        body:
          `<p class="lead">Kính gửi {{recipient}},</p>` +
          `<p>Ngày {{date}}, từ {{start_time}} đến {{end_time}} sẽ có công việc {{work_type}}.</p>` +
          `<div class="box"><div class="label">Phạm vi ảnh hưởng</div><div>{{affected}}</div></div>` +
          `<p>Trong khoảng thời gian đó, hạng mục này sẽ không dùng được. Quý khách nên trữ sẵn phần cần dùng hoặc sắp xếp lại lịch.</p>` +
          `<p class="muted">Nếu công việc kéo dài hơn dự kiến, chúng tôi sẽ báo lại. Thắc mắc xin gọi {{contact_phone}}.</p>`,
      },
    },
  },

  {
    key: "tenancy.inspection_notice",
    name: "정기 점검 방문 통지",
    description: "세대 안에 들어가는 방문은 사전 통지가 원칙. 일정 변경 창구를 반드시 준다.",
    vars: vars("recipient", "space_name", "date", "time_window", "purpose", "contact_name", "contact_phone", "url"),
    tr: {
      ko: {
        subject: "세대 점검 방문 안내 ({{date}})",
        body:
          `<p class="lead">{{recipient}} 님, 안녕하세요.</p>` +
          `<p>{{space_name}} {{purpose}}을(를) 위해 {{date}} {{time_window}}에 방문하고자 합니다.</p>` +
          `<p>댁에 계시지 않아도 진행할 수 있지만 계시는 편이 좋으시면 시간을 맞춰 드리겠습니다.</p>` +
          `<a class="btn" href="{{url}}">일정 조정하기</a>` +
          `<p class="muted">방문이 어려운 날이면 {{contact_name}} ({{contact_phone}})으로 알려 주세요. 다른 날로 잡겠습니다.</p>`,
      },
      en: {
        subject: "Inspection visit on {{date}}",
        body:
          `<p class="lead">Hi {{recipient}},</p>` +
          `<p>We'd like to visit {{space_name}} on {{date}} between {{time_window}} for {{purpose}}.</p>` +
          `<p>We can carry it out whether or not you're home, but if you'd rather be there we'll work around you.</p>` +
          `<a class="btn" href="{{url}}">Change the time</a>` +
          `<p class="muted">If that day doesn't suit, tell {{contact_name}} on {{contact_phone}} and we'll find another.</p>`,
      },
      ja: {
        subject: "室内点検のご訪問について（{{date}}）",
        body:
          `<p class="lead">{{recipient}} 様</p>` +
          `<p>{{space_name}} の{{purpose}}のため、{{date}} の {{time_window}} にご訪問したく存じます。</p>` +
          `<p>ご不在でも実施可能ですが、お立ち会いをご希望でしたら、お時間を合わせいたします。</p>` +
          `<a class="btn" href="{{url}}">日程を調整する</a>` +
          `<p class="muted">その日がご都合の悪い場合は、{{contact_name}}（{{contact_phone}}）までお知らせください。別の日を調整いたします。</p>`,
      },
      zh: {
        subject: "房屋检查上门通知（{{date}}）",
        body:
          `<p class="lead">{{recipient}} 您好，</p>` +
          `<p>为进行{{purpose}}，我们拟于 {{date}} {{time_window}} 上门查看 {{space_name}}。</p>` +
          `<p>您不在家我们也可以进行；若您希望在场，我们会配合您的时间。</p>` +
          `<a class="btn" href="{{url}}">调整时间</a>` +
          `<p class="muted">若当天不便，请告知 {{contact_name}}（{{contact_phone}}），我们另约时间。</p>`,
      },
      th: {
        subject: "แจ้งเข้าตรวจห้องพัก ({{date}})",
        body:
          `<p class="lead">เรียน คุณ{{recipient}}</p>` +
          `<p>เราขอเข้าตรวจ {{space_name}} เพื่อ{{purpose}} ในวันที่ {{date}} ช่วงเวลา {{time_window}}</p>` +
          `<p>แม้ท่านไม่อยู่ก็ดำเนินการได้ แต่หากท่านประสงค์จะอยู่ด้วย เราจะปรับเวลาให้ตรงกัน</p>` +
          `<a class="btn" href="{{url}}">ปรับเวลานัด</a>` +
          `<p class="muted">หากวันดังกล่าวไม่สะดวก แจ้ง {{contact_name}} ที่ {{contact_phone}} เราจะนัดวันใหม่ให้</p>`,
      },
      vi: {
        subject: "Thông báo kiểm tra căn hộ ({{date}})",
        body:
          `<p class="lead">Kính gửi {{recipient}},</p>` +
          `<p>Chúng tôi muốn đến {{space_name}} vào ngày {{date}}, khoảng {{time_window}}, để {{purpose}}.</p>` +
          `<p>Quý khách không có nhà chúng tôi vẫn làm được, nhưng nếu Quý khách muốn có mặt, chúng tôi sẽ sắp xếp theo giờ của Quý khách.</p>` +
          `<a class="btn" href="{{url}}">Đổi giờ hẹn</a>` +
          `<p class="muted">Nếu ngày đó không tiện, xin báo {{contact_name}} theo số {{contact_phone}} để chọn ngày khác.</p>`,
      },
    },
  },

  {
    key: "tenancy.moveout_notice",
    name: "퇴거 절차 안내",
    description: "퇴거 전 안내. 점검 일정·열쇠 반납·정산 순서와 원상복구 범위를 미리 알린다.",
    vars: vars("recipient", "space_name", "end_date", "inspection_date", "key_return", "settlement_date", "url"),
    tr: {
      ko: {
        subject: "퇴거 절차 안내 ({{space_name}})",
        body:
          `<p class="lead">{{recipient}} 님, 안녕하세요.</p>` +
          `<p>{{end_date}} 퇴거를 앞두고 절차를 정리해 드립니다.</p>` +
          `<table class="kv">` +
          `<tr><td class="k">퇴거 점검</td><td>{{inspection_date}}</td></tr>` +
          `<tr><td class="k">열쇠 반납</td><td>{{key_return}}</td></tr>` +
          `<tr><td class="k">보증금 정산</td><td>{{settlement_date}}까지</td></tr></table>` +
          `<p>점검 전에 짐을 모두 빼시고 청소를 마쳐 주세요. 입주 점검표에 없던 손상은 원상복구 비용이 정산에서 빠집니다. 생활하면서 자연히 낡은 부분은 청구하지 않습니다.</p>` +
          `<a class="btn" href="{{url}}">퇴거 안내 자세히 보기</a>` +
          `<p class="muted">점검 일정을 바꾸셔야 하면 미리 알려 주세요.</p>`,
      },
      en: {
        subject: "Moving out of {{space_name}}",
        body:
          `<p class="lead">Hi {{recipient}},</p>` +
          `<p>Here's how the move-out on {{end_date}} will work.</p>` +
          `<table class="kv">` +
          `<tr><td class="k">Inspection</td><td>{{inspection_date}}</td></tr>` +
          `<tr><td class="k">Keys back</td><td>{{key_return}}</td></tr>` +
          `<tr><td class="k">Bond settled</td><td>by {{settlement_date}}</td></tr></table>` +
          `<p>Please have everything out and the place cleaned before the inspection. Damage that wasn't on the move-in report is deducted at settlement; ordinary wear from living there is not charged.</p>` +
          `<a class="btn" href="{{url}}">Read the full move-out guide</a>` +
          `<p class="muted">If you need to move the inspection, let us know in advance.</p>`,
      },
      ja: {
        subject: "ご退去の手続きについて（{{space_name}}）",
        body:
          `<p class="lead">{{recipient}} 様</p>` +
          `<p>{{end_date}} のご退去に向けて、手続きをご案内いたします。</p>` +
          `<table class="kv">` +
          `<tr><td class="k">退去点検</td><td>{{inspection_date}}</td></tr>` +
          `<tr><td class="k">鍵のご返却</td><td>{{key_return}}</td></tr>` +
          `<tr><td class="k">敷金の精算</td><td>{{settlement_date}} まで</td></tr></table>` +
          `<p>点検の前に、お荷物をすべて搬出し、清掃を済ませてください。入居時の点検票になかった損傷は、原状回復費用として精算から差し引かれます。通常の生活による経年の傷みはご請求いたしません。</p>` +
          `<a class="btn" href="{{url}}">退去のご案内を詳しく見る</a>` +
          `<p class="muted">点検日程のご変更が必要な場合は、事前にお知らせください。</p>`,
      },
      zh: {
        subject: "退租流程说明（{{space_name}}）",
        body:
          `<p class="lead">{{recipient}} 您好，</p>` +
          `<p>关于 {{end_date}} 的退租，流程整理如下。</p>` +
          `<table class="kv">` +
          `<tr><td class="k">退租验房</td><td>{{inspection_date}}</td></tr>` +
          `<tr><td class="k">归还钥匙</td><td>{{key_return}}</td></tr>` +
          `<tr><td class="k">押金结算</td><td>{{settlement_date}} 前</td></tr></table>` +
          `<p>请在验房前搬空物品并完成清洁。入住确认表上没有记录的损坏，其修复费用将从结算中扣除；正常居住产生的自然磨损不予收费。</p>` +
          `<a class="btn" href="{{url}}">查看完整退租指引</a>` +
          `<p class="muted">如需变更验房时间，请提前告知我们。</p>`,
      },
      th: {
        subject: "ขั้นตอนการย้ายออก ({{space_name}})",
        body:
          `<p class="lead">เรียน คุณ{{recipient}}</p>` +
          `<p>สรุปขั้นตอนสำหรับการย้ายออกในวันที่ {{end_date}} ดังนี้</p>` +
          `<table class="kv">` +
          `<tr><td class="k">ตรวจสภาพห้อง</td><td>{{inspection_date}}</td></tr>` +
          `<tr><td class="k">คืนกุญแจ</td><td>{{key_return}}</td></tr>` +
          `<tr><td class="k">คืนเงินประกัน</td><td>ภายใน {{settlement_date}}</td></tr></table>` +
          `<p>กรุณาขนของออกให้หมดและทำความสะอาดก่อนวันตรวจ ความเสียหายที่ไม่ปรากฏในใบตรวจตอนเข้าอยู่ จะหักค่าซ่อมจากเงินประกัน ส่วนการสึกหรอตามปกติจากการอยู่อาศัย เราไม่คิดค่าใช้จ่าย</p>` +
          `<a class="btn" href="{{url}}">ดูคู่มือการย้ายออกฉบับเต็ม</a>` +
          `<p class="muted">หากต้องเลื่อนวันตรวจ กรุณาแจ้งล่วงหน้า</p>`,
      },
      vi: {
        subject: "Thủ tục trả nhà ({{space_name}})",
        body:
          `<p class="lead">Kính gửi {{recipient}},</p>` +
          `<p>Dưới đây là trình tự cho việc trả nhà ngày {{end_date}}.</p>` +
          `<table class="kv">` +
          `<tr><td class="k">Kiểm tra bàn giao</td><td>{{inspection_date}}</td></tr>` +
          `<tr><td class="k">Trả chìa khóa</td><td>{{key_return}}</td></tr>` +
          `<tr><td class="k">Quyết toán tiền cọc</td><td>trước {{settlement_date}}</td></tr></table>` +
          `<p>Xin Quý khách chuyển hết đồ đạc và dọn dẹp trước buổi kiểm tra. Hư hỏng không có trong biên bản lúc nhận nhà sẽ bị trừ chi phí khôi phục khi quyết toán; hao mòn tự nhiên do sinh hoạt thì không tính phí.</p>` +
          `<a class="btn" href="{{url}}">Xem hướng dẫn trả nhà đầy đủ</a>` +
          `<p class="muted">Nếu cần đổi lịch kiểm tra, xin báo trước.</p>`,
      },
    },
  },

  {
    key: "tenancy.moveout_checklist",
    name: "퇴거 점검표 서명 요청",
    description: "퇴거 점검 결과에 대한 서명·이의제기 창구. 이의 기한을 반드시 밝힌다.",
    vars: vars("recipient", "space_name", "url", "expiry_date", "dispute_days"),
    tr: {
      ko: {
        subject: "퇴거 점검표를 확인해 주세요 ({{space_name}})",
        body:
          `<p class="lead">{{recipient}} 님, 안녕하세요.</p>` +
          `<p>{{space_name}} 퇴거 점검을 마쳤습니다. 결과를 확인하시고 동의하시면 서명해 주세요.</p>` +
          `<a class="btn" href="{{url}}">점검 결과 확인하기</a>` +
          `<p>내용에 동의하기 어려운 부분이 있으면 같은 화면에서 이의를 제기하실 수 있습니다. 사진이나 설명을 함께 남겨 주시면 다시 살펴보겠습니다.</p>` +
          `<p class="muted">이의는 {{dispute_days}}일 안에 제기해 주세요. 그 뒤에는 점검 결과대로 정산이 진행됩니다. 링크는 {{expiry_date}}까지 열려 있습니다.</p>`,
      },
      en: {
        subject: "Please review the move-out report ({{space_name}})",
        body:
          `<p class="lead">Hi {{recipient}},</p>` +
          `<p>The move-out inspection for {{space_name}} is done. Please look over the findings and sign if you agree.</p>` +
          `<a class="btn" href="{{url}}">See the findings</a>` +
          `<p>If there's something you don't agree with, you can raise it on the same screen. Add photos or an explanation and we'll take another look.</p>` +
          `<p class="muted">Please raise any dispute within {{dispute_days}} days. After that, settlement goes ahead on the findings as they stand. The link is open until {{expiry_date}}.</p>`,
      },
      ja: {
        subject: "退去点検の結果をご確認ください（{{space_name}}）",
        body:
          `<p class="lead">{{recipient}} 様</p>` +
          `<p>{{space_name}} の退去点検が完了いたしました。結果をご確認のうえ、ご同意いただけましたらご署名ください。</p>` +
          `<a class="btn" href="{{url}}">点検結果を確認する</a>` +
          `<p>内容にご同意いただけない点がございましたら、同じ画面から異議をお申し立ていただけます。写真やご説明を添えていただければ、改めて確認いたします。</p>` +
          `<p class="muted">異議のお申し立ては {{dispute_days}} 日以内にお願いいたします。それ以降は点検結果のとおり精算を進めます。リンクは {{expiry_date}} まで有効です。</p>`,
      },
      zh: {
        subject: "请确认退租验房结果（{{space_name}}）",
        body:
          `<p class="lead">{{recipient}} 您好，</p>` +
          `<p>{{space_name}} 的退租验房已完成。请查看结果，如无异议请签署确认。</p>` +
          `<a class="btn" href="{{url}}">查看验房结果</a>` +
          `<p>若对内容有不同意见，可在同一页面提出异议。附上照片或说明，我们会重新核查。</p>` +
          `<p class="muted">异议请在 {{dispute_days}} 天内提出，逾期将按验房结果进行结算。链接有效期至 {{expiry_date}}。</p>`,
      },
      th: {
        subject: "กรุณาตรวจสอบผลการตรวจห้องเมื่อย้ายออก ({{space_name}})",
        body:
          `<p class="lead">เรียน คุณ{{recipient}}</p>` +
          `<p>การตรวจสภาพห้อง {{space_name}} เมื่อย้ายออกเสร็จสิ้นแล้ว กรุณาดูผลการตรวจ หากเห็นชอบก็ลงนามได้เลย</p>` +
          `<a class="btn" href="{{url}}">ดูผลการตรวจ</a>` +
          `<p>หากมีข้อใดที่ท่านไม่เห็นด้วย สามารถยื่นคัดค้านได้จากหน้าเดียวกัน แนบภาพถ่ายหรือคำชี้แจงมาด้วย เราจะตรวจสอบซ้ำให้</p>` +
          `<p class="muted">กรุณายื่นคัดค้านภายใน {{dispute_days}} วัน หลังจากนั้นจะดำเนินการคืนเงินประกันตามผลการตรวจ ลิงก์เปิดถึงวันที่ {{expiry_date}}</p>`,
      },
      vi: {
        subject: "Xin Quý khách xem biên bản kiểm tra trả nhà ({{space_name}})",
        body:
          `<p class="lead">Kính gửi {{recipient}},</p>` +
          `<p>Việc kiểm tra bàn giao {{space_name}} đã xong. Xin Quý khách xem kết quả và ký nếu đồng ý.</p>` +
          `<a class="btn" href="{{url}}">Xem kết quả kiểm tra</a>` +
          `<p>Nếu có điểm nào chưa đồng ý, Quý khách có thể khiếu nại ngay trên màn hình đó. Kèm ảnh hoặc giải thích để chúng tôi xem lại.</p>` +
          `<p class="muted">Xin khiếu nại trong vòng {{dispute_days}} ngày. Sau thời hạn đó, việc quyết toán sẽ theo đúng kết quả kiểm tra. Liên kết mở đến ngày {{expiry_date}}.</p>`,
      },
    },
  },

  {
    key: "tenancy.moveout_settlement",
    name: "보증금 정산 내역서",
    description: "정산 결과 통보. 공제 항목과 최종 환급액·입금 일정을 숫자로 밝힌다.",
    vars: vars("recipient", "space_name", "deposit_amount", "deduction_total", "refund_amount", "payout_date", "url"),
    tr: {
      ko: {
        subject: "보증금 정산 내역 ({{space_name}})",
        body:
          `<p class="lead">{{recipient}} 님, 안녕하세요.</p>` +
          `<p>{{space_name}} 보증금 정산을 마쳤습니다. 자세한 내역서를 첨부해 드립니다.</p>` +
          `<table class="kv">` +
          `<tr><td class="k">보증금</td><td>{{deposit_amount}}</td></tr>` +
          `<tr><td class="k">공제 합계</td><td>{{deduction_total}}</td></tr>` +
          `<tr><td class="k">환급액</td><td>{{refund_amount}}</td></tr>` +
          `<tr><td class="k">입금 예정</td><td>{{payout_date}}</td></tr></table>` +
          `<a class="btn" href="{{url}}">정산 내역 보기</a>` +
          `<p class="muted">공제 항목 중 납득하기 어려운 부분이 있으면 답장 주세요. 산출 근거와 사진을 보내 드리겠습니다.</p>`,
      },
      en: {
        subject: "Bond settlement for {{space_name}}",
        body:
          `<p class="lead">Hi {{recipient}},</p>` +
          `<p>Your bond for {{space_name}} has been settled. The itemised statement is attached.</p>` +
          `<table class="kv">` +
          `<tr><td class="k">Bond held</td><td>{{deposit_amount}}</td></tr>` +
          `<tr><td class="k">Deductions</td><td>{{deduction_total}}</td></tr>` +
          `<tr><td class="k">Refund</td><td>{{refund_amount}}</td></tr>` +
          `<tr><td class="k">Paid on</td><td>{{payout_date}}</td></tr></table>` +
          `<a class="btn" href="{{url}}">View the settlement</a>` +
          `<p class="muted">If any deduction doesn't look right, reply and we'll send the workings and the photos behind it.</p>`,
      },
      ja: {
        subject: "敷金精算のご案内（{{space_name}}）",
        body:
          `<p class="lead">{{recipient}} 様</p>` +
          `<p>{{space_name}} の敷金精算が完了いたしました。詳細な明細書を添付いたします。</p>` +
          `<table class="kv">` +
          `<tr><td class="k">お預かり敷金</td><td>{{deposit_amount}}</td></tr>` +
          `<tr><td class="k">控除合計</td><td>{{deduction_total}}</td></tr>` +
          `<tr><td class="k">ご返金額</td><td>{{refund_amount}}</td></tr>` +
          `<tr><td class="k">お振込予定</td><td>{{payout_date}}</td></tr></table>` +
          `<a class="btn" href="{{url}}">精算内容を確認する</a>` +
          `<p class="muted">控除項目にご不明な点がございましたら、ご返信ください。算出の根拠と写真をお送りいたします。</p>`,
      },
      zh: {
        subject: "押金结算明细（{{space_name}}）",
        body:
          `<p class="lead">{{recipient}} 您好，</p>` +
          `<p>{{space_name}} 的押金已结算完毕，随附详细明细表。</p>` +
          `<table class="kv">` +
          `<tr><td class="k">押金</td><td>{{deposit_amount}}</td></tr>` +
          `<tr><td class="k">扣除合计</td><td>{{deduction_total}}</td></tr>` +
          `<tr><td class="k">退还金额</td><td>{{refund_amount}}</td></tr>` +
          `<tr><td class="k">预计到账</td><td>{{payout_date}}</td></tr></table>` +
          `<a class="btn" href="{{url}}">查看结算明细</a>` +
          `<p class="muted">如对某项扣除有疑问，请回复本邮件，我们会提供计算依据和相关照片。</p>`,
      },
      th: {
        subject: "รายละเอียดการคืนเงินประกัน ({{space_name}})",
        body:
          `<p class="lead">เรียน คุณ{{recipient}}</p>` +
          `<p>การคืนเงินประกันของ {{space_name}} เสร็จสิ้นแล้ว แนบใบสรุปรายการโดยละเอียดมาด้วย</p>` +
          `<table class="kv">` +
          `<tr><td class="k">เงินประกัน</td><td>{{deposit_amount}}</td></tr>` +
          `<tr><td class="k">รวมยอดหัก</td><td>{{deduction_total}}</td></tr>` +
          `<tr><td class="k">ยอดคืน</td><td>{{refund_amount}}</td></tr>` +
          `<tr><td class="k">กำหนดโอน</td><td>{{payout_date}}</td></tr></table>` +
          `<a class="btn" href="{{url}}">ดูรายละเอียดการคืนเงิน</a>` +
          `<p class="muted">หากมีรายการหักใดที่ท่านสงสัย ตอบกลับมาได้ เราจะส่งวิธีคำนวณและภาพถ่ายประกอบให้</p>`,
      },
      vi: {
        subject: "Quyết toán tiền cọc ({{space_name}})",
        body:
          `<p class="lead">Kính gửi {{recipient}},</p>` +
          `<p>Tiền cọc của {{space_name}} đã được quyết toán. Bảng kê chi tiết được đính kèm.</p>` +
          `<table class="kv">` +
          `<tr><td class="k">Tiền cọc</td><td>{{deposit_amount}}</td></tr>` +
          `<tr><td class="k">Tổng khấu trừ</td><td>{{deduction_total}}</td></tr>` +
          `<tr><td class="k">Số tiền hoàn</td><td>{{refund_amount}}</td></tr>` +
          `<tr><td class="k">Dự kiến chuyển</td><td>{{payout_date}}</td></tr></table>` +
          `<a class="btn" href="{{url}}">Xem bảng quyết toán</a>` +
          `<p class="muted">Nếu có khoản khấu trừ nào chưa thỏa đáng, xin trả lời email để chúng tôi gửi cách tính và ảnh chứng minh.</p>`,
      },
    },
  },

  {
    key: "tenancy.moveout_completed",
    name: "퇴거 완료 — 세대 확인서",
    description: "모든 절차가 끝났을 때. 세대 확인서를 첨부하고 재이용을 권한다.",
    vars: vars("recipient", "space_name", "end_date", "url"),
    tr: {
      ko: {
        subject: "퇴거가 완료되었습니다 ({{space_name}})",
        body:
          `<p class="lead">{{recipient}} 님, 안녕하세요.</p>` +
          `<p>{{end_date}}자로 {{space_name}} 퇴거 절차가 모두 마무리되었습니다. 세대 확인서를 첨부해 드리니 보관해 주세요.</p>` +
          `<p>정산과 열쇠 반납까지 확인했으며 남은 의무는 없습니다.</p>` +
          `<a class="btn" href="{{url}}">확인서 보기</a>` +
          `<p class="muted">그동안 함께해 주셔서 감사합니다. 필요한 일이 생기면 언제든 찾아 주세요.</p>`,
      },
      en: {
        subject: "Move-out complete ({{space_name}})",
        body:
          `<p class="lead">Hi {{recipient}},</p>` +
          `<p>As of {{end_date}}, everything for {{space_name}} is wrapped up. The move-out confirmation is attached for your records.</p>` +
          `<p>Settlement and keys are both accounted for, and nothing remains outstanding.</p>` +
          `<a class="btn" href="{{url}}">View the confirmation</a>` +
          `<p class="muted">Thank you for staying with us. Do come back whenever you need a place.</p>`,
      },
      ja: {
        subject: "ご退去が完了いたしました（{{space_name}}）",
        body:
          `<p class="lead">{{recipient}} 様</p>` +
          `<p>{{end_date}} をもって、{{space_name}} のご退去手続きがすべて完了いたしました。退去確認書を添付いたしますので、ご保管ください。</p>` +
          `<p>精算と鍵のご返却まで確認しており、残っているお手続きはございません。</p>` +
          `<a class="btn" href="{{url}}">確認書を見る</a>` +
          `<p class="muted">これまでご利用いただき、誠にありがとうございました。またお部屋をお探しの際は、ぜひお声がけください。</p>`,
      },
      zh: {
        subject: "退租已完成（{{space_name}}）",
        body:
          `<p class="lead">{{recipient}} 您好，</p>` +
          `<p>截至 {{end_date}}，{{space_name}} 的退租手续已全部办结。随附退租确认书，请您留存。</p>` +
          `<p>结算与钥匙归还均已确认，无遗留事项。</p>` +
          `<a class="btn" href="{{url}}">查看确认书</a>` +
          `<p class="muted">感谢您一路以来的信赖。日后有需要，欢迎随时再来。</p>`,
      },
      th: {
        subject: "ย้ายออกเรียบร้อยแล้ว ({{space_name}})",
        body:
          `<p class="lead">เรียน คุณ{{recipient}}</p>` +
          `<p>ณ วันที่ {{end_date}} ขั้นตอนการย้ายออกของ {{space_name}} เสร็จสิ้นครบถ้วนแล้ว แนบหนังสือยืนยันการย้ายออกมาด้วย กรุณาเก็บไว้เป็นหลักฐาน</p>` +
          `<p>ทั้งการคืนเงินประกันและการคืนกุญแจได้รับการยืนยันแล้ว ไม่มีภาระคงค้างใด ๆ</p>` +
          `<a class="btn" href="{{url}}">ดูหนังสือยืนยัน</a>` +
          `<p class="muted">ขอบคุณที่พักอาศัยกับเราตลอดมา หากต้องการที่พักอีก ยินดีต้อนรับเสมอ</p>`,
      },
      vi: {
        subject: "Đã hoàn tất trả nhà ({{space_name}})",
        body:
          `<p class="lead">Kính gửi {{recipient}},</p>` +
          `<p>Tính đến ngày {{end_date}}, mọi thủ tục trả nhà của {{space_name}} đã hoàn tất. Giấy xác nhận trả nhà được đính kèm, xin Quý khách lưu giữ.</p>` +
          `<p>Việc quyết toán và trả chìa khóa đều đã được xác nhận, không còn nghĩa vụ nào tồn đọng.</p>` +
          `<a class="btn" href="{{url}}">Xem giấy xác nhận</a>` +
          `<p class="muted">Cảm ơn Quý khách đã đồng hành. Khi cần chỗ ở, xin cứ quay lại với chúng tôi.</p>`,
      },
    },
  },
];
