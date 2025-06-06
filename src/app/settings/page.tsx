
'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Header } from '@/components/layout/Header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { auth } from '@/lib/firebase';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { KeyRound, LogIn, ArrowLeft, ShieldCheck, Info, Copy, Check, UserSquare2 } from 'lucide-react'; // Added Copy, Check, UserSquare2
import type { FirebaseUser } from '@/types';
import { cn } from '@/lib/utils';

export default function SettingsPage() {
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [currentYear, setCurrentYear] = useState<number | null>(null);
  const { toast } = useToast();
  const router = useRouter();
  const [copiedUid, setCopiedUid] = useState(false);

  useEffect(() => {
    setCurrentYear(new Date().getFullYear());
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setFirebaseUser(user);
      setAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);
  
  const handleLogoutFirebase = async () => {
    try {
      await signOut(auth);
      toast({ title: "Logout", description: "Você saiu da sua conta." });
      router.push('/'); 
    } catch (error) {
      console.error("Logout Error:", error);
      toast({ title: "Erro no Logout", description: (error as Error).message, variant: "destructive" });
    }
  };

  const handleCopyUid = () => {
    if (firebaseUser?.uid) {
      navigator.clipboard.writeText(firebaseUser.uid)
        .then(() => {
          setCopiedUid(true);
          toast({ title: "UID Copiado!", description: "Seu ID de usuário foi copiado para a área de transferência." });
          setTimeout(() => setCopiedUid(false), 2000);
        })
        .catch(err => {
          console.error("Failed to copy UID:", err);
          toast({ title: "Erro ao copiar UID", description: "Não foi possível copiar o UID.", variant: "destructive" });
        });
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
              <p className="text-muted-foreground mb-6">Você precisa estar logado para acessar as configurações da sua conta.</p>
              <Button asChild className="w-full">
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

  return (
    <div className="min-h-screen flex flex-col">
      <Header user={firebaseUser} onLogout={handleLogoutFirebase} />
      <main className="container mx-auto py-8 px-4 flex-grow">
        <Button variant="ghost" asChild className="mb-6 text-primary hover:bg-primary/10 hover:text-primary">
          <Link href="/">
            <ArrowLeft size={18} className="mr-2" />
            Voltar para Início
          </Link>
        </Button>

        <Card className="w-full max-w-lg mx-auto shadow-xl">
          <CardHeader>
            <CardTitle className="font-headline text-2xl text-primary">Configurações da Conta</CardTitle>
            <CardDescription>Informações sobre sua conta e segurança.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
                <p className="text-sm font-medium text-foreground">Email Conectado:</p>
                <p className="text-sm text-muted-foreground bg-muted p-3 rounded-md break-all">{firebaseUser.email}</p>
            </div>

            <div className="space-y-2">
                <p className="text-sm font-medium text-foreground">UID do Usuário (ID de Autenticação):</p>
                <div className="flex items-center gap-2 bg-muted p-3 rounded-md">
                    <UserSquare2 size={18} className="text-muted-foreground shrink-0"/>
                    <p className="text-sm text-muted-foreground break-all flex-grow" title={firebaseUser.uid}>
                        {firebaseUser.uid}
                    </p>
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={handleCopyUid}
                        className={cn(
                          "h-7 w-7 shrink-0 transition-transform duration-150",
                          copiedUid
                            ? 'scale-110 bg-primary text-primary-foreground hover:bg-primary/90' // Mantém o hover primário quando copiado
                            : 'text-muted-foreground hover:bg-secondary hover:text-secondary-foreground' // Usa hover secundário quando não copiado
                        )}
                        aria-label="Copiar UID"
                    >
                        {copiedUid ? <Check size={14} /> : <Copy size={14} />}
                    </Button>
                </div>
                <p className="text-xs text-muted-foreground">Este é o seu identificador único no sistema. Pode ser útil para suporte ou depuração.</p>
            </div>
            
            <div className="flex items-start text-sm text-muted-foreground bg-secondary/70 p-4 rounded-md border border-input">
              <Info size={28} className="mr-3 shrink-0 text-primary mt-0.5" /> 
              <div>
                <h3 className="font-semibold text-foreground mb-1">Gerenciamento de Conta Google</h3>
                Como você acessa o SenhaFacil utilizando sua conta Google, as configurações de segurança, incluindo a alteração de senha e a autenticação de dois fatores, são gerenciadas diretamente através das configurações da sua conta Google.
                <Button 
                  variant="link" 
                  className="p-0 h-auto mt-2 text-primary"
                  asChild
                >
                  <a 
                    href="https://myaccount.google.com/security" 
                    target="_blank" 
                    rel="noopener noreferrer"
                  >
                    Acessar configurações de segurança do Google
                  </a>
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </main>
      <footer className="text-center py-4 text-sm text-muted-foreground border-t mt-auto">
        SenhaFacil &copy; {currentYear !== null ? currentYear : new Date().getFullYear()}
      </footer>
    </div>
  );
}
