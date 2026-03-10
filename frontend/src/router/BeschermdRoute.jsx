import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import Laadscherm from '../components/Laadscherm.jsx';

/**
 * BeschermdRoute — Higher-Order component voor toegangscontrole.
 *
 * Gedrag:
 *   1. Wacht op de auth-initialisatie (isLadend = true → toon laadscherm)
 *   2. Niet ingelogd → doorsturen naar /inloggen (met returnUrl)
 *   3. Ingelogd maar verkeerde rol → doorsturen naar / (of 403-pagina)
 *   4. Toegang verleend → toon de gewenste pagina
 *
 * @param {{ children: React.ReactNode, vereistAdmin?: boolean }} props
 */
export default function BeschermdRoute({ children, vereistAdmin = false }) {
  const { isIngelogd, isAdmin, isLadend } = useAuth();
  const locatie = useLocation();

  // Fase 1: Wacht op localStorage-check (normaal < 50ms)
  if (isLadend) {
    return <Laadscherm volledigeHoogte />;
  }

  // Fase 2: Niet ingelogd → stuur door naar login
  if (!isIngelogd) {
    return (
      <Navigate
        to="/inloggen"
        // Bewaar de huidige URL zodat we daarnaar terug kunnen keren na het inloggen
        state={{ returnUrl: locatie.pathname + locatie.search }}
        replace
      />
    );
  }

  // Fase 3: Admin-route maar niet admin
  if (vereistAdmin && !isAdmin) {
    return (
      <Navigate
        to="/"
        replace
      />
    );
  }

  // Fase 4: Toegang verleend
  return children;
}
