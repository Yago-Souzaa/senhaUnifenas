
import type { FirebaseUser } from '@/types';
import { KeyRound, LogOut, Settings, UserCircle, Users } from 'lucide-react'; // Importado Users
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface HeaderProps {
  user: FirebaseUser | null;
  onLogout?: () => void;
}

export function Header({ user, onLogout }: HeaderProps) {
  return (
    <header className="bg-primary text-primary-foreground py-3 shadow-md">
      <div className="container mx-auto flex items-center justify-between gap-3">
        <Link href="/" className="flex items-center gap-3 hover:opacity-90 transition-opacity">
          <KeyRound size={32} />
          <h1 className="text-3xl font-headline font-bold">SenhaFacil</h1>
        </Link>
        {user && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="rounded-full hover:bg-primary/80 text-primary-foreground h-9 w-9 sm:h-10 sm:w-10">
                <UserCircle size={28} />
                <span className="sr-only">Abrir menu do usuário</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel className="font-normal">
                <div className="flex flex-col space-y-1">
                  <p className="text-sm font-medium leading-none">Logado como</p>
                  <p className="text-xs leading-none text-muted-foreground truncate">
                    {user.email}
                  </p>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link href="/groups" className="cursor-pointer">
                  <Users size={16} className="mr-2" />
                  Meus Grupos
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/settings" className="cursor-pointer">
                  <Settings size={16} className="mr-2" />
                  Configurações
                </Link>
              </DropdownMenuItem>
              {onLogout && (
                <DropdownMenuItem onClick={onLogout} className="cursor-pointer">
                  <LogOut size={16} className="mr-2" />
                  Sair
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    </header>
  );
}
