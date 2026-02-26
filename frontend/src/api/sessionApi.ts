import api from './axios';

export const sessionApi = {
    create: (title: string) => api.post('/sessions', { title }),
    invite: (sessionId: string, userId: string) => api.post(`/sessions/${sessionId}/invite`, { userId }),
    getMySessions: () => api.get('/sessions/my-sessions'),
    getUsers: () => api.get('/users'),
};
