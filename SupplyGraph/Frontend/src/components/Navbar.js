// Navbar component
import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { Button } from './ui/button';
import { TrendingUp, LogOut, User } from 'lucide-react';
import ThemeToggle from './ThemeToggle';

const Navbar = () => {
  const { isAuthenticated, user, logout } = useAuth();
  const { theme } = useTheme();
  const location = useLocation();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const isActive = (path) => location.pathname === path;

  return (
    <nav className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-700 sticky top-0 z-50 transition-all duration-300">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <Link to="/" className="flex items-center space-x-2 group">
            <div className="p-2 bg-gradient-to-r from-slate-900 to-slate-700 dark:from-slate-300 dark:to-slate-500 rounded-lg group-hover:scale-105 transition-transform duration-200">
              <TrendingUp className="h-6 w-6 text-white dark:text-slate-900" />
            </div>
            <span className="text-xl font-bold text-slate-900 dark:text-white group-hover:text-slate-700 dark:group-hover:text-slate-300 transition-colors">
              ForecastAI
            </span>
          </Link>

          {/* Navigation Links */}
          <div className="hidden md:flex items-center space-x-8">
            {isAuthenticated ? (
              <>
                <Link
                  to="/upload"
                  className={`font-medium transition-colors hover:text-slate-900 dark:hover:text-white ${isActive('/upload') ? 'text-slate-900 dark:text-white' : 'text-slate-600 dark:text-slate-300'
                    }`}
                >
                  Upload Data
                </Link>
                <Link
                  to="/prediction"
                  className={`font-medium transition-colors hover:text-slate-900 dark:hover:text-white ${isActive('/prediction') ? 'text-slate-900 dark:text-white' : 'text-slate-600 dark:text-slate-300'
                    }`}
                >
                  Predictions
                </Link>
                <Link
                  to="/inventory"
                  className={`font-medium transition-colors hover:text-slate-900 dark:hover:text-white ${isActive('/inventory') ? 'text-slate-900 dark:text-white' : 'text-slate-600 dark:text-slate-300'
                    }`}
                >
                  Inventory
                </Link>
                <div className="flex items-center space-x-4">
                  <div className="flex items-center space-x-2 text-sm text-slate-600 dark:text-slate-300">
                    <User className="h-4 w-4" />
                    <span>{user?.companyName}</span>
                  </div>
                  <ThemeToggle />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleLogout}
                    className="flex items-center space-x-2 hover:bg-slate-50 dark:hover:bg-slate-800 dark:border-slate-700 dark:text-white"
                  >
                    <LogOut className="h-4 w-4" />
                    <span>Logout</span>
                  </Button>
                </div>
              </>
            ) : (
              <div className="flex items-center space-x-4">
                <Link
                  to="/demo"
                  className="font-medium text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white transition-colors"
                >
                  Charts Demo
                </Link>
                <Link
                  to="/login"
                  className="font-medium text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white transition-colors"
                >
                  Sign In
                </Link>
                <ThemeToggle />
                <Link to="/register">
                  <Button className="bg-slate-900 hover:bg-slate-800 text-white dark:bg-slate-700 dark:hover:bg-slate-600 transition-all duration-200 hover:scale-105">
                    Get Started
                  </Button>
                </Link>
              </div>
            )}
          </div>

          {/* Mobile menu button */}
          <div className="md:hidden flex items-center space-x-2">
            <ThemeToggle />
            {isAuthenticated ? (
              <Button
                variant="outline"
                size="sm"
                onClick={handleLogout}
                className="flex items-center space-x-2 dark:border-slate-700 dark:text-white"
              >
                <LogOut className="h-4 w-4" />
              </Button>
            ) : (
              <Link to="/register">
                <Button size="sm" className="bg-slate-900 hover:bg-slate-800 dark:bg-slate-700 dark:hover:bg-slate-600">
                  Get Started
                </Button>
              </Link>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;