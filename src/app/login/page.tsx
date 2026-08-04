import { createClient } from '../../lib/supabase-server';

async function entrar(formData: FormData) {
  'use server';
  const email = String(formData.get('email') || '');
  const password = String(formData.get('password') || '');
  const supabase = createClient();
  await supabase.auth.signInWithPassword({ email, password });
}

export default function Login() {
  return <main className="wrap section"><a className="brand" href="/">TRIDRA <span>3D</span></a><h1 className="h1">Entrar.</h1><div className="card"><form action={entrar}><label>E-mail<input className="input" type="email" name="email" required /></label><label>Senha<input className="input" type="password" name="password" required /></label><button className="btn" type="submit">Entrar</button></form><p className="muted">Use esta área após confirmar o e-mail da conta.</p></div></main>;
}
