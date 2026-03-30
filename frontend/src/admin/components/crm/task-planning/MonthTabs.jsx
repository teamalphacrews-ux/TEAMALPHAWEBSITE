import React from 'react';

const months = ["All", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const MonthTabs = ({ activeMonth, setMonth }) => {
  return (
    <div className="flex gap-2 md:gap-4 border-b border-[#e6e3df] overflow-x-auto no-scrollbar mb-8 pb-4">
      {months.map(m => (
        <button
          key={m}
          onClick={() => setMonth(m)}
          className={`px-4 py-2 text-[10px] md:text-xs font-bold uppercase tracking-widest transition-all relative whitespace-nowrap 
            ${activeMonth === m ? 'text-charcoal' : 'text-warmgray hover:text-charcoal'}`}
        >
          {m}
          {activeMonth === m && (
            <div className="absolute bottom-[-17px] left-0 w-full h-[2px] bg-charcoal"></div>
          )}
        </button>
      ))}
    </div>
  );
};

export default MonthTabs;
