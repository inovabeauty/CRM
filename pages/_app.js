import '../styles/globals.css';
import Head from 'next/head';
import { AuthProvider, useAuth } from '../lib/authContext';
import { useRouter } from 'next/router';
import { useEffect } from 'react';

function RouteGuard({ children }) {
  const { user, loading } = useAuth();
  const router = useRouter();

  const isPublicPath = router.pathname === '/login';

  useEffect(() => {
    if (!loading && !user && !isPublicPath) {
      router.replace('/login');
    }
  }, [user, loading, isPublicPath, router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0e0e11]">
        <span className="loading loading-spinner text-amber-500 loading-lg"></span>
      </div>
    );
  }

  if (!user && !isPublicPath) {
    return null;
  }

  return children;
}

export default function App({ Component, pageProps }) {
  // Registro do Service Worker para suporte PWA no celular
  useEffect(() => {
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js').catch((err) => {
          console.warn('Registro do Service Worker falhou:', err);
        });
      });
    }
  }, []);

  return (
    <>
      <Head>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=0, viewport-fit=cover" />
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#0e0e11" />
        
        {/* Suporte PWA para iOS Safari (Adicionar à Tela de Início) */}
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="CRM Inova" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        
        {/* Favicon */}
        <link rel="icon" type="image/png" href="/icon-192.png" />
      </Head>
      
      <AuthProvider>
        <RouteGuard>
          <Component {...pageProps} />
        </RouteGuard>
      </AuthProvider>
    </>
  );
}
