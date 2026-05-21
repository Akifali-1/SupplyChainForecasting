// Navbar component — Floating capsule design (matches Homepage navbar)
import React, { useState, useEffect, useRef } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { TrendingUp, LogOut, ChevronDown, Sun, Moon } from 'lucide-react';

const Navbar = () => {
  const { isAuthenticated, user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
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

  // Hide global navbar on Homepage (has its own inline navbar)
  if (location.pathname === '/') {
    return null;
  }

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const isActive = (path) => location.pathname === path;
  const isAdmin = user?.role === 'admin';
  const displayName = user?.name || user?.email?.split('@')[0] || 'User';
  const companyName = user?.companyName || '';

  return (
    <div className="fixed top-6 left-0 right-0 w-full px-6 md:px-12 z-50 flex items-center justify-between pointer-events-none">

      {/* ── LEFT: Floating Logo Bubble ── */}
      <div className="pointer-events-auto flex items-center gap-2 bg-black/60 dark:bg-black/70 backdrop-blur-xl border border-white/10 rounded-full px-4 py-2 hover:border-white/20 transition-all duration-300 shadow-xl">
        <Link to="/" className="flex items-center gap-2 hover:opacity-90 transition-opacity">
          <div className="w-[28px] h-[28px] rounded-full bg-white/10 flex items-center justify-center">
            <TrendingUp className="w-[15px] h-[15px] text-[#00B4D8]" />
          </div>
          <span className="text-white font-semibold text-sm tracking-tight">SupplyGraph</span>
        </Link>
      </div>

      {/* ── RIGHT: Glassmorphic Capsule ── */}
      <div className="pointer-events-auto flex items-center bg-black/65 dark:bg-black/75 backdrop-blur-xl border border-white/10 rounded-full p-1.5 pl-6 gap-6 md:gap-8 max-w-max shadow-2xl">

        {/* Nav links (authenticated only) */}
        {isAuthenticated && (
          <div className="hidden lg:flex items-center gap-6">
            <NavLink to="/dashboard" active={isActive('/dashboard')}>Dashboard</NavLink>
            <NavLink to="/prediction" active={isActive('/prediction')}>Predictions</NavLink>
            <NavLink to="/inventory" active={isActive('/inventory')}>Inventory</NavLink>

            {/* Admin dropdown */}
            {isAdmin && (
              <div className="relative" ref={adminMenuRef}>
                <button
                  onClick={() => setAdminMenuOpen(o => !o)}
                  className={`flex items-center gap-1 font-semibold text-[10px] uppercase tracking-widest transition-colors duration-200 focus:outline-none ${
                    isActive('/upload') || isActive('/settings/members') || isActive('/reorder')
                      ? 'text-white'
                      : 'text-[#94A3B8] hover:text-white'
                  }`}
                >
                  <span>Admin</span>
                  <ChevronDown className={`w-3 h-3 transition-transform duration-200 ${adminMenuOpen ? 'rotate-180' : ''}`} />
                </button>
                {adminMenuOpen && (
                  <div className="absolute top-8 left-0 w-44 bg-black border border-white/10 rounded-2xl p-1.5 shadow-2xl z-50">
                    <Link
                      to="/upload"
                      onClick={() => setAdminMenuOpen(false)}
                      className="block px-3 py-2 text-[10px] font-medium tracking-wide uppercase text-[#94A3B8] hover:text-white hover:bg-white/5 rounded-xl transition-colors"
                    >
                      Upload Data
                    </Link>
                    <Link
                      to="/settings/members"
                      onClick={() => setAdminMenuOpen(false)}
                      className="block px-3 py-2 text-[10px] font-medium tracking-wide uppercase text-[#94A3B8] hover:text-white hover:bg-white/5 rounded-xl transition-colors"
                    >
                      Manage Team
                    </Link>
                    <Link
                      to="/reorder"
                      onClick={() => setAdminMenuOpen(false)}
                      className="block px-3 py-2 text-[10px] font-medium tracking-wide uppercase text-[#94A3B8] hover:text-white hover:bg-white/5 rounded-xl transition-colors"
                    >
                      Reorder
                    </Link>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Theme toggle */}
        <button
          onClick={toggleTheme}
          className="w-7 h-7 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-[#94A3B8] hover:text-white transition-colors duration-200"
          aria-label="Toggle theme"
        >
          {theme === 'dark' ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
        </button>

        {/* Auth pill */}
        {isAuthenticated ? (
          <button
            onClick={handleLogout}
            className="bg-white hover:bg-white/90 text-black font-semibold text-[10px] uppercase tracking-wider px-4 py-2 rounded-full transition-all duration-200 flex items-center gap-1.5 shadow-lg select-none"
          >
            <span className="font-bold">
              {displayName}{companyName ? ` @ ${companyName}` : ''}
            </span>
            <LogOut className="w-3 h-3 text-black/70" />
          </button>
        ) : (
          <div className="flex items-center gap-4 pr-2">
            <Link
              to="/login"
              className="text-[#94A3B8] font-semibold text-[10px] uppercase tracking-widest hover:text-white transition-colors duration-200"
            >
              Login
            </Link>
            <Link
              to="/register"
              className="bg-white hover:bg-white/90 text-black font-semibold text-[10px] uppercase tracking-wider px-4 py-2 rounded-full transition-all duration-200 shadow-lg select-none"
            >
              Sign Up
            </Link>
          </div>
        )}
      </div>
    </div>
  );
};

// Nav link with active glow state
const NavLink = ({ to, active, children }) => (
  <Link
    to={to}
    className={`font-semibold text-[10px] uppercase tracking-widest transition-colors duration-200 ${
      active ? 'text-white' : 'text-[#94A3B8] hover:text-white'
    }`}
  >
    {children}
  </Link>
);

export default Navbar;