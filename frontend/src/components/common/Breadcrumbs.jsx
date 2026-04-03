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
    <nav className="flex mb-4 overflow-x-auto whitespace-nowrap py-3 px-1" aria-label="Breadcrumb">
      <ol className="inline-flex items-center space-x-2 md:space-x-3 bg-white/10 backdrop-blur-xl px-6 py-2.5 rounded-[20px] border border-white/20 shadow-[0_4px_15px_rgba(0,0,0,0.03)]">
        <li className="inline-flex items-center">
          <Link
            to="/"
            className="inline-flex items-center text-[13px] font-medium tracking-tight text-[#8a8a8a] hover:text-[#2d2d2d] transition-all duration-300"
          >
            <Home className="w-4 h-4 mr-2 opacity-60" />
            Home
          </Link>
        </li>
        {pathnames.map((value, index) => {
          const last = index === pathnames.length - 1;
          const to = `/${pathnames.slice(0, index + 1).join('/')}`;

          return (
            <li key={to} className="animate-in fade-in slide-in-from-left-2 duration-500" style={{ animationDelay: `${index * 100}ms` }}>
              <div className="flex items-center">
                <ChevronRight className="w-4 h-4 text-[#8a8a8a] opacity-40 mx-1" />
                {last ? (
                  <span className="ml-1 text-[13px] font-medium text-[#2d2d2d] bg-black/[0.04] px-2.5 py-1 rounded-[10px]">
                    {getBreadcrumbName(value)}
                  </span>
                ) : (
                  <Link
                    to={to}
                    className="ml-1 text-[13px] font-medium text-[#8a8a8a] hover:text-[#2d2d2d] transition-all duration-300 px-2 py-1 rounded-[10px] hover:bg-black/[0.02]"
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
