export const ALLOWED_EMAIL_DOMAINS = ['unifenas.br', 'aluno.unifenas.br', 'adm.unifenas.br'];

export function isAllowedEmail(email: string | null | undefined): boolean {
  const domain = email?.trim().toLowerCase().split('@')[1];
  return !!domain && ALLOWED_EMAIL_DOMAINS.includes(domain);
}
