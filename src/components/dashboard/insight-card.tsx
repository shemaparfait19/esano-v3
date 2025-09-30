import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { ReactNode } from 'react';

type InsightCardProps = {
  icon: ReactNode;
  title: string;
  content: string;
};

export function InsightCard({ icon, title, content }: InsightCardProps) {
  return (
    <Card className="flex flex-col">
      <CardHeader>
        <div className="flex items-center gap-4">
          <div className="bg-primary/10 p-3 rounded-lg">
            {icon}
          </div>
          <CardTitle className="font-headline text-xl text-primary">{title}</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="flex-grow">
        <p className="text-foreground/80 whitespace-pre-wrap">{content}</p>
      </CardContent>
    </Card>
  );
}
