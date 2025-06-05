
'use client';

import { useState } from 'react';
import type { PasswordEntry } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Eye, EyeOff, Copy, Edit2, Trash2, ShieldCheck, ShieldAlert, FolderKanban } from 'lucide-react';
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
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';


interface PasswordListItemProps {
  entry: PasswordEntry;
  onEdit: (entry: PasswordEntry) => void;
  onDelete: (id: string) => void;
}

export function PasswordListItem({ entry, onEdit, onDelete }: PasswordListItemProps) {
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
    <Card className="mb-3 shadow-lg hover:shadow-xl transition-shadow duration-300 rounded-md">
      <CardHeader className="py-3 px-4 flex flex-row justify-between items-start gap-3">
        {/* Seção Esquerda: Título, Categoria, Ícone de Força */}
        <div className="flex-grow min-w-0">
          <div className="flex items-start justify-between">
            <div className="min-w-0"> {/* Para truncar o título */}
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
                    copiedField === `nome-${entry.id}` ? 'scale-110 bg-accent text-accent-foreground' : 'text-muted-foreground hover:text-accent'
                  )}
                  aria-label="Copiar Nome"
                >
                  <Copy size={14} />
                </Button>
              </div>
            </div>
            <div className="shrink-0 flex items-center ml-2"> {/* Ícone de Força */}
              {strength === 'strong' && <ShieldCheck className="text-green-500" size={20} />}
              {strength === 'medium' && <ShieldAlert className="text-yellow-500" size={20} />}
              {strength === 'weak' && <ShieldAlert className="text-red-500" size={20} />}
            </div>
          </div>
          {entry.categoria && (
            <div className="flex items-center mt-0.5"> {/* Categoria abaixo do título */}
              <Badge variant="secondary" className="text-xs py-0.5 px-1.5">
                <FolderKanban size={12} className="mr-1"/> {entry.categoria}
              </Badge>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => handleCopy(entry.categoria, "Categoria", `categoria-${entry.id}`)}
                className={cn(
                  "h-5 w-5 ml-1 shrink-0 transition-transform duration-150",
                  copiedField === `categoria-${entry.id}` ? 'scale-110 bg-accent text-accent-foreground' : 'text-muted-foreground hover:text-accent'
                )}
                aria-label="Copiar Categoria"
              >
                <Copy size={10} />
              </Button>
            </div>
          )}
        </div>

        {/* Seção Direita: Botões de Ação */}
        <div className="flex items-center gap-2 shrink-0">
          <Button variant="outline" size="sm" onClick={() => onEdit(entry)} className="text-xs h-8 px-3 hover:bg-secondary">
            <Edit2 size={14} className="mr-1.5" /> Editar
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" size="sm" className="text-xs h-8 px-3 hover:bg-destructive/90">
                <Trash2 size={14} className="mr-1.5" /> Deletar
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
                copiedField === `login-${entry.id}` ? 'scale-110 bg-accent text-accent-foreground' : 'text-muted-foreground hover:text-accent'
              )}
              aria-label="Copiar Login"
            >
              <Copy size={14} />
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
              className="h-7 w-7 ml-1 shrink-0 text-muted-foreground hover:text-accent"
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
                copiedField === `senha-${entry.id}` ? 'scale-110 bg-accent text-accent-foreground' : 'text-muted-foreground hover:text-accent'
              )}
              aria-label="Copiar Senha"
            >
              <Copy size={14} />
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
                        copiedField === `customFieldValue-${entry.id}-${index}` ? 'scale-110 bg-accent text-accent-foreground' : 'text-muted-foreground hover:text-accent'
                      )}
                      aria-label={`Copiar valor do campo ${field.label}`}
                    >
                      <Copy size={12} />
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
