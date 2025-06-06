
'use client';

import { useState, useEffect } from 'react';
import type { PasswordEntry, SharedUser } from '@/types';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogClose,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { UserPlus, Users, ListChecks, Edit3, Trash2, AlertCircle } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';

interface SharePasswordDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  passwordEntry: PasswordEntry | null;
  currentUserId: string | undefined | null;
  onSharePassword: (passwordId: string, userIdToShareWith: string, permission: 'read' | 'full') => Promise<SharedUser[] | undefined>;
  onUpdateShare: (passwordId: string, sharedUserId: string, permission: 'read' | 'full') => Promise<SharedUser[] | undefined>;
  onRemoveShare: (passwordId: string, sharedUserId: string) => Promise<SharedUser[] | undefined>;
}

export function SharePasswordDialog({
  isOpen,
  onOpenChange,
  passwordEntry,
  currentUserId,
  onSharePassword,
  onUpdateShare,
  onRemoveShare,
}: SharePasswordDialogProps) {
  const [userIdToShareWith, setUserIdToShareWith] = useState('');
  const [permission, setPermission] = useState<'read' | 'full'>('read');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { toast } = useToast();

  useEffect(() => {
    // Reset form when dialog opens or passwordEntry changes
    if (isOpen) {
      setUserIdToShareWith('');
      setPermission('read');
      setIsSubmitting(false);
    }
  }, [isOpen, passwordEntry]);

  if (!passwordEntry) return null;

  const isOwner = passwordEntry.ownerId === currentUserId;

  const handleAddShare = async () => {
    if (!userIdToShareWith.trim()) {
      toast({ title: "Entrada Inválida", description: "Por favor, insira o ID do usuário para compartilhar.", variant: "destructive" });
      return;
    }
    if (userIdToShareWith.trim() === currentUserId) {
      toast({ title: "Ação Não Permitida", description: "Você não pode compartilhar uma senha consigo mesmo.", variant: "destructive" });
      return;
    }
    if (passwordEntry.sharedWith?.some(s => s.userId === userIdToShareWith.trim())) {
      toast({ title: "Já Compartilhado", description: "Esta senha já está compartilhada com este usuário. Edite a permissão existente se necessário.", variant: "default" });
      return;
    }

    setIsSubmitting(true);
    try {
      await onSharePassword(passwordEntry.id, userIdToShareWith.trim(), permission);
      toast({ title: "Sucesso!", description: `Senha compartilhada com ${userIdToShareWith.trim()}.` });
      setUserIdToShareWith(''); // Clear input
    } catch (error: any) {
      toast({ title: "Erro ao Compartilhar", description: error.message || "Não foi possível adicionar o compartilhamento.", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateExistingShare = async (sharedUser: SharedUser, newPermission: 'read' | 'full') => {
    if (sharedUser.permission === newPermission) return;
    setIsSubmitting(true);
    try {
      await onUpdateShare(passwordEntry.id, sharedUser.userId, newPermission);
      toast({ title: "Permissão Atualizada", description: `Permissão para ${sharedUser.userId} atualizada.` });
    } catch (error: any) {
      toast({ title: "Erro ao Atualizar", description: error.message || "Não foi possível atualizar a permissão.", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRemoveExistingShare = async (sharedUserIdToRemove: string) => {
    setIsSubmitting(true);
    try {
      await onRemoveShare(passwordEntry.id, sharedUserIdToRemove);
      toast({ title: "Compartilhamento Removido", description: `Compartilhamento com ${sharedUserIdToRemove} removido.` });
    } catch (error: any) {
      toast({ title: "Erro ao Remover", description: error.message || "Não foi possível remover o compartilhamento.", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };
  
  const getPermissionDisplay = (perm: 'read' | 'full') => {
    return perm === 'full' ? 'Total' : 'Leitura';
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!isSubmitting) onOpenChange(open); }}>
      <DialogContent className="sm:max-w-lg md:max-w-xl bg-card max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="font-headline text-primary flex items-center gap-2">
            <Users size={22}/> Compartilhar Senha
          </DialogTitle>
          <DialogDescription>
            "{passwordEntry.nome}"<br />
            {isOwner
              ? "Gerencie com quem esta senha é compartilhada. O ID do usuário geralmente é o UID do Firebase."
              : "Você tem acesso a esta senha porque ela foi compartilhada com você."}
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-grow pr-3 -mr-3 my-2 text-sm">
          <div className="space-y-6 py-2">
            {isOwner && (
              <div className="p-4 border rounded-md bg-muted/30 space-y-3">
                <h3 className="text-md font-semibold text-foreground flex items-center gap-2"><UserPlus size={18}/>Convidar Novo Usuário</h3>
                <div>
                  <Label htmlFor="userIdToShareWith" className="text-xs">ID do Usuário (Firebase UID)</Label>
                  <Input
                    id="userIdToShareWith"
                    placeholder="Cole o Firebase UID do usuário aqui"
                    value={userIdToShareWith}
                    onChange={(e) => setUserIdToShareWith(e.target.value)}
                    className="mt-1 h-9"
                    disabled={isSubmitting}
                  />
                </div>
                <div>
                  <Label htmlFor="permission" className="text-xs">Permissão</Label>
                  <Select value={permission} onValueChange={(value: 'read' | 'full') => setPermission(value)} disabled={isSubmitting}>
                    <SelectTrigger id="permission" className="mt-1 h-9">
                      <SelectValue placeholder="Selecione a permissão" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="read">Leitura (Pode ver a senha)</SelectItem>
                      <SelectItem value="full">Total (Ver, Editar, Excluir, Recompartilhar)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button onClick={handleAddShare} className="w-full bg-accent hover:bg-accent/90 text-accent-foreground" disabled={isSubmitting || !userIdToShareWith.trim()}>
                  {isSubmitting ? "Adicionando..." : "Adicionar Compartilhamento"}
                </Button>
              </div>
            )}

            <div className="space-y-3">
              <h3 className="text-md font-semibold text-foreground flex items-center gap-2"><ListChecks size={18}/>Gerenciar Compartilhamentos Atuais</h3>
              {(!passwordEntry.sharedWith || passwordEntry.sharedWith.length === 0) ? (
                <p className="text-xs text-muted-foreground p-3 bg-muted/20 rounded-md flex items-center gap-2">
                  <AlertCircle size={16} /> Esta senha ainda não foi compartilhada com outros usuários.
                </p>
              ) : (
                <ul className="space-y-2">
                  {passwordEntry.sharedWith.map((share) => (
                    <li key={share.userId} className="p-3 border rounded-md bg-background flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                      <div className="flex-grow min-w-0">
                        <p className="text-sm font-medium text-foreground truncate" title={share.userId}>
                          {share.userId}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          por {share.sharedBy === currentUserId ? "Você" : (share.sharedBy || 'N/A')} em {share.sharedAt ? new Date(share.sharedAt).toLocaleDateString() : 'N/A'}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0 mt-2 sm:mt-0">
                        {isOwner ? (
                          <>
                            <Select
                              value={share.permission}
                              onValueChange={(newPerm: 'read' | 'full') => handleUpdateExistingShare(share, newPerm)}
                              disabled={isSubmitting}
                            >
                              <SelectTrigger className="h-8 text-xs w-[100px]">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="read">Leitura</SelectItem>
                                <SelectItem value="full">Total</SelectItem>
                              </SelectContent>
                            </Select>
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              onClick={() => handleRemoveExistingShare(share.userId)} 
                              className="text-destructive hover:bg-destructive/10 hover:text-destructive h-8 w-8"
                              disabled={isSubmitting}
                              aria-label="Remover compartilhamento"
                            >
                              <Trash2 size={16} />
                            </Button>
                          </>
                        ) : (
                           <Badge variant={share.permission === 'full' ? 'default' : 'secondary'} className="text-xs">
                             {getPermissionDisplay(share.permission)}
                           </Badge>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </ScrollArea>

        <DialogFooter className="mt-auto pt-4 sticky bottom-0 bg-card border-t">
          <DialogClose asChild>
            <Button type="button" variant="outline" disabled={isSubmitting}>Fechar</Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
