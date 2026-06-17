import React from 'react';
import { AdwarePopup } from '../types';
import { playSound } from './SoundEffects';
import { AlertTriangle, ShieldAlert, Cpu, X } from 'lucide-react';

interface AdwarePopupComponentProps {
  popups: AdwarePopup[];
  onDismiss: (id: string) => void;
}

export default function AdwarePopupComponent({ popups, onDismiss }: AdwarePopupComponentProps) {
  if (popups.length === 0) return null;

  return (
    <>
      {popups.map((popup) => {
        const handleDismiss = () => {
          playSound.glitchTick();
          onDismiss(popup.id);
        };

        // Determine icon based on message severity
        const isCritical = popup.title.includes('CRITICAL') || popup.title.includes('ALERT') || popup.title.includes('RANSOMWARE');
        
        return (
          <div
            key={popup.id}
            id={`popup-${popup.id}`}
            className="absolute border-2 border-[#ff3b30] bg-black text-[#ff3b30] shadow-[0_0_15px_rgba(255,59,48,0.5)] flex flex-col font-mono overflow-hidden pointer-events-auto rounded z-40 select-none animate-bounce"
            style={{
              left: `${popup.x}px`,
              top: `${popup.y}px`,
              width: `${popup.width}px`,
              height: `${popup.height}px`,
              boxShadow: isCritical 
                ? '0 0 25px rgba(255,59,48,0.7), inset 0 0 10px rgba(255,59,48,0.3)' 
                : '0 0 15px rgba(0,255,66,0.4), inset 0 0 10px rgba(0,255,66,0.1)',
              borderColor: isCritical ? '#ff3b30' : '#00ff42',
              color: isCritical ? '#ff3b30' : '#00ff42',
              background: 'rgba(5, 5, 5, 0.95)'
            }}
          >
            {/* Retro title bar */}
            <div 
              className="px-2 py-1 flex items-center justify-between text-xs font-bold shrink-0 text-black overflow-hidden" 
              style={{
                backgroundColor: isCritical ? '#ff3b30' : '#00ff42'
              }}
            >
              <div className="flex items-center gap-1.5 truncate">
                {isCritical ? <ShieldAlert className="w-3.5 h-3.5" /> : <Cpu className="w-3.5 h-3.5" />}
                <span className="truncate">{popup.title}</span>
              </div>
              <button
                id={`close-btn-${popup.id}`}
                onClick={handleDismiss}
                className="text-black hover:bg-black/20 p-0.5 rounded cursor-pointer transition-colors"
              >
                <X className="w-3.5 h-3.5 stroke-[2.5]" />
              </button>
            </div>

            {/* Popup content */}
            <div className="p-3 flex-1 flex flex-col justify-between overflow-y-auto text-xs">
              <div className="flex gap-2 items-start">
                <AlertTriangle className={`w-6 h-6 shrink-0 ${isCritical ? 'text-red-500 animate-pulse' : 'text-green-500'}`} />
                <div className="leading-tight">
                  <p className="font-semibold whitespace-pre-line text-[11px] leading-relaxed select-text">
                    {popup.message}
                  </p>
                </div>
              </div>

              {/* Action buttons */}
              <div className="mt-2.5 flex gap-2 justify-end">
                <button
                  id={`action-btn-1-${popup.id}`}
                  onClick={handleDismiss}
                  className="px-3 py-1 bg-transparent border text-xs cursor-pointer rounded transition-all hover:bg-red-500 hover:text-black font-bold active:scale-95"
                  style={{
                    borderColor: isCritical ? '#ff3b30' : '#00ff42',
                  }}
                >
                  OK
                </button>
                {isCritical && (
                  <button
                    id={`action-btn-2-${popup.id}`}
                    onClick={handleDismiss}
                    className="px-2.5 py-1 text-xs shrink-0 cursor-pointer rounded font-bold bg-[#ff3b30] text-black border border-[#ff3b30] transition-all hover:brightness-125 hover:shadow-[0_0_10px_#ff3b30] active:scale-95"
                  >
                    IGNORE
                  </button>
                )}
              </div>
            </div>

            {/* Glitch flickering background decoration */}
            <div className="absolute inset-0 pointer-events-none opacity-[0.03] bg-gradient-to-b from-white via-transparent to-black mix-blend-overlay"></div>
          </div>
        );
      })}
    </>
  );
}
