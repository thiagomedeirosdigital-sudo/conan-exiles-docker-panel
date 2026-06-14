export const metadata = {
  title: 'Servidor Conan',
  description: 'Painel de gerenciamento do servidor Conan',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  )
}
