import { useSelector, useActorRef } from "@xstate/react";
import { ActorRef } from "xstate";
import { Table, TableHeader, Row, Column } from "../ui/Table";
import { Checkbox } from "../ui/Checkbox";
import { selectTodoById, selectTodoIds } from "../../selectors/todos";
import { updateTodoMachine } from "../../services/todo";
import { TableBody } from "react-aria-components";

interface TodosTableProps {
  todosRef: ActorRef<any>;
}

interface TodoRowProps {
  todoId: string;
  todosRef: ActorRef<any>;
}

const TodoRow = ({ todoId, todosRef }: TodoRowProps) => {
  const todo = useSelector(todosRef, (state) => selectTodoById(state, todoId));
  const updateRef = useActorRef(updateTodoMachine.provide({
    actions: {
        onSuccess: () => {

    // Refetch todos after update
    todosRef.send({ type: "FETCH" });
        },
    }
  }));

  if (!todo) return null;

  const handleToggle = () => {
    updateRef.send({
      type: "FETCH",
      payload: {
        ...todo,
        isCompleted: !todo.isCompleted,
        completedOn: !todo.isCompleted ? new Date().toISOString() : null
      }
    });
  };

  return (
    <Row>
      <Column>
        <Checkbox
          isSelected={todo.isCompleted}
          onChange={handleToggle}
        />
      </Column>
      <Column>{todo.title}</Column>
      <Column>{todo.isCompleted ? "Completed" : "Pending"}</Column>
    </Row>
  );
};

export const TodosTable = ({ todosRef }: TodosTableProps) => {
  const todoIds = useSelector(todosRef, selectTodoIds);
  console.log({todoIds});

  return (
    <Table aria-label="Todos">
      <TableHeader>
        <Column isRowHeader>Complete</Column>
        <Column>Title</Column>
        <Column>Status</Column>
      </TableHeader>
      <TableBody>
      {todoIds.map((id) => (
        <TodoRow 
          key={id}
          todoId={id}
          todosRef={todosRef}
        />
      ))}
    </TableBody>
    </Table>
  );
};