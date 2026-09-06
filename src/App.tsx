import { BrowserRouter as Router } from 'react-router-dom';
import AppRoutes from './routes/AppRoutes';
import ScrollToTop from "./components/ScrollToTop.tsx";
import { IslandProvider } from './context/IslandContext';
import { AuthProvider } from './context/AuthContext';
import { PresenceHeartbeatTracker } from './components/community/PresenceHeartbeatTracker';

const App = () => {
   return (
      <AuthProvider>
         <IslandProvider>
            <Router>
               <ScrollToTop />
               <PresenceHeartbeatTracker />
               <AppRoutes />
            </Router>
         </IslandProvider>
      </AuthProvider>
   );
}

export default App;