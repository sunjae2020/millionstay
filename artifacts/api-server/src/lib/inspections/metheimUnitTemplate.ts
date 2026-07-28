/**
 * 세대점검표 (unit inspection checklist) templates.
 *
 * `metheim_unit` reproduces the Metheim 여수 임대세대 점검표 paper form verbatim:
 * the 입주물품 hand-over list plus six area groups, in the printed order. Item
 * codes are stable so a report seeded today stays comparable with one seeded a
 * year from now even if labels are reworded.
 *
 * Every label carries all six locales the products ship (ko/en/ja/zh/th/vi).
 * Row labels are NOT translated per report — the DB stores the Korean string for
 * reference and the display label is resolved from this table by `item_code` at
 * read time, so a tenant reading the signing link in Vietnamese and an admin
 * reading it in Korean see the same row.
 *
 * Templates are data, not schema — adding a template here makes it selectable
 * without a migration, and a report keeps its own copy of the items once seeded
 * (so later template edits never mutate signed history).
 */

export type InspectionGroupKey =
  | "provided"
  | "entrance"
  | "bathroom"
  | "kitchen"
  | "living"
  | "bedroom"
  | "boiler";

/** ko is the source of truth; the rest fall back to ko → en. */
export interface Localized {
  ko: string;
  en: string;
  ja: string;
  zh: string;
  th: string;
  vi: string;
}

/** Positional helper — order is ko, en, ja, zh, th, vi. */
const L = (ko: string, en: string, ja: string, zh: string, th: string, vi: string): Localized =>
  ({ ko, en, ja, zh, th, vi });

export function localize(value: Localized | string, lang?: string | null): string {
  if (typeof value === "string") return value;
  const key = (lang ?? "ko").slice(0, 2).toLowerCase() as keyof Localized;
  // An empty string is a deliberate translation ("호" has no English counterpart),
  // so only a MISSING key falls back — never a blank one.
  if (key in value && value[key] !== undefined) return value[key];
  return value.ko || value.en;
}

export interface InspectionTemplateItem {
  code: string;
  label: Localized;
}

export interface InspectionTemplateGroup {
  key: InspectionGroupKey;
  label: Localized;
  items: InspectionTemplateItem[];
}

export interface InspectionTemplate {
  key: string;
  name: Localized;
  /** Heading printed at the top of the paper form. */
  heading: Localized;
  /** Unit types offered in the header (타입 A B C D E). */
  unitTypes: string[];
  groups: InspectionTemplateGroup[];
  /** 특약 사항 — printed under the checklist, numbered as on the paper form. */
  specialTerms: Localized[];
  /** Fixed form chrome (타입 / 호수 / 검침 …), so the PDF localises as a whole. */
  chrome: Record<string, Localized>;
}

const g = (
  key: InspectionGroupKey,
  label: Localized,
  items: Array<[string, Localized]>,
): InspectionTemplateGroup => ({
  key,
  label,
  items: items.map(([code, itemLabel]) => ({ code: `${key}.${code}`, label: itemLabel })),
});

// Repeated fittings — declared once so the same fixture reads identically in
// every room (and a wording fix lands everywhere at once).
const LIGHT = L("전등", "Light", "照明", "灯", "ไฟ", "Đèn");
const SPRINKLER = L("스프링쿨러", "Sprinkler", "スプリンクラー", "喷淋头", "สปริงเกลอร์", "Đầu phun chữa cháy");
const SMOKE = L("화재 감지기", "Smoke detector", "火災感知器", "烟感器", "เครื่องตรวจจับควัน", "Đầu báo cháy");
const THERMOSTAT = L("보일러 온도조절기", "Boiler thermostat", "ボイラー温度調節器", "锅炉温控器", "เครื่องควบคุมอุณหภูมิบอยเลอร์", "Bộ điều nhiệt lò sưởi");
const WALLPAPER = L("벽지", "Wallpaper", "壁紙", "墙纸", "วอลเปเปอร์", "Giấy dán tường");
const FLOOR = L("강마루", "Engineered wood flooring", "強化フローリング", "强化木地板", "พื้นไม้เอ็นจิเนียร์", "Sàn gỗ công nghiệp");
const SASH_HANDLE = L("샷시 손잡이", "Window frame handle", "サッシ取手", "窗框把手", "มือจับกรอบหน้าต่าง", "Tay nắm khung cửa sổ");
const FLY_SCREEN = L("방충망", "Insect screen", "網戸", "纱窗", "มุ้งลวด", "Lưới chống côn trùng");
const WINDOW_SASH = L("창문 / 창틀 샷시", "Window / frame", "窓・窓枠サッシ", "窗户/窗框", "หน้าต่าง/กรอบหน้าต่าง", "Cửa sổ/khung cửa sổ");

