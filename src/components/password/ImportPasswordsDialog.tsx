
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
  onImport: (entries: Array<Omit<PasswordEntry, 'id'>>) => void; 
}

const FIXED_IMPORT_HEADERS = ["nome", "login", "senha"]; // These are the primary fields
const REQUIRED_HEADERS = ["nome", "login"]; // Minimum required for an entry

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

  const parseCSV = (csvText: string): Array<Omit<PasswordEntry, 'id'>> => {
    const lines = csvText.split(/\r\n|\n/).filter(line => line.trim() !== '');
    if (lines.length < 2) { 
      throw new Error("CSV inválido ou vazio. Precisa de cabeçalho e pelo menos uma linha de dados.");
    }

    const headerLine = lines[0];
    // More robust CSV parsing for headers to handle quoted fields with commas
    const headersFromFile = (headerLine.match(/(".*?"|[^",]+)(?=\s*,|\s*$)/g)
      ?.map(h => h.startsWith('"') && h.endsWith('"') ? h.slice(1, -1).replace(/""/g, '"') : h.trim().toLowerCase()) 
      || headerLine.split(',').map(h => h.trim().toLowerCase()));
    
    const missingRequiredHeaders = REQUIRED_HEADERS.filter(expected => !headersFromFile.includes(expected));
    if (missingRequiredHeaders.length > 0) {
      throw new Error(`Cabeçalho do CSV inválido. Colunas obrigatórias ausentes: ${missingRequiredHeaders.join(', ')}. As colunas mínimas são: ${REQUIRED_HEADERS.join(', ')}.`);
    }
    
    const headerMap: { [key: string]: number } = {};
    headersFromFile.forEach((header, index) => {
        headerMap[header] = index; 
    });

    const entries: Array<Omit<PasswordEntry, 'id'>> = [];
    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].match(/(".*?"|[^",]+)(?=\s*,|\s*$)/g)
                             ?.map(v => v.startsWith('"') && v.endsWith('"') ? v.slice(1, -1).replace(/""/g, '"') : v.trim()) 
                             || lines[i].split(',').map(v => v.trim());

      const nome = values[headerMap['nome']];
      const login = values[headerMap['login']];

      if (!nome || !login) { 
        console.warn(`Linha ${i+1} ignorada: Nome ou Login ausentes.`);
        continue;
      }

      const customFieldsToAdd: Array<{ label: string; value: string }> = [];
      headersFromFile.forEach((header, index) => {
        if (!FIXED_IMPORT_HEADERS.includes(header) && values[index] && values[index].trim() !== "") {
          // Treat any other header as a custom field label
          // The actual header name from file (before toLowerCase) should be used as label for fidelity
          const originalHeader = (headerLine.match(/(".*?"|[^",]+)(?=\s*,|\s*$)/g) 
                                ?.map(h => h.startsWith('"') && h.endsWith('"') ? h.slice(1,-1).replace(/""/g, '"') : h.trim())
                                || headerLine.split(',').map(h => h.trim()))[index];
          customFieldsToAdd.push({ label: originalHeader, value: values[index] });
        }
      });

      entries.push({
        nome,
        login,
        senha: headerMap['senha'] !== undefined ? values[headerMap['senha']] || undefined : undefined,
        customFields: customFieldsToAdd,
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
        const imported = onImport(parsedEntries); // onImport now returns the count of actually new entries
        if (imported.length > 0) {
          toast({ title: "Importação Concluída", description: `${imported.length} novas senhas importadas com sucesso.` });
        } else {
          toast({ title: "Nenhuma Nova Senha", description: "Nenhuma senha nova foi importada. Podem ser duplicatas ou o arquivo não ter dados válidos além do cabeçalho.", variant: "default" });
        }
        onOpenChange(false);
        setFile(null); 
      } else {
        toast({ title: "Nenhuma senha para importar", description: "O arquivo CSV não continha dados válidos ou todas as senhas já existem.", variant: "default" });
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
    // Model provides basic fields; users can add more columns for custom fields.
    const csvHeader = FIXED_IMPORT_HEADERS.join(',') + ",ExemploCampoPersonalizado1,ExemploCampoPersonalizado2";
    const exampleRow = '"Nome Exemplo","login.exemplo","senhaExemplo","Valor Exemplo 1","Valor Exemplo 2"';
    const csvContent = csvHeader + '\r\n' + exampleRow;

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
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
      <DialogContent className="sm:max-w-md md:max-w-lg bg-card">
        <DialogHeader>
          <DialogTitle className="font-headline text-primary">Importar Senhas de CSV</DialogTitle>
          <DialogDescription>
            Selecione um arquivo CSV. A primeira linha deve ser o cabeçalho. <br />
            Colunas obrigatórias: <code className="text-xs bg-muted p-1 rounded">{REQUIRED_HEADERS.join(', ')}</code>.<br />
            A coluna <code className="text-xs bg-muted p-1 rounded">senha</code> é opcional. <br />
            **Todas as outras colunas** no seu CSV serão importadas como campos personalizados (o nome da coluna será o rótulo do campo).
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
                <Download className="mr-2 h-4 w-4" /> Baixar Modelo CSV (com exemplos)
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
