'use client';

import { useState } from 'react';
import type { PasswordEntry } from '@/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { Eye, EyeOff, Copy, Edit2, Trash2, ShieldCheck, ShieldAlert } from 'lucide-react';
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
} from "@/components/ui/alert-dialog"


interface PasswordListItemProps {
  entry: PasswordEntry;
  onEdit: (entry: PasswordEntry) => void;
  onDelete: (id: string) => void;
}

export function PasswordListItem({ entry, onEdit, onDelete }: PasswordListItemProps) {
  const [showPassword, setShowPassword] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const { toast } = useToast();

  const handleCopy = (text: string | undefined, fieldName: string) => {
    if (!text) {
      toast({ title: "Erro", description: "Nenhum valor para copiar.", variant: "destructive" });
      return;
    }
    navigator.clipboard.writeText(text)
      .then(() => {
        toast({ title: "Copiado!", description: `${fieldName} copiado para a área de transferência.` });
        setCopiedField(fieldName);
        setTimeout(() => setCopiedField(null), 1500);
      })
      .catch(err => {
        console.error("Failed to copy:", err);
        toast({ title: "Erro ao copiar", description: "Não foi possível copiar para a área de transferência.", variant: "destructive" });
      });
  };
  
  const passwordStrength = (password?: string): 'strong' | 'medium' | 'weak' => {
    if (!password || password.length === 0) return 'weak';
    const length = password.length;
    const hasUpper = /[A-Z]/.test(password);
    const hasLower = /[a-z]/.test(password);
    const hasNumber = /[0-9]/.test(password);
    const hasSymbol = /[^A-Za-z0-9]/.test(password);

    let score = 0;
    if (length >= 12) score += 2;
    else if (length >= 8) score += 1;
    
    if (hasUpper) score +=1;
    if (hasLower) score +=1;
    if (hasNumber) score +=1;
    if (hasSymbol) score +=1;

    if (score >= 5) return 'strong';
    if (score >= 3) return 'medium';
    return 'weak';
  };

  const strength = passwordStrength(entry.senha);

  return (
    <Card className="mb-4 shadow-lg hover:shadow-xl transition-shadow duration-300">
      <CardHeader>
        <div className="flex justify-between items-start">
          <div>
            <CardTitle className="font-headline text-xl text-primary">{entry.nome}</CardTitle>
            {entry.ip && <CardDescription className="text-sm text-muted-foreground">IP: {entry.ip}</CardDescription>}
          </div>
           {strength === 'strong' && <ShieldCheck className="text-green-500" size={24} />}
           {strength === 'medium' && <ShieldAlert className="text-yellow-500" size={24} />}
           {strength === 'weak' && <ShieldAlert className="text-red-500" size={24} />}
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          <div>
            <label className="text-sm font-medium text-foreground/80">Login:</label>
            <div className="flex items-center gap-2">
              <Input type="text" value={entry.login} readOnly className="bg-muted/50" />
              <Button
                variant="outline"
                size="icon"
                onClick={() => handleCopy(entry.login, "Login")}
                className={`transition-transform duration-150 ${copiedField === "Login" ? 'scale-110 bg-accent text-accent-foreground' : ''}`}
                aria-label="Copiar Login"
              >
                <Copy size={18} />
              </Button>
            </div>
          </div>
          <div>
            <label className="text-sm font-medium text-foreground/80">Senha:</label>
            <div className="flex items-center gap-2">
              <Input type={showPassword ? "text" : "password"} value={entry.senha || "N/A"} readOnly className="bg-muted/50" />
              <Button
                variant="outline"
                size="icon"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? "Esconder Senha" : "Mostrar Senha"}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={() => handleCopy(entry.senha, "Senha")}
                className={`transition-transform duration-150 ${copiedField === "Senha" ? 'scale-110 bg-accent text-accent-foreground' : ''}`}
                aria-label="Copiar Senha"
              >
                <Copy size={18} />
              </Button>
            </div>
          </div>
          {(entry.funcao || entry.acesso || entry.versao) && (
            <div className="text-sm space-y-1 pt-2">
              {entry.funcao && <p><strong className="text-foreground/80">Função:</strong> {entry.funcao}</p>}
              {entry.acesso && <p><strong className="text-foreground/80">Acesso:</strong> {entry.acesso}</p>}
              {entry.versao && <p><strong className="text-foreground/80">Versão:</strong> {entry.versao}</p>}
            </div>
          )}
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={() => onEdit(entry)} className="hover:bg-secondary">
            <Edit2 size={16} className="mr-1" /> Editar
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" size="sm" className="hover:bg-destructive/90">
                <Trash2 size={16} className="mr-1" /> Deletar
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Você tem certeza?</AlertDialogTitle>
                <AlertDialogDescription>
                  Esta ação não pode ser desfeita. Isso excluirá permanentemente a senha de <strong className="font-semibold">{entry.nome}</strong>.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={() => onDelete(entry.id)} className="bg-destructive hover:bg-destructive/90">Confirmar Exclusão</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

        </div>
      </CardContent>
    </Card>
  );
}
