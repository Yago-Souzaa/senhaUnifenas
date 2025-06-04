
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
import { UploadCloud, FileText, Download, Columns } from 'lucide-react';

interface ImportPasswordsDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  // Changed: onImport now returns void as HomePage handles the result toast.
  onImport: (entries: Array<Omit<PasswordEntry, 'id'>>) => void;
}

// Defines which columns are absolutely required in the CSV header.
const BASE_REQUIRED_HEADERS = ["nome", "login"];
// Defines common optional columns that the model CSV will include as examples.
// 'senha' and 'categoria' are primary fields, others will become custom fields.
const COMMON_OPTIONAL_HEADERS = ["senha", "categoria", "exemplo_campo_personalizado_1", "exemplo_campo_personalizado_2"];


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
    if (lines.length === 0) {
      throw new Error("CSV vazio.");
    }
    // If only a header line is present, it's not an error but results in 0 entries.
    if (lines.length === 1) {
       console.warn("CSV contém apenas cabeçalho. Nenhuma senha para importar.");
       return [];
    }

    const headerLine = lines[0];
    const headersFromFile = (headerLine.match(/(".*?"|[^",]+)(?=\s*,|\s*$)/g)
      ?.map(h => h.startsWith('"') && h.endsWith('"') ? h.slice(1, -1).replace(/""/g, '"').trim() : h.trim())
      || headerLine.split(',').map(h => h.trim()));

    const lowercasedHeadersFromFile = headersFromFile.map(h => h.toLowerCase());

    const missingRequiredHeaders = BASE_REQUIRED_HEADERS.filter(expected => !lowercasedHeadersFromFile.includes(expected));
    if (missingRequiredHeaders.length > 0) {
      throw new Error(`Cabeçalho do CSV inválido. Colunas obrigatórias ausentes: ${missingRequiredHeaders.join(', ')}. As colunas mínimas são: ${BASE_REQUIRED_HEADERS.join(', ')}.`);
    }

    const headerMap: { [key: string]: number } = {};
    headersFromFile.forEach((originalHeader, index) => {
        headerMap[originalHeader.toLowerCase()] = index;
    });

    const entries: Array<Omit<PasswordEntry, 'id'>> = [];
    for (let i = 1; i < lines.length; i++) { // Start from the second line (data)
      const values = lines[i].match(/(".*?"|[^",]+)(?=\s*,|\s*$)/g)
                             ?.map(v => v.startsWith('"') && v.endsWith('"') ? v.slice(1, -1).replace(/""/g, '"') : v.trim())
                             || lines[i].split(',').map(v => v.trim());

      // Ensure the row has enough values for the mapped headers, otherwise it might be a malformed line
      if (values.length < headersFromFile.length && lines[i].trim() !== "") {
        // If a line isn't empty but doesn't parse to enough values, it might be an issue.
        // However, simple split by comma might be too naive if some fields are empty at the end.
        // The current regex handles quoted empty fields. Let's assume values.length matches headersFromFile.length or is less if trailing commas.
      }


      const entry: Partial<Omit<PasswordEntry, 'id'>> & { customFields: Array<{label: string, value: string}> } = {
        customFields: [],
      };

      entry.nome = values[headerMap['nome']];
      entry.login = values[headerMap['login']];

      if (typeof headerMap['senha'] !== 'undefined') {
        entry.senha = values[headerMap['senha']] || undefined;
      }
      if (typeof headerMap['categoria'] !== 'undefined') {
        entry.categoria = values[headerMap['categoria']] || undefined;
      }

      if (!entry.nome || !entry.login) {
        console.warn(`Linha ${i+1} ignorada: Nome ou Login ausentes.`);
        continue;
      }

      // Process all other columns as custom fields
      headersFromFile.forEach((originalHeader, index) => {
        const lowerHeader = originalHeader.toLowerCase();
        // Add as custom field if it's not one of the main fields and has a value
        if (![...BASE_REQUIRED_HEADERS, 'senha', 'categoria'].includes(lowerHeader) && values[index] && values[index].trim() !== "") {
          entry.customFields.push({ label: originalHeader, value: values[index] });
        }
      });
      entries.push(entry as Omit<PasswordEntry, 'id'>);
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
      
      // Call onImport (which is HomePage.handleImport). 
      // HomePage.handleImport is responsible for calling usePasswordManager.importPasswords
      // and showing toasts based on the actual number of newly imported entries.
      onImport(parsedEntries);
      
      // The ImportPasswordsDialog itself no longer shows toasts about import success/failure counts,
      // as HomePage does this more accurately based on the hook's response.
      // An empty parsedEntries array (e.g. from a header-only CSV) will be handled by HomePage's logic
      // (likely resulting in "Nenhuma Nova Senha").

      onOpenChange(false);
      setFile(null);
    } catch (error: any) {
      console.error("Erro ao importar CSV:", error);
      // This toast is for errors during file reading or parsing within this dialog.
      toast({ title: "Erro na Importação", description: error.message || "Falha ao processar o arquivo CSV.", variant: "destructive" });
    } finally {
      setIsParsing(false);
    }
  };

  const triggerFileInput = () => {
    document.getElementById('csv-file-input')?.click();
  };

  const handleDownloadModel = () => {
    const exampleHeaders = [...BASE_REQUIRED_HEADERS, ...COMMON_OPTIONAL_HEADERS];
    const csvHeader = exampleHeaders.map(h => `"${h.replace(/"/g, '""')}"`).join(',');

    // Create an example data row that corresponds to the headers
    const exampleRowData = [
        "App Exemplo", // nome
        "user@example.com", // login
        "senha#123", // senha
        "Servidores", // categoria
        "Valor para Exemplo 1", // exemplo_campo_personalizado_1
        "Outro Valor Exemplo" // exemplo_campo_personalizado_2
    ];
    // Ensure exampleRowData has the same number of elements as exampleHeaders
    while (exampleRowData.length < exampleHeaders.length) {
        exampleRowData.push(""); // Add empty strings for any remaining example headers
    }


    const exampleRow = exampleRowData.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',');
    
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
          <DialogTitle className="font-headline text-primary flex items-center gap-2"><Columns size={20} /> Importar Senhas de CSV</DialogTitle>
          <DialogDescription>
            Selecione um arquivo CSV. A primeira linha deve ser o cabeçalho. <br />
            Colunas obrigatórias: <code className="text-xs bg-muted p-1 rounded">{BASE_REQUIRED_HEADERS.join(', ')}</code>.<br />
            As colunas <code className="text-xs bg-muted p-1 rounded">senha</code> e <code className="text-xs bg-muted p-1 rounded">categoria</code> são opcionais e recomendadas.<br />
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

