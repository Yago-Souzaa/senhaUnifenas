
import type { FirebaseUser } from '@/types';
import { KeyRound, LogOut, Settings } from 'lucide-react'; // Importado Settings
import { Button } from '@/components/ui/button';
import Link from 'next/link'; // Importado Link

interface HeaderProps {
  user: FirebaseUser | null;
  onLogout?: () => void;
}

export function Header({ user, onLogout }: HeaderProps) {
  return (
    <header className="bg-primary text-primary-foreground py-3 shadow-md">
      <div className="container mx-auto flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <KeyRound size={32} />
          <h1 className="text-3xl font-headline font-bold">SenhaFacil</h1>
        </div>
        {user && ( // Modificado para agrupar lógica do usuário
          <div className="flex items-center gap-2 sm:gap-3">
            <span className="text-sm hidden sm:inline">{user.email}</span>
            
            <Button variant="ghost" size="icon" asChild className="hover:bg-primary/80 text-primary-foreground h-8 w-8 sm:h-9 sm:w-9">
              <Link href="/settings" title="Configurações da Conta">
                <Settings size={18} />
                <span className="sr-only">Config.</span>
              </Link>
            </Button>

            {onLogout && (
              <Button variant="ghost" size="sm" onClick={onLogout} className="hover:bg-primary/80 text-primary-foreground h-8 px-2 sm:h-9 sm:px-3">
                <LogOut size={18} className="mr-1 sm:mr-2" />
                Sair
              </Button>
            )}
          </div>
        )}
      </div>
    </header>
  );
}
