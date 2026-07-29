import type { DocLang } from "./i18n.js";

/**
 * Labels for the application-family documents (student / host family /
 * short-term / placement agreement) and the service-host brief.
 *
 * These documents are built from long, form-shaped label→value lists, so the
 * English label doubles as the lookup key: `al(lang, "Date of birth")`. That
 * keeps the ~120 call sites readable and makes an unknown label degrade to the
 * English text rather than to a raw key. Shared document chrome (status chips,
 * money, dates, service names) still comes from `i18n.ts`.
 */
type Row = Readonly<Record<Exclude<DocLang, "en">, string>>;

const LABELS: Readonly<Record<string, Row>> = {
  // ── Document types ────────────────────────────────────────────────────────
  "Student Application":                  { ko: "학생 신청서", ja: "学生申込書", zh: "学生申请表", th: "ใบสมัครนักเรียน", vi: "Đơn đăng ký học sinh" },
  "Host Family Application":              { ko: "호스트 가정 신청서", ja: "ホストファミリー申込書", zh: "寄宿家庭申请表", th: "ใบสมัครครอบครัวอุปถัมภ์", vi: "Đơn đăng ký gia đình bản xứ" },
  "Short-term Accommodation Application": { ko: "단기 숙박 신청서", ja: "短期宿泊申込書", zh: "短期住宿申请表", th: "ใบสมัครที่พักระยะสั้น", vi: "Đơn đăng ký lưu trú ngắn hạn" },
  "Homestay Placement Agreement":         { ko: "홈스테이 배정 계약서", ja: "ホームステイ配属契約書", zh: "寄宿安置协议", th: "ข้อตกลงการจัดที่พักโฮมสเตย์", vi: "Thỏa thuận sắp xếp homestay" },

  // ── Section headings ──────────────────────────────────────────────────────
  "Additional comment":             { ko: "추가 의견", ja: "追加コメント", zh: "补充说明", th: "ความคิดเห็นเพิ่มเติม", vi: "Nhận xét bổ sung" },
  "Additional contact & referral":  { ko: "추가 연락처 및 추천", ja: "追加連絡先・紹介", zh: "其他联系人与推荐", th: "ผู้ติดต่อเพิ่มเติมและการแนะนำ", vi: "Liên hệ bổ sung & giới thiệu" },
  "Agreement terms":                { ko: "계약 조건", ja: "契約条件", zh: "协议条款", th: "เงื่อนไขข้อตกลง", vi: "Điều khoản thỏa thuận" },
  "Airport pickup":                 { ko: "공항 픽업", ja: "空港送迎", zh: "机场接送", th: "รับส่งสนามบิน", vi: "Đón sân bay" },
  "Applicant":                      { ko: "신청인", ja: "申込者", zh: "申请人", th: "ผู้สมัคร", vi: "Người đăng ký" },
  "Arrival support add-ons":        { ko: "도착 지원 부가서비스", ja: "到着サポート オプション", zh: "抵达支持附加服务", th: "บริการเสริมช่วยเหลือเมื่อเดินทางถึง", vi: "Dịch vụ hỗ trợ khi đến" },
  "Beliefs":                        { ko: "종교·신념", ja: "信仰", zh: "信仰", th: "ความเชื่อ", vi: "Tín ngưỡng" },
  "Dietary":                        { ko: "식단", ja: "食事", zh: "饮食", th: "อาหาร", vi: "Chế độ ăn" },
  "Emergency contact":              { ko: "비상 연락처", ja: "緊急連絡先", zh: "紧急联系人", th: "ผู้ติดต่อฉุกเฉิน", vi: "Liên hệ khẩn cấp" },
  "Fees — initial payment (due now)": { ko: "비용 — 초기 결제 (현재 청구)", ja: "費用 — 初回支払い（今回請求）", zh: "费用 — 首期付款（现应付）", th: "ค่าธรรมเนียม — ชำระครั้งแรก (ครบกำหนดตอนนี้)", vi: "Phí — thanh toán ban đầu (đến hạn)" },
  "Fees — ongoing (monthly)":       { ko: "비용 — 정기 (월)", ja: "費用 — 継続（月額）", zh: "费用 — 持续（每月）", th: "ค่าธรรมเนียม — ต่อเนื่อง (รายเดือน)", vi: "Phí — định kỳ (hàng tháng)" },
  "Food avoided":                   { ko: "기피 음식", ja: "避けたい食べ物", zh: "忌口食物", th: "อาหารที่หลีกเลี่ยง", vi: "Thực phẩm cần tránh" },
  "Guardian":                       { ko: "보호자", ja: "保護者", zh: "监护人", th: "ผู้ปกครอง", vi: "Người giám hộ" },
  "Hobbies":                        { ko: "취미", ja: "趣味", zh: "爱好", th: "งานอดิเรก", vi: "Sở thích" },
  "Home & rooms":                   { ko: "주택 및 객실", ja: "住居・部屋", zh: "住宅与房间", th: "บ้านและห้องพัก", vi: "Nhà & phòng" },
  "Homestay":                       { ko: "홈스테이", ja: "ホームステイ", zh: "寄宿家庭", th: "โฮมสเตย์", vi: "Homestay" },
  "Homestay preferences":           { ko: "홈스테이 선호사항", ja: "ホームステイ希望条件", zh: "寄宿偏好", th: "ความต้องการโฮมสเตย์", vi: "Ưu tiên homestay" },
  "Host Family":                    { ko: "호스트 가정", ja: "ホストファミリー", zh: "寄宿家庭", th: "ครอบครัวอุปถัมภ์", vi: "Gia đình bản xứ" },
  "Host family":                    { ko: "호스트 가정", ja: "ホストファミリー", zh: "寄宿家庭", th: "ครอบครัวอุปถัมภ์", vi: "Gia đình bản xứ" },
  "Household":                      { ko: "가구 구성", ja: "世帯", zh: "家庭成员", th: "สมาชิกในบ้าน", vi: "Thành viên gia đình" },
  "Notes":                          { ko: "비고", ja: "備考", zh: "备注", th: "หมายเหตุ", vi: "Ghi chú" },
  "Other requirements":             { ko: "기타 요청사항", ja: "その他の要望", zh: "其他要求", th: "ข้อกำหนดอื่น ๆ", vi: "Yêu cầu khác" },
  "Profile description":            { ko: "프로필 소개", ja: "プロフィール紹介", zh: "简介说明", th: "คำอธิบายโปรไฟล์", vi: "Mô tả hồ sơ" },
  "School":                         { ko: "학교", ja: "学校", zh: "学校", th: "โรงเรียน", vi: "Trường học" },
  "Self introduction":              { ko: "자기소개", ja: "自己紹介", zh: "自我介绍", th: "แนะนำตัว", vi: "Giới thiệu bản thân" },
  "Signatures":                     { ko: "서명", ja: "署名", zh: "签名", th: "ลายเซ็น", vi: "Chữ ký" },
  "Stay details":                   { ko: "체류 정보", ja: "滞在情報", zh: "入住信息", th: "รายละเอียดการเข้าพัก", vi: "Chi tiết lưu trú" },
  "Student":                        { ko: "학생", ja: "学生", zh: "学生", th: "นักเรียน", vi: "Học sinh" },
  "Student (Customer)":             { ko: "학생 (고객)", ja: "学生（お客様）", zh: "学生（客户）", th: "นักเรียน (ลูกค้า)", vi: "Học sinh (khách hàng)" },
  "Student preferences & packages": { ko: "학생 선호사항 및 패키지", ja: "学生の希望とパッケージ", zh: "学生偏好与套餐", th: "ความต้องการและแพ็กเกจของนักเรียน", vi: "Ưu tiên & gói của học sinh" },
  "Welcome message":                { ko: "환영 메시지", ja: "ウェルカムメッセージ", zh: "欢迎致辞", th: "ข้อความต้อนรับ", vi: "Lời chào mừng" },

  // ── Field labels ──────────────────────────────────────────────────────────
  "Address":                     { ko: "주소", ja: "住所", zh: "地址", th: "ที่อยู่", vi: "Địa chỉ" },
  "Allergic to pets":            { ko: "반려동물 알레르기", ja: "ペットアレルギー", zh: "对宠物过敏", th: "แพ้สัตว์เลี้ยง", vi: "Dị ứng thú cưng" },
  "Arrival date":                { ko: "도착일", ja: "到着日", zh: "抵达日期", th: "วันที่เดินทางถึง", vi: "Ngày đến" },
  "Arrival time":                { ko: "도착 시각", ja: "到着時刻", zh: "抵达时间", th: "เวลาที่เดินทางถึง", vi: "Giờ đến" },
  "Billing cycle":               { ko: "청구 주기", ja: "請求サイクル", zh: "账单周期", th: "รอบการเรียกเก็บเงิน", vi: "Chu kỳ thanh toán" },
  "Building type":               { ko: "건물 유형", ja: "建物種別", zh: "建筑类型", th: "ประเภทอาคาร", vi: "Loại tòa nhà" },
  "Campus location":             { ko: "캠퍼스 위치", ja: "キャンパス所在地", zh: "校区位置", th: "ที่ตั้งวิทยาเขต", vi: "Vị trí cơ sở" },
  "Can live with children":      { ko: "아동과 동거 가능", ja: "子どもと同居可", zh: "可与儿童同住", th: "อยู่ร่วมกับเด็กได้", vi: "Có thể ở cùng trẻ em" },
  "Can live with other students": { ko: "다른 학생과 동거 가능", ja: "他の学生と同居可", zh: "可与其他学生同住", th: "อยู่ร่วมกับนักเรียนคนอื่นได้", vi: "Có thể ở cùng học sinh khác" },
  "Can live with pets":          { ko: "반려동물과 동거 가능", ja: "ペットと同居可", zh: "可与宠物同住", th: "อยู่ร่วมกับสัตว์เลี้ยงได้", vi: "Có thể ở cùng thú cưng" },
  "Can live with smokers":       { ko: "흡연자와 동거 가능", ja: "喫煙者と同居可", zh: "可与吸烟者同住", th: "อยู่ร่วมกับผู้สูบบุหรี่ได้", vi: "Có thể ở cùng người hút thuốc" },
  "Check-in":                    { ko: "체크인", ja: "チェックイン", zh: "入住", th: "เช็คอิน", vi: "Nhận phòng" },
  "Check-out":                   { ko: "체크아웃", ja: "チェックアウト", zh: "退房", th: "เช็คเอาต์", vi: "Trả phòng" },
  "Contact no.":                 { ko: "연락처", ja: "連絡先", zh: "联系电话", th: "เบอร์ติดต่อ", vi: "Số liên hệ" },
  "Course":                      { ko: "과정", ja: "コース", zh: "课程", th: "หลักสูตร", vi: "Khóa học" },
  "Course start date":           { ko: "과정 시작일", ja: "コース開始日", zh: "课程开始日期", th: "วันเริ่มหลักสูตร", vi: "Ngày bắt đầu khóa học" },
  "Cultural background":         { ko: "문화적 배경", ja: "文化的背景", zh: "文化背景", th: "ภูมิหลังทางวัฒนธรรม", vi: "Nền tảng văn hóa" },
  "Currency":                    { ko: "통화", ja: "通貨", zh: "货币", th: "สกุลเงิน", vi: "Tiền tệ" },
  "Date of birth":               { ko: "생년월일", ja: "生年月日", zh: "出生日期", th: "วันเกิด", vi: "Ngày sinh" },
  "Dietary accommodations":      { ko: "식단 배려", ja: "食事対応", zh: "饮食安排", th: "การจัดอาหารพิเศษ", vi: "Đáp ứng chế độ ăn" },
  "Dietary catered":             { ko: "식단 제공", ja: "食事提供", zh: "提供饮食", th: "จัดอาหารให้", vi: "Cung cấp bữa ăn theo chế độ" },
  "Dietary notes":               { ko: "식단 비고", ja: "食事に関する備考", zh: "饮食备注", th: "หมายเหตุด้านอาหาร", vi: "Ghi chú chế độ ăn" },
  "Drinking in home":            { ko: "실내 음주", ja: "家庭内飲酒", zh: "家中饮酒", th: "การดื่มสุราในบ้าน", vi: "Uống rượu trong nhà" },
  "Duration (weeks)":            { ko: "기간 (주)", ja: "期間（週）", zh: "时长（周）", th: "ระยะเวลา (สัปดาห์)", vi: "Thời lượng (tuần)" },
  "Email":                       { ko: "이메일", ja: "メールアドレス", zh: "邮箱", th: "อีเมล", vi: "Email" },
  "English level":               { ko: "영어 수준", ja: "英語レベル", zh: "英语水平", th: "ระดับภาษาอังกฤษ", vi: "Trình độ tiếng Anh" },
  "Extra contact email":         { ko: "추가 연락처 이메일", ja: "追加連絡先メール", zh: "其他联系人邮箱", th: "อีเมลผู้ติดต่อเพิ่มเติม", vi: "Email liên hệ bổ sung" },
  "Extra contact phone":         { ko: "추가 연락처 전화", ja: "追加連絡先電話", zh: "其他联系人电话", th: "โทรศัพท์ผู้ติดต่อเพิ่มเติม", vi: "Điện thoại liên hệ bổ sung" },
  "Extra contact relationship":  { ko: "추가 연락처 관계", ja: "追加連絡先の続柄", zh: "其他联系人关系", th: "ความสัมพันธ์ผู้ติดต่อเพิ่มเติม", vi: "Quan hệ liên hệ bổ sung" },
  "Flight no.":                  { ko: "항공편", ja: "便名", zh: "航班号", th: "เที่ยวบิน", vi: "Số hiệu chuyến bay" },
  "Gender":                      { ko: "성별", ja: "性別", zh: "性别", th: "เพศ", vi: "Giới tính" },
  "Guest drinking allowed":      { ko: "손님 음주 허용", ja: "来客の飲酒可", zh: "允许访客饮酒", th: "อนุญาตให้แขกดื่มสุรา", vi: "Cho phép khách uống rượu" },
  "Guests":                      { ko: "손님", ja: "来客", zh: "访客", th: "แขก", vi: "Khách" },
  "Has pets":                    { ko: "반려동물 보유", ja: "ペット飼育", zh: "养有宠物", th: "มีสัตว์เลี้ยง", vi: "Có thú cưng" },
  "Heard about us":              { ko: "알게 된 경로", ja: "当社を知った経緯", zh: "了解渠道", th: "รู้จักเราจาก", vi: "Biết đến chúng tôi qua" },
  "Home features":               { ko: "주택 시설", ja: "住居の設備", zh: "住宅设施", th: "สิ่งอำนวยความสะดวกในบ้าน", vi: "Tiện nghi nhà" },
  "Home type":                   { ko: "주택 유형", ja: "住居タイプ", zh: "住宅类型", th: "ประเภทบ้าน", vi: "Loại nhà" },
  "Host":                        { ko: "호스트", ja: "ホスト", zh: "寄宿家庭", th: "เจ้าบ้าน", vi: "Chủ nhà" },
  "Meal packages":               { ko: "식사 패키지", ja: "食事パッケージ", zh: "餐食套餐", th: "แพ็กเกจอาหาร", vi: "Gói bữa ăn" },
  "Meals":                       { ko: "식사", ja: "食事", zh: "餐食", th: "มื้ออาหาร", vi: "Bữa ăn" },
  "Minor":                       { ko: "미성년자", ja: "未成年", zh: "未成年", th: "ผู้เยาว์", vi: "Vị thành niên" },
  "Minor (under 18)":            { ko: "미성년자 (만 18세 미만)", ja: "未成年（18歳未満）", zh: "未成年（18岁以下）", th: "ผู้เยาว์ (อายุต่ำกว่า 18 ปี)", vi: "Vị thành niên (dưới 18 tuổi)" },
  "Monthly accommodation fee":   { ko: "월 숙박비", ja: "月額宿泊費", zh: "每月住宿费", th: "ค่าที่พักรายเดือน", vi: "Phí lưu trú hàng tháng" },
  "Move-in date":                { ko: "입주일", ja: "入居日", zh: "入住日期", th: "วันเข้าพัก", vi: "Ngày dọn vào" },
  "Move-in flexible":            { ko: "입주일 조정 가능", ja: "入居日調整可", zh: "入住日期可调整", th: "วันเข้าพักยืดหยุ่นได้", vi: "Ngày dọn vào linh hoạt" },
  "Move-out date":               { ko: "퇴거일", ja: "退去日", zh: "退租日期", th: "วันย้ายออก", vi: "Ngày dọn ra" },
  "Name":                        { ko: "이름", ja: "氏名", zh: "姓名", th: "ชื่อ", vi: "Họ tên" },
  "Nationality":                 { ko: "국적", ja: "国籍", zh: "国籍", th: "สัญชาติ", vi: "Quốc tịch" },
  "Native language":             { ko: "모국어", ja: "母語", zh: "母语", th: "ภาษาแม่", vi: "Tiếng mẹ đẻ" },
  "Option":                      { ko: "옵션", ja: "オプション", zh: "选项", th: "ตัวเลือก", vi: "Tùy chọn" },
  "Packages offered":            { ko: "제공 패키지", ja: "提供パッケージ", zh: "提供的套餐", th: "แพ็กเกจที่เสนอ", vi: "Gói cung cấp" },
  "Payment method":              { ko: "결제 수단", ja: "支払方法", zh: "支付方式", th: "วิธีชำระเงิน", vi: "Phương thức thanh toán" },
  "Pet notes":                   { ko: "반려동물 비고", ja: "ペットに関する備考", zh: "宠物备注", th: "หมายเหตุสัตว์เลี้ยง", vi: "Ghi chú thú cưng" },
  "Pet types":                   { ko: "반려동물 종류", ja: "ペットの種類", zh: "宠物种类", th: "ประเภทสัตว์เลี้ยง", vi: "Loại thú cưng" },
  "Pets":                        { ko: "반려동물", ja: "ペット", zh: "宠物", th: "สัตว์เลี้ยง", vi: "Thú cưng" },
  "Phone":                       { ko: "전화번호", ja: "電話番号", zh: "电话", th: "โทรศัพท์", vi: "Điện thoại" },
  "Preferred area":              { ko: "희망 지역", ja: "希望エリア", zh: "期望区域", th: "พื้นที่ที่ต้องการ", vi: "Khu vực mong muốn" },
  "Preferred student age":       { ko: "선호 학생 연령", ja: "希望する学生の年齢", zh: "期望学生年龄", th: "อายุนักเรียนที่ต้องการ", vi: "Độ tuổi học sinh mong muốn" },
  "Preferred student gender":    { ko: "선호 학생 성별", ja: "希望する学生の性別", zh: "期望学生性别", th: "เพศนักเรียนที่ต้องการ", vi: "Giới tính học sinh mong muốn" },
  "Property type":               { ko: "매물 유형", ja: "物件タイプ", zh: "房源类型", th: "ประเภทอสังหาริมทรัพย์", vi: "Loại bất động sản" },
  "Provider":                    { ko: "제공자", ja: "提供者", zh: "提供方", th: "ผู้ให้บริการ", vi: "Nhà cung cấp" },
  "Referral — heard about":      { ko: "추천 — 알게 된 경로", ja: "紹介 — 認知経路", zh: "推荐 — 了解渠道", th: "การแนะนำ — รู้จักจาก", vi: "Giới thiệu — biết đến qua" },
  "Referred by host":            { ko: "호스트 추천 여부", ja: "ホストからの紹介", zh: "由寄宿家庭推荐", th: "แนะนำโดยเจ้าบ้าน", vi: "Được chủ nhà giới thiệu" },
  "Referrer name":               { ko: "추천인 이름", ja: "紹介者氏名", zh: "推荐人姓名", th: "ชื่อผู้แนะนำ", vi: "Tên người giới thiệu" },
  "Relationship":                { ko: "관계", ja: "続柄", zh: "关系", th: "ความสัมพันธ์", vi: "Quan hệ" },
  "Relationship with host":      { ko: "호스트와의 관계", ja: "ホストとの続柄", zh: "与寄宿家庭的关系", th: "ความสัมพันธ์กับเจ้าบ้าน", vi: "Quan hệ với chủ nhà" },
  "Resident under 18 in home":   { ko: "가정 내 18세 미만 거주자", ja: "世帯内の18歳未満の同居者", zh: "家中有18岁以下成员", th: "มีผู้อาศัยอายุต่ำกว่า 18 ปีในบ้าน", vi: "Có người dưới 18 tuổi trong nhà" },
  "Room features":               { ko: "객실 시설", ja: "部屋の設備", zh: "房间设施", th: "สิ่งอำนวยความสะดวกในห้อง", vi: "Tiện nghi phòng" },
  "Room type":                   { ko: "객실 유형", ja: "部屋タイプ", zh: "房型", th: "ประเภทห้อง", vi: "Loại phòng" },
  "Selected":                    { ko: "선택 항목", ja: "選択内容", zh: "已选", th: "รายการที่เลือก", vi: "Đã chọn" },
  "Smoker":                      { ko: "흡연 여부", ja: "喫煙の有無", zh: "是否吸烟", th: "สูบบุหรี่", vi: "Hút thuốc" },
  "Smoking in home":             { ko: "실내 흡연", ja: "屋内喫煙", zh: "室内吸烟", th: "สูบบุหรี่ในบ้าน", vi: "Hút thuốc trong nhà" },
  "Smoking outside allowed":     { ko: "실외 흡연 허용", ja: "屋外喫煙可", zh: "允许室外吸烟", th: "อนุญาตให้สูบบุหรี่นอกบ้าน", vi: "Cho phép hút thuốc ngoài trời" },
  "Start date":                  { ko: "시작일", ja: "開始日", zh: "开始日期", th: "วันเริ่ม", vi: "Ngày bắt đầu" },
  "Suburb":                      { ko: "지역", ja: "地区", zh: "城区", th: "เขต", vi: "Khu vực" },
  "Weekly budget":               { ko: "주간 예산", ja: "週予算", zh: "每周预算", th: "งบประมาณต่อสัปดาห์", vi: "Ngân sách hàng tuần" },

  // ── Values / document chrome ──────────────────────────────────────────────
  "Yes":               { ko: "예", ja: "はい", zh: "是", th: "ใช่", vi: "Có" },
  "No":                { ko: "아니오", ja: "いいえ", zh: "否", th: "ไม่ใช่", vi: "Không" },
  "Signed":            { ko: "서명 완료", ja: "署名済", zh: "已签署", th: "ลงนามแล้ว", vi: "Đã ký" },
  "Submitted":         { ko: "제출됨", ja: "提出済", zh: "已提交", th: "ส่งแล้ว", vi: "Đã nộp" },
  "Submitted on":      { ko: "제출일", ja: "提出日", zh: "提交日期", th: "วันที่ส่ง", vi: "Ngày nộp" },
  "Signed on":         { ko: "서명 일시", ja: "署名日時", zh: "签署时间", th: "เวลาลงนาม", vi: "Thời điểm ký" },
  "Pending signature": { ko: "서명 대기", ja: "署名待ち", zh: "待签署", th: "รอลงนาม", vi: "Chờ ký" },
  "Consent recorded electronically.": { ko: "전자적으로 동의가 기록되었습니다.", ja: "同意は電子的に記録されています。", zh: "已以电子方式记录同意。", th: "บันทึกความยินยอมทางอิเล็กทรอนิกส์แล้ว", vi: "Sự đồng ý đã được ghi nhận điện tử." },

  // ── Signer roles (values come from the signers JSONB, lower-cased) ────────
  "role.student":   { ko: "학생", ja: "学生", zh: "学生", th: "นักเรียน", vi: "Học sinh" },
  "role.host":      { ko: "호스트", ja: "ホスト", zh: "寄宿家庭", th: "เจ้าบ้าน", vi: "Chủ nhà" },
  "role.guardian":  { ko: "보호자", ja: "保護者", zh: "监护人", th: "ผู้ปกครอง", vi: "Người giám hộ" },
  "role.agent":     { ko: "에이전트", ja: "エージェント", zh: "代理", th: "ตัวแทน", vi: "Đại lý" },
  "role.applicant": { ko: "신청인", ja: "申込者", zh: "申请人", th: "ผู้สมัคร", vi: "Người đăng ký" },
  "role.tenant":    { ko: "임차인", ja: "賃借人", zh: "承租人", th: "ผู้เช่า", vi: "Người thuê" },
  "role.landlord":  { ko: "임대인", ja: "賃貸人", zh: "出租人", th: "ผู้ให้เช่า", vi: "Bên cho thuê" },
  "role.signer":    { ko: "서명자", ja: "署名者", zh: "签署人", th: "ผู้ลงนาม", vi: "Người ký" },

  // ── Service-host brief ────────────────────────────────────────────────────
  "Service Assignment": { ko: "서비스 배정", ja: "サービス割当", zh: "服务派工", th: "การมอบหมายบริการ", vi: "Phân công dịch vụ" },
  "Service Host":       { ko: "서비스 호스트", ja: "サービスホスト", zh: "服务提供者", th: "ผู้ให้บริการ", vi: "Đối tác dịch vụ" },
  "Assignment":         { ko: "배정 내역", ja: "割当内容", zh: "派工信息", th: "รายละเอียดการมอบหมาย", vi: "Thông tin phân công" },
  "Service":            { ko: "서비스", ja: "サービス", zh: "服务", th: "บริการ", vi: "Dịch vụ" },
  "Scheduled":          { ko: "예정 일시", ja: "予定日時", zh: "预定时间", th: "กำหนดเวลา", vi: "Thời gian dự kiến" },
  "Service Fee":        { ko: "서비스 요금", ja: "サービス料金", zh: "服务费", th: "ค่าบริการ", vi: "Phí dịch vụ" },
  "Instructions":       { ko: "안내 사항", ja: "案内事項", zh: "说明", th: "คำแนะนำ", vi: "Hướng dẫn" },
  "Service Brief":      { ko: "서비스 브리프", ja: "サービス指示書", zh: "服务简报", th: "เอกสารสรุปงานบริการ", vi: "Bản tóm tắt dịch vụ" },
  "Placement":          { ko: "배정", ja: "配属", zh: "安置", th: "การจัดที่พัก", vi: "Sắp xếp" },
  "To be scheduled":    { ko: "일정 미정", ja: "日程未定", zh: "待安排", th: "รอกำหนดเวลา", vi: "Chưa lên lịch" },
  "service_brief.confidentiality": {
    ko: "이 브리프에는 해당 서비스를 수행하고 청구하는 데 필요한 정보만 담겨 있습니다. 학생의 정보는 기밀로 취급하고 개인정보처리방침에 따라 다루어 주십시오.",
    ja: "この指示書には、当該サービスの実施と請求に必要な情報のみが記載されています。学生の情報は機密として扱い、プライバシーポリシーに従って取り扱ってください。",
    zh: "本简报仅包含执行和结算该项服务所需的信息。请对学生信息保密，并按照隐私政策处理。",
    th: "เอกสารนี้มีเฉพาะข้อมูลที่จำเป็นต่อการให้บริการและเรียกเก็บเงินสำหรับบริการนี้เท่านั้น กรุณาเก็บข้อมูลของนักเรียนเป็นความลับและดำเนินการตามนโยบายความเป็นส่วนตัว",
    vi: "Bản tóm tắt này chỉ chứa thông tin cần thiết để thực hiện và thanh toán dịch vụ này. Vui lòng giữ bí mật thông tin của học sinh và xử lý theo Chính sách quyền riêng tư.",
  },
};

