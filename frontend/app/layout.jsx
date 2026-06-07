import './globals.css';
import { AuthProvider } from '../context/AuthContext';

export const metadata = {
  title: "Job Digest Portal",
  description: 'Personal job digest and application tracker',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="bg-gray-50 min-h-screen text-gray-900">
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
