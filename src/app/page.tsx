
'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { usePasswordManager } from '@/hooks/usePasswordManager';
import type { PasswordEntry, FirebaseUser, Group, CategoryShare } from '@/types';
import { Header } from '@/components/layout/Header';
import { PasswordList } from '@/components/password/PasswordList';
import { AddEditPasswordDialog, type PasswordFormValues } from '@/components/password/AddEditPasswordDialog';
import { ImportPasswordsDialog } from '@/components/password/ImportPasswordsDialog';
import { PasswordGeneratorDialog } from '@/components/password/PasswordGeneratorDialog';
import { ClearAllPasswordsDialog } from '@/components/password/ClearAllPasswordsDialog';
// SharePasswordDialog import removed
import { ShareCategoryDialog } from '@/components/category/ShareCategoryDialog'; // New import
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';

import { useToast } from '@/hooks/use-toast';
import { PlusCircle, Upload, Zap, Search, ShieldAlert, Trash2, FileDown, KeyRound, EllipsisVertical, FolderKanban, Plus, X, Share2 } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { cn } from '@/lib/utils';

import { auth, googleProvider } from '@/lib/firebase';
import {
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  type AuthError
} from 'firebase/auth';


const GoogleIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" className="mr-2 h-5 w-5">
    <path fill="#EA4335" d="M24 9.5c3.9 0 6.9 1.6 9.1 3.7l6.9-6.9C35.7 2.3 30.4 0 24 0 14.9 0 7.3 5.4 3 12.9l7.3 5.7C12.1 12.8 17.6 9.5 24 9.5z"/>
    <path fill="#4285F4" d="M46.2 24.5c0-1.7-.1-3.3-.4-4.9H24v9.3h12.5c-.6 3-2.3 5.5-4.9 7.2l7.2 5.6C43.2 37.6 46.2 31.6 46.2 24.5z"/>
    <path fill="#FBBC05" d="M10.3 28.6c-.5-1.5-.8-3.1-.8-4.7s.3-3.2.8-4.7l-7.3-5.7C1.1 17.4 0 20.6 0 24c0 3.4 1.1 6.6 3 9.3l7.3-4.7z"/>
    <path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.7l-7.2-5.6c-2.2 1.5-5 2.3-8.7 2.3-6.4 0-11.9-4.3-13.9-10.1l-7.3 5.7C7.3 42.6 14.9 48 24 48z"/>
    <path fill="none" d="M0 0h48v48H0z"/>
  </svg>
);

const ALLOWED_GOOGLE_DOMAINS = ['@unifenas.br', 'aluno.unifenas.br', '@adm.unifenas.br'];