/**
 * Translate an application-document label. The English text is the key, so an
 * untranslated label renders as English instead of breaking the document.
 */
const EN_OVERRIDES: Readonly<Record<string, string>> = {
  // Keys whose English text is too long to sit inline at the call site.
  "service_brief.confidentiality":
    "This brief contains only the information required to perform and bill this " +
    "service. Please treat the student's details as confidential and handle them " +
    "in line with our Privacy Policy.",
};

export function al(lang: DocLang, english: string): string {
  if (lang === "en") return EN_OVERRIDES[english] ?? english;
  return LABELS[english]?.[lang] ?? EN_OVERRIDES[english] ?? english;
}

/** Localised label for a signer role, falling back to a title-cased code. */
export function roleLabel(lang: DocLang, role: string): string {
  const key = `role.${role.toLowerCase()}`;
  if (lang !== "en" && LABELS[key]?.[lang]) return LABELS[key][lang];
  return role.charAt(0).toUpperCase() + role.slice(1);
}

/** Localised Yes/No for a tri-state answer; anything else passes through. */
export function yesNoLabel(lang: DocLang, v: unknown, fallback: string): string {
  if (v === true || v === "yes" || v === "Yes") return al(lang, "Yes");
  if (v === false || v === "no" || v === "No") return al(lang, "No");
  return fallback;
}
