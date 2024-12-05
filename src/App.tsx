import { useEffect } from 'react';
import { useSelector, useActorRef } from '@xstate/react';
import { getTodosMachine } from './services/todo';
import { TodosTable } from './components/TodosTable';
import { Error } from './components/ui/Error';
import './App.css';

function App() {
  const todosRef = useActorRef(getTodosMachine);
  const status = useSelector(todosRef, state => state.value);

  useEffect(() => {
    todosRef.send({ type: 'FETCH' });
  }, []);

  if (status === 'pending') {
    return <div>Loading...</div>;
  }

  if (status === 'rejected') {
    return <Error fetchRef={todosRef} />;
  }

  return (
    <div>
      <h1>Todos</h1>
      <TodosTable todosRef={todosRef} />
    </div>
  );
}

export default App;
