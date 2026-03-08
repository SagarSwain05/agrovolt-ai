import './globals.css'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'AgroVolt AI — Bio-Solar Intelligence Platform',
  description: "India's first AI-powered Agrivoltaic Operating System. Optimize crop yield, solar panel efficiency, water usage, and market selling times simultaneously using Physics-Informed AI.",
  keywords: ['agrivoltaic', 'solar farming', 'AI', 'crop intelligence', 'carbon credits', 'India'],
  authors: [{ name: 'Team Quantum Quirtz' }],
  openGraph: {
    title: 'AgroVolt AI — Cultivating Energy. Harvesting Intelligence.',
    description: "India's first Bio-Solar Intelligence Platform for Agrivoltaic Farming",
    type: 'website',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
