import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import io from 'socket.io-client';
import { useAuth } from './AuthContext';
import { API_URL } from '../services/api';

const SocketContext = createContext();

export const useSocket = () => useContext(SocketContext);

export const SocketProvider = ({ children }) => {
  const [socket, setSocket] = useState(null);
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const { user } = useAuth();

  useEffect(() => {
    if (user) {
      const token = localStorage.getItem('momconnect_token');
      const newSocket = io(API_URL, {
        auth: { token }
      });
      setSocket(newSocket);

      newSocket.on('userStatus', ({ userId, isOnline }) => {
        if (isOnline) {
          setOnlineUsers(prev => [...new Set([...prev, userId])]);
        } else {
          setOnlineUsers(prev => prev.filter(id => id !== userId));
        }
      });

      newSocket.on('newNotification', (notification) => {
        setNotifications(prev => [notification, ...prev]);
      });

      newSocket.on('receiveMessage', (message) => {
        // This will be handled by the Messages component
      });

      newSocket.on('connect_error', (err) => {
        console.error('Socket connection error:', err.message);
      });

      return () => {
        newSocket.disconnect();
      };
    }
  }, [user]);

  const sendMessage = useCallback((data) => {
    socket?.emit('sendMessage', data);
  }, [socket]);

  const emitTyping = useCallback((data) => {
    socket?.emit('typing', data);
  }, [socket]);

  // Emit follow update to notify other components/users
  const emitFollowUpdate = useCallback((data) => {
    socket?.emit('followUpdate', data);
  }, [socket]);

  return (
    <SocketContext.Provider value={{
      socket,
      onlineUsers,
      notifications,
      setNotifications,
      sendMessage,
      emitTyping,
      emitFollowUpdate
    }}>
      {children}
    </SocketContext.Provider>
  );
};