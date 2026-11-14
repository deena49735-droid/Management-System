import React, { useState, useEffect, useRef } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  Shield,
  BookOpen,
  CheckSquare,
  Calendar,
  BarChart3,
  CheckCircle2,
  History,
  PlusCircle,
  FileCheck,
  Trophy,
  Menu,
  X,
  ChevronDown,
  LogOut,
  User as UserIcon,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { getDashboardPathByRole } from '../ProtectedRoute';
import Avatar from '../Avatar';
import Badge from '../Badge';
import api from '../../api/axios';

const roleMenus = {
  admin: [
    { name: 'Dashboard', path: '/admin', exact: true, icon: LayoutDashboard },
    { name: 'Users', path: '/admin/users', icon: Users },
    { name: 'Teams', path: '/admin/teams', icon: Shield },
    { name: 'Game criteria', path: '/admin/criteria', icon: BookOpen },
    { name: 'Entries', path: '/admin/entries', icon: CheckSquare },
    { name: 'Meetings', path: '/admin/meetings', icon: Calendar },
    { name: 'Leaderboard', path: '/leaderboard', icon: Trophy },
  ],
  teamHead: [
    { name: 'Dashboard', path: '/head', exact: true, icon: LayoutDashboard },
    { name: 'Approvals', path: '/head/approvals', icon: CheckCircle2, hasBadge: true },
    { name: 'My team', path: '/head/team', icon: Users },
    { name: 'History', path: '/head/history', icon: History },
    { name: 'Meetings', path: '/head/meetings', icon: Calendar },
    { name: 'Team scorecard', path: '/head/scorecard', icon: BarChart3 },
    { name: 'Game criteria', path: '/criteria', icon: BookOpen },
    { name: 'Leaderboard', path: '/leaderboard', icon: Trophy },
  ],
  teamAssistant: [
    { name: 'Dashboard', path: '/assistant', exact: true, icon: LayoutDashboard },
    { name: 'Approvals', path: '/assistant/approvals', icon: CheckCircle2, hasBadge: true },
    { name: 'My team', path: '/assistant/team', icon: Users },
    { name: 'Add entry', path: '/assistant/entries/new', icon: PlusCircle },
    { name: 'Meeting sheet', path: '/assistant/meetings', icon: Calendar },
    { name: 'Team scorecard', path: '/assistant/scorecard', icon: BarChart3 },
    { name: 'My submissions', path: '/assistant/submissions', icon: FileCheck },
    { name: 'Game criteria', path: '/criteria', icon: BookOpen },
    { name: 'Leaderboard', path: '/leaderboard', icon: Trophy },
  ],
  member: [
    { name: 'Dashboard', path: '/dashboard', exact: true, icon: LayoutDashboard },
    { name: 'Game criteria', path: '/criteria', icon: BookOpen },
    { name: 'Leaderboard', path: '/leaderboard', icon: Trophy },
  ],
};

const getPageTitle = (pathname) => {
  if (pathname === '/admin') return 'Admin Dashboard';
  if (pathname === '/admin/users') return 'Users Management';
  if (pathname === '/admin/teams') return 'Teams Management';
  if (pathname.startsWith('/admin/teams/')) return 'Team Details';
  if (pathname === '/admin/criteria' || pathname === '/criteria') return 'Game Criteria';
  if (pathname === '/admin/entries') return 'Entries Ledger';
  if (pathname.includes('/meetings')) {
    if (pathname.endsWith('/meetings')) return 'Meeting Sheets';
    return 'Meeting Sheet';
  }
  if (pathname === '/head') return 'Team Head Dashboard';
  if (pathname === '/head/approvals' || pathname === '/assistant/approvals') return 'Pending Approvals';
  if (pathname === '/head/team' || pathname === '/assistant/team') return 'My Team';
  if (pathname === '/head/history') return 'Approval History';
  if (pathname.includes('/scorecard')) return 'Team Scorecard';
  if (pathname === '/assistant') return 'Assistant Dashboard';
  if (pathname === '/assistant/entries/new') return 'Add Point Entry';
  if (pathname === '/assistant/submissions') return 'My Submissions';
  if (pathname === '/dashboard') return 'Member Dashboard';
  if (pathname === '/leaderboard') return 'Leaderboard';
  return 'Kadambas Game';
};

