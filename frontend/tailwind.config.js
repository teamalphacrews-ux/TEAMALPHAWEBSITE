/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            fontFamily: {
                serif: ['"Playfair Display"', 'serif'],
                sans: ['"Inter"', 'sans-serif'],
            },
            colors: {
                primary: '#1C1C1C',
                background: '#F7F5F2',
                charcoal: '#1C1C1C',
                ivory: '#F7F5F2',
                gold: '#D4AF37',
                warmgray: '#B8B5B0',
                mutedbrown: '#8C7B6D',
                beige: '#F2EFE9',
                "luxury-gold": "#D4AF37",
                "luxury-beige": "#F5F5DC",
                "luxury-cream": "#FFFDD0",
                "luxury-lavender": "#E6E6FA",
                "luxury-text-main": "#1A1A1A",
                "luxury-text-muted": "#666666",
            }
        },
    },
    plugins: [],
}
