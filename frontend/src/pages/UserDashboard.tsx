import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../hooks/useSocket';
import { sessionApi } from '../api/sessionApi';
import { LogOut, Layout, User as UserIcon, Bell, Calendar, Play } from 'lucide-react';

interface UserData {
    _id: string;
    email: string;
}

interface SessionData {
    _id: string;
    title: string;
    admin: UserData;
    status: string;
}

const UserDashboard = () => {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const socket = useSocket();
    const [sessions, setSessions] = useState<SessionData[]>([]);
    const [notifications, setNotifications] = useState<number>(0);

    useEffect(() => {
        fetchSessions();
    }, []);

    useEffect(() => {
        if (socket) {
            socket.on('new_invitation', (session: SessionData) => {
                setSessions(prev => [session, ...prev.filter(s => s._id !== session._id)]);
                setNotifications(prev => prev + 1);
                alert(`شما به جلسه "${session.title}" دعوت شدید!`);
            });

            return () => {
                socket.off('new_invitation');
            };
        }
    }, [socket]);

    const fetchSessions = async () => {
        try {
            const response = await sessionApi.getMySessions();
            setSessions(response.data);
        } catch (err) {
            console.error('Error fetching sessions', err);
        }
    };

    const handleJoinSession = (session: SessionData) => {
        navigate(`/session/${session._id}`);
    };

    return (
        <div className="min-h-screen bg-[#FDFDFD] text-slate-900 flex flex-col font-['Vazirmatn'] uppercase">
            <header className="h-20 border-b border-slate-100 bg-white/80 backdrop-blur-md sticky top-0 z-50 px-10 flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <div className="bg-blue-600 h-10 w-10 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/20">
                        <Layout className="w-6 h-6 text-white" />
                    </div>
                    <span className="font-bold text-xl tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-slate-900 to-slate-600 text-right">پنل کاربری</span>
                </div>

                <div className="flex items-center gap-6">
                    <button className="p-2 text-slate-400 hover:text-slate-600 transition-colors relative">
                        <Bell className="w-5 h-5" />
                        {notifications > 0 && (
                            <span className="absolute top-1.5 right-1.5 w-4 h-4 bg-red-500 rounded-full border-2 border-white text-[10px] text-white flex items-center justify-center">
                                {notifications}
                            </span>
                        )}
                    </button>
                    <div className="h-8 w-px bg-slate-100 mx-2" />
                    <div className="flex items-center gap-3">
                        <div className="flex flex-col items-end text-sm leading-tight text-right">
                            <span className="text-slate-900 font-semibold">{user?.email}</span>
                            <span className="text-slate-400 text-[10px] uppercase tracking-wider font-bold">نقش: کاربر</span>
                        </div>
                        <div className="h-10 w-10 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center">
                            <UserIcon className="w-5 h-5 text-slate-500" />
                        </div>
                    </div>
                    <button
                        onClick={logout}
                        className="p-2 bg-red-50 text-red-500 hover:bg-red-500 hover:text-white rounded-xl transition-all duration-200"
                        title="خروج"
                    >
                        <LogOut className="w-5 h-5" />
                    </button>
                </div>
            </header>

            <main className="flex-1 p-10 max-w-[1400px] mx-auto w-full">
                <div className="mb-12">
                    <h2 className="text-4xl font-black text-slate-900 mb-3 text-right">جلسات من</h2>
                    <p className="text-slate-500 text-lg text-right">لیست جلساتی که به آن‌ها دعوت شده‌اید.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                    {sessions.length === 0 ? (
                        <div className="col-span-full py-20 bg-slate-50 rounded-[32px] border-2 border-dashed border-slate-200 flex flex-col items-center justify-center text-slate-400">
                            <Calendar className="w-12 h-12 mb-4 opacity-20" />
                            <p className="text-lg text-right">هنوز به هیچ جلسه‌ای دعوت نشده‌اید.</p>
                        </div>
                    ) : (
                        sessions.map((session) => (
                            <div
                                key={session._id}
                                className="bg-white p-8 rounded-[32px] border border-slate-100 shadow-sm hover:shadow-xl hover:shadow-blue-500/5 transition-all duration-300 relative group overflow-hidden"
                            >
                                <div className="absolute top-0 right-0 p-6 opacity-[0.03] group-hover:opacity-[0.08] transition-opacity">
                                    <Calendar className="w-24 h-24 rotate-12" />
                                </div>

                                <h3 className="text-2xl font-black text-slate-900 mb-2 text-right">{session.title}</h3>
                                <p className="text-slate-400 text-sm mb-6 text-right">ساخته شده توسط: {session.admin?.email}</p>

                                <div className="flex items-center justify-between mt-auto">
                                    <span className="px-3 py-1 bg-emerald-50 text-emerald-600 text-xs font-bold rounded-lg capitalize">
                                        {session.status === 'active' ? 'فعال' : 'پایان یافته'}
                                    </span>
                                    <button
                                        onClick={() => handleJoinSession(session)}
                                        className="px-6 py-2.5 bg-blue-600 text-white rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-blue-700 transition-all shadow-lg shadow-blue-500/10 active:scale-95"
                                    >
                                        <span>ورود به جلسه</span>
                                        <Play className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </main>
        </div>
    );
};

export default UserDashboard;
