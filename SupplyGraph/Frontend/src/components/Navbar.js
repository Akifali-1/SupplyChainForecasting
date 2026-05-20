// Navbar component
import React, { useState, useEffect, useRef } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { Button } from './ui/button';
import { TrendingUp, LogOut, User, ChevronDown, Upload, Users, ShoppingCart } from 'lucide-react';
import ThemeToggle from './ThemeToggle';

const Navbar = () => {
  const { isAuthenticated, user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [adminMenuOpen, setAdminMenuOpen] = useState(false);
  const adminMenuRef = useRef(null);

  // Close admin dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (adminMenuRef.current && !adminMenuRef.current.contains(e.target)) {
        setAdminMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Close dropdown on route change
  useEffect(() => {
    setAdminMenuOpen(false);
  }, [location.pathname]);

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const isActive = (path) => location.pathname === path;
  const isAdmin = user?.role === 'admin';

  // Show user's real name in navbar
  const displayName = user?.name?.split(' ')[0] || user?.email?.split('@')[0] || 'User';
  // Company name for tooltip/secondary info
  const companyName = user?.companyName || 'No Company';

  return (
    <nav className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-700 z-50 sticky top-0 transition-all duration-300">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 gap-4">

          {/* ── LEFT: Logo ── */}
          <Link to="/" className="flex items-center gap-2 group shrink-0">
            <div className="p-2 bg-gradient-to-r from-slate-900 to-slate-700 dark:from-slate-300 dark:to-slate-500 rounded-lg group-hover:scale-105 transition-transform duration-200">
              <TrendingUp className="h-5 w-5 text-white dark:text-slate-900" />
            </div>
            <span className="text-lg font-bold text-slate-900 dark:text-white group-hover:text-slate-700 dark:group-hover:text-slate-300 transition-colors">
              SupplyGraph
            </span>
          </Link>

          {/* ── CENTER: Nav links ── */}
          {isAuthenticated && (
            <div className="hidden md:flex items-center gap-1 flex-1 justify-center">

              <NavLink to="/dashboard" active={isActive('/dashboard')}>Dashboard</NavLink>
              <NavLink to="/prediction" active={isActive('/prediction')}>Predictions</NavLink>
              <NavLink to="/inventory" active={isActive('/inventory')}>Inventory</NavLink>

              {/* Admin dropdown */}
              {isAdmin && (
                <div className="relative" ref={adminMenuRef}>
                  <button
                    onClick={() => setAdminMenuOpen(o => !o)}
                    className={`flex items-center gap-1 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                      isActive('/upload') || isActive('/settings/members') || isActive('/reorder')
                        ? 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white'
                        : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    Admin
                    <ChevronDown className={`h-3.5 w-3.5 transition-transform duration-200 ${adminMenuOpen ? 'rotate-180' : ''}`} />
                  </button>

                  {adminMenuOpen && (
                    <div className="absolute top-full left-0 mt-1.5 w-52 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl py-1 z-50">
                      <Link
                        to="/upload"
                        className="flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                      >
                        <Upload className="h-4 w-4 text-slate-400" />
                        Upload Data
                      </Link>
                      <Link
                        to="/settings/members"
                        className="flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                      >
                        <Users className="h-4 w-4 text-slate-400" />
                        Manage Members
                      </Link>
                      <div className="my-1 border-t border-slate-100 dark:border-slate-800" />
                      <Link
                        to="/reorder"
                        className="flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 dark:text-slate-300 hover:bg-violet-50 dark:hover:bg-slate-800 transition-colors group"
                      >
                        <ShoppingCart className="h-4 w-4 text-violet-400 group-hover:text-violet-500" />
                        <span className="group-hover:text-violet-600 dark:group-hover:text-violet-300">Reorder Intelligence</span>
                      </Link>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ── RIGHT: User widget + actions ── */}
          <div className="flex items-center gap-2 shrink-0">
            {isAuthenticated ? (
              <>
                {/* User name + role badge */}
                <div className="hidden md:flex items-center gap-2 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-1.5 text-sm">
                  <User className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                  <span className="font-medium text-slate-700 dark:text-slate-200 max-w-[110px] truncate" title={user?.name}>
                    {displayName}
                  </span>
                  <span className="text-slate-300 dark:text-slate-600">·</span>
                  <span className="text-xs text-slate-400 dark:text-slate-500 max-w-[80px] truncate" title={companyName}>
                    {companyName}
                  </span>
                  <span className={`shrink-0 px-1.5 py-0.5 text-xs rounded font-semibold capitalize ${
                    isAdmin
                      ? 'bg-violet-100 dark:bg-violet-900/40 text-violet-700 dark:text-violet-300'
                      : 'bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400'
                  }`}>
                    {user?.role || 'user'}
                  </span>
                </div>

                <ThemeToggle />

                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleLogout}
                  className="flex items-center gap-1.5 dark:border-slate-700 dark:text-white hover:bg-slate-50 dark:hover:bg-slate-800 text-sm"
                >
                  <LogOut className="h-4 w-4" />
                  <span className="hidden sm:inline">Logout</span>
                </Button>
              </>
            ) : (
              <>
                <Link
                  to="/login"
                  className="text-sm font-medium text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white transition-colors px-3 py-1.5"
                >
                  Login
                </Link>
                <Link to="/register">
                  <Button className="bg-slate-900 hover:bg-slate-800 text-white dark:bg-slate-700 dark:hover:bg-slate-600 text-sm transition-all duration-200 hover:scale-105">
                    Sign Up
                  </Button>
                </Link>
                <ThemeToggle />
              </>
            )}
          </div>

        </div>
      </div>
    </nav>
  );
};

// Reusable nav link with active state pill
const NavLink = ({ to, active, children }) => (
  <Link
    to={to}
    className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
      active
        ? 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white'
        : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white'
    }`}
  >
    {children}
  </Link>
);

export default Navbar;