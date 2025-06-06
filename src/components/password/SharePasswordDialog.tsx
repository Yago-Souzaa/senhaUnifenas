
'use client';

import { useState, useEffect } from 'react';
import type { PasswordEntry, Group } from '@/types'; // Removed SharedUser as it's deprecated for this dialog
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
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
import { Users, ListChecks, ShieldCheck, AlertCircle, KeyRound, XCircle } from 'lucide-react'; // UserPlus removed
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';

interface SharePasswordDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  passwordEntry: PasswordEntry | null;
  currentUserId: string | undefined | null;
  userGroups: Group[]; 
  // onSharePassword, onUpdateShare, onRemoveShare are removed
  onShareWithGroup: (passwordId: string, groupId: string) => Promise<string[] | undefined>;
  onUnshareFromGroup: (passwordId: string, groupId: string) => Promise<string[] | undefined>;
}

export function SharePasswordDialog({
  isOpen,
  onOpenChange,
  passwordEntry,
  currentUserId,
  userGroups,
  onShareWithGroup,
  onUnshareFromGroup,
}: SharePasswordDialogProps) {
  const [selectedGroupId, setSelectedGroupId] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { toast } = useToast();

  useEffect(() => {
    if (isOpen) {
      setSelectedGroupId('');
      setIsSubmitting(false);
    }
  }, [isOpen, passwordEntry]);

  if (!passwordEntry) return null;

  const effectiveOwnerId = passwordEntry.ownerId || passwordEntry.userId;
  const isPasswordOwner = !!currentUserId && effectiveOwnerId === currentUserId;

  // Determine if current user is an admin of any group this password is shared with
  const isCurrentUserAdminOfAnySharedGroup = passwordEntry.sharedWithGroupIds?.some(gid => {
    const group = userGroups.find(ug => ug.id === gid);
    return group?.members.some(m => m.userId === currentUserId && m.role === 'admin');
  }) || false;

  // User can manage group shares if they own the password OR are an admin of the target group
  // For Unsharing: if they own the password OR are an admin of the group it's being unshared from.
  // For Sharing: if they own the password OR are an admin of the group they are trying to share TO.

  const handleShareWithGroup = async () => {
    if (!selectedGroupId) {
      toast({ title: "Nenhum Grupo Selecionado", description: "Por favor, selecione um grupo para compartilhar.", variant: "destructive" });
      return;
    }
    const targetGroup = userGroups.find(g => g.id === selectedGroupId);
    if (!targetGroup) {
        toast({ title: "Grupo não encontrado", description: "O grupo selecionado não foi encontrado.", variant: "destructive" });
        return;
    }
    const isCurrentUserAdminOfTargetGroup = targetGroup.members.some(m => m.userId === currentUserId && m.role === 'admin');

    if (!isPasswordOwner && !isCurrentUserAdminOfTargetGroup) {
        toast({ title: "Permissão Negada", description: "Apenas o proprietário da senha ou um administrador do grupo de destino pode compartilhar com este grupo.", variant: "destructive" });
        return;
    }


    setIsSubmitting(true);
    try {
      await onShareWithGroup(passwordEntry.id, selectedGroupId);
      toast({ title: "Sucesso!", description: "Senha compartilhada com o grupo." });
      setSelectedGroupId(''); 
    } catch (error: any) {
      toast({ title: "Erro ao Compartilhar com Grupo", description: error.message || "Não foi possível compartilhar com o grupo.", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUnshareFromGroup = async (groupIdToRemove: string) => {
    const groupToUnshareFrom = userGroups.find(g => g.id === groupIdToRemove);
    const isCurrentUserAdminOfUnshareGroup = groupToUnshareFrom?.members.some(m => m.userId === currentUserId && m.role === 'admin') || false;

    if (!isPasswordOwner && !isCurrentUserAdminOfUnshareGroup) {
        toast({ title: "Permissão Negada", description: "Apenas o proprietário da senha ou um administrador do grupo pode remover o compartilhamento.", variant: "destructive" });
        return;
    }

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
  
  const hasGroupShares = passwordEntry.sharedWithGroupIds && passwordEntry.sharedWithGroupIds.length > 0;

  // Determine if current user can initiate sharing with ANY group
  // They can if they own the password, OR if they are an admin of AT LEAST ONE group in userGroups.
  const canInitiateAnyGroupShare = isPasswordOwner || userGroups.some(g => g.members.some(m => m.userId === currentUserId && m.role === 'admin'));


  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!isSubmitting) onOpenChange(open); }}>
      <DialogContent className="sm:max-w-lg md:max-w-xl bg-card max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="font-headline text-primary flex items-center gap-2">
            <Users size={22}/> Compartilhar Senha com Grupos
          </DialogTitle>
          <DialogDescription>
            <span className="font-semibold">"{passwordEntry.nome}"</span>
            <br />
            Gerencie com quais grupos esta senha é compartilhada.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-grow pr-3 -mr-3 my-2 text-sm">
          <div className="space-y-6 py-2">
            {canInitiateAnyGroupShare && (
              <div className="p-4 border rounded-md bg-muted/30 space-y-3">
                <h3 className="text-md font-semibold text-foreground flex items-center gap-2"><ShieldCheck size={18}/>Compartilhar com Novo Grupo</h3>
                {userGroups.length > 0 ? (
                  <>
                  <div>
                      <Label htmlFor="groupIdToShareWith" className="text-xs">Grupo</Label>
                      <Select value={selectedGroupId} onValueChange={setSelectedGroupId} disabled={isSubmitting}>
                      <SelectTrigger id="groupIdToShareWith" className="mt-1 h-9">
                          <SelectValue placeholder="Selecione um grupo" />
                      </SelectTrigger>
                      <SelectContent>
                          {userGroups.map(group => {
                            // Allow selection if user owns password OR is admin of this specific group
                            const isCurrentUserAdminOfThisGroup = group.members.some(m => m.userId === currentUserId && m.role === 'admin');
                            const canShareWithThisGroup = isPasswordOwner || isCurrentUserAdminOfThisGroup;
                            return (
                              <SelectItem 
                                key={group.id} 
                                value={group.id} 
                                disabled={passwordEntry.sharedWithGroupIds?.includes(group.id) || !canShareWithThisGroup}
                              >
                                {group.name} 
                                {passwordEntry.sharedWithGroupIds?.includes(group.id) && " (Já compartilhado)"}
                                {!canShareWithThisGroup && !passwordEntry.sharedWithGroupIds?.includes(group.id) && " (Permissão negada)"}
                              </SelectItem>
                            );
                          })}
                      </SelectContent>
                      </Select>
                  </div>
                  <Button onClick={handleShareWithGroup} className="w-full bg-accent hover:bg-accent/90 text-accent-foreground" disabled={isSubmitting || !selectedGroupId || passwordEntry.sharedWithGroupIds?.includes(selectedGroupId)}>
                      {isSubmitting ? "Compartilhando..." : "Compartilhar com Grupo Selecionado"}
                  </Button>
                  </>
                ) : (
                  <p className="text-xs text-muted-foreground p-2 bg-background/50 rounded-md">Você não possui ou não é membro de nenhum grupo para compartilhar.</p>
                )}
              </div>
            )}
            
            {(isPasswordOwner || isCurrentUserAdminOfAnySharedGroup || (passwordEntry.sharedWithGroupIds && passwordEntry.sharedWithGroupIds.length > 0)) && <Separator />}


            <div className="space-y-3">
              <h3 className="text-md font-semibold text-foreground flex items-center gap-2"><ListChecks size={18}/>Grupos Compartilhados Atualmente</h3>
              {!hasGroupShares ? (
                <p className="text-xs text-muted-foreground p-3 bg-muted/20 rounded-md flex items-center gap-2">
                  <AlertCircle size={16} /> Esta senha ainda não foi compartilhada com nenhum grupo.
                </p>
              ) : (
                <ul className="space-y-2">
                  {passwordEntry.sharedWithGroupIds?.map((gid) => {
                    const group = userGroups.find(ug => ug.id === gid) || { id: gid, name: `Grupo (ID: ...${gid.slice(-6)})`}; 
                    const canUnshareThis = isPasswordOwner || (group.members && group.members.some(m => m.userId === currentUserId && m.role === 'admin'));
                    return (
                      <li key={gid} className="p-3 border rounded-md bg-background flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                        <div className="flex-grow min-w-0">
                          <p className="text-sm font-medium text-foreground truncate flex items-center gap-1.5">
                            <ShieldCheck size={14} className="text-muted-foreground shrink-0" />
                            {group.name}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0 mt-2 sm:mt-0">
                          {canUnshareThis ? (
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
                            <Badge variant="outline" className="text-xs">Compartilhado</Badge> // User is just a member, can't unshare
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
