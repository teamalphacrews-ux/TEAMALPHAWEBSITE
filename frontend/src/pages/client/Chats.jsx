import React, { useState, useEffect, useRef } from "react";
import axios from "axios";
import { io } from "socket.io-client";
import { 
  Send, Check, CheckCheck, MoreVertical, Trash2, 
  Smile, Paperclip, X, Reply, Copy, ArrowLeft
} from "lucide-react";
import EmojiPicker from "emoji-picker-react";
import { format } from "date-fns";
import { useAuth } from "../../context/AuthContext";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";
const REACTION_EMOJIS = ['👍', '❤️', '😂', '😲', '😢'];

export default function Chats() {
    const { user } = useAuth();
    const [messages, setMessages] = useState([]);
    const [newMessage, setNewMessage] = useState("");
    const [loading, setLoading] = useState(true);
    const [isTyping, setIsTyping] = useState(false);
    const [showEmojiPicker, setShowEmojiPicker] = useState(false);
    const [activeMenuId, setActiveMenuId] = useState(null);
    const [replyingTo, setReplyingTo] = useState(null);
    const [attachmentsPreview, setAttachmentsPreview] = useState(null);

    const messagesEndRef = useRef(null);
    const chatContainerRef = useRef(null);
    const socketRef = useRef(null);
    const inputRef = useRef(null);
    const menuRef = useRef(null);
    const typingTimeoutRef = useRef(null);

    // Socket Initialization
    useEffect(() => {
        const token = localStorage.getItem("token");
        if (!token || !user) return;

        const socket = io(API_URL, { auth: { token } });
        socketRef.current = socket;

        socket.emit("join_chat", user.id);

        socket.on("receive_message", (message) => {
            if (message.sender === user.id || message.recipient === user.id) {
                setMessages(prev => {
                    if (prev.find(m => m._id === message._id)) return prev;
                    return [...prev, message];
                });
                if (message.recipient === user.id) {
                   socket.emit('message_delivered', { messageId: message._id, senderId: message.sender });
                   markAsSeen();
                }
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

        socket.on('display_typing', (data) => {
            if (data.senderId === 'admin' || data.senderId === 'hardcoded-admin-id') setIsTyping(true);
        });

        socket.on('hide_typing', (data) => {
            if (data.senderId === 'admin' || data.senderId === 'hardcoded-admin-id') setIsTyping(false);
        });

        socket.on('messages_seen', () => {
            setMessages(prev => prev.map(m => m.sender === user.id ? { ...m, status: 'seen', isRead: true } : m));
        });

        return () => socket.disconnect();
    }, [user?.id]);

    const fetchMessages = async () => {
        try {
            const token = localStorage.getItem("token");
            if (!token) return;
            const res = await axios.get(`${API_URL}/api/chats`, {
                headers: { "x-auth-token": token }
            });
            setMessages(res.data);
            setLoading(false);
            scrollToBottom('auto');
        } catch (err) {
            console.error("Failed to fetch messages", err);
            setLoading(false);
        }
    };

    const markAsSeen = async () => {
        try {
            const token = localStorage.getItem("token");
            if (!token) return;
            await axios.patch(`${API_URL}/api/chats/seen/admin`, {}, {
                headers: { "x-auth-token": token }
            });
        } catch (err) { }
    };

    useEffect(() => {
        fetchMessages();
        markAsSeen();
    }, []);

    const scrollToBottom = (behavior = "smooth") => {
        setTimeout(() => {
            messagesEndRef.current?.scrollIntoView({ behavior });
        }, 100);
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages, isTyping]);

    const handleSend = async (e) => {
        if (e) e.preventDefault();
        if (!newMessage.trim() && !attachmentsPreview) return;

        const tempId = Date.now().toString();
        const optimisticMsg = {
            _id: tempId,
            text: newMessage,
            sender: user.id,
            recipient: "admin",
            timestamp: new Date().toISOString(),
            status: "pending",
            replyTo: replyingTo,
            reactions: []
        };

        setMessages(prev => [...prev, optimisticMsg]);
        setNewMessage("");
        setReplyingTo(null);
        setShowEmojiPicker(false);

        try {
            const token = localStorage.getItem("token");
            const res = await axios.post(`${API_URL}/api/chats`, 
                { text: optimisticMsg.text, recipient: "admin", replyTo: replyingTo?._id },
                { headers: { "x-auth-token": token } }
            );
            setMessages(prev => prev.map(m => m._id === tempId ? res.data : m));
        } catch (err) {
            setMessages(prev => prev.map(m => m._id === tempId ? { ...m, status: "error" } : m));
        }
    };

    const handleReact = async (messageId, emoji) => {
        try {
            const token = localStorage.getItem("token");
            const res = await axios.post(`${API_URL}/api/chats/react/${messageId}`, { emoji }, {
                headers: { "x-auth-token": token }
            });
            setMessages(prev => prev.map(m => m._id === messageId ? { ...m, reactions: res.data } : m));
            setActiveMenuId(null);
        } catch (err) { }
    };

    const handleDelete = async (messageId, mode) => {
        try {
            const token = localStorage.getItem("token");
            await axios.delete(`${API_URL}/api/chats/${messageId}/${mode}`, {
                headers: { "x-auth-token": token }
            });
            if (mode === 'everyone') {
                setMessages(prev => prev.map(m => m._id === messageId ? { ...m, text: 'This message was deleted', isDeletedEveryone: true } : m));
            } else {
                setMessages(prev => prev.filter(m => m._id !== messageId));
            }
            setActiveMenuId(null);
        } catch (err) { }
    };

    const handleTyping = (e) => {
        setNewMessage(e.target.value);
        if (!socketRef.current) return;
        socketRef.current.emit("typing_start", { roomId: "admin", senderId: user.id });
        if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = setTimeout(() => {
            socketRef.current.emit("typing_stop", { roomId: "admin", senderId: user.id });
        }, 2000);
    };

    const handleEmojiClick = (emojiData) => {
        setNewMessage(prev => prev + emojiData.emoji);
    };

    useEffect(() => {
        const handleClickOutside = (e) => {
            if (menuRef.current && !menuRef.current.contains(e.target)) setActiveMenuId(null);
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    if (loading) return <div className="flex h-screen items-center justify-center">Loading encrypted channel...</div>;

    return (
        <div className="flex flex-col h-[85vh] max-w-4xl mx-auto my-8 bg-white/95 backdrop-blur-md rounded-[20px] shadow-[0_10px_30px_rgba(0,0,0,0.08)] overflow-hidden border border-white/50 animate-in fade-in duration-500 relative">
            {/* Header */}
            <div className="bg-white/60 backdrop-blur-xl p-6 flex items-center justify-between text-[#1a1a1a] border-b border-stone-100 z-10 rounded-t-[20px]">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-stone-100/50 rounded-2xl flex items-center justify-center font-serif text-xl border border-stone-200/50 shadow-sm text-stone-600 font-bold">A</div>
                    <div>
                        <h2 className="font-serif text-xl font-bold tracking-tight">Personal Assistant</h2>
                        <div className="flex items-center gap-2 mt-0.5">
                           <div className={`w-2 h-2 rounded-full ${isTyping ? 'bg-emerald-400 animate-pulse' : 'bg-stone-300'}`}></div>
                           <p className="text-[9px] text-[#555] font-bold uppercase tracking-widest">{isTyping ? 'Synchronizing...' : 'Online'}</p>
                        </div>
                    </div>
                </div>
                <button className="p-2 hover:bg-stone-50 rounded-xl transition-all text-stone-400 hover:text-stone-700 shadow-sm"><MoreVertical size={20} /></button>
            </div>

            {/* Messages */}
            <div ref={chatContainerRef} className="flex-1 overflow-y-auto p-6 flex flex-col gap-6 bg-white/30 backdrop-blur-sm custom-scrollbar scroll-smooth">
                {messages.map((msg, idx) => {
                    const isOwn = msg.sender === user.id;
                    const showDate = idx === 0 || new Date(messages[idx-1].timestamp).toDateString() !== new Date(msg.timestamp).toDateString();
                    
                    return (
                        <React.Fragment key={msg._id}>
                            {showDate && (
                                <div className="flex justify-center my-4">
                                    <span className="px-4 py-1.5 bg-stone-50 border border-stone-100 text-[9px] font-bold uppercase tracking-[0.2em] text-[#B0B0B0] rounded-full shadow-sm">
                                        {format(new Date(msg.timestamp), 'EEEE, MMM dd')}
                                    </span>
                                </div>
                            )}
                            
                            <div className={`flex w-full ${isOwn ? "justify-end" : "justify-start"}`}>
                                <div className={`relative group max-w-[75%] flex flex-col ${isOwn ? "items-end" : "items-start"}`}>
                                    <div 
                                        onClick={() => setActiveMenuId(activeMenuId === msg._id ? null : msg._id)}
                                        className={`px-5 py-3.5 rounded-2xl shadow-sm cursor-pointer transition-all duration-300 hover:-translate-y-0.5 ${
                                            isOwn 
                                                ? "bg-gradient-to-br from-[#1a1a1a] to-[#333] text-white rounded-[16px_16px_4px_16px] shadow-md border-t border-white/10" 
                                                : "bg-[#f3f4f6] text-[#1a1a1a] rounded-[16px_16px_16px_4px] font-medium shadow-[0_2px_10px_rgba(0,0,0,0.03)] border border-stone-200/50"
                                        }`}
                                    >
                                        {msg.replyTo && (
                                            <div className={`mb-2 p-2 rounded-xl text-xs border-l-4 opacity-70 ${isOwn ? 'bg-white/10 border-white/20' : 'bg-[#f0f0f0] border-stone-400'}`}>
                                                <p className="font-bold text-[9px] mb-1 uppercase tracking-widest flex items-center gap-1.5"><Reply size={10} strokeWidth={3} /> Reference</p>
                                                <p className="truncate italic">{msg.replyTo.text}</p>
                                            </div>
                                        )}
                                        <p className="text-[14px] leading-relaxed mb-1">{msg.text}</p>
                                        
                                        <div className={`flex items-center gap-1 opacity-50 text-[9px] font-bold uppercase tracking-widest mt-1 ${isOwn ? 'justify-end' : 'justify-start'}`}>
                                            <span>{format(new Date(msg.timestamp), 'hh:mm a')}</span>
                                            {isOwn && !msg.isDeletedEveryone && (
                                                <span>
                                                    {msg.status === 'sent' && <Check size={12} />}
                                                    {msg.status === 'delivered' && <CheckCheck size={12} />}
                                                    {msg.status === 'seen' && <CheckCheck size={12} className="text-blue-400" />}
                                                </span>
                                            )}
                                        </div>

                                        {msg.reactions?.length > 0 && (
                                            <div className={`absolute -bottom-2 translate-y-1/2 flex gap-1 animate-in zoom-in duration-300 z-10 ${isOwn ? 'right-3' : 'left-3'}`}>
                                                {msg.reactions.map((r, i) => (
                                                    <span key={i} className="bg-white border border-[#f0f0f0] rounded-full px-1.5 py-0.5 text-xs shadow-sm ring-2 ring-[#fafafa] font-normal">{r.emoji}</span>
                                                ))}
                                            </div>
                                        )}
                                    </div>

                                    {/* Action Menu */}
                                    {activeMenuId === msg._id && (
                                        <div ref={menuRef} className={`absolute top-0 mt-2 w-48 bg-white shadow-[0_15px_40px_rgba(0,0,0,0.12)] rounded-2xl py-2 z-50 border border-[#f8f8f8] animate-in zoom-in-95 duration-150 ${isOwn ? "right-full mr-2" : "left-full ml-2"}`}>
                                            <button onClick={() => { setReplyingTo(msg); setActiveMenuId(null); }} className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-[#fafafa] text-[12px] font-bold text-charcoal/80"><Reply size={14} className="opacity-40" /> Reply</button>
                                            <div className="px-3 py-1.5 border-y border-[#f9f9f9] flex justify-between">
                                                {REACTION_EMOJIS.map(emoji => (
                                                    <button key={emoji} onClick={() => handleReact(msg._id, emoji)} className="hover:scale-125 transition-transform text-lg">{emoji}</button>
                                                ))}
                                            </div>
                                            <button onClick={() => { navigator.clipboard.writeText(msg.text); setActiveMenuId(null); }} className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-[#fafafa] text-[12px] font-bold text-charcoal/80"><Copy size={14} className="opacity-40" /> Copy Text</button>
                                            {isOwn && (
                                                <div className="mt-1 flex flex-col">
                                                    <button onClick={() => handleDelete(msg._id, 'me')} className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-red-50 text-[10px] uppercase font-black text-red-500"><Trash2 size={14} /> Remove for me</button>
                                                    <button onClick={() => handleDelete(msg._id, 'everyone')} className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-red-50 text-[10px] uppercase font-black text-red-500"><Trash2 size={14} /> Wipe for everyone</button>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </React.Fragment>
                    );
                })}
                <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <div className="p-4 md:p-6 bg-gradient-to-t from-white/80 to-transparent relative z-20 rounded-b-[20px]">
                {replyingTo && (
                    <div className="absolute bottom-[calc(100%+8px)] left-6 right-6 bg-stone-50 border-l-4 border-stone-800 rounded-xl p-3 flex items-center justify-between shadow-lg animate-in fade-in slide-in-from-bottom-2 border-y border-r border-[#f0f0f0]">
                        <div className="min-w-0 pr-4">
                            <p className="text-[9px] font-bold text-stone-500 mb-0.5 uppercase tracking-widest">In reply to</p>
                            <p className="text-[12px] text-stone-800 font-medium truncate opacity-90">{replyingTo.text}</p>
                        </div>
                        <button onClick={() => setReplyingTo(null)} className="p-1 hover:bg-[#e0e0e0] rounded-full transition-colors text-stone-500"><X size={14} /></button>
                    </div>
                )}

                <div className="flex items-center gap-3 bg-white/95 backdrop-blur-2xl rounded-[24px] shadow-[0_5px_15px_rgba(0,0,0,0.08)] border border-stone-100 p-2 relative">
                    <button className="w-11 h-11 flex items-center justify-center hover:bg-stone-50 rounded-[14px] transition-all text-stone-400 hover:text-stone-700">
                        <Paperclip size={18} />
                    </button>
                    
                    <div className="flex-1 relative flex items-center">
                        <input 
                            ref={inputRef}
                            type="text" 
                            placeholder="Type a message..."
                            value={newMessage}
                            onChange={handleTyping}
                            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                            className="w-full bg-transparent border-none py-3.5 pl-3 pr-10 text-[14px] min-h-[48px] focus:outline-none focus:ring-0 transition-all font-medium placeholder:text-stone-300"
                        />
                        <button 
                            onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                            className={`absolute right-1 p-2 rounded-full transition-all ${showEmojiPicker ? 'bg-stone-100 text-stone-800' : 'text-stone-400 hover:text-stone-600 hover:bg-stone-50'}`}
                        >
                            <Smile size={20} />
                        </button>
                        
                        {showEmojiPicker && (
                            <div className="absolute bottom-[calc(100%+16px)] right-0 mb-4 z-[100] shadow-2xl rounded-2xl overflow-hidden animate-in zoom-in-95 border border-stone-100">
                                <EmojiPicker onEmojiClick={handleEmojiClick} width={300} height={400} theme="light" skinTonesDisabled />
                            </div>
                        )}
                    </div>

                    <button 
                        onClick={handleSend}
                        disabled={!newMessage.trim()}
                        className="flex items-center justify-center w-12 h-12 bg-gradient-to-r from-stone-800 to-stone-900 rounded-[18px] text-white transition-all duration-300 shadow-md hover:shadow-lg hover:scale-105 active:scale-95 disabled:opacity-30 disabled:hover:scale-100"
                    >
                        <Send size={18} className="translate-x-[1px] translate-y-[1px]" />
                    </button>
                </div>
            </div>
        </div>
    );
}
