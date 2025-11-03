import React, { useEffect } from 'react';
import { useTheme } from '../contexts/ThemeContext';

const TestDarkMode = () => {
    const { theme, toggleTheme } = useTheme();

    return (
        <div className="min-h-screen bg-white dark:bg-slate-900 p-8">
            <div className="max-w-4xl mx-auto">
                <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-8">
                    Dark Mode Test Page
                </h1>

                <div className="bg-white dark:bg-slate-800 rounded-xl shadow-lg p-6 mb-8 border border-slate-200 dark:border-slate-700">
                    <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-4">
                        Current Theme Status
                    </h2>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                        <div className="bg-blue-50 dark:bg-slate-700 p-4 rounded-lg">
                            <p className="text-sm text-slate-600 dark:text-slate-300">Context Theme</p>
                            <p className="text-lg font-bold text-blue-600 dark:text-blue-400">{theme}</p>
                        </div>

                        <div className="bg-purple-50 dark:bg-slate-700 p-4 rounded-lg">
                            <p className="text-sm text-slate-600 dark:text-slate-300">localStorage Theme</p>
                            <p className="text-lg font-bold text-purple-600 dark:text-purple-400">
                                {localStorage.getItem('theme') || 'null'}
                            </p>
                        </div>

                        <div className="bg-green-50 dark:bg-slate-700 p-4 rounded-lg">
                            <p className="text-sm text-slate-600 dark:text-slate-300">DOM Class</p>
                            <p className="text-lg font-bold text-green-600 dark:text-green-400">
                                {document.documentElement.classList.contains('dark') ? 'dark' : 'light'}
                            </p>
                        </div>

                        <div className="bg-amber-50 dark:bg-slate-700 p-4 rounded-lg">
                            <p className="text-sm text-slate-600 dark:text-slate-300">Prefers Dark</p>
                            <p className="text-lg font-bold text-amber-600 dark:text-amber-400">
                                {window.matchMedia('(prefers-color-scheme: dark)').matches ? 'true' : 'false'}
                            </p>
                        </div>
                    </div>

                    <div className="flex flex-wrap gap-4">
                        <button
                            onClick={toggleTheme}
                            className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors duration-200"
                        >
                            Toggle Theme
                        </button>

                        <button
                            onClick={() => {
                                console.log('=== Theme Status Check ===');
                                console.log('Context theme:', theme);
                                console.log('localStorage theme:', localStorage.getItem('theme'));
                                console.log('document.documentElement.classList.contains("dark"):', document.documentElement.classList.contains('dark'));
                                console.log('========================');
                            }}
                            className="px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white font-medium rounded-lg transition-colors duration-200"
                        >
                            Check Status
                        </button>

                        <button
                            onClick={() => {
                                localStorage.removeItem('theme');
                                window.location.reload();
                            }}
                            className="px-6 py-3 bg-red-600 hover:bg-red-700 text-white font-medium rounded-lg transition-colors duration-200"
                        >
                            Clear localStorage & Reload
                        </button>
                    </div>
                </div>

                <div className="bg-white dark:bg-slate-800 rounded-xl shadow-lg p-6 border border-slate-200 dark:border-slate-700">
                    <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-4">
                        Test Elements
                    </h2>

                    <div className="space-y-4">
                        <div className="p-4 bg-slate-100 dark:bg-slate-700 rounded-lg">
                            <p className="text-slate-900 dark:text-white">
                                This is a test paragraph with theme-appropriate text colors.
                            </p>
                        </div>

                        <div className="p-4 bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg">
                            <p className="text-white">
                                This is a gradient element that should look consistent in both themes.
                            </p>
                        </div>

                        <div className="p-4 border-2 border-slate-300 dark:border-slate-600 rounded-lg">
                            <p className="text-slate-900 dark:text-white">
                                This element has a border that adapts to the theme.
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default TestDarkMode;