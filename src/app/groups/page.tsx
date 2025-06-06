
'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Header } from '@/components/layout/Header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { auth } from '@/lib/firebase';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { KeyRound, LogIn, ArrowLeft, Users, PlusCircle, Trash2, Edit3, UserPlus, UserMinus, CheckCircle, ShieldQuestion, ShieldAlert, EllipsisVertical } from 'lucide-react';
import type { FirebaseUser, Group, GroupMember } from '@/types';
import { usePasswordManager } from '@/hooks/usePasswordManager';
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
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';


export default function GroupsPage() {
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [currentYear, setCurrentYear] = useState<number | null>(null);
  const { toast } = useToast();
  const router = useRouter();

  const {
    groups,
    isLoading: passwordManagerLoading, // Main hook loading
    error: passwordManagerError, // Main hook error
    fetchGroups,
    createGroup,
    deleteGroup,
    updateGroup,
    addGroupMember,
    removeGroupMember,
    updateGroupMemberRole,
  } = usePasswordManager(firebaseUser?.uid);

  const [groupsPageLoading, setGroupsPageLoading] = useState(true);
  const [groupsPageError, setGroupsPageError] = useState<string | null>(null);

  const [isCreateGroupDialogOpen, setIsCreateGroupDialogOpen] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [editingGroup, setEditingGroup] = useState<Group | null>(null); // For managing members
  const [groupToRename, setGroupToRename] = useState<Group | null>(null); // For renaming
  const [renamingGroupName, setRenamingGroupName] = useState('');
  const [isManageMembersDialogOpen, setIsManageMembersDialogOpen] = useState(false);
  const [memberUidToAdd, setMemberUidToAdd] = useState('');
  const [memberRole, setMemberRole] = useState<'member' | 'admin'>('member');

  const loadGroupsForPage = useCallback(async () => {
    if (!firebaseUser) {
      setGroupsPageLoading(false);
      return;
    }
    setGroupsPageLoading(true);
    setGroupsPageError(null);
    try {
      await fetchGroups(); // This updates the groups in usePasswordManager
    } catch (e: any) {
      setGroupsPageError(e.message || "Falha ao carregar os grupos.");
    } finally {
      setGroupsPageLoading(false);
    }
  }, [firebaseUser, fetchGroups]);

  useEffect(() => {
    setCurrentYear(new Date().getFullYear());
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setFirebaseUser(user);
      setAuthLoading(false);
      if (user) {
        loadGroupsForPage();
      } else {
        setGroupsPageLoading(false);
      }
    });
    return () => unsubscribe();
  }, [loadGroupsForPage]);
  
  useEffect(() => { // If groups from hook change, reflect on page
    if (!passwordManagerLoading) {
        setGroupsPageLoading(false);
    }
    if (passwordManagerError && !groupsPageError) { // Prioritize local page error if any
        // setGroupsPageError(passwordManagerError); // Decided against this to keep page error specific
    }
  }, [groups, passwordManagerLoading, passwordManagerError, groupsPageError]);


  const handleLogoutFirebase = async () => {
    try {
      await signOut(auth);
      toast({ title: "Logout", description: "Você saiu da sua conta." });
      router.push('/'); 
    } catch (error) {
      toast({ title: "Erro no Logout", description: (error as Error).message, variant: "destructive" });
    }
  };

  const handleCreateGroup = async () => {
    if (!newGroupName.trim()) {
      toast({ title: "Nome Inválido", description: "O nome do grupo não pode ser vazio.", variant: "destructive" });
      return;
    }
    try {
      await createGroup(newGroupName.trim());
      toast({ title: "Grupo Criado!", description: `Grupo "${newGroupName.trim()}" criado com sucesso.` });
      setNewGroupName('');
      setIsCreateGroupDialogOpen(false);
    } catch (e: any) {
      toast({ title: "Erro ao Criar Grupo", description: e.message || "Não foi possível criar o grupo.", variant: "destructive" });
    }
  };
  
  const handleRenameGroupConfirm = async () => {
    if (!groupToRename || !renamingGroupName.trim()) {
      toast({ title: "Dados Inválidos", description: "O nome do grupo não pode ser vazio.", variant: "destructive" });
      return;
    }
    try {
      await updateGroup(groupToRename.id, renamingGroupName.trim());
      toast({ title: "Grupo Atualizado!", description: `Grupo renomeado para "${renamingGroupName.trim()}".` });
      setGroupToRename(null);
      setRenamingGroupName('');
    } catch (e: any) {
      toast({ title: "Erro ao Atualizar Grupo", description: e.message || "Não foi possível atualizar o grupo.", variant: "destructive" });
    }
  };


  const handleDeleteGroup = async (groupId: string, groupName: string) => {
    try {
      await deleteGroup(groupId);
      toast({ title: "Grupo Deletado", description: `Grupo "${groupName}" foi deletado.`, variant: "destructive" });
    } catch (e: any) {
      toast({ title: "Erro ao Deletar Grupo", description: e.message || "Não foi possível deletar o grupo.", variant: "destructive" });
    }
  };
  
  const handleAddMember = async () => {
    if (!editingGroup || !memberUidToAdd.trim()) {
        toast({ title: "Dados incompletos", description: "Selecione um grupo e forneça o UID do membro.", variant: "destructive" });
        return;
    }
    if (memberUidToAdd.trim() === firebaseUser?.uid && editingGroup.members.some(m => m.userId === firebaseUser?.uid)) {
        toast({ title: "Ação Inválida", description: "Você já é membro deste grupo.", variant: "default" });
        return;
    }
    try {
        const updatedGroupFromHook = await addGroupMember(editingGroup.id, memberUidToAdd.trim(), memberRole);
        toast({ title: "Membro Adicionado", description: `Usuário adicionado ao grupo "${editingGroup.name}".` });
        setMemberUidToAdd('');
        setMemberRole('member');
        setEditingGroup(updatedGroupFromHook); // Directly use the updated group from the hook

    } catch (e: any) {
        toast({ title: "Erro ao Adicionar Membro", description: e.message || "Não foi possível adicionar o membro.", variant: "destructive" });
    }
  };

  const handleRemoveMember = async (groupId: string, groupName: string, memberUid: string) => {
    if (!editingGroup) return;
    try {
        const updatedGroupFromHook = await removeGroupMember(groupId, memberUid);
        toast({ title: "Membro Removido", description: `Usuário removido do grupo "${groupName}".` });
        if (updatedGroupFromHook) {
          setEditingGroup(updatedGroupFromHook);
        } else {
          // This case should ideally not happen if the hook handles group removal from its state correctly
          setIsManageMembersDialogOpen(false); 
          await fetchGroups(); // Re-fetch all groups if the specific one is gone
        }
    } catch (e: any) {
        toast({ title: "Erro ao Remover Membro", description: e.message || "Não foi possível remover o membro.", variant: "destructive" });
    }
  };
  
  const handleUpdateMemberRole = async (groupId: string, memberUid: string, newRole: 'member' | 'admin') => {
    if (!editingGroup) return;
    try {
        const updatedGroupFromHook = await updateGroupMemberRole(groupId, memberUid, newRole);
        toast({ title: "Função Atualizada", description: `Função do membro atualizada no grupo.` });
        setEditingGroup(updatedGroupFromHook);
    } catch (e: any) {
        toast({ title: "Erro ao Atualizar Função", description: e.message || "Não foi possível atualizar a função do membro.", variant: "destructive" });
    }
  };


  if (authLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center">
        <KeyRound size={48} className="text-primary animate-pulse mb-4" />
        <p className="text-muted-foreground">Carregando sua sessão...</p>
      </div>
    );
  }

  if (!firebaseUser) {
    return (
      <div className="min-h-screen flex flex-col">
        <Header user={null} onLogout={handleLogoutFirebase} />
        <main className="container mx-auto py-8 px-4 flex-grow flex flex-col items-center justify-center">
          <Card className="w-full max-w-md text-center shadow-xl">
            <CardHeader>
              <CardTitle className="font-headline text-2xl text-primary flex items-center justify-center gap-2">
                <LogIn size={24} /> Acesso Necessário
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground mb-6">Você precisa estar logado para gerenciar seus grupos.</p>
              <Button asChild className="bg-primary hover:bg-primary/90 w-full">
                <Link href="/">Ir para Login</Link>
              </Button>
            </CardContent>
          </Card>
        </main>
         <footer className="text-center py-4 text-sm text-muted-foreground border-t mt-auto">
            SenhaFacil &copy; {currentYear !== null ? currentYear : new Date().getFullYear()}
        </footer>
      </div>
    );
  }

  const isLoading = authLoading || groupsPageLoading;

  return (
    <div className="min-h-screen flex flex-col">
      <Header user={firebaseUser} onLogout={handleLogoutFirebase} />
      <main className="container mx-auto py-8 px-4 flex-grow">
        <div className="flex justify-between items-center mb-6">
            <h2 className="text-3xl font-headline text-primary flex items-center gap-2">
                <Users size={30}/> Meus Grupos
            </h2>
            <Button onClick={() => { setNewGroupName(''); setIsCreateGroupDialogOpen(true); }} className="bg-accent hover:bg-accent/90 text-accent-foreground">
                <PlusCircle size={18} className="mr-2" /> Criar Novo Grupo
            </Button>
        </div>

        {isLoading && <p className="text-muted-foreground">Carregando grupos...</p>}
        {groupsPageError && <Alert variant="destructive"><ShieldAlert className="h-4 w-4" /> <AlertTitle>Erro ao Carregar Grupos</AlertTitle><AlertDescription>{groupsPageError}</AlertDescription></Alert>}
        
        {!isLoading && !groupsPageError && groups.length === 0 && (
            <Card className="text-center py-10">
                <CardHeader>
                    <CardTitle className="text-xl text-muted-foreground">Nenhum grupo encontrado</CardTitle>
                </CardHeader>
                <CardContent>
                    <p className="text-muted-foreground">Você ainda não criou ou não faz parte de nenhum grupo.</p>
                    <Button onClick={() => setIsCreateGroupDialogOpen(true)} className="mt-4">Criar Meu Primeiro Grupo</Button>
                </CardContent>
            </Card>
        )}

        {!isLoading && !groupsPageError && groups.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {groups.map(group => {
                    const isOwner = group.ownerId === firebaseUser.uid;
                    const isAdmin = group.members.some(m => m.userId === firebaseUser.uid && m.role === 'admin');
                    const canManageGroup = isOwner || isAdmin;

                    return (
                    <AlertDialog key={group.id}> 
                        <Card className="flex flex-col h-full"> 
                            <CardHeader className="flex-row justify-between items-start">
                                <div>
                                    <CardTitle className="font-headline text-lg text-primary">{group.name}</CardTitle>
                                    <CardDescription>
                                        {isOwner ? "Você é o proprietário" : (isAdmin ? "Você é admin" : "Você é membro")}
                                        &nbsp;&bull;&nbsp; {group.members.length} membro(s)
                                    </CardDescription>
                                </div>
                                {canManageGroup && (
                                     <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground">
                                                <EllipsisVertical size={18} />
                                            </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end">
                                            <DropdownMenuItem onClick={() => { setEditingGroup(group); setIsManageMembersDialogOpen(true); }}>
                                                <UserPlus className="mr-2 h-4 w-4" />Gerenciar Membros
                                            </DropdownMenuItem>
                                            {isOwner && ( // Only owner can rename
                                                <DropdownMenuItem onClick={() => { setGroupToRename(group); setRenamingGroupName(group.name); }}>
                                                    <Edit3 className="mr-2 h-4 w-4" />Renomear Grupo
                                                </DropdownMenuItem>
                                            )}
                                            {isOwner && ( // Only owner can delete
                                                <AlertDialogTrigger asChild>
                                                    <DropdownMenuItem className="text-destructive focus:text-destructive focus:bg-destructive/10" onSelect={e=>e.preventDefault()}>
                                                        <Trash2 className="mr-2 h-4 w-4" />Deletar Grupo
                                                    </DropdownMenuItem>
                                                </AlertDialogTrigger>
                                            )}
                                        </DropdownMenuContent>
                                     </DropdownMenu>
                                )}
                            </CardHeader>
                            <CardContent className="flex-grow">
                                <h4 className="text-sm font-medium mb-1">Membros:</h4>
                                <ScrollArea className="h-24 text-xs">
                                    <ul className="space-y-1">
                                    {group.members.map(member => (
                                        <li key={member.userId} className="flex justify-between items-center">
                                            <span className="truncate" title={member.userId}>
                                                UID: ...{member.userId.slice(-8)} 
                                                {member.userId === firebaseUser.uid && " (Você)"}
                                            </span>
                                            <Badge variant={member.role === 'admin' ? "default" : "secondary"}>{member.role}</Badge>
                                        </li>
                                    ))}
                                    </ul>
                                </ScrollArea>
                            </CardContent>
                            {isOwner && ( // Only owner can trigger delete dialog for the group
                                <AlertDialogContent>
                                    <AlertDialogHeader>
                                        <AlertDialogTitle>Deletar Grupo "{group.name}"?</AlertDialogTitle>
                                        <AlertDialogDescription>
                                        Esta ação é irreversível. Todas as senhas compartilhadas com este grupo serão automaticamente desvinculadas dele.
                                        </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                        <AlertDialogAction onClick={() => handleDeleteGroup(group.id, group.name)} className="bg-destructive hover:bg-destructive/90">
                                            Confirmar Deleção
                                        </AlertDialogAction>
                                    </AlertDialogFooter>
                                </AlertDialogContent>
                            )}
                        </Card>
                    </AlertDialog>
                )})}
            </div>
        )}
      </main>

      <AlertDialog open={isCreateGroupDialogOpen} onOpenChange={setIsCreateGroupDialogOpen}>
        <AlertDialogContent>
            <AlertDialogHeader>
                <AlertDialogTitle>Criar Novo Grupo</AlertDialogTitle>
                <AlertDialogDescription>Dê um nome para o seu novo grupo.</AlertDialogDescription>
            </AlertDialogHeader>
            <Input 
                placeholder="Nome do Grupo" 
                value={newGroupName} 
                onChange={(e) => setNewGroupName(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleCreateGroup(); }}}
            />
            <AlertDialogFooter>
                <AlertDialogCancel onClick={() => setNewGroupName('')}>Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={handleCreateGroup}>Criar</AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {groupToRename && (
        <AlertDialog open={!!groupToRename} onOpenChange={(open) => { if (!open) setGroupToRename(null); }}>
          <AlertDialogContent>
              <AlertDialogHeader>
                  <AlertDialogTitle>Renomear Grupo "{groupToRename.name}"</AlertDialogTitle>
                  <AlertDialogDescription>Escolha um novo nome para o grupo.</AlertDialogDescription>
              </AlertDialogHeader>
              <Input 
                  placeholder="Novo nome do Grupo" 
                  value={renamingGroupName} 
                  onChange={(e) => setRenamingGroupName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleRenameGroupConfirm(); }}}
              />
              <AlertDialogFooter>
                  <AlertDialogCancel onClick={() => { setGroupToRename(null); setRenamingGroupName(''); }}>Cancelar</AlertDialogCancel>
                  <AlertDialogAction onClick={handleRenameGroupConfirm}>Renomear</AlertDialogAction>
              </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
      
      {editingGroup && firebaseUser && (
        <AlertDialog open={isManageMembersDialogOpen} onOpenChange={(open) => {if (!open) setEditingGroup(null); setIsManageMembersDialogOpen(open);}}>
            <AlertDialogContent className="sm:max-w-lg">
                <AlertDialogHeader>
                    <AlertDialogTitle>Gerenciar Membros de "{editingGroup.name}"</AlertDialogTitle>
                    <AlertDialogDescription>Adicione ou remova membros e gerencie suas funções.</AlertDialogDescription>
                </AlertDialogHeader>
                <div className="py-4 space-y-4">
                    <h3 className="text-sm font-semibold">Adicionar Novo Membro</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 items-end">
                        <Input 
                            placeholder="UID do Membro" 
                            value={memberUidToAdd} 
                            onChange={(e) => setMemberUidToAdd(e.target.value)}
                            className="sm:col-span-2"
                        />
                         <Select value={memberRole} onValueChange={(v: 'member' | 'admin') => setMemberRole(v)}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="member">Membro</SelectItem>
                                <SelectItem value="admin">Admin</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <Button onClick={handleAddMember} className="w-full" disabled={!memberUidToAdd.trim()}>Adicionar Membro</Button>
                    
                    <Separator />
                    <h3 className="text-sm font-semibold">Membros Atuais ({editingGroup.members.length})</h3>
                    <ScrollArea className="h-48">
                        <ul className="space-y-2 pr-2">
                            {editingGroup.members.map(member => {
                                const isCurrentUserTheMemberBeingListed = member.userId === firebaseUser.uid;
                                const isMemberOwner = member.userId === editingGroup.ownerId;
                                // Check if current user is owner or admin of the group being edited
                                const isManagerOwner = editingGroup.ownerId === firebaseUser.uid;
                                const isManagerAdmin = editingGroup.members.some(m => m.userId === firebaseUser.uid && m.role === 'admin');

                                const canChangeRole = isManagerOwner || (isManagerAdmin && !isMemberOwner && member.userId !== firebaseUser.uid); // Admins can't change owner's or other admin's roles, unless they are owner
                                if(isManagerOwner && isMemberOwner) {
                                    // Owner cannot change their own role from admin
                                } else if (isManagerAdmin && member.role === 'admin' && !isManagerOwner) {
                                   // An admin cannot change another admin's role unless they are the owner
                                }
                                
                                const canRemove = (isManagerOwner && !isMemberOwner) || (isManagerAdmin && !isMemberOwner && member.role !== 'admin');


                                return (
                                <li key={member.userId} className="flex items-center justify-between p-2 border rounded-md text-xs">
                                    <div className="truncate" title={member.userId}>
                                        <span className="font-mono">...{member.userId.slice(-10)}</span>
                                        {isMemberOwner && <Badge variant="outline" className="ml-2 text-primary border-primary">Proprietário</Badge>}
                                        {isCurrentUserTheMemberBeingListed && !isMemberOwner && <Badge variant="secondary" className="ml-2">Você</Badge>}
                                    </div>
                                    <div className="flex items-center gap-1">
                                        {isMemberOwner ? (
                                            <Badge variant="default" className="text-xs">{member.role}</Badge>
                                        ) : (
                                            <Select 
                                                value={member.role} 
                                                onValueChange={(newRole: 'member' | 'admin') => handleUpdateMemberRole(editingGroup.id, member.userId, newRole)}
                                                disabled={!canChangeRole}
                                            >
                                                <SelectTrigger className="h-7 w-[90px] text-xs"><SelectValue /></SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="member">Membro</SelectItem>
                                                    <SelectItem value="admin">Admin</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        )}
                                        {canRemove && (
                                            <Button 
                                                variant="ghost" 
                                                size="icon" 
                                                className="h-7 w-7 text-destructive hover:bg-destructive/10"
                                                onClick={() => handleRemoveMember(editingGroup.id, editingGroup.name, member.userId)}
                                            >
                                                <UserMinus size={14} />
                                            </Button>
                                        )}
                                    </div>
                                </li>
                            )})}
                        </ul>
                    </ScrollArea>
                </div>
                <AlertDialogFooter>
                    <AlertDialogCancel onClick={() => {setEditingGroup(null); setMemberUidToAdd('');}}>Fechar</AlertDialogCancel>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
      )}

      <footer className="text-center py-4 text-sm text-muted-foreground border-t mt-auto">
        SenhaFacil &copy; {currentYear !== null ? currentYear : new Date().getFullYear()}
      </footer>
    </div>
  );
}
