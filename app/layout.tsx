import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Robot Programador — Desafío de 3 niveles',
  description:
    'Programá los pasos del robot para llegar a la meta. Tres niveles, cronómetro y ranking.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
