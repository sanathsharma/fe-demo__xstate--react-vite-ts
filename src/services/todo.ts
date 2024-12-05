import env from "../lib/env"
import { parseResponse, simpleFetch } from "../lib/simpleFetch"
import { Todo, Todo_fc, Todo_fu } from "../schemas/todo";
import { createFetchMachine } from "../machines/promiseMachine";
import { fromPromise } from "xstate";

// Get Todos Machine
export const getTodosMachine = createFetchMachine<Todo[]>().provide({
    actors: {
        fetchData: fromPromise(async () => {
            const response = await simpleFetch(`${env.API_BASE}/todos`);
            return parseResponse(response)
        }),
    },
});

// Create Todo Machine
export const createTodoMachine = createFetchMachine<Todo_fc>().provide({
    actors: {
        fetchData: fromPromise<Todo,Todo_fc>(async ({input: todo }) => {
            const response = await simpleFetch(`${env.API_BASE}/todos`, {
                method: "POST",
                body: todo,
            });
            return parseResponse(response)
        }),
    },
});

// Update Todo Machine
export const updateTodoMachine = createFetchMachine<Todo_fu>().provide({
    actors: {
        fetchData: fromPromise<Todo, Todo_fu>(async ({ input: todo, ...rest }) => {
            console.log({todo, rest});
            const response = await simpleFetch(`${env.API_BASE}/todos/${todo.id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: todo,
            });
            return parseResponse(response);
            
        }),
    },
});