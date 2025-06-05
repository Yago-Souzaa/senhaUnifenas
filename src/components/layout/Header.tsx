
import type { FirebaseUser } from '@/types';
import { KeyRound, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface HeaderProps {
  user: FirebaseUser | null;
  onLogout?: () => void; // Tornar opcional, pode não haver logout em todas as telas
}

export function Header({ user, onLogout }: HeaderProps) {
  return (
    <header className="bg-primary text-primary-foreground py-3 shadow-md">
      <div className="container mx-auto flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <KeyRound size={32} />
          <h1 className="text-3xl font-headline font-bold">SenhaFacil</h1>
        </div>
        {user && onLogout && (
          <div className="flex items-center gap-3">
            <span className="text-sm hidden sm:inline">{user.email}</span>
            <Button variant="ghost" size="sm" onClick={onLogout} className="hover:bg-primary/80 text-primary-foreground">
              <LogOut size={18} className="mr-1 sm:mr-2" />
              Sair
            </Button>
          </div>
        )}
      </div>
    </header>
  );
}
