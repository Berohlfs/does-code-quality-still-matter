import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";

interface AuthCardProps {
  description: string;
  children: React.ReactNode;
  footer: React.ReactNode;
}

export function AuthCard({ description, children, footer }: AuthCardProps) {
  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <div className="mx-auto mb-2 flex h-9 w-9 items-center justify-center rounded-lg bg-linear-to-br from-indigo-500 to-purple-400 text-sm font-bold text-white">
            T
          </div>
          <CardTitle className="text-xl font-extrabold tracking-tight">
            Taskflow
          </CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent>
          {children}
          <div className="mt-5 text-center text-sm text-muted-foreground">
            {footer}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
