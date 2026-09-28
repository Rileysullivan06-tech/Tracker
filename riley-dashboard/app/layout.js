import './globals.css';

export const metadata = {
  title: 'Riley Dashboard',
  description: 'School, work, markets, news, and smart study planning in one place.'
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
