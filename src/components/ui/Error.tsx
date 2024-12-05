import { useSelector } from '@xstate/react';
import { ActorRef } from 'xstate';

interface ErrorProps {
  fetchRef: ActorRef<any>;
}

export const Error = ({ fetchRef }: ErrorProps) => {
  const error = useSelector(fetchRef, state => state.context.error);

  return (
    <div role="alert" className="error-container">
      <p className="error-message">{error?.message ?? 'An error occurred'}</p>
      <button 
        onClick={() => fetchRef.send({ type: 'FETCH' })}
        className="error-retry-button"
      >
        Retry
      </button>
    </div>
  );
};
