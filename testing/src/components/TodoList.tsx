import SwipeableCard from './SwipeableCard'

interface Todo {
  id: number
  text: string
  completed: boolean
}

interface TodoListProps {
  todos: Todo[]
  onToggle: (id: number) => void
  onDelete: (id: number) => void
  onEdit: (id: number, text: string) => void
}

const TodoList: React.FC<TodoListProps> = ({ todos, onToggle, onDelete }) => {
  return (
    <div className="space-y-4 mb-8">
      {todos.length === 0 ? (
        <div className="text-center text-gray-400 py-12">No tasks to display.</div>
      ) : (
        todos.map((todo: any) => (
          // For backward compatibility we still support TodoItem; prefer SwipeableCard for enhanced UI
          <SwipeableCard
            key={todo.id}
            todo={{ id: todo.id, text: todo.text, description: (todo as any).description, dueDate: (todo as any).dueDate, priority: (todo as any).priority }}
            onDelete={onDelete}
            onComplete={(id) => onToggle(id)}
          />
        ))
      )}
    </div>
  )
}

export default TodoList