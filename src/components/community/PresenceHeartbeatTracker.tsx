import React, { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../../context/useAuth';
import { sendPresenceHeartbeat, sendPresenceLeave } from '../../utils/communityPresenceApi';

/**
 * Global component mounted inside <Router> that sends continuous real-time presence heartbeats
 * to the ChoPaeng backend server for online telemetry and active resident tracking.
 */
export const PresenceHeartbeatTracker: React.FC = () => {
    const location = useLocation();
    const { user } = useAuth();

    // Heartbeat on route navigation or user auth state update
    useEffect(() => {
        sendPresenceHeartbeat(location.pathname, user);
    }, [location.pathname, user]);

    // Periodic heartbeat every 25 seconds
    useEffect(() => {
        const interval = setInterval(() => {
            sendPresenceHeartbeat(location.pathname, user);
        }, 25_000);

        return () => clearInterval(interval);
    }, [location.pathname, user]);

    // Send departure beacon when closing browser tab or navigating away
    useEffect(() => {
        const handleBeforeUnload = () => {
            sendPresenceLeave();
        };

        window.addEventListener('beforeunload', handleBeforeUnload);
        return () => window.removeEventListener('beforeunload', handleBeforeUnload);
    }, []);

    return null;
};
