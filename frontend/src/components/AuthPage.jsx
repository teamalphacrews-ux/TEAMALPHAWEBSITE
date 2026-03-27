import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { User, Shield, Mail, Lock, ArrowRight } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const AuthPage = () => {
    const { user, login } = useAuth();
    const [userRole, setUserRole] = useState('client'); // 'client' or 'admin'
    const [formData, setFormData] = useState({
        email: '',
        password: '',
    });
    const [error, setError] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const navigate = useNavigate();

    // Auto-redirect if already logged in - using context state
    useEffect(() => {
        if (user) {
            if (user.role === 'admin') navigate('/admin');
            else navigate('/portal');
        }
    }, [user, navigate]);

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setIsSubmitting(true);
        const url = 'http://localhost:5000/api/auth/login';

        const body = { email: formData.email, password: formData.password, role: userRole };

        try {
            const res = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(body)
            });

            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.msg || 'Something went wrong');
            }

            // Success - Use centralized login
            login(data.user, data.token);
            
        } catch (err) {
            setError(err.message);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="h-screen bg-[#FDFCFB] flex flex-col md:flex-row overflow-hidden">
            {/* LEFT SECTION - FORM */}
            <div className="w-full md:w-1/2 flex items-center justify-center p-8 md:p-12 lg:p-16 relative bg-[#FDFCFB]">
                <div className="w-full max-w-[400px] z-10">
                    {/* Logo/Brand */}
                    <motion.div 
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="mb-8"
                    >
                        <Link to="/" className="flex items-center gap-2.5 group">
                            <img src="/logo.png" alt="Logo" className="h-10 w-auto object-contain" />
                            <span className="text-xl font-serif font-black tracking-[0.2em] text-[#1a1a1a]">ALPHA</span>
                        </Link>
                    </motion.div>

                    {/* Greetings */}
                    <motion.div
                        initial={{ opacity: 0, y: 15 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.1 }}
                        className="mb-6"
                    >
                        <h1 className="text-3xl md:text-4xl font-serif font-bold text-[#1a1a1a] mb-2">
                            Hey there <span className="text-red-400">♡</span> !
                        </h1>
                        <p className="text-gray-500 text-sm font-medium tracking-tight">
                            Enter your details to sign in
                        </p>
                    </motion.div>

                    {/* Role Toggler */}
                    <div className="mb-6">
                        <div className="bg-gray-100 p-1 rounded-2xl flex relative border border-gray-200">
                            <motion.div
                                className="absolute top-1 bottom-1 bg-white rounded-xl shadow-sm"
                                initial={false}
                                animate={{
                                    left: userRole === 'client' ? '4px' : '50%',
                                    width: 'calc(50% - 4px)'
                                }}
                                transition={{ type: "spring", stiffness: 400, damping: 30 }}
                            />
                            <button
                                onClick={() => setUserRole('client')}
                                className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-[10px] font-black tracking-widest uppercase z-10 transition-colors duration-300 ${userRole === 'client' ? 'text-black' : 'text-gray-400'}`}
                            >
                                <User size={13} strokeWidth={2.5} /> Client
                            </button>
                            <button
                                onClick={() => setUserRole('admin')}
                                className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-[10px] font-black tracking-widest uppercase z-10 transition-colors duration-300 ${userRole === 'admin' ? 'text-black' : 'text-gray-400'}`}
                            >
                                <Shield size={13} strokeWidth={2.5} /> Admin
                            </button>
                        </div>
                    </div>

                    {/* Error Message */}
                    <AnimatePresence>
                        {error && (
                            <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: 'auto' }}
                                exit={{ opacity: 0, height: 0 }}
                                className="mb-4 p-3 bg-red-50 border border-red-100 rounded-xl text-red-600 text-[10px] font-semibold flex items-center gap-2"
                            >
                                <span className="w-1 h-1 rounded-full bg-red-500 animate-pulse" />
                                {error}
                            </motion.div>
                        )}
                    </AnimatePresence>

                    <form className="space-y-4" onSubmit={handleSubmit}>
                        <div className="space-y-1.5">
                            <label className="text-[9px] font-black tracking-[0.2em] text-gray-400 uppercase">Email Address</label>
                            <div className="relative group">
                                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300 group-focus-within:text-black transition-colors" size={14} />
                                <input
                                    type="email"
                                    name="email"
                                    value={formData.email}
                                    onChange={handleChange}
                                    className="w-full bg-[#f8f8f8] border border-gray-100 rounded-xl pl-11 pr-4 py-3.5 text-xs focus:outline-none focus:ring-1 focus:ring-black/5 focus:bg-white focus:border-gray-200 transition-all duration-300"
                                    placeholder="yourname@gmail.com"
                                    required
                                />
                            </div>
                        </div>

                        <div className="space-y-1.5">
                            <div className="flex justify-between items-center px-0.5">
                                <label className="text-[9px] font-black tracking-[0.2em] text-gray-400 uppercase">Password</label>
                                <Link to="#" className="text-[9px] font-bold text-gray-400 hover:text-black transition-colors uppercase tracking-widest">Forgot?</Link>
                            </div>
                            <div className="relative group">
                                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300 group-focus-within:text-black transition-colors" size={14} />
                                <input
                                    type="password"
                                    name="password"
                                    value={formData.password}
                                    onChange={handleChange}
                                    className="w-full bg-[#f8f8f8] border border-gray-100 rounded-xl pl-11 pr-4 py-3.5 text-xs focus:outline-none focus:ring-1 focus:ring-black/5 focus:bg-white focus:border-gray-200 transition-all duration-300"
                                    placeholder="••••••••"
                                    required
                                />
                            </div>
                        </div>

                        <motion.button
                            disabled={isSubmitting}
                            whileHover={isSubmitting ? {} : { scale: 1.01 }}
                            whileTap={isSubmitting ? {} : { scale: 0.99 }}
                            className={`w-full ${isSubmitting ? 'bg-gray-400' : 'bg-[#1a1a1a]'} text-white py-4 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 text-[10px] font-black tracking-[0.3em] uppercase flex items-center justify-center gap-2 relative overflow-hidden group mt-4`}
                        >
                            <span className="relative z-10 transition-transform group-hover:-translate-x-1">
                                {isSubmitting ? 'Signing in...' : 'Sign In'}
                            </span>
                            {!isSubmitting && <ArrowRight size={14} className="relative z-10 transition-transform group-hover:translate-x-1" strokeWidth={3} />}
                            <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity" />
                        </motion.button>
                    </form>

                    <div className="mt-8 text-center text-[11px]">
                        <p className="text-gray-400 font-medium">
                            Don't have an account? 
                            <Link to="/quote" className="text-black font-black border-b-2 border-transparent hover:border-black transition-all ml-1">
                                Register
                            </Link>
                        </p>
                    </div>
                </div>
            </div>

            {/* RIGHT SECTION - IMAGE PANEL */}
            <div className="hidden md:block md:w-1/2 p-6 relative">
                <div className="w-full h-full rounded-[2.5rem] overflow-hidden relative shadow-[0_20px_50px_rgba(0,0,0,0.3)]">
                    <img 
                        src="/assets/services/pre_wedding.jpg" 
                        alt="Pre Wedding" 
                        className="w-full h-full object-cover"
                    />
                    {/* Overlay Text Centered Vertically */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent flex items-center justify-center p-12 lg:p-20 text-center">
                        <motion.div
                            initial={{ opacity: 0, y: 30 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.4, duration: 0.8 }}
                            className="max-w-md"
                        >
                            <h2 className="text-white text-5xl lg:text-6xl font-serif font-bold mb-6 leading-tight drop-shadow-2xl">
                                Elegance <br /> Redefined
                            </h2>
                            <div className="w-12 h-1 bg-white/40 mx-auto mb-6 rounded-full" />
                            <p className="text-white/90 text-lg font-medium leading-relaxed drop-shadow-lg">
                                Discover the finest collection of traditional and modern fashion.
                            </p>
                        </motion.div>
                    </div>

                    {/* Aesthetic floating accent */}
                    <div className="absolute top-10 right-10 flex gap-3">
                        <div className="w-3 h-3 rounded-full bg-white/30" />
                        <div className="w-3 h-3 rounded-full bg-white" />
                        <div className="w-3 h-3 rounded-full bg-white/30" />
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AuthPage;
