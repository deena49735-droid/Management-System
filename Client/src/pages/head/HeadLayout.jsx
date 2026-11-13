import React, { useState, useEffect } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import Navbar from '../../components/Navbar';
import api from '../../api/axios';

const HeadLayout = () => {
  const location = useLocation();
  const [pendingCount, setPendingCount] = useState(0);

  // Poll or fetch pending count for the badge
  useEffect(() => {
    const fetchPendingCount = async () => {
      try {
        const [memberRes, teamRes] = await Promise.all([
          api.get('/entries', { params: { status: 'pending' } }),
          api.get('/team-entries', { params: { status: 'pending' } }),
        ]);
        const total = (memberRes.data.data?.length || 0) + (teamRes.data.data?.length || 0);
        setPendingCount(total);
      } catch (err) {
        console.error('Failed to fetch pending counts:', err);
      }
    };
    fetchPendingCount();
  }, [location.pathname]);

  const navItems = [
    {
      name: 'Dashboard',
      path: '/head',
      exact: true,
      icon: (
        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
        </svg>
      ),
    },
    {
      name: 'Approvals',
      path: '/head/approvals',
      badge: pendingCount > 0 ? pendingCount : null,
      icon: (
        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
    },
    {
      name: 'History',
      path: '/head/history',
      icon: (
        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
    },
    {
      name: 'Team scorecard',
      path: '/head/scorecard',
      icon: (
        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
      ),
    },
    {
      name: 'Game criteria',
      path: '/criteria',
      icon: (
        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
        </svg>
      ),
    },
    {
      name: 'Leaderboard',
      path: '/leaderboard',
      icon: (
        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 8v8m-4-5v5m-4-2v2m-2 4h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      ),
    },
  ];

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <Navbar />

      {/* Sub-navigation Header */}
      <div className="border-b border-slate-200 bg-white sticky top-[61px] z-30 shadow-2xs">
        <div className="mx-auto max-w-5xl px-4 sm:px-6">
          <nav className="flex space-x-2 sm:space-x-4 overflow-x-auto py-2">
            {navItems.map((item) => {
              const isActive = item.exact
                ? location.pathname === item.path
                : location.pathname.startsWith(item.path);

              return (
                <NavLink
                  key={item.path}
                  to={item.path}
                  end={item.exact}
                  className={`flex min-h-[40px] items-center gap-2 rounded-xl px-3.5 py-2 text-xs sm:text-sm font-semibold whitespace-nowrap transition ${
                    isActive
                      ? 'bg-blue-50 text-blue-700 shadow-2xs'
                      : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900 active:bg-slate-100'
                  }`}
                >
                  <span className={isActive ? 'text-blue-600' : 'text-slate-400'}>{item.icon}</span>
                  <span>{item.name}</span>
                  {item.badge && (
                    <span className="ml-1 inline-flex h-5 items-center justify-center rounded-full bg-rose-600 px-1.5 text-[11px] font-bold text-white">
                      {item.badge}
                    </span>
                  )}
                </NavLink>
              );
            })}
          </nav>
        </div>
      </div>

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6 sm:px-6 sm:py-8">
        <Outlet />
      </main>
    </div>
  );
};

export default HeadLayout;

