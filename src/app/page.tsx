
'use client';

import { useState, useEffect, FormEvent } from 'react';
import { usePasswordManager } from '@/hooks/usePasswordManager';
import type { PasswordEntry, FirebaseUser } from '@/types';
import { Header } from '@/components/layout/Header';
import { PasswordList } from '@/components/password/PasswordList';
import { AddEditPasswordDialog, type PasswordFormValues } from '@/components/password/AddEditPasswordDialog';
import { ImportPasswordsDialog } from '@/components/password/ImportPasswordsDialog';
import { PasswordGeneratorDialog } from '@/components/password/PasswordGeneratorDialog';
import { ClearAllPasswordsDialog } from '@/components/password/ClearAllPasswordsDialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from '@/hooks/use-toast';
import { PlusCircle, Upload, Zap, Search, ShieldAlert, Trash2, FileDown, XCircle, UserPlus, LogIn, KeyRound } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

import { auth } from '@/lib/firebase'; // Import Firebase auth instance
import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged,
  type AuthError
} from 'firebase/auth';

export default function HomePage() {
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [authLoading, setAuthLoading] = useState(true); // For initial auth state check

  // States for auth forms
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);

  const { 
    passwords, 
    isLoading: passwordsLoading, 
    error: passwordManagerError,
    addPassword, 
    updatePassword, 
    deletePassword, 
    importPasswords: importPasswordsHook, 
    generatePassword,
    clearAllPasswords,
    exportPasswordsToCSV,
  } = usePasswordManager(firebaseUser?.uid); 
  const { toast } = useToast();

  const [isAddEditDialogOpen, setIsAddEditDialogOpen] = useState(false);
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [isGeneratorDialogOpen, setIsGeneratorDialogOpen] = useState(false);
  const [isClearAllDialogOpen, setIsClearAllDialogOpen] = useState(false);
  const [editingPassword, setEditingPassword] = useState<PasswordEntry | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [showSecurityNotice, setShowSecurityNotice] = useState(true);

  // Firebase Auth state listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setFirebaseUser(user);
      setAuthLoading(false);
      if (user) {
        // Clear auth form fields on successful login/state change
        setEmail('');
        setPassword('');
        setAuthError(null);
      }
    });
    return () => unsubscribe(); // Cleanup subscription on unmount
  }, []);

  const handleFirebaseError = (error: AuthError) => {
    console.error("Firebase Auth Error:", error);
    let errorMessage = "Ocorreu um erro de autenticação.";
    switch (error.code) {
      case 'auth/invalid-email':
        errorMessage = "Formato de email inválido.";
        break;
      case 'auth/user-disabled':
        errorMessage = "Esta conta de usuário foi desabilitada.";
        break;
      case 'auth/user-not-found':
        errorMessage = "Nenhum usuário encontrado com este email.";
        break;
      case 'auth/wrong-password':
        errorMessage = "Senha incorreta.";
        break;
      case 'auth/invalid-credential': // Added specific case
        errorMessage = "Email ou senha inválidos. Verifique os dados e tente novamente.";
        break;
      case 'auth/email-already-in-use':
        errorMessage = "Este email já está em uso por outra conta.";
        break;
      case 'auth/weak-password':
        errorMessage = "A senha é muito fraca. Use pelo menos 6 caracteres.";
        break;
      case 'auth/operation-not-allowed':
         errorMessage = "Operação não permitida. Login por email/senha pode estar desabilitado.";
         break;
      case 'auth/too-many-requests':
        errorMessage = "Muitas tentativas de login falharam. Tente novamente mais tarde.";
        break;
      default:
        errorMessage = (error as Error).message || "Ocorreu um erro de autenticação desconhecido.";
    }
    setAuthError(errorMessage);
    toast({ title: "Erro de Autenticação", description: errorMessage, variant: "destructive"});
  };

  const handleRegisterWithEmail = async (e: FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    if (!email || !password) {
      setAuthError("Email e senha são obrigatórios.");
      toast({ title: "Campos Vazios", description: "Email e senha são obrigatórios.", variant: "destructive" });
      return;
    }
    try {
      await createUserWithEmailAndPassword(auth, email, password);
      toast({ title: "Registro bem-sucedido!", description: "Você agora está logado." });
      // onAuthStateChanged will handle setting the user
    } catch (error) {
      handleFirebaseError(error as AuthError);
    }
  };

  const handleLoginWithEmail = async (e: FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    if (!email || !password) {
      setAuthError("Email e senha são obrigatórios.");
      toast({ title: "Campos Vazios", description: "Email e senha são obrigatórios.", variant: "destructive" });
      return;
    }
    try {
      await signInWithEmailAndPassword(auth, email, password);
      toast({ title: "Login bem-sucedido!", description: "Bem-vindo de volta!" });
      // onAuthStateChanged will handle setting the user
    } catch (error) {
      handleFirebaseError(error as AuthError);
    }
  };

  const handleLogoutFirebase = async () => {
    try {
      await signOut(auth);
      toast({ title: "Logout", description: "Você saiu da sua conta." });
      // onAuthStateChanged will handle clearing the user
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
    const entryToAdd: Omit<PasswordEntry, 'id' | 'userId'> = {
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
    const entryToUpdate: PasswordEntry = {
      id,
      userId: firebaseUser.uid, // Ensure userId is set
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
    if (id) {
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
        toast({ title: "Sucesso!", description: `Senha para "${entryToDelete.nome}" deletada.`, variant: "destructive" });
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
           toast({ title: "Nenhuma Nova Senha", description: result.message || "Nenhuma senha nova foi importada. Podem ser duplicatas ou o arquivo estar vazio.", variant: "default" });
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
    if (passwords.length === 0) {
      toast({ title: "Nada para Exportar", description: "Não há senhas para exportar.", variant: "default" });
      return;
    }
    const success = await exportPasswordsToCSV();
    if (success) {
      toast({ title: "Exportado!", description: "Suas senhas foram exportadas para senhas_backup.csv." });
    } else {
      toast({ title: "Erro na Exportação", description: "Não foi possível exportar as senhas.", variant: "destructive" });
    }
  };

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
              <Tabs defaultValue="login" className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="login">Login</TabsTrigger>
                  <TabsTrigger value="register">Registrar</TabsTrigger>
                </TabsList>
                <TabsContent value="login">
                  <form onSubmit={handleLoginWithEmail}>
                    <CardHeader>
                      <CardTitle className="font-headline text-2xl text-primary flex items-center gap-2"><LogIn size={24}/>Acessar Conta</CardTitle>
                      <CardDescription>Entre com seu email e senha para gerenciar suas senhas.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="space-y-1">
                        <Label htmlFor="login-email">Email</Label>
                        <Input id="login-email" type="email" placeholder="seu@email.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor="login-password">Senha</Label>
                        <Input id="login-password" type="password" placeholder="Sua senha" value={password} onChange={(e) => setPassword(e.target.value)} required />
                      </div>
                      {authError && <p className="text-sm text-destructive">{authError}</p>}
                    </CardContent>
                    <CardFooter>
                      <Button type="submit" className="w-full bg-primary hover:bg-primary/90">Entrar</Button>
                    </CardFooter>
                  </form>
                </TabsContent>
                <TabsContent value="register">
                   <form onSubmit={handleRegisterWithEmail}>
                    <CardHeader>
                      <CardTitle className="font-headline text-2xl text-primary flex items-center gap-2"><UserPlus size={24}/>Criar Nova Conta</CardTitle>
                      <CardDescription>Crie uma conta para começar a salvar suas senhas com segurança.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="space-y-1">
                        <Label htmlFor="register-email">Email</Label>
                        <Input id="register-email" type="email" placeholder="seu@email.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor="register-password">Senha</Label>
                        <Input id="register-password" type="password" placeholder="Crie uma senha forte" value={password} onChange={(e) => setPassword(e.target.value)} required />
                      </div>
                      {authError && <p className="text-sm text-destructive">{authError}</p>}
                    </CardContent>
                    <CardFooter>
                      <Button type="submit" className="w-full bg-accent hover:bg-accent/90 text-accent-foreground">Registrar</Button>
                    </CardFooter>
                  </form>
                </TabsContent>
              </Tabs>
            </Card>
          </div>
        ) : (
          <>
            {showSecurityNotice && (
              <div className="mb-6 p-4 border border-yellow-300 bg-yellow-50 rounded-md shadow relative">
                  <div className="flex items-start">
                      <ShieldAlert className="h-6 w-6 text-yellow-600 mr-3 shrink-0" />
                      <div className="flex-grow">
                          <h3 className="text-md font-semibold text-yellow-800 font-headline">Aviso de Segurança</h3>
                          <p className="text-sm text-yellow-700">
                              Este aplicativo agora armazena senhas em um banco de dados central. Certifique-se de que o acesso ao banco de dados e à aplicação esteja devidamente protegido conforme as políticas da sua intranet. As senhas são associadas ao seu email de login.
                          </p>
                      </div>
                      <Button variant="ghost" size="icon" onClick={() => setShowSecurityNotice(false)} className="ml-2 h-6 w-6 text-yellow-600 hover:text-yellow-800 absolute top-2 right-2">
                          <XCircle size={18} />
                      </Button>
                  </div>
              </div>
            )}

            {passwordManagerError && (
              <Alert variant="destructive" className="mb-4">
                <ShieldAlert className="h-5 w-5" />
                <AlertTitle>Erro de Conexão ou Dados</AlertTitle>
                <AlertDescription>
                  {passwordManagerError} Verifique a conexão com o banco de dados ou as configurações da API.
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
                  <Button onClick={() => { setEditingPassword(null); setIsAddEditDialogOpen(true); }} className="bg-primary hover:bg-primary/90">
                    <PlusCircle size={18} className="mr-2" /> Adicionar Nova
                  </Button>
                  <Button onClick={() => setIsImportDialogOpen(true)} variant="outline" className="hover:bg-secondary">
                    <Upload size={18} className="mr-2" /> Importar CSV
                  </Button>
                  <Button onClick={handleExportPasswords} variant="outline" className="hover:bg-secondary">
                    <FileDown size={18} className="mr-2" /> Exportar CSV
                  </Button>
                  <Button onClick={() => setIsGeneratorDialogOpen(true)} variant="outline" className="hover:bg-secondary">
                    <Zap size={18} className="mr-2" /> Gerar Senha
                  </Button>
                  <Button onClick={() => setIsClearAllDialogOpen(true)} variant="default" className="bg-destructive hover:bg-destructive/90 text-destructive-foreground">
                    <Trash2 size={18} className="mr-2" /> Limpar Tudo
                  </Button>
                </div>
              </div>
            </div>

            <PasswordList
              passwords={passwords}
              isLoading={passwordsLoading}
              onEdit={handleEditPassword}
              onDelete={handleDeletePassword}
              searchTerm={searchTerm}
            />
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
      <footer className="text-center py-4 text-sm text-muted-foreground border-t mt-auto">
        SenhaFacil &copy; {new Date().getFullYear()}
      </footer>
    </div>
  );
}

    