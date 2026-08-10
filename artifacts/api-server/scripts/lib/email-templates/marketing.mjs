// marketing — 광고성 정보 (marketing.*)
//
// 🚨 **본문에 (광고) 표기·수신거부 링크·동의 출처를 쓰지 않는다.** 이 셋은 법정 요건이라
//    사람이 문안마다 적으면 언젠가 빠진다. `sendMarketingEmail()` 이 셸을 통해 자동으로
//    붙인다(정보통신망법 제50조). 본문은 내용만 담는다.
//
// 🚨 발송 전 조건 — 코드가 강제하며 문안이 책임지지 않는다:
//    ① 수신동의(`opted_in_at` 있고 `opted_out_at` 없음)가 있어야 발송된다.
//    ② 21시–08시에는 발송하지 않는다(야간 광고는 별도 동의 필요).
//
// ⚠️ 마케팅 메일은 "안 읽어도 그만"인 유일한 종류다. 거래성 메일과 같은 밀도로 쓰면
//    수신거부만 늘린다. 한 통에 하나만 말하고, 짧게 끝낸다.
// 한국어는 humanize-korean 통과본. 영어에서 재기계번역 금지.
import { vars } from "./_shared.mjs";

export const MARKETING = [
  {
    key: "marketing.campaign",
    name: "일반 캠페인",
    description: "자유 본문 캠페인. 관리자가 내용을 채우는 기본 골격.",
    vars: vars("recipient", "headline", "message", "cta_label", "url"),
    tr: {
      ko: {
        subject: "{{headline}}",
        body:
          `<p class="lead">{{recipient}} 님, 안녕하세요.</p>` +
          `<p>{{message}}</p>` +
          `<a class="btn" href="{{url}}">{{cta_label}}</a>`,
      },
      en: {
        subject: "{{headline}}",
        body:
          `<p class="lead">Hi {{recipient}},</p>` +
          `<p>{{message}}</p>` +
          `<a class="btn" href="{{url}}">{{cta_label}}</a>`,
      },
      ja: {
        subject: "{{headline}}",
        body:
          `<p class="lead">{{recipient}} 様</p>` +
          `<p>{{message}}</p>` +
          `<a class="btn" href="{{url}}">{{cta_label}}</a>`,
      },
      zh: {
        subject: "{{headline}}",
        body:
          `<p class="lead">{{recipient}} 您好，</p>` +
          `<p>{{message}}</p>` +
          `<a class="btn" href="{{url}}">{{cta_label}}</a>`,
      },
      th: {
        subject: "{{headline}}",
        body:
          `<p class="lead">เรียน คุณ{{recipient}}</p>` +
          `<p>{{message}}</p>` +
          `<a class="btn" href="{{url}}">{{cta_label}}</a>`,
      },
      vi: {
        subject: "{{headline}}",
        body:
          `<p class="lead">Kính gửi {{recipient}},</p>` +
          `<p>{{message}}</p>` +
          `<a class="btn" href="{{url}}">{{cta_label}}</a>`,
      },
    },
  },

  {
    key: "marketing.newsletter",
    name: "정기 소식",
    description: "월간 소식지. 세 꼭지 이내로 끊는다.",
    vars: vars("recipient", "period", "intro", "item1", "item2", "item3", "url"),
    tr: {
      ko: {
        subject: "{{period}} 소식",
        body:
          `<p class="lead">{{recipient}} 님, 안녕하세요.</p>` +
          `<p>{{intro}}</p>` +
          `<ul><li>{{item1}}</li><li>{{item2}}</li><li>{{item3}}</li></ul>` +
          `<a class="btn" href="{{url}}">자세히 보기</a>`,
      },
      en: {
        subject: "What's new — {{period}}",
        body:
          `<p class="lead">Hi {{recipient}},</p>` +
          `<p>{{intro}}</p>` +
          `<ul><li>{{item1}}</li><li>{{item2}}</li><li>{{item3}}</li></ul>` +
          `<a class="btn" href="{{url}}">Read more</a>`,
      },
      ja: {
        subject: "{{period}} のお知らせ",
        body:
          `<p class="lead">{{recipient}} 様</p>` +
          `<p>{{intro}}</p>` +
          `<ul><li>{{item1}}</li><li>{{item2}}</li><li>{{item3}}</li></ul>` +
          `<a class="btn" href="{{url}}">詳しく見る</a>`,
      },
      zh: {
        subject: "{{period}} 动态",
        body:
          `<p class="lead">{{recipient}} 您好，</p>` +
          `<p>{{intro}}</p>` +
          `<ul><li>{{item1}}</li><li>{{item2}}</li><li>{{item3}}</li></ul>` +
          `<a class="btn" href="{{url}}">查看详情</a>`,
      },
      th: {
        subject: "ข่าวสารประจำ {{period}}",
        body:
          `<p class="lead">เรียน คุณ{{recipient}}</p>` +
          `<p>{{intro}}</p>` +
          `<ul><li>{{item1}}</li><li>{{item2}}</li><li>{{item3}}</li></ul>` +
          `<a class="btn" href="{{url}}">อ่านเพิ่มเติม</a>`,
      },
      vi: {
        subject: "Tin tức {{period}}",
        body:
          `<p class="lead">Kính gửi {{recipient}},</p>` +
          `<p>{{intro}}</p>` +
          `<ul><li>{{item1}}</li><li>{{item2}}</li><li>{{item3}}</li></ul>` +
          `<a class="btn" href="{{url}}">Xem thêm</a>`,
      },
    },
  },

  {
    key: "marketing.promotion",
    name: "할인·프로모션",
    description: "혜택과 조건, 기한. 조건을 흐리면 나중에 분쟁이 된다.",
    vars: vars("recipient", "offer", "conditions", "valid_until", "url"),
    tr: {
      ko: {
        subject: "{{offer}}",
        body:
          `<p class="lead">{{recipient}} 님, 안녕하세요.</p>` +
          `<p>{{offer}} 혜택을 준비했습니다.</p>` +
          `<div class="box"><div class="label">적용 조건</div><div>{{conditions}}</div></div>` +
          `<a class="btn" href="{{url}}">자세히 보기</a>` +
          `<p class="muted">{{valid_until}}까지 신청하신 건에 적용됩니다.</p>`,
      },
      en: {
        subject: "{{offer}}",
        body:
          `<p class="lead">Hi {{recipient}},</p>` +
          `<p>We've put together an offer: {{offer}}.</p>` +
          `<div class="box"><div class="label">Conditions</div><div>{{conditions}}</div></div>` +
          `<a class="btn" href="{{url}}">See the details</a>` +
          `<p class="muted">Applies to bookings made by {{valid_until}}.</p>`,
      },
      ja: {
        subject: "{{offer}}",
        body:
          `<p class="lead">{{recipient}} 様</p>` +
          `<p>{{offer}} の特典をご用意いたしました。</p>` +
          `<div class="box"><div class="label">適用条件</div><div>{{conditions}}</div></div>` +
          `<a class="btn" href="{{url}}">詳しく見る</a>` +
          `<p class="muted">{{valid_until}} までにお申し込みいただいた分に適用されます。</p>`,
      },
      zh: {
        subject: "{{offer}}",
        body:
          `<p class="lead">{{recipient}} 您好，</p>` +
          `<p>我们准备了{{offer}}优惠。</p>` +
          `<div class="box"><div class="label">适用条件</div><div>{{conditions}}</div></div>` +
          `<a class="btn" href="{{url}}">查看详情</a>` +
          `<p class="muted">适用于 {{valid_until}} 前提交的申请。</p>`,
      },
      th: {
        subject: "{{offer}}",
        body:
          `<p class="lead">เรียน คุณ{{recipient}}</p>` +
          `<p>เราเตรียมข้อเสนอ {{offer}} ไว้ให้ท่าน</p>` +
          `<div class="box"><div class="label">เงื่อนไข</div><div>{{conditions}}</div></div>` +
          `<a class="btn" href="{{url}}">ดูรายละเอียด</a>` +
          `<p class="muted">ใช้ได้กับการจองที่ทำภายในวันที่ {{valid_until}}</p>`,
      },
      vi: {
        subject: "{{offer}}",
        body:
          `<p class="lead">Kính gửi {{recipient}},</p>` +
          `<p>Chúng tôi có ưu đãi {{offer}}.</p>` +
          `<div class="box"><div class="label">Điều kiện áp dụng</div><div>{{conditions}}</div></div>` +
          `<a class="btn" href="{{url}}">Xem chi tiết</a>` +
          `<p class="muted">Áp dụng cho đăng ký thực hiện trước ngày {{valid_until}}.</p>`,
      },
    },
  },

  {
    key: "marketing.new_listing",
    name: "신규 매물 안내",
    description: "새로 나온 매물. 조건이 맞는 사람에게만 보내야 효과가 있다.",
    vars: vars("recipient", "space_name", "location", "rent", "available_from", "url"),
    tr: {
      ko: {
        subject: "새로 나온 매물 — {{space_name}}",
        body:
          `<p class="lead">{{recipient}} 님, 안녕하세요.</p>` +
          `<p>전에 찾으시던 조건과 비슷한 매물이 나왔습니다.</p>` +
          `<table class="kv">` +
          `<tr><td class="k">세대</td><td>{{space_name}}</td></tr>` +
          `<tr><td class="k">위치</td><td>{{location}}</td></tr>` +
          `<tr><td class="k">임대료</td><td>{{rent}}</td></tr>` +
          `<tr><td class="k">입주 가능</td><td>{{available_from}}</td></tr></table>` +
          `<a class="btn" href="{{url}}">매물 보기</a>` +
          `<p class="muted">찾으시는 조건이 달라졌으면 알려 주세요. 맞는 매물만 골라 보내 드리겠습니다.</p>`,
      },
      en: {
        subject: "Just listed — {{space_name}}",
        body:
          `<p class="lead">Hi {{recipient}},</p>` +
          `<p>Something has come up that looks close to what you were after.</p>` +
          `<table class="kv">` +
          `<tr><td class="k">Unit</td><td>{{space_name}}</td></tr>` +
          `<tr><td class="k">Where</td><td>{{location}}</td></tr>` +
          `<tr><td class="k">Rent</td><td>{{rent}}</td></tr>` +
          `<tr><td class="k">Available</td><td>{{available_from}}</td></tr></table>` +
          `<a class="btn" href="{{url}}">View the listing</a>` +
          `<p class="muted">If what you're looking for has changed, tell us and we'll only send the ones that fit.</p>`,
      },
      ja: {
        subject: "新着物件 — {{space_name}}",
        body:
          `<p class="lead">{{recipient}} 様</p>` +
          `<p>以前ご覧になっていた条件に近い物件が出ました。</p>` +
          `<table class="kv">` +
          `<tr><td class="k">お部屋</td><td>{{space_name}}</td></tr>` +
          `<tr><td class="k">所在</td><td>{{location}}</td></tr>` +
          `<tr><td class="k">賃料</td><td>{{rent}}</td></tr>` +
          `<tr><td class="k">入居可能</td><td>{{available_from}}</td></tr></table>` +
          `<a class="btn" href="{{url}}">物件を見る</a>` +
          `<p class="muted">お探しの条件が変わられましたらお知らせください。合う物件だけを選んでお送りいたします。</p>`,
      },
      zh: {
        subject: "新上房源 — {{space_name}}",
        body:
          `<p class="lead">{{recipient}} 您好，</p>` +
          `<p>有一套房源与您此前关注的条件相近。</p>` +
          `<table class="kv">` +
          `<tr><td class="k">房源</td><td>{{space_name}}</td></tr>` +
          `<tr><td class="k">位置</td><td>{{location}}</td></tr>` +
          `<tr><td class="k">租金</td><td>{{rent}}</td></tr>` +
          `<tr><td class="k">可入住</td><td>{{available_from}}</td></tr></table>` +
          `<a class="btn" href="{{url}}">查看房源</a>` +
          `<p class="muted">若您的需求有变，请告知我们，我们只发送符合条件的房源。</p>`,
      },
      th: {
        subject: "ห้องใหม่ — {{space_name}}",
        body:
          `<p class="lead">เรียน คุณ{{recipient}}</p>` +
          `<p>มีห้องใหม่ที่ใกล้เคียงกับเงื่อนไขที่ท่านเคยดูไว้</p>` +
          `<table class="kv">` +
          `<tr><td class="k">ห้องพัก</td><td>{{space_name}}</td></tr>` +
          `<tr><td class="k">ทำเล</td><td>{{location}}</td></tr>` +
          `<tr><td class="k">ค่าเช่า</td><td>{{rent}}</td></tr>` +
          `<tr><td class="k">เข้าอยู่ได้</td><td>{{available_from}}</td></tr></table>` +
          `<a class="btn" href="{{url}}">ดูห้องพัก</a>` +
          `<p class="muted">หากเงื่อนไขที่ท่านมองหาเปลี่ยนไป แจ้งเราได้ เราจะคัดเฉพาะที่ตรงส่งให้</p>`,
      },
      vi: {
        subject: "Căn mới — {{space_name}}",
        body:
          `<p class="lead">Kính gửi {{recipient}},</p>` +
          `<p>Có một căn vừa mở, khá gần với điều kiện Quý khách từng xem.</p>` +
          `<table class="kv">` +
          `<tr><td class="k">Căn hộ</td><td>{{space_name}}</td></tr>` +
          `<tr><td class="k">Vị trí</td><td>{{location}}</td></tr>` +
          `<tr><td class="k">Giá thuê</td><td>{{rent}}</td></tr>` +
          `<tr><td class="k">Có thể vào ở</td><td>{{available_from}}</td></tr></table>` +
          `<a class="btn" href="{{url}}">Xem căn hộ</a>` +
          `<p class="muted">Nếu nhu cầu của Quý khách đã đổi, xin báo để chúng tôi chỉ gửi những căn phù hợp.</p>`,
      },
    },
  },

  {
    key: "marketing.seasonal",
    name: "시즌 안내",
    description: "성수기·비수기 등 시기성 안내.",
    vars: vars("recipient", "season", "message", "url"),
    tr: {
      ko: {
        subject: "{{season}} 안내",
        body:
          `<p class="lead">{{recipient}} 님, 안녕하세요.</p>` +
          `<p>{{message}}</p>` +
          `<a class="btn" href="{{url}}">지금 알아보기</a>`,
      },
      en: {
        subject: "{{season}}",
        body:
          `<p class="lead">Hi {{recipient}},</p>` +
          `<p>{{message}}</p>` +
          `<a class="btn" href="{{url}}">Have a look</a>`,
      },
      ja: {
        subject: "{{season}} のご案内",
        body:
          `<p class="lead">{{recipient}} 様</p>` +
          `<p>{{message}}</p>` +
          `<a class="btn" href="{{url}}">詳しく見る</a>`,
      },
      zh: {
        subject: "{{season}}通知",
        body:
          `<p class="lead">{{recipient}} 您好，</p>` +
          `<p>{{message}}</p>` +
          `<a class="btn" href="{{url}}">立即了解</a>`,
      },
      th: {
        subject: "แนะนำช่วง{{season}}",
        body:
          `<p class="lead">เรียน คุณ{{recipient}}</p>` +
          `<p>{{message}}</p>` +
          `<a class="btn" href="{{url}}">ดูรายละเอียด</a>`,
      },
      vi: {
        subject: "Thông tin {{season}}",
        body:
          `<p class="lead">Kính gửi {{recipient}},</p>` +
          `<p>{{message}}</p>` +
          `<a class="btn" href="{{url}}">Tìm hiểu ngay</a>`,
      },
    },
  },

  {
    key: "marketing.event_invite",
    name: "설명회·행사 초대",
    description: "행사 초대. 일시·장소·소요 시간을 분명히.",
    vars: vars("recipient", "event_name", "date", "location", "duration", "url"),
    tr: {
      ko: {
        subject: "{{event_name}} 초대",
        body:
          `<p class="lead">{{recipient}} 님, 안녕하세요.</p>` +
          `<p>{{event_name}}에 초대합니다.</p>` +
          `<table class="kv">` +
          `<tr><td class="k">일시</td><td>{{date}}</td></tr>` +
          `<tr><td class="k">장소</td><td>{{location}}</td></tr>` +
          `<tr><td class="k">소요 시간</td><td>{{duration}}</td></tr></table>` +
          `<a class="btn" href="{{url}}">참석 신청하기</a>` +
          `<p class="muted">자리가 한정되어 있어 신청 순으로 마감합니다.</p>`,
      },
      en: {
        subject: "You're invited — {{event_name}}",
        body:
          `<p class="lead">Hi {{recipient}},</p>` +
          `<p>We'd like to invite you to {{event_name}}.</p>` +
          `<table class="kv">` +
          `<tr><td class="k">When</td><td>{{date}}</td></tr>` +
          `<tr><td class="k">Where</td><td>{{location}}</td></tr>` +
          `<tr><td class="k">Runs for</td><td>{{duration}}</td></tr></table>` +
          `<a class="btn" href="{{url}}">Reserve a place</a>` +
          `<p class="muted">Places are limited and go in order of booking.</p>`,
      },
      ja: {
        subject: "{{event_name}} へのご招待",
        body:
          `<p class="lead">{{recipient}} 様</p>` +
          `<p>{{event_name}} にご招待いたします。</p>` +
          `<table class="kv">` +
          `<tr><td class="k">日時</td><td>{{date}}</td></tr>` +
          `<tr><td class="k">場所</td><td>{{location}}</td></tr>` +
          `<tr><td class="k">所要時間</td><td>{{duration}}</td></tr></table>` +
          `<a class="btn" href="{{url}}">参加を申し込む</a>` +
          `<p class="muted">お席に限りがございますので、お申し込み順とさせていただきます。</p>`,
      },
      zh: {
        subject: "诚邀参加 — {{event_name}}",
        body:
          `<p class="lead">{{recipient}} 您好，</p>` +
          `<p>诚邀您参加{{event_name}}。</p>` +
          `<table class="kv">` +
          `<tr><td class="k">时间</td><td>{{date}}</td></tr>` +
          `<tr><td class="k">地点</td><td>{{location}}</td></tr>` +
          `<tr><td class="k">时长</td><td>{{duration}}</td></tr></table>` +
          `<a class="btn" href="{{url}}">报名参加</a>` +
          `<p class="muted">席位有限，按报名先后为准。</p>`,
      },
      th: {
        subject: "ขอเชิญร่วมงาน {{event_name}}",
        body:
          `<p class="lead">เรียน คุณ{{recipient}}</p>` +
          `<p>ขอเรียนเชิญท่านร่วมงาน {{event_name}}</p>` +
          `<table class="kv">` +
          `<tr><td class="k">วันเวลา</td><td>{{date}}</td></tr>` +
          `<tr><td class="k">สถานที่</td><td>{{location}}</td></tr>` +
          `<tr><td class="k">ระยะเวลา</td><td>{{duration}}</td></tr></table>` +
          `<a class="btn" href="{{url}}">ลงทะเบียนเข้าร่วม</a>` +
          `<p class="muted">ที่นั่งมีจำนวนจำกัด โดยเรียงตามลำดับการลงทะเบียน</p>`,
      },
      vi: {
        subject: "Mời tham dự {{event_name}}",
        body:
          `<p class="lead">Kính gửi {{recipient}},</p>` +
          `<p>Chúng tôi trân trọng mời Quý khách tham dự {{event_name}}.</p>` +
          `<table class="kv">` +
          `<tr><td class="k">Thời gian</td><td>{{date}}</td></tr>` +
          `<tr><td class="k">Địa điểm</td><td>{{location}}</td></tr>` +
          `<tr><td class="k">Thời lượng</td><td>{{duration}}</td></tr></table>` +
          `<a class="btn" href="{{url}}">Đăng ký tham dự</a>` +
          `<p class="muted">Số chỗ có hạn và xét theo thứ tự đăng ký.</p>`,
      },
    },
  },

  {
    key: "marketing.reengagement",
    name: "휴면 고객 재안내",
    description: "오래 접촉이 없던 고객. 마지막 한 통이 될 수 있으므로 수신 의사를 함께 묻는다.",
    vars: vars("recipient", "months_inactive", "whats_new", "url"),
    tr: {
      ko: {
        subject: "그동안 잘 지내셨나요",
        body:
          `<p class="lead">{{recipient}} 님, 안녕하세요.</p>` +
          `<p>연락드린 지 {{months_inactive}}개월쯤 되었습니다. 그사이 달라진 점을 짧게 전해 드립니다.</p>` +
          `<p>{{whats_new}}</p>` +
          `<a class="btn" href="{{url}}">둘러보기</a>` +
          `<p class="muted">이런 소식이 더는 필요 없으시면 아래 수신거부를 눌러 주세요. 계속 보내 드리는 것보다 그편이 낫습니다.</p>`,
      },
      en: {
        subject: "It's been a while",
        body:
          `<p class="lead">Hi {{recipient}},</p>` +
          `<p>It's been about {{months_inactive}} months since we were last in touch. Here's briefly what's changed.</p>` +
          `<p>{{whats_new}}</p>` +
          `<a class="btn" href="{{url}}">Have a look</a>` +
          `<p class="muted">If this isn't useful any more, use the unsubscribe link below. We'd rather that than keep filling your inbox.</p>`,
      },
      ja: {
        subject: "ご無沙汰しております",
        body:
          `<p class="lead">{{recipient}} 様</p>` +
          `<p>ご連絡を差し上げてから {{months_inactive}} か月ほどが経ちました。その間に変わったことを、手短にお伝えいたします。</p>` +
          `<p>{{whats_new}}</p>` +
          `<a class="btn" href="{{url}}">見てみる</a>` +
          `<p class="muted">このようなお知らせが不要でしたら、下記の配信停止をお使いください。お送りし続けるより、そのほうがよろしいかと存じます。</p>`,
      },
      zh: {
        subject: "好久不见",
        body:
          `<p class="lead">{{recipient}} 您好，</p>` +
          `<p>距上次联系已约 {{months_inactive}} 个月。简单向您汇报这期间的变化。</p>` +
          `<p>{{whats_new}}</p>` +
          `<a class="btn" href="{{url}}">看看</a>` +
          `<p class="muted">若这类消息对您已无用处，请点击下方退订。与其继续打扰，不如就此止步。</p>`,
      },
      th: {
        subject: "ไม่ได้ติดต่อกันนานแล้ว",
        body:
          `<p class="lead">เรียน คุณ{{recipient}}</p>` +
          `<p>ผ่านมาราว {{months_inactive}} เดือนแล้วนับจากที่ติดต่อกันครั้งล่าสุด ขอเล่าสั้น ๆ ว่ามีอะไรเปลี่ยนไปบ้าง</p>` +
          `<p>{{whats_new}}</p>` +
          `<a class="btn" href="{{url}}">ลองดู</a>` +
          `<p class="muted">หากข่าวสารแบบนี้ไม่จำเป็นสำหรับท่านแล้ว กดยกเลิกรับข่าวสารด้านล่างได้เลย ดีกว่าให้เราส่งต่อไปเรื่อย ๆ</p>`,
      },
      vi: {
        subject: "Đã lâu không liên lạc",
        body:
          `<p class="lead">Kính gửi {{recipient}},</p>` +
          `<p>Đã khoảng {{months_inactive}} tháng kể từ lần liên lạc gần nhất. Xin kể ngắn gọn những gì đã thay đổi.</p>` +
          `<p>{{whats_new}}</p>` +
          `<a class="btn" href="{{url}}">Xem thử</a>` +
          `<p class="muted">Nếu Quý khách không còn cần những tin này, xin bấm hủy nhận ở bên dưới. Như vậy tốt hơn là chúng tôi cứ gửi mãi.</p>`,
      },
    },
  },

  {
    key: "marketing.referral_invite",
    name: "추천 프로그램 안내",
    description: "지인 추천 안내. 보상 조건과 지급 시점을 분명히.",
    vars: vars("recipient", "reward", "condition", "url"),
    tr: {
      ko: {
        subject: "아는 분께 소개해 주시겠어요?",
        body:
          `<p class="lead">{{recipient}} 님, 안녕하세요.</p>` +
          `<p>집을 찾는 지인이 있으시면 소개해 주세요. 계약이 성사되면 {{reward}}을(를) 드립니다.</p>` +
          `<div class="box"><div class="label">지급 조건</div><div>{{condition}}</div></div>` +
          `<a class="btn" href="{{url}}">추천 링크 받기</a>` +
          `<p class="muted">소개받은 분께도 같은 혜택을 드립니다. 소개만 하고 계약이 안 되면 아무 일도 일어나지 않습니다.</p>`,
      },
      en: {
        subject: "Know someone looking for a place?",
        body:
          `<p class="lead">Hi {{recipient}},</p>` +
          `<p>If someone you know is looking, send them our way. When they sign, you get {{reward}}.</p>` +
          `<div class="box"><div class="label">When it's paid</div><div>{{condition}}</div></div>` +
          `<a class="btn" href="{{url}}">Get your referral link</a>` +
          `<p class="muted">They get the same benefit. If they don't end up signing, nothing happens — no obligation either way.</p>`,
      },
      ja: {
        subject: "お知り合いにご紹介いただけませんか",
        body:
          `<p class="lead">{{recipient}} 様</p>` +
          `<p>お住まいをお探しのお知り合いがいらっしゃいましたら、ご紹介ください。ご成約に至りましたら {{reward}} を差し上げます。</p>` +
          `<div class="box"><div class="label">お支払いの条件</div><div>{{condition}}</div></div>` +
          `<a class="btn" href="{{url}}">紹介リンクを受け取る</a>` +
          `<p class="muted">ご紹介いただいた方にも同じ特典がございます。ご成約に至らなかった場合は、何も発生いたしません。</p>`,
      },
      zh: {
        subject: "身边有人在找房吗？",
        body:
          `<p class="lead">{{recipient}} 您好，</p>` +
          `<p>若您身边有人正在找房，欢迎推荐给我们。成功签约后，您可获得{{reward}}。</p>` +
          `<div class="box"><div class="label">发放条件</div><div>{{condition}}</div></div>` +
          `<a class="btn" href="{{url}}">获取推荐链接</a>` +
          `<p class="muted">被推荐人也享有同等优惠。若最终未签约，则不会产生任何事项。</p>`,
      },
      th: {
        subject: "มีคนรู้จักกำลังหาที่พักไหม",
        body:
          `<p class="lead">เรียน คุณ{{recipient}}</p>` +
          `<p>หากมีคนรู้จักกำลังหาที่พัก แนะนำมาได้เลย เมื่อทำสัญญาสำเร็จ ท่านจะได้รับ {{reward}}</p>` +
          `<div class="box"><div class="label">เงื่อนไขการจ่าย</div><div>{{condition}}</div></div>` +
          `<a class="btn" href="{{url}}">รับลิงก์แนะนำ</a>` +
          `<p class="muted">ผู้ที่ท่านแนะนำก็ได้รับสิทธิ์เดียวกัน หากสุดท้ายไม่ได้ทำสัญญา ก็ไม่มีอะไรเกิดขึ้น</p>`,
      },
      vi: {
        subject: "Quý khách có người quen đang tìm nhà?",
        body:
          `<p class="lead">Kính gửi {{recipient}},</p>` +
          `<p>Nếu người quen của Quý khách đang tìm chỗ ở, xin giới thiệu cho chúng tôi. Khi họ ký hợp đồng, Quý khách nhận {{reward}}.</p>` +
          `<div class="box"><div class="label">Điều kiện chi trả</div><div>{{condition}}</div></div>` +
          `<a class="btn" href="{{url}}">Nhận liên kết giới thiệu</a>` +
          `<p class="muted">Người được giới thiệu cũng nhận ưu đãi tương tự. Nếu cuối cùng họ không ký, sẽ không có gì phát sinh.</p>`,
      },
    },
  },
];
