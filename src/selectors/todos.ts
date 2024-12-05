import { createSelector } from 'reselect';
import { Todo } from '../schemas/todo';
import { StateFrom } from 'xstate';
import { createFetchMachine } from '../machines/promiseMachine';

type FetchMachineState = StateFrom<ReturnType<typeof createFetchMachine<Todo[]>>>;

const NULL_TODOS  : Todo[] = [];
const getTodos = (state: FetchMachineState) => 
  state.context.response ?? NULL_TODOS

export const selectTodoIds = createSelector(
  [getTodos],
  (todos) => todos.map(todo => todo.id)
);

export const selectTodoById = createSelector(
  [getTodos, (_: FetchMachineState, id: string) => id],
  (todos, id) => todos.find(todo => todo.id === id)
);
