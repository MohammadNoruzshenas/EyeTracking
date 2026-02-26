import { useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuth } from '../context/AuthContext';

export const useSocket = () => {
    const [socket, setSocket] = useState<Socket | null>(null);
    const { token } = useAuth();

    useEffect(() => {
        if (token) {
            // const newSocket = io('http://localhost:3000', {
            //     auth: { token },
            // });
            const newSocket = io('https://eyetracking-production.up.railway.app', {
                auth: { token },
            });

            setSocket(newSocket);

            return () => {
                newSocket.disconnect();
            };
        }
    }, [token]);

    return socket;
};
