import { Outlet } from "react-router-dom";
import Navbar from "../components/Navbar.tsx";
import Footer from "../components/Footer.tsx";
import { SuggestionModal } from "../components/suggestions/SuggestionModal.tsx";
import CommandPalette from "../components/CommandPalette.tsx";
import OfflineIndicator from "../components/OfflineIndicator.tsx";
import KeyboardShortcutsModal from "../components/KeyboardShortcutsModal.tsx";
import AdSenseManager from "../components/AdSenseManager.tsx";

export function IndexLayout() {
    return (
        <>
            <AdSenseManager />
            <Navbar />
            <main id="wrapper" style={{ minHeight: '100vh' }}>
                <Outlet />
            </main>
            <Footer />
            <SuggestionModal />
            <CommandPalette />
            <OfflineIndicator />
            <KeyboardShortcutsModal />
        </>
    );
}