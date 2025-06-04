'use client';

import { useState, useEffect } from 'react';
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
import { Checkbox } from '@/components/ui/checkbox';
import { Slider } from '@/components/ui/slider';
import { useToast } from '@/hooks/use-toast';
import { Copy, RefreshCw, Zap } from 'lucide-react';

interface PasswordGeneratorDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  generatePasswordFunc: (length: number, useUppercase: boolean, useLowercase: boolean, useNumbers: boolean, useSymbols: boolean) => string;
}

export function PasswordGeneratorDialog({ isOpen, onOpenChange, generatePasswordFunc }: PasswordGeneratorDialogProps) {
  const [length, setLength] = useState(16);
  const [useUppercase, setUseUppercase] = useState(true);
  const [useLowercase, setUseLowercase] = useState(true);
  const [useNumbers, setUseNumbers] = useState(true);
  const [useSymbols, setUseSymbols] = useState(true);
  const [generatedPassword, setGeneratedPassword] = useState('');
  const { toast } = useToast();

  const handleGenerate = () => {
    if (!useUppercase && !useLowercase && !useNumbers && !useSymbols) {
        toast({ title: "Erro", description: "Selecione ao menos um tipo de caractere.", variant: "destructive" });
        return;
    }
    const newPassword = generatePasswordFunc(length, useUppercase, useLowercase, useNumbers, useSymbols);
    setGeneratedPassword(newPassword);
  };
  
  // Generate password on initial open or when options change while dialog is open
  useEffect(() => {
    if (isOpen) {
      handleGenerate();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, length, useUppercase, useLowercase, useNumbers, useSymbols]);


  const handleCopy = () => {
    if (!generatedPassword) {
      toast({ title: "Erro", description: "Nenhuma senha gerada para copiar.", variant: "destructive" });
      return;
    }
    navigator.clipboard.writeText(generatedPassword)
      .then(() => {
        toast({ title: "Copiado!", description: "Senha gerada copiada para a área de transferência." });
      })
      .catch(err => {
        console.error("Failed to copy generated password:", err);
        toast({ title: "Erro ao copiar", description: "Não foi possível copiar a senha.", variant: "destructive" });
      });
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md bg-card">
        <DialogHeader>
          <DialogTitle className="font-headline text-primary flex items-center gap-2"><Zap size={22}/> Gerador de Senhas</DialogTitle>
          <DialogDescription>
            Crie senhas fortes e aleatórias.
          </DialogDescription>
        </DialogHeader>
        <div className="py-4 space-y-6">
          <div className="flex items-center justify-between bg-muted p-3 rounded-md shadow-inner">
            <Input 
              type="text" 
              value={generatedPassword} 
              readOnly 
              className="text-lg font-mono flex-grow border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0"
              aria-label="Senha Gerada"
            />
            <Button variant="ghost" size="icon" onClick={handleGenerate} aria-label="Regerar Senha">
              <RefreshCw size={20} className="text-primary" />
            </Button>
            <Button variant="ghost" size="icon" onClick={handleCopy} aria-label="Copiar Senha Gerada">
              <Copy size={20} className="text-accent" />
            </Button>
          </div>

          <div className="space-y-2">
            <Label htmlFor="length" className="flex justify-between"><span>Comprimento:</span> <span className="font-bold text-primary">{length}</span></Label>
            <Slider
              id="length"
              min={8}
              max={64}
              step={1}
              value={[length]}
              onValueChange={(value) => setLength(value[0])}
              className="[&>span>span]:bg-primary"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex items-center space-x-2">
              <Checkbox id="uppercase" checked={useUppercase} onCheckedChange={(checked) => setUseUppercase(!!checked)} />
              <Label htmlFor="uppercase" className="cursor-pointer">Maiúsculas (A-Z)</Label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox id="lowercase" checked={useLowercase} onCheckedChange={(checked) => setUseLowercase(!!checked)} />
              <Label htmlFor="lowercase" className="cursor-pointer">Minúsculas (a-z)</Label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox id="numbers" checked={useNumbers} onCheckedChange={(checked) => setUseNumbers(!!checked)} />
              <Label htmlFor="numbers" className="cursor-pointer">Números (0-9)</Label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox id="symbols" checked={useSymbols} onCheckedChange={(checked) => setUseSymbols(!!checked)} />
              <Label htmlFor="symbols" className="cursor-pointer">Símbolos (!@#$...)</Label>
            </div>
          </div>
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline">Fechar</Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
