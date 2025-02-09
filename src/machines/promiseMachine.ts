import log from "loglevel";
import {
  assertEvent,
  assign,
  type DoneActorEvent,
  type ErrorActorEvent,
  fromPromise,
  not,
  setup,
  type DoneStateEvent,
} from "xstate";

type Options = {
  retryEnabled: boolean;
  retryCount: number;
  retryDelay: number;
};
type Meta<TPayload = unknown> = { retryAttempts: number; payload?: TPayload; options: Options };

type MachineContext<TData, TError = Error, TPayload = unknown> = {
  response?: TData;
  error?: TError;
  _meta: Meta<TPayload>;
};

export type MachineEvents<TData, TError = Error, TPayload = unknown> =
  | { type: "FETCH"; payload: TPayload }
  | { type: "UPDATE"; update: (prev: TData) => TData }
  | { type: "REJECT" }
  | { type: "RESOLVE" }
  | DoneActorEvent<TData, "promise">
  | ErrorActorEvent<TError, "promise">;

export const createFetchMachine = <TData, TError = Error, TPayload = unknown>(id: string, options?: Options) => {
  type Events = MachineEvents<TData, TError, TPayload>;
  type Context = MachineContext<TData, TError, TPayload>;

  const initialOptions: Options = Object.assign({}, { retryCount: 3, retryEnabled: false, retryDelay: 1000 }, options);
  const initialMeta: Meta<TPayload> = { retryAttempts: 0, payload: undefined, options: initialOptions };

  return setup({
    types: {
      context: {} as Context,
      events: {} as Events,
    },
    actions: {
      onSuccess: (_, params: TData) => log.debug("onSuccess", params),
      onError: (_, params: TError) => log.error("onError", params),
      updateRetryAttepmts: ({ context }) => {
        return {
          ...context,
          _meta: { ...context._meta, retryAttempts: context._meta.retryAttempts + 1 },
        };
      },
    },
    actors: {
      promise: fromPromise<TData, TPayload, Events>(async ({ input }): Promise<TData> => {
        log.debug("promise", input);
        return Promise.resolve({} as TData);
      }),
    },
    delays: {
      retryDelay: ({ context }) => {
        return context._meta.options.retryDelay;
      },
    },
    guards: {
      canAttemptRetry: ({ context }) => {
        const { retryEnabled, retryCount } = context._meta.options;
        if (!retryEnabled) {
          return false;
        }
        return context._meta.retryAttempts < retryCount;
      },
    },
  }).createMachine({
    id: id,
    initial: "idle",
    context: { response: undefined, error: undefined, _meta: initialMeta },
    states: {
      idle: {
        on: {
          FETCH: {
            target: "pending.default",
            actions: assign({
              _meta: ({ event, context }) => {
                return { ...context._meta, payload: event.payload };
              },
            }),
          },
        },
      },
      pending: {
        initial: "default",
        states: {
          default: {
            invoke: {
              id: "promise",
              src: "promise",
              input: ({ event }) => {
                assertEvent(event, "FETCH");
                return event.payload;
              },
              onDone: {
                target: "done",
                actions: [
                  assign({
                    response: ({ event }) => {
                      // assertEvent(event, "xstate.done.actor.promise");
                      return event.output as TData;
                    },
                    error: undefined,
                  }),
                  {
                    type: "onSuccess",
                    params: ({ event }) => event.output,
                  },
                ],
              },
              onError: [
                {
                  target: "error",
                  guard: not("canAttemptRetry"),
                  actions: [
                    assign({
                      response: undefined,
                      error: ({ event }) => {
                        // assertEvent(event, "xstate.error.actor.promise");
                        return event.error as TError;
                      },
                    }),
                    {
                      type: "onError",
                      params: ({ event }) => event.error,
                    },
                  ],
                },
                {
                  guard: "canAttemptRetry",
                  target: "retry",
                },
              ],
            },
          },
          retry: {
            description: "Intermediate state to acheive delay in retry attemps",
            after: {
              retryDelay: {
                target: "default",
                actions: ["updateRetryAttepmts"],
              },
            },
          },
          done: {
            type: "final",
            output: { error: false },
          },
          error: {
            type: "final",
            output: { error: true },
          },
        },
        onDone: [
          {
            guard: ({ event }) => {
              assertEvent(event, `xstate.done.state.${id}.pending`);
              const isError = (event as DoneStateEvent<{ error: boolean }>).output.error;
              return !isError;
            },
            target: "resolved",
          },
          {
            guard: ({ event }) => {
              assertEvent(event, `xstate.done.state.${id}.pending`);
              const isError = (event as DoneStateEvent<{ error: boolean }>).output.error;
              return isError;
            },
            target: "rejected",
          },
        ],
      },
      resolved: {
        on: {
          FETCH: "pending.default",
          UPDATE: {
            actions: assign({
              response: ({ event, context }) => {
                log.info({ event, context });
                return event.update(context.response as TData);
              },
            }),
          },
        },
      },
      rejected: {
        description: "After all the retry attemps (if enabled), if still error persists, this state is entered.",
        on: {
          FETCH: {
            target: "pending.default",
            actions: ["updateRetryAttepmts"],
          },
        },
      },
    },
  });
};
