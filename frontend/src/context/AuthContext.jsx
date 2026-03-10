import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

// ── Constanten ─────────────────────────────────────────────────────────────────
const TOKEN_SLEUTEL   = 'calamapp_jwt';
const GEBRUIKER_SLEUTEL = 'calamapp_gebruiker';

// ── Hulpfuncties ───────────────────────────────────────────────────────────────

/**
 * Parseert de payload van een JWT-token zonder externe bibliotheek.
 * Valideert de vervaldatum en geeft null terug bij een ongeldig of verlopen token.
 *
 * @param {string} token
 * @returns {{ id: number, naam: string, rol: 'Admin'|'Medewerker', exp: number }|null}
 */
function parseerJWT(token) {
  try {
    if (!token || typeof token !== 'string') return null;

    // JWT bestaat uit drie base64url-gecodeerde secties: header.payload.signature
    const delen = token.split('.');
    if (delen.length !== 3) return null;

    // base64url → base64 → JSON
    const base64 = delen[1].replace(/-/g, '+').replace(/_/g, '/');
    const payload = JSON.parse(atob(base64));

    // Controleer vervaldatum (exp is Unix-tijdstempel in seconden)
    if (payload.exp && Date.now() / 1000 > payload.exp) {
      return null; // Token verlopen
    }

    return payload;
  } catch {
    return null;
  }
}

/**
 * Berekent hoeveel milliseconden er nog resten tot het token verloopt.
 * Geeft 0 terug als het token al verlopen is.
 *
 * @param {{ exp: number }} payload
 * @returns {number}
 */
function berekenVerloopMs(payload) {
  if (!payload?.exp) return 0;
  return Math.max(0, payload.exp * 1000 - Date.now());
}

// ── Context aanmaken ───────────────────────────────────────────────────────────

const AuthContext = createContext(null);

// ── AuthProvider ───────────────────────────────────────────────────────────────

/**
 * AuthProvider — biedt JWT-authenticatiestatus aan de hele applicatie.
 *
 * State:
 *   token       {string|null}   — De ruwe JWT-string
 *   gebruiker   {object|null}   — Geparseerde payload: { id, naam, rol }
 *   isLadend    {boolean}       — True tijdens het initialiseren (localStorage-check)
 *
 * Functies:
 *   inloggen(token)  — Slaat het token op en werkt de state bij
 *   uitloggen()      — Wist alle auth-data en stuurt door naar /inloggen
 *   isAdmin()        — True als de gebruiker de rol 'Admin' heeft
 *
 * @param {{ children: React.ReactNode }} props
 */
export function AuthProvider({ children }) {
  const [token,     setToken]     = useState(null);
  const [gebruiker, setGebruiker] = useState(null);
  const [isLadend,  setIsLadend]  = useState(true);

  // ── Initialisatie: herstel sessie vanuit localStorage ─────────────────────
  useEffect(() => {
    const opgeslagenToken = localStorage.getItem(TOKEN_SLEUTEL);
    if (opgeslagenToken) {
      const payload = parseerJWT(opgeslagenToken);
      if (payload) {
        // Token is nog geldig — herstel de sessie
        setToken(opgeslagenToken);
        setGebruiker({ id: payload.id, naam: payload.naam, rol: payload.rol });
      } else {
        // Token verlopen — opruimen
        localStorage.removeItem(TOKEN_SLEUTEL);
        localStorage.removeItem(GEBRUIKER_SLEUTEL);
      }
    }
    setIsLadend(false);
  }, []);

  // ── Auto-uitloggen bij verlopen token ────────────────────────────────────
  useEffect(() => {
    if (!token) return;
    const payload = parseerJWT(token);
    if (!payload) return;

    const verloopMs = berekenVerloopMs(payload);
    if (verloopMs <= 0) {
      uitloggen();
      return;
    }

    // Stel een timer in die 30 seconden vóór vervaldatum uitlogt
    const timerMs = Math.max(verloopMs - 30_000, 0);
    const timer   = setTimeout(uitloggen, timerMs);

    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  // ── Acties ────────────────────────────────────────────────────────────────

  /**
   * Slaat het JWT-token op in memory én localStorage.
   * Wordt aangeroepen na een succesvolle POST /api/auth/inloggen.
   *
   * @param {string} nieuwToken
   */
  const inloggen = useCallback((nieuwToken) => {
    const payload = parseerJWT(nieuwToken);
    if (!payload) {
      console.error('[Auth] Ontvangen token is ongeldig of verlopen.');
      return;
    }

    localStorage.setItem(TOKEN_SLEUTEL, nieuwToken);
    setToken(nieuwToken);
    setGebruiker({ id: payload.id, naam: payload.naam, rol: payload.rol });
  }, []);

  /**
   * Wist alle auth-state en localStorage-data.
   * Pagina-omleiding wordt afgehandeld door BeschermdRoute.
   */
  const uitloggen = useCallback(() => {
    localStorage.removeItem(TOKEN_SLEUTEL);
    localStorage.removeItem(GEBRUIKER_SLEUTEL);
    setToken(null);
    setGebruiker(null);
  }, []);

  // ── Afgeleide waarden ─────────────────────────────────────────────────────

  const isIngelogd = Boolean(token && gebruiker);
  const isAdmin    = gebruiker?.rol === 'Admin';

  // Memoïseer de contextwaarde zodat consumers alleen re-renderen bij echte verandering
  const waarde = useMemo(() => ({
    token,
    gebruiker,
    isIngelogd,
    isAdmin,
    isLadend,
    inloggen,
    uitloggen,
  }), [token, gebruiker, isIngelogd, isAdmin, isLadend, inloggen, uitloggen]);

  return (
    <AuthContext.Provider value={waarde}>
      {children}
    </AuthContext.Provider>
  );
}

// ── Hook ───────────────────────────────────────────────────────────────────────

/**
 * Hook: geeft de auth-context terug.
 * Gooit een fout als buiten een AuthProvider gebruikt.
 *
 * @returns {{ token: string|null, gebruiker: object|null, isIngelogd: boolean,
 *             isAdmin: boolean, isLadend: boolean, inloggen: Function, uitloggen: Function }}
 */
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth() moet binnen een <AuthProvider> worden gebruikt.');
  }
  return context;
}

export default AuthContext;
