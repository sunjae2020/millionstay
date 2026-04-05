import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Save } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface NotifItem {
  key: string;
  label: string;
  desc: string;
  email: boolean;
  inapp: boolean;
}

const INITIAL: NotifItem[] = [
  { key: "new_booking", label: "신규 예약", desc: "새 예약이 생성될 때", email: true, inapp: true },
  { key: "booking_cancelled", label: "예약 취소", desc: "예약이 취소될 때", email: true, inapp: true },
  { key: "invoice_paid", label: "인보이스 결제 완료", desc: "인보이스 결제가 확인될 때", email: true, inapp: true },
  { key: "invoice_overdue", label: "인보이스 연체", desc: "인보이스 결제 기한이 초과될 때", email: true, inapp: false },
  { key: "contract_signed", label: "계약 서명 완료", desc: "입주자가 계약서에 서명할 때", email: true, inapp: true },
  { key: "contract_expiring", label: "계약 만료 임박", desc: "계약 만료 30일 전 알림", email: true, inapp: false },
  { key: "work_order_created", label: "정비 요청 접수", desc: "새 정비 요청이 생성될 때", email: false, inapp: true },
  { key: "work_order_completed", label: "정비 완료", desc: "정비 작업이 완료 처리될 때", email: false, inapp: true },
  { key: "lead_assigned", label: "리드 배정", desc: "리드가 담당자에게 배정될 때", email: true, inapp: true },
  { key: "daily_summary", label: "일일 요약 리포트", desc: "매일 오전 9시 운영 현황 요약", email: true, inapp: false },
];

export function Notifications() {
  const { toast } = useToast();
  const [items, setItems] = useState<NotifItem[]>(INITIAL);

  function toggle(key: string, type: "email" | "inapp") {
    setItems((prev) =>
      prev.map((item) =>
        item.key === key ? { ...item, [type]: !item[type] } : item
      )
    );
  }

  function handleSave() {
    toast({ title: "저장됨", description: "알림 설정이 저장되었습니다." });
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-base font-semibold">알림 설정</h3>
        <p className="text-sm text-muted-foreground mt-0.5">이벤트별 이메일/인앱 알림을 설정합니다</p>
      </div>

      <div className="rounded-lg border overflow-hidden">
        <div className="grid grid-cols-[1fr_80px_80px] bg-muted/50 px-4 py-2.5 text-xs font-medium text-muted-foreground uppercase tracking-wide">
          <span>이벤트</span>
          <span className="text-center">이메일</span>
          <span className="text-center">인앱</span>
        </div>
        <div className="divide-y">
          {items.map((item) => (
            <div key={item.key} className="grid grid-cols-[1fr_80px_80px] items-center px-4 py-3">
              <div>
                <p className="text-sm font-medium">{item.label}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{item.desc}</p>
              </div>
              <div className="flex justify-center">
                <Switch
                  checked={item.email}
                  onCheckedChange={() => toggle(item.key, "email")}
                />
              </div>
              <div className="flex justify-center">
                <Switch
                  checked={item.inapp}
                  onCheckedChange={() => toggle(item.key, "inapp")}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      <Separator />

      <div>
        <h3 className="text-base font-semibold">일괄 설정</h3>
        <div className="flex gap-2 mt-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setItems((prev) => prev.map((i) => ({ ...i, email: true, inapp: true })))}
          >
            전체 활성화
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setItems((prev) => prev.map((i) => ({ ...i, email: false, inapp: false })))}
          >
            전체 비활성화
          </Button>
        </div>
      </div>

      <div className="flex justify-end">
        <Button onClick={handleSave}>
          <Save className="h-4 w-4 mr-2" />
          저장
        </Button>
      </div>
    </div>
  );
}
