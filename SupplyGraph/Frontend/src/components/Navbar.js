// Navbar component
import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Button } from './ui/button';
import { TrendingUp, LogOut, User } from 'lucide-react';

const Navbar = () => {
  const { isAuthenticated, user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const isActive = (path) => location.pathname === path;

  return (
    <nav className="bg-white/80 backdrop-blur-md border-b border-slate-200 sticky top-0 z-50 transition-all duration-300">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <Link to="/" className="flex items-center space-x-2 group">
            <div className="p-2 bg-gradient-to-r from-slate-900 to-slate-700 rounded-lg group-hover:scale-105 transition-transform duration-200">
              <TrendingUp className="h-6 w-6 text-white" />
            </div>
            <span className="text-xl font-bold text-slate-900 group-hover:text-slate-700 transition-colors">
              ForecastAI
            </span>
          </Link>

          {/* Navigation Links */}
          <div className="hidden md:flex items-center space-x-8">
            {isAuthenticated ? (
              <>
                <Link
                  to="/upload"
                  className={`font-medium transition-colors hover:text-slate-900 ${
                    isActive('/upload') ? 'text-slate-900' : 'text-slate-600'
                  }`}
                >
                  Upload Data
                </Link>
                <Link
                  to="/prediction"
                  className={`font-medium transition-colors hover:text-slate-900 ${
                    isActive('/prediction') ? 'text-slate-900' : 'text-slate-600'
                  }`}
                >
                  Predictions
                </Link>
                <Link
                  to="/demo"
                  className={`font-medium transition-colors hover:text-slate-900 ${
                    isActive('/demo') ? 'text-slate-900' : 'text-slate-600'
                  }`}
                >
                  Charts Demo
                </Link>
                <div className="flex items-center space-x-4">
                  <div className="flex items-center space-x-2 text-sm text-slate-600">
                    <User className="h-4 w-4" />
                    <span>{user?.companyName}</span>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleLogout}
                    className="flex items-center space-x-2 hover:bg-slate-50"
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
                  className="font-medium text-slate-600 hover:text-slate-900 transition-colors"
                >
                  Charts Demo
                </Link>
                <Link
                  to="/login"
                  className="font-medium text-slate-600 hover:text-slate-900 transition-colors"
                >
                  Sign In
                </Link>
                <Link to="/register">
                  <Button className="bg-slate-900 hover:bg-slate-800 text-white transition-all duration-200 hover:scale-105">
                    Get Started
                  </Button>
                </Link>
              </div>
            )}
          </div>

          {/* Mobile menu button */}
          <div className="md:hidden">
            {isAuthenticated ? (
              <Button
                variant="outline"
                size="sm"
                onClick={handleLogout}
                className="flex items-center space-x-2"
              >
                <LogOut className="h-4 w-4" />
              </Button>
            ) : (
              <Link to="/register">
                <Button size="sm" className="bg-slate-900 hover:bg-slate-800">
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