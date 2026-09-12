import { useState, type FormEvent } from 'react';

export type ProjectConversationProps = {
  designerName: string;
  onSubmit: (message: string) => void;
  disabled?: boolean;
};

export const ProjectConversation = ({ designerName, onSubmit, disabled = false }: ProjectConversationProps) => {
  const [message, setMessage] = useState('');
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const value = message.trim();
    if (!value || disabled) return;
    onSubmit(value);
    setMessage('');
  };
  return (
    <form className="project-conversation" onSubmit={submit} aria-label="Project conversation">
      <p>Chat with {designerName}</p>
      <textarea value={message} onChange={(event) => setMessage(event.target.value)} disabled={disabled} rows={3} />
      <button type="submit" disabled={disabled || !message.trim()}>Send</button>
    </form>
  );
};
