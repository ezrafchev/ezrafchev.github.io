import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'TRIDRA 3D — Manufatura Digital Premium',
  description: 'Impressão 3D, portfólio, pedidos, login, pagamentos e cotação de frete para a TRIDRA.'
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
