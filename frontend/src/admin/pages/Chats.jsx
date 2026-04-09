import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  MessageSquare, Send, User, Check, CheckCheck, ChevronLeft,
  MoreVertical, Edit3, Trash2, Smile, Paperclip, Search, X, Clock, Reply, Copy, Image as ImageIcon, Bell
} from 'lucide-react';
import axios from 'axios';
import { io } from 'socket.io-client';
import EmojiPicker from 'emoji-picker-react';
import { format } from 'date-fns';
import { useAuth } from "../../context/AuthContext";
import { motion, AnimatePresence } from 'framer-motion';
import { useDispatch, useSelector } from 'react-redux';
import { fetchUnreadCounts, clearAdminUnread, handleRoomUpdate, markRoomAsRead } from '../../store/slices/chatSlice';
import ChatSearchBar from "../../components/client/Chat/SearchBar";
import toast from 'react-hot-toast';

const API_URL = import.meta.env.VITE_API_URL || "";
const REACTION_EMOJIS = ['👍', '❤️', '😂', '😲', '😢'];

export default function Chats() {
  const { user: adminProfile, token: authContextToken, logout } = useAuth();
  const dispatch = useDispatch();
  const roomStates = useSelector(state => state.chat.roomStates);
  const [conversations, setConversations] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const selectedUserRef = useRef(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [isTyping, setIsTyping] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [editingMessage, setEditingMessage] = useState(null);
  const [editText, setEditText] = useState("");
  const [activeMenuId, setActiveMenuId] = useState(null);
  const [numResults, setNumResults] = useState(0);
  const [isMobileThreadView, setIsMobileThreadView] = useState(false);
  const [replyingTo, setReplyingTo] = useState(null);
  const [globalSearchResults, setGlobalSearchResults] = useState([]);
  const [isSearchingGlobal, setIsSearchingGlobal] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [clearedHistory, setClearedHistory] = useState({}); // { [userId]: timestamp }

  // Debounced Global Search
  useEffect(() => {
    if (!searchTerm || searchTerm.length < 2) {
      setGlobalSearchResults([]);
      return;
    }
    const delayDebounceFn = setTimeout(async () => {
      setIsSearchingGlobal(true);
      try {
        const token = cleanToken(authContextToken || localStorage.getItem("token"));
        const res = await axios.get(`${API_URL}/api/chats/search-users?query=${searchTerm}`, {
          headers: { "x-auth-token": token, "Authorization": `Bearer ${token}` }
        });
        setGlobalSearchResults(res.data);
      } catch (err) { console.error("Global search error", err); }
      finally { setIsSearchingGlobal(false); }
    }, 500);

    return () => clearTimeout(delayDebounceFn);
  }, [searchTerm, authContextToken]);

  // Pagination
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [isFetchingMore, setIsFetchingMore] = useState(false);

  // Modals/Menus
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

  const cleanToken = (raw) => {
    if (!raw || typeof raw !== 'string') return null;
    const cleaned = raw.replace(/^["']|["']$/g, '').trim();
    return cleaned === 'null' || cleaned === 'undefined' ? null : cleaned;
  };

  const fetchConversations = async (showLoading = false) => {
    const token = cleanToken(authContextToken || localStorage.getItem("token"));
    if (!token) return;

    try {
      if (showLoading) setLoading(true);
      const res = await axios.get(`${API_URL}/api/chats/admin/conversations`, {
        headers: {
          "x-auth-token": token,
          "Authorization": `Bearer ${token}`
        }
      });
      const sortedUsers = Array.isArray(res.data) ? res.data.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)) : [];
      setConversations(sortedUsers);
    } catch (err) {
      if (err.response?.status === 401) {
        console.warn("--- [AUTH/401] --- Admin fetchConversations rejected");
        logout();
      }
    } finally { if (showLoading) setLoading(false); }
  };

  // Socket Logic
  useEffect(() => {
    const token = cleanToken(authContextToken || localStorage.getItem("token"));
    if (!token) return;

    const newSocket = io(API_URL, {
      auth: { token },
      reconnection: true,
      reconnectionAttempts: 10,
      timeout: 10000
    });

    socketRef.current = newSocket;

    newSocket.on('connect', () => {
      console.log('--- [SOCKET] --- Admin connected successfully ---');
      newSocket.emit('join_chat', 'admin');
      if (adminProfile?.id || adminProfile?._id) {
        newSocket.emit('join_chat', String(adminProfile.id || adminProfile._id));
      }
    });

    newSocket.on('connect_error', (err) => {
      console.warn('--- [SOCKET] --- Admin connection error:', err.message);
    });

    newSocket.on('disconnect', (reason) => {
      console.warn('--- [SOCKET] --- Admin disconnected:', reason);
    });

    newSocket.on('new_message', (message) => {
      // WhatsApp Lifecycle: Industry-Standard DB Synchronization
      const senderId = typeof message.sender === 'object' ? String(message.sender._id) : String(message.sender);
      const recipientId = typeof message.recipient === 'object' ? String(message.recipient._id) : String(message.recipient);

      const isOutbound = (senderId === 'admin' || senderId === String(adminProfile?.id || adminProfile?._id));
      const clientUserId = isOutbound ? recipientId : senderId;

      if (!clientUserId || clientUserId === 'admin') return;
      
      // Remove from cleared history if a new message arrives after the clear time
      setClearedHistory(prev => {
        const newHistory = { ...prev };
        delete newHistory[clientUserId];
        return newHistory;
      });

      // 1. If we are active in this chat, mark as seen immediately
      const isCurThread = selectedUserRef.current?.chatId === clientUserId;
      if (isCurThread) {
        setMessages(prev => {
          if (prev.find(m => m._id === message._id)) return prev;
          return [...prev, message];
        });
      } else {
        // 2. STRICTURE: Re-fetch conversations for latest message snippet
        fetchConversations();
      }

      // --- WhatsApp Logic: Auto-Ack Delivery ---
      if (!isOutbound) {
          // If we are recipient, tell the sender we got it for the double grey tick
          newSocket.emit('message_delivered', { 
            messageId: message._id, 
            senderId: senderId 
          });
      }
    });

    newSocket.on('room_updated', (data) => dispatch(handleRoomUpdate(data)));

    newSocket.on('chat_seen', (data) => {
      // If someone else (or another tab) saw the chat, refresh everything
      fetchConversations();

      const chatId = typeof data === 'string' ? data : data.chatId;
      if (chatId === 'admin' || String(chatId) === String(selectedUserRef.current?.chatId)) {
        setMessages(prev => prev.map(m =>
          (String(m.sender) === 'admin' || String(m.sender) === String(adminProfile?.id || adminProfile?._id))
            ? { ...m, status: 'seen', seen: true, isRead: true }
            : m
        ));
      }
    });

    newSocket.on('message_status_update', (data) => {
      setMessages(prev => prev.map(m => m._id === data.messageId ? { ...m, status: data.status } : m));
    });

    newSocket.on('message_reaction_update', (data) => {
      setMessages(prev => prev.map(m => m._id === data.messageId ? { ...m, reactions: data.reactions } : m));
    });

    newSocket.on('display_typing', (data) => { if (selectedUserRef.current?.chatId === data.senderId) setIsTyping(true); });
    newSocket.on('hide_typing', (data) => { if (selectedUserRef.current?.chatId === data.senderId) setIsTyping(false); });
    newSocket.on('message_edited', (updatedMsg) => { setMessages(prev => prev.map(m => m._id === updatedMsg._id ? updatedMsg : m)); });
    newSocket.on('message_deleted_everyone', (data) => { setMessages(prev => prev.map(m => m._id === data.id ? { ...m, text: 'This transmission redacted', isDeletedEveryone: true, attachments: [] } : m)); });
    newSocket.on('chat_cleared', (data) => {
      if (selectedUserRef.current?.chatId === data.userId) {
        setMessages([]);
        setSelectedUser(null);
        selectedUserRef.current = null;
        setIsMobileThreadView(false);
      }
      setClearedHistory(prev => ({ ...prev, [data.userId]: Date.now() }));
      setConversations(prev => prev.filter(c => c.chatId !== data.userId));
      fetchConversations();
    });

    return () => newSocket.close();
  }, [adminProfile, authContextToken]);

  // Initial Data Fetch Gate
  useEffect(() => {
    const token = cleanToken(authContextToken || localStorage.getItem("token"));
    if (adminProfile && token) {
      fetchConversations(true);
      dispatch(fetchUnreadCounts());
    }
  }, [adminProfile, authContextToken]);

  const fetchMessages = async (userId, pageNum = 1, showLoading = false) => {
    const token = cleanToken(authContextToken || localStorage.getItem("token"));
    if (!token) return;

    try {
      if (pageNum === 1) setLoading(true);
      else setIsFetchingMore(true);
      const res = await axios.get(`${API_URL}/api/chats/admin/${userId}?page=${pageNum}&limit=40`, {
        headers: {
          "x-auth-token": token,
          "Authorization": `Bearer ${token}`
        }
      });
      if (pageNum === 1) {
        setMessages(res.data);
        setPage(1);
        setHasMore(res.data.length === 40);
        setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'auto' }), 100);
      } else {
        const prevHeight = chatContainerRef.current.scrollHeight;
        setMessages(prev => [...res.data, ...prev]);
        setPage(pageNum);
        setHasMore(res.data.length === 40);
        setTimeout(() => {
          const newHeight = chatContainerRef.current.scrollHeight;
          chatContainerRef.current.scrollTop = newHeight - prevHeight;
        }, 0);
      }
    } catch (err) {
      if (err.response?.status === 401) {
        console.warn("--- [AUTH/401] --- Admin fetchMessages rejected");
        logout();
      }
    } finally {
      if (pageNum === 1) setLoading(false);
      else setIsFetchingMore(false);
    }
  };

  const filteredMessages = useMemo(() => {
    if (!searchQuery) return messages;
    return messages; // We show all but use searchQuery for highlighting
  }, [messages, searchQuery]);

  const groupedMessages = useMemo(() => {
    return filteredMessages.map((msg, i) => {
      const prev = filteredMessages[i - 1];
      const next = filteredMessages[i + 1];
      const isGroupStart = !prev || prev.sender !== msg.sender || (new Date(msg.timestamp) - new Date(prev.timestamp) > 300000);
      const isGroupEnd = !next || next.sender !== msg.sender || (new Date(next.timestamp) - new Date(msg.timestamp) > 300000);
      return { ...msg, isGroupStart, isGroupEnd };
    });
  }, [filteredMessages]);

  const handleScroll = () => {
    if (!chatContainerRef.current || isFetchingMore || !hasMore || !selectedUser) return;
    if (chatContainerRef.current.scrollTop === 0) {
      fetchMessages(selectedUser.chatId, page + 1);
    }
  };

  const handleSelectUser = (user) => {
    setSelectedUser(user);
    selectedUserRef.current = user;
    if (user) {
      if (user.chatId) {
        const token = cleanToken(authContextToken || localStorage.getItem("token"));
        if (token) {
          fetchMessages(user.chatId);
          markAsSeen(user.chatId);
        }
      } else {
        // This is a new user from global search with no previous messages
        setMessages([]);
        setPage(1);
        setHasMore(false);
      }
      setReplyingTo(null);
      setAttachmentsPreview(null);
      setIsMobileThreadView(true);
    }
  };

  const markAsSeen = async (userId) => {
    if (!userId) return;
    const token = cleanToken(authContextToken || localStorage.getItem("token"));
    if (!token) return;

    try {
      // 1. Instant Optimistic UI Clear (Zero Delay)
      dispatch(markRoomAsRead({ roomId: userId, readerType: 'admin' }));

      // 2. Direct Socket Signal for global sync
      if (socketRef.current) {
        socketRef.current.emit('mark_read', { roomId: userId, readerType: 'admin' });
      }

      await axios.put(`${API_URL}/api/chats/mark-as-seen`, { chatId: userId }, {
        headers: {
          "x-auth-token": token,
          "Authorization": `Bearer ${token}`
        }
      });

      // Secondary Syncs
      fetchConversations();
      dispatch(fetchUnreadCounts());
    } catch (err) {
      if (err.response?.status === 401) console.warn("--- [AUTH/401] --- Admin markAsSeen rejected");
    }
  };

  const scrollToBottom = (behavior = "smooth") => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTo({
        top: chatContainerRef.current.scrollHeight,
        behavior
      });
    }
  };

  useEffect(() => {
    if (page === 1) scrollToBottom();
  }, [messages, isTyping, page]);

  const handleSend = async (e) => {
    if (e) e.preventDefault();
    if ((!newMessage.trim() && !attachmentsPreview) || !selectedUser) return;
    
    // Determine the target ID (chatId or _id for new users)
    const targetUserId = selectedUser.chatId || selectedUser._id;
    
    const tempId = Date.now().toString();
    const optimisticMsg = {
      _id: tempId, text: newMessage, sender: 'admin', recipient: targetUserId,
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
        { text: optimisticMsg.text, recipient: targetUserId, messageType: optimisticMsg.messageType, attachments: optimisticMsg.attachments, replyTo: optimisticMsg.replyTo?._id },
        { headers: { "x-auth-token": token } }
      );
      setMessages(prev => {
        const alreadyExists = prev.find(m => m._id === res.data._id);
        if (alreadyExists) return prev.filter(m => m._id !== tempId);
        return prev.map(m => m._id === tempId ? res.data : m);
      });
      socketRef.current?.emit('typing_stop', { roomId: targetUserId, senderId: 'admin' });

      // If this was a new conversation, re-fetch the list to show the new entry
      if (!selectedUser.chatId) {
        const updatedUser = { ...selectedUser, chatId: targetUserId };
        setSelectedUser(updatedUser);
        selectedUserRef.current = updatedUser;
        fetchConversations();
      } else {
        fetchConversations();
      }
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
      // Use the newly created /upload endpoint in chatRoutes.js
      const uploadRes = await axios.post(`${API_URL}/api/chats/upload`, formData, {
        headers: {
          "x-auth-token": token,
          "Content-Type": "multipart/form-data"
        }
      });

      setAttachmentsPreview({
        url: uploadRes.data.url.startsWith('http') ? uploadRes.data.url : `${API_URL}${uploadRes.data.url}`,
        fileType: file.type,
        fileName: file.name
      });
    } catch (err) {
      console.error("Upload failed", err);
      toast.error("File upload failed");
    }
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
      
      const now = Date.now();
      setClearedHistory(prev => ({ ...prev, [userId]: now }));

      // Optimistic Update: Immediately hide from sidebar and clear messages
      setConversations(prev => prev.filter(c => c.chatId !== userId));
      setMessages([]);
      setSelectedUser(null);
      selectedUserRef.current = null;
      setIsMobileThreadView(false);
      
      setShowClearModal(false);
      setTimeout(() => fetchConversations(), 500); // Slight delay for DB propagation
      toast.success("Conversation cleared for you");
    } catch (err) {
      console.error("Clear chat error", err);
      toast.error("Failed to clear conversation");
    }
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
    const targetUserId = selectedUser.chatId || selectedUser._id;
    socketRef.current.emit('typing_start', { roomId: targetUserId, senderId: 'admin' });
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => { socketRef.current.emit('typing_stop', { roomId: targetUserId, senderId: 'admin' }); }, 2000);
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

  const backToList = () => { setIsMobileThreadView(false); setShowOptionsMenu(false); };

  const renderHighlightedText = (text, query) => {
    const rawText = (typeof text === 'string') ? text : '';
    const trimmedQuery = query?.trim();
    if (!trimmedQuery || !rawText) return rawText;
    const escapedQuery = trimmedQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const parts = rawText.split(new RegExp(`(${escapedQuery})`, 'gi'));
    return parts.map((part, i) =>
      part.toLowerCase() === trimmedQuery.toLowerCase()
        ? <span key={i} className="bg-[#e8dfd1] text-[#2c2c2c] rounded-[2px] px-0.5">{part}</span>
        : part
    );
  };

  const activeConversations = useMemo(() => {
    return conversations.filter(c => {
      // 1. Strict Clear Check: Hide if cleared in this session and no new messages since
      const clearTime = clearedHistory[c.chatId];
      if (clearTime && c.timestamp && new Date(c.timestamp).getTime() <= clearTime) {
        return false;
      }

      const matchesSearch = String(c.userName || '').toLowerCase().includes(searchTerm.toLowerCase());
      if (!searchTerm) {
        // WhatsApp behavior: Hide if cleared (no visible messages)
        return c.lastMessage && c.lastMessage.trim() !== "";
      }
      return matchesSearch;
    });
  }, [conversations, searchTerm, clearedHistory]);

  const otherContacts = useMemo(() => {
    if (!searchTerm) return [];
    return globalSearchResults.filter(u => !conversations.find(c => c.chatId === u._id));
  }, [globalSearchResults, conversations, searchTerm]);

  return (
    <div className="h-[calc(100vh-100px)] flex flex-col gap-6 animate-in fade-in duration-700 max-w-[1400px] mx-auto w-full font-sans text-[#5a5a5a] overflow-hidden">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end px-2 sm:px-4">
        <div>
          <h1 className="font-luxury text-4xl md:text-5xl text-[#2d2d2d] tracking-tight">Communication Hub</h1>
          <p className="text-[11px] md:text-[13px] text-[#7a7a7a] mt-3 font-medium uppercase tracking-[1px]">Direct client engagement and message registry</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 flex-1 overflow-hidden bg-gradient-to-br from-[#f8f6f2] via-[#f3efe7] to-[#fdfaf6] shadow-[0_10px_30px_rgba(0,0,0,0.06)] rounded-[22px] border border-white/60 p-4 gap-3">
        <div className={`${isMobileThreadView ? 'hidden md:flex' : 'flex'} md:col-span-4 lg:col-span-3 flex flex-col overflow-hidden`}>
          <div className="flex flex-col gap-1 mb-3 pt-1">
            <h2 className="text-[20px] font-serif text-[#2c2c2c] mb-3 px-2">Messages</h2>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-lightgray size-3.5" />
              <input
                type="text" placeholder="Search..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
                className="mb-3 pl-9 pr-4 py-2.5 rounded-xl bg-white/50 border border-white/80 text-[12px] outline-none w-full placeholder:text-lightgray/50 shadow-sm"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto custom-scrollbar space-y-2 pr-1">
            {searchTerm && activeConversations.length > 0 && (
              <p className="text-[10px] font-black uppercase tracking-widest text-warmgray px-2 mb-2 opacity-60">Active Chats</p>
            )}
            {activeConversations.map((conv) => (
              <button
                key={conv.chatId} onClick={() => handleSelectUser(conv)}
                className={`w-full flex items-center gap-3 p-3 rounded-[18px] transition-all duration-[300ms] group ${selectedUser?.chatId === conv.chatId ? 'bg-[#e8dfd1] text-[#2c2c2c] shadow-[0_4px_12px_rgba(0,0,0,0.05)]' : 'bg-white/60 hover:bg-white/90 shadow-sm border border-white/40 hover:border-white transition-all'}`}
              >
                <div className={`w-11 h-11 rounded-[14px] flex items-center justify-center font-bold shrink-0 transition-all ${selectedUser?.chatId === conv.chatId ? 'bg-white/60 text-[#2c2c2c]' : 'bg-[#f3eee7] text-[#8a8a8a]'}`}>
                  {String(conv.userName || '').charAt(0)}
                </div>
                <div className="flex-1 min-w-0 text-left">
                  <div className="flex justify-between items-center mb-0.5">
                    <h3 className="text-[13px] font-black truncate text-[#2c2c2c] leading-tight">{String(conv.userName || '')}</h3>
                    <span className="text-[9px] opacity-40 uppercase font-black whitespace-nowrap ml-2">{conv.timestamp ? format(new Date(conv.timestamp), 'h:mm a') : ''}</span>
                  </div>
                  <p className="text-[11px] truncate opacity-50 font-medium text-[#5a5a5a]">{String(conv.lastMessage || '')}</p>
                </div>
                {/* --- ROOM-BASED REDUX BADGE --- */}
                {(roomStates[conv.chatId]?.unreadCountAdmin > 0 || Number(conv.unreadCount || 0) > 0) && selectedUser?.chatId !== conv.chatId && (
                  <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="shrink-0 ml-2 flex items-center gap-1.5">
                    <span className="bg-[#e11d48] text-white text-[9px] font-black px-1.5 py-0.5 rounded-full min-w-[18px] text-center shadow-sm">
                      {roomStates[conv.chatId]?.unreadCountAdmin || conv.unreadCount}
                    </span>
                    <Bell size={14} className="text-[#e11d48] fill-[#e11d48]/10 animate-shake" />
                  </motion.div>
                )}
              </button>
            ))}

            {searchTerm && otherContacts.length > 0 && (
              <div className="mt-6">
                <p className="text-[10px] font-black uppercase tracking-widest text-warmgray px-2 mb-2 opacity-60">Other Contacts</p>
                {otherContacts.map((u) => (
                  <button
                    key={u._id} onClick={() => handleSelectUser({ ...u, userName: u.name || `${u.firstName} ${u.lastName}`.trim() })}
                    className={`w-full flex items-center gap-3 p-3 rounded-[18px] transition-all duration-[300ms] group bg-white/40 hover:bg-white/80 shadow-sm border border-white/20 hover:border-white mb-2`}
                  >
                    <div className="w-11 h-11 rounded-[14px] bg-[#fbf9f6] flex items-center justify-center font-bold text-[#8a8a8a] shrink-0">{String(u.name || u.firstName || '').charAt(0)}</div>
                    <div className="flex-1 min-w-0 text-left">
                      <h3 className="text-[13px] font-black truncate text-[#2c2c2c]">{u.name || `${u.firstName} ${u.lastName}`.trim()}</h3>
                      <p className="text-[10px] truncate opacity-40 font-medium">{u.email}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}

            {!searchTerm && conversations.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full opacity-40 p-4 text-center mt-20">
                <MessageSquare size={32} className="mb-4" />
                <p className="text-[11px] font-black uppercase tracking-widest">No active conversations</p>
                <p className="text-[10px] mt-2 font-medium">Search for a client to start chatting</p>
              </div>
            )}

            {searchTerm && activeConversations.length === 0 && otherContacts.length === 0 && !isSearchingGlobal && (
              <div className="flex flex-col items-center justify-center p-8 opacity-40 text-center">
                <Search size={24} className="mb-3" />
                <p className="text-[10px] font-black uppercase tracking-widest">No results found</p>
              </div>
            )}
          </div>
        </div>

        <div className={`${isMobileThreadView ? 'flex' : 'hidden md:flex'} md:col-span-8 lg:col-span-9 flex flex-col overflow-hidden relative`}>
          {selectedUser ? (
            <div className="flex flex-col h-full">
              <div className="px-5 py-4 border-b border-white/60 flex items-center justify-between z-10 bg-white/20 backdrop-blur-md rounded-t-[22px]">
                <div className="flex items-center gap-3">
                  <button onClick={backToList} className="md:hidden p-1 hover:bg-[#fafafa] rounded-lg text-[#2c2c2c]"><ChevronLeft size={18} /></button>
                  <div className="w-9 h-9 bg-white/60 rounded-xl flex items-center justify-center text-[#2c2c2c] font-serif text-sm border border-white shrink-0 shadow-sm">{String(selectedUser.userName || '').charAt(0)}</div>
                  <div className="flex flex-col">
                    <h3 className="font-serif text-[16px] text-[#2c2c2c] leading-none mb-1">{String(selectedUser.userName || '')}</h3>
                    <div className="flex items-center gap-1.5 opacity-50">
                      <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></div>
                      <span className="text-[8px] font-black uppercase tracking-[0.2em]">Live Session</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <ChatSearchBar onSearch={(q) => {
                    setSearchQuery(q);
                    setNumResults(messages.filter(m => String(m.text || '').toLowerCase().includes(q.toLowerCase())).length);
                  }} />
                  <button onClick={() => setShowOptionsMenu(!showOptionsMenu)} className="p-2 hover:bg-white/60 rounded-xl transition-all relative">
                    <MoreVertical size={18} />
                    <AnimatePresence>
                      {showOptionsMenu && (
                        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }} className="absolute top-11 right-0 w-44 bg-white/90 backdrop-blur-xl border border-white/80 shadow-2xl rounded-2xl py-2 z-50 overflow-hidden">
                          <button onClick={() => setShowClearModal(true)} className="w-full text-left px-4 py-3 text-[10px] uppercase font-black text-red-600 hover:bg-red-50 flex items-center gap-3 transition-colors">
                            <Trash2 size={14} /> Clear DM History
                          </button>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </button>
                </div>
              </div>

              <div ref={chatContainerRef} onScroll={handleScroll} className="flex-1 overflow-y-auto p-6 flex flex-col custom-scrollbar scroll-smooth bg-transparent">
                {groupedMessages.map((msg, idx) => {
                  const isSentByAdmin = (adminProfile?.id || adminProfile?._id) && (String(msg.sender) === String(adminProfile.id || adminProfile._id) || msg.sender === 'admin');
                  const showDateHeader = idx === 0 || new Date(groupedMessages[idx - 1].timestamp).toDateString() !== new Date(msg.timestamp).toDateString();

                  return (
                    <React.Fragment key={msg._id}>
                      {showDateHeader && (
                        <div className="flex justify-center my-6">
                          <span className="px-4 py-1.5 bg-white/40 backdrop-blur-sm text-[9px] font-black uppercase tracking-[0.3em] text-warmgray rounded-full border border-white/60 shadow-sm">
                            {(msg.timestamp && !isNaN(new Date(msg.timestamp))) ? format(new Date(msg.timestamp), 'EEEE, MMM dd') : ''}
                          </span>
                        </div>
                      )}

                      <div id={`msg-${msg._id}`} className={`w-full flex px-2 ${isSentByAdmin ? "justify-end" : "justify-start"} ${msg.isGroupStart ? "mt-5" : "mt-1"} ${msg.isGroupEnd ? "mb-5" : "mb-1"}`}>
                        <div className={`flex flex-col group max-w-[85%] lg:max-w-[70%] relative ${isSentByAdmin ? 'items-end' : 'items-start'}`}>
                          <div className={`flex items-start gap-2 ${isSentByAdmin ? 'flex-row-reverse' : 'flex-row'}`}>
                            <div className={`px-4 py-3 text-[13px] relative flex flex-col gap-2 transition-all duration-[300ms] hover:scale-[1.01] shadow-sm ${isSentByAdmin ? "bg-gradient-to-br from-[#e8dfd1] to-[#f5ebe0] text-[#2c2c2c] rounded-[20px] rounded-tr-none" : "bg-white/80 text-[#333333] border border-white/60 rounded-[20px] rounded-tl-none"}`}>
                              {msg.replyTo && (
                                <div className={`p-2.5 rounded-xl text-[11px] mb-1 line-clamp-2 border-l-4 transition-all ${isSentByAdmin ? 'bg-white/30 border-white/60' : 'bg-[#f7f5f2] border-[#e8dfd1]'}`}>
                                  <p className="font-black opacity-60 mb-0.5 text-[8px] uppercase tracking-widest flex items-center gap-2"><Reply size={10} strokeWidth={3} /> Referenced Message</p>
                                  <p className="italic font-medium opacity-80">{String(msg.replyTo.text || '')}</p>
                                </div>
                              )}

                              {editingMessage === msg._id ? (
                                <div className="flex flex-col gap-3 min-w-[260px]">
                                  <textarea className="bg-white/40 backdrop-blur-xl p-3 rounded-xl focus:outline-none w-full border border-white/60 text-[13px] placeholder:text-white/30 resize-none font-medium" value={editText} onChange={(e) => setEditText(e.target.value)} autoFocus />
                                  <div className="flex justify-end gap-3 text-[10px] font-black uppercase tracking-widest">
                                    <button onClick={() => { setEditingMessage(null); setEditText(""); }} className="opacity-60">Cancel</button>
                                    <button onClick={() => handleEditSave(msg._id)} className="bg-white text-charcoal px-4 py-1.5 rounded-full shadow-md">Update</button>
                                  </div>
                                </div>
                              ) : (
                                <div className="flex flex-col gap-2">
                                  {msg.messageType === 'image' && msg.attachments?.[0] && (
                                    <div className="relative overflow-hidden rounded-xl border border-white/40 mb-1 shadow-inner"><img src={msg.attachments[0].url} className="w-full max-h-80 object-contain" /></div>
                                  )}
                                  <p className="whitespace-pre-wrap leading-relaxed select-text font-medium">{msg.isDeletedEveryone ? "This transmission redacted" : renderHighlightedText(msg.text, searchQuery)}</p>
                                  <div className={`flex items-center justify-end gap-2 text-[9px] font-black uppercase tracking-widest ${isSentByAdmin ? 'text-charcoal/40' : 'text-warmgray'}`}>
                                    {msg.isEdited && !msg.isDeletedEveryone && <span className="opacity-60">(Edited)</span>}
                                    <span className="opacity-80">{(msg.timestamp && !isNaN(new Date(msg.timestamp))) ? format(new Date(msg.timestamp), 'h:mm a') : ''}</span>
                                    {isSentByAdmin && (
                                      <span className="flex items-center ml-1">
                                        {msg.status === 'sent' && <Check size={11} strokeWidth={3} className="opacity-40" />}
                                        {msg.status === 'delivered' && <CheckCheck size={11} strokeWidth={3} className="opacity-40" />}
                                        {msg.status === 'seen' && <CheckCheck size={11} strokeWidth={3} className="text-[#34B7F1] drop-shadow-sm" />}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              )}

                              {msg.reactions?.length > 0 && (
                                <div className={`flex flex-wrap gap-1 absolute -bottom-3.5 z-10 ${isSentByAdmin ? 'right-2' : 'left-2'}`}>
                                  {msg.reactions.map((r, i) => (
                                    <div key={i} className="bg-white/90 backdrop-blur-sm border border-white/80 rounded-full px-2 py-0.5 text-[12px] shadow-md ring-1 ring-black/5">{r.emoji}</div>
                                  ))}
                                </div>
                              )}
                            </div>

                            <button onClick={() => setActiveMenuId(activeMenuId === msg._id ? null : msg._id)} className={`p-1.5 mt-1 text-lightgray opacity-0 group-hover:opacity-100 hover:bg-white/60 rounded-xl transition-all ${activeMenuId === msg._id ? 'opacity-100' : ''}`}><MoreVertical size={16} /></button>

                            {activeMenuId === msg._id && (
                              <div ref={menuRef} className={`absolute top-full mt-2 w-52 bg-white/90 backdrop-blur-2xl shadow-2xl rounded-[20px] py-2 z-[100] border border-white animate-in zoom-in-95 duration-200 ${isSentByAdmin ? "right-0" : "left-0"}`}>
                                <div className="px-5 py-2 mb-2 flex items-center justify-between border-b border-black/5 pb-3">
                                  {REACTION_EMOJIS.map(emoji => <button key={emoji} onClick={() => handleReact(msg._id, emoji)} className="text-xl hover:scale-150 transition-transform active:scale-95">{emoji}</button>)}
                                </div>
                                <button onClick={() => { setReplyingTo(msg); setActiveMenuId(null); }} className="w-full flex items-center gap-3 px-5 py-2.5 hover:bg-black/5 text-[11px] font-black uppercase text-charcoal/70 tracking-widest"><Reply size={14} className="opacity-60" /> Reply</button>
                                <button onClick={() => { navigator.clipboard.writeText(msg.text); setActiveMenuId(null); toast.success('Copied to clipboard'); }} className="w-full flex items-center gap-3 px-5 py-2.5 hover:bg-black/5 text-[11px] font-black uppercase text-charcoal/70 tracking-widest"><Copy size={14} className="opacity-60" /> Copy Text</button>
                                {isSentByAdmin && <button onClick={() => { setEditingMessage(msg._id); setEditText(msg.text); setActiveMenuId(null); }} className="w-full flex items-center gap-3 px-5 py-2.5 hover:bg-black/5 text-[11px] font-black uppercase text-charcoal/70 tracking-widest"><Edit3 size={14} className="opacity-60" /> Edit Message</button>}
                                <div className="mt-1 pt-1 border-t border-black/5">
                                  <button onClick={() => { handleDelete(msg._id, 'me'); setActiveMenuId(null); }} className="w-full text-left px-5 py-2.5 text-[10px] uppercase font-black text-red-600 hover:bg-red-50 flex items-center gap-3 tracking-widest"><Trash2 size={14} /> Remove for me</button>
                                  {isSentByAdmin && <button onClick={() => { handleDelete(msg._id, 'everyone'); setActiveMenuId(null); }} className="w-full text-left px-5 py-2.5 text-[10px] uppercase font-black text-red-600 hover:bg-red-50 flex items-center gap-3 tracking-widest"><Trash2 size={14} /> Wipe everywhere</button>}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </React.Fragment>
                  );
                })}
                {isTyping && <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="text-[10px] text-emerald-600 uppercase font-black tracking-[0.4em] pl-6 mt-2">Active Typing...</motion.div>}
                <div ref={messagesEndRef} className="h-6" />
              </div>

              <div className="p-5 bg-transparent relative">
                {replyingTo && (
                  <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="absolute bottom-[calc(100%+12px)] left-6 right-6 bg-white/80 backdrop-blur-2xl border border-white rounded-2xl p-4 flex items-center justify-between shadow-2xl z-30">
                    <div className="min-w-0 pr-4">
                      <p className="text-[9px] font-black text-emerald-600 mb-1 uppercase tracking-widest">Replying to msg</p>
                      <p className="text-[13px] text-charcoal font-medium truncate opacity-70 italic">"{replyingTo.text}"</p>
                    </div>
                    <button onClick={() => setReplyingTo(null)} className="p-2 hover:bg-stone-100 rounded-full transition-colors text-stone-500 shadow-sm"><X size={16} /></button>
                  </motion.div>
                )}

                <div className="flex items-center gap-4 bg-white/60 backdrop-blur-2xl shadow-[0_15px_50px_rgba(0,0,0,0.12)] rounded-[28px] px-4 py-3 relative border border-white">
                  <button onClick={() => fileInputRef.current?.click()} className="w-12 h-12 flex items-center justify-center hover:bg-white rounded-2xl transition-all text-warmgray hover:text-charcoal group shadow-sm border border-transparent hover:border-white/80">
                    <Paperclip size={20} className="group-hover:rotate-45 transition-transform" />
                  </button>
                  <input type="file" ref={fileInputRef} onChange={handleFileUpload} className="hidden" />

                  <div className="flex-1 relative flex items-center">
                    <textarea
                      ref={inputRef} placeholder="Enter message here..." value={newMessage} onChange={handleTyping}
                      onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                      className="w-full bg-transparent border-none py-3 pl-2 pr-12 text-[14px] min-h-[48px] max-h-40 resize-none focus:outline-none placeholder:text-warmgray/50 text-charcoal font-medium"
                      rows={1} onInput={(e) => { e.target.style.height = 'auto'; e.target.style.height = Math.min(e.target.scrollHeight, 160) + 'px'; }}
                    />
                    <button onClick={() => setShowEmojiPicker(!showEmojiPicker)} className={`absolute right-0 p-2.5 rounded-2xl transition-all ${showEmojiPicker ? 'bg-emerald-50 text-emerald-600' : 'text-warmgray hover:text-charcoal hover:bg-white'}`}><Smile size={22} /></button>
                    {showEmojiPicker && (
                      <div className="absolute bottom-[calc(100%+24px)] right-0 z-50 shadow-3xl rounded-[28px] overflow-hidden border border-white/80 scale-100 origin-bottom-right transition-transform">
                        <EmojiPicker onEmojiClick={handleEmojiClick} width={320} height={420} theme="light" skinTonesDisabled />
                      </div>
                    )}
                  </div>

                  <button
                    onClick={handleSend} disabled={!newMessage.trim() && !attachmentsPreview}
                    className="w-12 h-12 flex items-center justify-center bg-gradient-to-br from-[#2c2c2c] to-[#4c4c4c] text-white rounded-2xl transition-all duration-300 hover:shadow-2xl hover:scale-105 active:scale-95 disabled:opacity-20 disabled:grayscale shadow-lg"
                  >
                    <Send size={18} className="translate-x-[1px]" />
                  </button>
                </div>

                {attachmentsPreview && (
                  <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="absolute bottom-[calc(100%+20px)] left-8 bg-white/90 backdrop-blur-2xl border-4 border-white rounded-2xl p-2 shadow-3xl z-40 group">
                    <img src={attachmentsPreview.url} className="max-h-40 rounded-xl shadow-inner" />
                    <button onClick={() => setAttachmentsPreview(null)} className="absolute -top-3 -right-3 bg-red-600 text-white rounded-full p-2 shadow-2xl border-2 border-white hover:scale-110 transition-transform"><X size={12} /></button>
                  </motion.div>
                )}
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-gray-400 gap-8 animate-pulse">
              <div className="w-20 h-20 bg-white/40 backdrop-blur-md rounded-[32px] flex items-center justify-center border border-white shadow-xl"><MessageSquare size={32} className="text-warmgray" /></div>
              <div className="text-center space-y-2">
                <h3 className="text-2xl font-serif text-charcoal">Secure Interface</h3>
                <p className="text-[10px] uppercase font-black tracking-[0.4em] text-warmgray">Select conversation to begin encrypted transmission</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {showClearModal && (
        <div className="fixed inset-0 bg-charcoal/30 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
          <div className="bg-white rounded-[28px] p-6 max-w-xs w-full shadow-2xl border border-ivory/50 text-center">
            <h3 className="text-lg font-serif text-charcoal mb-1">Clear history</h3>
            <p className="text-[9px] text-warmgray mb-6 font-bold uppercase tracking-widest">Permanent record deletion</p>
            <div className="flex flex-col gap-2">
              <button onClick={() => handleClear(selectedUser.chatId)} className="w-full py-2.5 bg-red-600 text-white rounded-xl text-[9px] font-bold uppercase tracking-widest shadow-lg">Confirm clear</button>
              <button onClick={() => setShowClearModal(false)} className="w-full py-2.5 bg-ivory text-warmgray rounded-xl text-[9px] font-bold uppercase tracking-widest border border-[#e6e3df]">Abort</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