export const METHEIM_UNIT_TEMPLATE: InspectionTemplate = {
  key: "metheim_unit",
  name: L(
    "메트하임 여수 임대세대 점검표",
    "Metheim Yeosu — Unit Inspection Checklist",
    "メトハイム麗水 賃貸住戸点検表",
    "Metheim 丽水 租赁房屋点检表",
    "Metheim ยอซู — แบบตรวจสภาพห้องเช่า",
    "Metheim Yeosu — Phiếu kiểm tra căn hộ cho thuê",
  ),
  heading: L(
    "임대세대 점검표",
    "Unit Inspection Checklist",
    "賃貸住戸点検表",
    "租赁房屋点检表",
    "แบบตรวจสภาพห้องเช่า",
    "Phiếu kiểm tra căn hộ cho thuê",
  ),
  unitTypes: ["A", "B", "C", "D", "E"],
  groups: [
    g("provided", L("입주물품", "Provided items", "入居備品", "入住物品", "ของที่จัดให้", "Vật dụng bàn giao"), [
      ["aircon_remote", L("에어컨 리모컨 (1개)", "Air-con remote (1)", "エアコンリモコン(1個)", "空调遥控器(1个)", "รีโมทแอร์ (1 อัน)", "Điều khiển máy lạnh (1 cái)")],
      ["hrv_remote", L("전열교환기 리모컨 (1개)", "HRV remote (1)", "熱交換換気リモコン(1個)", "全热交换器遥控器(1个)", "รีโมทเครื่องระบายอากาศ (1 อัน)", "Điều khiển bộ trao đổi nhiệt (1 cái)")],
      ["rf_card", L("현관 RF카드 (2장)", "Entrance RF cards (2)", "玄関RFカード(2枚)", "门禁RF卡(2张)", "บัตร RF ประตูหน้า (2 ใบ)", "Thẻ RF cửa chính (2 thẻ)")],
    ]),
    g("entrance", L("현관", "Entrance", "玄関", "玄关", "ทางเข้า", "Lối vào"), [
      ["fire_door", L("방화문", "Fire door", "防火扉", "防火门", "ประตูกันไฟ", "Cửa chống cháy")],
      ["door_lock", L("도어락", "Door lock", "ドアロック", "门锁", "ล็อกประตู", "Khóa cửa")],
      ["extinguisher", L("소화기", "Fire extinguisher", "消火器", "灭火器", "ถังดับเพลิง", "Bình chữa cháy")],
      ["sensor_light", L("센서등", "Sensor light", "センサーライト", "感应灯", "ไฟเซ็นเซอร์", "Đèn cảm ứng")],
      ["shoe_rack", L("신발장", "Shoe cabinet", "靴箱", "鞋柜", "ตู้รองเท้า", "Tủ giày")],
      ["wallpaper", WALLPAPER],
      ["mirror", L("거울", "Mirror", "鏡", "镜子", "กระจก", "Gương")],
      ["grout", L("줄눈", "Grouting", "目地", "填缝", "ยาแนว", "Ron gạch")],
      ["floor_tile", L("바닥타일", "Floor tiles", "床タイル", "地砖", "กระเบื้องพื้น", "Gạch lát sàn")],
      ["marble_sill", L("대리석문턱", "Marble threshold", "大理石框", "大理石门槛", "ธรณีประตูหินอ่อน", "Bậu cửa đá cẩm thạch")],
      ["master_switch", L("일괄소등스위치", "Master light switch", "一括消灯スイッチ", "一键关灯开关", "สวิตช์ปิดไฟรวม", "Công tắc tắt đèn tổng")],
    ]),
    g("bathroom", L("욕실", "Bathroom", "浴室", "浴室", "ห้องน้ำ", "Phòng tắm"), [
      ["door", L("욕실 문 (목문)", "Bathroom door (wooden)", "浴室ドア(木製)", "浴室门(木门)", "ประตูห้องน้ำ (ไม้)", "Cửa phòng tắm (gỗ)")],
      ["light", LIGHT],
      ["outlet", L("콘센트", "Power outlet", "コンセント", "插座", "ปลั๊กไฟ", "Ổ cắm điện")],
      ["mirror_cabinet", L("거울장", "Mirror cabinet", "ミラーキャビネット", "镜柜", "ตู้กระจก", "Tủ gương")],
      ["towel_rail", L("수건걸이", "Towel rail", "タオル掛け", "毛巾架", "ราวแขวนผ้า", "Giá treo khăn")],
      ["toilet", L("변기(작동/흔들림)", "Toilet (flush / wobble)", "便器(動作・ぐらつき)", "马桶(冲水/晃动)", "โถสุขภัณฑ์ (กดชักโครก/โยก)", "Bồn cầu (xả nước/lung lay)")],
      ["tile", L("벽 / 바닥 타일", "Wall / floor tiles", "壁・床タイル", "墙/地砖", "กระเบื้องผนัง/พื้น", "Gạch tường/sàn")],
      ["grout", L("벽 / 바닥 줄눈", "Wall / floor grouting", "壁・床目地", "墙/地填缝", "ยาแนวผนัง/พื้น", "Ron tường/sàn")],
      ["zendai", L("젠다이", "Ledge shelf", "ゼンダイ(棚)", "台面搁板", "ชั้นวางขอบผนัง", "Kệ đá bệ tường")],
      ["basin", L("세면대", "Wash basin", "洗面台", "洗手盆", "อ่างล้างหน้า", "Bồn rửa mặt")],
      ["basin_tap", L("세면대 수전", "Basin tap", "洗面台水栓", "洗手盆龙头", "ก๊อกอ่างล้างหน้า", "Vòi bồn rửa")],
      ["basin_popup", L("세면대 폽업마개", "Basin pop-up waste", "洗面台ポップアップ栓", "洗手盆弹跳落水", "จุกป็อปอัพอ่างล้างหน้า", "Nút xả bồn rửa")],
      ["shower_fan", L("샤워실 환풍기", "Shower extractor fan", "シャワー室換気扇", "淋浴间排气扇", "พัดลมดูดอากาศห้องอาบน้ำ", "Quạt hút phòng tắm")],
      ["shower_head", L("샤워헤드", "Shower head", "シャワーヘッド", "花洒", "ฝักบัว", "Vòi sen")],
      ["soap_holder", L("샤워기 비누받침대", "Shower soap holder", "シャワー石鹸置き", "淋浴皂盘", "ที่วางสบู่", "Kệ để xà phòng")],
      ["rain_shower", L("해바라기샤워헤드", "Rain shower head", "レインシャワーヘッド", "顶喷花洒", "ฝักบัวเรนชาวเวอร์", "Sen cây tròn")],
      ["shower_glass", L("샤워실 유리문/손잡이", "Shower glass door / handle", "シャワー室ガラス扉・取手", "淋浴玻璃门/把手", "ประตูกระจก/มือจับห้องอาบน้ำ", "Cửa kính/tay nắm phòng tắm")],
    ]),
    g("kitchen", L("주방", "Kitchen", "キッチン", "厨房", "ครัว", "Nhà bếp"), [
      ["light", LIGHT],
      ["sprinkler", SPRINKLER],
      ["range_hood", L("렌지후드", "Range hood", "レンジフード", "抽油烟机", "เครื่องดูดควัน", "Máy hút mùi")],
      ["auto_extinguisher", L("자동소화기", "Automatic extinguisher", "自動消火装置", "自动灭火器", "ระบบดับเพลิงอัตโนมัติ", "Bình chữa cháy tự động")],
      ["breaker", L("전기차단기", "Circuit breaker", "ブレーカー", "断路器", "เบรกเกอร์", "Cầu dao điện")],
      ["cabinets", L("주방가구", "Kitchen cabinetry", "キッチン家具", "厨房橱柜", "ตู้ครัว", "Tủ bếp")],
      ["cutlery_holder", L("수저통/행주걸이(A,B,C)", "Cutlery holder / cloth rail (A,B,C)", "カトラリーケース・布巾掛け(A・B・C)", "餐具筒/抹布架(A,B,C)", "ที่ใส่ช้อนส้อม/ราวผ้า (A,B,C)", "Hộp đũa/giá treo khăn (A,B,C)")],
      ["food_dehydrator", L("음식물탈수기/뚜껑2EA", "Food-waste dehydrator / lids (2)", "生ゴミ脱水機・蓋2個", "厨余脱水机/盖2个", "เครื่องปั่นแห้งเศษอาหาร/ฝา 2 ชิ้น", "Máy vắt rác thực phẩm/nắp 2 cái")],
      ["knife_block", L("싱크대 하단 칼보관함", "Knife store under sink", "シンク下包丁収納", "水槽下刀具收纳", "ที่เก็บมีดใต้ซิงก์", "Ngăn để dao dưới bồn rửa")],
      ["dish_rack", L("식기 건조대", "Dish rack", "食器乾燥ラック", "碗碟沥水架", "ที่คว่ำจาน", "Giá úp bát đĩa")],
      ["tile", L("주방타일", "Kitchen tiles", "キッチンタイル", "厨房瓷砖", "กระเบื้องครัว", "Gạch bếp")],
      ["washer", L("세탁기", "Washing machine", "洗濯機", "洗衣机", "เครื่องซักผ้า", "Máy giặt")],
      ["fridge", L("냉장고", "Refrigerator", "冷蔵庫", "冰箱", "ตู้เย็น", "Tủ lạnh")],
      ["floor", FLOOR],
      ["mobile_table", L("이동식 식탁(B,C타입)", "Movable dining table (B,C type)", "移動式ダイニングテーブル(B・Cタイプ)", "移动餐桌(B,C户型)", "โต๊ะอาหารเคลื่อนย้ายได้ (ชนิด B,C)", "Bàn ăn di động (loại B,C)")],
      ["folding_dryer", L("접이식 건조대(B,C타입)", "Folding drying rack (B,C type)", "折りたたみ物干し(B・Cタイプ)", "折叠晾衣架(B,C户型)", "ราวตากผ้าพับได้ (ชนิด B,C)", "Giá phơi gấp (loại B,C)")],
    ]),
    g("living", L("거실", "Living room", "リビング", "客厅", "ห้องนั่งเล่น", "Phòng khách"), [
      ["light", LIGHT],
      ["sprinkler", SPRINKLER],
      ["smoke_detector", SMOKE],
      ["boiler_thermostat", THERMOSTAT],
      ["comms_box", L("통신단자함", "Comms distribution box", "通信端子盤", "通信端子箱", "ตู้กระจายสัญญาณสื่อสาร", "Hộp đầu nối viễn thông")],
      ["distribution_box", L("세대분전함(두꺼비집)", "Consumer unit (breaker box)", "分電盤", "户内配电箱", "ตู้ไฟฟ้าประจำห้อง", "Tủ điện căn hộ")],
      ["wall_pad", L("월패드(홈네트웍)", "Wall pad (home network)", "ウォールパッド(ホームネットワーク)", "壁挂屏(智能家居)", "จอควบคุมบ้าน (โฮมเน็ตเวิร์ก)", "Màn hình điều khiển nhà")],
      ["tv_stand", L("티비장/접이식테이블", "TV unit / folding table", "テレビ台・折りたたみテーブル", "电视柜/折叠桌", "ตู้ทีวี/โต๊ะพับ", "Kệ tivi/bàn gấp")],
      ["tv_cabinet_hook", L("티비수납장고리", "TV cabinet hook", "テレビ収納棚フック", "电视柜挂钩", "ตะขอตู้ทีวี", "Móc tủ tivi")],
      ["wallpaper", WALLPAPER],
      ["floor", FLOOR],
      ["aircon", L("에어컨", "Air conditioner", "エアコン", "空调", "เครื่องปรับอากาศ", "Máy lạnh")],
      ["hrv", L("전열 교환기", "Heat recovery ventilator", "熱交換換気システム", "全热交换器", "เครื่องแลกเปลี่ยนความร้อน", "Bộ trao đổi nhiệt")],
      ["sash_handle", SASH_HANDLE],
      ["fly_screen", FLY_SCREEN],
      ["window_sash", WINDOW_SASH],
    ]),
    g("bedroom", L("침실", "Bedroom", "寝室", "卧室", "ห้องนอน", "Phòng ngủ"), [
      ["light", LIGHT],
      ["sprinkler", SPRINKLER],
      ["smoke_detector", SMOKE],
      ["speaker", L("스피커", "Speaker", "スピーカー", "音响", "ลำโพง", "Loa")],
      ["boiler_thermostat", THERMOSTAT],
      ["wardrobe", L("붙박이장", "Built-in wardrobe", "造り付けクローゼット", "嵌入式衣柜", "ตู้เสื้อผ้าบิลท์อิน", "Tủ quần áo âm tường")],
      ["dresser", L("화장대", "Dressing table", "ドレッサー", "梳妆台", "โต๊ะเครื่องแป้ง", "Bàn trang điểm")],
      ["door", L("방 문(목문)", "Room door (wooden)", "部屋のドア(木製)", "房门(木门)", "ประตูห้อง (ไม้)", "Cửa phòng (gỗ)")],
      ["wallpaper", WALLPAPER],
      ["floor", FLOOR],
      ["sash_handle", SASH_HANDLE],
      ["fly_screen", FLY_SCREEN],
      ["window_sash", WINDOW_SASH],
    ]),
    g("boiler", L("보일러 + 실외기실", "Boiler & outdoor unit room", "ボイラー・室外機室", "锅炉+室外机房", "ห้องบอยเลอร์และคอมเพรสเซอร์", "Phòng lò sưởi & cục nóng"), [
      ["light", LIGHT],
      ["gas_safety", L("가스 안전장치", "Gas safety device", "ガス安全装置", "燃气安全装置", "อุปกรณ์นิรภัยแก๊ส", "Thiết bị an toàn gas")],
      ["boiler", L("보일러", "Boiler", "ボイラー", "锅炉", "บอยเลอร์", "Lò sưởi")],
      ["outdoor_unit", L("실외기", "Outdoor unit", "室外機", "室外机", "คอมเพรสเซอร์แอร์", "Cục nóng")],
      ["switch", L("스위치", "Switch", "スイッチ", "开关", "สวิตช์", "Công tắc")],
      ["drain", L("배수관 / 배수구", "Drain pipe / floor drain", "排水管・排水口", "排水管/地漏", "ท่อระบายน้ำ/รูระบายน้ำ", "Ống thoát/lỗ thoát nước")],
      ["fire_door_handle", L("보일러 방화문 손잡이", "Boiler-room fire door handle", "ボイラー室防火扉取手", "锅炉间防火门把手", "มือจับประตูกันไฟห้องบอยเลอร์", "Tay nắm cửa chống cháy phòng lò")],
      ["gallery_screen", L("갤러리창 방충망", "Louvre window insect screen", "ガラリ窓網戸", "百叶窗纱窗", "มุ้งลวดหน้าต่างเกล็ด", "Lưới cửa chớp")],
      ["gallery_window", L("갤러리 창 작동여부", "Louvre window operation", "ガラリ窓の作動", "百叶窗开合", "การใช้งานหน้าต่างเกล็ด", "Hoạt động cửa chớp")],
    ]),
  ],
  specialTerms: [
    L(
      "위 세대점검표는 아파트시설관리차원에서 추후 하자 관리와 더불어 입주전 하자점검에서 발견된 부분을 임대인과 임차인 모두 인지하고 있다는 것에 동의하고 작성한다.",
      "This checklist is completed for facility-management purposes, both landlord and tenant agreeing that they are aware of the defects found at the pre-move-in inspection and that these will be tracked thereafter.",
      "本点検表は施設管理の観点から、入居前点検で発見された不具合を貸主・借主の双方が認識していることに同意のうえ作成する。",
      "本点检表基于设施管理目的填写，出租方与承租方均确认知悉入住前点检中发现的缺陷，并同意后续据此进行管理。",
      "แบบตรวจนี้จัดทำขึ้นเพื่อการบริหารจัดการอาคาร โดยผู้ให้เช่าและผู้เช่ารับทราบร่วมกันถึงความชำรุดที่พบในการตรวจก่อนเข้าอยู่ และตกลงให้ใช้เป็นฐานในการดูแลต่อไป",
      "Phiếu kiểm tra này được lập nhằm mục đích quản lý cơ sở vật chất; bên cho thuê và bên thuê cùng xác nhận đã biết các hư hỏng phát hiện khi kiểm tra trước khi nhận nhà và đồng ý theo dõi trên cơ sở đó.",
    ),
    L(
      "퇴거 시 퇴거점검 이후 세대점검표에 작성된 입주하자부분 이외 추가로 고의적 파손에 대한 원상복구비용은 보증금에서 공제한다. ※세대 내 못질, 스티커 자국 금지 — 못자국 및 스티커 자국으로 인한 벽지 등 파손 등.",
      "At move-out, the cost of restoring any deliberate damage beyond the move-in defects recorded here is deducted from the deposit. Note: nails and stickers are not permitted — damage to wallpaper and the like from nail holes or sticker marks is chargeable.",
      "退去時、退去点検の結果、本点検表に記載された入居時の不具合以外に故意による破損があった場合、その原状回復費用は保証金から控除する。※室内での釘打ち・シール貼付は禁止。釘跡やシール跡による壁紙などの破損を含む。",
      "退租时，若退租点检后发现除本表所载入住缺陷之外的故意损坏，其恢复原状费用将从押金中扣除。※室内禁止钉钉子、贴贴纸——因钉孔或贴纸痕迹造成的墙纸等损坏亦包含在内。",
      "เมื่อย้ายออก หากตรวจพบความเสียหายโดยเจตนานอกเหนือจากความชำรุดตอนเข้าอยู่ที่บันทึกไว้ในแบบนี้ ค่าซ่อมคืนสภาพจะถูกหักจากเงินประกัน ※ห้ามตอกตะปูหรือติดสติกเกอร์ภายในห้อง รวมถึงความเสียหายของวอลเปเปอร์จากรอยตะปูและรอยสติกเกอร์",
      "Khi trả nhà, chi phí khôi phục các hư hỏng do cố ý ngoài những hư hỏng lúc nhận nhà đã ghi trong phiếu này sẽ được trừ vào tiền đặt cọc. ※Không đóng đinh, dán sticker trong căn hộ — bao gồm hư hỏng giấy dán tường do vết đinh và vết sticker.",
    ),
    L(
      "임차인은 퇴거 시 세대 내 자연적 노후로 인한 하자는 책임지지 않는다. (예시: 벽지변색, 전등, 줄눈변색, 실리콘 변색 등)",
      "The tenant is not liable at move-out for defects arising from normal ageing (e.g. discoloured wallpaper, lights, discoloured grouting or silicone).",
      "借主は退去時、経年劣化による不具合について責任を負わない。(例: 壁紙の変色、照明、目地の変色、シリコンの変色など)",
      "承租方在退租时无需对自然老化造成的缺陷负责。(例如: 墙纸变色、灯具、填缝变色、硅胶变色等)",
      "ผู้เช่าไม่ต้องรับผิดชอบต่อความชำรุดที่เกิดจากการเสื่อมสภาพตามธรรมชาติเมื่อย้ายออก (เช่น วอลเปเปอร์สีเปลี่ยน หลอดไฟ ยาแนวสีเปลี่ยน ซิลิโคนสีเปลี่ยน)",
      "Bên thuê không chịu trách nhiệm về các hư hỏng do hao mòn tự nhiên khi trả nhà (ví dụ: giấy dán tường phai màu, bóng đèn, ron gạch đổi màu, silicone đổi màu).",
    ),
  ],
  chrome: {
    unitType: L("타 입", "Type", "タイプ", "户型", "ประเภท", "Loại"),
    unitNo: L("호 수", "Unit no.", "部屋番号", "房号", "เลขห้อง", "Số căn"),
    unitSuffix: L("호", "", "号室", "室", "", ""),
    tenantName: L("임차인명", "Tenant", "入居者名", "租客姓名", "ชื่อผู้เช่า", "Người thuê"),
    tenantPhone: L("연 락 처", "Phone", "連絡先", "联系电话", "เบอร์ติดต่อ", "Điện thoại"),
    moveInDate: L("입 주 일", "Move-in date", "入居日", "入住日", "วันเข้าอยู่", "Ngày nhận nhà"),
    moveOutDate: L("퇴 거 일", "Move-out date", "退去日", "退租日", "วันย้ายออก", "Ngày trả nhà"),
    inspectionSection: L("[점 검 내 용]", "[Readings]", "[点検内容]", "[点检内容]", "[รายการตรวจ]", "[Nội dung kiểm tra]"),
    metersIn: L("전 입 / 검침 내역", "Move-in meter readings", "入居時 検針", "入住抄表", "ค่ามิเตอร์ตอนเข้าอยู่", "Chỉ số khi nhận nhà"),
    metersOut: L("전 출 / 검침 내역", "Move-out meter readings", "退去時 検針", "退租抄表", "ค่ามิเตอร์ตอนย้ายออก", "Chỉ số khi trả nhà"),
    electric: L("전 기", "Electricity", "電気", "电", "ไฟฟ้า", "Điện"),
    water: L("수 도", "Water", "水道", "水", "น้ำประปา", "Nước"),
    gas: L("가 스", "Gas", "ガス", "燃气", "แก๊ส", "Gas"),
    defectsSection: L("[하 자 내 용]", "[Defects]", "[不具合内容]", "[缺陷内容]", "[รายการชำรุด]", "[Nội dung hư hỏng]"),
    groupCol: L("구 분", "Area", "区分", "区分", "หมวด", "Khu vực"),
    itemCol: L("항 목", "Item", "項目", "项目", "รายการ", "Hạng mục"),
    inspectorIn: L("입주하자 점검자", "Move-in inspector", "入居点検者", "入住点检人", "ผู้ตรวจตอนเข้าอยู่", "Người kiểm tra khi nhận nhà"),
    inspectorOut: L("퇴거하자 점검자", "Move-out inspector", "退去点検者", "退租点检人", "ผู้ตรวจตอนย้ายออก", "Người kiểm tra khi trả nhà"),
    confirmedOn: L("확 인 일", "Confirmed on", "確認日", "确认日期", "วันที่ยืนยัน", "Ngày xác nhận"),
    tenantConfirm: L("임차인 확인", "Tenant confirmation", "入居者確認", "租客确认", "การยืนยันของผู้เช่า", "Xác nhận của người thuê"),
    signature: L("(서명)", "(signature)", "(署名)", "(签名)", "(ลายเซ็น)", "(chữ ký)"),
    remarks: L("비 고", "Remarks", "備考", "备注", "หมายเหตุ", "Ghi chú"),
    specialTerms: L("[특약 사항]", "[Special terms]", "[特約事項]", "[特别约定]", "[ข้อตกลงพิเศษ]", "[Điều khoản đặc biệt]"),
    extraItems: L("추가 항목", "Additional items", "追加項目", "追加项目", "รายการเพิ่มเติม", "Hạng mục bổ sung"),
    statusOk: L("이상없음", "No issue", "異常なし", "无异常", "ปกติ", "Bình thường"),
    statusDefect: L("하자", "Defect", "不具合", "缺陷", "ชำรุด", "Hư hỏng"),
    statusNa: L("해당없음", "N/A", "該当なし", "不适用", "ไม่มี", "Không áp dụng"),
    photoCount: L("사진", "Photos", "写真", "照片", "รูป", "Ảnh"),
    datePlaceholder: L("202 년 월 일", "202  /   /", "202 年  月  日", "202 年  月  日", "202 / / ", "202 / /"),
    yearPlaceholder: L("20 . .", "20  /   /", "20 . .", "20 . .", "20 / /", "20 / /"),
  },
};

