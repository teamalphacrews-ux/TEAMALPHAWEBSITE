import React, { useState, useEffect, useRef } from 'react';
import { 
  MessageSquare, Send, User, Check, CheckCheck, ChevronLeft, 
  MoreVertical, Edit3, Trash2, Smile, Paperclip, Search, X, Clock, Reply, Copy, Image as ImageIcon
} from 'lucide-react';
import axios from 'axios';
import { io } from 'socket.io-client';
import EmojiPicker from 'emoji-picker-react';
import { format } from 'date-fns';

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";
const REACTION_EMOJIS = ['👍', '❤️', '😂', '😲', '😢'];

export default function Chats() {
  const [conversations, setConversations] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [isTyping, setIsTyping] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [editingMessage, setEditingMessage] = useState(null); 
  const [editText, setEditText] = useState(""); 
  const [activeMenuId, setActiveMenuId] = useState(null);
  const [searchQuery, setSearchQuery] = useState(""); 
  const [isMobileThreadView, setIsMobileThreadView] = useState(false);
  const [replyingTo, setReplyingTo] = useState(null);
  
  // Pagination
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [isFetchingMore, setIsFetchingMore] = useState(false);

  // Modals/Menus
  const [isDeleting, setIsDeleting] = useState(null); 
  const [showClearModal, setShowClearModal] = useState(false);
  const [showOptionsMenu, setShowOptionsMenu] = useState(false);
  const [attachmentsPreview, setAttachmentsPreview] = useState(null);

  const messagesEndRef = useRef(null);
  const chatContainerRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const socketRef = useRef(null);
  const fileInputRef = useRef(null);
  const inputRef = useRef(null);
  const menuRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setActiveMenuId(null);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Socket Logic
  useEffect(() => {
    const token = localStorage.getItem("token");
    const newSocket = io(API_URL, { auth: { token } });
    socketRef.current = newSocket;
    newSocket.emit('join_chat', 'admin');

    newSocket.on('receive_message', (message) => {
      setMessages(prev => {
        if (prev.find(m => m._id === message._id)) return prev;
        return [...prev, message];
      });
      fetchConversations();
      if (message.recipient === 'admin' || message.recipient === 'hardcoded-admin-id') {
        newSocket.emit('message_delivered', { messageId: message._id, senderId: message.sender });
      }
      if (selectedUser?.userId === message.sender || selectedUser?.userId === message.recipient) markAsSeen(selectedUser.userId);
    });

    newSocket.on('message_status_update', (data) => {
      setMessages(prev => prev.map(m => m._id === data.messageId ? { ...m, status: data.status } : m));
    });

    newSocket.on('message_reaction_update', (data) => {
      setMessages(prev => prev.map(m => m._id === data.messageId ? { ...m, reactions: data.reactions } : m));
    });

    newSocket.on('display_typing', (data) => { if (selectedUser?.userId === data.senderId) setIsTyping(true); });
    newSocket.on('hide_typing', (data) => { if (selectedUser?.userId === data.senderId) setIsTyping(false); });
    newSocket.on('message_edited', (updatedMsg) => { setMessages(prev => prev.map(m => m._id === updatedMsg._id ? updatedMsg : m)); });
    newSocket.on('message_deleted_everyone', (data) => { setMessages(prev => prev.map(m => m._id === data.id ? { ...m, text: 'This transmission redacted', isDeletedEveryone: true, attachments: [] } : m)); });
    newSocket.on('messages_seen', () => {
      setMessages(prev => prev.map(m => (m.sender === "admin" || m.sender === "hardcoded-admin-id") ? { ...m, status: 'seen', isRead: true } : m));
      fetchConversations();
    });

    return () => newSocket.close();
  }, [selectedUser?.userId]);

  const fetchConversations = async () => {
    try {
      const token = localStorage.getItem("token");
      const res = await axios.get(`${API_URL}/api/chats/admin/conversations`, { headers: { "x-auth-token": token } });
      setConversations(res.data.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)));
    } catch (err) { } finally { setLoading(false); }
  };

  const fetchMessages = async (userId, pageNum = 1) => {
    try {
      if (pageNum === 1) setLoading(true);
      else setIsFetchingMore(true);
      const token = localStorage.getItem("token");
      const res = await axios.get(`${API_URL}/api/chats/admin/${userId}?page=${pageNum}&limit=40`, { headers: { "x-auth-token": token } });
      if (pageNum === 1) {
        setMessages(res.data);
        setPage(1);
        setHasMore(res.data.length === 40);
        setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'auto' }), 100);
      } else {
        const prevHeight = chatContainerRef.current.scrollHeight;
        setMessages(prev => [...res.data, ...prev]);
        setHasMore(res.data.length === 40);
        setTimeout(() => {
          const newHeight = chatContainerRef.current.scrollHeight;
          chatContainerRef.current.scrollTop = newHeight - prevHeight;
        }, 0);
      }
    } catch (err) { } finally { setLoading(false); setIsFetchingMore(false); }
  };

  const handleScroll = (e) => {
    if (e.target.scrollTop === 0 && hasMore && !isFetchingMore && selectedUser) {
      const nextPage = page + 1;
      setPage(nextPage);
      fetchMessages(selectedUser.userId, nextPage);
    }
  };

  useEffect(() => { fetchConversations(); }, []);
  useEffect(() => {
    if (selectedUser) {
      fetchMessages(selectedUser.userId);
      markAsSeen(selectedUser.userId);
      socketRef.current?.emit('join_chat', selectedUser.userId);
      setReplyingTo(null);
      setAttachmentsPreview(null);
    }
  }, [selectedUser]);

  const markAsSeen = async (userId) => {
    try {
      const token = localStorage.getItem("token");
      await axios.patch(`${API_URL}/api/chats/seen/${userId}`, {}, { headers: { "x-auth-token": token } });
    } catch (err) { }
  };

  useEffect(() => { if (page === 1) messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, isTyping]);

  const handleSend = async (e) => {
    if (e) e.preventDefault();
    if ((!newMessage.trim() && !attachmentsPreview) || !selectedUser) return;
    const tempId = Date.now().toString();
    const optimisticMsg = {
      _id: tempId, text: newMessage, sender: 'admin', recipient: selectedUser.userId,
      timestamp: new Date().toISOString(), status: 'pending',
      messageType: attachmentsPreview ? (attachmentsPreview.fileType.startsWith('image/') ? 'image' : 'file') : 'text',
      attachments: attachmentsPreview ? [attachmentsPreview] : [],
      replyTo: replyingTo, reactions: []
    };
    setMessages(prev => [...prev, optimisticMsg]);
    setNewMessage(""); setReplyingTo(null); setAttachmentsPreview(null); setShowEmojiPicker(false);
    try {
      const token = localStorage.getItem("token");
      const res = await axios.post(`${API_URL}/api/chats`, 
        { text: optimisticMsg.text, recipient: selectedUser.userId, messageType: optimisticMsg.messageType, attachments: optimisticMsg.attachments, replyTo: optimisticMsg.replyTo?._id },
        { headers: { "x-auth-token": token } }
      );
      setMessages(prev => prev.map(m => m._id === tempId ? res.data : m));
      socketRef.current?.emit('typing_stop', { roomId: selectedUser.userId, senderId: 'admin' });
      fetchConversations();
    } catch (err) {
      setMessages(prev => prev.map(m => m._id === tempId ? { ...m, status: 'error' } : m));
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file || !selectedUser) return;
    const formData = new FormData();
    formData.append('file', file);
    try {
      const token = localStorage.getItem("token");
      const uploadRes = await axios.post(`${API_URL}/api/chats/upload`, formData, { headers: { "x-auth-token": token, "Content-Type": "multipart/form-data" } });
      setAttachmentsPreview({ url: uploadRes.data.url, fileType: file.type, fileName: file.name });
    } catch (err) { }
  };

  const handleReact = async (messageId, emoji) => {
    try {
      const token = localStorage.getItem("token");
      const res = await axios.post(`${API_URL}/api/chats/react/${messageId}`, { emoji }, { headers: { "x-auth-token": token } });
      setMessages(prev => prev.map(m => m._id === messageId ? { ...m, reactions: res.data } : m));
      setActiveMenuId(null);
    } catch (err) { }
  };

  const handleTyping = (e) => {
    setNewMessage(e.target.value);
    if (!socketRef.current || !selectedUser) return;
    socketRef.current.emit('typing_start', { roomId: selectedUser.userId, senderId: 'admin' });
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => { socketRef.current.emit('typing_stop', { roomId: selectedUser.userId, senderId: 'admin' }); }, 2000);
  };

  const handleEmojiClick = (emojiData) => {
    const input = inputRef.current;
    if (!input) return;
    const start = input.selectionStart;
    const end = input.selectionEnd;
    const text = newMessage;
    setNewMessage(text.substring(0, start) + emojiData.emoji + text.substring(end));
    setTimeout(() => { input.focus(); input.setSelectionRange(start + emojiData.emoji.length, start + emojiData.emoji.length); }, 0);
  };

  const selectConversation = (conv) => { setSelectedUser(conv); setIsMobileThreadView(true); };
  const backToList = () => { setIsMobileThreadView(false); setShowOptionsMenu(false); };

  return (
    <div className="p-1 h-[calc(100vh-140px)] flex flex-col animate-in fade-in duration-700 max-w-[1300px] mx-auto w-full font-sans text-charcoal bg-[#FDFDFD]">
      {/* Modals */}
      {showClearModal && (
        <div className="fixed inset-0 bg-charcoal/30 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
          <div className="bg-white rounded-[28px] p-6 max-w-xs w-full shadow-2xl border border-ivory/50 text-center">
            <h3 className="text-lg font-serif text-charcoal mb-1">Clear history</h3>
            <p className="text-[9px] text-warmgray mb-6 font-bold uppercase tracking-widest">Permanent record deletion</p>
            <div className="flex flex-col gap-2">
              <button onClick={() => { setShowClearModal(false); }} className="w-full py-2.5 bg-red-600 text-white rounded-xl text-[9px] font-bold uppercase tracking-widest shadow-lg">Confirm clear</button>
              <button onClick={() => setShowClearModal(false)} className="w-full py-2.5 bg-ivory text-warmgray rounded-xl text-[9px] font-bold uppercase tracking-widest border border-[#e6e3df]">Abort</button>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-12 flex-1 overflow-hidden bg-white shadow-[0_15px_60px_rgba(0,0,0,0.04)] rounded-[28px] border border-[#f2f2f2]">
        {/* Sidebar */}
        <div className={`${isMobileThreadView ? 'hidden md:flex' : 'flex'} md:col-span-4 lg:col-span-3 border-r border-[#f8f8f8] flex flex-col p-3 overflow-hidden`}>
          <div className="flex flex-col gap-3 mb-5 pt-1">
            <h2 className="text-[19px] font-serif text-charcoal px-1.5 opacity-90">Messages</h2>
            <div className="relative">
              <Search size={13} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-lightgray opacity-40" />
              <input 
                type="text" placeholder="Locate conversation..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-[#f9f9f9] border-none rounded-xl text-[11px] focus:ring-1 focus:ring-neutral-100 transition-all font-medium placeholder:text-lightgray/50"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto custom-scrollbar space-y-1 pr-0.5">
            {conversations.filter(c => c.userName?.toLowerCase().includes(searchTerm.toLowerCase())).map((conv) => (
                <button
                  key={conv.userId} onClick={() => selectConversation(conv)}
                  className={`w-full flex items-center gap-2.5 p-2.5 rounded-[18px] transition-all group ${selectedUser?.userId === conv.userId ? 'bg-charcoal text-white shadow-lg translate-x-0.5' : 'hover:bg-[#fafafa]'}`}
                >
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-serif text-sm shrink-0 ${selectedUser?.userId === conv.userId ? 'bg-white/10 text-white' : 'bg-ivory text-mutedbrown'}`}>
                    {conv.userName?.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-center mb-0.5">
                      <h3 className={`text-[12px] font-bold truncate ${selectedUser?.userId === conv.userId ? 'text-white' : 'text-charcoal'}`}>{conv.userName}</h3>
                      <span className="text-[8px] opacity-30 uppercase font-black">{conv.timestamp ? format(new Date(conv.timestamp), 'hh:mm a') : ''}</span>
                    </div>
                    <p className={`text-[10px] truncate opacity-40 font-medium ${selectedUser?.userId === conv.userId ? 'text-white/70' : 'text-warmgray'}`}>{conv.lastMessage}</p>
                  </div>
                  {conv.unreadCount > 0 && selectedUser?.userId !== conv.userId && (
                    <div className="w-3.5 h-3.5 bg-mutedbrown text-white text-[8px] flex items-center justify-center rounded-full font-bold">{conv.unreadCount}</div>
                  )}
                </button>
            ))}
          </div>
        </div>

        {/* Messaging Area */}
        <div className={`${isMobileThreadView ? 'flex' : 'hidden md:flex'} md:col-span-8 lg:col-span-9 flex flex-col overflow-hidden relative bg-white`}>
          {selectedUser ? (
            <>
              {/* Header */}
              <div className="p-3.5 border-b border-[#f8f8f8] flex items-center justify-between z-10 bg-white/40 backdrop-blur-xl">
                <div className="flex items-center gap-3">
                  <button onClick={backToList} className="md:hidden p-1 hover:bg-[#fafafa] rounded-lg text-charcoal"><ChevronLeft size={18} /></button>
                  <div className="w-8 h-8 bg-ivory rounded-lg flex items-center justify-center text-charcoal font-serif text-sm border border-[#f2f2f2]">{selectedUser.userName?.charAt(0)}</div>
                  <div className="flex flex-col">
                    <h3 className="font-serif text-[15px] text-charcoal leading-none mb-1">{selectedUser.userName}</h3>
                    <div className="flex items-center gap-1.5 opacity-50">
                      <div className="w-1 h-1 rounded-full bg-emerald-500 animate-pulse"></div>
                      <span className="text-[8px] font-bold uppercase tracking-widest">Active session</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 text-warmgray">
                    <button className="p-1.5 hover:bg-[#fafafa] rounded-lg transition-all opacity-60"><ImageIcon size={16} /></button>
                    <button className="p-1.5 hover:bg-[#fafafa] rounded-lg transition-all opacity-60"><Search size={16} /></button>
                    <button onClick={() => setShowOptionsMenu(!showOptionsMenu)} className="p-1.5 hover:bg-[#fafafa] rounded-lg transition-all relative">
                        <MoreVertical size={16} />
                        {showOptionsMenu && (
                            <div className="absolute top-9 right-0 w-40 bg-white border border-[#f0f0f0] shadow-xl rounded-xl py-1 z-50 text-charcoal animate-in fade-in slide-in-from-top-1">
                                <button onClick={() => setShowClearModal(true)} className="w-full text-left px-3.5 py-2 text-[9px] uppercase font-bold text-red-500 hover:bg-red-50 flex items-center gap-2">
                                    <Trash2 size={12} /> Clear records
                                </button>
                            </div>
                        )}
                    </button>
                </div>
              </div>

              {/* Chat Canvas */}
              <div ref={chatContainerRef} onScroll={handleScroll} className="flex-1 overflow-y-auto p-5 md:p-8 flex flex-col gap-5 custom-scrollbar scroll-smooth bg-[#FAFAFA]/40">
                {messages.map((msg, idx) => {
                  const isSentByAdmin = msg.sender === "admin" || msg.sender === "hardcoded-admin-id";
                  const showDateHeader = idx === 0 || new Date(messages[idx-1].timestamp).toDateString() !== new Date(msg.timestamp).toDateString();
                  
                  return (
                    <React.Fragment key={msg._id}>
                      {showDateHeader && (
                        <div className="flex justify-center my-4">
                          <span className="px-3.5 py-1 bg-white shadow-sm text-[8px] font-bold uppercase tracking-[0.25em] text-[#B0B0B0] rounded-full border border-[#f2f2f2]">
                            {format(new Date(msg.timestamp), 'EEEE, MMM dd')}
                          </span>
                        </div>
                      )}
                      
                      <div className={`flex w-full relative ${isSentByAdmin ? "justify-end" : "justify-start"}`}>
                        <div className="flex flex-col group max-w-[65%] lg:max-w-[42%] relative">
                          <div 
                            className={`px-3 py-2.5 shadow-sm text-[12px] leading-relaxed relative flex flex-col gap-2 transition-all cursor-pointer ${
                              isSentByAdmin ? "bg-charcoal text-white rounded-[16px] rounded-tr-none" : "bg-white border border-[#f0f0f0]/60 text-charcoal rounded-[16px] rounded-tl-none font-medium"
                            }`}
                            onClick={() => setActiveMenuId(activeMenuId === msg._id ? null : msg._id)}
                          >
                            {msg.replyTo && (
                                <div className={`p-2 rounded-[12px] text-[10px] mb-0.5 line-clamp-2 border-l-3 ${isSentByAdmin ? 'bg-white/10 border-white/20' : 'bg-[#f9f9f9] border-[#eee]'}`}>
                                    <p className="font-bold opacity-40 mb-0.5 text-[8px] uppercase tracking-tighter">Reference</p>
                                    {msg.replyTo.text}
                                </div>
                            )}

                            {editingMessage === msg._id ? (
                                <div className="flex flex-col gap-2 min-w-[200px]">
                                    <textarea className="bg-transparent focus:outline-none w-full border-b border-white/20 text-[12px] py-1" value={editText} onChange={(e) => setEditText(e.target.value)} autoFocus />
                                    <div className="flex justify-end gap-2.5 text-[8px] font-bold uppercase tracking-widest opacity-80">
                                        <button onClick={() => setEditingMessage(null)}>Abort</button>
                                        <button className="bg-white text-charcoal px-2 py-0.5 rounded shadow-md">Apply</button>
                                    </div>
                                </div>
                            ) : (
                                <>
                                    {msg.messageType === 'image' && msg.attachments?.[0] && <img src={msg.attachments[0].url} className="rounded-xl w-full mb-0.5 border border-black/5 max-h-52 object-contain bg-black/5" />}
                                    <p className="whitespace-pre-wrap">{msg.isDeletedEveryone ? "This transmission redacted" : msg.text}</p>
                                </>
                            )}
                            
                            {msg.reactions?.length > 0 && (
                                <div className="flex flex-wrap gap-1 absolute -bottom-2.5 left-2">
                                    {msg.reactions.map((r, i) => <div key={i} className="bg-white border border-[#f0f0f0] rounded-full px-1 py-0.5 text-[10px] shadow-sm">{r.emoji}</div>)}
                                </div>
                            )}
                          </div>

                          <div className={`mt-1.2 flex items-center gap-1.5 text-[8px] font-bold uppercase tracking-widest text-lightgray opacity-30 ${isSentByAdmin ? 'justify-end' : 'justify-start'}`}>
                            <span>{format(new Date(msg.timestamp), 'hh:mm a')}</span>
                            {isSentByAdmin && !msg.isDeletedEveryone && (
                                <span className="flex items-center">
                                    {msg.status === 'sent' && <Check size={10} />}
                                    {msg.status === 'delivered' && <CheckCheck size={10} />}
                                    {msg.status === 'seen' && <CheckCheck size={10} className="text-emerald-500" />}
                                </span>
                            )}
                          </div>

                          {/* Action Menu */}
                          {activeMenuId === msg._id && !editingMessage && (
                            <div ref={menuRef} className={`absolute top-0 w-48 bg-white shadow-[0_15px_40px_rgba(0,0,0,0.12)] rounded-xl py-1 z-[100] border border-[#f8f8f8] animate-in zoom-in-95 duration-150 ${isSentByAdmin ? "right-[105%]" : "left-[105%]"}`}>
                               <button onClick={() => {setReplyingTo(msg); setActiveMenuId(null);}} className="w-full flex items-center gap-2.5 px-3.5 py-2 hover:bg-[#fafafa] text-[11px] font-medium"><Reply size={13} className="opacity-30" /> Reply</button>
                               <div className="px-3 py-1.5 border-y border-[#f9f9f9] flex items-center justify-between">
                                  {REACTION_EMOJIS.map(emoji => <button key={emoji} onClick={() => handleReact(msg._id, emoji)} className="text-base hover:scale-125 transition-all">{emoji}</button>)}
                               </div>
                               <button onClick={() => {navigator.clipboard.writeText(msg.text); setActiveMenuId(null);}} className="w-full flex items-center gap-2.5 px-3.5 py-2 hover:bg-[#fafafa] text-[11px] font-medium"><Copy size={13} className="opacity-30" /> Copy Text</button>
                               <button onClick={() => {setEditingMessage(msg._id); setEditText(msg.text); setActiveMenuId(null);}} className="w-full flex items-center gap-2.5 px-3.5 py-2 hover:bg-[#fafafa] text-[11px] font-medium"><Edit3 size={13} className="opacity-30" /> Edit Message</button>
                               <div className="pt-1">
                                  <button onClick={() => { setIsDeleting(msg); setActiveMenuId(null); }} className="w-full text-left px-3.5 py-2 text-[9px] uppercase font-bold text-red-500 hover:bg-red-50 flex items-center gap-2.5"><Trash2 size={13} /> Remove me</button>
                                  {isSentByAdmin && (
                                    <button onClick={() => {handleDelete(msg._id, 'everyone'); setActiveMenuId(null);}} className="w-full text-left px-3.5 py-2 text-[9px] uppercase font-bold text-red-500 hover:bg-red-50 flex items-center gap-2.5"><Trash2 size={13} /> Wipe everyone</button>
                                  )}
                               </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </React.Fragment>
                  );
                })}
                {isTyping && <div className="text-[8px] text-warmgray uppercase font-bold tracking-[0.3em] pl-4 opacity-40 animate-pulse">Synchronizing...</div>}
                <div ref={messagesEndRef} className="h-4" />
              </div>

              {/* Input Area */}
              <div className="p-4 md:p-5 bg-white border-t border-[#f8f8f8] relative">
                {replyingTo && (
                    <div className="absolute bottom-[calc(100%+10px)] left-5 right-5 bg-white border-l-4 border-charcoal rounded-lg p-2.5 flex items-center justify-between shadow-xl animate-in fade-in slide-in-from-bottom-2 border border-[#f0f0f0]">
                        <div className="min-w-0 pr-4">
                            <p className="text-[8px] font-bold text-mutedbrown mb-0.5 uppercase tracking-widest">In reply to</p>
                            <p className="text-[11px] text-charcoal font-medium truncate opacity-80">{replyingTo.text}</p>
                        </div>
                        <button onClick={() => setReplyingTo(null)} className="p-1 hover:bg-[#f0f0f0] rounded-full transition-colors"><X size={14} /></button>
                    </div>
                )}

                <div className="flex items-center gap-2.5">
                   <button onClick={() => fileInputRef.current?.click()} className="w-9 h-9 flex items-center justify-center bg-[#f9f9f9] hover:bg-ivory rounded-lg transition-all border border-[#f2f2f2]">
                     <Paperclip size={16} className="text-warmgray opacity-60" />
                   </button>
                   <input type="file" ref={fileInputRef} onChange={handleFileUpload} className="hidden" />

                   <div className="flex-1 relative flex items-center">
                     <textarea 
                        ref={inputRef} placeholder="Enter transmission..." value={newMessage} onChange={handleTyping}
                        onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }}}
                        className="w-full bg-[#f9f9f9] border-none rounded-xl py-2.5 pl-4 pr-10 text-[12px] min-h-[40px] max-h-24 resize-none custom-scrollbar focus:ring-1 focus:ring-neutral-100 transition-all font-medium placeholder:text-lightgray/40"
                        rows={1} onInput={(e) => { e.target.style.height = 'auto'; e.target.style.height = Math.min(e.target.scrollHeight, 100) + 'px'; }}
                     />
                     <button onClick={() => setShowEmojiPicker(!showEmojiPicker)} className={`absolute right-2 p-1.5 rounded-lg transition-all ${showEmojiPicker ? 'bg-charcoal text-white shadow-lg' : 'text-warmgray hover:bg-[#efefef] opactiy-60'}`}><Smile size={17} /></button>
                     {showEmojiPicker && (
                        <div className="absolute bottom-[calc(100%+16px)] right-0 z-50 shadow-2xl rounded-2xl overflow-hidden animate-in zoom-in-95">
                            <EmojiPicker onEmojiClick={handleEmojiClick} width={300} height={380} theme="light" skinTonesDisabled />
                        </div>
                     )}
                   </div>
                   
                   <button 
                    onClick={handleSend} disabled={!newMessage.trim() && !attachmentsPreview}
                    className="flex items-center gap-2 bg-[#A8A8A8] hover:bg-charcoal px-5 h-10 rounded-xl text-white font-bold transition-all shadow-md active:scale-95 disabled:opacity-20 group"
                   >
                     <span className="text-[12px]">Send</span>
                     <Send size={15} className="transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                   </button>
                </div>

                {attachmentsPreview && (
                     <div className="absolute bottom-[calc(100%+12px)] left-5 bg-white border border-[#f2f2f2] rounded-xl p-1.5 shadow-2xl animate-in zoom-in-95 group">
                        <img src={attachmentsPreview.url} className="max-h-24 rounded-lg border border-black/5" />
                        <button onClick={() => setAttachmentsPreview(null)} className="absolute -top-1.5 -right-1.5 bg-charcoal text-white rounded-full p-1 shadow-lg border-2 border-white"><X size={10} /></button>
                     </div>
                )}
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-12 opacity-25 gap-6">
              <div className="w-16 h-16 bg-[#f9f9f9] rounded-[24px] flex items-center justify-center border border-[#f2f2f2] shadow-inner"><MessageSquare size={24} className="text-charcoal" /></div>
              <div className="max-w-xs space-y-1.5"><h3 className="text-xl font-serif text-charcoal">Registry Hub</h3><p className="text-[9px] uppercase tracking-[0.4em] font-bold">Awaiting client selection</p></div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
