import React, { useState, useEffect, useRef } from 'react';
import { 
  MessageSquare, Send, User, Check, CheckCheck, ChevronLeft, 
  MoreVertical, Edit3, Trash2, Smile, Paperclip, Search, X, Clock, Reply, Copy, Image as ImageIcon
} from 'lucide-react';
import axios from 'axios';
import { io } from 'socket.io-client';
import EmojiPicker from 'emoji-picker-react';
import { format } from 'date-fns';
import { useAuth } from "../../context/AuthContext";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";
const REACTION_EMOJIS = ['👍', '❤️', '😂', '😲', '😢'];

export default function Chats() {
  const { user: adminProfile } = useAuth();
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
      setMessages(prev => prev.map(m => (m.sender === "admin" || String(m.sender) === String(adminProfile?.id || adminProfile?._id)) ? { ...m, status: 'seen', isRead: true } : m));
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

  const handleDelete = async (messageId, mode) => {
    try {
      const token = localStorage.getItem("token");
      await axios.delete(`${API_URL}/api/chats/${messageId}/${mode}`, { headers: { "x-auth-token": token } });
      if (mode === 'everyone') {
        setMessages(prev => prev.map(m => m._id === messageId ? { ...m, text: 'This transmission redacted', isDeletedEveryone: true, attachments: [] } : m));
      } else {
        setMessages(prev => prev.filter(m => m._id !== messageId));
      }
    } catch (err) { }
  };

  const handleClear = async (userId) => {
    try {
      const token = localStorage.getItem("token");
      await axios.post(`${API_URL}/api/chats/clear/${userId}`, {}, { headers: { "x-auth-token": token } });
      setMessages([]);
      setShowClearModal(false);
      fetchConversations();
    } catch (err) { }
  };


  const handleEditSave = async (messageId) => {
    try {
      const token = localStorage.getItem("token");
      const res = await axios.patch(`${API_URL}/api/chats/${messageId}`, { text: editText }, { headers: { "x-auth-token": token } });
      setMessages(prev => prev.map(m => m._id === messageId ? res.data : m));
      setEditingMessage(null);
      setEditText("");
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
    <div className="h-[calc(100vh-100px)] flex flex-col gap-6 animate-in fade-in duration-700 max-w-[1400px] mx-auto w-full font-sans text-[#5a5a5a] overflow-hidden">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end px-2 sm:px-4">
        <div>
          <h1 className="font-luxury text-4xl md:text-5xl text-[#2d2d2d] tracking-tight">Communication Hub</h1>
          <p className="text-[11px] md:text-[13px] text-[#7a7a7a] mt-3 font-medium uppercase tracking-[1px]">
            Direct client engagement and message registry
          </p>
        </div>
      </div>

      {/* Modals */}
      {showClearModal && (
        <div className="fixed inset-0 bg-charcoal/30 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
          <div className="bg-white rounded-[28px] p-6 max-w-xs w-full shadow-2xl border border-ivory/50 text-center">
            <h3 className="text-lg font-serif text-charcoal mb-1">Clear history</h3>
            <p className="text-[9px] text-warmgray mb-6 font-bold uppercase tracking-widest">Permanent record deletion</p>
            <div className="flex flex-col gap-2">
              <button onClick={() => handleClear(selectedUser.userId)} className="w-full py-2.5 bg-red-600 text-white rounded-xl text-[9px] font-bold uppercase tracking-widest shadow-lg">Confirm clear</button>
              <button onClick={() => setShowClearModal(false)} className="w-full py-2.5 bg-ivory text-warmgray rounded-xl text-[9px] font-bold uppercase tracking-widest border border-[#e6e3df]">Abort</button>
            </div>

          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-12 flex-1 overflow-hidden bg-gradient-to-br from-[#f8f6f2] via-[#f3efe7] to-[#fdfaf6] shadow-[0_10px_30px_rgba(0,0,0,0.06)] rounded-[22px] border border-white/60 p-4 gap-3">
        {/* Sidebar */}
        <div className={`${isMobileThreadView ? 'hidden md:flex' : 'flex'} md:col-span-4 lg:col-span-3 flex flex-col overflow-hidden`}>
          <div className="flex flex-col gap-1 mb-3 pt-1">
            <h2 className="text-[20px] font-serif text-[#2c2c2c] mb-3 px-2">Messages</h2>
            <div className="relative">
              <input 
                type="text" placeholder="Search..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
                className="mb-3 px-4 py-2 rounded-xl bg-[#f8f8f8] text-[12px] outline-none w-full placeholder:text-lightgray/50"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto custom-scrollbar space-y-2 pr-1">
            {conversations.filter(c => c.userName?.toLowerCase().includes(searchTerm.toLowerCase())).map((conv) => (
                <button
                  key={conv.userId} onClick={() => selectConversation(conv)}
                  className={`w-full flex items-center gap-3 p-3 rounded-[16px] transition-all duration-[250ms] group ${selectedUser?.userId === conv.userId ? 'bg-gradient-to-br from-[#e8dfd1] to-[#f5ebe0] text-[#2c2c2c] shadow-sm' : 'bg-[#ffffff] hover:bg-[#f7f5f2] shadow-sm border border-transparent hover:border-[#f0f0f0]'}`}
                >
                  <div className={`w-11 h-11 rounded-[14px] flex items-center justify-center font-bold shrink-0 transition-all ${selectedUser?.userId === conv.userId ? 'bg-white/40 text-[#2c2c2c]' : 'bg-[#f7f5f2] text-[#5a5a5a]'}`}>
                    {conv.userName?.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0 text-left">
                    <div className="flex justify-between items-center">
                      <h3 className={`text-[13px] font-semibold truncate ${selectedUser?.userId === conv.userId ? 'text-[#2c2c2c]' : 'text-[#2c2c2c]'}`}>{conv.userName}</h3>
                      <span className="text-[9px] opacity-40 uppercase font-black">{conv.timestamp ? format(new Date(conv.timestamp), 'hh:mm a') : ''}</span>
                    </div>
                    <p className={`text-[11px] truncate opacity-60 ${selectedUser?.userId === conv.userId ? 'text-[#5a5a5a]' : 'text-[#5a5a5a]'}`}>{conv.lastMessage}</p>
                  </div>
                  {conv.unreadCount > 0 && selectedUser?.userId !== conv.userId && (
                    <div className="w-4 h-4 bg-mutedbrown text-white text-[9px] flex items-center justify-center rounded-full font-black shadow-sm ring-2 ring-white">
                      {conv.unreadCount}
                    </div>
                  )}
                </button>
            ))}
          </div>
        </div>

        {/* Messaging Area */}
        <div className={`${isMobileThreadView ? 'flex' : 'hidden md:flex'} md:col-span-8 lg:col-span-9 flex flex-col overflow-hidden relative`}>
          {selectedUser ? (
            <>
              {/* Header */}
              <div className="px-5 py-4 border-b border-[#f2f2f2] flex items-center justify-between z-10 bg-[rgba(255,255,255,0.4)] backdrop-blur-xl rounded-t-[22px]">
                <div className="flex items-center gap-3">
                  <button onClick={backToList} className="md:hidden p-1 hover:bg-[#fafafa] rounded-lg text-[#2c2c2c]"><ChevronLeft size={18} /></button>
                  <div className="w-8 h-8 bg-white/60 rounded-lg flex items-center justify-center text-[#2c2c2c] font-serif text-sm border border-white shrink-0">{selectedUser.userName?.charAt(0)}</div>
                  <div className="flex flex-col">
                    <h3 className="font-serif text-[15px] text-[#2c2c2c] leading-none mb-1">{selectedUser.userName}</h3>
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
              <div ref={chatContainerRef} onScroll={handleScroll} className="flex-1 overflow-y-auto p-6 flex flex-col gap-4 custom-scrollbar scroll-smooth bg-transparent">
                {messages.map((msg, idx) => {
                  const isSentByAdmin = (adminProfile?.id || adminProfile?._id) && (String(msg.sender) === String(adminProfile.id || adminProfile._id) || msg.sender === 'admin');
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
                      
                      {/* Message Row Structure */}
                      <div className={`w-full flex mb-2 px-2 ${isSentByAdmin ? "justify-end" : "justify-start"}`}>
                        <div 
                            className={`flex flex-col group max-w-[80%] lg:max-w-[70%] relative ${isSentByAdmin ? 'items-end' : 'items-start'}`}
                        >
                          <div className={`flex items-start gap-2 ${isSentByAdmin ? 'flex-row-reverse' : 'flex-row'}`}>
                            {/* Message Bubble Container */}
                            <div 
                                className={`px-4 py-3 text-[13px] relative flex flex-col gap-1.5 transition-all duration-[250ms] hover:-translate-y-[2px] ${
                                isSentByAdmin 
                                    ? "bg-gradient-to-br from-[#e8dfd1] to-[#f5ebe0] text-[#2c2c2c] rounded-[16px_16px_4px_16px] shadow-sm" 
                                    : "bg-[#ffffff] text-[#333333] border border-[#eeeeee] rounded-[16px_16px_16px_4px] shadow-[0_2px_8px_rgba(0,0,0,0.02)]"
                                }`}
                            >

                                {msg.replyTo && (
                                    <div className={`p-2 rounded-[14px] text-[11px] mb-1 line-clamp-2 border-l-4 transition-all opacity-80 ${isSentByAdmin ? 'bg-white/40 border-[#d6cfc4]' : 'bg-[#f7f5f2] border-[#e8dfd1] shadow-inner'}`}>
                                        <p className="font-black opacity-60 mb-0.5 text-[9px] uppercase tracking-widest flex items-center gap-1.5">
                                            <Reply size={10} strokeWidth={3} /> Quoted message
                                        </p>
                                        <p className="italic font-medium">{msg.replyTo.text}</p>
                                    </div>
                                )}

                                {editingMessage === msg._id ? (
                                    <div className="flex flex-col gap-3 min-w-[240px] animate-in fade-in duration-300">
                                        <textarea 
                                            className="bg-transparent focus:outline-none w-full border-b border-white/40 text-[13px] py-1 placeholder:text-white/30 resize-none font-medium" 
                                            value={editText} 
                                            onChange={(e) => setEditText(e.target.value)} 
                                            autoFocus 
                                        />
                                        <div className="flex justify-end gap-3 text-[10px] font-bold uppercase tracking-widest">
                                            <button onClick={() => { setEditingMessage(null); setEditText(""); }} className="opacity-60 hover:opacity-100">Abort</button>
                                            <button onClick={() => handleEditSave(msg._id)} className="bg-white text-charcoal px-3 py-1 rounded-full shadow-md">Apply changes</button>
                                        </div>
                                    </div>
                                ) : (
                                    <>
                                        {msg.messageType === 'image' && msg.attachments?.[0] && (
                                            <div className="relative overflow-hidden rounded-xl border border-black/5 bg-black/5 mb-1">
                                                <img src={msg.attachments[0].url} className="w-full max-h-72 object-contain" />
                                            </div>
                                        )}
                                        <p className="whitespace-pre-wrap leading-[1.6] select-text">{msg.isDeletedEveryone ? "This message was deleted" : msg.text}</p>
                                    </>
                                )}
                                
                                {/* Timestamp and Status */}
                                <div className={`mt-1 flex items-center gap-2 text-[9px] font-black uppercase tracking-widest opacity-40 ${isSentByAdmin ? 'justify-end text-white/50' : 'justify-start text-charcoal/50'}`}>
                                    <span>{format(new Date(msg.timestamp), 'hh:mm a')}</span>
                                    {isSentByAdmin && (
                                        <span className="flex items-center gap-0.5">
                                            {msg.status === 'sent' && <Check size={11} strokeWidth={3} />}
                                            {msg.status === 'delivered' && <CheckCheck size={11} strokeWidth={3} />}
                                            {msg.status === 'seen' && <CheckCheck size={11} strokeWidth={3} className="text-emerald-400" />}
                                        </span>
                                    )}
                                </div>

                                {msg.reactions?.length > 0 && (
                                    <div className={`flex flex-wrap gap-1 absolute -bottom-3.5 z-10 animate-in zoom-in duration-300 ${isSentByAdmin ? 'right-2' : 'left-2'}`}>
                                        {msg.reactions.map((r, i) => (
                                            <div key={i} className="bg-white border border-[#f0f0f0] rounded-full px-1.5 py-0.5 text-[11px] shadow-sm ring-2 ring-[#fafafa] font-normal">
                                                {r.emoji}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Contextual 3-Dot Menu Trigger (Visible on Hover) */}
                            {!msg.isDeletedEveryone && !editingMessage && (
                                <button 
                                    onClick={() => setActiveMenuId(activeMenuId === msg._id ? null : msg._id)}
                                    className={`p-1 mt-1 text-lightgray hover:text-charcoal transition-all opacity-0 group-hover:opacity-100 hover:bg-ivory rounded-lg shrink-0 ${activeMenuId === msg._id ? 'opacity-100' : ''}`}
                                >
                                    <MoreVertical size={16} />
                                </button>
                            )}

                            {/* Action Menu (Positioned Absolute relative to Bubble area) */}
                            {activeMenuId === msg._id && !editingMessage && (
                                <div ref={menuRef} className={`absolute top-full mt-2 w-48 bg-white shadow-[0_15px_40px_rgba(0,0,0,0.12)] rounded-2xl py-2 z-[100] border border-[#f8f8f8] animate-in zoom-in-95 duration-150 ${isSentByAdmin ? "right-0" : "left-0"}`}>
                                    <div className="px-4 py-1.5 mb-1 flex items-center justify-between border-b border-[#f9f9f9] pb-2">
                                        {REACTION_EMOJIS.map(emoji => <button key={emoji} onClick={() => handleReact(msg._id, emoji)} className="text-lg hover:scale-125 transition-transform">{emoji}</button>)}
                                    </div>
                                    <button onClick={() => {setReplyingTo(msg); setActiveMenuId(null);}} className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-[#fafafa] text-[12px] font-bold text-charcoal/80"><Reply size={14} className="opacity-40" /> Reply</button>
                                    <button onClick={() => {navigator.clipboard.writeText(msg.text); setActiveMenuId(null); toast.success('Copied to clipboard');}} className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-[#fafafa] text-[12px] font-bold text-charcoal/80"><Copy size={14} className="opacity-40" /> Copy Text</button>
                                    {isSentByAdmin && (
                                        <button onClick={() => {setEditingMessage(msg._id); setEditText(msg.text); setActiveMenuId(null);}} className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-[#fafafa] text-[12px] font-bold text-charcoal/80"><Edit3 size={14} className="opacity-40" /> Edit Message</button>
                                    )}
                                    <div className="mt-1 pt-1 border-t border-red-50">
                                        <button onClick={() => { setIsDeleting(msg); setActiveMenuId(null); }} className="w-full text-left px-4 py-2.5 text-[10px] uppercase font-black text-red-500 hover:bg-red-50 flex items-center gap-3"><Trash2 size={14} /> Remove for me</button>
                                        {isSentByAdmin && (
                                            <button onClick={() => {handleDelete(msg._id, 'everyone'); setActiveMenuId(null);}} className="w-full text-left px-4 py-2.5 text-[10px] uppercase font-black text-red-500 hover:bg-red-50 flex items-center gap-3"><Trash2 size={14} /> Wipe for everyone</button>
                                        )}
                                    </div>
                                </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </React.Fragment>
                  );
                })}
                {isTyping && <div className="text-[10px] text-stone-500 uppercase font-bold tracking-[0.3em] pl-4 opacity-50 animate-pulse">Typing...</div>}
                <div ref={messagesEndRef} className="h-4" />
              </div>

              {/* Input Area */}
              <div className="p-4 bg-transparent relative z-20">
                {replyingTo && (
                    <div className="absolute bottom-[calc(100%+8px)] left-6 right-6 bg-[#ffffff] border border-[#eeeeee] rounded-xl p-3 flex items-center justify-between shadow-[0_4px_12px_rgba(0,0,0,0.04)] animate-in fade-in slide-in-from-bottom-2">
                        <div className="min-w-0 pr-4">
                            <p className="text-[9px] font-bold text-[#5a5a5a] mb-0.5 uppercase tracking-widest">In reply to</p>
                            <p className="text-[12px] text-[#2c2c2c] font-medium truncate opacity-90">{replyingTo.text}</p>
                        </div>
                        <button onClick={() => setReplyingTo(null)} className="p-1 hover:bg-[#f7f5f2] rounded-full transition-colors text-[#5a5a5a]"><X size={14} /></button>
                    </div>
                )}

                <div className="flex items-center gap-3 bg-[#ffffff] shadow-[0_5px_15px_rgba(0,0,0,0.06)] rounded-[20px] px-3 py-2 relative">
                   <button onClick={() => fileInputRef.current?.click()} className="w-10 h-10 flex items-center justify-center hover:bg-[#f7f5f2] rounded-[14px] transition-all text-[#a3a3a3] hover:text-[#5a5a5a]">
                     <Paperclip size={18} />
                   </button>
                   <input type="file" ref={fileInputRef} onChange={handleFileUpload} className="hidden" />

                    <div className="flex-1 relative flex items-center">
                      <textarea 
                         ref={inputRef} placeholder="Type a message..." value={newMessage} onChange={handleTyping}
                         onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }}}
                         className="w-full bg-transparent border-none py-2 pl-2 pr-10 text-[13px] min-h-[40px] max-h-32 resize-none focus:outline-none focus:ring-0 transition-all placeholder:text-[#a3a3a3] text-[#2c2c2c]"
                         rows={1} onInput={(e) => { e.target.style.height = 'auto'; e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px'; }}
                      />
                      <button onClick={() => setShowEmojiPicker(!showEmojiPicker)} className={`absolute right-1 p-2 rounded-full transition-all ${showEmojiPicker ? 'bg-[#f7f5f2] text-[#2c2c2c]' : 'text-[#a3a3a3] hover:text-[#5a5a5a] hover:bg-[#f7f5f2]'}`}><Smile size={20} /></button>
                     {showEmojiPicker && (
                        <div className="absolute bottom-[calc(100%+16px)] right-0 z-50 shadow-2xl rounded-2xl overflow-hidden animate-in zoom-in-95 border border-[#eeeeee]">
                            <EmojiPicker onEmojiClick={handleEmojiClick} width={300} height={380} theme="light" skinTonesDisabled />
                        </div>
                     )}
                   </div>
                   
                   <button 
                    onClick={handleSend} disabled={!newMessage.trim() && !attachmentsPreview}
                    className="w-10 h-10 flex items-center justify-center bg-gradient-to-br from-[#d6cfc4] to-[#e8dfd1] text-[#2c2c2c] rounded-[14px] transition-all duration-250 hover:scale-105 active:scale-95 disabled:opacity-30 disabled:hover:scale-100 shadow-sm"
                   >
                     <Send size={16} className="translate-x-[1px] translate-y-[1px]" />
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
          <div className="flex-1 flex flex-col items-center justify-center text-gray-400 gap-6">
              <div className="w-16 h-16 bg-[#f9f9f9] rounded-[24px] flex items-center justify-center border border-[#f2f2f2] shadow-inner"><MessageSquare size={24} className="text-charcoal" /></div>
              <div className="max-w-xs space-y-1.5"><h3 className="text-xl font-serif text-charcoal">Select a chat</h3></div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
