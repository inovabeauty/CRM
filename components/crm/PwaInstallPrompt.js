import React, { useState, useEffect } from 'react';

export default function PwaInstallPrompt({ isOpen, onClose }) {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [isStandalone, setIsStandalone] = useState(false);
  const [isIos, setIsIos] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Detecta se já está rodando instalado em modo tela cheia (standalone)
    const isInStandaloneMode = window.matchMedia('(display-mode: standalone)').matches || 
      window.navigator.standalone === true;
    setIsStandalone(isInStandaloneMode);

    // Detecta dispositivo iOS (iPhone / iPad)
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isIosDevice = /iphone|ipad|ipod/.test(userAgent);
    setIsIos(isIosDevice);

    // Captura o evento nativo de instalação do Android Chrome / Chromium
    const handleBeforeInstall = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
    };
  }, []);

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setDeferredPrompt(null);
        if (onClose) onClose();
      }
    }
  };

  if (!isOpen || isStandalone) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-sm rounded-2xl bg-gradient-to-b from-[#18181f] to-[#0f0f13] border border-amber-500/30 p-6 shadow-2xl text-white">
        {/* Fechar */}
        <button
          onClick={onClose}
          type="button"
          className="absolute top-4 right-4 text-gray-400 hover:text-white p-1 rounded-lg transition"
          aria-label="Fechar"
        >
          ✕
        </button>

        {/* Ícone e Título */}
        <div className="flex flex-col items-center text-center space-y-3">
          <div className="w-16 h-16 rounded-2xl bg-black/60 border border-amber-500/40 p-2 shadow-inner flex items-center justify-center">
            <img src="/icon-192.png" alt="Inova Logo" className="w-12 h-12 object-contain" />
          </div>

          <div>
            <h3 className="text-base font-bold tracking-wide text-amber-400">Instalar CRM Inova</h3>
            <p className="text-xs text-gray-400 mt-1">
              Acesse mais rápido direto da tela de início do celular, com mapa e rotas em tela cheia.
            </p>
          </div>
        </div>

        {/* Instruções por Plataforma */}
        <div className="mt-5 pt-4 border-t border-white/10 text-xs space-y-3">
          {deferredPrompt ? (
            <button
              onClick={handleInstallClick}
              type="button"
              className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-black font-bold tracking-wide shadow-lg shadow-amber-500/20 active:scale-[0.98] transition flex items-center justify-center gap-2"
            >
              <span>📲</span> Instalar Aplicativo Agora
            </button>
          ) : isIos ? (
            <div className="bg-black/40 rounded-xl p-3.5 border border-white/5 space-y-2 text-gray-300">
              <p className="font-semibold text-amber-400 flex items-center gap-1.5">
                <span>🍏</span> No iPhone / iPad (Safari):
              </p>
              <ol className="list-decimal list-inside space-y-1.5 text-[11px] text-gray-300">
                <li>Toque no botão de <strong>Compartilhar</strong> (ícone de quadrado com seta para cima ⎋ / 📤 na barra do navegador).</li>
                <li>Role para baixo e toque em <strong>&quot;Adicionar à Tela de Início&quot;</strong>.</li>
                <li>Confirme tocando em <strong>&quot;Adicionar&quot;</strong> no canto superior direito.</li>
              </ol>
            </div>
          ) : (
            <div className="bg-black/40 rounded-xl p-3.5 border border-white/5 space-y-2 text-gray-300">
              <p className="font-semibold text-amber-400 flex items-center gap-1.5">
                <span>🤖</span> No Android / Chrome:
              </p>
              <ol className="list-decimal list-inside space-y-1.5 text-[11px] text-gray-300">
                <li>Toque no menu de <strong>3 pontinhos (⋮)</strong> no canto superior do navegador.</li>
                <li>Toque em <strong>&quot;Instalar aplicativo&quot;</strong> ou <strong>&quot;Adicionar à tela inicial&quot;</strong>.</li>
              </ol>
            </div>
          )}
        </div>

        <div className="mt-4 text-center">
          <button
            onClick={onClose}
            type="button"
            className="text-xs text-gray-400 hover:text-gray-200 underline transition"
          >
            Continuar no navegador
          </button>
        </div>
      </div>
    </div>
  );
}
