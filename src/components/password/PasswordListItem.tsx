
'use client';

import { useState } from 'react';
import type { PasswordEntry } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Eye, EyeOff, Copy, Edit2, Trash2, FolderKanban, EllipsisVertical, Check, Share2, Users } from 'lucide-react'; 
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';


interface PasswordListItemProps {
  entry: PasswordEntry;
  onEdit: (entry: PasswordEntry) => void;
  onDelete: (id: string) => void;
  onOpenShareDialog: (entry: PasswordEntry) => void; // Nova prop
  activeTab: string;
  currentUserId: string | undefined | null;
}

export function PasswordListItem({ entry, onEdit, onDelete, onOpenShareDialog, activeTab, currentUserId }: PasswordListItemProps) {
  const [showPassword, setShowPassword] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const { toast } = useToast();

  const handleCopy = (text: string | undefined, fieldNameForToast: string, fieldIdentifierForState: string) => {
    if (!text) {
      toast({ title: "Erro", description: "Nenhum valor para copiar.", variant: "destructive" });
      return;
    }
    navigator.clipboard.writeText(text)
      .then(() => {
        toast({ title: "Copiado!", description: `${fieldNameForToast} copiado para a área de transferência.` });
        setCopiedField(fieldIdentifierForState);
        setTimeout(() => setCopiedField(null), 1500);
      })
      .catch(err => {
        console.error("Failed to copy:", err);
        toast({ title: "Erro ao copiar", description: "Não foi possível copiar para a área de transferência.", variant: "destructive" });
      });
  };
  
  const shouldShowCategoryBadge = entry.categoria && (activeTab === 'Todas' || activeTab.toLowerCase() !== entry.categoria.toLowerCase());
  const isOwner = entry.ownerId === currentUserId;
  const canEdit = isOwner || entry.sharedWith?.some(s => s.userId === currentUserId && s.permission === 'full');
  const canDelete = isOwner || entry.sharedWith?.some(s => s.userId === currentUserId && s.permission === 'full');


  return (
    <Card className="mb-3 shadow-lg hover:shadow-xl transition-shadow duration-300 rounded-md">
      <CardHeader className="py-3 px-4 flex flex-row justify-between items-start gap-3">
        <div className="flex-grow min-w-0">
          <div className="flex items-start justify-between">
            <div className="min-w-0"> 
              <div className="flex items-center">
                <CardTitle className="font-headline text-lg text-primary truncate mr-1" title={entry.nome}>
                  {entry.nome}
                </CardTitle>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleCopy(entry.nome, "Nome", `nome-${entry.id}`)}
                  className={cn(
                    "h-6 w-6 shrink-0 transition-transform duration-150",
                    copiedField === `nome-${entry.id}`
                      ? 'scale-110 bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:text-foreground hover:bg-transparent'
                  )}
                  aria-label="Copiar Nome"
                >
                  {copiedField === `nome-${entry.id}` ? <Check size={14} /> : <Copy size={14} />}
                </Button>
              </div>
            </div>
          </div>
          <div className="flex items-center mt-0.5 space-x-2">
            {shouldShowCategoryBadge && (
              <div className="flex items-center">
                <Badge variant="secondary" className="text-xs py-0.5 px-1.5">
                  <FolderKanban size={12} className="mr-1"/> {entry.categoria}
                </Badge>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleCopy(entry.categoria, "Categoria", `categoria-${entry.id}`)}
                  className={cn(
                    "h-5 w-5 ml-1 shrink-0 transition-transform duration-150",
                    copiedField === `categoria-${entry.id}`
                      ? 'scale-110 bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:text-foreground hover:bg-transparent'
                  )}
                  aria-label="Copiar Categoria"
                >
                  {copiedField === `categoria-${entry.id}` ? <Check size={10} /> : <Copy size={10} />}
                </Button>
              </div>
            )}
            {entry.sharedWith && entry.sharedWith.length > 0 && (
                 <Badge variant={isOwner ? "outline" : "default"} className="text-xs py-0.5 px-1.5 cursor-default" title={`Compartilhado com ${entry.sharedWith.length} usuário(s)`}>
                    <Users size={12} className="mr-1"/> {entry.sharedWith.length}
                </Badge>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <AlertDialog>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-secondary">
                  <EllipsisVertical size={18} />
                  <span className="sr-only">Mais ações</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {canEdit && (
                  <DropdownMenuItem onClick={() => onEdit(entry)} className="cursor-pointer">
                    <Edit2 size={16} className="mr-2" />
                    Editar
                  </DropdownMenuItem>
                )}
                {isOwner && ( // Somente o proprietário pode iniciar o compartilhamento
                  <DropdownMenuItem onClick={() => onOpenShareDialog(entry)} className="cursor-pointer">
                    <Share2 size={16} className="mr-2" />
                    Compartilhar
                  </DropdownMenuItem>
                )}
                {(canEdit || isOwner) && <DropdownMenuSeparator />} 
                {canDelete && (
                  <AlertDialogTrigger asChild>
                    <DropdownMenuItem
                      className="text-destructive focus:text-destructive focus:bg-destructive/10 cursor-pointer"
                      onSelect={(e) => e.preventDefault()} 
                    >
                      <Trash2 size={16} className="mr-2" />
                      Deletar
                    </DropdownMenuItem>
                  </AlertDialogTrigger>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Você tem certeza?</AlertDialogTitle>
                <AlertDialogDescription>
                  Esta ação não pode ser desfeita. Isso marcará a senha de <strong className="font-semibold">{entry.nome}</strong> como excluída.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={() => onDelete(entry.id)} className="bg-destructive hover:bg-destructive/90">Confirmar Exclusão</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </CardHeader>

      <CardContent className="pt-2 pb-3 px-4">
        <div className="text-sm space-y-1.5">
          <div className="flex items-center">
            <strong className="text-foreground/70 font-medium w-12 shrink-0">Login:</strong>
            <span className="truncate flex-1" title={entry.login}>{entry.login}</span>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => handleCopy(entry.login, "Login", `login-${entry.id}`)}
              className={cn(
                "h-7 w-7 ml-1 shrink-0 transition-transform duration-150",
                copiedField === `login-${entry.id}`
                  ? 'scale-110 bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground hover:bg-transparent'
              )}
              aria-label="Copiar Login"
            >
              {copiedField === `login-${entry.id}` ? <Check size={14} /> : <Copy size={14} />}
            </Button>
          </div>
          <div className="flex items-center">
            <strong className="text-foreground/70 font-medium w-12 shrink-0">Senha:</strong>
            <span className="truncate flex-1 font-mono" title={showPassword ? entry.senha : 'Revelar senha'}>
              {showPassword ? (entry.senha || "N/A") : "••••••••"}
            </span>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setShowPassword(!showPassword)}
              className="h-7 w-7 ml-1 shrink-0 text-muted-foreground hover:text-foreground hover:bg-transparent"
              aria-label={showPassword ? "Esconder Senha" : "Mostrar Senha"}
            >
              {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => handleCopy(entry.senha, "Senha", `senha-${entry.id}`)}
              className={cn(
                "h-7 w-7 ml-1 shrink-0 transition-transform duration-150",
                copiedField === `senha-${entry.id}`
                  ? 'scale-110 bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground hover:bg-transparent'
              )}
              aria-label="Copiar Senha"
            >
              {copiedField === `senha-${entry.id}` ? <Check size={14} /> : <Copy size={14} />}
            </Button>
          </div>

          {entry.customFields && entry.customFields.length > 0 && (
            <div className="mt-3 pt-3 border-t border-border/80 space-y-1">
              {entry.customFields.map((field, index) => (
                <div key={index} className="flex items-center text-xs">
                  <strong className="text-foreground/70 font-medium w-24 shrink-0 truncate" title={field.label}>{field.label}:</strong>
                  <span className="text-foreground flex-1 break-all mr-1" title={field.value}>{field.value}</span>
                  <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleCopy(field.value, `Valor de "${field.label}"`, `customFieldValue-${entry.id}-${index}`)}
                      className={cn(
                        "h-6 w-6 shrink-0 transition-transform duration-150",
                        copiedField === `customFieldValue-${entry.id}-${index}`
                          ? 'scale-110 bg-primary text-primary-foreground'
                          : 'text-muted-foreground hover:text-foreground hover:bg-transparent'
                      )}
                      aria-label={`Copiar valor do campo ${field.label}`}
                    >
                      {copiedField === `customFieldValue-${entry.id}-${index}` ? <Check size={12} /> : <Copy size={12} />}
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
