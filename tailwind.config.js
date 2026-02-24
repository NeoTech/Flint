/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/**/*.{ts,js}',
    './themes/**/*.html',
    './content/**/*.md',
  ],
  safelist: [
    // SkillCards badge colors — all bg-*-100 / text-*-800 combinations used by SkillColor
    'bg-green-100',  'text-green-800',
    'bg-blue-100',   'text-blue-800',
    'bg-purple-100', 'text-purple-800',
    'bg-amber-100',  'text-amber-800',
    'bg-gray-200',   'text-gray-700',
    'bg-rose-100',   'text-rose-800',
    'bg-teal-100',   'text-teal-800',
    'bg-orange-100', 'text-orange-800',
    'bg-indigo-100', 'text-indigo-800',
  ],
  theme: {
    extend: {},
  },
  plugins: [],
};
