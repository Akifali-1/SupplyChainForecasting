import React from 'react';

const TestTheme = () => {
    const checkTheme = () => {
        console.log('=== Theme Check ===');
        console.log('localStorage theme:', localStorage.getItem('theme'));
        console.log('document.documentElement.classList.contains("dark"):',
            document.documentElement.classList.contains('dark'));
        console.log('==================');
    };

    const clearTheme = () => {
        localStorage.removeItem('theme');
        console.log('Cleared theme from localStorage');
        checkTheme();
    };

    const setLightTheme = () => {
        localStorage.setItem('theme', 'light');
        document.documentElement.classList.remove('dark');
        console.log('Set theme to light');
        checkTheme();
    };

    const setDarkTheme = () => {
        localStorage.setItem('theme', 'dark');
        document.documentElement.classList.add('dark');
        console.log('Set theme to dark');
        checkTheme();
    };

    return (
        <div className="min-h-screen bg-white dark:bg-slate-900 p-8">
            <div className="max-w-4xl mx-auto">
                <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-8">
                    Theme Debug Test
                </h1>

                <div className="bg-white dark:bg-slate-800 rounded-xl shadow-lg p-6 mb-8 border border-slate-200 dark:border-slate-700">
                    <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-4">
                        Theme Debug Controls
                    </h2>

                    <div className="flex flex-wrap gap-4 mb-6">
                        <button
                            onClick={checkTheme}
                            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
                        >
                            Check Theme Status
                        </button>

                        <button
                            onClick={clearTheme}
                            className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-medium rounded-lg transition-colors"
                        >
                            Clear Theme
                        </button>

                        <button
                            onClick={setLightTheme}
                            className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white font-medium rounded-lg transition-colors"
                        >
                            Set Light Theme
                        </button>

                        <button
                            onClick={setDarkTheme}
                            className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white font-medium rounded-lg transition-colors"
                        >
                            Set Dark Theme
                        </button>

                        <button
                            onClick={() => window.location.reload()}
                            className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg transition-colors"
                        >
                            Reload Page
                        </button>
                    </div>

                    <div className="mt-6 p-4 bg-slate-100 dark:bg-slate-700 rounded-lg">
                        <p className="text-slate-900 dark:text-white">
                            Open the browser console to see the debug logs. Use the buttons above to test different theme scenarios.
                        </p>
                    </div>
                </div>

                <div className="bg-white dark:bg-slate-800 rounded-xl shadow-lg p-6 border border-slate-200 dark:border-slate-700">
                    <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-4">
                        Theme Visual Test
                    </h2>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="p-4 bg-slate-100 dark:bg-slate-700 rounded-lg">
                            <p className="text-slate-900 dark:text-white">
                                Background: slate-100 / dark:bg-slate-700
                            </p>
                        </div>

                        <div className="p-4 bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg">
                            <p className="text-white">
                                Gradient background
                            </p>
                        </div>

                        <div className="p-4 border-2 border-slate-300 dark:border-slate-600 rounded-lg">
                            <p className="text-slate-900 dark:text-white">
                                Border: slate-300 / dark:border-slate-600
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default TestTheme;