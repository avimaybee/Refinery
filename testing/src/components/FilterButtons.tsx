interface FilterButtonsProps {
  filter: string
  onFilter: (filter: string) => void
}

const FilterButtons: React.FC<FilterButtonsProps> = ({ filter, onFilter }) => {
  return (
    <div className="flex justify-center gap-3 mb-8">
      {['all', 'active', 'completed'].map(f => (
        <button
          key={f}
          onClick={() => onFilter(f)}
          className={`px-6 py-3 rounded-lg capitalize transition-all duration-300 ease-out font-medium ${
            filter === f
              ? 'bg-indigo-600 text-white shadow-xl'
              : 'bg-gray-800/50 text-gray-100 hover:bg-indigo-600 hover:text-white hover:scale-105 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-gray-950'
          }`}
          aria-pressed={filter === f}
        >
          {f}
        </button>
      ))}
    </div>
  )
}

export default FilterButtons