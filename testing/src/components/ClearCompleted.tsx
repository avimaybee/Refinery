interface ClearCompletedProps {
  onClear: () => void
}

const ClearCompleted: React.FC<ClearCompletedProps> = ({ onClear }) => {
  return (
    <button
      onClick={onClear}
      className="w-full px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-500 hover:scale-105 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 focus:ring-offset-gray-950 transition-all duration-300 ease-out font-medium"
      aria-label="Clear all completed tasks"
    >
      Clear Completed
    </button>
  )
}

export default ClearCompleted