import { KeyRound } from 'lucide-react';

export function Header() {
  return (
    <header className="bg-primary text-primary-foreground py-4 shadow-md">
      <div className="container mx-auto flex items-center gap-3">
        <KeyRound size={32} />
        <h1 className="text-3xl font-headline font-bold">SenhaFacil</h1>
      </div>
    </header>
  );
}
