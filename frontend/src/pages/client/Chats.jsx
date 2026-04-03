import React, { useState, useEffect, useRef } from "react";
import axios from "axios";
import { io } from "socket.io-client";
import { 
  Send, Check, CheckCheck, MoreVertical, Trash2, 
  Smile, Paperclip, X, Reply, Copy, ArrowLeft, MessageSquare, ShieldCheck, Sparkles
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
        if (!newMessage.trim()) return;

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

    if (loading) return (
        <div className="flex flex-1 items-center justify-center">
            <div className="text-center">
                <div className="animate-spin mb-4 text-luxury-gold mx-auto"><ShieldCheck size={40} /></div>
                <p className="text-sm uppercase tracking-widest text-luxury-gold">Establishing Encrypted Channel...</p>
            </div>
        </div>
    );

    return (
        <div className="flex flex-col w-full animate-fade-up">
            {/* Page Header */}
            <header className="text-left mb-10">
                <h1 className="text-4xl md:text-5xl mb-4 uppercase tracking-[8px] font-light text-stone-800">Studio Concierge</h1>
                <div className="h-1 w-20 bg-gradient-to-r from-luxury-gold to-luxury-gold/20 rounded-full"></div>
                <p className="text-luxury-text-muted italic max-w-2xl text-base mt-6">
                    Direct access to our creative team for seamless collaboration and legacy planning.
                </p>
            </header>

            <div className="w-full max-w-[950px] h-[calc(100vh-16rem)] md:h-[70vh] min-h-[400px] mx-auto glass-card flex flex-col overflow-hidden relative shadow-2xl border border-white/40 !p-0">
                
                {/* Header */}
                <header className="p-6 border-b border-black/5 bg-white/20 backdrop-blur-xl flex items-center justify-between sticky top-0 z-10">
                    <div className="flex items-center gap-4">
                        <div className="icon-wrapper !w-12 !h-12">
                            <MessageSquare size={20} strokeWidth={1.5} className="text-luxury-gold" />
                        </div>
                        <div>
                            <h2 className="text-lg font-medium tracking-tight text-stone-800">Studio Concierge</h2>
                            <p className="text-[9px] uppercase tracking-[3px] text-luxury-text-muted font-bold">
                                {isTyping ? "Writing a reply..." : "Always here for you"}
                            </p>
                        </div>
                    </div>
                </header>

                {/* Messages Area */}
                <div 
                    ref={chatContainerRef}
                    className="flex-1 overflow-y-auto p-6 md:p-8 flex flex-col gap-4 custom-scrollbar bg-white/5"
                >
                    {messages.length === 0 && !loading && (
                        <div className="mt-20 text-center opacity-40 animate-breathe">
                            <Sparkles className="mx-auto mb-4 text-luxury-gold" size={32} />
                            <p className="text-xs uppercase tracking-[4px]">Begin your legacy conversation</p>
                        </div>
                    )}

                    {messages.map((msg, idx) => {
                        const isOwn = msg.sender === user.id;
                        return (
                            <div key={msg._id} className={`flex w-full ${isOwn ? "justify-end" : "justify-start"} animate-fade-up`}>
                                <div className={`max-w-[75%] flex flex-col ${isOwn ? "items-end" : "items-start"}`}>
                                    <div 
                                        className={`px-5 py-3.5 rounded-2xl shadow-sm relative text-sm leading-relaxed ${
                                            isOwn 
                                                ? "bg-gradient-to-br from-stone-800 to-black text-white rounded-tr-sm" 
                                                : "bg-white/70 backdrop-blur-md text-stone-800 rounded-tl-sm border border-white/60"
                                        }`}
                                    >
                                        <p>{msg.text}</p>
                                        <div className={`text-[8px] mt-2 opacity-50 uppercase tracking-[2px] font-bold ${isOwn ? "text-right" : "text-left"}`}>
                                            {format(new Date(msg.timestamp), 'h:mm a')}
                                            {isOwn && (
                                                <span className="ml-2 inline-flex items-center">
                                                    {msg.status === 'seen' ? <CheckCheck size={10} className="text-luxury-gold inline" /> : <Check size={10} className="inline" />}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                    
                    {isTyping && (
                        <div className="flex justify-start animate-fade-up">
                            <div className="bg-white/40 backdrop-blur-md px-4 py-3 rounded-2xl rounded-tl-none flex gap-1.5">
                                <div className="w-1.5 h-1.5 bg-luxury-gold/40 rounded-full animate-bounce"></div>
                                <div className="w-1.5 h-1.5 bg-luxury-gold/40 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                                <div className="w-1.5 h-1.5 bg-luxury-gold/40 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                            </div>
                        </div>
                    )}
                    <div ref={messagesEndRef} />
                </div>

                {/* Input Area */}
                <div className="p-6 bg-white/20 backdrop-blur-md border-t border-black/5 sticky bottom-0">
                    <div className="bg-white/60 rounded-full p-2 flex items-center gap-2 border border-white shadow-inner">
                        <button className="w-10 h-10 flex items-center justify-center text-stone-400 hover:text-luxury-gold transition-colors">
                            <Paperclip size={18} strokeWidth={1.5} />
                        </button>
                        <input 
                            ref={inputRef}
                            type="text" 
                            placeholder="Share your thoughts..."
                            value={newMessage}
                            onChange={handleTyping}
                            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                            className="flex-1 bg-transparent border-none focus:ring-0 text-sm py-2 px-2 text-stone-800 placeholder:text-stone-400"
                        />
                        <button 
                            onClick={handleSend}
                            disabled={!newMessage.trim()}
                            className="bg-black text-white w-10 h-10 rounded-full flex items-center justify-center hover:scale-105 active:scale-95 transition-all disabled:opacity-20 shadow-lg shadow-black/20"
                        >
                            <Send size={14} className="ml-0.5" />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
