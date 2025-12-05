import { useState } from 'react'

interface Todo {
  id: number
  text: string
  completed: boolean
}

interface TodoItemProps {
  todo: Todo
  onToggle: (id: number) => void
  onDelete: (id: number) => void
  onEdit: (id: number, text: string) => void
}

const TodoItem: React.FC<TodoItemProps> = ({ todo, onToggle, onDelete, onEdit }) => {
  const [isEditing, setIsEditing] = useState(false)
  const [editText, setEditText] = useState(todo.text)

  const handleEdit = () => {
    if (isEditing) {
      if (editText.trim()) {
        onEdit(todo.id, editText.trim())
      } else {
        setEditText(todo.text)
      }
      setIsEditing(false)
    } else {
      setIsEditing(true)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleEdit()
    } else if (e.key === 'Escape') {
      setEditText(todo.text)
      setIsEditing(false)
    }
  }

  return (
    <div className="flex items-center gap-4 p-4 bg-gray-800/50 backdrop-blur-sm border border-gray-700/50 rounded-lg shadow-xl transition-all duration-300 ease-out">
      <input
        type="checkbox"
        checked={todo.completed}
        onChange={() => onToggle(todo.id)}
        className="w-5 h-5 text-indigo-500 focus:ring-indigo-500"
        aria-label={`Mark ${todo.text} as ${todo.completed ? 'incomplete' : 'complete'}`}
      />
      {isEditing ? (
        <input
          type="text"
          value={editText}
          onChange={(e) => setEditText(e.target.value)}
          onBlur={handleEdit}
          onKeyDown={handleKeyDown}
          className="flex-1 px-3 py-2 border border-gray-700/50 rounded bg-gray-800/50 text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all duration-300 ease-out"
          autoFocus
        />
      ) : (
        <span
          onClick={() => setIsEditing(true)}
          className={`flex-1 cursor-pointer text-lg leading-normal ${todo.completed ? 'line-through text-gray-400' : 'text-gray-100'} transition-colors duration-300`}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => { if (e.key === 'Enter') setIsEditing(true) }}
          aria-label={`Edit task: ${todo.text}`}
        >
          {todo.text}
        </span>
      )}
      <button
        onClick={() => onDelete(todo.id)}
        className="px-3 py-2 text-red-400 hover:text-red-300 hover:scale-110 focus:outline-none focus:ring-2 focus:ring-red-400 rounded transition-all duration-300 ease-out"
        aria-label={`Delete task: ${todo.text}`}
      >
        ✕
      </button>
    </div>
  )
}

export default TodoItem