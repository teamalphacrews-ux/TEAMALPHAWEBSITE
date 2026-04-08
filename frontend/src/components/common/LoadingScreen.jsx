import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Camera, CheckCircle2 } from 'lucide-react';

const LoadingScreen = ({ isLoading, total = 0, current = 0 }) => {
  const [showSuccess, setShowSuccess] = useState(false);
  const [shouldRender, setShouldRender] = useState(isLoading);

  // High-precision progress calculation
  const progress = total > 0 ? Math.floor((current / total) * 100) : 0;

  useEffect(() => {
    if (!isLoading && total > 0 && current >= total) {
      setShowSuccess(true);
      const timer = setTimeout(() => {
        setShouldRender(false);
      }, 1500); 
      return () => clearTimeout(timer);
    } else if (isLoading) {
      setShouldRender(true);
      setShowSuccess(false);
    } else if (!isLoading && (total === 0 || current >= total)) {
      // Immediate hide if nothing to load or already done
      setShouldRender(false);
    }
  }, [isLoading, current, total]);

  if (!shouldRender) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 1 }}
        exit={{ opacity: 0, scale: 1.1 }}
        transition={{ duration: 0.8, ease: [0.43, 0.13, 0.23, 0.96] }}
        className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-[#FDFBF7]"
      >
        <div className="relative flex flex-col items-center">
          {/* Main Animation Container */}
          <div className="relative w-40 h-40 flex items-center justify-center">
            {/* Spinning Aperture Blades (Cute Photography Theme) */}
            <motion.div
              animate={showSuccess ? { rotate: 360, scale: 0.8, opacity: 0 } : { rotate: 360 }}
              transition={showSuccess ? { duration: 0.5 } : { repeat: Infinity, duration: 4, ease: "linear" }}
              className="absolute inset-0"
            >
              {[...Array(6)].map((_, i) => (
                <div
                  key={i}
                  className="absolute top-0 left-1/2 -ml-[1px] w-[2px] h-1/2 origin-bottom bg-slate-300"
                  style={{ transform: `rotate(${i * 60}deg)` }}
                />
              ))}
              <div className="absolute inset-4 rounded-full border-4 border-dashed border-slate-200" />
            </motion.div>

            {/* Central Icon */}
            <motion.div
              initial={{ scale: 0.8 }}
              animate={showSuccess ? { scale: 1.2, color: "#10b981" } : { scale: [0.9, 1.1, 0.9] }}
              transition={showSuccess ? { type: "spring", stiffness: 300 } : { repeat: Infinity, duration: 2 }}
              className="z-10 bg-white p-6 rounded-full shadow-2xl"
            >
              {showSuccess ? (
                <CheckCircle2 size={48} strokeWidth={1.5} />
              ) : (
                <Camera size={48} className="text-slate-400" strokeWidth={1.5} />
              )}
            </motion.div>
          </div>

          {/* Text Feedback */}
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-12 text-center"
          >
            <h2 className="text-xl font-serif text-slate-800 tracking-tight">
              {showSuccess ? "Memories Captured!" : "Loading memories please wait..."}
            </h2>
            
            {!showSuccess && (
              <div className="mt-4 flex flex-col items-center gap-2">
                <div className="w-48 h-1 bg-slate-100 rounded-full overflow-hidden">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${progress}%` }}
                    className="h-full bg-gradient-to-r from-[#cfe8d5] to-[#d9cdeb]"
                  />
                </div>
                <span className="text-[10px] uppercase tracking-[0.3em] font-bold text-slate-400">
                  {current} / {total} Assets Ready
                </span>
              </div>
            )}
          </motion.div>
        </div>

        {/* Decorative elements */}
        <div className="absolute bottom-12 left-1/2 -translate-x-1/2">
           <p className="text-[9px] uppercase tracking-[0.5em] font-bold text-slate-300">Team Alpha Cinema</p>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};

export default LoadingScreen;
