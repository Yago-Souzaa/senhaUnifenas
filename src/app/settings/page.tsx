
'use client';

import { useState, useEffect, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Header } from '@/components/layout/Header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { auth } from '@/lib/firebase';
import { onAuthStateChanged, updatePassword, signOut, type AuthError, type User } from 'firebase/auth';
import { KeyRound, LogIn, ArrowLeft, ShieldCheck, ShieldX } from 'lucide-react';
import type { FirebaseUser } from '@/types';

export default function SettingsPage() {
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const { toast } = useToast();
  const router = useRouter();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setFirebaseUser(user);
      setAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handlePasswordChange = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);

    if (!firebaseUser) {
      setError("Usuário não autenticado.");
      toast({ title: "Erro", description: "Usuário não autenticado.", variant: "destructive" });
      return;
    }

    if (newPassword.length < 6) {
      setError("A nova senha deve ter pelo menos 6 caracteres.");
      toast({ title: "Senha Curta", description: "A nova senha deve ter pelo menos 6 caracteres.", variant: "destructive" });
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("As senhas não coincidem.");
      toast({ title: "Erro", description: "As novas senhas não coincidem.", variant: "destructive" });
      return;
    }

    setIsUpdating(true);
    try {
      await updatePassword(firebaseUser, newPassword);
      setSuccessMessage("Senha alterada com sucesso! Você pode precisar fazer login novamente com sua nova senha se for deslogado.");
      toast({ title: "Sucesso!", description: "Sua senha foi alterada." });
      setNewPassword('');
      setConfirmPassword('');
      // O Firebase pode deslogar o usuário ou invalidar a sessão após a troca de senha em alguns casos.
      // Esteja preparado para ser redirecionado para a tela de login.
    } catch (authError) {
      const error = authError as AuthError;
      console.error("Erro ao alterar senha:", error);
      let userFriendlyMessage = "Ocorreu um erro ao tentar alterar sua senha.";
      if (error.code === 'auth/requires-recent-login') {
        userFriendlyMessage = "Esta operação é sensível e requer autenticação recente. Por favor, faça login novamente e tente de novo.";
        // Opcional: Deslogar o usuário para forçar o re-login
        await signOut(auth);
        router.push('/'); // Redireciona para a home para login
      } else if (error.code === 'auth/weak-password') {
        userFriendlyMessage = "A senha fornecida é muito fraca. Por favor, escolha uma senha mais forte.";
      }
      setError(userFriendlyMessage);
      toast({ title: "Erro ao Alterar Senha", description: userFriendlyMessage, variant: "destructive" });
    } finally {
      setIsUpdating(false);
    }
  };
  
  const handleLogoutFirebase = async () => {
    try {
      await signOut(auth);
      toast({ title: "Logout", description: "Você saiu da sua conta." });
      router.push('/'); // Redireciona para a home após logout
    } catch (error) {
      console.error("Logout Error:", error);
      toast({ title: "Erro no Logout", description: (error as Error).message, variant: "destructive" });
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
        <Header user={null} />
        <main className="container mx-auto py-8 px-4 flex-grow flex flex-col items-center justify-center">
          <Card className="w-full max-w-md text-center shadow-xl">
            <CardHeader>
              <CardTitle className="font-headline text-2xl text-primary flex items-center justify-center gap-2">
                <LogIn size={24} /> Acesso Necessário
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground mb-6">Você precisa estar logado para acessar as configurações da sua conta.</p>
              <Button asChild className="bg-primary hover:bg-primary/90 w-full">
                <Link href="/">Ir para Login</Link>
              </Button>
            </CardContent>
          </Card>
        </main>
         <footer className="text-center py-4 text-sm text-muted-foreground border-t mt-auto">
            SenhaFacil &copy; {new Date().getFullYear()}
        </footer>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Header user={firebaseUser} onLogout={handleLogoutFirebase} />
      <main className="container mx-auto py-8 px-4 flex-grow">
        <Button variant="default" asChild className="mb-6">
          <Link href="/">
            <ArrowLeft size={18} className="mr-2" />
            Voltar para Início
          </Link>
        </Button>

        <Card className="w-full max-w-lg mx-auto shadow-xl">
          <form onSubmit={handlePasswordChange}>
            <CardHeader>
              <CardTitle className="font-headline text-2xl text-primary">Configurações da Conta</CardTitle>
              <CardDescription>Altere sua senha abaixo.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="new-password">Nova Senha</Label>
                <Input
                  id="new-password"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Mínimo 6 caracteres"
                  required
                  className="text-base"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm-password">Confirmar Nova Senha</Label>
                <Input
                  id="confirm-password"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Repita a nova senha"
                  required
                  className="text-base"
                />
              </div>
              {error && (
                <div className="flex items-center text-sm text-destructive bg-destructive/10 p-3 rounded-md">
                  <ShieldX size={18} className="mr-2 shrink-0" /> {error}
                </div>
              )}
              {successMessage && (
                 <div className="flex items-center text-sm text-green-700 bg-green-500/10 p-3 rounded-md">
                    <ShieldCheck size={18} className="mr-2 shrink-0" /> {successMessage}
                </div>
              )}
            </CardContent>
            <CardFooter>
              <Button type="submit" disabled={isUpdating} className="w-full bg-accent hover:bg-accent/90 text-accent-foreground">
                {isUpdating ? 'Alterando Senha...' : 'Alterar Senha'}
              </Button>
            </CardFooter>
          </form>
        </Card>
      </main>
      <footer className="text-center py-4 text-sm text-muted-foreground border-t mt-auto">
        SenhaFacil &copy; {new Date().getFullYear()}
      </footer>
    </div>
  );
}