export const INSPECTION_TEMPLATES: Record<string, InspectionTemplate> = {
  [METHEIM_UNIT_TEMPLATE.key]: METHEIM_UNIT_TEMPLATE,
};

export const DEFAULT_INSPECTION_TEMPLATE_KEY = METHEIM_UNIT_TEMPLATE.key;

export function getInspectionTemplate(key?: string | null): InspectionTemplate {
  return INSPECTION_TEMPLATES[key ?? ""] ?? METHEIM_UNIT_TEMPLATE;
}

/** Chrome label shorthand. */
export function chrome(template: InspectionTemplate, key: string, lang?: string | null): string {
  const value = template.chrome[key];
  return value ? localize(value, lang) : "";
}

/** Every template row's label, keyed by item_code — used to localise stored rows. */
export function labelIndex(template: InspectionTemplate): Map<string, Localized> {
  const map = new Map<string, Localized>();
  for (const group of template.groups) {
    for (const item of group.items) map.set(item.code, item.label);
  }
  return map;
}

/**
 * Flatten a template into insertable item rows (order preserved).
 * The stored `label` is Korean — the source of truth for the paper form; display
 * labels are resolved per request from `labelIndex`.
 */
export function templateItemRows(template: InspectionTemplate): Array<{
  group_key: string;
  item_code: string;
  label: string;
  sort_order: number;
}> {
  const rows: Array<{ group_key: string; item_code: string; label: string; sort_order: number }> = [];
  let order = 0;
  for (const group of template.groups) {
    for (const item of group.items) {
      rows.push({ group_key: group.key, item_code: item.code, label: item.label.ko, sort_order: order++ });
    }
  }
  return rows;
}
