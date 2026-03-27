export default function StatCard({ title, value, icon }) {
    return (
        <div className="bg-white p-8 md:p-10 rounded-3xl border border-[#e6e3df]/60 shadow-[0_4px_20px_rgba(0,0,0,0.02)] hover:shadow-[0_20px_40px_rgba(0,0,0,0.06)] hover:-translate-y-2 transition-all duration-700 group">
            <div className="flex items-center justify-between mb-8">
                <div className="p-3 bg-ivory rounded-2xl text-mutedbrown group-hover:scale-110 group-hover:bg-charcoal group-hover:text-white transition-all duration-500">
                    {icon}
                </div>
                <span className="text-[9px] bg-ivory/80 px-3 py-1.5 rounded-full text-mutedbrown font-bold tracking-[0.2em] font-sans">
                    +4.2%
                </span>
            </div>
            <p className="text-[10px] md:text-xs text-warmgray uppercase tracking-[0.2em] font-bold mb-3">{title}</p>
            <h3 className="text-4xl md:text-5xl font-serif text-charcoal tracking-tight">{value}</h3>
        </div>
    );
}
