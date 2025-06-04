'use client';

import { useState, ChangeEvent } from 'react';
import type { PasswordEntry } from '@/types';
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
import { useToast } from '@/hooks/use-toast';
import { UploadCloud, FileText, Download } from 'lucide-react';

interface ImportPasswordsDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onImport: (entries: Omit<PasswordEntry, 'id'>[]) => void;
}

// Expected CSV header columns (case-insensitive for parsing, but model will be lowercase)
const EXPECTED_HEADERS = ["nome", "ip", "login", "senha", "funcao", "acesso", "versao"];


export function ImportPasswordsDialog({ isOpen, onOpenChange, onImport }: ImportPasswordsDialogProps) {
  const [file, setFile] = useState<File | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const { toast } = useToast();

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      setFile(event.target.files[0]);
    } else {
      setFile(null);
    }
  };

  const parseCSV = (csvText: string): Omit<PasswordEntry, 'id'>[] => {
    const lines = csvText.split(/\r\n|\n/).filter(line => line.trim() !== '');
    if (lines.length < 2) { 
      throw new Error("CSV inválido ou vazio. Precisa de cabeçalho e pelo menos uma linha de dados.");
    }

    const headerLine = lines[0].toLowerCase();
    const headersFromFile = headerLine.split(',').map(h => h.trim());
    
    const missingHeaders = EXPECTED_HEADERS.filter(expected => !headersFromFile.includes(expected));
    if (missingHeaders.length > 0 && !EXPECTED_HEADERS.every(h => headersFromFile.includes(h))) {
       const allExpectedPresent = EXPECTED_HEADERS.every(expected => headersFromFile.includes(expected));
       if(!allExpectedPresent){
         throw new Error(`Cabeçalho do CSV inválido. Colunas esperadas (nesta ordem e com estes nomes): ${EXPECTED_HEADERS.join(', ')}. Colunas encontradas: ${headersFromFile.join(', ')}.`);
       }
    }
    
    const headerMap: { [key: string]: number } = {};
    EXPECTED_HEADERS.forEach(expectedHeader => {
        const index = headersFromFile.indexOf(expectedHeader);
        if (index !== -1) {
            headerMap[expectedHeader] = index;
        } else {
            // This case should be caught by the validation above, but as a safeguard:
            console.warn(`Coluna esperada "${expectedHeader}" não encontrada no cabeçalho do CSV.`);
        }
    });


    const entries: Omit<PasswordEntry, 'id'>[] = [];
    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',').map(v => v.trim()); // Simple split, assumes no commas within fields for now
      
      const nome = values[headerMap['nome']];
      const login = values[headerMap['login']];

      if (!nome || !login) { 
        console.warn(`Linha ${i+1} ignorada: Nome ou Login ausentes.`);
        continue;
      }

      entries.push({
        nome,
        ip: values[headerMap['ip']] || undefined,
        login,
        senha: values[headerMap['senha']] || undefined,
        funcao: values[headerMap['funcao']] || undefined,
        acesso: values[headerMap['acesso']] || undefined,
        versao: values[headerMap['versao']] || undefined,
      });
    }
    return entries;
  };

  const handleImportClick = async () => {
    if (!file) {
      toast({ title: "Nenhum arquivo selecionado", description: "Por favor, selecione um arquivo CSV.", variant: "destructive" });
      return;
    }

    setIsParsing(true);
    try {
      const fileText = await file.text();
      const parsedEntries = parseCSV(fileText);
      if (parsedEntries.length > 0) {
        onImport(parsedEntries);
        // toast is handled by parent component now
        onOpenChange(false);
        setFile(null); 
      } else {
        toast({ title: "Nenhuma senha para importar", description: "O arquivo CSV não continha dados válidos ou todas as senhas já existem.", variant: "destructive" });
      }
    } catch (error: any) {
      console.error("Erro ao importar CSV:", error);
      toast({ title: "Erro na Importação", description: error.message || "Falha ao processar o arquivo CSV.", variant: "destructive" });
    } finally {
      setIsParsing(false);
    }
  };
  
  const triggerFileInput = () => {
    document.getElementById('csv-file-input')?.click();
  };

  const handleDownloadModel = () => {
    const csvHeader = EXPECTED_HEADERS.join(',');
    const blob = new Blob([csvHeader], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    if (link.download !== undefined) {
        const url = URL.createObjectURL(blob);
        link.setAttribute("href", url);
        link.setAttribute("download", "modelo_importacao_senhas.csv");
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        toast({title: "Modelo Baixado", description: "modelo_importacao_senhas.csv foi baixado."})
    }
  };


  return (
    <Dialog open={isOpen} onOpenChange={(open) => { onOpenChange(open); if (!open) setFile(null); }}>
      <DialogContent className="sm:max-w-[480px] bg-card">
        <DialogHeader>
          <DialogTitle className="font-headline text-primary">Importar Senhas de CSV</DialogTitle>
          <DialogDescription>
            Selecione um arquivo CSV. A primeira linha deve ser o cabeçalho com as colunas: <br />
            <code className="text-xs bg-muted p-1 rounded">{EXPECTED_HEADERS.join(', ')}</code><br />
            As colunas 'nome' e 'login' são obrigatórias.
          </DialogDescription>
        </DialogHeader>
        <div className="py-4 space-y-4">
            <Input
              id="csv-file-input"
              type="file"
              accept=".csv"
              onChange={handleFileChange}
              className="hidden" 
            />
            <Button variant="outline" onClick={triggerFileInput} className="w-full justify-start text-left">
              {file ? <FileText className="mr-2 h-5 w-5 text-primary" /> : <UploadCloud className="mr-2 h-5 w-5 text-muted-foreground" />}
              {file ? file.name : "Escolher arquivo CSV..."}
            </Button>
            {file && (
                 <p className="text-xs text-muted-foreground">Arquivo selecionado: {file.name}</p>
            )}
            <Button variant="ghost" onClick={handleDownloadModel} className="w-full justify-start text-left text-sm text-accent hover:text-accent/90">
                <Download className="mr-2 h-4 w-4" /> Baixar Modelo CSV
            </Button>
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline">Cancelar</Button>
          </DialogClose>
          <Button
            type="button"
            onClick={handleImportClick}
            disabled={!file || isParsing}
            className="bg-accent hover:bg-accent/90 text-accent-foreground"
          >
            {isParsing ? "Importando..." : "Importar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
