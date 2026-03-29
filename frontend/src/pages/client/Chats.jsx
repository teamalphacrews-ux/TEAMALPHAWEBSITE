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
        <div className="flex flex-col h-[85vh] max-w-4xl mx-auto my-8 bg-white rounded-3xl shadow-2xl overflow-hidden border border-gray-100 animate-in fade-in duration-500">
            {/* Header */}
            <div className="bg-[#1C1C1C] p-6 flex items-center justify-between text-white">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center font-serif text-xl">A</div>
                    <div>
                        <h2 className="font-serif text-xl">Personal Assistant</h2>
                        <div className="flex items-center gap-2">
                           <div className={`w-2 h-2 rounded-full ${isTyping ? 'bg-green-400 animate-pulse' : 'bg-gray-400'}`}></div>
                           <p className="text-xs opacity-70 uppercase tracking-widest">{isTyping ? 'Typing...' : 'Online'}</p>
                        </div>
                    </div>
                </div>
                <button className="p-2 hover:bg-white/10 rounded-xl transition-all"><MoreVertical size={20} /></button>
            </div>

            {/* Messages */}
            <div ref={chatContainerRef} className="flex-1 overflow-y-auto p-6 flex flex-col gap-4 bg-[#F8F7F4] custom-scrollbar">
                {messages.map((msg, idx) => {
                    const isOwn = msg.sender === user.id;
                    const showDate = idx === 0 || new Date(messages[idx-1].timestamp).toDateString() !== new Date(msg.timestamp).toDateString();
                    
                    return (
                        <React.Fragment key={msg._id}>
                            {showDate && (
                                <div className="flex justify-center my-4">
                                    <span className="px-4 py-1 bg-gray-200/50 text-[10px] font-bold uppercase tracking-widest text-gray-500 rounded-full">
                                        {format(new Date(msg.timestamp), 'MMMM dd, yyyy')}
                                    </span>
                                </div>
                            )}
                            
                            <div className={`flex w-full ${isOwn ? "justify-end" : "justify-start"}`}>
                                <div className="relative group max-w-[75%]">
                                    <div 
                                        onClick={() => setActiveMenuId(activeMenuId === msg._id ? null : msg._id)}
                                        className={`px-4 py-3 rounded-2xl shadow-sm cursor-pointer transition-all hover:shadow-md ${
                                            isOwn ? "bg-[#1C1C1C] text-white rounded-tr-none" : "bg-white text-gray-800 rounded-tl-none border border-gray-200"
                                        }`}
                                    >
                                        {msg.replyTo && (
                                            <div className={`mb-2 p-2 rounded-xl text-xs border-l-4 opacity-70 ${isOwn ? 'bg-white/10 border-white/20' : 'bg-gray-50 border-gray-300'}`}>
                                                <p className="font-bold text-[10px] mb-1">Reference</p>
                                                <p className="truncate">{msg.replyTo.text}</p>
                                            </div>
                                        )}
                                        <p className="text-[14px] leading-relaxed mb-1">{msg.text}</p>
                                        
                                        <div className="flex items-center justify-end gap-1 opacity-50 text-[10px]">
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
                                            <div className="absolute -bottom-2 translate-y-1/2 flex gap-1 left-3">
                                                {msg.reactions.map((r, i) => (
                                                    <span key={i} className="bg-white border border-gray-100 rounded-full px-1.5 py-0.5 text-xs shadow-sm">{r.emoji}</span>
                                                ))}
                                            </div>
                                        )}
                                    </div>

                                    {/* Action Menu */}
                                    {activeMenuId === msg._id && (
                                        <div ref={menuRef} className={`absolute top-0 w-48 bg-white shadow-2xl rounded-2xl py-1 z-50 border border-gray-100 animate-in zoom-in-95 ${isOwn ? "right-[105%]" : "left-[105%]"}`}>
                                            <button onClick={() => { setReplyingTo(msg); setActiveMenuId(null); }} className="w-full flex items-center gap-3 px-4 py-2 hover:bg-gray-50 text-sm"><Reply size={16} className="opacity-40" /> Reply</button>
                                            <div className="px-3 py-2 border-y border-gray-50 flex justify-between">
                                                {REACTION_EMOJIS.map(emoji => (
                                                    <button key={emoji} onClick={() => handleReact(msg._id, emoji)} className="hover:scale-125 transition-transform">{emoji}</button>
                                                ))}
                                            </div>
                                            <button onClick={() => { navigator.clipboard.writeText(msg.text); setActiveMenuId(null); }} className="w-full flex items-center gap-3 px-4 py-2 hover:bg-gray-50 text-sm"><Copy size={16} className="opacity-40" /> Copy</button>
                                            {isOwn && (
                                                <>
                                                    <button onClick={() => handleDelete(msg._id, 'me')} className="w-full flex items-center gap-3 px-4 py-2 hover:bg-red-50 text-sm text-red-500"><Trash2 size={16} /> Delete for me</button>
                                                    <button onClick={() => handleDelete(msg._id, 'everyone')} className="w-full flex items-center gap-3 px-4 py-2 hover:bg-red-50 text-sm text-red-500"><Trash2 size={16} /> Delete for everyone</button>
                                                </>
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
            <div className="p-6 bg-white border-t border-gray-100 relative">
                {replyingTo && (
                    <div className="absolute bottom-full left-6 right-6 mb-2 bg-white border border-gray-200 rounded-2xl p-3 shadow-xl flex items-center justify-between animate-in slide-in-from-bottom-2">
                        <div className="border-l-4 border-[#1C1C1C] pl-3 overflow-hidden">
                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">In reply to</p>
                            <p className="text-sm text-gray-600 truncate">{replyingTo.text}</p>
                        </div>
                        <button onClick={() => setReplyingTo(null)} className="p-1 hover:bg-gray-100 rounded-full"><X size={18} /></button>
                    </div>
                )}

                <div className="flex items-center gap-4">
                    <button className="p-3 bg-gray-50 text-gray-400 rounded-2xl hover:bg-gray-100 transition-all"><Paperclip size={20} /></button>
                    
                    <div className="flex-1 relative">
                        <input 
                            ref={inputRef}
                            type="text" 
                            placeholder="Type a message..."
                            value={newMessage}
                            onChange={handleTyping}
                            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                            className="w-full bg-gray-50 border-none rounded-2xl py-3.5 pl-5 pr-12 text-sm focus:ring-2 focus:ring-[#1C1C1C]/10 transition-all font-medium"
                        />
                        <button 
                            onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                            className={`absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-lg transition-all ${showEmojiPicker ? 'bg-[#1C1C1C] text-white' : 'text-gray-400 hover:text-gray-600'}`}
                        >
                            <Smile size={20} />
                        </button>
                        
                        {showEmojiPicker && (
                            <div className="absolute bottom-full right-0 mb-4 z-[100] shadow-2xl rounded-2xl overflow-hidden animate-in zoom-in-95">
                                <EmojiPicker onEmojiClick={handleEmojiClick} width={300} height={400} />
                            </div>
                        )}
                    </div>

                    <button 
                        onClick={handleSend}
                        disabled={!newMessage.trim()}
                        className="bg-[#1C1C1C] text-white p-4 rounded-2xl shadow-xl hover:scale-105 active:scale-95 transition-all disabled:opacity-20 disabled:scale-100"
                    >
                        <Send size={20} />
                    </button>
                </div>
            </div>
        </div>
    );
}
