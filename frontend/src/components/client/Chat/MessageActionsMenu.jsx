import React, { useState } from 'react';
import { 
  Reply, Edit2, Copy, Trash2, Smile, ChevronRight, X
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const EMOJIS = ['👍', '❤️', '😂', '😲', '😢', '👏', '🔥', '🙌'];

export default function MessageActionsMenu({ 
  isOwn, 
  onReply, 
  onEdit, 
  onCopy, 
  onReact, 
  onDeleteMe, 
  onDeleteEveryone,
  onClose
}) {
  const [showReactions, setShowReactions] = useState(false);

  const menuItems = [
    { label: 'Reply', icon: Reply, onClick: onReply },
    ...(isOwn ? [{ label: 'Edit', icon: Edit2, onClick: onEdit }] : []),
    { label: 'Copy', icon: Copy, onClick: onCopy },
    { 
        label: 'Reactions', 
        icon: Smile, 
        onClick: () => setShowReactions(!showReactions), 
        expandable: true,
        active: showReactions
    },
    { label: 'Delete for me', icon: Trash2, onClick: onDeleteMe },
    ...(isOwn ? [{ label: 'Delete for everyone', icon: Trash2, onClick: onDeleteEveryone, danger: true }] : [])
  ];

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.95, y: -10 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95, y: -10 }}
      className="absolute right-0 top-full mt-2 z-50 min-w-[180px] bg-white rounded-2xl shadow-2xl border border-black/5 overflow-hidden backdrop-blur-xl bg-white/90"
    >
      <div className="py-2">
        {menuItems.map((item, idx) => (
          <div key={idx}>
            <button
              onClick={() => {
                if (!item.expandable) {
                    item.onClick();
                    onClose();
                } else {
                    item.onClick();
                }
              }}
              className={`w-full flex items-center justify-between px-4 py-2.5 text-sm transition-colors
                ${item.danger ? 'text-red-500 hover:bg-red-50' : 'text-stone-700 hover:bg-stone-50'}
                ${item.active ? 'bg-stone-50' : ''}
              `}
            >
              <div className="flex items-center gap-3">
                <item.icon size={16} strokeWidth={1.5} />
                <span className="font-medium">{item.label}</span>
              </div>
              {item.expandable && (
                <ChevronRight size={14} className={`transition-transform duration-300 ${showReactions ? 'rotate-90' : ''}`} />
              )}
            </button>

            <AnimatePresence>
              {item.expandable && showReactions && (
                <motion.div 
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden bg-stone-50/50 border-t border-black/5"
                >
                  <div className="px-5 py-4 grid grid-cols-4 gap-3 bg-white/50">
                    {EMOJIS.map(emoji => (
                      <button
                        key={emoji}
                        onClick={() => {
                          onReact(emoji);
                          onClose();
                        }}
                        className="w-10 h-10 flex items-center justify-center text-xl hover:bg-white hover:scale-125 transition-all rounded-xl shadow-sm border border-transparent hover:border-black/5 active:scale-95"
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        ))}
      </div>
    </motion.div>
  );
}
