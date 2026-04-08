import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || '';

const cleanToken = (raw) => {
  if (!raw || typeof raw !== 'string') return null;
  const cleaned = raw.replace(/^["']|["']$/g, '').trim();
  return cleaned === 'null' || cleaned === 'undefined' ? null : cleaned;
};

export const fetchUnreadCounts = createAsyncThunk(
  'chat/fetchUnreadCounts',
  async (_, { rejectWithValue }) => {
    const token = cleanToken(localStorage.getItem('token'));
    if (!token) return { count: 0 };
    try {
      const res = await axios.get(`${API_URL}/api/chats/unread-summary`, {
        headers: {
          'x-auth-token': token,
          'Authorization': `Bearer ${token}`
        }
      });
      return { count: res.data.totalChatsWithUnread || 0 };
    } catch (err) {
      if (err.response?.status === 401) return { count: 0 };
      return rejectWithValue(err.response?.data);
    }
  }
);

export const fetchClientUnreadCounts = createAsyncThunk(
  'chat/fetchClientUnreadCounts',
  async (_, { rejectWithValue }) => {
    const token = cleanToken(localStorage.getItem('token'));
    if (!token) return { count: 0 };
    try {
      const res = await axios.get(`${API_URL}/api/chats/unread`, {
        headers: {
          'x-auth-token': token,
          'Authorization': `Bearer ${token}`
        }
      });
      return { count: res.data.count || 0 };
    } catch (err) {
      if (err.response?.status === 401) return { count: 0 };
      return rejectWithValue(err.response?.data);
    }
  }
);

const chatSlice = createSlice({
  name: 'chat',
  initialState: {
    adminUnreadCount: 0,
    clientUnreadCount: 0,
    roomStates: {}, // Map of { roomId: { unreadCountAdmin, unreadCountUser } }
    loading: false,
  },
  reducers: {
    handleRoomUpdate: (state, action) => {
      const { roomId, unreadCountAdmin, unreadCountUser } = action.payload;
      state.roomStates[roomId] = { unreadCountAdmin, unreadCountUser };

      // Update totals for Sidebar bell
      let totalAdmin = 0;
      let totalClient = 0;
      Object.values(state.roomStates).forEach(room => {
        if (room.unreadCountAdmin > 0) totalAdmin++;
        if (room.unreadCountUser > 0) totalClient++;
      });
      state.adminUnreadCount = totalAdmin;
      state.clientUnreadCount = totalClient;
    },
    markRoomAsRead: (state, action) => {
      const { roomId, readerType } = action.payload;
      if (state.roomStates[roomId]) {
        if (readerType === 'admin') state.roomStates[roomId].unreadCountAdmin = 0;
        else state.roomStates[roomId].unreadCountUser = 0;
      }

      // Recalculate totals after optimistic clear
      let totalAdmin = 0;
      let totalClient = 0;
      Object.values(state.roomStates).forEach(room => {
        if (room.unreadCountAdmin > 0) totalAdmin++;
        if (room.unreadCountUser > 0) totalClient++;
      });
      state.adminUnreadCount = totalAdmin;
      state.clientUnreadCount = totalClient;
    },
    setAdminUnreadCount: (state, action) => {
      state.adminUnreadCount = action.payload;
    },
    setClientUnreadCount: (state, action) => {
      state.clientUnreadCount = action.payload;
    },
    clearAdminUnread: (state) => {
      state.adminUnreadCount = 0;
    },
    clearClientUnread: (state) => {
      state.clientUnreadCount = 0;
    }
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchUnreadCounts.fulfilled, (state, action) => {
        state.adminUnreadCount = action.payload.count;
      })
      .addCase(fetchClientUnreadCounts.fulfilled, (state, action) => {
        state.clientUnreadCount = action.payload.count;
      });
  },
});

export const {
  setAdminUnreadCount,
  setClientUnreadCount,
  clearAdminUnread,
  clearClientUnread,
  handleRoomUpdate,
  markRoomAsRead
} = chatSlice.actions;
export default chatSlice.reducer;
