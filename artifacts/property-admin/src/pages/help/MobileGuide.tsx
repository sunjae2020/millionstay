import { useTranslation } from "react-i18next";
import { Link } from "wouter";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { APP_NAME } from "@/lib/appName";
import {
  ArrowLeft, Camera, KeyRound, Smartphone, ShieldCheck, Share, MoreVertical,
  Check, Info, AlertTriangle, LayoutGrid,
} from "lucide-react";

/**
 * 휴대폰 사용 안내 — 패스키 로그인 · 홈 화면 설치 · 현장 촬영.
 *
 * 문서함(/help/docs)이 가리키는 사내 안내서다. 파일이나 외부 링크가 아니라 화면인
 * 이유는 두 가지다. 하나, 내용이 전부 이 제품의 화면 경로라 제품과 같이 늙어야
 * 한다. 둘, 인스턴스마다 색·이름이 다르므로 브랜드 토큰을 그대로 입어야 한다 —
 * 여기 raw hex 는 한 곳도 없고, 색은 전부 시맨틱 토큰에서 온다(Metheim = teal,
 * MillionStay = orange).
 */

/** 절차 한 단계. 번호는 실제 순서를 뜻하므로 장식이 아니다. */
function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <li className="grid grid-cols-[1.5rem_1fr] items-start gap-3">
      <span className="mt-0.5 grid h-6 w-6 place-items-center rounded-full bg-foreground text-[0.7rem] font-semibold text-background tabular-nums">
        {n}
      </span>
      <div className="text-sm leading-relaxed">{children}</div>
    </li>
  );
}

function Hint({ children }: { children: React.ReactNode }) {
  return <span className="mt-0.5 block text-xs text-muted-foreground">{children}</span>;
}

function Note({
  tone = "info",
  title,
  children,
}: {
  tone?: "info" | "ok" | "warn";
  title: string;
  children: React.ReactNode;
}) {
  const tones = {
    info: { bar: "border-l-primary", bg: "bg-primary/5", Icon: Info, ic: "text-primary" },
    ok: { bar: "border-l-emerald-600", bg: "bg-emerald-600/5", Icon: Check, ic: "text-emerald-600" },
    warn: { bar: "border-l-amber-600", bg: "bg-amber-600/5", Icon: AlertTriangle, ic: "text-amber-600" },
  }[tone];
  const { Icon } = tones;
  return (
    <div className={`border-l-[3px] ${tones.bar} ${tones.bg} px-4 py-3 my-5 max-w-3xl`}>
      <p className="flex items-center gap-1.5 text-[0.68rem] font-medium uppercase tracking-[0.12em] text-muted-foreground">
        <Icon className={`h-3.5 w-3.5 ${tones.ic}`} /> {title}
      </p>
      <div className="mt-1.5 space-y-2 text-sm">{children}</div>
    </div>
  );
}

function Section({
  id, num, icon: Icon, title, lede, children,
}: {
  id: string; num: string; icon: typeof Camera; title: string; lede: string; children: React.ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-6 pt-10 first:pt-0">
      <p className="font-mono text-[0.68rem] font-medium uppercase tracking-[0.16em] text-primary">{num}</p>
      <h2 className="mt-1 flex items-center gap-2 text-xl font-bold tracking-tight">
        <Icon className="h-5 w-5 text-primary" /> {title}
      </h2>
      <p className="mt-1.5 max-w-3xl text-sm text-muted-foreground">{lede}</p>
      {children}
    </section>
  );
}

/** 설치 절차 패널 — 플랫폼마다 메뉴 이름이 달라 나란히 두고 비교하게 한다. */
function Platform({
  badge, title, req, steps,
}: {
  badge: string; title: string; req: string; steps: React.ReactNode;
}) {
  return (
    <article className="overflow-hidden rounded-xl border bg-card">
      <header className="flex items-center gap-2.5 border-b bg-muted/40 px-4 py-2.5">
        <span className="grid h-6 w-8 place-items-center rounded bg-primary/10 font-mono text-[0.62rem] font-bold tracking-wide text-primary">
          {badge}
        </span>
        <h3 className="text-sm font-semibold">{title}</h3>
        <span className="ml-auto font-mono text-[0.66rem] text-muted-foreground">{req}</span>
      </header>
      <ol className="grid gap-3.5 px-4 py-4">{steps}</ol>
    </article>
  );
}

