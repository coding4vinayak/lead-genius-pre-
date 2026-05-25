import { useState, useCallback, useRef } from 'react';
import { ZoomIn, ZoomOut, Maximize } from 'lucide-react';

interface SequenceCanvasProps {
  children: React.ReactNode;
}

export default function SequenceCanvas({ children }: SequenceCanvasProps) {
  const [scale, setScale] = useState(1);
  const [translate, setTranslate] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const lastPos = useRef({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.1 : 0.1;
    setScale((s) => Math.min(2, Math.max(0.25, s + delta)));
  }, []);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    if (e.target === containerRef.current || (e.target as HTMLElement).dataset.canvas) {
      setIsDragging(true);
      lastPos.current = { x: e.clientX, y: e.clientY };
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    }
  }, []);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!isDragging) return;
    const dx = e.clientX - lastPos.current.x;
    const dy = e.clientY - lastPos.current.y;
    lastPos.current = { x: e.clientX, y: e.clientY };
    setTranslate((t) => ({ x: t.x + dx, y: t.y + dy }));
  }, [isDragging]);

  const handlePointerUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  const zoomIn = () => setScale((s) => Math.min(2, s + 0.2));
  const zoomOut = () => setScale((s) => Math.max(0.25, s - 0.2));
  const fitToView = () => { setScale(1); setTranslate({ x: 0, y: 0 }); };

  return (
    <div className="relative flex-1 overflow-hidden bg-gray-50 rounded-lg border border-gray-200">
      {/* Zoom controls */}
      <div className="absolute top-3 right-3 z-10 flex flex-col gap-1" data-testid="zoom-controls">
        <button onClick={zoomIn} className="p-2 bg-white rounded-lg border border-gray-200 hover:bg-gray-50 shadow-sm" title="Zoom in">
          <ZoomIn size={16} />
        </button>
        <button onClick={zoomOut} className="p-2 bg-white rounded-lg border border-gray-200 hover:bg-gray-50 shadow-sm" title="Zoom out">
          <ZoomOut size={16} />
        </button>
        <button onClick={fitToView} className="p-2 bg-white rounded-lg border border-gray-200 hover:bg-gray-50 shadow-sm" title="Fit to view">
          <Maximize size={16} />
        </button>
      </div>

      {/* Canvas area */}
      <div
        ref={containerRef}
        data-canvas="true"
        className="w-full h-full min-h-[500px] cursor-grab active:cursor-grabbing"
        onWheel={handleWheel}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
      >
        <div
          style={{
            transform: `translate(${translate.x}px, ${translate.y}px) scale(${scale})`,
            transformOrigin: 'center top',
          }}
          className="transition-transform duration-75 pt-8 flex flex-col items-center"
        >
          {children}
        </div>
      </div>
    </div>
  );
}
