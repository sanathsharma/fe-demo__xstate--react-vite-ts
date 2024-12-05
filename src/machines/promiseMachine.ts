import { setup, assign } from 'xstate';

export const createFetchMachine = <TData, TError = Error, TPayload = unknown>() => {
  return setup({
    types: {
      context: {} as {
        response?: TData;
        error?: TError;
      },
      events: {} as
        | { type: 'FETCH', payload: TPayload }
        | { type: 'RETRY' }
        | { type: 'DONE'; response: TData }
        | { type: 'ERROR'; error: TError },
    },
    actions: {
      onSuccess: () => {
        console.log('Operation completed successfully');
      },
      onError: () => {
        console.log('Operation completed successfully');
      },
    },
  }).createMachine({
    id: 'fetch',
    initial: 'idle',
    context: {},
    states: {
      idle: {
        on: { FETCH: 'loading' },
      },
      loading: {
        invoke: {
          src: 'fetchData',
          input: ({event}) => event.payload,
          onDone: {
            target: 'success',
            actions: assign({
              response: ({ event }) => event.output,
            }),
          },
          onError: {
            target: 'failure',
            actions: assign({
              error: ({ event }) => event.error,
            }),
          },
        },
      },
      success: {
        entry: 'onSuccess',
        on: { FETCH: 'loading' },
      },
      failure: {
        entry: 'onError',
        on: {
          RETRY: 'loading',
        },
      },
    },
  });
};