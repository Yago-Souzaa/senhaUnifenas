'use client';

import type { PasswordEntry } from '@/types';
import { PasswordListItem } from './PasswordListItem';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertTriangle } from 'lucide-react';
import { Card, CardHeader, CardContent } from '@/components/ui/card';

interface PasswordListProps {
  passwords: PasswordEntry[];
  isLoading: boolean;
  onEdit: (entry: PasswordEntry) => void;
  onDelete: (id: string) => void;
  searchTerm: string;
}

export function PasswordList({ passwords, isLoading, onEdit, onDelete, searchTerm }: PasswordListProps) {
  const filteredPasswords = passwords.filter(p =>
    p.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.login.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (p.ip && p.ip.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (p.funcao && p.funcao.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (p.acesso && p.acesso.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[...Array(3)].map((_, i) => (
          <Card key={i} className="mb-4">
            <CardHeader>
              <Skeleton className="h-6 w-3/4" />
              <Skeleton className="h-4 w-1/2 mt-1" />
            </CardHeader>
            <CardContent className="space-y-3">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <div className="flex justify-end gap-2 mt-4">
                <Skeleton className="h-8 w-20" />
                <Skeleton className="h-8 w-20" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (passwords.length === 0 && !searchTerm) {
    return (
      <div className="text-center py-10">
        <AlertTriangle size={48} className="mx-auto text-muted-foreground mb-4" />
        <h3 className="text-xl font-semibold text-muted-foreground font-headline">Nenhuma senha armazenada.</h3>
        <p className="text-muted-foreground">Comece adicionando uma nova senha ou importando de uma planilha.</p>
      </div>
    );
  }
  
  if (filteredPasswords.length === 0 && searchTerm) {
    return (
      <div className="text-center py-10">
        <AlertTriangle size={48} className="mx-auto text-muted-foreground mb-4" />
        <h3 className="text-xl font-semibold text-muted-foreground font-headline">Nenhum resultado encontrado.</h3>
        <p className="text-muted-foreground">Tente um termo de busca diferente.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {filteredPasswords.map(entry => (
        <PasswordListItem key={entry.id} entry={entry} onEdit={onEdit} onDelete={onDelete} />
      ))}
    </div>
  );
}
