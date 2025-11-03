import React from 'react';
import { render, act } from '@testing-library/react';
import { ThemeProvider, useTheme } from './ThemeContext';

// Mock localStorage
const localStorageMock = (function () {
    let store = {};
    return {
        getItem: function (key) {
            return store[key] || null;
        },
        setItem: function (key, value) {
            store[key] = value.toString();
        },
        removeItem: function (key) {
            delete store[key];
        },
        clear: function () {
            store = {};
        }
    };
})();

Object.defineProperty(window, 'localStorage', {
    value: localStorageMock
});

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: jest.fn().mockImplementation(query => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: jest.fn(), // Deprecated
        removeListener: jest.fn(), // Deprecated
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
        dispatchEvent: jest.fn(),
    })),
});

// Test component that uses the theme context
const TestComponent = () => {
    const { theme, toggleTheme } = useTheme();
    return (
        <div>
            <span data-testid="theme-value">{theme}</span>
            <button data-testid="toggle-button" onClick={toggleTheme}>
                Toggle Theme
            </button>
        </div>
    );
};

describe('ThemeContext', () => {
    beforeEach(() => {
        localStorage.clear();
        // Reset classList
        document.documentElement.classList.remove('dark');
        // Reset matchMedia mock
        window.matchMedia.mockImplementation(query => ({
            matches: false,
            media: query,
            onchange: null,
            addListener: jest.fn(),
            removeListener: jest.fn(),
            addEventListener: jest.fn(),
            removeEventListener: jest.fn(),
            dispatchEvent: jest.fn(),
        }));
    });

    it('provides default theme as light', () => {
        const { getByTestId } = render(
            <ThemeProvider>
                <TestComponent />
            </ThemeProvider>
        );

        expect(getByTestId('theme-value').textContent).toBe('light');
    });

    it('loads saved theme from localStorage', () => {
        localStorage.setItem('theme', 'dark');

        const { getByTestId } = render(
            <ThemeProvider>
                <TestComponent />
            </ThemeProvider>
        );

        expect(getByTestId('theme-value').textContent).toBe('dark');
    });

    it('toggles theme and saves to localStorage', () => {
        const { getByTestId } = render(
            <ThemeProvider>
                <TestComponent />
            </ThemeProvider>
        );

        // Initially light
        expect(getByTestId('theme-value').textContent).toBe('light');

        // Toggle to dark
        act(() => {
            getByTestId('toggle-button').click();
        });

        expect(getByTestId('theme-value').textContent).toBe('dark');
        expect(localStorage.getItem('theme')).toBe('dark');

        // Toggle back to light
        act(() => {
            getByTestId('toggle-button').click();
        });

        expect(getByTestId('theme-value').textContent).toBe('light');
        expect(localStorage.getItem('theme')).toBe('light');
    });

    it('applies dark class to document when theme is dark', () => {
        localStorage.setItem('theme', 'dark');

        render(
            <ThemeProvider>
                <TestComponent />
            </ThemeProvider>
        );

        expect(document.documentElement.classList.contains('dark')).toBe(true);
    });

    it('removes dark class from document when theme is light', () => {
        localStorage.setItem('theme', 'light');

        render(
            <ThemeProvider>
                <TestComponent />
            </ThemeProvider>
        );

        expect(document.documentElement.classList.contains('dark')).toBe(false);
    });

    it('uses system preference when no saved theme', () => {
        // Mock system preference for dark mode
        window.matchMedia.mockImplementation(query => ({
            matches: query === '(prefers-color-scheme: dark)',
            media: query,
            onchange: null,
            addListener: jest.fn(),
            removeListener: jest.fn(),
            addEventListener: jest.fn(),
            removeEventListener: jest.fn(),
            dispatchEvent: jest.fn(),
        }));

        const { getByTestId } = render(
            <ThemeProvider>
                <TestComponent />
            </ThemeProvider>
        );

        expect(getByTestId('theme-value').textContent).toBe('dark');
    });
});