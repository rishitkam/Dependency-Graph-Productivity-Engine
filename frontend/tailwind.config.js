/** @type {import('tailwindcss').Config} */
export default {
    content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
    theme: {
        extend: {
            fontFamily: {
                display: ['"Syne"', 'sans-serif'],
                body: ['"DM Sans"', 'sans-serif'],
                mono: ['"JetBrains Mono"', 'monospace'],
            },
            colors: {
                void: '#080a12',
                surface: '#0e1018',
                panel: '#141720',
                border: '#1e2130',
                'border-bright': '#2a2f45',
                synapse: {
                    50: '#eef2ff',
                    400: '#818cf8',
                    500: '#6366f1',
                    600: '#4f46e5',
                },
                neural: '#22d3ee',
                ember: '#f97316',
                pulse: '#10b981',
            },
        },
    },
    plugins: [],
}