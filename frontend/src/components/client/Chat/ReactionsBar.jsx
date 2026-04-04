import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export default function ReactionsBar({ reactions, onReact, userId, isOwn }) {
  if (!reactions || reactions.length === 0) return null;

  // Group reactions by emoji
  const groupedReactions = reactions.reduce((acc, curr) => {
    if (!acc[curr.emoji]) acc[curr.emoji] = [];
    acc[curr.emoji].push(curr.userId);
    return acc;
  }, {});

  return (
    <div className={`flex flex-wrap gap-1.5 mt-3 px-0.5 w-full ${isOwn ? "justify-end" : "justify-start"}`}>
      <AnimatePresence>
        {Object.entries(groupedReactions).map(([emoji, userIds]) => {
          const isOwn = userIds.includes(userId);
          const otherCount = userIds.length - (isOwn ? 1 : 0);
          const tooltip = isOwn 
            ? (otherCount > 0 ? `You and ${otherCount} others` : 'You') 
            : `${userIds.length} others`;

          return (
            <motion.button
              key={emoji}
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0, opacity: 0 }}
              onClick={() => onReact(emoji)}
              title={tooltip}
              className={`
                group relative flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium 
                shadow-sm border transition-all duration-300
                ${isOwn 
                  ? "bg-luxury-gold/10 border-luxury-gold/20 text-luxury-gold" 
                  : "bg-white/60 border-black/5 text-stone-600 hover:bg-white hover:border-black/10"}
              `}
            >
              <span className="group-hover:scale-125 transition-transform">{emoji}</span>
              <span className="tabular-nums font-bold">{userIds.length}</span>
              
              {/* Subtle hover tooltip (native title is okay, but this is cooler) */}
              <div className="absolute bottom-full mb-1.5 left-1/2 -translate-x-1/2 px-2 py-1 bg-stone-800 text-white text-[9px] rounded-md opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50">
                {tooltip}
              </div>
            </motion.button>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
