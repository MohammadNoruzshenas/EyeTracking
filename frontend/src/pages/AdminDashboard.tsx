import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { sessionApi } from '../api/sessionApi';
import {
    LogOut, ShieldCheck, BarChart3, Users, Settings,
    Plus, UserPlus, Calendar, Loader2, ChevronRight,
    Search, Activity, Clock, Trash2, ArrowRight
} from 'lucide-react';

interface UserData {
    _id: string;
    email: string;
}

interface SessionData {
    _id: string;
    title: string;
    admin: UserData;
    invitees: { user: any; status: string }[];
    status: string;
    createdAt?: string;
}

const AdminDashboard = () => {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const [sessions, setSessions] = useState<SessionData[]>([]);
    const [users, setUsers] = useState<UserData[]>([]);
    const [newSessionTitle, setNewSessionTitle] = useState('');
    const [loading, setLoading] = useState(false);
    const [inviting, setInviting] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<'stats' | 'sessions' | 'users'>('sessions');
    const [searchQuery, setSearchQuery] = useState('');

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            const [sessionsRes, usersRes] = await Promise.all([
                sessionApi.getMySessions(),
                sessionApi.getUsers()
            ]);
            setSessions(sessionsRes.data);
            setUsers(usersRes.data);
        } catch (err) {
            console.error('Error fetching admin data', err);
        }
    };

    const handleCreateSession = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newSessionTitle) return;
        setLoading(true);
        try {
            await sessionApi.create(newSessionTitle);
            setNewSessionTitle('');
            await fetchData();
            setActiveTab('sessions');
        } catch (err) {
            console.error('Error creating session', err);
        } finally {
            setLoading(false);
        }
    };

    const handleInvite = async (sessionId: string, userId: string) => {
        setInviting(sessionId + userId);
        try {
            await sessionApi.invite(sessionId, userId);
            await fetchData();
        } catch (err) {
            console.error('Error inviting user', err);
        } finally {
            setInviting(null);
        }
    };

    const handleJoinSession = (sessionId: string) => {
        navigate(`/session/${sessionId}`);
    };

    const navItems = [
        { id: 'stats', icon: BarChart3, label: 'آمار کل سیستم' },
        { id: 'sessions', icon: Calendar, label: 'مدیریت جلسات' },
        { id: 'users', icon: Users, label: 'لیست کاربران' },
    ];

    // Filtered data based on search
    const filteredSessions = sessions.filter(s => s.title.toLowerCase().includes(searchQuery.toLowerCase()));
    const filteredUsers = users.filter(u => u.email.toLowerCase().includes(searchQuery.toLowerCase()));

    return (
        <div className="min-h-screen bg-[#FDFDFD] text-slate-900 flex font-['Vazirmatn'] text-right">
            {/* Sidebar */}
            <aside className="w-80 bg-slate-950 flex flex-col px-6 py-10 sticky top-0 h-screen shadow-2xl z-50 overflow-hidden">
                {/* Decoration */}
                <div className="absolute top-0 right-0 w-64 h-64 bg-blue-600/20 rounded-full blur-[100px] -translate-y-1/2 translate-x-1/2" />

                <div className="flex items-center gap-4 mb-16 px-2 relative">
                    <div className="bg-blue-600 h-11 w-11 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-500/20 rotate-3 group hover:rotate-0 transition-all duration-300">
                        <ShieldCheck className="w-6 h-6 text-white" />
                    </div>
                    <span className="font-black text-2xl tracking-tight text-white">پنل مدیریت</span>
                </div>

                <nav className="flex-1 space-y-3 relative">
                    {navItems.map((item) => (
                        <button
                            key={item.id}
                            onClick={() => setActiveTab(item.id as any)}
                            className={`w-full flex items-center gap-4 px-5 py-4 rounded-2xl transition-all duration-300 group ${activeTab === item.id
                                ? 'bg-blue-600 text-white shadow-xl shadow-blue-600/20'
                                : 'text-slate-400 hover:bg-white/5 hover:text-white'
                                }`}
                        >
                            <item.icon className={`w-5 h-5 transition-transform duration-300 ${activeTab === item.id ? 'scale-110' : 'group-hover:scale-110'}`} />
                            <span className="font-bold">{item.label}</span>
                            {activeTab === item.id && <ChevronRight className="w-4 h-4 mr-auto animate-in slide-in-from-right-2" />}
                        </button>
                    ))}
                </nav>

                <div className="mt-auto relative">
                    <div className="p-5 bg-white/5 rounded-3xl mb-6 backdrop-blur-md border border-white/5">
                        <p className="text-[10px] text-slate-500 font-black mb-2 uppercase tracking-[2px]">مدیر سیستم</p>
                        <p className="text-sm font-black text-white truncate text-left">{user?.email}</p>
                    </div>
                    <button
                        onClick={logout}
                        className="w-full flex items-center gap-4 px-5 py-4 text-red-400 hover:bg-red-500/10 rounded-2xl transition-all duration-300 group"
                    >
                        <div className="p-2 bg-red-400/10 rounded-xl group-hover:bg-red-400/20 transition-all">
                            <LogOut className="w-5 h-5" />
                        </div>
                        <span className="font-bold">خروج از سیستم</span>
                    </button>
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 p-12 bg-[#F8FAFC] min-h-screen overflow-y-auto">
                {/* Top Header */}
                <header className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 mb-12 animate-in fade-in slide-in-from-top-4 duration-700">
                    <div>
                        <h2 className="text-4xl font-black text-slate-900 mb-2">
                            {activeTab === 'stats' && 'داشبورد آماری'}
                            {activeTab === 'sessions' && 'مدیریت جلسات ردیابی'}
                            {activeTab === 'users' && 'لیست اعضای سیستم'}
                        </h2>
                        <div className="flex items-center gap-2 text-slate-400 font-medium">
                            <span className="text-blue-600 font-bold">
                                {activeTab === 'stats' && 'آمار کل عملیات'}
                                {activeTab === 'sessions' && 'کنترل جلسات و دعوت'}
                                {activeTab === 'users' && 'مشاهده تمامی کاربران'}
                            </span>
                            <ChevronRight className="w-4 h-4" />
                            <span>پیشخوان</span>
                        </div>
                    </div>

                    <div className="flex items-center gap-4 w-full md:w-auto">
                        <div className="relative flex-1 md:w-80">
                            <Search className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                            <input
                                type="text"
                                placeholder="جستجو در سیستم..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full pl-4 pr-11 py-3.5 bg-white border border-slate-200 rounded-2xl focus:outline-none focus:ring-4 focus:ring-blue-600/5 focus:border-blue-600 transition-all text-sm font-medium shadow-sm"
                            />
                        </div>
                    </div>
                </header>

                {/* Tab Content: Statistics */}
                {activeTab === 'stats' && (
                    <div className="space-y-8 animate-in fade-in duration-500">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                            {[
                                { icon: Calendar, label: 'کل جلسات', value: sessions.length, color: 'blue' },
                                { icon: Users, label: 'کاربران ردیاب', value: users.length, color: 'emerald' },
                                { icon: Activity, label: 'جلسات فعال', value: sessions.filter(s => s.status === 'active').length, color: 'orange' },
                                { icon: Clock, label: 'تست‌های موفق', value: sessions.length * 4, color: 'purple' },
                            ].map((stat, idx) => (
                                <div key={idx} className="bg-white p-8 rounded-[36px] border border-slate-100 shadow-sm hover:shadow-xl transition-all duration-300 flex flex-col gap-4 relative overflow-hidden group">
                                    <div className={`w-14 h-14 rounded-2xl flex items-center justify-center group-hover:rotate-6 transition-transform
                                        ${stat.color === 'blue' ? 'bg-blue-50 text-blue-600' : ''}
                                        ${stat.color === 'emerald' ? 'bg-emerald-50 text-emerald-600' : ''}
                                        ${stat.color === 'orange' ? 'bg-orange-50 text-orange-600' : ''}
                                        ${stat.color === 'purple' ? 'bg-purple-50 text-purple-600' : ''}
                                    `}>
                                        <stat.icon className="w-7 h-7" />
                                    </div>
                                    <div>
                                        <p className="text-slate-500 font-bold text-sm mb-1">{stat.label}</p>
                                        <p className="text-3xl font-black text-slate-800 tracking-tight">{stat.value}</p>
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div className="bg-white p-10 rounded-[48px] border border-slate-100 shadow-sm min-h-[400px] flex flex-col relative overflow-hidden">
                            <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-blue-600 to-indigo-600" />
                            <h3 className="text-xl font-black text-slate-900 mb-8">نمودار فعالیت‌های اخیر سامانه</h3>
                            <div className="flex-1 flex items-center justify-center text-slate-400 flex-col gap-4">
                                <div className="p-8 bg-slate-50 rounded-full animate-pulse">
                                    <Activity className="w-12 h-12 opacity-20" />
                                </div>
                                <p className="font-bold">در حال دریافت و پردازش داده‌های زنده...</p>
                            </div>
                        </div>
                    </div>
                )}

                {/* Tab Content: Sessions */}
                {activeTab === 'sessions' && (
                    <div className="grid grid-cols-1 xl:grid-cols-12 gap-10 animate-in fade-in duration-500">
                        {/* Session Creation */}
                        <div className="xl:col-span-4 flex flex-col gap-8">
                            <div className="bg-slate-900 p-10 rounded-[48px] shadow-2xl relative overflow-hidden text-white group">
                                <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/20 rounded-full blur-[80px] -translate-y-1/2 translate-x-1/2 group-hover:scale-125 transition-transform duration-1000" />
                                <h3 className="text-2xl font-black mb-8 relative flex items-center gap-3">
                                    <div className="p-2 bg-blue-500 rounded-xl"><Plus className="w-6 h-6 text-white" /></div>
                                    ساخت جلسه جدید
                                </h3>
                                <form onSubmit={handleCreateSession} className="space-y-6 relative">
                                    <div className="space-y-3">
                                        <label className="text-[10px] font-black text-slate-400 mr-2 uppercase tracking-widest">SESSION TITLE</label>
                                        <input
                                            type="text"
                                            placeholder="نام جلسه را وارد کنید..."
                                            value={newSessionTitle}
                                            onChange={(e) => setNewSessionTitle(e.target.value)}
                                            className="w-full px-6 py-4 bg-white/5 border border-white/10 rounded-2xl focus:outline-none focus:ring-4 focus:ring-blue-600/20 focus:border-blue-600 transition-all text-white placeholder-slate-500 font-bold"
                                            required
                                        />
                                    </div>
                                    <button
                                        type="submit"
                                        disabled={loading}
                                        className="w-full py-5 bg-blue-600 text-white rounded-2xl font-black hover:bg-blue-700 transition-all flex items-center justify-center gap-3 shadow-xl shadow-blue-600/20 active:scale-[0.98]"
                                    >
                                        {loading ? <Loader2 className="w-6 h-6 animate-spin" /> : (
                                            <>
                                                <span>ایجاد جلسه</span>
                                                <ArrowRight className="w-5 h-5 rotate-180" />
                                            </>
                                        )}
                                    </button>
                                </form>
                            </div>

                            <div className="bg-white p-8 rounded-[40px] border border-slate-100 shadow-sm relative overflow-hidden">
                                <div className="absolute top-4 left-4">
                                    <span className="flex h-3 w-3">
                                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                                        <span className="relative inline-flex rounded-full h-3 w-3 bg-blue-600"></span>
                                    </span>
                                </div>
                                <h4 className="font-black text-slate-900 mb-6 px-4">راهنمای هوشمند</h4>
                                <div className="space-y-4">
                                    {[
                                        { text: 'برای دقت حداکثری، از تصاویر با کنتراست بالا استفاده شود.', type: 'info' },
                                        { text: 'دعوت از کاربران جدید بلافاصله اعلانی برای آن‌ها ارسال می‌کند.', type: 'alert' }
                                    ].map((item, idx) => (
                                        <div key={idx} className={`p-5 rounded-3xl ${item.type === 'info' ? 'bg-blue-50 text-blue-800' : 'bg-orange-50 text-orange-800'}`}>
                                            <p className="text-xs font-bold leading-relaxed">{item.text}</p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* Sessions List */}
                        <div className="xl:col-span-8 space-y-6">
                            {filteredSessions.length === 0 ? (
                                <div className="bg-white p-20 rounded-[48px] border-2 border-dashed border-slate-200 flex flex-col items-center justify-center text-slate-400 text-center gap-4">
                                    <Calendar className="w-16 h-16 opacity-10 mb-4" />
                                    <h4 className="text-xl font-black text-slate-800">هیچ جلسه‌ای یافت نشد</h4>
                                    <p className="max-w-xs font-medium text-sm">مقداری که جستجو کردید یا لیست جلسات خالی است.</p>
                                </div>
                            ) : (
                                filteredSessions.map((session) => (
                                    <div key={session._id} className="bg-white border border-slate-100 p-8 rounded-[44px] hover:shadow-2xl hover:shadow-slate-200/40 transition-all duration-500 group relative">
                                        <div className="absolute top-8 left-8">
                                            <span className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest ${session.status === 'active' ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-100 text-slate-400'
                                                }`}>
                                                {session.status === 'active' ? 'LIVE NOW' : 'CLOSED'}
                                            </span>
                                        </div>

                                        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-10">
                                            <div className="flex items-center gap-6">
                                                <div className="w-16 h-16 bg-slate-900 text-white rounded-[20px] flex items-center justify-center group-hover:rotate-6 group-hover:bg-blue-600 transition-all duration-300 shadow-lg">
                                                    <Calendar className="w-7 h-7" />
                                                </div>
                                                <div>
                                                    <h4 className="font-black text-2xl text-slate-900 mb-1 group-hover:text-blue-600 transition-colors">{session.title}</h4>
                                                    <div className="flex items-center gap-3 text-slate-400 text-[11px] font-bold">
                                                        <span className="px-2 py-0.5 bg-slate-100 rounded-md">ADMIN</span>
                                                        <span className="ltr text-right">{session.admin?.email}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-end">
                                            <div className="bg-slate-50/50 rounded-[32px] p-6 border border-slate-100">
                                                <div className="flex items-center justify-between mb-4">
                                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">دعوت از کاربران ({users.length - 1} نفر در دسترس)</span>
                                                </div>
                                                <div className="flex flex-wrap gap-2">
                                                    {users.filter(u => u._id !== user?.id).slice(0, 4).map((u) => {
                                                        const isInvited = session.invitees.some((inv: any) => (inv.user?._id || inv.user) === u._id);
                                                        return (
                                                            <button
                                                                key={u._id}
                                                                onClick={() => handleInvite(session._id, u._id)}
                                                                disabled={isInvited || inviting === (session._id + u._id)}
                                                                className={`text-[10px] px-3 py-2 rounded-xl border transition-all flex items-center gap-2 font-black ${isInvited
                                                                    ? 'bg-emerald-50 text-emerald-600 border-emerald-100 cursor-default'
                                                                    : 'bg-white border-slate-200 text-slate-600 hover:border-blue-600'
                                                                    }`}
                                                            >
                                                                {inviting === (session._id + u._id) ? <Loader2 className="w-3 h-3 animate-spin" /> : (isInvited ? <ShieldCheck className="w-3 h-3" /> : <UserPlus className="w-3 h-3" />)}
                                                                {u.email.split('@')[0]}
                                                            </button>
                                                        )
                                                    })}
                                                    {users.length > 5 && <button className="text-[10px] px-3 py-2 text-blue-600 font-black">+ بیشتر</button>}
                                                </div>
                                            </div>

                                            <div className="flex gap-3">
                                                <button
                                                    onClick={() => handleJoinSession(session._id)}
                                                    className="flex-1 py-4 bg-blue-600 text-white rounded-2xl text-xs font-black hover:bg-blue-700 transition-all flex items-center justify-center gap-2 shadow-lg shadow-blue-600/20 active:scale-95"
                                                >
                                                    ورود به جلسه
                                                    <ArrowRight className="w-4 h-4 rotate-180" />
                                                </button>
                                                <button className="p-4 bg-slate-100 text-slate-400 rounded-2xl hover:bg-red-50 hover:text-red-500 transition-all">
                                                    <Trash2 className="w-5 h-5" />
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                )}

                {/* Tab Content: Users */}
                {activeTab === 'users' && (
                    <div className="bg-white rounded-[48px] border border-slate-100 shadow-sm overflow-hidden animate-in fade-in duration-500 relative">
                        <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-emerald-500 to-teal-500" />
                        <div className="p-10 border-b border-slate-50 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                            <div>
                                <h3 className="text-2xl font-black text-slate-900 mb-1">مدیریت اعضای سیستم</h3>
                                <p className="text-slate-400 text-sm font-medium italic">لیست تمامی کاربرانی که در پلتفرم ثبت‌نام کرده‌اند.</p>
                            </div>
                            <div className="flex items-center gap-3">
                                <div className="px-5 py-2.5 bg-slate-50 rounded-xl text-slate-500 text-xs font-black border border-slate-100">
                                    تعداد کل: {users.length} نفر
                                </div>
                            </div>
                        </div>

                        <div className="overflow-x-auto px-6 py-4">
                            <table className="w-full text-right border-separate border-spacing-y-3">
                                <thead>
                                    <tr>
                                        <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-[2px]">اطلاعات کاربر</th>
                                        <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-[2px]">سطح دسترسی</th>
                                        <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-[2px]">تاریخ ثبت‌نام</th>
                                        <th className="px-10 py-4 text-[10px] font-black text-slate-400 uppercase tracking-[2px] text-left">اقدامات</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredUsers.map((u) => (
                                        <tr key={u._id} className="group transition-all">
                                            <td className="px-6 py-4 bg-slate-50/50 group-hover:bg-blue-50/30 rounded-r-3xl transition-all border border-slate-50">
                                                <div className="flex items-center gap-4">
                                                    <div className="w-12 h-12 rounded-2xl bg-white border border-slate-200 flex items-center justify-center font-black text-blue-600 shadow-sm transition-all group-hover:scale-110 group-hover:rotate-6">
                                                        {u.email.charAt(0).toUpperCase()}
                                                    </div>
                                                    <div>
                                                        <span className="block font-black text-slate-900 ltr text-right group-hover:text-blue-600 transition-colors">{u.email}</span>
                                                        <span className="text-[10px] text-slate-400 font-mono">{u._id}</span>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 bg-slate-50/50 group-hover:bg-blue-50/30 transition-all border-y border-slate-50">
                                                <div className={`inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-[10px] font-black border-2 ${u._id === user?.id ? 'bg-blue-50 text-blue-600 border-blue-100' : 'bg-slate-100 text-slate-500 border-slate-200'
                                                    }`}>
                                                    <div className={`w-1.5 h-1.5 rounded-full ${u._id === user?.id ? 'bg-blue-600' : 'bg-slate-400'}`} />
                                                    {u._id === user?.id ? 'ADMINISTRATOR' : 'TESTER'}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 bg-slate-50/50 group-hover:bg-blue-50/30 transition-all border-y border-slate-50 font-bold text-xs text-slate-500">
                                                ۱۴۰۲/۱۲/۰۵
                                            </td>
                                            <td className="px-10 py-4 bg-slate-50/50 group-hover:bg-blue-50/30 rounded-l-3xl transition-all border border-slate-50 text-left">
                                                <button className="p-3 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all">
                                                    <Trash2 className="w-5 h-5" />
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
};

export default AdminDashboard;
