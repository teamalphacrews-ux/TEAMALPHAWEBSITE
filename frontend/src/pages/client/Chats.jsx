import React, { useState, useEffect, useRef } from "react";
import axios from "axios";
import { Check, CheckCheck } from "lucide-react";

export default function Chats() {
    const [messages, setMessages] = useState([]);
    const [newMessage, setNewMessage] = useState("");
    const [loading, setLoading] = useState(true);
    const messagesEndRef = useRef(null);

    const fetchMessages = async () => {
        try {
            const token = localStorage.getItem("token");
            if (!token) return;
            const res = await axios.get(`${import.meta.env.VITE_API_URL || "http://localhost:5000"}/api/chats`, {
                headers: { "x-auth-token": token }
            });
            setMessages(res.data);
            setLoading(false);
        } catch (err) {
            console.error("Failed to fetch messages", err);
            setLoading(false);
        }
    };

    const markAsRead = async () => {
        try {
            const token = localStorage.getItem("token");
            if (!token) return;
            await axios.put(`${import.meta.env.VITE_API_URL || "http://localhost:5000"}/api/chats/read`, 
                { senderId: "admin" },
                { headers: { "x-auth-token": token } }
            );
        } catch (err) {
            console.error("Failed to mark messages as read", err);
        }
    };

    useEffect(() => {
        fetchMessages();
        markAsRead();
        // Polling for new messages
        const interval = setInterval(() => {
            fetchMessages();
            markAsRead();
        }, 3000);
        return () => clearInterval(interval);
    }, []);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    const handleSend = async (e) => {
        e.preventDefault();
        if (!newMessage.trim()) return;

        try {
            const token = localStorage.getItem("token");
            const res = await axios.post(`${import.meta.env.VITE_API_URL || "http://localhost:5000"}/api/chats`, 
                { text: newMessage, recipient: "admin" },
                { headers: { "x-auth-token": token } }
            );

            setMessages([...messages, res.data]);
            setNewMessage("");
        } catch (err) {
            console.error("Failed to send message", err);
        }
    };

    return (
        <div className="chat-container">
            <div className="chat-header">
                <h2>Personal Assistant</h2>
                <p>Typically replies within an hour</p>
            </div>

            <div className="messages-list">
                {messages.length === 0 && !loading && (
                    <div style={{ textAlign: 'center', color: '#888', marginTop: '20px' }}>
                        No messages yet. Start a conversation!
                    </div>
                )}
                {messages.map((msg) => (
                    <div key={msg._id} className={`message-wrapper ${msg.recipient === "admin" ? "client" : "admin"}`}>
                        <div className="message-bubble flex flex-col">
                            <p>{msg.text}</p>
                            <div className="flex justify-between items-center mt-1 w-full gap-2">
                                <span className="message-time">
                                    {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </span>
                                {msg.recipient === "admin" && (
                                    <span style={{ marginLeft: "4px" }}>
                                        {msg.isRead ? <CheckCheck size={14} color="#34B7F1" /> : <Check size={14} color="#a0a0a0" />}
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>
                ))}
                <div ref={messagesEndRef} />
            </div>

            <form className="chat-input-area" onSubmit={handleSend}>
                <input
                    type="text"
                    placeholder="Type your message..."
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                />
                <button type="submit">Send</button>
            </form>

            <style dangerouslySetInnerHTML={{
                __html: `
        .chat-container {
          max-width: 800px;
          margin: 40px auto;
          background: #fff;
          height: 70vh;
          display: flex;
          flex-direction: column;
          border-radius: 12px;
          box-shadow: 0 10px 30px rgba(0,0,0,0.08);
          overflow: hidden;
          border: 1px solid #eee;
          font-family: "Inter", sans-serif;
        }

        .chat-header {
          padding: 24px;
          background: #1c1c1c;
          color: #f7f5f2;
          text-align: center;
        }

        .chat-header h2 {
          margin: 0;
          font-family: "Playfair Display", serif;
          font-size: 1.5rem !important;
        }

        .chat-header p {
          margin: 4px 0 0;
          font-size: 0.85rem;
          opacity: 0.7;
        }

        .messages-list {
          flex: 1;
          padding: 24px;
          overflow-y: auto;
          display: flex;
          flex-direction: column;
          gap: 16px;
          background: #fafaf9;
        }

        .message-wrapper {
          display: flex;
          width: 100%;
        }

        .message-wrapper.admin {
          justify-content: flex-start;
        }

        .message-wrapper.client {
          justify-content: flex-end;
        }

        .message-bubble {
          max-width: 70%;
          padding: 12px 18px;
          border-radius: 18px;
          position: relative;
          font-size: 0.95rem;
          line-height: 1.5;
        }

        .admin .message-bubble {
          background: #fff;
          color: #1c1c1c;
          border: 1px solid #e5e7eb;
          border-bottom-left-radius: 4px;
        }

        .client .message-bubble {
          background: #1c1c1c;
          color: #f7f5f2;
          border-bottom-right-radius: 4px;
        }

        .message-time {
          display: block;
          font-size: 0.7rem;
          margin-top: 4px;
          opacity: 0.6;
        }

        .client .message-time {
          text-align: right;
          color: rgba(247, 245, 242, 0.7);
        }

        .chat-input-area {
          padding: 20px;
          background: #fff;
          border-top: 1px solid #eee;
          display: flex;
          gap: 12px;
        }

        .chat-input-area input {
          flex: 1;
          padding: 12px 18px;
          border: 1px solid #e5e7eb;
          border-radius: 25px;
          outline: none;
          font-family: inherit;
          transition: border-color 0.2s;
        }

        .chat-input-area input:focus {
          border-color: #1c1c1c;
        }

        .chat-input-area button {
          background: #1c1c1c;
          color: #fff;
          border: none;
          padding: 0 24px;
          border-radius: 25px;
          font-weight: 500;
          cursor: pointer;
          transition: opacity 0.2s;
        }

        .chat-input-area button:hover {
          opacity: 0.9;
        }
      `}} />
        </div>
    );
}
