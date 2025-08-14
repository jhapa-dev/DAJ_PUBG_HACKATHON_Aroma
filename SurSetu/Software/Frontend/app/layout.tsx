export const metadata = {
  title: 'LoRa GPS Live Map',
  description: 'Sender/Receiver map with OSRM routing and Serial Monitor'
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{ margin: 0 }}>{children}</body>
    </html>
  );
}
