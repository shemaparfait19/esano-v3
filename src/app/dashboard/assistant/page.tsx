import { ChatAssistant } from '@/components/dashboard/chat-assistant';

export default function AssistantPage() {
  return (
    <div className="h-[calc(100vh-10rem)] flex flex-col">
      <div className="mb-8">
        <h1 className="font-headline text-3xl font-bold text-primary md:text-4xl">
          Genealogy Assistant
        </h1>
        <p className="mt-2 text-lg text-muted-foreground">
          Ask me anything about your results, genealogy research, or family history.
        </p>
      </div>
      <ChatAssistant />
    </div>
  );
}
