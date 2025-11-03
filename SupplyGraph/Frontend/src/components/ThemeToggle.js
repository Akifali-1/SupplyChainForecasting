import React from 'react';
import { useTheme } from '../contexts/ThemeContext';
import { Button } from './ui/button';
import { Sun, Moon } from 'lucide-react';

const ThemeToggle = () => {
    const { theme, toggleTheme } = useTheme();

    return (
        <Button
            variant="ghost"
            size="icon"
            onClick={toggleTheme}
            className="relative rounded-full hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
            aria-label={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
        >
            <Sun className="h-5 w-5 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
            <Moon className="absolute h-5 w-5 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
        </Button>
    );
};

export default ThemeToggle;