export default function HomePage() {
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const [currentYear, setCurrentYear] = useState<number | null>(null);

  const {
    passwords,
    groups,
    isLoading: passwordsLoadingFromHook,
    error: passwordManagerError,
    addPassword,
    updatePassword,
    deletePassword,
    importPasswords: importPasswordsHook,
    generatePassword,
    clearAllPasswords,
    exportPasswordsToCSV,
    fetchGroups,
    shareCategoryWithGroup,
    unshareCategoryFromGroup,
    fetchCategorySharesForOwner,
  } = usePasswordManager(firebaseUser?.uid);
  const { toast } = useToast();

  const [isAddEditDialogOpen, setIsAddEditDialogOpen] = useState(false);
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [isGeneratorDialogOpen, setIsGeneratorDialogOpen] = useState(false);
  const [isClearAllDialogOpen, setIsClearAllDialogOpen] = useState(false);
  const [editingPassword, setEditingPassword] = useState<PasswordEntry | Partial<PasswordEntry> | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  const [userCategories, setUserCategories] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<string>('Todas');
  const [isAddCategoryDialogOpen, setIsAddCategoryDialogOpen] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [isDeleteCategoryDialogOpen, setIsDeleteCategoryDialogOpen] = useState(false);
  const [categoryToDelete, setCategoryToDelete] = useState<string | null>(null);

  const [isShareCategoryDialogOpen, setIsShareCategoryDialogOpen] = useState(false);
  const [categoryToShare, setCategoryToShare] = useState<string | null>(null);

  const isLoading = authLoading || passwordsLoadingFromHook;

  useEffect(() => {
    setCurrentYear(new Date().getFullYear());
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setFirebaseUser(user);
      setAuthLoading(false);
      if (user) {
        setAuthError(null);
        const storedCategories = localStorage.getItem(`userCategories_${user.uid}`);
        setUserCategories(storedCategories ? JSON.parse(storedCategories) : []);
        setActiveTab('Todas');
        fetchGroups().catch(err => {
            console.warn("HomePage: fetchGroups failed on auth state change:", err.message);
        });
      } else {
        setUserCategories([]);
        setActiveTab('Todas');
      }
    });
    return () => unsubscribe();
  }, [fetchGroups]);

  useEffect(() => {
    if (firebaseUser && passwords.length > 0) {
      const categoriesFromOwnedPasswords = Array.from(
        new Set(
          passwords
            .filter(p => p.ownerId === firebaseUser.uid && p.categoria)
            .map(p => p.categoria!)
        )
      );
      const currentStoredCategories = JSON.parse(localStorage.getItem(`userCategories_${firebaseUser.uid}`) || '[]');
      const combinedCategories = Array.from(new Set([...currentStoredCategories, ...categoriesFromOwnedPasswords]
        .map(cat => cat.trim())
        .filter(cat => cat.length > 0)
        .sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()))
      ));

      if (JSON.stringify(combinedCategories) !== JSON.stringify(userCategories)) {
         setUserCategories(combinedCategories);
         localStorage.setItem(`userCategories_${firebaseUser.uid}`, JSON.stringify(combinedCategories));
      }
    } else if (firebaseUser && passwords.length === 0) {
        const storedCategories = localStorage.getItem(`userCategories_${firebaseUser.uid}`);
        const loadedCategories = storedCategories ? JSON.parse(storedCategories) : [];
        if (JSON.stringify(loadedCategories) !== JSON.stringify(userCategories)) {
            setUserCategories(loadedCategories);
        }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [passwords, firebaseUser]);


  const handleFirebaseError = (error: AuthError) => {
    console.error("Firebase Auth Error:", error);
    let errorMessage = "Ocorreu um erro de autenticação.";
    switch (error.code) {
      case 'auth/invalid-email': errorMessage = "Formato de email inválido."; break;
      case 'auth/user-disabled': errorMessage = "Esta conta de usuário foi desabilitada."; break;
      case 'auth/user-not-found': errorMessage = "Nenhum usuário encontrado com este email."; break;
      case 'auth/wrong-password': errorMessage = "Senha incorreta."; break;
      case 'auth/invalid-credential': errorMessage = "Credenciais inválidas. Verifique os dados e tente novamente."; break;
      case 'auth/email-already-in-use': errorMessage = "Este email já está em uso por outra conta."; break;
      case 'auth/weak-password': errorMessage = "A senha é muito fraca. Use pelo menos 6 caracteres."; break;
      case 'auth/operation-not-allowed': errorMessage = "Operação não permitida. Login por este método pode estar desabilitado."; break;
      case 'auth/too-many-requests': errorMessage = "Muitas tentativas falharam. Tente novamente mais tarde."; break;
      case 'auth/popup-closed-by-user': errorMessage = "O pop-up de login foi fechado antes da conclusão."; break;
      case 'auth/account-exists-with-different-credential': errorMessage = "Já existe uma conta com este endereço de e-mail, mas com um método de login diferente."; break;
      case 'auth/unauthorized-domain': errorMessage = `O domínio do seu e-mail não está autorizado. Use domínios permitidos: ${ALLOWED_GOOGLE_DOMAINS.join(', ')}.`; break;
      default: errorMessage = (error as Error).message || "Ocorreu um erro de autenticação desconhecido.";
    }
    setAuthError(errorMessage);
    toast({ title: "Erro de Autenticação", description: errorMessage, variant: "destructive"});
  };


  const handleLoginWithGoogle = async () => {
    setAuthError(null);
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const userEmail = result.user.email;
      if (userEmail) {
        const isAllowed = ALLOWED_GOOGLE_DOMAINS.some(domain => userEmail.endsWith(domain));
        if (!isAllowed) {
          await signOut(auth);
          const errorMessage = `Acesso permitido apenas para usuários dos domínios: ${ALLOWED_GOOGLE_DOMAINS.join(', ')}.`;
          setAuthError(errorMessage);
          toast({ title: "Acesso Restrito", description: errorMessage, variant: "destructive" });
          return;
        }
      } else {
        await signOut(auth);
        const errorMessage = "Não foi possível verificar o domínio do email. Tente novamente.";
        setAuthError(errorMessage);
        toast({ title: "Erro na Verificação", description: errorMessage, variant: "destructive" });
        return;
      }
      toast({ title: "Login com Google bem-sucedido!", description: "Bem-vindo!" });
    } catch (error) {
      handleFirebaseError(error as AuthError);
    }
  };

  const handleLogoutFirebase = async () => {
    try {
      await signOut(auth);
      toast({ title: "Logout", description: "Você saiu da sua conta." });
    } catch (error) {
      console.error("Logout Error:", error);
      toast({ title: "Erro no Logout", description: (error as Error).message, variant: "destructive" });
    }
  };

  const handleAddPassword = async (data: PasswordFormValues) => {
    if (!firebaseUser) {
      toast({ title: "Não autenticado", description: "Você precisa estar logado para adicionar senhas.", variant: "destructive" });
      return;
    }
    const entryToAdd: Omit<PasswordEntry, 'id' | 'userId' | 'ownerId' | 'sharedWith' | 'history' | 'isDeleted' | 'createdBy' | 'lastModifiedBy' | 'createdAt' | 'sharedVia'> = {
      nome: data.nome,
      login: data.login,
      senha: data.senha,
      categoria: data.categoria,
      customFields: data.customFields || [],
    };
    try {
      await addPassword(entryToAdd);
      toast({ title: "Sucesso!", description: `Senha para "${data.nome}" adicionada.` });
    } catch (e: any) {
      toast({ title: "Erro ao Adicionar", description: (e as Error).message || "Não foi possível adicionar a senha.", variant: "destructive" });
    }
  };

  const handleUpdatePassword = async (data: PasswordFormValues, id: string) => {
    if (!firebaseUser) {
      toast({ title: "Não autenticado", description: "Você precisa estar logado para atualizar senhas.", variant: "destructive" });
      return;
    }
    const entryToUpdate: Omit<PasswordEntry, 'userId' | 'ownerId' | 'sharedWith' | 'history' | 'isDeleted' | 'createdBy' | 'lastModifiedBy' | 'createdAt' | 'sharedVia'> & {id: string} = {
      id,
      nome: data.nome,
      login: data.login,
      senha: data.senha,
      categoria: data.categoria,
      customFields: data.customFields || [],
    };
    try {
      await updatePassword(entryToUpdate);
      toast({ title: "Sucesso!", description: `Senha para "${data.nome}" atualizada.` });
    } catch (e: any) {
      toast({ title: "Erro ao Atualizar", description: (e as Error).message || "Não foi possível atualizar a senha.", variant: "destructive" });
    }
  };

  const handleSubmitPasswordForm = async (data: PasswordFormValues, id?: string) => {
    if (id && editingPassword && 'id' in editingPassword && editingPassword.id === id) {
      await handleUpdatePassword(data, id);
    } else {
      await handleAddPassword(data);
    }
    setEditingPassword(null);
    setIsAddEditDialogOpen(false);
  };

  const handleEditPassword = (entry: PasswordEntry) => {
    setEditingPassword(entry);
    setIsAddEditDialogOpen(true);
  };

  const handleDeletePassword = async (id: string) => {
    if (!firebaseUser) {
      toast({ title: "Não autenticado", description: "Você precisa estar logado para deletar senhas.", variant: "destructive" });
      return;
    }
    const entryToDelete = passwords.find(p => p.id === id);
    try {
      await deletePassword(id);
      if (entryToDelete) {
        toast({ title: "Sucesso!", description: `Senha para "${entryToDelete.nome}" marcada como deletada.`, variant: "destructive" });
      }
    } catch (e: any) {
      toast({ title: "Erro ao Deletar", description: (e as Error).message || "Não foi possível deletar a senha.", variant: "destructive" });
    }
  };

  const handleImport = async (file: File) => {
    if (!firebaseUser) {
      toast({ title: "Não autenticado", description: "Você precisa estar logado para importar senhas.", variant: "destructive" });
      return;
    }
    if (!file) {
      toast({ title: "Nenhum arquivo", description: "Por favor, selecione um arquivo para importar.", variant: "destructive" });
      return;
    }
    try {
      const result = await importPasswordsHook(file);
      if (result.importedCount > 0) {
           toast({ title: "Importação Concluída", description: `${result.importedCount} novas senhas importadas com sucesso.` });
      } else {
           toast({ title: "Nenhuma Nova Senha", description: result.message || "Nenhuma senha nova foi importada.", variant: "default" });
      }
      setIsImportDialogOpen(false);
    } catch (e: any) {
         toast({ title: "Erro na Importação", description: (e as Error).message || "Falha ao processar o arquivo CSV.", variant: "destructive" });
    }
  };

  const handleClearAllPasswords = async () => {
    if (!firebaseUser) {
      toast({ title: "Não autenticado", description: "Você precisa estar logado para limpar senhas.", variant: "destructive" });
      return;
    }
    try {
      await clearAllPasswords();
      toast({ title: "Tudo Limpo!", description: "Todas as senhas foram removidas.", variant: "destructive" });
      setIsClearAllDialogOpen(false);
    } catch (e: any) {
      toast({ title: "Erro ao Limpar", description: (e as Error).message || "Não foi possível limpar todas as senhas.", variant: "destructive" });
    }
  };

  const handleExportPasswords = async () => {
    if (!firebaseUser) {
      toast({ title: "Não autenticado", description: "Você precisa estar logado para exportar senhas.", variant: "destructive" });
      return;
    }
    if (passwords.length === 0 && activeTab === 'Todas') { 
      toast({ title: "Nada para Exportar", description: "Não há senhas para exportar.", variant: "default" });
      return;
    }
    try {
        const success = await exportPasswordsToCSV();
        if (success) {
          toast({ title: "Exportado!", description: "Suas senhas foram exportadas para senhas_backup.csv." });
        }
    } catch (e: any) {
        toast({ title: "Erro na Exportação", description: (e as Error).message || "Não foi possível exportar as senhas.", variant: "destructive" });
    }
  };

  const handleOpenAddPasswordDialog = () => {
    setEditingPassword({ categoria: activeTab !== 'Todas' ? activeTab : "" });
    setIsAddEditDialogOpen(true);
  };

  const handleOpenShareCategoryDialog = (categoryName: string) => {
    setCategoryToShare(categoryName);
    setIsShareCategoryDialogOpen(true);
  };


  const handleAddCategory = useCallback(() => {
    if (!firebaseUser) return false;
    const trimmedName = newCategoryName.trim();
    if (!trimmedName) {
      toast({ title: "Nome Inválido", description: "O nome da categoria não pode ser vazio.", variant: "destructive" });
      return false;
    }
    if (userCategories.some(cat => cat.toLowerCase() === trimmedName.toLowerCase())) {
      toast({ title: "Categoria Duplicada", description: `A categoria "${trimmedName}" já existe.`, variant: "destructive" });
      return false;
    }
    const updatedCategories = [...userCategories, trimmedName].sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));
    setUserCategories(updatedCategories);
    localStorage.setItem(`userCategories_${firebaseUser.uid}`, JSON.stringify(updatedCategories));
    setActiveTab(trimmedName);
    setNewCategoryName('');
    toast({title: "Categoria Adicionada", description: `Categoria "${trimmedName}" criada.`});
    return true;
  }, [newCategoryName, userCategories, firebaseUser, toast]);

  const handleConfirmDeleteCategory = useCallback(async () => {
    if (!firebaseUser || !categoryToDelete) return;

    const passwordsInCategory = passwords.filter(p => p.ownerId === firebaseUser.uid && p.categoria?.toLowerCase() === categoryToDelete.toLowerCase() && !p.isDeleted);

    if (passwordsInCategory.length > 0) {
      toast({
        title: "Exclusão Falhou",
        description: `A categoria "${categoryToDelete}" não pode ser excluída pois contém ${passwordsInCategory.length} senha(s) sua(s). Mova ou delete estas senhas primeiro.`,
        variant: "destructive", duration: 5000
      });
      setIsDeleteCategoryDialogOpen(false);
      setCategoryToDelete(null);
      return;
    }

    try {
        const shares = await fetchCategorySharesForOwner(categoryToDelete, firebaseUser.uid);
        if (shares && shares.length > 0) {
            toast({
              title: "Exclusão Falhou",
              description: `A categoria "${categoryToDelete}" está compartilhada com ${shares.length} grupo(s). Remova esses compartilhamentos primeiro.`,
              variant: "destructive", duration: 5000
            });
            setIsDeleteCategoryDialogOpen(false);
            setCategoryToDelete(null);
            return;
        }
    } catch (e: any) {
        toast({ title: "Erro ao Verificar Compartilhamentos", description: e.message || "Não foi possível verificar os compartilhamentos da categoria.", variant: "destructive" });
        setIsDeleteCategoryDialogOpen(false);
        setCategoryToDelete(null);
        return;
    }

    const updatedCategories = userCategories.filter(cat => cat.toLowerCase() !== categoryToDelete.toLowerCase());
    setUserCategories(updatedCategories);
    localStorage.setItem(`userCategories_${firebaseUser.uid}`, JSON.stringify(updatedCategories));
    setActiveTab('Todas');
    toast({ title: "Categoria Excluída", description: `A categoria "${categoryToDelete}" foi excluída.` });

    setIsDeleteCategoryDialogOpen(false);
    setCategoryToDelete(null);
  }, [firebaseUser, categoryToDelete, passwords, userCategories, toast, fetchCategorySharesForOwner]);


  const filteredPasswords = useMemo(() => {
    let tempPasswords = passwords.filter(p => !p.isDeleted);
    if (activeTab !== 'Todas') {
      tempPasswords = tempPasswords.filter(p => p.categoria?.toLowerCase() === activeTab.toLowerCase());
    }
    if (searchTerm) {
      const lowerSearchTerm = searchTerm.toLowerCase();
      tempPasswords = tempPasswords.filter(p =>
        p.nome.toLowerCase().includes(lowerSearchTerm) ||
        p.login.toLowerCase().includes(lowerSearchTerm) ||
        (p.categoria && p.categoria.toLowerCase().includes(lowerSearchTerm)) ||
        (p.customFields && p.customFields.some(cf =>
            cf.label.toLowerCase().includes(lowerSearchTerm) ||
            cf.value.toLowerCase().includes(lowerSearchTerm)
        )) ||
        (p.sharedVia?.groupName && p.sharedVia.groupName.toLowerCase().includes(lowerSearchTerm))
      );
    }
    return tempPasswords;
  }, [passwords, activeTab, searchTerm]);


  if (authLoading) { 
    return (
      <div className="min-h-screen flex flex-col items-center justify-center">
        <KeyRound size={48} className="text-primary animate-pulse mb-4" />
        <p className="text-muted-foreground">Carregando sessão...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Header user={firebaseUser} onLogout={handleLogoutFirebase} />
      <main className="container mx-auto py-8 px-4 flex-grow">
        {!firebaseUser ? (
          <div className="flex justify-center items-center flex-col mt-8 md:mt-16">
            <Card className="w-full max-w-md shadow-xl">
              <CardHeader className="text-center">
                <CardTitle className="font-headline text-2xl text-primary flex items-center justify-center gap-2">
                   <KeyRound size={24}/> Entrar
                </CardTitle>
                <CardDescription>Use sua conta Google dos domínios permitidos para acessar.</CardDescription>
              </CardHeader>
              <CardContent className="px-6 pb-6 pt-2">
                {authError && <p className="text-sm text-destructive text-center mb-4">{authError}</p>}
                <Button onClick={handleLoginWithGoogle} variant="outline" className="w-full">
                  <GoogleIcon />
                  Entrar com Google
                </Button>
                <p className="text-xs text-muted-foreground text-center mt-2">
                  Domínios permitidos: {ALLOWED_GOOGLE_DOMAINS.join(', ')}.
                </p>
              </CardContent>
            </Card>
          </div>
        ) : (
          <>
            {passwordManagerError && ( 
             <Alert variant="destructive" className="mb-4">
                <ShieldAlert className="h-5 w-5" />
                <AlertTitle>Erro de Conexão ou Dados</AlertTitle>
                <AlertDescription>
                  {passwordManagerError} Verifique os logs do servidor (backend), a conexão com o banco de dados (MongoDB URI, IP Allowlist no Atlas) e as configurações da API. Tente recarregar a página.
                </AlertDescription>
              </Alert>
            )}

            <div className="mb-8 p-6 bg-card rounded-lg shadow-md">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
                <div className="relative md:col-span-1">
                  <Input
                    type="search"
                    placeholder="Pesquisar senhas..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                </div>
                <div className="md:col-span-2 flex flex-wrap gap-2 justify-end">
                  <Button onClick={handleOpenAddPasswordDialog} className="bg-primary hover:bg-primary/90">
                    <PlusCircle size={18} className="mr-2" /> Adicionar Nova
                  </Button>

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" className="hover:bg-secondary">
                        <EllipsisVertical size={18} className="mr-0 md:mr-2" /> <span className="hidden md:inline">Mais Ações</span>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onSelect={() => setIsImportDialogOpen(true)}>
                        <Upload size={16} className="mr-2" /> Importar CSV
                      </DropdownMenuItem>
                      <DropdownMenuItem onSelect={handleExportPasswords}>
                        <FileDown size={16} className="mr-2" /> Exportar CSV
                      </DropdownMenuItem>
                      <DropdownMenuItem onSelect={() => setIsGeneratorDialogOpen(true)}>
                        <Zap size={16} className="mr-2" /> Gerar Senha
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onSelect={() => setIsClearAllDialogOpen(true)}
                        className="text-destructive focus:text-destructive focus:bg-destructive/10"
                      >
                        <Trash2 size={16} className="mr-2" /> Limpar Tudo
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            </div>

            <div className="mb-4">
               <div className="flex items-center border-b">
                  <ScrollArea className="w-full whitespace-nowrap">
                     <div className="flex space-x-1 pb-1">
                        <Button
                           variant={activeTab === 'Todas' ? "secondary" : "ghost"}
                           size="sm"
                           onClick={() => setActiveTab('Todas')}
                           className={cn(
                              "flex items-center gap-1 h-8 px-3 rounded-md",
                              activeTab !== 'Todas' && "hover:bg-secondary hover:text-secondary-foreground"
                           )}
                        >
                           <FolderKanban size={14} /> Todas
                        </Button>
                        {userCategories.map(category => {
                           const isOwnedCategory = true; 
                           const isCategoryEmptyForDeletion = !passwords.some(p => p.ownerId === firebaseUser.uid && p.categoria?.toLowerCase() === category.toLowerCase() && !p.isDeleted);

                           return (
                           <div key={category} className="relative group flex items-center">
                              <Button
                                 variant={activeTab === category ? "secondary" : "ghost"}
                                 size="sm"
                                 onClick={() => setActiveTab(category)}
                                 className={cn(
                                    "flex items-center gap-1.5 h-8 px-3 rounded-md pr-2",
                                    activeTab !== category && "hover:bg-secondary hover:text-secondary-foreground"
                                  )}
                              >
                                 <FolderKanban size={14} />
                                 {category}
                              </Button>
                              {isOwnedCategory && ( 
                                <Button
                                    asChild
                                    variant="ghost"
                                    size="icon"
                                    className="h-6 w-6 opacity-0 group-hover:opacity-100 hover:bg-accent/20 ml-0.5"
                                    title={`Compartilhar categoria "${category}"`}
                                    onClick={(e) => {
                                        e.stopPropagation(); e.preventDefault();
                                        handleOpenShareCategoryDialog(category);
                                    }}
                                >
                                  <div><Share2 size={12} className="text-accent/80 hover:text-accent" /></div>
                                </Button>
                              )}
                              {isOwnedCategory && isCategoryEmptyForDeletion && (
                                 <Button
                                    asChild
                                    variant="ghost"
                                    size="icon"
                                    className="h-6 w-6 opacity-0 group-hover:opacity-100 hover:bg-destructive/20 ml-0.5"
                                 >
                                    <div
                                       role="button"
                                       tabIndex={0}
                                       onClick={(e) => {
                                       e.stopPropagation(); e.preventDefault();
                                       setCategoryToDelete(category); setIsDeleteCategoryDialogOpen(true);
                                       }}
                                       onKeyDown={(e) => {
                                       if (e.key === 'Enter' || e.key === ' ') {
                                          e.stopPropagation(); e.preventDefault();
                                          setCategoryToDelete(category); setIsDeleteCategoryDialogOpen(true);
                                       }}}
                                       title={`Excluir categoria ${category}`}
                                    >
                                       <X size={12} className="text-destructive/80 hover:text-destructive" />
                                    </div>
                                 </Button>
                              )}
                           </div>
                           );
                        })}
                     </div>
                     <ScrollBar orientation="horizontal" />
                  </ScrollArea>
                  <AlertDialog open={isAddCategoryDialogOpen} onOpenChange={setIsAddCategoryDialogOpen}>
                     <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="icon" className="ml-2 shrink-0 hover:bg-secondary hover:text-secondary-foreground" onClick={() => setIsAddCategoryDialogOpen(true)}>
                           <Plus size={20} />
                           <span className="sr-only">Adicionar Nova Categoria</span>
                        </Button>
                     </AlertDialogTrigger>
                     <AlertDialogContent>
                        <AlertDialogHeader>
                           <AlertDialogTitle>Adicionar Nova Categoria</AlertDialogTitle>
                           <AlertDialogDescription>Digite o nome para a nova aba de categoria.</AlertDialogDescription>
                        </AlertDialogHeader>
                        <Input
                           placeholder="Nome da Categoria"
                           value={newCategoryName}
                           onChange={(e) => setNewCategoryName(e.target.value)}
                           onKeyDown={(e) => {
                           if (e.key === 'Enter') { e.preventDefault(); if(handleAddCategory()){ setIsAddCategoryDialogOpen(false); }}}}
                        />
                        <AlertDialogFooter>
                           <AlertDialogCancel onClick={() => { setNewCategoryName(''); setIsAddCategoryDialogOpen(false); }}>Cancelar</AlertDialogCancel>
                           <AlertDialogAction onClick={() => { if(handleAddCategory()){ setIsAddCategoryDialogOpen(false); }}}>Adicionar</AlertDialogAction>
                        </AlertDialogFooter>
                     </AlertDialogContent>
                  </AlertDialog>
               </div>
               <div className="mt-4">
                  <PasswordList
                     passwords={filteredPasswords}
                     isLoading={isLoading} 
                     onEdit={handleEditPassword}
                     onDelete={handleDeletePassword}
                     searchTerm={searchTerm}
                     activeTab={activeTab}
                     currentUserId={firebaseUser.uid}
                     userGroups={groups}
                  />
               </div>
            </div>
          </>
        )}
      </main>

      <AddEditPasswordDialog
        isOpen={isAddEditDialogOpen}
        onOpenChange={(open) => {
          setIsAddEditDialogOpen(open);
          if (!open) setEditingPassword(null);
        }}
        onSubmit={handleSubmitPasswordForm}
        initialData={editingPassword}
        userCategories={userCategories}
      />
      <ImportPasswordsDialog
        isOpen={isImportDialogOpen}
        onOpenChange={setIsImportDialogOpen}
        onImport={handleImport}
      />
      <PasswordGeneratorDialog
        isOpen={isGeneratorDialogOpen}
        onOpenChange={setIsGeneratorDialogOpen}
        generatePasswordFunc={generatePassword}
      />
      <ClearAllPasswordsDialog
        isOpen={isClearAllDialogOpen}
        onOpenChange={setIsClearAllDialogOpen}
        onConfirm={handleClearAllPasswords}
      />
      {firebaseUser && typeof shareCategoryWithGroup === 'function' && typeof unshareCategoryFromGroup === 'function' && typeof fetchCategorySharesForOwner === 'function' && (
        <ShareCategoryDialog
            isOpen={isShareCategoryDialogOpen}
            onOpenChange={(open) => {
                setIsShareCategoryDialogOpen(open);
                if (!open) setCategoryToShare(null);
            }}
            categoryName={categoryToShare || ''}
            ownerId={firebaseUser.uid}
            userGroups={groups}
            onShareCategoryWithGroup={shareCategoryWithGroup}
            onUnshareCategoryFromGroup={unshareCategoryFromGroup}
            fetchCategorySharesForOwner={fetchCategorySharesForOwner}
        />
      )}
       <AlertDialog open={isDeleteCategoryDialogOpen} onOpenChange={setIsDeleteCategoryDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Categoria "{categoryToDelete}"?</AlertDialogTitle>
            <AlertDialogDescription>
              Somente categorias vazias e que não estão compartilhadas podem ser excluídas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => { setIsDeleteCategoryDialogOpen(false); setCategoryToDelete(null); }}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmDeleteCategory} className="bg-destructive hover:bg-destructive/90">
              Confirmar Exclusão
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <footer className="text-center py-4 text-sm text-muted-foreground border-t mt-auto">
        SenhaFacil &copy; {currentYear !== null ? currentYear : new Date().getFullYear()}
      </footer>
    </div>
  );
}
