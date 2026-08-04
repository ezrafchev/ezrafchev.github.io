import { createClient } from '@/src/lib/supabase-server';

async function cadastrar(formData: FormData) {
  'use server';
  const email = String(formData.get('email') || '');
  const password = String(formData.get('password') || '');
  const nome = String(formData.get('nome') || '');
  const supabase = createClient();
  const redirectTo = `${process.env.NEXT_PUBLIC_SITE_URL}/auth/callback`;
  await supabase.auth.signUp({ email, password, options: { emailRedirectTo: redirectTo, data: { nome } } });
}

export default function Cadastro() {
  return <main className="wrap section"><a className="brand" href="/">TRIDRA <span>3D</span></a><h1 className="h1">Criar conta.</h1><div className="card"><form action={cadastrar}><label>Nome<input className="input" name="nome" required /></label><label>E-mail<input className="input" type="email" name="email" required /></label><label>Senha<input className="input" type="password" name="password" minLength={6} required /></label><button className="btn" type="submit">Criar conta e confirmar por e-mail</button></form><p className="muted">O Supabase enviará o e-mail de confirmação quando as variáveis estiverem configuradas.</p></div></main>;
}
