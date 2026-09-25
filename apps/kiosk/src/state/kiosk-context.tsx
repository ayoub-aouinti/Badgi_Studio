import { createContext, useContext, useMemo, useReducer, type ReactNode } from 'react';
import type { KioskConfigDto } from '@badgi-studio/shared';

interface Participant {
  id: string;
  firstName: string;
  lastName: string;
}

interface PortraitResult {
  publicCode: string;
  resultUrl: string;
  framedUrl: string;
}

interface KioskState {
  config: KioskConfigDto | null;
  participant: Participant | null;
  styleId: string | null;
  sessionId: string | null;
  selfiePreviewUrl: string | null;
  portraitId: string | null;
  portraitResult: PortraitResult | null;
}

type Action =
  | { type: 'SET_CONFIG'; config: KioskConfigDto }
  | { type: 'SET_PARTICIPANT'; participant: Participant }
  | { type: 'SET_STYLE'; styleId: string }
  | { type: 'SET_SESSION'; sessionId: string }
  | { type: 'SET_SELFIE'; url: string }
  | { type: 'SET_PORTRAIT_ID'; portraitId: string }
  | { type: 'SET_PORTRAIT_RESULT'; result: PortraitResult }
  | { type: 'RESET_FLOW' }
  | { type: 'RESTART_FOR_NEW_STYLE' };

const initialState: KioskState = {
  config: null,
  participant: null,
  styleId: null,
  sessionId: null,
  selfiePreviewUrl: null,
  portraitId: null,
  portraitResult: null,
};

function reducer(state: KioskState, action: Action): KioskState {
  switch (action.type) {
    case 'SET_CONFIG':
      return { ...state, config: action.config };
    case 'SET_PARTICIPANT':
      return { ...state, participant: action.participant };
    case 'SET_STYLE':
      return { ...state, styleId: action.styleId };
    case 'SET_SESSION':
      return { ...state, sessionId: action.sessionId };
    case 'SET_SELFIE':
      return { ...state, selfiePreviewUrl: action.url };
    case 'SET_PORTRAIT_ID':
      return { ...state, portraitId: action.portraitId };
    case 'SET_PORTRAIT_RESULT':
      return { ...state, portraitResult: action.result };
    case 'RESTART_FOR_NEW_STYLE':
      return {
        ...state,
        styleId: null,
        sessionId: null,
        selfiePreviewUrl: null,
        portraitId: null,
        portraitResult: null,
      };
    case 'RESET_FLOW':
      return { ...initialState, config: state.config };
    default:
      return state;
  }
}

const KioskContext = createContext<{ state: KioskState; dispatch: React.Dispatch<Action> } | null>(
  null,
);

export function KioskProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const value = useMemo(() => ({ state, dispatch }), [state]);
  return <KioskContext.Provider value={value}>{children}</KioskContext.Provider>;
}

export function useKiosk() {
  const ctx = useContext(KioskContext);
  if (!ctx) throw new Error('useKiosk must be used within KioskProvider');
  return ctx;
}
