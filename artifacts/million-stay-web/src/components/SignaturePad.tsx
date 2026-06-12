import { useRef, useEffect, useCallback, useState } from "react";
import { RotateCcw, PenLine } from "lucide-react";
import { Button } from "@/components/ui/button";

// Canvas signature pad — draws with mouse/touch and emits a PNG data URL.
// Ported from Edubee CRM (self-contained; no third-party signature library).
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
  height = 180,
  className = "",
  disabled = false,
  label = "Signature",
}: SignaturePadProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isDrawing = useRef(false);
  const lastPos = useRef<{ x: number; y: number } | null>(null);
  const [isEmpty, setIsEmpty] = useState(true);

  const getCtx = () => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const ctx = canvas.getContext("2d");
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
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
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
      {label && <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">{label}</p>}
      <div className="relative rounded-lg border border-gray-200 bg-white overflow-hidden">
        {isEmpty && !disabled && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 pointer-events-none select-none">
            <PenLine className="w-5 h-5 text-gray-300" />
            <p className="text-xs text-gray-400">Draw your signature here</p>
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
          <Button type="button" variant="ghost" size="sm" onClick={clear} className="h-7 px-2 text-xs text-muted-foreground hover:text-red-500 gap-1">
            <RotateCcw className="w-3 h-3" /> Clear
          </Button>
        </div>
      )}
    </div>
  );
}
