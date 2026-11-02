import { Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { PairingGate } from './screens/PairingGate';
import { HomeScreen } from './screens/HomeScreen';
import { EntryScreen } from './screens/EntryScreen';
import { StyleConsentScreen } from './screens/StyleConsentScreen';
import { CaptureScreen } from './screens/CaptureScreen';
import { GenerationScreen } from './screens/GenerationScreen';
import { ResultScreen } from './screens/ResultScreen';
import { useIdleReset } from './hooks/useIdleReset';
import { useKiosk } from './state/kiosk-context';
import { useBrandTheme } from './hooks/useBrandTheme';

const IDLE_TIMEOUT_MS = 60000;
// Generation drives its own timeout, Result its own 20s reset, and Home is already the target.
const IDLE_RESET_DISABLED_PATHS = ['/', '/generating', '/result'];

export default function App() {
  const location = useLocation();
  const navigate = useNavigate();
  const { state, dispatch } = useKiosk();
  useBrandTheme(state.config?.branding);

  useIdleReset(
    IDLE_TIMEOUT_MS,
    () => {
      dispatch({ type: 'RESET_FLOW' });
      navigate('/');
    },
    !IDLE_RESET_DISABLED_PATHS.includes(location.pathname),
  );

  return (
    <PairingGate>
      <Routes>
        <Route path="/" element={<HomeScreen />} />
        <Route path="/entry" element={<EntryScreen />} />
        <Route path="/style" element={<StyleConsentScreen />} />
        <Route path="/capture" element={<CaptureScreen />} />
        <Route path="/generating" element={<GenerationScreen />} />
        <Route path="/result" element={<ResultScreen />} />
      </Routes>
    </PairingGate>
  );
}
