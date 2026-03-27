import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ChevronRight, Home } from 'lucide-react';

const Breadcrumbs = () => {
  const location = useLocation();
  const pathnames = location.pathname.split('/').filter((x) => x);

  const getBreadcrumbName = (name) => {
    // Map specific paths to user-friendly names if needed
    const translations = {
      'portal': 'Client Portal',
      'admin': 'Admin Portal',
      'crm': 'CRM',
      'gallery': 'Smart Gallery',
      'finance': 'Finance',
      'calendar': 'Calendar',
      'activity-log': 'Activity Log',
      'chats': 'Chats',
      'cloud': 'Cloud',
    };
    return translations[name] || name.charAt(0).toUpperCase() + name.slice(1);
  };

  return (
    <nav className="flex mb-8 overflow-x-auto whitespace-nowrap py-3 px-1 border-b border-[#e6e3df]/30" aria-label="Breadcrumb">
      <ol className="inline-flex items-center space-x-2 md:space-x-4">
        <li className="inline-flex items-center">
          <Link
            to="/"
            className="inline-flex items-center text-[10px] font-black uppercase tracking-[0.2em] text-warmgray hover:text-gold transition-all duration-300 px-3 py-1.5 rounded-lg bg-ivory/50 border border-transparent hover:border-gold/20"
          >
            <Home className="w-3.5 h-3.5 mr-2" />
            Home
          </Link>
        </li>
        {pathnames.map((value, index) => {
          const last = index === pathnames.length - 1;
          const to = `/${pathnames.slice(0, index + 1).join('/')}`;

          return (
            <li key={to} className="animate-in fade-in slide-in-from-left-2 duration-500" style={{ animationDelay: `${index * 100}ms` }}>
              <div className="flex items-center">
                <ChevronRight className="w-3 h-3 text-warmgray/40 mx-1 md:mx-2" />
                {last ? (
                  <span className="ml-1 text-[10px] font-black uppercase tracking-[0.2em] text-charcoal md:ml-2 bg-white px-3 py-1.5 rounded-lg shadow-sm border border-[#e6e3df]">
                    {getBreadcrumbName(value)}
                  </span>
                ) : (
                  <Link
                    to={to}
                    className="ml-1 text-[10px] font-black uppercase tracking-[0.2em] text-warmgray hover:text-gold md:ml-2 transition-all duration-300 hover:bg-ivory/30 px-2 py-1.5 rounded-lg"
                  >
                    {getBreadcrumbName(value)}
                  </Link>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </nav>
  );
};

export default Breadcrumbs;
