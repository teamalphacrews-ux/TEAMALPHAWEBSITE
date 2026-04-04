import React from 'react';
import { Quote, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function ReplyPreview({ message, isOwn, onCancel, senderName }) {
  if (!message) return null;

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 10 }}
      className={`
        relative px-4 py-3 rounded-xl border-l-[3px] border-luxury-gold/50 
        ${onCancel ? 'bg-black/5 mb-3 flex items-center justify-between' : 'bg-black/10 text-white/80'}
      `}
    >
      <div className="flex-1 min-w-0 pr-8">
        <div className="flex items-center gap-2 mb-1">
          <Quote size={10} className="text-luxury-gold" />
          <span className="text-[10px] font-bold uppercase tracking-wider opacity-60">
            Replying to {senderName || (isOwn ? "You" : "Admin")}
          </span>
        </div>
        <p className="text-xs truncate opacity-90 italic">
          {message.text || (message.attachments?.length > 0 ? "Shared a file" : "...")}
        </p>
      </div>

      {onCancel && (
        <button 
          onClick={onCancel}
          className="p-1.5 hover:bg-black/5 rounded-full text-stone-500 transition-colors"
        >
          <X size={14} />
        </button>
      )}
    </motion.div>
  );
}
