const produtos = [
  ['Suporte estrutural PETG', 'Peça funcional sob demanda para casa, oficina ou empresa.', 'R$ 39,90'],
  ['Brinde corporativo 3D', 'Chaveiros, placas e kits com identidade da sua marca.', 'Sob orçamento'],
  ['Protótipo TRIDRA Lab', 'Desenvolvimento, teste e validação de produto.', 'Sob projeto']
];

export default function Home() {
  return <main>
    <header className="nav"><div className="wrap navin"><a className="brand" href="/">TRIDRA <span>3D</span></a><nav className="menu"><a href="#servicos">Serviços</a><a href="#loja">Loja</a><a href="/cadastro">Criar conta</a><a href="/login">Login</a></nav><a className="btn" href="/checkout">Comprar</a></div></header>
    <section className="hero wrap"><div><div className="eyebrow">Manufatura digital premium</div><h1 className="h1">Ideias em forma.</h1><p className="lead">A TRIDRA 3D cria peças, produtos, protótipos e brindes personalizados com precisão, acabamento e visão de engenharia.</p><p><a className="btn" href="#loja">Ver produtos</a> <a className="btn secondary" href="/cadastro">Criar conta</a></p></div></section>
    <section id="servicos" className="section wrap"><h2>Precisão em cada camada.</h2><div className="grid"><div className="card"><h3>TRIDRA 3D</h3><p className="muted">Impressão 3D profissional, personalizados, brindes, peças úteis e pequenos lotes.</p></div><div className="card"><h3>TRIDRA Lab</h3><p className="muted">Prototipagem, modelagem, validação, pesquisa e desenvolvimento de produtos.</p></div><div className="card"><h3>Pedidos online</h3><p className="muted">Conta de cliente, checkout, pagamentos e cotação de frete integráveis por Supabase, Mercado Pago e Melhor Envio.</p></div></div></section>
    <section id="loja" className="section wrap"><h2>Loja inicial</h2><div className="grid">{produtos.map((p) => <div className="card product" key={p[0]}><span className="pill">TRIDRA</span><h3>{p[0]}</h3><p className="muted">{p[1]}</p><div className="price">{p[2]}</div><a className="btn" href="/checkout">Comprar / cotar</a></div>)}</div></section>
    <section className="section wrap"><div className="card"><h3>Ativação de produção</h3><p className="muted">Este repositório contém as rotas reais para Supabase Auth, Mercado Pago Checkout Pro e Melhor Envio. A ativação final exige inserir tokens privados no painel da Netlify, nunca no GitHub.</p><p className="mono">NEXT_PUBLIC_SUPABASE_URL · MERCADO_PAGO_ACCESS_TOKEN · MELHOR_ENVIO_ACCESS_TOKEN</p></div></section>
    <footer className="footer"><div className="wrap">TRIDRA 3D — Precisão, clareza, inovação e confiabilidade.</div></footer>
  </main>;
}
