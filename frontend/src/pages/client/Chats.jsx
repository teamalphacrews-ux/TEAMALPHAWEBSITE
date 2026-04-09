import React, { useState, useEffect, useRef, useMemo } from "react";
import axios from "axios";
import { io } from "socket.io-client";
import { 
  Search, MoreVertical, Trash2, 
  MessageSquare, ShieldCheck, Sparkles, X, ChevronDown, CheckCircle2
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "../../context/AuthContext";
import { useDispatch } from 'react-redux';
import { fetchClientUnreadCounts, clearClientUnread, handleRoomUpdate, markRoomAsRead } from '../../store/slices/chatSlice';
import toast, { Toaster } from 'react-hot-toast';

// Modular Components
import MessageBubble from "../../components/client/Chat/MessageBubble";
import ChatInput from "../../components/client/Chat/ChatInput";
import ChatSearchBar from "../../components/client/Chat/SearchBar";

const API_URL = import.meta.env.VITE_API_URL || "";

export default function Chats() {
    const { user, token: authContextToken } = useAuth();
    const dispatch = useDispatch();
    const [messages, setMessages] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isTyping, setIsTyping] = useState(false);
    const [replyingTo, setReplyingTo] = useState(null);
    const [searchQuery, setSearchQuery] = useState("");
    const [numResults, setNumResults] = useState(0);
    const [showOptions, setShowOptions] = useState(false);
    const [showClearModal, setShowClearModal] = useState(false);

    const messagesEndRef = useRef(null);
    const chatContainerRef = useRef(null);
    const socketRef = useRef(null);
    const optionsRef = useRef(null);
    const typingTimeoutRef = useRef(null);

    const cleanToken = (raw) => {
        if (!raw || typeof raw !== 'string') return null;
        const cleaned = raw.replace(/^["']|["']$/g, '').trim();
        return cleaned === 'null' || cleaned === 'undefined' ? null : cleaned;
    };

    // Socket Initialization
    useEffect(() => {
        const token = cleanToken(authContextToken || localStorage.getItem("token"));
        if (!token || !user) return;

        const socket = io(API_URL, { 
            auth: { token },
            reconnection: true,
            reconnectionAttempts: 10
        });
        socketRef.current = socket;

        socket.on('connect', () => {
            console.log('--- [SOCKET] --- Client connected successfully ---');
            socket.emit("join_chat", user.id);
        });

        socket.on('connect_error', (err) => {
            console.warn('--- [SOCKET] --- Connection error:', err.message);
        });

        // Room-based real-time unread engine
        socket.on('room_updated', (data) => dispatch(handleRoomUpdate(data)));
        socket.on("new_message", (message) => {
            const senderId = typeof message.sender === 'object' ? String(message.sender._id) : String(message.sender);
            const recipientId = typeof message.recipient === 'object' ? String(message.recipient._id) : String(message.recipient);

            if (senderId === user.id || recipientId === user.id || recipientId === 'admin') {
                setMessages(prev => {
                    if (prev.find(m => m._id === message._id)) return prev;
                    return [...prev, message];
                });
                
                // If we are recipient and currently viewing this chat, mark it seen instantly
                if (recipientId === user.id) {
                   socket.emit('message_delivered', { messageId: message._id, senderId: senderId });
                   markAsSeen();
                }
            }
        });

        socket.on("chat_seen", (data) => {
            // When admin sees our messages, update blue ticks
            if (data.chatId === 'admin' || data.chatId === user.id) {
                setMessages(prev => prev.map(m => (m.sender === user.id) ? { ...m, status: 'seen', seen: true, isRead: true } : m));
            }
        });

        socket.on('message_status_update', (data) => {
            setMessages(prev => prev.map(m => m._id === data.messageId ? { ...m, status: data.status } : m));
        });

        socket.on('message_reaction_update', (data) => {
            setMessages(prev => prev.map(m => m._id === data.messageId ? { ...m, reactions: data.reactions } : m));
        });

        socket.on('message_edited', (updatedMsg) => {
            setMessages(prev => prev.map(m => m._id === updatedMsg._id ? updatedMsg : m));
        });

        socket.on('message_deleted_everyone', (data) => {
            setMessages(prev => prev.map(m => m._id === data.id ? { ...m, text: 'This message was deleted', isDeletedEveryone: true, attachments: [] } : m));
        });
        
        socket.on('chat_deleted', (data) => {
            // WhatsApp-style instant wipe across all sessions/tabs
            if (data.userId === 'admin') {
                setMessages([]);
                toast.success("Conversation cleared globally");
            }
        });

        socket.on('display_typing', (data) => {
            if (data.senderId === 'admin' || data.senderId === 'hardcoded-admin-id') setIsTyping(true);
        });

        socket.on('hide_typing', (data) => {
            if (data.senderId === 'admin' || data.senderId === 'hardcoded-admin-id') setIsTyping(false);
        });

        return () => socket.disconnect();
    }, [user?.id, authContextToken]);

    const fetchMessages = async () => {
        const token = cleanToken(authContextToken || localStorage.getItem("token"));
        if (!token || !user) return;
        
        try {
            const res = await axios.get(`${API_URL}/api/chats`, {
                headers: { 
                    "x-auth-token": token,
                    "Authorization": `Bearer ${token}`
                }
            });
            setMessages(res.data);
            setLoading(false);
            scrollToBottom('auto');
        } catch (err) {
            if (err.response?.status === 401) {
                console.warn("--- [AUTH/401] --- Rejected fetchMessages (Invalid/Stale Token)");
            } else {
                console.error("Failed to fetch messages", err);
            }
            setLoading(false);
        }
    };

    const markAsSeen = async () => {
        const token = cleanToken(authContextToken || localStorage.getItem("token"));
        if (!token || !user) return;

        try {
            // 1. Instant Optimistic UI Clear (Zero Delay)
            dispatch(markRoomAsRead({ roomId: user.id || user._id, readerType: 'user' }));

            // 2. Direct Socket Signal for global sync
            if (socketRef.current) {
                socketRef.current.emit('mark_read', { roomId: user.id || user._id, readerType: 'user' });
            }

            await axios.put(`${API_URL}/api/chats/read`, { chatId: 'admin' }, {
                headers: { 
                    "x-auth-token": token,
                    "Authorization": `Bearer ${token}`
                }
            });
            
            // Secondary Syncs
            dispatch(fetchClientUnreadCounts());
        } catch (err) {
            if (err.response?.status === 401) {
                 console.warn("--- [AUTH/401] --- Rejected markAsSeen (Invalid/Stale Token)");
            }
        }
    };

    useEffect(() => {
        const token = cleanToken(authContextToken || localStorage.getItem("token"));
        // Strict guard: only fire when session is fully ready
        if (user && token) {
            fetchMessages();
            markAsSeen();
        }
    }, [user?.id, user?._id, authContextToken]);

    useEffect(() => {
        const handleClickOutside = (e) => {
            if (optionsRef.current && !optionsRef.current.contains(e.target)) setShowOptions(false);
        };
        const handleFocus = () => {
            // Refetch when tab becomes active to sync across multiple tabs
            if (user && authContextToken) {
                fetchMessages();
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        window.addEventListener('focus', handleFocus);
        
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            window.removeEventListener('focus', handleFocus);
        };
    }, [user, authContextToken]);

    const scrollToBottom = (behavior = "smooth") => {
        if (chatContainerRef.current) {
            chatContainerRef.current.scrollTo({
                top: chatContainerRef.current.scrollHeight,
                behavior
            });
        }
    };

    useEffect(() => {
        if (!searchQuery) {
            scrollToBottom();
        } else {
            // Scroll to the FIRST matching message smoothly
            const firstMatch = messages.find(m => m.text.toLowerCase().includes(searchQuery.toLowerCase()));
            if (firstMatch) {
               const el = document.getElementById(`msg-${firstMatch._id}`);
               if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        }
    }, [messages, isTyping, searchQuery]);

    const handleSend = async (text) => {
        const tempId = Date.now().toString();
        const optimisticMsg = {
            _id: tempId,
            text,
            sender: user.id,
            recipient: "admin",
            timestamp: new Date().toISOString(),
            status: "pending",
            replyTo: replyingTo,
            reactions: []
        };

        setMessages(prev => [...prev, optimisticMsg]);
        setReplyingTo(null);

        try {
            const token = localStorage.getItem("token");
            const res = await axios.post(`${API_URL}/api/chats`, 
                { text, recipient: "admin", replyTo: replyingTo?._id },
                { headers: { "x-auth-token": token } }
            );
            setMessages(prev => {
                const exists = prev.find(m => m._id === res.data._id);
                if (exists) return prev.filter(m => m._id !== tempId);
                return prev.map(m => m._id === tempId ? res.data : m);
            });
        } catch (err) {
            setMessages(prev => prev.map(m => m._id === tempId ? { ...m, status: "error" } : m));
            toast.error("Failed to send message");
        }
    };

    const handleTyping = () => {
        if (!socketRef.current) return;
        socketRef.current.emit("typing_start", { roomId: "admin", senderId: user.id });
        if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = setTimeout(() => {
            socketRef.current.emit("typing_stop", { roomId: "admin", senderId: user.id });
        }, 2000);
    };

    const handleEdit = async (messageId, newText) => {
        try {
            const token = localStorage.getItem("token");
            const res = await axios.patch(`${API_URL}/api/chats/${messageId}`, 
                { text: newText },
                { headers: { "x-auth-token": token } }
            );
            setMessages(prev => prev.map(m => m._id === messageId ? res.data : m));
            toast.success("Message updated");
        } catch (err) {
            toast.error("Edit failed");
        }
    };

    const handleDeleteMe = async (messageId) => {
        try {
            const token = localStorage.getItem("token");
            await axios.delete(`${API_URL}/api/chats/${messageId}/me`, {
                headers: { "x-auth-token": token }
            });
            setMessages(prev => prev.filter(m => m._id !== messageId));
        } catch (err) { }
    };

    const handleDeleteEveryone = async (messageId) => {
        try {
            const token = localStorage.getItem("token");
            await axios.delete(`${API_URL}/api/chats/${messageId}/everyone`, {
                headers: { "x-auth-token": token }
            });
            setMessages(prev => prev.map(m => m._id === messageId ? { ...m, text: 'This message was deleted', isDeletedEveryone: true } : m));
        } catch (err) { }
    };

    const handleReact = async (messageId, emoji) => {
        try {
            const token = localStorage.getItem("token");
            const res = await axios.post(`${API_URL}/api/chats/react/${messageId}`, 
                { emoji },
                { headers: { "x-auth-token": token } }
            );
            setMessages(prev => prev.map(m => m._id === messageId ? { ...m, reactions: res.data } : m));
        } catch (err) { }
    };

    const handleClearChat = async () => {
        try {
            const token = cleanToken(authContextToken || localStorage.getItem("token"));
            if (!token) return;

            // Updated to use the professional DELETE API (Strictly Client)
            await axios.delete(`${API_URL}/api/chats/clear-history`, {
                headers: {
                    "x-auth-token": token,
                    "Authorization": `Bearer ${token}`
                }
            });

            // Immediate UI cleanup
            setMessages([]);
            setShowClearModal(false);
            dispatch(clearClientUnread());
            toast.success("Conversation cleared permanently");
        } catch (err) {
            console.error('Failed to clear chat:', err);
            toast.error("Failed to clear chat");
        }
    };

    const handleCopy = (text) => {
        navigator.clipboard.writeText(text);
        toast.success("Copied to clipboard");
    };

    const filteredMessages = useMemo(() => {
        if (!searchQuery) {
            setNumResults(0);
            return messages;
        }
        const matches = messages.filter(m => m.text.toLowerCase().includes(searchQuery.toLowerCase()));
        setNumResults(matches.length);
        return messages; // We still show everything but highlight matches
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

    if (loading) return (
        <div className="flex flex-1 h-screen items-center justify-center bg-[#FDFBF7]">
            <div className="text-center">
                <motion.div animate={{ rotate: 360 }} transition={{ duration: 2, repeat: Infinity, ease: "linear" }} className="mb-6 text-luxury-gold mx-auto">
                    <ShieldCheck size={48} strokeWidth={1} />
                </motion.div>
                <p className="text-[10px] uppercase tracking-[6px] text-luxury-gold font-bold">Securing Channel</p>
            </div>
        </div>
    );

    return (
        <div className="flex flex-col w-full h-full">
            <Toaster position="top-right" />
            <header className="mb-10 w-full">
                <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                    <div>
                        <div className="flex items-center gap-3 mb-4"><Sparkles className="text-luxury-gold" size={20} /><span className="text-[10px] font-bold uppercase tracking-[4px] text-luxury-gold">Member Exclusive</span></div>
                        <h1 className="text-4xl md:text-6xl mb-4 uppercase tracking-[8px] font-light text-stone-800 leading-tight">Studio <br className="hidden md:block" /> Concierge</h1>
                        <div className="h-1 w-24 bg-gradient-to-r from-luxury-gold to-transparent rounded-full"></div>
                    </div>
                </motion.div>
            </header>

            <div className="w-full h-[75vh] glass-card flex flex-col overflow-hidden relative shadow-2xl border border-white/60 !p-0">
                <header className="px-6 py-5 border-b border-black/5 flex items-center justify-between sticky top-0 z-30 bg-white/40 backdrop-blur-xl">
                    <div className="flex items-center gap-4">
                        <div className="icon-wrapper !w-12 !h-12 !border-luxury-gold/20 !bg-luxury-gold/5"><MessageSquare size={18} strokeWidth={1.5} className="text-luxury-gold" /></div>
                        <div>
                            <div className="flex items-center gap-2"><h2 className="text-lg font-bold tracking-tight text-stone-800">Support Lead</h2><div className="w-2 h-2 bg-green-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(34,197,94,0.5)]"></div></div>
                            <p className="text-[9px] uppercase tracking-[3px] text-luxury-text-muted font-bold mt-0.5">{isTyping ? "Typing..." : "Online & Active"}</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="flex items-center gap-3">
                            {searchQuery && <motion.span initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} className="text-[10px] uppercase tracking-widest text-luxury-gold font-bold">{numResults} matches found</motion.span>}
                            <ChatSearchBar onSearch={setSearchQuery} />
                        </div>
                        <div className="relative" ref={optionsRef}>
                            <button onClick={() => setShowOptions(!showOptions)} className={`w-10 h-10 flex items-center justify-center rounded-full transition-all hover:bg-black/5 ${showOptions ? 'text-stone-800 bg-black/5' : 'text-stone-400'}`}><MoreVertical size={18} /></button>
                            <AnimatePresence>
                                {showOptions && (
                                    <motion.div initial={{ opacity: 0, scale: 0.95, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 10 }} className="absolute right-0 mt-3 w-56 bg-white rounded-2xl shadow-2xl border border-black/5 overflow-hidden z-50 backdrop-blur-xl bg-white/90">
                                        <div className="p-2">
                                            <button onClick={() => { setShowClearModal(true); setShowOptions(false); }} className="w-full flex items-center gap-3 px-4 py-3 text-sm text-red-500 hover:bg-red-50 rounded-xl transition-colors font-medium"><Trash2 size={16} />Clear Conversation</button>
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>
                    </div>
                </header>

                <div ref={chatContainerRef} className="flex-1 overflow-y-auto p-4 md:p-8 flex flex-col custom-scrollbar bg-transparent relative">
                    {groupedMessages.length === 0 && !loading ? (
                        <div className="flex-1 flex flex-col items-center justify-center opacity-30"><motion.div animate={{ y: [0, -10, 0] }} transition={{ duration: 4, repeat: Infinity }} className="mb-6 text-luxury-gold"><MessageSquare size={48} strokeWidth={1} /></motion.div><p className="text-[10px] uppercase tracking-[4px] font-bold text-center">No history starts here</p></div>
                    ) : (
                        <div className="flex flex-col gap-3">
                            {groupedMessages.map((msg, idx) => (
                                <MessageBubble key={msg._id} message={msg} user={user} isOwn={msg.sender === user.id} isGroupStart={msg.isGroupStart} isGroupEnd={msg.isGroupEnd} onReply={setReplyingTo} onEdit={handleEdit} onDeleteMe={handleDeleteMe} onDeleteEveryone={handleDeleteEveryone} onReact={handleReact} onCopy={handleCopy} searchQuery={searchQuery} id={`msg-${msg._id}`} />
                            ))}
                        </div>
                    )}
                    {isTyping && (
                        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex justify-start px-10 mt-6">
                            <div className="bg-white/40 backdrop-blur-md px-4 py-3 rounded-2xl rounded-tl-none flex gap-1.5 items-center"><span className="text-[9px] uppercase tracking-widest font-bold text-stone-400 mr-2">Admin is writing</span><div className="flex gap-1"><div className="w-1 h-1 bg-luxury-gold rounded-full animate-bounce"></div><div className="w-1 h-1 bg-luxury-gold rounded-full animate-bounce [animation-delay:-0.15s]"></div><div className="w-1 h-1 bg-luxury-gold rounded-full animate-bounce [animation-delay:-0.3s]"></div></div></div>
                        </motion.div>
                    )}
                    <div ref={messagesEndRef} />
                </div>

                <AnimatePresence>
                    {showClearModal && (
                        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowClearModal(false)} className="absolute inset-0 bg-stone-900/60 backdrop-blur-sm" />
                            <motion.div initial={{ opacity: 0, scale: 0.9, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9, y: 20 }} className="relative bg-white rounded-[32px] p-8 max-w-sm w-full shadow-2xl text-center">
                                <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-6 text-red-500"><Trash2 size={28} /></div>
                                <h3 className="text-2xl font-bold text-stone-800 mb-2">Clear History?</h3>
                                <p className="text-stone-500 text-sm mb-8">This will remove messages from your view.</p>
                                <div className="flex flex-col gap-3">
                                    <button onClick={handleClearChat} className="w-full py-4 bg-red-500 text-white rounded-2xl font-bold uppercase tracking-widest text-[10px] hover:bg-red-600 transition-colors shadow-lg shadow-red-200">Clear</button>
                                    <button onClick={() => setShowClearModal(false)} className="w-full py-4 bg-stone-50 text-stone-600 rounded-2xl font-bold uppercase tracking-widest text-[10px]">Cancel</button>
                                </div>
                            </motion.div>
                        </div>
                    )}
                </AnimatePresence>

                <ChatInput onSend={handleSend} onTyping={handleTyping} replyingTo={replyingTo} onCancelReply={() => setReplyingTo(null)} />
            </div>
        </div>
    );
}
