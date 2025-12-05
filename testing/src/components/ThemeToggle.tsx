interface ThemeToggleProps {
  onToggle: () => void
  theme: string
}

const ThemeToggle: React.FC<ThemeToggleProps> = ({ onToggle, theme }) => {
  return (
    <button
      onClick={onToggle}
      className="px-4 py-2 bg-gray-800/50 text-gray-100 rounded-lg hover:bg-indigo-600 hover:text-white hover:scale-105 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-gray-950 transition-all duration-300 ease-out font-medium"
      aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
    >
      {theme === 'light' ? '🌙 Dark' : '☀️ Light'}
    </button>
  )
}

export default ThemeToggle