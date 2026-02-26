import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import { Mail, Lock, Loader2, Eye, LogIn } from 'lucide-react';

const LoginPage = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const { login } = useAuth();
    const navigate = useNavigate();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        try {
            const response = await api.post('/auth/login', { email, password });
            const { access_token, user } = response.data;
            login(access_token, user);

            if (user.role === 'admin') {
                navigate('/admin');
            } else {
                navigate('/dashboard');
            }
        } catch (err: any) {
            setError(err.response?.data?.message || 'ایمیل یا رمز عبور اشتباه است');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center p-6 selection:bg-blue-100 selection:text-blue-700 font-['Vazirmatn'] relative overflow-hidden">
            {/* Decorative background elements */}
            <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-400/5 rounded-full blur-[120px]" />
            <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-indigo-400/5 rounded-full blur-[120px]" />

            <div className="w-full max-w-[440px] relative z-10">
                {/* Logo or Brand */}
                <div className="text-center mb-10">
                    <div className="inline-flex h-16 w-16 items-center justify-center rounded-[22px] bg-white shadow-[0_10px_40px_rgba(0,0,0,0.04)] border border-slate-100 mb-6 group transition-all duration-500 hover:scale-110">
                        <div className="h-8 w-8 rounded-full bg-gradient-to-tr from-blue-600 to-blue-400 shadow-lg shadow-blue-500/30 flex items-center justify-center">
                            <Eye className="w-4 h-4 text-white" />
                        </div>
                    </div>
                    <h1 className="text-3xl font-black text-slate-900 tracking-tight">ورود</h1>
                    <p className="text-slate-500 mt-3 text-lg font-light leading-relaxed">برای ورود به سامانه ردیابی چشم اطلاعات خود را وارد کنید</p>
                </div>

                {/* Card */}
                <div className="bg-white/80 backdrop-blur-xl rounded-[32px] shadow-[0_20px_60px_-15px_rgba(0,0,0,0.03)] border border-white/60 p-10">
                    {error && (
                        <div className="mb-6 bg-red-50 border border-red-100 text-red-600 px-5 py-4 rounded-2xl text-sm leading-relaxed text-right flex items-center gap-3">
                            <div className="w-1.5 h-1.5 rounded-full bg-red-400" />
                            {error}
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div className="space-y-2">
                            <label className="text-sm font-bold text-slate-700 mr-1 block text-right">ایمیل</label>
                            <div className="relative group">
                                <input
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    placeholder="name@company.com"
                                    className="w-full px-10 py-4 bg-slate-50/50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500/40 focus:bg-white text-slate-900 placeholder-slate-400 transition-all duration-300 text-left"
                                    required
                                />
                                <Mail className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-300 group-focus-within:text-blue-500 transition-colors" />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <div className="flex justify-between items-center mr-1">
                                <label className="text-sm font-bold text-slate-700 block transition-colors">رمز عبور</label>
                                <button type="button" className="text-xs text-blue-600 hover:text-blue-700 font-bold transition-colors">فراموشی رمز عبور؟</button>
                            </div>
                            <div className="relative group">
                                <input
                                    type="password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="••••••••"
                                    className="w-full px-10 py-4 bg-slate-50/50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500/40 focus:bg-white text-slate-900 placeholder-slate-400 transition-all duration-300 text-left"
                                    required
                                />
                                <Lock className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-300 group-focus-within:text-blue-500 transition-colors" />
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full h-[60px] bg-slate-900 hover:bg-slate-800 disabled:bg-slate-400 text-white font-black rounded-2xl transition-all duration-300 shadow-[0_10px_30px_-10px_rgba(0,0,0,0.2)] flex items-center justify-center gap-3 active:scale-[0.98] mt-4 group"
                        >
                            {loading ? (
                                <Loader2 className="w-6 h-6 animate-spin" />
                            ) : (
                                <>
                                    <span>ورود به سامانه</span>
                                    <LogIn className="w-5 h-5 group-hover:translate-x-[-4px] transition-transform" />
                                </>
                            )}
                        </button>
                    </form>

                    <div className="mt-10 pt-8 border-t border-slate-100 text-center">
                        <p className="text-slate-500 text-sm font-medium">
                            هنوز ثبت‌نام نکرده‌اید؟{' '}
                            <Link to="/register" className="text-blue-600 font-black hover:underline underline-offset-8 decoration-2">ساخت حساب جدید</Link>
                        </p>
                    </div>
                </div>

                {/* Footer Links */}
                <div className="mt-12 flex justify-center items-center gap-8">
                    <button className="text-xs text-slate-400 hover:text-slate-600 font-medium transition-colors">
                        شرایط استفاده
                    </button>
                    <div className="w-1.5 h-1.5 bg-slate-200 rounded-full" />
                    <button className="text-xs text-slate-400 hover:text-slate-600 font-medium transition-colors">
                        مرکز پشتیبانی
                    </button>
                </div>
            </div>
        </div>
    );
};

export default LoginPage;
