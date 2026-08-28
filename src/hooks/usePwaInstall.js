import { useCallback, useEffect, useRef, useState } from 'react';

export function usePwaInstall() {
  const [installPrompt, setInstallPrompt] = useState(null);
  const [isInstalled, setIsInstalled] = useState(() => (
    typeof window !== 'undefined' && window.matchMedia?.('(display-mode: standalone)').matches
  ));
  const installInFlightRef = useRef(false);

  useEffect(() => {
    const handleBeforeInstall = (event) => {
      event.preventDefault();
      setInstallPrompt(event);
    };
    const handleInstalled = () => {
      installInFlightRef.current = false;
      setInstallPrompt(null);
      setIsInstalled(true);
    };
    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    window.addEventListener('appinstalled', handleInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
      window.removeEventListener('appinstalled', handleInstalled);
    };
  }, []);

  const install = useCallback(async () => {
    const promptEvent = installPrompt;
    if (!promptEvent || installInFlightRef.current) return null;

    // A beforeinstallprompt event is single-use. Mark it consumed before any
    // await so repeated taps cannot call prompt() twice with the same event.
    installInFlightRef.current = true;
    setInstallPrompt((current) => current === promptEvent ? null : current);
    try {
      await promptEvent.prompt();
      const choice = await promptEvent.userChoice;
      return choice?.outcome ?? null;
    } catch {
      // Installation is progressive enhancement. A rejected/invalidated
      // browser prompt must never become an unhandled rejection in the app.
      return null;
    } finally {
      installInFlightRef.current = false;
    }
  }, [installPrompt]);

  return { canInstall: Boolean(installPrompt), isInstalled, install };
}
