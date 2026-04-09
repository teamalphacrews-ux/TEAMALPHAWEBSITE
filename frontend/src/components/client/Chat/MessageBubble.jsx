import React, { useState, useRef, useEffect } from 'react';
import { 
  MoreVertical, Check, CheckCheck, Edit2, Trash2, 
  Reply as ReplyIcon, Sparkles, User, AlertCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { format } from 'date-fns';
import MessageActionsMenu from './MessageActionsMenu';
import ReactionsBar from './ReactionsBar';
import ReplyPreview from './ReplyPreview';

export default function MessageBubble({ 
  message, 
  isOwn, 
  isGroupStart, 
  isGroupEnd, 
  user,
  onReply, 
  onEdit, 
  onDeleteMe, 
  onDeleteEveryone, 
    onReact, 
    onCopy,
    searchQuery = "",
    id
  }) {
  const [showMenu, setShowMenu] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(message.text);
  const menuRef = useRef(null);

  // Highlighting utility
  const renderHighlightedText = (text, query) => {
    const trimmedQuery = query?.trim();
    if (!trimmedQuery || !text) return text;
    
    // Escape special regex characters in the query
    const escapedQuery = trimmedQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const parts = text.split(new RegExp(`(${escapedQuery})`, 'gi'));
    return parts.map((part, i) => 
        part.toLowerCase() === trimmedQuery.toLowerCase() 
            ? <span key={i} className="bg-luxury-gold/30 text-stone-900 rounded-[2px] px-0.5">{part}</span> 
            : part
    );
  };

  // Close menu on click outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setShowMenu(false);
      }
    };
    if (showMenu) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showMenu]);

  const handleEditSubmit = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      if (editText.trim() && editText !== message.text) {
        onEdit(message._id, editText);
        setIsEditing(false);
      } else if (editText === message.text) {
        setIsEditing(false);
      }
    } else if (e.key === 'Escape') {
      setIsEditing(false);
      setEditText(message.text);
    }
  };

  const statusIcon = () => {
    if (message.status === 'error') return <AlertCircle size={10} className="text-red-500" />;
    if (message.status === 'pending') return <div className="w-2.5 h-2.5 border-b border-r border-white animate-spin rounded-full opacity-50" />;
    if (message.status === 'seen') return <CheckCheck size={11} strokeWidth={3} className="text-[#34B7F1]" />;
    if (message.status === 'delivered') return <CheckCheck size={11} strokeWidth={3} className={isOwn ? "text-white/40" : "text-stone-400"} />;
    // Default: sent (single tick)
    return <Check size={11} strokeWidth={3} className={isOwn ? "text-white/40" : "text-stone-400"} />;
  };

  const isNewIncoming = !isOwn && (Date.now() - new Date(message.timestamp).getTime() < 5000);

  return (
    <div 
        id={id}
        className={`flex w-full mb-1 group px-2 items-end gap-2 ${isOwn ? "flex-row-reverse" : "flex-row"} ${isGroupStart ? "mt-4" : "mt-0.5"} ${isGroupEnd ? "mb-4" : "mb-0.5"}`}
    >
      {/* Avatar (Subtle) */}
      {!isOwn && isGroupEnd ? (
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-stone-800 to-black flex items-center justify-center text-[10px] font-bold text-luxury-gold shadow-lg border border-white/20 shrink-0">
          <User size={14} />
        </div>
      ) : (
        <div className="w-8 shrink-0" />
      )}

      <div className={`relative max-w-[65%] md:max-w-[70%] flex flex-col ${isOwn ? "items-end" : "items-start"}`}>
        
        {/* Actions Button (Top Level Hover) */}
        {!message.isDeletedEveryone && !isEditing && (
          <div className={`absolute top-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-10 ${isOwn ? "left-0 -translate-x-full pr-2" : "right-0 translate-x-full pl-2"}`}>
            <button 
              onClick={() => setShowMenu(!showMenu)}
              className="p-1.5 hover:bg-black/5 rounded-full text-stone-400 hover:text-stone-800 transition-colors"
            >
              <MoreVertical size={14} strokeWidth={2} />
            </button>
            <AnimatePresence>
                {showMenu && (
                  <div ref={menuRef}>
                    <MessageActionsMenu 
                      isOwn={isOwn}
                      onReply={() => onReply(message)}
                      onEdit={() => setIsEditing(true)}
                      onCopy={() => onCopy(message.text)}
                      onReact={(emoji) => onReact(message._id, emoji)}
                      onDeleteMe={() => onDeleteMe(message._id)}
                      onDeleteEveryone={() => onDeleteEveryone(message._id)}
                      onClose={() => setShowMenu(false)}
                    />
                  </div>
                )}
            </AnimatePresence>
          </div>
        )}

        {/* Bubble */}
        <motion.div 
          initial={isNewIncoming ? { scale: 0.9, opacity: 0, x: isOwn ? 20 : -20 } : false}
          animate={isNewIncoming ? { 
            scale: 1, 
            opacity: 1, 
            x: 0,
            backgroundColor: isOwn ? undefined : ['rgba(255,255,255,0.9)', 'rgba(212,175,55,0.1)', 'rgba(255,255,255,0.9)']
          } : { scale: 1, opacity: 1, x: 0 }}
          transition={{ duration: 0.5, backgroundColor: { duration: 2 } }}
          className={`
            relative p-[12px_16px] rounded-[20px] shadow-sm leading-relaxed text-[13.5px] backdrop-blur-md transition-all active:scale-[0.99]
            ${isOwn 
                ? "bg-gradient-to-br from-stone-800 to-black text-white" 
                : "bg-white/95 border border-white/60 text-stone-900"}
            ${isOwn 
                ? (isGroupEnd ? "rounded-tr-sm" : "rounded-tr-[20px]") 
                : (isGroupEnd ? "rounded-tl-sm" : "rounded-tl-[20px]")}
            ${message.isDeletedEveryone ? "italic opacity-60 bg-transparent border-dashed" : ""}
          `}
        >
          {/* Reply Block */}
          {message.replyTo && !message.isDeletedEveryone && (
            <div className="mb-2">
              <ReplyPreview 
                  message={message.replyTo} 
                  isOwn={isOwn}
                  senderName={message.replyTo.senderName}
              />
            </div>
          )}

          {/* Text Content */}
          {isEditing ? (
            <textarea
              autoFocus
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              onKeyDown={handleEditSubmit}
              onBlur={() => { setIsEditing(false); setEditText(message.text); }}
              className="w-full bg-transparent border-0 focus:ring-0 p-0 text-sm resize-none text-white italic"
              rows={Math.min(5, editText.split('\n').length)}
            />
          ) : (
            <div className="flex flex-col gap-1 pr-2">
                <p className="whitespace-pre-wrap">{renderHighlightedText(message.text, searchQuery)}</p>
                
                {/* Footer: Timestamp / Status / Edited */}
                <div className={`mt-1 flex items-center justify-end gap-1.5 text-[10px] uppercase tracking-[0.5px] font-bold ${isOwn ? "text-white/50" : "text-stone-500/80"}`}>
                    {message.isEdited && !message.isDeletedEveryone && (
                      <span className="italic mr-1">(edited)</span>
                    )}
                    <span>{format(new Date(message.timestamp), 'h:mm a')}</span>
                    {isOwn && (
                        <span className="inline-flex items-center">
                            {message.status === 'seen' ? (
                                <CheckCheck size={11} strokeWidth={3} className="text-[#34B7F1]" />
                            ) : (
                                statusIcon()
                            )}
                        </span>
                    )}
                </div>
            </div>
          )}
        </motion.div>

        {/* Reactions List */}
        {!message.isDeletedEveryone && (
          <ReactionsBar 
              reactions={message.reactions} 
              userId={user.id} 
              isOwn={isOwn}
              onReact={(emoji) => onReact(message._id, emoji)}
          />
        )}
      </div>
    </div>
  );
}
