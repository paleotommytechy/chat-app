import { useEffect, useRef } from 'react';
import { useSocket } from '../context/SocketContext';

export const useSocketEvents = (events) => {
  const socket = useSocket();

  useEffect(() => {
    if (!socket) return;

    Object.entries(events).forEach(([event, handler]) => {
      socket.on(event, handler);
    });

    return () => {
      Object.entries(events).forEach(([event, handler]) => {
        socket.off(event, handler);
      });
    };
  }, [socket, events]);
};

export const useSocketEmit = () => {
  const socket = useSocket();

  return (event, payload) => {
    if (socket) {
      socket.emit(event, payload);
    }
  };
};