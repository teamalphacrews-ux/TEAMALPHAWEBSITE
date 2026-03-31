export default function StatCard({ title, value, icon, delayClass = "" }) {
    return (
        <div className={`bg-white/55 backdrop-blur-[16px] p-6 md:p-8 rounded-[20px] border border-white/40 shadow-[0_10px_30px_rgba(0,0,0,0.06)] hover:shadow-[0_15px_40px_rgba(0,0,0,0.08)] hover:-translate-y-1.5 hover:scale-[1.02] transition-all duration-500 group animate-fade-up ${delayClass}`}>
            <div className="flex items-center justify-between mb-6">
                <div className="w-10 h-10 rounded-xl bg-white/60 backdrop-blur-md flex items-center justify-center text-[#6b6b6b] shadow-sm group-hover:scale-110 transition-transform duration-500">
                    {icon}
                </div>
                <span className="text-[9px] bg-black/[0.03] px-2.5 py-1.5 rounded-full text-[#8c8c8c] font-bold tracking-[0.1em] font-sans">
                    +4.2%
                </span>
            </div>
            <p className="text-[10px] md:text-[11px] text-[#8c8c8c] uppercase tracking-[1px] font-medium mb-2">{title}</p>
            <h3 className="text-3xl md:text-4xl font-luxury text-[#2d2d2d] tracking-tight">{value}</h3>
        </div>
    );
}