const Key = ({ children }: { children: React.ReactNode }) => (
  <kbd className="rounded border bg-muted px-1.5 py-0.5 font-mono text-[0.75em]">{children}</kbd>
);

const Path = ({ children }: { children: React.ReactNode }) => (
  <span className="font-mono text-[0.85em] text-primary">{children}</span>
);

export default function MobileGuide() {
  const { t } = useTranslation();

  return (
    <Layout>
      <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6">
        <Link href="/help/docs">
          <a className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" /> {t("helpDocs.title", "문서함")}
          </a>
        </Link>

        <header className="mt-4 border-b pb-6">
          <p className="font-mono text-[0.68rem] font-medium uppercase tracking-[0.16em] text-primary">
            {APP_NAME} · 사용 안내
          </p>
          <h1 className="mt-1.5 text-2xl font-bold tracking-tight sm:text-3xl">휴대폰에서 쓰는 {APP_NAME}</h1>
          <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
            홈 화면에 설치하는 웹앱, 한 손으로 옮겨 다니는 하단 탭바, 비밀번호 없이 여는 패스키 로그인,
            현장에서 바로 찍어 붙이는 사진 첨부. 네 가지를 한 번에 정리했습니다.
          </p>
          <nav className="mt-4 flex flex-wrap gap-1.5">
            {[
              ["#install", "01 · 앱 설치"],
              ["#tabs", "02 · 하단 탭바·메뉴"],
              ["#passkey", "03 · 패스키 로그인"],
              ["#camera", "04 · 사진 촬영·첨부"],
              ["#faq", "05 · 문제 해결"],
            ].map(([href, label]) => (
              <a
                key={href}
                href={href}
                className="rounded-full border bg-muted/40 px-3 py-1 font-mono text-[0.72rem] hover:border-primary hover:text-primary"
              >
                {label}
              </a>
            ))}
          </nav>
        </header>

        {/* ── 01 · 설치 ─────────────────────────────────────────── */}
        <Section
          id="install"
          num="01"
          icon={Smartphone}
          title="홈 화면에 앱으로 설치하기"
          lede="주소를 매번 치는 대신 홈 화면 아이콘으로 바로 엽니다. 용량은 거의 들지 않고, 한 번 열어 본 화면은 신호가 약한 지하나 승강기 안에서도 그대로 뜹니다."
        >
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <Platform
              badge="iOS"
              title="아이폰 · 아이패드"
              req="Safari 필요"
              steps={
                <>
                  <Step n={1}>
                    <strong>Safari</strong>로 포털 주소를 엽니다.
                    <Hint>크롬·네이버 앱에서는 홈 화면 추가가 뜨지 않습니다.</Hint>
                  </Step>
                  <Step n={2}>
                    로그인해서 평소 쓰는 화면까지 들어갑니다.
                    <Hint>로그인 상태 그대로 설치됩니다.</Hint>
                  </Step>
                  <Step n={3}>
                    화면 아래 <strong>공유</strong> 버튼<Share className="mx-1 inline h-3.5 w-3.5 align-[-2px]" />을 누릅니다.
                  </Step>
                  <Step n={4}>
                    목록을 내려 <strong>홈 화면에 추가</strong>를 고릅니다.
                  </Step>
                  <Step n={5}>
                    오른쪽 위 <strong>추가</strong>를 누릅니다.
                    <Hint>홈 화면에 아이콘이 생기면 끝입니다.</Hint>
                  </Step>
                </>
              }
            />
            <Platform
              badge="AND"
              title="안드로이드"
              req="Chrome 권장"
              steps={
                <>
                  <Step n={1}>
                    <strong>Chrome</strong>으로 포털 주소를 엽니다.
                    <Hint>삼성 인터넷도 됩니다. 메뉴 이름만 “현재 페이지 추가”로 다릅니다.</Hint>
                  </Step>
                  <Step n={2}>로그인해서 평소 쓰는 화면까지 들어갑니다.</Step>
                  <Step n={3}>
                    화면 안에 <strong>앱 설치</strong> 버튼이 보이면 그것을 누릅니다.
                    <Hint>서비스 호스트 포털은 왼쪽 메뉴 아래쪽에 있습니다.</Hint>
                  </Step>
                  <Step n={4}>
                    버튼이 없으면 오른쪽 위 <Key><MoreVertical className="inline h-3 w-3 align-[-1px]" /></Key> 메뉴에서{" "}
                    <strong>앱 설치</strong> 또는 <strong>홈 화면에 추가</strong>를 고릅니다.
                  </Step>
                  <Step n={5}>
                    확인 창에서 <strong>설치</strong>를 누릅니다.
                    <Hint>앱 서랍과 홈 화면 양쪽에 아이콘이 생깁니다.</Hint>
                  </Step>
                </>
              }
            />
          </div>

          <Note tone="ok" title="설치 확인">
            <p>
              아이콘으로 열었을 때 <strong>위쪽 주소창이 보이지 않으면</strong> 제대로 설치된 것입니다.
              주소창이 그대로 있으면 브라우저 탭으로 연 상태라 다시 설치하세요.
            </p>
          </Note>

          <h3 className="mt-8 text-base font-semibold">앱으로 설치되는 화면</h3>
          <div className="mt-3 overflow-x-auto rounded-xl border">
            <table className="w-full min-w-[34rem] text-sm">
              <thead className="bg-muted/40 text-[0.68rem] uppercase tracking-[0.1em] text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 text-left font-medium">포털</th>
                  <th className="px-3 py-2 text-left font-medium">쓰는 사람</th>
                  <th className="px-3 py-2 text-left font-medium">홈 화면 설치</th>
                  <th className="px-3 py-2 text-left font-medium">화면 안 설치 버튼</th>
                </tr>
              </thead>
              <tbody className="[&_td]:border-t [&_td]:px-3 [&_td]:py-2 [&_td]:align-top">
                <tr>
                  <td>서비스 호스트</td><td>청소·정비 현장</td>
                  <td className="font-medium text-emerald-600">지원</td><td className="font-medium text-emerald-600">있음</td>
                </tr>
                <tr>
                  <td>관리자</td><td>운영 담당</td>
                  <td className="font-medium text-emerald-600">지원</td><td className="text-muted-foreground">브라우저 메뉴로 설치</td>
                </tr>
                <tr>
                  <td>세입자 포털</td><td>입주자</td>
                  <td className="font-medium text-emerald-600">지원</td><td className="text-muted-foreground">브라우저 메뉴로 설치</td>
                </tr>
                <tr>
                  <td>에이전트 · 건물주</td><td>중개·소유주</td>
                  <td className="text-muted-foreground">준비 중</td><td className="text-muted-foreground">—</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            에이전트·건물주 포털도 브라우저에서 그대로 쓰십니다. 촬영과 사진 자동 축소는 설치 여부와 상관없이 모든 포털에서 작동합니다.
          </p>
        </Section>

        {/* ── 02 · 하단 탭바 ───────────────────────────────────── */}
        <Section
          id="tabs"
          num="02"
          icon={LayoutGrid}
          title="하단 탭바와 왼쪽 메뉴"
          lede="휴대폰으로 열면 화면 아래에 탭바가 붙습니다. 자주 쓰는 화면 네 개와 더보기, 모두 다섯 칸입니다. PC에서는 왼쪽 메뉴가 늘 떠 있어 탭바가 나오지 않습니다."
        >
          <h3 className="mt-6 text-base font-semibold">탭바 쓰는 법</h3>
          <p className="mt-2 max-w-3xl text-sm">
            처음 열면 <Path>대시보드</Path> · <Path>업무 캘린더</Path> · <Path>예약</Path> · <Path>계약</Path> 네 개가
            들어가 있고 맨 오른쪽이 <strong>더보기</strong>입니다. 탭을 한 번 누르면 그 화면으로 이동합니다.
            지금 보고 있는 화면의 탭은 아이콘 배경이 브랜드 색으로 켜집니다. 맨 오른쪽 더보기를 누르면
            왼쪽 전체 메뉴가 열립니다.
          </p>

          <div className="mt-4 overflow-x-auto rounded-xl border">
            <table className="w-full min-w-[32rem] text-sm">
              <thead className="bg-muted/40 text-[0.68rem] uppercase tracking-[0.1em] text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 text-left font-medium">하고 싶은 것</th>
                  <th className="px-3 py-2 text-left font-medium">조작</th>
                  <th className="px-3 py-2 text-left font-medium">결과</th>
                </tr>
              </thead>
              <tbody className="[&_td]:border-t [&_td]:px-3 [&_td]:py-2 [&_td]:align-top">
                <tr><td>화면 이동</td><td>탭 한 번 누르기</td><td className="text-muted-foreground">그 화면으로 이동</td></tr>
                <tr><td>전체 메뉴 열기</td><td>맨 오른쪽 <strong>더보기</strong></td><td className="text-muted-foreground">왼쪽 메뉴가 열림</td></tr>
                <tr><td>탭 바꾸기</td><td>아무 탭이나 <strong>1초쯤 길게 누르기</strong></td><td className="text-muted-foreground">편집 창이 열림 (짧게 진동)</td></tr>
                <tr><td>탭 바꾸기 (다른 방법)</td><td>더보기 → <Path>하단 탭 편집</Path></td><td className="text-muted-foreground">같은 편집 창</td></tr>
                <tr><td>처음으로 되돌리기</td><td>편집 창 → <Path>기본값으로 되돌리기</Path></td><td className="text-muted-foreground">기본 네 개로 복귀</td></tr>
              </tbody>
            </table>
          </div>

          <h3 className="mt-7 text-base font-semibold">내가 쓰는 화면으로 바꾸기</h3>
          <ol className="mt-3 grid max-w-3xl gap-3.5">
            <Step n={1}>
              아무 탭이나 <strong>1초쯤 길게</strong> 누릅니다.
              <Hint>짧게 진동하면서 편집 창이 열립니다. 손을 떼도 화면은 이동하지 않으니 편하게 눌러 보세요.</Hint>
            </Step>
            <Step n={2}>
              목록에서 원하는 화면을 <strong>최대 네 개까지</strong> 고릅니다.
              <Hint>고른 순서가 그대로 왼쪽부터의 배치 순서가 되고, 선택한 항목에는 순번이 표시됩니다.</Hint>
            </Step>
            <Step n={3}>
              <strong>저장</strong>을 누릅니다.
              <Hint>바로 아래 탭바에 반영됩니다. 처음 상태로 돌리려면 <Path>기본값으로 되돌리기</Path>를 누르세요.</Hint>
            </Step>
          </ol>
          <p className="mt-3 max-w-3xl text-sm text-muted-foreground">
            더보기를 열어 아래쪽 <Path>하단 탭 편집</Path> 버튼을 눌러도 같은 창이 열립니다.
          </p>

          <Note tone="info" title="어디에 저장되나">
            <p>
              고른 탭은 <strong>계정별로, 그리고 이 브라우저에만</strong> 저장됩니다. 같은 휴대폰을 여러 사람이
              써도 서로 섞이지 않습니다. 다른 기기에서는 그 기기에서 한 번 더 골라 주세요.
            </p>
            <p>
              편집 창의 목록에는 본인 권한으로 볼 수 있는 화면만 나옵니다. 브라우저 데이터를 지우면 기본값으로 돌아갑니다.
            </p>
          </Note>

          <h3 className="mt-7 text-base font-semibold">왼쪽 메뉴 · 상단 · 대시보드</h3>
          <dl className="mt-3 overflow-hidden rounded-xl border bg-card text-sm">
            {[
              ["왼쪽 메뉴", "더보기로 여는 메뉴는 휴대폰에서 화면 폭을 거의 다 차지합니다. 메뉴 줄 높이와 글자를 키워 손가락으로 누르기 쉽게 했습니다. 바깥 어두운 부분을 누르거나 오른쪽 위 닫기를 누르면 닫힙니다."],
              ["위쪽 언어 버튼", "좁은 화면에서는 지구본 아이콘만 남습니다. 눌러서 고르는 방식은 같습니다."],
              ["대시보드 숫자 카드", "두 개씩 두 줄로 놓입니다. 점유율과 오늘 체크인·체크아웃, 이달 매출이 스크롤 없이 한눈에 들어옵니다."],
            ].map(([k, v]) => (
              <div key={k} className="grid gap-0.5 border-b px-4 py-3 last:border-b-0 sm:grid-cols-[9rem_1fr] sm:items-baseline sm:gap-4">
                <dt className="font-medium">{k}</dt>
                <dd className="m-0 text-muted-foreground">{v}</dd>
              </div>
            ))}
          </dl>
        </Section>

        {/* ── 03 · 패스키 ───────────────────────────────────────── */}
        <Section
          id="passkey"
          num="03"
          icon={KeyRound}
          title="패스키로 로그인하기"
          lede="비밀번호 대신 얼굴·지문·기기 잠금번호로 엽니다. 아이디도 비밀번호도 치지 않고 버튼 한 번에 들어갑니다. 기존 비밀번호는 그대로 살아 있습니다."
        >
          <h3 className="mt-6 text-base font-semibold">기기 등록 — 한 번만 하면 됩니다</h3>
          <dl className="mt-3 overflow-hidden rounded-xl border bg-card text-sm">
            {[
              ["서비스 호스트 · 에이전트 · 건물주", <>왼쪽 메뉴 <Path>보안</Path> → <Path>이 기기 등록</Path></>],
              ["관리자", <><Path>설정</Path> → <Path>패스키</Path> → <Path>이 기기 등록</Path></>],
              ["세입자 포털", <>프로필 화면의 <Path>패스키</Path> 카드 → <Path>이 기기 등록</Path></>],
            ].map(([who, where], i) => (
              <div key={i} className="grid gap-0.5 border-b px-4 py-3 last:border-b-0 sm:grid-cols-[14rem_1fr] sm:items-baseline sm:gap-4">
                <dt className="font-medium">{who}</dt>
                <dd className="m-0 text-muted-foreground">{where}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-3 max-w-3xl text-sm">
            버튼을 누르면 휴대폰이 얼굴 인식이나 지문을 묻습니다. 확인하면 등록이 끝나고 목록에 기기 이름과 등록일이 남습니다.
            회사 노트북과 개인 휴대폰처럼 여러 기기를 각각 등록해 두셔도 됩니다.
          </p>

          <h3 className="mt-7 text-base font-semibold">로그인</h3>
          <p className="mt-2 max-w-3xl text-sm">
            로그인 화면 아래쪽 <strong>패스키로 로그인</strong>을 누르고, 휴대폰이 묻는 얼굴·지문·잠금번호를 확인하면 끝입니다.
            아이디 칸은 비워 두셔도 됩니다. 기기가 사용자를 알아봅니다.
          </p>

          <Note tone="info" title="알아두실 점">
            <p>
              <strong>패스키는 등록한 주소에서만 열립니다.</strong> 관리자 화면에서 등록한 패스키로는 에이전트 포털에 들어갈 수 없습니다.
              두 곳을 다 쓰신다면 각각 한 번씩 등록하세요.
            </p>
            <p>
              <strong>비밀번호는 없어지지 않습니다.</strong> 다른 사람 컴퓨터를 쓰거나 패스키가 말을 듣지 않을 때는 기존 방식으로 로그인하시면 됩니다.
            </p>
            <p>
              <strong>기기를 잃어버렸다면</strong> 다른 기기에서 로그인해 보안 화면에서 해당 패스키를 삭제하세요. 그 기기는 곧바로 접근할 수 없게 됩니다.
            </p>
          </Note>

          <h3 className="mt-7 text-base font-semibold">지원 환경</h3>
          <div className="mt-3 overflow-x-auto rounded-xl border">
            <table className="w-full min-w-[30rem] text-sm">
              <thead className="bg-muted/40 text-[0.68rem] uppercase tracking-[0.1em] text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 text-left font-medium">기기</th>
                  <th className="px-3 py-2 text-left font-medium">필요 조건</th>
                  <th className="px-3 py-2 text-left font-medium">잠금 해제</th>
                </tr>
              </thead>
              <tbody className="[&_td]:border-t [&_td]:px-3 [&_td]:py-2">
                <tr><td>아이폰 · 아이패드</td><td className="font-mono text-xs">iOS 16 이상</td><td>Face ID · Touch ID · 암호</td></tr>
                <tr><td>안드로이드</td><td className="font-mono text-xs">Android 9 이상 + Chrome</td><td>지문 · 얼굴 · 화면 잠금</td></tr>
                <tr><td>맥 · 윈도우</td><td className="font-mono text-xs">Chrome · Edge · Safari 최신</td><td>Touch ID · Windows Hello</td></tr>
              </tbody>
            </table>
          </div>
        </Section>

        {/* ── 04 · 카메라 ───────────────────────────────────────── */}
        <Section
          id="camera"
          num="04"
          icon={Camera}
          title="현장에서 찍어 바로 첨부하기"
          lede="사진을 올리는 화면마다 촬영 버튼이 붙었습니다. 갤러리를 거치지 않고 카메라가 바로 열리고, 찍은 사진은 올라가기 전에 알아서 줄어듭니다. 휴대폰에서만 보이는 버튼이라 PC 화면은 예전 그대로입니다."
        >
          <h3 className="mt-6 text-base font-semibold">업로드가 빨라진 이유</h3>
          <p className="mt-2 max-w-3xl text-sm">
            요즘 휴대폰 사진은 한 장에 5MB를 넘습니다. 열 장이면 50MB라 현장 신호로는 업로드가 끝나지 않습니다.
            그래서 보내기 전에 긴 변을 1600픽셀로 줄입니다. 서류 증빙으로 쓰기에는 충분한 크기입니다.
          </p>
          <div className="mt-3 overflow-x-auto rounded-xl border">
            <table className="w-full min-w-[32rem] text-sm">
              <thead className="bg-muted/40 text-[0.68rem] uppercase tracking-[0.1em] text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 text-left font-medium">올리는 파일</th>
                  <th className="px-3 py-2 text-left font-medium">처리</th>
                  <th className="px-3 py-2 text-left font-medium">결과</th>
                </tr>
              </thead>
              <tbody className="[&_td]:border-t [&_td]:px-3 [&_td]:py-2">
                <tr><td>휴대폰 사진 (JPEG · HEIC)</td><td>긴 변 1600px으로 축소</td><td className="font-mono text-xs tabular-nums">5.4MB → 1.0MB</td></tr>
                <tr><td>명함 · 신분증</td><td>글자가 남도록 2400px까지만</td><td className="font-mono text-xs tabular-nums">5.4MB → 2.5MB</td></tr>
                <tr><td>로고 · 도장 (PNG · SVG)</td><td>손대지 않음</td><td>투명 배경 그대로</td></tr>
                <tr><td>PDF · 스캔 문서</td><td>손대지 않음</td><td>원본 그대로</td></tr>
              </tbody>
            </table>
          </div>

          <h3 className="mt-7 text-base font-semibold">작업 전 · 작업 후 사진</h3>
          <p className="mt-2 max-w-3xl text-sm">
            작업지시 화면은 <strong>작업 전</strong>과 <strong>작업 후</strong> 두 칸으로 나뉘어 있습니다. 각 칸의 촬영 버튼으로 찍으면
            해당 회차로 저장되고, 작업지시서 PDF와 하자 청구 명세서에도 그 구분 그대로 실립니다. 사진마다 촬영일과 매물·호수가
            워터마크로 새겨지니 나중에 언제 찍은 사진인지 다툴 일이 없습니다.
          </p>

          <h3 className="mt-7 text-base font-semibold">촬영 버튼이 있는 곳</h3>
          <dl className="mt-3 overflow-hidden rounded-xl border bg-card text-sm">
            {[
              ["현장 작업", "작업지시 사진(작업 전·후), 세대점검 증빙, 하자 사진, 청소·정비 결과"],
              ["공간 · 건물", "공간 사진, 건물 사진, 판매 매물 대표·갤러리"],
              ["사람 · 서류", "명함 앞뒤, 신분증, 프로필 사진, 계약·계정·회사 서류함, 서류 일괄 인박스"],
              ["거래", "거래 상세의 영수증 첨부 — 종이 영수증을 찍으면 그대로 증빙으로 붙습니다"],
              ["문의", "고객 문의 답변, 파트너 지원 문의, 세입자 포털 문의"],
            ].map(([k, v]) => (
              <div key={k} className="grid gap-0.5 border-b px-4 py-3 last:border-b-0 sm:grid-cols-[9rem_1fr] sm:items-baseline sm:gap-4">
                <dt className="font-medium">{k}</dt>
                <dd className="m-0 text-muted-foreground">{v}</dd>
              </div>
            ))}
          </dl>

          <Note tone="warn" title="처음 한 번">
            <p>
              촬영 버튼을 처음 누르면 휴대폰이 <strong>카메라 사용 권한</strong>을 묻습니다. 허용하지 않으면 카메라가 열리지 않으니,
              실수로 거부하셨다면 휴대폰 설정에서 해당 브라우저의 카메라 권한을 다시 켜 주세요.
            </p>
          </Note>
        </Section>

        {/* ── 05 · 문제 해결 ───────────────────────────────────── */}
        <Section
          id="faq"
          num="05"
          icon={ShieldCheck}
          title="이럴 때는"
          lede="현장에서 실제로 들어오는 질문만 모았습니다."
        >
          <div className="mt-5">
            {[
              ["탭바가 보이지 않습니다",
               "화면 폭이 넓은 PC나 태블릿 가로 화면에서는 왼쪽 메뉴가 늘 떠 있어 탭바를 숨깁니다. 폭이 좁은 휴대폰 화면에서만 나옵니다."],
              ["길게 눌러도 편집 창이 뜨지 않습니다",
               "누르는 중에 손가락이 움직이면 취소됩니다. 한 자리에서 1초 정도 눌러 보세요. 더보기 안의 ‘하단 탭 편집’ 버튼으로도 같은 창을 열 수 있습니다."],
              ["다른 휴대폰에서는 탭이 다릅니다",
               "기기마다 따로 저장되기 때문입니다. 쓰시는 기기에서 각각 한 번씩 골라 주세요."],
              ["아이폰에서 ‘홈 화면에 추가’가 안 보입니다",
               "크롬이나 네이버 앱으로 열었을 때 생기는 일입니다. 주소를 복사해 Safari에서 다시 열면 공유 메뉴에 나타납니다."],
              ["‘패스키로 로그인’ 버튼이 없습니다",
               "브라우저가 패스키를 지원하지 않으면 버튼 자체가 뜨지 않습니다. 브라우저를 최신으로 올리시거나 그동안은 비밀번호로 들어가세요."],
              ["패스키를 등록했는데 다른 포털에서 안 됩니다",
               "정상입니다. 패스키는 등록한 주소에만 묶입니다. 쓰시는 포털마다 보안 화면에서 한 번씩 등록해 주세요."],
              ["휴대폰을 바꿨습니다",
               "새 기기에서 비밀번호로 한 번 로그인한 뒤 패스키를 새로 등록하세요. 예전 기기의 패스키는 목록에서 삭제하시면 됩니다."],
              ["사진 화질이 걱정됩니다",
               "축소해도 긴 변 1600픽셀은 A4 인쇄에 충분합니다. 명함·신분증처럼 글자를 읽어야 하는 사진은 2400픽셀까지 남기고, 로고·도장 파일은 아예 손대지 않습니다."],
              ["지하라 신호가 잡히지 않습니다",
               "앱으로 설치해 두셨다면 이미 열어 본 화면은 그대로 보입니다. 다만 사진 업로드는 신호가 있어야 완료되니 통신이 되는 곳에서 다시 눌러 주세요."],
            ].map(([q, a]) => (
              <div key={q} className="border-t py-4 last:border-b">
                <h4 className="text-sm font-semibold">{q}</h4>
                <p className="mt-1 max-w-3xl text-sm text-muted-foreground">{a}</p>
              </div>
            ))}
          </div>
        </Section>

        <footer className="mt-10 flex flex-wrap items-center justify-between gap-3 border-t pt-5 text-xs text-muted-foreground">
          <p className="m-0">문의는 담당 관리자에게 주세요.</p>
          <Link href="/help/docs">
            <Button variant="outline" size="sm">{t("helpDocs.title", "문서함")}으로</Button>
          </Link>
        </footer>
      </div>
    </Layout>
  );
}
