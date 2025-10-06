export const metadata = { title: "Burrito Bundles", description: "Buy fresh Solana bundles in 1 tap" };
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en"><body>{children}</body></html>
  );
}
