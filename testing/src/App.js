import { useState, useEffect } from 'react';
import TodoInput from './components/TodoInput';
import TodoList from './components/TodoList';
import FilterButtons from './components/FilterButtons';
import ClearCompleted from './components/ClearCompleted';
import ThemeToggle from './components/ThemeToggle';
function App() {
    const [todos, setTodos] = useState([]);
    const [filter, setFilter] = useState('all');
    const [theme, setTheme] = useState('light');
    useEffect(() => {
        const savedTodos = localStorage.getItem('todos');
        if (savedTodos) {
            setTodos(JSON.parse(savedTodos));
        }
        const savedTheme = localStorage.getItem('theme') || 'dark';
        setTheme(savedTheme);
        document.documentElement.classList.toggle('dark', savedTheme === 'dark');
    }, []);
    useEffect(() => {
        localStorage.setItem('todos', JSON.stringify(todos));
    }, [todos]);
    useEffect(() => {
        localStorage.setItem('theme', theme);
        document.documentElement.classList.toggle('dark', theme === 'dark');
    }, [theme]);
    const addTodo = (text) => {
        setTodos([...todos, { id: Date.now(), text, completed: false }]);
    };
    const toggleTodo = (id) => {
        setTodos(todos.map(todo => todo.id === id ? { ...todo, completed: !todo.completed } : todo));
    };
    const deleteTodo = (id) => {
        setTodos(todos.filter(todo => todo.id !== id));
    };
    const editTodo = (id, text) => {
        setTodos(todos.map(todo => todo.id === id ? { ...todo, text } : todo));
    };
    const clearCompleted = () => {
        setTodos(todos.filter(todo => !todo.completed));
    };
    const filteredTodos = todos.filter(todo => {
        if (filter === 'active')
            return !todo.completed;
        if (filter === 'completed')
            return todo.completed;
        return true;
    });
    const toggleTheme = () => {
        setTheme(theme === 'light' ? 'dark' : 'light');
    };
    return (<div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-gray-900/80 backdrop-blur-lg border border-gray-700/50 rounded-2xl shadow-2xl p-8 transition-all duration-300 ease-out">
        <h1 className="text-5xl font-bold text-center mb-8 text-gray-100 leading-tight">Todo List</h1>
        <div className="flex justify-end mb-6">
          <ThemeToggle onToggle={toggleTheme} theme={theme}/>
        </div>
        <TodoInput onAdd={addTodo}/>
        <TodoList todos={filteredTodos} onToggle={toggleTodo} onDelete={deleteTodo} onEdit={editTodo}/>
        <FilterButtons filter={filter} onFilter={setFilter}/>
        <ClearCompleted onClear={clearCompleted}/>
      </div>
    </div>);
}
export default App;
//# sourceMappingURL=App.js.map