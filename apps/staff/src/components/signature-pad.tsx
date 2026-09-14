"use client";

import { useEffect, useRef, useState } from "react";

type Props = {
  value?: string | null;
  onChange: (dataUrl: string) => void;
  disabled?: boolean;
  label?: string;
  width?: number;
  height?: number;
  /** When manual, strokes are held locally until Save is pressed. */
  commitMode?: "auto" | "manual";
  hint?: string;
};

export function SignaturePad({
  value,
  onChange,
  disabled = false,
  label = "Instructor signature",
  width = 400,
  height = 140,
  commitMode = "auto",
  hint,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [draft, setDraft] = useState<string | null>(null);
  const manual = commitMode === "manual";

  const displayValue = manual ? draft ?? value : value;

  useEffect(() => {
    if (manual) {
      setDraft(null);
    }
  }, [value, manual]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !displayValue?.startsWith("data:image/")) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const image = new Image();
    image.onload = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
    };
    image.src = displayValue;
  }, [displayValue]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || disabled) return;
    let drawing = false;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const getPos = (e: MouseEvent | TouchEvent) => {
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      if ("touches" in e) {
        return {
          x: (e.touches[0].clientX - rect.left) * scaleX,
          y: (e.touches[0].clientY - rect.top) * scaleY,
        };
      }
      return {
        x: (e.clientX - rect.left) * scaleX,
        y: (e.clientY - rect.top) * scaleY,
      };
    };

    const start = (e: MouseEvent | TouchEvent) => {
      drawing = true;
      const pos = getPos(e);
      ctx.beginPath();
      ctx.moveTo(pos.x, pos.y);
    };

    const draw = (e: MouseEvent | TouchEvent) => {
      if (!drawing) return;
      e.preventDefault();
      const pos = getPos(e);
      ctx.lineTo(pos.x, pos.y);
      ctx.stroke();
    };

    const end = () => {
      if (!drawing) return;
      drawing = false;
      ctx.closePath();
      const dataUrl = canvas.toDataURL("image/png");
      if (manual) {
        setDraft(dataUrl);
      } else {
        onChange(dataUrl);
      }
    };

    ctx.strokeStyle = "#000";
    ctx.lineWidth = 2;
    ctx.lineCap = "round";

    canvas.addEventListener("mousedown", start);
    canvas.addEventListener("mousemove", draw);
    canvas.addEventListener("mouseup", end);
    canvas.addEventListener("mouseleave", end);
    canvas.addEventListener("touchstart", start as EventListener, { passive: false });
    canvas.addEventListener("touchmove", draw as EventListener, { passive: false });
    canvas.addEventListener("touchend", end);

    return () => {
      canvas.removeEventListener("mousedown", start);
      canvas.removeEventListener("mousemove", draw);
      canvas.removeEventListener("mouseup", end);
      canvas.removeEventListener("mouseleave", end);
      canvas.removeEventListener("touchstart", start as EventListener);
      canvas.removeEventListener("touchmove", draw as EventListener);
      canvas.removeEventListener("touchend", end);
    };
  }, [disabled, manual, onChange]);

  function clearCanvas() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setDraft(null);
    if (!manual) {
      onChange("");
    }
  }

  function saveManual() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dataUrl = canvas.toDataURL("image/png");
    const blank = document.createElement("canvas");
    blank.width = canvas.width;
    blank.height = canvas.height;
    if (dataUrl === blank.toDataURL("image/png")) {
      return;
    }
    onChange(dataUrl);
    setDraft(null);
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <span className="font-medium">{label}</span>
        {!disabled ? (
          <button
            type="button"
            className="text-xs font-medium text-brand-black/65 underline"
            onClick={clearCanvas}
          >
            Clear
          </button>
        ) : null}
      </div>
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        className={`w-full max-w-md rounded-lg border border-neutral-300 bg-white touch-none ${
          disabled ? "opacity-70" : "cursor-crosshair"
        }`}
      />
      <p className="text-xs text-brand-black/55">
        {hint ??
          (manual
            ? "Student draws above, then you tap Save signature (or Clear to start over)."
            : "Draw your signature above (mouse or touch).")}
      </p>
      {manual && !disabled ? (
        <button
          type="button"
          className="rounded-lg bg-brand-green px-3 py-1.5 text-sm font-semibold text-white"
          onClick={saveManual}
        >
          Save signature
        </button>
      ) : null}
    </div>
  );
}
