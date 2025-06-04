
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
  const filteredPasswords = passwords.filter(p => {
    const lowerSearchTerm = searchTerm.toLowerCase();
    if (p.nome.toLowerCase().includes(lowerSearchTerm)) return true;
    if (p.login.toLowerCase().includes(lowerSearchTerm)) return true;
    if (p.categoria && p.categoria.toLowerCase().includes(lowerSearchTerm)) return true; // Pesquisa na categoria
    if (p.customFields) {
      for (const field of p.customFields) {
        if (field.label.toLowerCase().includes(lowerSearchTerm)) return true;
        if (field.value.toLowerCase().includes(lowerSearchTerm)) return true;
      }
    }
    return false;
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[...Array(3)].map((_, i) => (
          <Card key={i} className="mb-4">
            <CardHeader>
              <Skeleton className="h-6 w-3/4" />
              <Skeleton className="h-4 w-1/4 mt-1" /> 
            </CardHeader>
            <CardContent className="space-y-3 pt-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-2/3" />
              <div className="flex justify-end gap-2 mt-2">
                <Skeleton className="h-7 w-16" />
                <Skeleton className="h-7 w-20" />
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
