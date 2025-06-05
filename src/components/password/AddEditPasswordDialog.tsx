
'use client';

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useFieldArray } from "react-hook-form";
import * as z from "zod";
import type { PasswordEntry } from "@/types";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogClose,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useEffect } from "react";
import { PlusCircle, Trash2 } from "lucide-react";

const customFieldSchema = z.object({
  label: z.string().min(1, { message: "Nome do campo é obrigatório." }),
  value: z.string().min(1, { message: "Valor é obrigatório." }),
});

const passwordFormSchema = z.object({
  nome: z.string().min(1, { message: "Nome é obrigatório." }),
  login: z.string().min(1, { message: "Login é obrigatório." }),
  senha: z.string().optional(),
  categoria: z.string().optional(),
  customFields: z.array(customFieldSchema).optional(),
});

export type PasswordFormValues = z.infer<typeof passwordFormSchema>;

interface AddEditPasswordDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: PasswordFormValues, id?: string) => void;
  initialData?: PasswordEntry | Partial<PasswordEntry> | null;
  userCategories: string[];
}

export function AddEditPasswordDialog({ isOpen, onOpenChange, onSubmit, initialData, userCategories }: AddEditPasswordDialogProps) {
  const form = useForm<PasswordFormValues>({
    resolver: zodResolver(passwordFormSchema),
    defaultValues: {
      nome: "",
      login: "",
      senha: "",
      categoria: "",
      customFields: [],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "customFields",
  });

  useEffect(() => {
    if (isOpen) {
      form.reset({
        nome: initialData?.nome || "",
        login: initialData?.login || "",
        senha: initialData?.senha || "",
        categoria: initialData?.categoria || "",
        customFields: initialData?.customFields || [],
      });
    }
  }, [initialData, form, isOpen]);

  const handleSubmit = (data: PasswordFormValues) => {
    onSubmit(data, initialData?.id as string | undefined);
    onOpenChange(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md md:max-w-lg bg-card max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="font-headline text-primary">{initialData?.id ? "Editar Senha" : "Adicionar Nova Senha"}</DialogTitle>
          <DialogDescription>
            {initialData?.id ? "Atualize os detalhes da senha." : "Preencha os campos para adicionar uma nova senha."}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4 py-2 overflow-y-auto flex-grow pr-2">
            <FormField
              control={form.control}
              name="nome"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nome <span className="text-destructive">*</span></FormLabel>
                  <FormControl>
                    <Input placeholder="Ex: Servidor Principal" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="login"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Login <span className="text-destructive">*</span></FormLabel>
                  <FormControl>
                    <Input placeholder="Ex: admin" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="senha"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Senha</FormLabel>
                  <FormControl>
                    <Input type="password" placeholder="Deixe em branco para não alterar (se editando)" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="categoria"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Categoria</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione uma categoria" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="">Sem Categoria</SelectItem>
                      {userCategories.map((cat) => (
                        <SelectItem key={cat} value={cat}>
                          {cat}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <div className="space-y-3">
              <h3 className="text-sm font-medium text-foreground mt-4 mb-2">Campos Personalizados:</h3>
              {fields.map((field, index) => (
                <div key={field.id} className="flex items-end gap-2 p-3 border rounded-md bg-muted/50">
                  <FormField
                    control={form.control}
                    name={`customFields.${index}.label`}
                    render={({ field: labelField }) => (
                      <FormItem className="flex-1">
                        <FormLabel className="text-xs">Nome do Campo</FormLabel>
                        <FormControl>
                          <Input placeholder="Ex: IP, Observação" {...labelField} className="h-9 text-sm"/>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name={`customFields.${index}.value`}
                    render={({ field: valueField }) => (
                      <FormItem className="flex-1">
                        <FormLabel className="text-xs">Valor do Campo</FormLabel>
                        <FormControl>
                          <Input placeholder="Ex: 192.168.1.1" {...valueField} className="h-9 text-sm"/>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <Button type="button" variant="ghost" size="icon" onClick={() => remove(index)} className="h-9 w-9 shrink-0">
                    <Trash2 size={16} className="text-destructive" />
                  </Button>
                </div>
              ))}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => append({ label: "", value: "" })}
                className="mt-2 text-xs"
              >
                <PlusCircle size={16} className="mr-2" /> Adicionar Campo Personalizado
              </Button>
            </div>
            <DialogFooter className="mt-auto pt-4 sticky bottom-0 bg-card">
              <DialogClose asChild>
                <Button type="button" variant="outline">Cancelar</Button>
              </DialogClose>
              <Button type="submit" className="bg-accent hover:bg-accent/90 text-accent-foreground">
                {initialData?.id ? "Salvar Alterações" : "Adicionar Senha"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