const AppShell = ({ children }) => {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [pendingApprovalsCount, setPendingApprovalsCount] = useState(0);

  const userMenuRef = useRef(null);

  const currentRole = user?.role || 'member';
  const navItems = roleMenus[currentRole] || roleMenus.member;
  const pageTitle = getPageTitle(location.pathname);

  // Fetch pending count for team head and assistant badge
  useEffect(() => {
    if (currentRole === 'teamHead') {
      const fetchPendingCount = async () => {
        try {
          const [memberRes, teamRes] = await Promise.all([
            api.get('/entries', { params: { status: 'pending' } }),
            api.get('/team-entries', { params: { status: 'pending' } }),
          ]);
          const total =
            (memberRes.data?.data?.length || 0) + (teamRes.data?.data?.length || 0);
          setPendingApprovalsCount(total);
        } catch {
          // Ignore background fetch failure
        }
      };
      fetchPendingCount();
    } else if (currentRole === 'teamAssistant') {
      const fetchPendingCount = async () => {
        try {
          const memberRes = await api.get('/entries', { params: { status: 'pending' } });
          const entries = memberRes.data?.data || [];
          const actionable = entries.filter((e) => e.canActOnMine !== false);
          setPendingApprovalsCount(actionable.length);
        } catch {
          // Ignore background fetch failure
        }
      };
      fetchPendingCount();
    }
  }, [currentRole, location.pathname]);

  // Close user dropdown on outside click
  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target)) {
        setIsUserMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  // Close drawer on Escape
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setIsDrawerOpen(false);
        setIsUserMenuOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Close drawer when route changes
  useEffect(() => {
    setIsDrawerOpen(false);
  }, [location.pathname]);

  // Lock body scroll when mobile drawer is open
  useEffect(() => {
    if (isDrawerOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isDrawerOpen]);

  const handleLogout = () => {
    setIsUserMenuOpen(false);
    logout();
  };

  const renderNavLinks = (onItemClick) => (
    <nav className="flex flex-col gap-1 p-3">
      {navItems.map((item) => {
        const Icon = item.icon;
        const isActive = item.exact
          ? location.pathname === item.path
          : location.pathname.startsWith(item.path);

        return (
          <NavLink
            key={item.path}
            to={item.path}
            end={item.exact}
            onClick={onItemClick}
            className={`flex min-h-[44px] items-center justify-between rounded-lg px-3 py-2.5 text-sm font-semibold transition-colors ${
              isActive
                ? 'bg-brand-50 text-brand-700'
                : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900 active:bg-slate-100'
            }`}
          >
            <div className="flex items-center gap-3 min-w-0">
              <Icon
                className={`h-4 w-4 shrink-0 ${
                  isActive ? 'text-brand-600' : 'text-slate-400'
                }`}
              />
              <span className="truncate">{item.name}</span>
            </div>

            {item.hasBadge && pendingApprovalsCount > 0 && (
              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-800 tabular-nums">
                {pendingApprovalsCount}
              </span>
            )}
          </NavLink>
        );
      })}
    </nav>
  );

  return (
    <div className="min-h-dvh bg-slate-50 text-slate-900 flex flex-col font-sans">
      {/* 1. Desktop Fixed Left Sidebar (240px) */}
      <aside className="hidden lg:flex fixed top-0 bottom-0 left-0 w-60 z-30 flex-col border-r border-slate-200 bg-white">
        {/* Sidebar Brand Header */}
        <div className="h-16 flex items-center gap-3 px-5 border-b border-slate-100 shrink-0">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600 text-white font-bold text-sm shadow-2xs">
            K
          </div>
          <div className="min-w-0">
            <span className="block text-sm font-semibold text-slate-900 tracking-tight leading-snug">
              Kadambas Game
            </span>
            <span className="block text-xs text-slate-400 font-medium">
              Management Portal
            </span>
          </div>
        </div>

        {/* Sidebar Navigation */}
        <div className="flex-1 overflow-y-auto py-2">
          {renderNavLinks()}
        </div>

        {/* Sidebar Footer info */}
        {user?.team && (
          <div className="p-3 border-t border-slate-100 shrink-0">
            <div className="rounded-lg bg-slate-50 p-2.5 border border-slate-100">
              <span className="block text-xs font-semibold uppercase tracking-wider text-slate-400">
                Assigned Team
              </span>
              <span className="block text-xs font-semibold text-slate-800 truncate mt-0.5">
                {typeof user.team === 'object' ? user.team.name : 'Active Team'}
              </span>
            </div>
          </div>
        )}
      </aside>

      {/* 2. Top Bar (Desktop & Mobile) */}
      <header className="sticky top-0 z-20 min-h-16 border-b border-slate-200 bg-white/95 backdrop-blur-xs lg:pl-60 pt-[env(safe-area-inset-top)]">
        <div className="h-full min-h-16 flex items-center justify-between px-4 sm:px-6 max-w-7xl mx-auto">
          {/* Left: Mobile hamburger button + Page Title */}
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setIsDrawerOpen(true)}
              className="lg:hidden flex h-10 w-10 min-h-[44px] min-w-[44px] items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition focus:outline-hidden"
              aria-label="Open navigation menu"
            >
              <Menu className="h-5 w-5" />
            </button>

            <h2 className="text-base sm:text-lg font-semibold text-slate-900 truncate">
              {pageTitle}
            </h2>
          </div>

          {/* Right: User Menu Dropdown */}
          <div className="relative" ref={userMenuRef}>
            <button
              type="button"
              onClick={() => setIsUserMenuOpen((prev) => !prev)}
              className="flex items-center gap-2.5 rounded-lg p-1.5 sm:px-3 sm:py-1.5 text-left hover:bg-slate-50 transition min-h-[44px] focus:outline-hidden"
              aria-expanded={isUserMenuOpen}
              aria-label="User profile menu"
            >
              <Avatar name={user?.name} role={user?.role} size="sm" />

              <div className="hidden sm:flex flex-col text-left leading-tight">
                <span className="text-xs font-semibold text-slate-900 truncate max-w-[140px]">
                  {user?.name}
                </span>
                <span className="text-xs text-slate-500 truncate max-w-[140px]">
                  {user?.username ? `@${user.username}` : user?.phone}
                </span>
              </div>

              <div className="hidden md:block">
                <Badge role={user?.role} dot={false} />
              </div>

              <ChevronDown
                className={`h-4 w-4 text-slate-400 transition-transform ${
                  isUserMenuOpen ? 'rotate-180' : ''
                }`}
              />
            </button>

            {/* Dropdown Menu */}
            {isUserMenuOpen && (
              <div className="absolute right-0 mt-2 w-56 rounded-xl border border-slate-200 bg-white p-1.5 shadow-lg z-50 animate-in fade-in duration-100">
                <div className="px-3 py-2 border-b border-slate-100">
                  <p className="text-xs font-semibold text-slate-900 truncate">{user?.name}</p>
                  <p className="text-xs text-slate-500 truncate">
                    {user?.username ? `@${user.username}` : user?.phone}
                  </p>
                  <div className="mt-1.5">
                    <Badge role={user?.role} dot={false} />
                  </div>
                </div>

                <div className="py-1">
                  <button
                    type="button"
                    onClick={() => {
                      setIsUserMenuOpen(false);
                      navigate(getDashboardPathByRole(user?.role));
                    }}
                    className="w-full flex items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
                  >
                    <UserIcon className="h-4 w-4 text-slate-400" />
                    <span>My Dashboard</span>
                  </button>
                </div>

                <div className="border-t border-slate-100 pt-1">
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="w-full flex items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-50 transition"
                  >
                    <LogOut className="h-4 w-4 text-rose-500" />
                    <span>Log out</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* 3. Mobile Slide-in Drawer */}
      {isDrawerOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-slate-900/50 backdrop-blur-2xs transition-opacity"
            onClick={() => setIsDrawerOpen(false)}
            aria-hidden="true"
          />

          {/* Drawer Panel */}
          <div className="relative w-64 max-w-[80vw] bg-white h-full shadow-2xl flex flex-col z-50 animate-in slide-in-from-left duration-200 pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] pl-[env(safe-area-inset-left)]">
            {/* Drawer Header */}
            <div className="h-16 flex items-center justify-between px-5 border-b border-slate-100 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600 text-white font-bold text-sm shadow-2xs">
                  K
                </div>
                <span className="text-sm font-semibold text-slate-900">Kadambas Game</span>
              </div>
              <button
                type="button"
                onClick={() => setIsDrawerOpen(false)}
                className="flex h-10 w-10 min-h-[44px] min-w-[44px] items-center justify-center rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition"
                aria-label="Close menu"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Navigation links */}
            <div className="flex-1 overflow-y-auto py-2">
              {renderNavLinks(() => setIsDrawerOpen(false))}
            </div>

            {/* Drawer Footer User summary */}
            <div className="p-3 border-t border-slate-100 bg-slate-50/70">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <Avatar name={user?.name} role={user?.role} size="sm" />
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-slate-900 truncate">{user?.name}</p>
                    <p className="text-xs text-slate-500 truncate">{user?.role}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="flex h-11 w-11 min-h-[44px] min-w-[44px] items-center justify-center rounded-lg text-rose-600 hover:bg-rose-50 transition"
                  title="Logout"
                  aria-label="Logout"
                >
                  <LogOut className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 4. Main Content Area */}
      <main className="flex-1 lg:pl-60">
        <div className="max-w-7xl mx-auto p-4 sm:p-6 w-full">
          {children}
        </div>
      </main>
    </div>
  );
};

export default AppShell;

