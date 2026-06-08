import { format } from 'date-fns';
import { cn } from '@/lib/cn';
import type { Message } from '@/lib/types';

export function ConversationTimeline({ messages }: { messages: Message[] }) {
  if (messages.length === 0) {
    return <p className="text-sm text-slate-400 py-4 text-center">No messages yet.</p>;
  }

  return (
    <div className="flex flex-col gap-3 py-2">
      {messages.map((msg) => {
        const isLead = msg.role === 'lead';
        return (
          <div key={msg.id} className={cn('flex', isLead ? 'justify-start' : 'justify-end')}>
            <div
              className={cn(
                'max-w-[80%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed',
                isLead
                  ? 'bg-slate-100 text-slate-800 rounded-tl-sm'
                  : 'bg-blue-600 text-white rounded-tr-sm',
              )}
            >
              <p className="whitespace-pre-wrap">{msg.body}</p>
              <p className={cn('text-[10px] mt-1', isLead ? 'text-slate-400' : 'text-blue-200')}>
                {format(new Date(msg.createdAt), 'HH:mm')}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
