'use client';

import { useEffect, useRef } from 'react';

interface Props {
  name: string;
  value?: string;
  onChange: (dataUrl: string) => void;
  label?: string;
}

export function InitialPad({ name, value, onChange, label }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !value?.startsWith('data:image/')) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const image = new Image();
    image.onload = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
    };
    image.src = value;
  }, [value]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let drawing = false;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const getPos = (e: MouseEvent | TouchEvent) => {
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      if ('touches' in e) {
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
      onChange(canvas.toDataURL('image/png'));
    };

    ctx.strokeStyle = '#000';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';

    canvas.addEventListener('mousedown', start);
    canvas.addEventListener('mousemove', draw);
    canvas.addEventListener('mouseup', end);
    canvas.addEventListener('mouseleave', end);
    canvas.addEventListener('touchstart', start as EventListener, { passive: false });
    canvas.addEventListener('touchmove', draw as EventListener, { passive: false });
    canvas.addEventListener('touchend', end);

    return () => {
      canvas.removeEventListener('mousedown', start);
      canvas.removeEventListener('mousemove', draw);
      canvas.removeEventListener('mouseup', end);
      canvas.removeEventListener('mouseleave', end);
      canvas.removeEventListener('touchstart', start as EventListener);
      canvas.removeEventListener('touchmove', draw as EventListener);
      canvas.removeEventListener('touchend', end);
    };
  }, [onChange]);

  const clear = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx?.clearRect(0, 0, canvas.width, canvas.height);
    onChange('');
  };

  return (
    <div>
      {label ? <span className="sr-only">{label}</span> : null}
      <input type="hidden" name={name} value={value || ''} readOnly />
      <canvas
        ref={canvasRef}
        width={120}
        height={44}
        className="border border-gray-300 rounded bg-white w-full max-w-[120px] touch-none"
        aria-label={label || 'Draw initials'}
      />
      <button type="button" onClick={clear} className="text-xs text-gray-500 hover:text-red-500 mt-1 block">
        Clear
      </button>
    </div>
  );
}
