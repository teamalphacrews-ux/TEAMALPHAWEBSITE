import React, { useState, useRef, useEffect } from 'react';
import { Send, Smile, Paperclip, X, Image as ImageIcon, FileText, Reply, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import EmojiPicker from 'emoji-picker-react';
import ReplyPreview from './ReplyPreview';

export default function ChatInput({ 
  onSend, 
  onTyping, 
  replyingTo, 
  onCancelReply 
}) {
  const [text, setText] = useState("");
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const inputRef = useRef(null);
  const emojiRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (emojiRef.current && !emojiRef.current.contains(e.target)) {
        setShowEmojiPicker(false);
      }
    };
    if (showEmojiPicker) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showEmojiPicker]);

  const handleSend = () => {
    if (!text.trim()) return;
    onSend(text);
    setText("");
    setShowEmojiPicker(false);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const onEmojiClick = (emojiData) => {
    setText(prev => prev + emojiData.emoji);
    inputRef.current?.focus();
  };

  return (
    <div className="p-4 md:p-6 bg-white/20 backdrop-blur-xl border-t border-black/5 sticky bottom-0 z-20">
      
      {/* Reply Preview Above Input */}
      <AnimatePresence>
        {replyingTo && (
          <ReplyPreview 
            message={replyingTo} 
            senderName={replyingTo.senderName} 
            onCancel={onCancelReply} 
          />
        )}
      </AnimatePresence>

      <div className="flex flex-col gap-2">
        <div className="relative bg-white/60 backdrop-blur-md rounded-2xl md:rounded-full p-2 flex items-center gap-2 border border-white shadow-xl shadow-black/[0.03] transition-all focus-within:ring-2 focus-within:ring-luxury-gold/20">
          
          <div className="relative" ref={emojiRef}>
            <button 
              onClick={() => setShowEmojiPicker(!showEmojiPicker)}
              className={`w-10 h-10 flex items-center justify-center transition-colors rounded-full hover:bg-black/5 ${showEmojiPicker ? 'text-luxury-gold' : 'text-stone-400'}`}
            >
              <Smile size={20} strokeWidth={1.5} />
            </button>
            <AnimatePresence>
                {showEmojiPicker && (
                    <motion.div 
                        initial={{ opacity: 0, scale: 0.9, y: 10 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.9, y: 10 }}
                        className="absolute bottom-full mb-4 left-0 z-50 shadow-2xl rounded-2xl overflow-hidden"
                    >
                        <EmojiPicker 
                          onEmojiClick={onEmojiClick} 
                          width={320} 
                          height={400} 
                          searchDisabled
                          skinTonesDisabled
                          previewConfig={{ showPreview: false }}
                        />
                    </motion.div>
                )}
            </AnimatePresence>
          </div>

          {/* Attachment UI (Placeholder as requested) */}
          <div className="group relative">
            <button className="w-10 h-10 flex items-center justify-center text-stone-400 hover:text-stone-800 transition-colors rounded-full hover:bg-black/5">
                <Paperclip size={20} strokeWidth={1.5} />
            </button>
            <div className="absolute bottom-full mb-4 left-1/2 -translate-x-1/2 hidden group-hover:block transition-all opacity-0 group-hover:opacity-100">
                <div className="bg-white rounded-xl shadow-xl border border-black/5 p-2 flex gap-1 animate-in fade-in zoom-in-95 duration-200">
                    <button className="p-2 hover:bg-stone-50 rounded-lg text-stone-600 transition-colors" title="Send Image"><ImageIcon size={18} /></button>
                    <button className="p-2 hover:bg-stone-50 rounded-lg text-stone-600 transition-colors" title="Send File"><FileText size={18} /></button>
                </div>
            </div>
          </div>

          <textarea 
            ref={inputRef}
            rows={1}
            placeholder="Share your thoughts..."
            value={text}
            onChange={(e) => {
                setText(e.target.value);
                onTyping(e.target.value);
            }}
            onKeyDown={handleKeyDown}
            className="flex-1 bg-transparent border-none focus:ring-0 text-sm py-2 px-2 text-stone-800 placeholder:text-stone-400 resize-none max-h-32 overflow-y-auto"
          />

          <button 
            onClick={handleSend}
            disabled={!text.trim()}
            className="bg-black text-white px-5 h-10 rounded-full flex items-center gap-2 hover:scale-105 active:scale-95 transition-all disabled:opacity-20 shadow-lg shadow-black/20 group"
          >
            <span className="hidden md:inline text-[10px] uppercase font-bold tracking-widest">Send</span>
            <Send size={14} className="group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
          </button>
        </div>
        
        {/* Subtle Micro-hint */}
        <div className="px-4 flex items-center justify-between opacity-40 text-[9px] uppercase tracking-widest font-medium">
             <span>Press Enter to send</span>
             <span className="flex items-center gap-1"><Sparkles size={10} className="text-luxury-gold" /> Encrypted Legacy Chat</span>
        </div>
      </div>
    </div>
  );
}
