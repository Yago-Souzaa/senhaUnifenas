
'use client';

import type { PasswordEntry } from '@/types';
import { PasswordListItem } from './PasswordListItem';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertTriangle, FolderOpen } from 'lucide-react';
import { Card, CardHeader, CardContent } from '@/components/ui/card';

interface PasswordListProps {
  passwords: PasswordEntry[]; // This list is ALREADY filtered by activeTab and searchTerm from HomePage
  isLoading: boolean;
  onEdit: (entry: PasswordEntry) => void;
  onDelete: (id: string) => void;
  searchTerm: string; // The global search term from HomePage, used for contextual messages
  activeTab: string; // The active category tab from HomePage, used for contextual messages
}

export function PasswordList({ passwords, isLoading, onEdit, onDelete, searchTerm, activeTab }: PasswordListProps) {
  // The 'passwords' prop is already filtered by activeTab (category) AND searchTerm
  // No need to re-filter here.

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

  if (passwords.length === 0) {
    if (searchTerm) {
      // No results for the current search term within the active category (or "Todas")
      return (
        <div className="text-center py-10">
          <AlertTriangle size={48} className="mx-auto text-muted-foreground mb-4" />
          <h3 className="text-xl font-semibold text-muted-foreground font-headline">Nenhum resultado encontrado.</h3>
          <p className="text-muted-foreground">
            Não há senhas para o termo "{searchTerm}" {activeTab !== 'Todas' ? `na categoria "${activeTab}"` : ''}.
            Tente um termo de busca diferente.
          </p>
        </div>
      );
    } else {
      // No search term, and no passwords in the current active category (or "Todas" if it's empty)
      return (
        <div className="text-center py-10">
          <FolderOpen size={48} className="mx-auto text-muted-foreground mb-4" />
          <h3 className="text-xl font-semibold text-muted-foreground font-headline">
            {activeTab === 'Todas' ? 'Nenhuma senha armazenada.' : `Nenhuma senha na categoria "${activeTab}".`}
          </h3>
          <p className="text-muted-foreground">
            {activeTab === 'Todas' 
              ? 'Comece adicionando uma nova senha ou importando de uma planilha.'
              : `Adicione uma nova senha a esta categoria ou importe senhas.`}
          </p>
        </div>
      );
    }
  }

  return (
    <div className="space-y-4">
      {passwords.map(entry => (
        <PasswordListItem key={entry.id} entry={entry} onEdit={onEdit} onDelete={onDelete} />
      ))}
    </div>
  );
}
