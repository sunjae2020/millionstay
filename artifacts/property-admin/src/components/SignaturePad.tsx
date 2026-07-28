import { useRef, useEffect, useCallback, useState } from "react";
import { RotateCcw, PenLine } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";

/**
 * Canvas signature pad — draws with mouse or finger and emits a PNG data URL.
 * Admin-side twin of the guest web's pad (same drawing core, neutral styling so
 * it sits inside admin cards). Used by the 세대점검표 inspector countersignature.
 */
interface SignaturePadProps {
  value?: string | null;
  onChange?: (dataUrl: string | null) => void;
  height?: number;
  className?: string;
  disabled?: boolean;
  label?: string;
}

export default function SignaturePad({
  value,
  onChange,
  height = 140,
  className = "",
  disabled = false,
  label,
}: SignaturePadProps) {
  const { t } = useTranslation();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isDrawing = useRef(false);
  const lastPos = useRef<{ x: number; y: number } | null>(null);
  const [isEmpty, setIsEmpty] = useState(true);

  const getCtx = () => {
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return null;
    ctx.strokeStyle = "#1a1a1a";
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    return ctx;
  };

  const getRelativePos = (e: MouseEvent | TouchEvent, canvas: HTMLCanvasElement) => {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    if ("touches" in e) {
      const touch = e.touches[0];
      if (!touch) return { x: 0, y: 0 };
      return { x: (touch.clientX - rect.left) * scaleX, y: (touch.clientY - rect.top) * scaleY };
    }
    return { x: (e.clientX - rect.left) * scaleX, y: (e.clientY - rect.top) * scaleY };
  };

  const startDraw = useCallback((e: MouseEvent | TouchEvent) => {
    if (disabled) return;
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    isDrawing.current = true;
    lastPos.current = getRelativePos(e, canvas);
  }, [disabled]);

  const draw = useCallback((e: MouseEvent | TouchEvent) => {
    if (!isDrawing.current || disabled) return;
    e.preventDefault();
    const canvas = canvasRef.current;
    const ctx = getCtx();
    if (!canvas || !ctx || !lastPos.current) return;
    const pos = getRelativePos(e, canvas);
    ctx.beginPath();
    ctx.moveTo(lastPos.current.x, lastPos.current.y);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
    lastPos.current = pos;
  }, [disabled]);

  const endDraw = useCallback(() => {
    if (!isDrawing.current) return;
    isDrawing.current = false;
    lastPos.current = null;
    const canvas = canvasRef.current;
    if (!canvas) return;
    setIsEmpty(false);
    onChange?.(canvas.toDataURL("image/png"));
  }, [onChange]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const opts = { passive: false };
    canvas.addEventListener("mousedown", startDraw, opts);
    canvas.addEventListener("mousemove", draw, opts);
    canvas.addEventListener("mouseup", endDraw);
    canvas.addEventListener("mouseleave", endDraw);
    canvas.addEventListener("touchstart", startDraw, opts);
    canvas.addEventListener("touchmove", draw, opts);
    canvas.addEventListener("touchend", endDraw);
    return () => {
      canvas.removeEventListener("mousedown", startDraw);
      canvas.removeEventListener("mousemove", draw);
      canvas.removeEventListener("mouseup", endDraw);
      canvas.removeEventListener("mouseleave", endDraw);
      canvas.removeEventListener("touchstart", startDraw);
      canvas.removeEventListener("touchmove", draw);
      canvas.removeEventListener("touchend", endDraw);
    };
  }, [startDraw, draw, endDraw]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (value) {
      const img = new Image();
      img.onload = () => ctx.drawImage(img, 0, 0);
      img.src = value;
      setIsEmpty(false);
    } else {
      setIsEmpty(true);
    }
  }, [value]);

  const clear = () => {
    const canvas = canvasRef.current;
    const ctx = getCtx();
    if (!canvas || !ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setIsEmpty(true);
    onChange?.(null);
  };

  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      {label && <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>}
      <div className="relative rounded-lg border bg-gray-50 overflow-hidden">
        {isEmpty && !disabled && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 pointer-events-none select-none text-muted-foreground">
            <PenLine className="w-4 h-4" />
            <p className="text-xs">{t("inspection.sign_here")}</p>
          </div>
        )}
        <canvas
          ref={canvasRef}
          width={800}
          height={height * 2}
          style={{ width: "100%", height, display: "block", cursor: disabled ? "default" : "crosshair", touchAction: "none" }}
        />
      </div>
      {!disabled && (
        <div className="flex justify-end">
          <Button type="button" variant="ghost" size="sm" onClick={clear} className="h-7 px-2 text-xs gap-1">
            <RotateCcw className="w-3 h-3" /> {t("common.clear")}
          </Button>
        </div>
      )}
    </div>
  );
}
