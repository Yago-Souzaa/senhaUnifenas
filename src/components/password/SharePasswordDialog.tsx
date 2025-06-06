
'use client';

import { useState, useEffect } from 'react';
import type { PasswordEntry, SharedUser, Group } from '@/types';
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
import { UserPlus, Users, ListChecks, Trash2, AlertCircle, KeyRound, ShieldCheck, CheckCircle2, XCircle } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';


interface SharePasswordDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  passwordEntry: PasswordEntry | null;
  currentUserId: string | undefined | null;
  userGroups: Group[]; // Groups the current user owns or is a member of
  onSharePassword: (passwordId: string, userIdToShareWith: string, permission: 'read' | 'full') => Promise<SharedUser[] | undefined>;
  onUpdateShare: (passwordId: string, sharedUserId: string, permission: 'read' | 'full') => Promise<SharedUser[] | undefined>;
  onRemoveShare: (passwordId: string, sharedUserId: string) => Promise<SharedUser[] | undefined>;
  onShareWithGroup: (passwordId: string, groupId: string) => Promise<string[] | undefined>;
  onUnshareFromGroup: (passwordId: string, groupId: string) => Promise<string[] | undefined>;
}

export function SharePasswordDialog({
  isOpen,
  onOpenChange,
  passwordEntry,
  currentUserId,
  userGroups,
  onSharePassword,
  onUpdateShare,
  onRemoveShare,
  onShareWithGroup,
  onUnshareFromGroup,
}: SharePasswordDialogProps) {
  const [userIdToShareWith, setUserIdToShareWith] = useState('');
  const [permission, setPermission] = useState<'read' | 'full'>('read');
  const [selectedGroupId, setSelectedGroupId] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { toast } = useToast();

  useEffect(() => {
    if (isOpen) {
      setUserIdToShareWith('');
      setPermission('read');
      setSelectedGroupId('');
      setIsSubmitting(false);
    }
  }, [isOpen, passwordEntry]);

  if (!passwordEntry) return null;

  const effectiveOwnerId = passwordEntry.ownerId || passwordEntry.userId;
  const isOwner = !!currentUserId && effectiveOwnerId === currentUserId;

  const handleAddShare = async () => {
    if (!userIdToShareWith.trim()) {
      toast({ title: "Entrada Inválida", description: "Por favor, insira o ID do usuário (Firebase UID) para compartilhar.", variant: "destructive" });
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
      toast({ title: "Sucesso!", description: `Senha compartilhada com o usuário.` });
      setUserIdToShareWith(''); 
      setPermission('read');
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
      toast({ title: "Permissão Atualizada", description: `Permissão para o usuário atualizada.` });
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
      toast({ title: "Compartilhamento Removido", description: `Compartilhamento com o usuário removido.` });
    } catch (error: any) {
      toast({ title: "Erro ao Remover", description: error.message || "Não foi possível remover o compartilhamento.", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleShareWithGroup = async () => {
    if (!selectedGroupId) {
      toast({ title: "Nenhum Grupo Selecionado", description: "Por favor, selecione um grupo para compartilhar.", variant: "destructive" });
      return;
    }
    setIsSubmitting(true);
    try {
      await onShareWithGroup(passwordEntry.id, selectedGroupId);
      toast({ title: "Sucesso!", description: "Senha compartilhada com o grupo." });
      setSelectedGroupId(''); // Reset selection
    } catch (error: any) {
      toast({ title: "Erro ao Compartilhar com Grupo", description: error.message || "Não foi possível compartilhar com o grupo.", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUnshareFromGroup = async (groupIdToRemove: string) => {
    setIsSubmitting(true);
    try {
      await onUnshareFromGroup(passwordEntry.id, groupIdToRemove);
      toast({ title: "Sucesso!", description: "Compartilhamento com o grupo removido." });
    } catch (error: any) {
      toast({ title: "Erro ao Remover Compartilhamento de Grupo", description: error.message || "Não foi possível remover o compartilhamento.", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };
  
  const getPermissionDisplay = (perm: 'read' | 'full') => {
    return perm === 'full' ? 'Total (Editar/Excluir)' : 'Leitura';
  };

  const getSharedByDisplay = (sharedBy?: string) => {
    if (!sharedBy) return 'N/A';
    if (sharedBy === currentUserId) return 'Você';
    return `UID: ...${sharedBy.slice(-6)}`;
  }

  const hasDirectShares = passwordEntry.sharedWith && passwordEntry.sharedWith.length > 0;
  const hasGroupShares = passwordEntry.sharedWithGroupIds && passwordEntry.sharedWithGroupIds.length > 0;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!isSubmitting) onOpenChange(open); }}>
      <DialogContent className="sm:max-w-lg md:max-w-xl bg-card max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="font-headline text-primary flex items-center gap-2">
            <Users size={22}/> Compartilhar Senha
          </DialogTitle>
          <DialogDescription>
            <span className="font-semibold">"{passwordEntry.nome}"</span>
            <br />
            {isOwner
              ? "Gerencie com quem esta senha é compartilhada (individualmente ou com grupos)."
              : "Você tem acesso a esta senha porque ela foi compartilhada com você ou com um grupo do qual você faz parte."}
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-grow pr-3 -mr-3 my-2 text-sm">
          <div className="space-y-6 py-2">
            {isOwner && (
              <>
                <div className="p-4 border rounded-md bg-muted/30 space-y-3">
                  <h3 className="text-md font-semibold text-foreground flex items-center gap-2"><UserPlus size={18}/>Compartilhar com Usuário Individual</h3>
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
                    <p className="text-xs text-muted-foreground mt-1">
                      Peça ao usuário para fornecer o UID do Firebase dele.
                    </p>
                  </div>
                  <div>
                    <Label htmlFor="permission" className="text-xs">Permissão Individual</Label>
                    <Select value={permission} onValueChange={(value: 'read' | 'full') => setPermission(value)} disabled={isSubmitting}>
                      <SelectTrigger id="permission" className="mt-1 h-9">
                        <SelectValue placeholder="Selecione a permissão" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="read">Leitura (Pode ver a senha)</SelectItem>
                        <SelectItem value="full">Total (Ver, Editar, Excluir)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <Button onClick={handleAddShare} className="w-full bg-accent hover:bg-accent/90 text-accent-foreground" disabled={isSubmitting || !userIdToShareWith.trim()}>
                    {isSubmitting ? "Adicionando Usuário..." : "Adicionar Usuário"}
                  </Button>
                </div>

                <div className="p-4 border rounded-md bg-muted/30 space-y-3">
                  <h3 className="text-md font-semibold text-foreground flex items-center gap-2"><ShieldCheck size={18}/>Compartilhar com Grupo</h3>
                  {userGroups.length > 0 ? (
                    <>
                    <div>
                        <Label htmlFor="groupIdToShareWith" className="text-xs">Grupo</Label>
                        <Select value={selectedGroupId} onValueChange={setSelectedGroupId} disabled={isSubmitting}>
                        <SelectTrigger id="groupIdToShareWith" className="mt-1 h-9">
                            <SelectValue placeholder="Selecione um grupo" />
                        </SelectTrigger>
                        <SelectContent>
                            {userGroups.map(group => (
                            <SelectItem key={group.id} value={group.id} disabled={passwordEntry.sharedWithGroupIds?.includes(group.id)}>
                                {group.name} {passwordEntry.sharedWithGroupIds?.includes(group.id) && "(Já compartilhado)"}
                            </SelectItem>
                            ))}
                        </SelectContent>
                        </Select>
                    </div>
                    <Button onClick={handleShareWithGroup} className="w-full bg-accent hover:bg-accent/90 text-accent-foreground" disabled={isSubmitting || !selectedGroupId || passwordEntry.sharedWithGroupIds?.includes(selectedGroupId)}>
                        {isSubmitting ? "Compartilhando com Grupo..." : "Compartilhar com Grupo Selecionado"}
                    </Button>
                    </>
                  ) : (
                    <p className="text-xs text-muted-foreground p-2 bg-background/50 rounded-md">Você não possui ou não é membro de nenhum grupo para compartilhar.</p>
                  )}
                </div>
                <Separator />
              </>
            )}

            <div className="space-y-3">
              <h3 className="text-md font-semibold text-foreground flex items-center gap-2"><ListChecks size={18}/>Gerenciar Compartilhamentos Atuais</h3>
              {!hasDirectShares && !hasGroupShares ? (
                <p className="text-xs text-muted-foreground p-3 bg-muted/20 rounded-md flex items-center gap-2">
                  <AlertCircle size={16} /> Esta senha ainda não foi compartilhada.
                </p>
              ) : null}

              {hasDirectShares && (
                <>
                <h4 className="text-sm font-medium text-muted-foreground pt-2">Usuários Individuais:</h4>
                <ul className="space-y-2">
                  {passwordEntry.sharedWith?.map((share) => (
                    <li key={share.userId} className="p-3 border rounded-md bg-background flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                      <div className="flex-grow min-w-0">
                        <p className="text-sm font-medium text-foreground truncate flex items-center gap-1.5" title={share.userId}>
                          <KeyRound size={14} className="text-muted-foreground shrink-0" />
                          UID: <span className="font-mono text-xs bg-muted px-1 py-0.5 rounded">...{share.userId.slice(-12)}</span>
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          por {getSharedByDisplay(share.sharedBy)} em {share.sharedAt ? new Date(share.sharedAt).toLocaleDateString() : 'N/A'}
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
                              <SelectTrigger className="h-8 text-xs w-[160px]">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="read">{getPermissionDisplay('read')}</SelectItem>
                                <SelectItem value="full">{getPermissionDisplay('full')}</SelectItem>
                              </SelectContent>
                            </Select>
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              onClick={() => handleRemoveExistingShare(share.userId)} 
                              className="text-destructive hover:bg-destructive/10 hover:text-destructive h-8 w-8"
                              disabled={isSubmitting}
                              aria-label="Remover compartilhamento com usuário"
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
                </>
              )}
              {hasGroupShares && (
                 <>
                <h4 className="text-sm font-medium text-muted-foreground pt-2">Grupos:</h4>
                <ul className="space-y-2">
                  {passwordEntry.sharedWithGroupIds?.map((gid) => {
                    const group = userGroups.find(ug => ug.id === gid) || { id: gid, name: `Grupo (ID: ...${gid.slice(-6)})`}; // Fallback display
                    return (
                      <li key={gid} className="p-3 border rounded-md bg-background flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                        <div className="flex-grow min-w-0">
                          <p className="text-sm font-medium text-foreground truncate flex items-center gap-1.5">
                            <ShieldCheck size={14} className="text-muted-foreground shrink-0" />
                            {group.name}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0 mt-2 sm:mt-0">
                          {isOwner ? (
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              onClick={() => handleUnshareFromGroup(gid)} 
                              className="text-destructive hover:bg-destructive/10 hover:text-destructive h-8 w-8"
                              disabled={isSubmitting}
                              aria-label={`Remover compartilhamento com grupo ${group.name}`}
                            >
                              <XCircle size={16} />
                            </Button>
                          ) : (
                            <Badge variant="outline" className="text-xs">Membro do Grupo</Badge>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
                </>
              )}
            </div>
          </div>
        </ScrollArea>

        <DialogFooter className="mt-auto pt-4 sticky bottom-0 bg-card border-t">
          <DialogClose asChild>
            <Button type="button" variant="outline" disabled={isSubmitting}>remover</Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

