import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useIslandData } from '../../context/useIslandData';
import { useAuth } from '../../context/useAuth';
import { playChimeClick, playWaveChime, playWaveBackChime } from '../../utils/kkAudioSynthesizer';
import {
    getStoredTheme,
    type ThemeMode,
} from '../../utils/theme';
import {
    getTrafficStats,
    recordSiteVisit,
    calculateIslandOccupancy,
    getOnlineResidentsList,
    fetchOnlinePresence,
    sendPresenceHeartbeat,
    broadcastResidentWave,
    pollPendingWaves,
    type OnlineResident,
    type TrafficStats,
    type WaveNotification,
} from '../../utils/communityPresenceApi';

interface RadarThemeConfig {
    name: string;
    icon: string;
    telemetryTag: string;
    telemetrySub: string;
    overlayBg: string;
    modalBg: string;
    modalBorder: string;
    modalShadow: string;
    headerGradient: string;
    headerBorder: string;
    headerIconBg: string;
    navBg: string;
    navBorder: string;
    tabInactiveColor: string;
    tabHoverBg: string;
    tabActiveBg: string;
    tabActiveColor: string;
    tabActiveGlow: string;
    countPillInactiveBg: string;
    countPillInactiveColor: string;
    bodyBg: string;
    cardBg: string;
    cardBorder: string;
    textColor: string;
    mutedColor: string;
    filterInactiveColor: string;
    filterHoverBg: string;
    filterActiveBg: string;
    filterActiveColor: string;
    filterActiveBorder: string;
    filterActiveGlow: string;
    inputBg: string;
    inputBorder: string;
    inputColor: string;
    inputPlaceholder: string;
    residentRowBorder: string;
    residentRowHover: string;
    youRowBg: string;
    youBadgeColor: string;
    statusOnlineDot: string;
    statusDotRing: string;
    statCardBg: string;
    statCardBorder: string;
    statLabelColor: string;
    flightCardHeader: string;
    flightCardHeaderBorder: string;
    flightCardBody: string;
    flightLabelColor: string;
    flightValueColor: string;
    flightDividerColor: string;
    flightFooterBg: string;
    progressTrackBg: string;
    progressBarBg: string;
    seatFilledBg: string;
    seatFilledGlow: string;
    seatEmptyBg: string;
    dodoTicketBg: string;
    dodoTicketBorder: string;
    dodoTicketLabel: string;
    dodoTicketCode: string;
    terminalHeaderBg: string;
    terminalBodyBg: string;
    digitBoxBg: string;
    digitBoxColor: string;
    digitBoxBorder: string;
    digitBoxGlow: string;
    milestoneCardBg: string;
    milestoneCardBorder: string;
    milestoneTitleColor: string;
    milestoneTextColor: string;
    footerBg: string;
    footerBorder: string;
    footerText: string;
}

const THEME_CONFIGS: Record<ThemeMode, RadarThemeConfig> = {
    nook: {
        name: 'Nook Classic',
        icon: 'fa-leaf',
        telemetryTag: 'Nook Inc. Island Network',
        telemetrySub: 'Online Residents · Island Occupancy · Lifetime Traffic',
        overlayBg: 'rgba(28, 54, 38, 0.65)',
        modalBg: '#ffffff',
        modalBorder: '#e2e8f0',
        modalShadow: '0 25px 60px -15px rgba(27, 112, 69, 0.35)',
        headerGradient: 'linear-gradient(135deg, #166534 0%, #15803d 45%, #16a34a 100%)',
        headerBorder: '4px solid #f5c452',
        headerIconBg: 'rgba(255, 255, 255, 0.2)',
        navBg: '#ffffff',
        navBorder: '#e9ecef',
        tabInactiveColor: '#64748b',
        tabHoverBg: 'rgba(0, 0, 0, 0.04)',
        tabActiveBg: '#16a34a',
        tabActiveColor: '#ffffff',
        tabActiveGlow: '0 4px 14px rgba(22, 163, 74, 0.35)',
        countPillInactiveBg: 'rgba(0, 0, 0, 0.07)',
        countPillInactiveColor: '#64748b',
        bodyBg: '#f6f9f3',
        cardBg: '#ffffff',
        cardBorder: '#e2e8f0',
        textColor: '#1e293b',
        mutedColor: '#64748b',
        filterInactiveColor: '#64748b',
        filterHoverBg: 'rgba(0, 0, 0, 0.04)',
        filterActiveBg: '#ffffff',
        filterActiveColor: '#166534',
        filterActiveBorder: '#16a34a',
        filterActiveGlow: '0 4px 12px rgba(22, 163, 74, 0.18)',
        inputBg: '#ffffff',
        inputBorder: '#cbd5e1',
        inputColor: '#0f172a',
        inputPlaceholder: '#94a3b8',
        residentRowBorder: '#f1f5f9',
        residentRowHover: 'rgba(22, 163, 74, 0.04)',
        youRowBg: '#f0fdf4',
        youBadgeColor: '#16a34a',
        statusOnlineDot: '#16a34a',
        statusDotRing: '#ffffff',
        statCardBg: '#ffffff',
        statCardBorder: '#e2e8f0',
        statLabelColor: '#64748b',
        flightCardHeader: '#0284c7',
        flightCardHeaderBorder: '#f5c452',
        flightCardBody: '#f8fafc',
        flightLabelColor: '#64748b',
        flightValueColor: '#0f172a',
        flightDividerColor: '#e2e8f0',
        flightFooterBg: '#0369a1',
        progressTrackBg: '#e2e8f0',
        progressBarBg: '#f5c452',
        seatFilledBg: '#16a34a',
        seatFilledGlow: 'rgba(22, 163, 74, 0.35)',
        seatEmptyBg: '#cbd5e1',
        dodoTicketBg: '#fef3c7',
        dodoTicketBorder: '#f59e0b',
        dodoTicketLabel: '#b45309',
        dodoTicketCode: '#78350f',
        terminalHeaderBg: '#1e293b',
        terminalBodyBg: '#0f172a',
        digitBoxBg: 'rgba(15, 23, 42, 0.8)',
        digitBoxColor: '#4ade80',
        digitBoxBorder: 'rgba(74, 222, 128, 0.4)',
        digitBoxGlow: 'rgba(74, 222, 128, 0.45)',
        milestoneCardBg: '#ffffff',
        milestoneCardBorder: '#e2e8f0',
        milestoneTitleColor: '#0f172a',
        milestoneTextColor: '#64748b',
        footerBg: '#0f172a',
        footerBorder: '#1e293b',
        footerText: 'rgba(255, 255, 255, 0.85)',
    },
    celeste: {
        name: 'Celeste Galaxy',
        icon: 'fa-star',
        telemetryTag: 'Celeste Observatory Starlight Feed',
        telemetrySub: 'Starlight Radios · Gate Teleportation · Celestial Flights',
        overlayBg: 'rgba(11, 15, 25, 0.82)',
        modalBg: '#131b2e',
        modalBorder: 'rgba(139, 92, 246, 0.35)',
        modalShadow: '0 25px 60px -15px rgba(124, 58, 237, 0.4)',
        headerGradient: 'linear-gradient(135deg, #3b0764 0%, #581c87 40%, #7c3aed 100%)',
        headerBorder: '4px solid #fbbf24',
        headerIconBg: 'rgba(255, 255, 255, 0.18)',
        navBg: '#18233a',
        navBorder: 'rgba(139, 92, 246, 0.22)',
        tabInactiveColor: '#94a3b8',
        tabHoverBg: 'rgba(139, 92, 246, 0.14)',
        tabActiveBg: '#8b5cf6',
        tabActiveColor: '#ffffff',
        tabActiveGlow: '0 4px 18px rgba(139, 92, 246, 0.55)',
        countPillInactiveBg: 'rgba(255, 255, 255, 0.1)',
        countPillInactiveColor: '#c4b5fd',
        bodyBg: '#0b101d',
        cardBg: '#18233a',
        cardBorder: 'rgba(139, 92, 246, 0.25)',
        textColor: '#f8fafc',
        mutedColor: '#a5b4fc',
        filterInactiveColor: '#94a3b8',
        filterHoverBg: 'rgba(139, 92, 246, 0.12)',
        filterActiveBg: '#231b42',
        filterActiveColor: '#fcd34d',
        filterActiveBorder: '#a78bfa',
        filterActiveGlow: '0 4px 14px rgba(167, 139, 250, 0.3)',
        inputBg: '#0f172a',
        inputBorder: 'rgba(167, 139, 250, 0.35)',
        inputColor: '#f8fafc',
        inputPlaceholder: '#818cf8',
        residentRowBorder: 'rgba(139, 92, 246, 0.15)',
        residentRowHover: 'rgba(139, 92, 246, 0.08)',
        youRowBg: 'rgba(139, 92, 246, 0.18)',
        youBadgeColor: '#fcd34d',
        statusOnlineDot: '#a78bfa',
        statusDotRing: '#18233a',
        statCardBg: '#18233a',
        statCardBorder: 'rgba(139, 92, 246, 0.25)',
        statLabelColor: '#a5b4fc',
        flightCardHeader: '#6d28d9',
        flightCardHeaderBorder: '#fcd34d',
        flightCardBody: '#0f172a',
        flightLabelColor: '#a5b4fc',
        flightValueColor: '#f8fafc',
        flightDividerColor: 'rgba(167, 139, 250, 0.2)',
        flightFooterBg: '#4c1d95',
        progressTrackBg: 'rgba(139, 92, 246, 0.25)',
        progressBarBg: '#fbbf24',
        seatFilledBg: '#a78bfa',
        seatFilledGlow: 'rgba(167, 139, 250, 0.5)',
        seatEmptyBg: 'rgba(139, 92, 246, 0.2)',
        dodoTicketBg: '#261b42',
        dodoTicketBorder: '#a78bfa',
        dodoTicketLabel: '#c4b5fd',
        dodoTicketCode: '#fde047',
        terminalHeaderBg: '#1e293b',
        terminalBodyBg: '#090d16',
        digitBoxBg: 'rgba(30, 27, 75, 0.6)',
        digitBoxColor: '#fde047',
        digitBoxBorder: 'rgba(253, 224, 71, 0.45)',
        digitBoxGlow: 'rgba(253, 224, 71, 0.55)',
        milestoneCardBg: '#18233a',
        milestoneCardBorder: 'rgba(139, 92, 246, 0.25)',
        milestoneTitleColor: '#f8fafc',
        milestoneTextColor: '#a5b4fc',
        footerBg: '#090d16',
        footerBorder: 'rgba(139, 92, 246, 0.25)',
        footerText: 'rgba(196, 181, 253, 0.85)',
    },
    roost: {
        name: 'The Roost Cafe',
        icon: 'fa-mug-hot',
        telemetryTag: 'The Roost Coffee Parlor Telemetry',
        telemetrySub: 'Brewster Airwaves · Warm Counter Logs · Global Visitors',
        overlayBg: 'rgba(20, 18, 16, 0.82)',
        modalBg: '#241e1b',
        modalBorder: 'rgba(217, 119, 6, 0.35)',
        modalShadow: '0 25px 60px -15px rgba(0, 0, 0, 0.65)',
        headerGradient: 'linear-gradient(135deg, #451a03 0%, #78350f 45%, #b45309 100%)',
        headerBorder: '4px solid #f59e0b',
        headerIconBg: 'rgba(255, 255, 255, 0.18)',
        navBg: '#2d2420',
        navBorder: 'rgba(217, 119, 6, 0.22)',
        tabInactiveColor: '#a8a29e',
        tabHoverBg: 'rgba(217, 119, 6, 0.12)',
        tabActiveBg: '#d97706',
        tabActiveColor: '#ffffff',
        tabActiveGlow: '0 4px 18px rgba(217, 119, 6, 0.5)',
        countPillInactiveBg: 'rgba(255, 255, 255, 0.1)',
        countPillInactiveColor: '#fcd34d',
        bodyBg: '#171412',
        cardBg: '#2a221e',
        cardBorder: 'rgba(217, 119, 6, 0.25)',
        textColor: '#fafaf9',
        mutedColor: '#d6d3d1',
        filterInactiveColor: '#a8a29e',
        filterHoverBg: 'rgba(217, 119, 6, 0.12)',
        filterActiveBg: '#3a2a22',
        filterActiveColor: '#fbbf24',
        filterActiveBorder: '#f59e0b',
        filterActiveGlow: '0 4px 14px rgba(245, 158, 11, 0.25)',
        inputBg: '#1c1715',
        inputBorder: 'rgba(217, 119, 6, 0.35)',
        inputColor: '#fafaf9',
        inputPlaceholder: '#a8a29e',
        residentRowBorder: 'rgba(217, 119, 6, 0.15)',
        residentRowHover: 'rgba(217, 119, 6, 0.08)',
        youRowBg: 'rgba(217, 119, 6, 0.18)',
        youBadgeColor: '#fbbf24',
        statusOnlineDot: '#f59e0b',
        statusDotRing: '#2a221e',
        statCardBg: '#2a221e',
        statCardBorder: 'rgba(217, 119, 6, 0.25)',
        statLabelColor: '#d6d3d1',
        flightCardHeader: '#78350f',
        flightCardHeaderBorder: '#f59e0b',
        flightCardBody: '#1c1715',
        flightLabelColor: '#d1beaf',
        flightValueColor: '#fafaf9',
        flightDividerColor: 'rgba(217, 119, 6, 0.2)',
        flightFooterBg: '#451a03',
        progressTrackBg: 'rgba(217, 119, 6, 0.25)',
        progressBarBg: '#f59e0b',
        seatFilledBg: '#f59e0b',
        seatFilledGlow: 'rgba(245, 158, 11, 0.45)',
        seatEmptyBg: 'rgba(217, 119, 6, 0.2)',
        dodoTicketBg: '#3a2a22',
        dodoTicketBorder: '#f59e0b',
        dodoTicketLabel: '#fcd34d',
        dodoTicketCode: '#fde047',
        terminalHeaderBg: '#292524',
        terminalBodyBg: '#141210',
        digitBoxBg: 'rgba(41, 37, 36, 0.8)',
        digitBoxColor: '#fbbf24',
        digitBoxBorder: 'rgba(251, 191, 36, 0.45)',
        digitBoxGlow: 'rgba(245, 158, 11, 0.5)',
        milestoneCardBg: '#2a221e',
        milestoneCardBorder: 'rgba(217, 119, 6, 0.25)',
        milestoneTitleColor: '#fafaf9',
        milestoneTextColor: '#d6d3d1',
        footerBg: '#141210',
        footerBorder: 'rgba(217, 119, 6, 0.25)',
        footerText: 'rgba(250, 245, 240, 0.8)',
    },
    sakura: {
        name: 'Cherry Blossom',
        icon: 'fa-heart',
        telemetryTag: 'Sakura Petal Radar Telemetry',
        telemetrySub: 'Spring Blossom Airwaves · Floating Islands · Sweet Visits',
        overlayBg: 'rgba(74, 32, 64, 0.65)',
        modalBg: '#ffffff',
        modalBorder: 'rgba(236, 72, 153, 0.3)',
        modalShadow: '0 25px 60px -15px rgba(236, 72, 153, 0.35)',
        headerGradient: 'linear-gradient(135deg, #9d174d 0%, #be185d 40%, #ec4899 100%)',
        headerBorder: '4px solid #fbcfe8',
        headerIconBg: 'rgba(255, 255, 255, 0.22)',
        navBg: '#ffffff',
        navBorder: 'rgba(236, 72, 153, 0.18)',
        tabInactiveColor: '#9d4e7f',
        tabHoverBg: 'rgba(236, 72, 153, 0.08)',
        tabActiveBg: '#ec4899',
        tabActiveColor: '#ffffff',
        tabActiveGlow: '0 4px 16px rgba(236, 72, 153, 0.4)',
        countPillInactiveBg: 'rgba(236, 72, 153, 0.12)',
        countPillInactiveColor: '#be185d',
        bodyBg: '#fff5f9',
        cardBg: '#ffffff',
        cardBorder: 'rgba(236, 72, 153, 0.22)',
        textColor: '#3b072c',
        mutedColor: '#9d4e7f',
        filterInactiveColor: '#9d4e7f',
        filterHoverBg: 'rgba(236, 72, 153, 0.08)',
        filterActiveBg: '#ffffff',
        filterActiveColor: '#9d174d',
        filterActiveBorder: '#ec4899',
        filterActiveGlow: '0 4px 14px rgba(236, 72, 153, 0.22)',
        inputBg: '#ffffff',
        inputBorder: 'rgba(236, 72, 153, 0.3)',
        inputColor: '#3b072c',
        inputPlaceholder: '#f472b6',
        residentRowBorder: 'rgba(236, 72, 153, 0.12)',
        residentRowHover: 'rgba(236, 72, 153, 0.05)',
        youRowBg: '#fdf2f8',
        youBadgeColor: '#ec4899',
        statusOnlineDot: '#ec4899',
        statusDotRing: '#ffffff',
        statCardBg: '#ffffff',
        statCardBorder: 'rgba(236, 72, 153, 0.22)',
        statLabelColor: '#9d4e7f',
        flightCardHeader: '#be185d',
        flightCardHeaderBorder: '#fbcfe8',
        flightCardBody: '#fff8fa',
        flightLabelColor: '#9d4e7f',
        flightValueColor: '#3b072c',
        flightDividerColor: 'rgba(236, 72, 153, 0.18)',
        flightFooterBg: '#9d174d',
        progressTrackBg: '#fce7f3',
        progressBarBg: '#ec4899',
        seatFilledBg: '#ec4899',
        seatFilledGlow: 'rgba(236, 72, 153, 0.4)',
        seatEmptyBg: '#fce7f3',
        dodoTicketBg: '#fdf2f8',
        dodoTicketBorder: '#ec4899',
        dodoTicketLabel: '#be185d',
        dodoTicketCode: '#9d174d',
        terminalHeaderBg: '#4a2040',
        terminalBodyBg: '#280c21',
        digitBoxBg: 'rgba(59, 7, 44, 0.75)',
        digitBoxColor: '#f472b6',
        digitBoxBorder: 'rgba(244, 114, 182, 0.45)',
        digitBoxGlow: 'rgba(236, 72, 153, 0.6)',
        milestoneCardBg: '#ffffff',
        milestoneCardBorder: 'rgba(236, 72, 153, 0.22)',
        milestoneTitleColor: '#3b072c',
        milestoneTextColor: '#9d4e7f',
        footerBg: '#3b072c',
        footerBorder: 'rgba(236, 72, 153, 0.22)',
        footerText: '#fbcfe8',
    },
    dal: {
        name: 'Dodo Airlines',
        icon: 'fa-plane',
        telemetryTag: 'Dodo Airlines Flight Dispatcher Telemetry',
        telemetrySub: 'Air Traffic Control · Runway Load · Global Flights',
        overlayBg: 'rgba(15, 23, 42, 0.8)',
        modalBg: '#131e33',
        modalBorder: 'rgba(56, 189, 248, 0.35)',
        modalShadow: '0 25px 60px -15px rgba(2, 132, 199, 0.45)',
        headerGradient: 'linear-gradient(135deg, #075985 0%, #0284c7 40%, #0ea5e9 100%)',
        headerBorder: '4px solid #f5c452',
        headerIconBg: 'rgba(255, 255, 255, 0.2)',
        navBg: '#19253d',
        navBorder: 'rgba(56, 189, 248, 0.22)',
        tabInactiveColor: '#94a3b8',
        tabHoverBg: 'rgba(56, 189, 248, 0.12)',
        tabActiveBg: '#0284c7',
        tabActiveColor: '#ffffff',
        tabActiveGlow: '0 4px 18px rgba(2, 132, 199, 0.55)',
        countPillInactiveBg: 'rgba(255, 255, 255, 0.1)',
        countPillInactiveColor: '#7dd3fc',
        bodyBg: '#0a1120',
        cardBg: '#18243b',
        cardBorder: 'rgba(56, 189, 248, 0.25)',
        textColor: '#f8fafc',
        mutedColor: '#94a3b8',
        filterInactiveColor: '#94a3b8',
        filterHoverBg: 'rgba(56, 189, 248, 0.12)',
        filterActiveBg: '#152b47',
        filterActiveColor: '#f5c452',
        filterActiveBorder: '#38bdf8',
        filterActiveGlow: '0 4px 14px rgba(56, 189, 248, 0.3)',
        inputBg: '#0f1a2e',
        inputBorder: 'rgba(56, 189, 248, 0.35)',
        inputColor: '#f8fafc',
        inputPlaceholder: '#7dd3fc',
        residentRowBorder: 'rgba(56, 189, 248, 0.15)',
        residentRowHover: 'rgba(56, 189, 248, 0.08)',
        youRowBg: 'rgba(2, 132, 199, 0.2)',
        youBadgeColor: '#f5c452',
        statusOnlineDot: '#38bdf8',
        statusDotRing: '#18243b',
        statCardBg: '#18243b',
        statCardBorder: 'rgba(56, 189, 248, 0.25)',
        statLabelColor: '#94a3b8',
        flightCardHeader: '#0369a1',
        flightCardHeaderBorder: '#f5c452',
        flightCardBody: '#0f1a2e',
        flightLabelColor: '#7dd3fc',
        flightValueColor: '#f8fafc',
        flightDividerColor: 'rgba(56, 189, 248, 0.2)',
        flightFooterBg: '#082f49',
        progressTrackBg: 'rgba(56, 189, 248, 0.25)',
        progressBarBg: '#f5c452',
        seatFilledBg: '#38bdf8',
        seatFilledGlow: 'rgba(56, 189, 248, 0.5)',
        seatEmptyBg: 'rgba(56, 189, 248, 0.2)',
        dodoTicketBg: '#162e4a',
        dodoTicketBorder: '#38bdf8',
        dodoTicketLabel: '#f5c452',
        dodoTicketCode: '#38bdf8',
        terminalHeaderBg: '#1e293b',
        terminalBodyBg: '#070f1e',
        digitBoxBg: 'rgba(8, 47, 73, 0.6)',
        digitBoxColor: '#38bdf8',
        digitBoxBorder: 'rgba(56, 189, 248, 0.45)',
        digitBoxGlow: 'rgba(56, 189, 248, 0.6)',
        milestoneCardBg: '#18243b',
        milestoneCardBorder: 'rgba(56, 189, 248, 0.25)',
        milestoneTitleColor: '#f8fafc',
        milestoneTextColor: '#94a3b8',
        footerBg: '#070f1e',
        footerBorder: 'rgba(56, 189, 248, 0.25)',
        footerText: '#7dd3fc',
    },
    nooklink: {
        name: 'NookLink Dark',
        icon: 'fa-mobile-screen',
        telemetryTag: 'NookLink Cyber-Uplink Telemetry',
        telemetrySub: 'NookOS Realtime Daemons · Live Radar Grid · Global Node Sync',
        overlayBg: 'rgba(9, 13, 22, 0.85)',
        modalBg: '#0f172a',
        modalBorder: 'rgba(16, 185, 129, 0.35)',
        modalShadow: '0 25px 60px -15px rgba(16, 185, 129, 0.35)',
        headerGradient: 'linear-gradient(135deg, #022c22 0%, #064e3b 40%, #047857 100%)',
        headerBorder: '4px solid #10b981',
        headerIconBg: 'rgba(255, 255, 255, 0.18)',
        navBg: '#131e30',
        navBorder: 'rgba(16, 185, 129, 0.22)',
        tabInactiveColor: '#6ee7b7',
        tabHoverBg: 'rgba(16, 185, 129, 0.12)',
        tabActiveBg: '#059669',
        tabActiveColor: '#ffffff',
        tabActiveGlow: '0 4px 18px rgba(16, 185, 129, 0.55)',
        countPillInactiveBg: 'rgba(255, 255, 255, 0.1)',
        countPillInactiveColor: '#a7f3d0',
        bodyBg: '#070b12',
        cardBg: '#111b2b',
        cardBorder: 'rgba(16, 185, 129, 0.25)',
        textColor: '#ecfdf5',
        mutedColor: '#6ee7b7',
        filterInactiveColor: '#6ee7b7',
        filterHoverBg: 'rgba(16, 185, 129, 0.12)',
        filterActiveBg: '#0c271e',
        filterActiveColor: '#34d399',
        filterActiveBorder: '#10b981',
        filterActiveGlow: '0 4px 14px rgba(16, 185, 129, 0.3)',
        inputBg: '#090e17',
        inputBorder: 'rgba(16, 185, 129, 0.35)',
        inputColor: '#ecfdf5',
        inputPlaceholder: '#6ee7b7',
        residentRowBorder: 'rgba(16, 185, 129, 0.15)',
        residentRowHover: 'rgba(16, 185, 129, 0.08)',
        youRowBg: 'rgba(16, 185, 129, 0.18)',
        youBadgeColor: '#34d399',
        statusOnlineDot: '#10b981',
        statusDotRing: '#111b2b',
        statCardBg: '#111b2b',
        statCardBorder: 'rgba(16, 185, 129, 0.25)',
        statLabelColor: '#6ee7b7',
        flightCardHeader: '#065f46',
        flightCardHeaderBorder: '#10b981',
        flightCardBody: '#090e17',
        flightLabelColor: '#6ee7b7',
        flightValueColor: '#ecfdf5',
        flightDividerColor: 'rgba(16, 185, 129, 0.2)',
        flightFooterBg: '#022c22',
        progressTrackBg: 'rgba(16, 185, 129, 0.25)',
        progressBarBg: '#10b981',
        seatFilledBg: '#10b981',
        seatFilledGlow: 'rgba(16, 185, 129, 0.5)',
        seatEmptyBg: 'rgba(16, 185, 129, 0.2)',
        dodoTicketBg: '#0c271e',
        dodoTicketBorder: '#10b981',
        dodoTicketLabel: '#6ee7b7',
        dodoTicketCode: '#34d399',
        terminalHeaderBg: '#1e293b',
        terminalBodyBg: '#05080e',
        digitBoxBg: 'rgba(6, 78, 59, 0.6)',
        digitBoxColor: '#34d399',
        digitBoxBorder: 'rgba(52, 211, 153, 0.45)',
        digitBoxGlow: 'rgba(52, 211, 153, 0.6)',
        milestoneCardBg: '#111b2b',
        milestoneCardBorder: 'rgba(16, 185, 129, 0.25)',
        milestoneTitleColor: '#ecfdf5',
        milestoneTextColor: '#6ee7b7',
        footerBg: '#05080e',
        footerBorder: 'rgba(16, 185, 129, 0.25)',
        footerText: '#6ee7b7',
    },
};

export const OnlineCommunityModal: React.FC = () => {
    const [isOpen, setIsOpen] = useState(false);
    const [activeTab, setActiveTab] = useState<'online' | 'islands' | 'visits'>('online');
    const [searchQuery, setSearchQuery] = useState('');
    const [residentFilter, setResidentFilter] = useState<'all' | 'on_island' | 'ordering' | 'passport'>('all');
    const [trafficStats, setTrafficStats] = useState<TrafficStats>(getTrafficStats);
    const [waveFeedback, setWaveFeedback] = useState<{
        id: string;
        message: string;
        subMessage?: string;
        avatarUrl?: string;
        type: 'sent' | 'received';
        fromUsername?: string;
        fromDisplayName?: string;
        fromSessionId?: string;
    } | null>(null);
    const [wavedMap, setWavedMap] = useState<Record<string, boolean>>({});
    const [copiedDodo, setCopiedDodo] = useState<string | null>(null);

    // Active Theme State
    const [currentTheme, setCurrentTheme] = useState<ThemeMode>(getStoredTheme);

    const { islands } = useIslandData();
    const { user } = useAuth();
    const location = useLocation();
    const navigate = useNavigate();

    // Dynamic backend presence state
    const [residents, setResidents] = useState<OnlineResident[]>(() =>
        getOnlineResidentsList(user, location.pathname)
    );
    const [isServerLive, setIsServerLive] = useState<boolean>(false);
    const [presenceLoading, setPresenceLoading] = useState<boolean>(false);

    const theme = useMemo(() => THEME_CONFIGS[currentTheme] || THEME_CONFIGS.nook, [currentTheme]);

    const refreshPresence = useCallback(async () => {
        setPresenceLoading(true);
        try {
            await sendPresenceHeartbeat(location.pathname, user);
            const res = await fetchOnlinePresence(user, location.pathname);
            setResidents(res.residents);
            setIsServerLive(res.isLive);
        } catch {
            // fallback handled inside fetchOnlinePresence
        } finally {
            setPresenceLoading(false);
        }
    }, [location.pathname, user]);

    // Refresh presence & poll pending waves when modal is open
    useEffect(() => {
        if (!isOpen) return;
        refreshPresence();
        pollPendingWaves();
        const interval = setInterval(() => {
            refreshPresence();
            pollPendingWaves();
        }, 6_000);
        return () => clearInterval(interval);
    }, [isOpen, refreshPresence]);

    // Listen for theme changes across the app
    useEffect(() => {
        const handleThemeChange = (e: any) => {
            if (e.detail?.theme) setCurrentTheme(e.detail.theme);
        };
        window.addEventListener('chopaeng_theme_updated', handleThemeChange);
        return () => window.removeEventListener('chopaeng_theme_updated', handleThemeChange);
    }, []);

    // Listen for incoming wave events directed to this user/session
    useEffect(() => {
        const handleIncomingWave = (e: any) => {
            const wave = e.detail as WaveNotification | undefined;
            if (!wave) return;

            playWaveBackChime();
            setWaveFeedback({
                id: wave.id,
                message: `👋 ${wave.fromDisplayName} waved hello at you!`,
                subMessage: 'A fellow resident sent greetings on the ChoPaeng Live Radar!',
                avatarUrl: wave.fromAvatarUrl,
                type: 'received',
                fromUsername: wave.fromUsername,
                fromDisplayName: wave.fromDisplayName,
                fromSessionId: wave.fromSessionId,
            });
            setTimeout(() => {
                setWaveFeedback((prev) => (prev?.id === wave.id ? null : prev));
            }, 8000);
        };

        window.addEventListener('chopaeng_resident_wave', handleIncomingWave);
        return () => window.removeEventListener('chopaeng_resident_wave', handleIncomingWave);
    }, []);

    // Record site visit on mount & listen for global trigger event
    useEffect(() => {
        const stats = recordSiteVisit();
        setTrafficStats(stats);

        const handleOpen = (e: any) => {
            playChimeClick();
            if (e.detail?.tab) {
                setActiveTab(e.detail.tab);
            }
            setIsOpen(true);
        };

        const handleTrafficUpdate = (e: any) => {
            if (e.detail) setTrafficStats(e.detail);
        };

        window.addEventListener('chopaeng_open_community_hub', handleOpen);
        window.addEventListener('chopaeng_traffic_updated', handleTrafficUpdate);

        return () => {
            window.removeEventListener('chopaeng_open_community_hub', handleOpen);
            window.removeEventListener('chopaeng_traffic_updated', handleTrafficUpdate);
        };
    }, []);

    // Close on Escape key
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && isOpen) {
                setIsOpen(false);
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen]);

    // Live occupancy calculation
    const occupancy = useMemo(() => calculateIslandOccupancy(islands), [islands]);

    // Filtered residents list based on search and filter tab
    const filteredResidents = useMemo(() => {
        return residents.filter((r) => {
            if (residentFilter === 'on_island' && r.status !== 'on_island') return false;
            if (residentFilter === 'ordering' && r.status !== 'ordering') return false;
            if (residentFilter === 'passport' && !r.hasPublicPassport) return false;

            if (searchQuery.trim()) {
                const q = searchQuery.toLowerCase().trim();
                const matchName = r.displayName.toLowerCase().includes(q) || r.username.toLowerCase().includes(q);
                const matchIgn = r.ign?.toLowerCase().includes(q) || false;
                const matchIsland = r.islandName?.toLowerCase().includes(q) || false;
                const matchAct = r.currentActivity.toLowerCase().includes(q);
                return matchName || matchIgn || matchIsland || matchAct;
            }
            return true;
        });
    }, [residents, residentFilter, searchQuery]);

    const handleWave = (resident: OnlineResident) => {
        // Strict requirement: Never wave at oneself
        if (resident.isCurrentUser) return;
        // Prevent spamming during active cooldown
        if (wavedMap[resident.id]) return;

        // 1. Play joyful ascending wave chime
        playWaveChime();

        // 2. Mark resident as waved (cooldown for 8s)
        setWavedMap((prev) => ({ ...prev, [resident.id]: true }));
        setTimeout(() => {
            setWavedMap((prev) => {
                const next = { ...prev };
                delete next[resident.id];
                return next;
            });
        }, 8000);

        // 3. User identification
        const myUsername = user?.username || 'Guest';
        const myDisplayName = user?.nickname || user?.discord_name || (user?.username ? `@${user.username}` : 'Island Explorer');
        const myAvatar = user?.avatar;

        // 4. Broadcast the wave across network, tabs & local listeners
        const waveId = 'wave_' + Date.now();
        broadcastResidentWave({
            fromUsername: myUsername,
            fromDisplayName: myDisplayName,
            fromAvatarUrl: myAvatar,
            toUsername: resident.username,
            toDisplayName: resident.displayName,
            toSessionId: resident.id,
        });

        // 5. Immediate outgoing wave feedback banner
        setWaveFeedback({
            id: waveId,
            message: `You waved hello to ${resident.displayName}! 👋`,
            subMessage: 'Friendly greetings delivered across the skies!',
            avatarUrl: resident.avatarUrl,
            type: 'sent',
        });

        // Auto-dismiss sent confirmation banner after 5 seconds
        setTimeout(() => {
            setWaveFeedback((prev) => (prev?.id === waveId ? null : prev));
        }, 5000);
    };

    const handleCopyDodo = (dodo: string) => {
        playChimeClick();
        navigator.clipboard.writeText(dodo);
        setCopiedDodo(dodo);
        setTimeout(() => setCopiedDodo(null), 2000);
    };

    if (!isOpen) return null;

    // Digits for the retro all-time visits odometer
    const visitDigits = String(trafficStats.allTimeVisits).padStart(7, '0').split('');

    const filterOptions: Array<{ key: typeof residentFilter; label: string; count: number }> = [
        { key: 'all', label: 'All', count: residents.length },
        { key: 'on_island', label: 'On islands', count: residents.filter((r) => r.status === 'on_island').length },
        { key: 'ordering', label: 'In queue', count: residents.filter((r) => r.status === 'ordering').length },
        { key: 'passport', label: 'Passports', count: residents.filter((r) => r.hasPublicPassport).length },
    ];

    const getStatusDotColor = (status: string) => {
        if (status === 'on_island') return '#38bdf8';
        if (status === 'ordering') return '#f59e0b';
        return theme.statusOnlineDot;
    };

    return (
        <div
            className="radar-modal-overlay position-fixed top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center"
            style={{
                backgroundColor: theme.overlayBg,
                backdropFilter: 'blur(8px)',
                WebkitBackdropFilter: 'blur(8px)',
                zIndex: 1060,
                transition: 'background-color 0.3s ease',
            }}
            onClick={() => setIsOpen(false)}
            role="dialog"
            aria-modal="true"
            aria-labelledby="communityRadarTitle"
        >
            <style>{`
                /* --- BASE RADAR STYLES --- */
                .radar-modal-overlay {
                    padding: 1rem;
                }
                .radar-modal-dialog {
                    width: 100%;
                    max-width: 880px;
                    max-height: 92vh;
                }
                .radar-modal-header {
                    padding: 0.85rem 1.25rem;
                }
                .radar-header-icon {
                    width: 42px;
                    height: 42px;
                    font-size: 1.2rem;
                }
                .radar-header-title {
                    font-size: 1.15rem;
                }
                .radar-modal-tabs-bar {
                    padding: 0.65rem 1.25rem;
                }
                .radar-modal-body {
                    padding: 1.25rem;
                }
                .radar-modal-footer {
                    padding: 0.65rem 1.25rem;
                }

                .radar-pulse-ring {
                    position: relative;
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    width: 10px;
                    height: 10px;
                    flex-shrink: 0;
                }
                .radar-pulse-ring::after {
                    content: '';
                    position: absolute;
                    inset: -3px;
                    border-radius: 50%;
                    border: 2px solid currentColor;
                    opacity: 0.6;
                    animation: radarPulse 2s cubic-bezier(0.25, 1, 0.5, 1) infinite;
                    pointer-events: none;
                }
                @keyframes radarPulse {
                    0% { transform: scale(0.85); opacity: 0.8; }
                    100% { transform: scale(1.6); opacity: 0; }
                }

                .radar-tab-btn-themed {
                    padding: 0.5rem 1rem;
                    border-radius: 999px;
                    border: 2px solid transparent;
                    background: transparent;
                    font-weight: 800;
                    font-size: 0.82rem;
                    display: inline-flex;
                    align-items: center;
                    gap: 0.45rem;
                    white-space: nowrap;
                    transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
                }
                .radar-tab-btn-themed:hover {
                    transform: translateY(-1px);
                }

                .radar-tab-count-pill {
                    border-radius: 999px;
                    padding: 0.1rem 0.5rem;
                    font-size: 0.72rem;
                    font-weight: 800;
                }

                .radar-tab-label-full {
                    display: inline;
                }
                .radar-tab-label-short {
                    display: none;
                }

                .radar-filters-scroll {
                    display: flex;
                    align-items: center;
                    gap: 0.35rem;
                    overflow-x: auto;
                    -webkit-overflow-scrolling: touch;
                    scrollbar-width: none;
                    padding-bottom: 2px;
                }
                .radar-filters-scroll::-webkit-scrollbar {
                    display: none;
                }

                .radar-filter-chip-themed {
                    background: transparent;
                    border: 2px solid transparent;
                    border-radius: 50px;
                    padding: 0.35rem 0.85rem;
                    font-weight: 800;
                    font-size: 0.78rem;
                    display: inline-flex;
                    align-items: center;
                    gap: 0.35rem;
                    white-space: nowrap;
                    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
                    cursor: pointer;
                }
                .radar-filter-chip-themed:hover {
                    transform: translateY(-1px);
                }

                .radar-resident-row-themed {
                    display: flex;
                    align-items: center;
                    gap: 0.75rem;
                    padding: 0.75rem 0.85rem;
                    border-bottom: 1px solid ${theme.residentRowBorder};
                    transition: background-color 0.2s ease;
                }
                .radar-resident-row-themed:last-child {
                    border-bottom: none;
                }
                .radar-resident-row-themed:hover {
                    background-color: ${theme.residentRowHover};
                }

                .radar-avatar-img {
                    width: 44px;
                    height: 44px;
                }

                .radar-status-dot-themed {
                    width: 11px;
                    height: 11px;
                    border-radius: 50%;
                    border: 2px solid ${theme.statusDotRing};
                    box-shadow: 0 0 8px rgba(0,0,0,0.25);
                }

                .radar-gate-row-themed {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    gap: 0.75rem;
                    padding: 0.75rem 0.65rem;
                    border-bottom: 1px solid ${theme.residentRowBorder};
                    transition: background-color 0.2s ease;
                }
                .radar-gate-row-themed:last-child {
                    border-bottom: none;
                }

                .radar-seat-dot-themed {
                    width: 9px;
                    height: 9px;
                    border-radius: 2px;
                    display: inline-block;
                    transition: all 0.2s ease;
                }

                .radar-digit-boxes-container {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 0.35rem;
                    flex-wrap: nowrap;
                    overflow-x: auto;
                    padding: 0.25rem 0;
                }
                .radar-digit-box-themed {
                    font-family: 'Courier New', Courier, monospace;
                    font-weight: 800;
                    font-size: 1.9rem;
                    line-height: 1;
                    padding: 0.5rem 0.6rem;
                    min-width: 2.1rem;
                    text-align: center;
                    border-radius: 8px;
                    box-shadow: inset 0 2px 6px rgba(0,0,0,0.5), 0 4px 12px rgba(0,0,0,0.2);
                    transition: all 0.3s ease;
                    flex-shrink: 0;
                }

                /* --- RESPONSIVE MOBILE OVERRIDES (< 576px) --- */
                @media (max-width: 576px) {
                    .radar-modal-overlay {
                        padding: 0.4rem !important;
                    }
                    .radar-modal-dialog {
                        max-height: 96vh !important;
                        border-radius: 1.25rem !important;
                    }
                    .radar-modal-header {
                        padding: 0.65rem 0.85rem !important;
                    }
                    .radar-header-icon {
                        width: 34px !important;
                        height: 34px !important;
                        font-size: 1rem !important;
                    }
                    .radar-header-title {
                        font-size: 1.02rem !important;
                    }
                    .radar-modal-tabs-bar {
                        padding: 0.45rem 0.65rem !important;
                    }
                    .radar-modal-body {
                        padding: 0.75rem !important;
                    }
                    .radar-modal-footer {
                        padding: 0.5rem 0.75rem !important;
                    }

                    .radar-tabs-nav {
                        display: grid !important;
                        grid-template-columns: repeat(3, 1fr) !important;
                        width: 100% !important;
                        gap: 0.25rem !important;
                    }
                    .radar-tab-btn-themed {
                        padding: 0.42rem 0.2rem !important;
                        font-size: 0.74rem !important;
                        justify-content: center !important;
                        gap: 0.25rem !important;
                    }
                    .radar-tab-btn-themed i {
                        font-size: 0.75rem !important;
                    }
                    .radar-tab-label-full {
                        display: none !important;
                    }
                    .radar-tab-label-short {
                        display: inline !important;
                    }
                    .radar-tab-count-pill {
                        padding: 0.05rem 0.35rem !important;
                        font-size: 0.66rem !important;
                    }

                    .radar-avatar-img {
                        width: 38px !important;
                        height: 38px !important;
                    }
                    .radar-resident-row-themed {
                        padding: 0.6rem 0.5rem !important;
                        gap: 0.55rem !important;
                    }
                    .radar-gate-row-themed {
                        padding: 0.6rem 0.35rem !important;
                        gap: 0.45rem !important;
                    }
                    .radar-seat-dot-themed {
                        width: 7px !important;
                        height: 7px !important;
                    }

                    .radar-digit-boxes-container {
                        gap: 0.2rem !important;
                    }
                    .radar-digit-box-themed {
                        font-size: 1.25rem !important;
                        padding: 0.3rem 0.3rem !important;
                        min-width: 1.55rem !important;
                        border-radius: 6px !important;
                    }
                }

                @media (max-width: 380px) {
                    .radar-tab-btn-themed {
                        font-size: 0.7rem !important;
                        padding: 0.38rem 0.15rem !important;
                    }
                    .radar-digit-boxes-container {
                        gap: 0.15rem !important;
                    }
                    .radar-digit-box-themed {
                        font-size: 1.05rem !important;
                        padding: 0.25rem 0.2rem !important;
                        min-width: 1.35rem !important;
                        border-radius: 5px !important;
                    }
                }
            `}</style>

            <div
                className="radar-modal-dialog rounded-4 overflow-hidden d-flex flex-column animate-fade-in"
                style={{
                    backgroundColor: theme.modalBg,
                    border: `1px solid ${theme.modalBorder}`,
                    boxShadow: theme.modalShadow,
                    transition: 'background-color 0.3s ease, border-color 0.3s ease, box-shadow 0.3s ease',
                }}
                onClick={(e) => e.stopPropagation()}
            >
                {/* ── MODAL HEADER ── */}
                <div
                    className="radar-modal-header d-flex align-items-center justify-content-between position-relative"
                    style={{
                        background: theme.headerGradient,
                        borderBottom: theme.headerBorder,
                        transition: 'background 0.3s ease, border-bottom 0.3s ease',
                        flexShrink: 0,
                    }}
                >
                    <div className="d-flex align-items-center gap-2.5 min-w-0">
                        <div
                            className="radar-header-icon d-flex align-items-center justify-content-center flex-shrink-0 rounded-3 text-white shadow-xs"
                            style={{
                                background: theme.headerIconBg,
                                border: '1px solid rgba(255,255,255,0.25)',
                            }}
                        >
                            <i className="fa-solid fa-tower-broadcast"></i>
                        </div>
                        <div className="min-w-0">
                            <div className="d-flex align-items-center gap-2">
                                <span className="radar-pulse-ring text-warning flex-shrink-0">
                                    <span className="live-dot" style={{ width: 8, height: 8 }} />
                                </span>
                                <h3 id="communityRadarTitle" className="radar-header-title ac-font text-white mb-0 text-truncate">
                                    ChoPaeng Live Radar
                                </h3>
                            </div>
                        </div>
                    </div>

                    {/* Header Controls: Close Button */}
                    <div className="d-flex align-items-center gap-2 flex-shrink-0">
                        <button
                            type="button"
                            onClick={() => setIsOpen(false)}
                            className="btn btn-sm rounded-circle d-flex align-items-center justify-content-center text-white border-0 shadow-xs"
                            style={{
                                width: 34,
                                height: 34,
                                background: 'rgba(255, 255, 255, 0.2)',
                                transition: 'all 0.2s ease',
                            }}
                            aria-label="Close"
                        >
                            <i className="fa-solid fa-xmark"></i>
                        </button>
                    </div>
                </div>

                {/* ── TAB SELECTOR ── */}
                <div
                    className="radar-modal-tabs-bar d-flex align-items-center justify-content-between gap-2"
                    style={{
                        backgroundColor: theme.navBg,
                        borderBottom: `1px solid ${theme.navBorder}`,
                        transition: 'background-color 0.3s ease, border-color 0.3s ease',
                        flexShrink: 0,
                    }}
                >
                    <div className="radar-tabs-nav d-flex align-items-center gap-1.5 gap-sm-2 flex-grow-1 min-w-0">
                        {/* Tab 1: Who's Online */}
                        <button
                            type="button"
                            className="radar-tab-btn-themed"
                            style={{
                                color: activeTab === 'online' ? theme.tabActiveColor : theme.tabInactiveColor,
                                backgroundColor: activeTab === 'online' ? theme.tabActiveBg : 'transparent',
                                boxShadow: activeTab === 'online' ? theme.tabActiveGlow : 'none',
                            }}
                            onClick={() => {
                                playChimeClick();
                                setActiveTab('online');
                            }}
                        >
                            <i className="fa-solid fa-users flex-shrink-0"></i>
                            <span className="radar-tab-label-full">Who's online</span>
                            <span className="radar-tab-label-short">Online</span>
                            <span
                                className="radar-tab-count-pill"
                                style={{
                                    backgroundColor: activeTab === 'online' ? 'rgba(255, 255, 255, 0.25)' : theme.countPillInactiveBg,
                                    color: activeTab === 'online' ? '#ffffff' : theme.countPillInactiveColor,
                                }}
                            >
                                {trafficStats.activeOnlineCount}
                            </span>
                        </button>

                        {/* Tab 2: Island Occupancy */}
                        <button
                            type="button"
                            className="radar-tab-btn-themed"
                            style={{
                                color: activeTab === 'islands' ? theme.tabActiveColor : theme.tabInactiveColor,
                                backgroundColor: activeTab === 'islands' ? theme.tabActiveBg : 'transparent',
                                boxShadow: activeTab === 'islands' ? theme.tabActiveGlow : 'none',
                            }}
                            onClick={() => {
                                playChimeClick();
                                setActiveTab('islands');
                            }}
                        >
                            <i className="fa-solid fa-plane-arrival flex-shrink-0"></i>
                            <span className="radar-tab-label-full">Island occupancy</span>
                            <span className="radar-tab-label-short">Islands</span>
                            <span
                                className="radar-tab-count-pill"
                                style={{
                                    backgroundColor: activeTab === 'islands' ? 'rgba(255, 255, 255, 0.25)' : theme.countPillInactiveBg,
                                    color: activeTab === 'islands' ? '#ffffff' : theme.countPillInactiveColor,
                                }}
                            >
                                {occupancy.totalVisitors}
                            </span>
                        </button>

                        {/* Tab 3: All-Time Visits */}
                        <button
                            type="button"
                            className="radar-tab-btn-themed"
                            style={{
                                color: activeTab === 'visits' ? theme.tabActiveColor : theme.tabInactiveColor,
                                backgroundColor: activeTab === 'visits' ? theme.tabActiveBg : 'transparent',
                                boxShadow: activeTab === 'visits' ? theme.tabActiveGlow : 'none',
                            }}
                            onClick={() => {
                                playChimeClick();
                                setActiveTab('visits');
                            }}
                        >
                            <i className="fa-solid fa-chart-line flex-shrink-0"></i>
                            <span className="radar-tab-label-full">All-time visits</span>
                            <span className="radar-tab-label-short">Visits</span>
                            <span
                                className="radar-tab-count-pill"
                                style={{
                                    backgroundColor: activeTab === 'visits' ? 'rgba(255, 255, 255, 0.25)' : theme.countPillInactiveBg,
                                    color: activeTab === 'visits' ? '#ffffff' : theme.countPillInactiveColor,
                                }}
                            >
                                2.8M+
                            </span>
                        </button>
                    </div>

                    {/* Server status & Refresh beacon */}
                    <div className="d-flex align-items-center gap-1.5 tiny-text flex-shrink-0" style={{ color: theme.mutedColor }}>
                        {isServerLive ? (
                            <span className="d-inline-flex align-items-center gap-1 fw-bold" style={{ color: theme.statusOnlineDot }}>
                                <span className="live-dot" style={{ width: 7, height: 7, backgroundColor: theme.statusOnlineDot }} />
                                <span className="d-none d-md-inline">Live presence</span>
                            </span>
                        ) : (
                            <span className="badge rounded-pill border d-none d-md-inline" style={{ backgroundColor: theme.cardBg, borderColor: theme.cardBorder, color: theme.mutedColor }}>
                                Local roster
                            </span>
                        )}
                        <button
                            type="button"
                            onClick={() => {
                                playChimeClick();
                                refreshPresence();
                            }}
                            disabled={presenceLoading}
                            className="btn btn-sm btn-link p-0 text-decoration-none"
                            style={{ color: theme.statusOnlineDot }}
                            title="Refresh live presence now"
                        >
                            <i className={`fa-solid fa-rotate ${presenceLoading ? 'fa-spin' : ''}`} />
                        </button>
                    </div>
                </div>

                {/* ── MODAL BODY SCROLLABLE ── */}
                <div
                    className="radar-modal-body overflow-y-auto flex-grow-1"
                    style={{
                        backgroundColor: theme.bodyBg,
                        minHeight: 0,
                        transition: 'background-color 0.3s ease',
                    }}
                >
                    {waveFeedback && (
                        <div
                            className="rounded-4 py-2 px-3 mb-3 d-flex align-items-center justify-content-between animate-bounce-gentle"
                            style={{
                                background: theme.cardBg,
                                border: `1px solid ${waveFeedback.type === 'received' ? theme.tabActiveBg : theme.statusOnlineDot}`,
                                boxShadow: `0 6px 18px ${theme.seatFilledGlow}`,
                                transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
                            }}
                        >
                            <div className="d-flex align-items-center gap-2 min-w-0">
                                {waveFeedback.avatarUrl ? (
                                    <img
                                        src={waveFeedback.avatarUrl}
                                        alt="Villager"
                                        style={{
                                            width: 32,
                                            height: 32,
                                            borderRadius: '50%',
                                            objectFit: 'cover',
                                            border: `2px solid ${waveFeedback.type === 'received' ? theme.tabActiveBg : theme.statusOnlineDot}`,
                                            backgroundColor: theme.modalBg,
                                        }}
                                        onError={(e) => {
                                            (e.currentTarget as HTMLImageElement).src = 'https://acnhcdn.com/latest/NpcIcon/der00.png';
                                        }}
                                    />
                                ) : (
                                    <span className="fs-5">👋</span>
                                )}
                                <div className="min-w-0">
                                    <div className="small fw-bold text-truncate" style={{ color: theme.textColor }}>
                                        {waveFeedback.message}
                                    </div>
                                    {waveFeedback.subMessage && (
                                        <div className="tiny-text text-truncate" style={{ color: theme.mutedColor }}>
                                            {waveFeedback.subMessage}
                                        </div>
                                    )}
                                </div>
                            </div>
                            <div className="d-flex align-items-center gap-2 flex-shrink-0 ms-2">
                                {waveFeedback.type === 'received' && waveFeedback.fromUsername && (
                                    <button
                                        type="button"
                                        className="btn btn-sm rounded-pill px-3 py-1 fw-bold text-white d-inline-flex align-items-center gap-1.5 shadow-sm"
                                        style={{
                                            background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                                            fontSize: '0.78rem',
                                            border: 'none',
                                            cursor: 'pointer',
                                        }}
                                        onClick={() => {
                                            playWaveBackChime();
                                            const myUsername = user?.username || 'Guest';
                                            const myDisplayName = user?.nickname || user?.discord_name || (user?.username ? `@${user.username}` : 'Island Explorer');
                                            broadcastResidentWave({
                                                fromUsername: myUsername,
                                                fromDisplayName: myDisplayName,
                                                fromAvatarUrl: user?.avatar,
                                                toUsername: waveFeedback.fromUsername!,
                                                toDisplayName: waveFeedback.fromDisplayName || waveFeedback.fromUsername!,
                                                toSessionId: waveFeedback.fromSessionId,
                                            });
                                            setWaveFeedback({
                                                id: 'wave_back_' + Date.now(),
                                                message: `✨ You waved back to ${waveFeedback.fromDisplayName || waveFeedback.fromUsername}!`,
                                                subMessage: 'Friendly greetings returned across the skies!',
                                                avatarUrl: waveFeedback.avatarUrl,
                                                type: 'sent',
                                            });
                                            setTimeout(() => setWaveFeedback(null), 4500);
                                        }}
                                    >
                                        Wave Back 👋
                                    </button>
                                )}
                                <button
                                    type="button"
                                    className="btn-close btn-close-sm flex-shrink-0"
                                    style={{ filter: currentTheme === 'roost' ? 'invert(1)' : undefined }}
                                    onClick={() => setWaveFeedback(null)}
                                    aria-label="Dismiss wave notification"
                                ></button>
                            </div>
                        </div>
                    )}

                    {/* ════════════ TAB 1: WHO'S CURRENTLY ONLINE ════════════ */}
                    {activeTab === 'online' && (
                        <div className="animate-fade-in">
                            {/* Filter & Search Bar */}
                            <div className="row g-2 mb-3 align-items-center">
                                <div className="col-12 col-md-5">
                                    <div className="position-relative">
                                        <i
                                            className="fa-solid fa-magnifying-glass position-absolute top-50 start-0 translate-middle-y ms-3"
                                            style={{ color: theme.mutedColor }}
                                        ></i>
                                        <input
                                            type="text"
                                            className="form-control rounded-pill ps-5 pe-4 py-1.5 small shadow-2xs"
                                            style={{
                                                backgroundColor: theme.inputBg,
                                                borderColor: theme.inputBorder,
                                                color: theme.inputColor,
                                                fontSize: '0.85rem',
                                            }}
                                            placeholder="Search name, IGN, or island..."
                                            value={searchQuery}
                                            onChange={(e) => setSearchQuery(e.target.value)}
                                        />
                                        {searchQuery && (
                                            <button
                                                type="button"
                                                className="btn position-absolute top-50 end-0 translate-middle-y me-2 p-0"
                                                style={{ color: theme.mutedColor }}
                                                onClick={() => setSearchQuery('')}
                                            >
                                                <i className="fa-solid fa-circle-xmark"></i>
                                            </button>
                                        )}
                                    </div>
                                </div>

                                <div className="col-12 col-md-7">
                                    <div className="radar-filters-scroll justify-content-start justify-content-md-end">
                                        {filterOptions.map((opt) => {
                                            const isFilterActive = residentFilter === opt.key;
                                            return (
                                                <button
                                                    key={opt.key}
                                                    type="button"
                                                    className="radar-filter-chip-themed flex-shrink-0"
                                                    style={{
                                                        backgroundColor: isFilterActive ? theme.filterActiveBg : 'transparent',
                                                        color: isFilterActive ? theme.filterActiveColor : theme.filterInactiveColor,
                                                        border: `1.5px solid ${isFilterActive ? theme.filterActiveBorder : 'transparent'}`,
                                                        boxShadow: isFilterActive ? theme.filterActiveGlow : 'none',
                                                    }}
                                                    onClick={() => {
                                                        playChimeClick();
                                                        setResidentFilter(opt.key);
                                                    }}
                                                >
                                                    <span>{opt.label}</span>
                                                    <span
                                                        className="badge rounded-pill px-1.5 py-0.5 tiny-text"
                                                        style={{
                                                            background: isFilterActive ? theme.tabActiveBg : theme.countPillInactiveBg,
                                                            color: isFilterActive ? '#ffffff' : theme.countPillInactiveColor,
                                                        }}
                                                    >
                                                        {opt.count}
                                                    </span>
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>

                            {/* Residents Manifest */}
                            {filteredResidents.length === 0 ? (
                                <div
                                    className="p-4 p-sm-5 text-center rounded-4 border"
                                    style={{
                                        backgroundColor: theme.cardBg,
                                        borderColor: theme.cardBorder,
                                        color: theme.mutedColor,
                                    }}
                                >
                                    <i className="fa-solid fa-user-slash fs-2 mb-2 opacity-50 d-block"></i>
                                    <div className="fw-bold mb-2 small">No online residents match your search.</div>
                                    <button
                                        type="button"
                                        className="btn btn-sm rounded-pill px-3 fw-bold"
                                        style={{
                                            backgroundColor: theme.tabActiveBg,
                                            color: '#ffffff',
                                            border: 'none',
                                        }}
                                        onClick={() => {
                                            setSearchQuery('');
                                            setResidentFilter('all');
                                        }}
                                    >
                                        Reset filters
                                    </button>
                                </div>
                            ) : (
                                <div
                                    className="rounded-4 overflow-hidden border shadow-xs"
                                    style={{
                                        backgroundColor: theme.cardBg,
                                        borderColor: theme.cardBorder,
                                    }}
                                >
                                    {filteredResidents.map((resident) => {
                                        const dotColor = getStatusDotColor(resident.status);
                                        return (
                                            <div
                                                className="radar-resident-row-themed"
                                                key={resident.id}
                                                style={{
                                                    backgroundColor: resident.isCurrentUser ? theme.youRowBg : undefined,
                                                }}
                                            >
                                                {/* Resident Avatar with Presence Dot */}
                                                <div className="position-relative flex-shrink-0">
                                                    <img
                                                        src={resident.avatarUrl}
                                                        alt={resident.displayName}
                                                        className="radar-avatar-img"
                                                        style={{
                                                            borderRadius: '50%',
                                                            objectFit: 'cover',
                                                            border: `1px solid ${theme.cardBorder}`,
                                                            backgroundColor: theme.cardBg,
                                                        }}
                                                        onError={(e) => {
                                                            (e.currentTarget as HTMLImageElement).src =
                                                                'https://acnhcdn.com/latest/NpcIcon/der00.png';
                                                        }}
                                                    />
                                                    <span
                                                        className="radar-status-dot-themed position-absolute bottom-0 end-0"
                                                        style={{ backgroundColor: dotColor }}
                                                        title={resident.status}
                                                    ></span>
                                                </div>

                                                {/* Resident Identity & Action Details */}
                                                <div className="flex-grow-1 min-w-0">
                                                    <div className="d-flex align-items-center gap-1.5 flex-wrap">
                                                        <span className="fw-bold text-truncate" style={{ color: theme.textColor, maxWidth: 160 }}>
                                                            {resident.displayName}
                                                        </span>
                                                        {resident.isCurrentUser && (
                                                            <span
                                                                className="badge rounded-pill tiny-text px-1.5 py-0.5 fw-bold"
                                                                style={{
                                                                    backgroundColor: theme.tabActiveBg,
                                                                    color: '#ffffff',
                                                                    fontSize: '0.66rem',
                                                                }}
                                                            >
                                                                YOU
                                                            </span>
                                                        )}
                                                        <span
                                                            className="badge rounded-pill tiny-text px-1.5 py-0.5 font-monospace text-uppercase"
                                                            style={{
                                                                backgroundColor: theme.countPillInactiveBg,
                                                                color: theme.mutedColor,
                                                                border: `1px solid ${theme.cardBorder}`,
                                                                fontSize: '0.66rem',
                                                            }}
                                                        >
                                                            {resident.role}
                                                        </span>
                                                        {wavedMap[resident.id] && (
                                                            <span
                                                                className="badge rounded-pill tiny-text px-1.5 py-0.5 animate-bounce-gentle fw-bold"
                                                                style={{
                                                                    backgroundColor: `${theme.tabActiveBg}25`,
                                                                    color: theme.tabActiveBg,
                                                                    border: `1px solid ${theme.tabActiveBg}40`,
                                                                    fontSize: '0.66rem',
                                                                }}
                                                            >
                                                                👋 Waved!
                                                            </span>
                                                        )}
                                                    </div>
                                                    <div className="tiny-text font-monospace mt-0.5 text-truncate" style={{ color: theme.mutedColor }}>
                                                        IGN: <strong style={{ color: theme.textColor }}>{resident.ign}</strong> · 🏝️ {resident.islandName}
                                                    </div>
                                                    <div className="tiny-text mt-0.5 d-flex align-items-center gap-1 text-truncate" style={{ color: dotColor }}>
                                                        <i
                                                            className={`fa-solid flex-shrink-0 ${resident.status === 'on_island'
                                                                ? 'fa-plane-departure'
                                                                : resident.status === 'ordering'
                                                                    ? 'fa-box'
                                                                    : 'fa-circle-dot'
                                                                }`}
                                                            style={{ fontSize: '0.62rem' }}
                                                        ></i>
                                                        <span className="text-truncate">{resident.currentActivity}</span>
                                                    </div>
                                                </div>

                                                {/* Right: Last active & Actions */}
                                                <div className="text-end flex-shrink-0 d-flex flex-column align-items-end justify-content-center gap-1">
                                                    <div className="tiny-text" style={{ color: theme.mutedColor, fontSize: '0.7rem' }}>
                                                        {resident.joinedMinutesAgo === 0 ? 'Active now' : `${resident.joinedMinutesAgo}m ago`}
                                                    </div>
                                                    <div className="d-flex align-items-center gap-1.5 justify-content-end">
                                                        {!resident.isCurrentUser ? (
                                                            <button
                                                                type="button"
                                                                className="btn btn-xs rounded-pill px-2.5 py-0.5 border shadow-2xs fw-bold transition-all"
                                                                style={{
                                                                    backgroundColor: wavedMap[resident.id] ? `${theme.tabActiveBg}22` : theme.cardBg,
                                                                    borderColor: wavedMap[resident.id] ? theme.tabActiveBg : theme.cardBorder,
                                                                    color: wavedMap[resident.id] ? theme.tabActiveBg : theme.textColor,
                                                                    transform: wavedMap[resident.id] ? 'scale(0.97)' : 'scale(1)',
                                                                    cursor: wavedMap[resident.id] ? 'default' : 'pointer',
                                                                    fontSize: '0.72rem',
                                                                }}
                                                                title={wavedMap[resident.id] ? `Waved at ${resident.displayName}!` : `Wave hello to ${resident.displayName}`}
                                                                onClick={() => handleWave(resident)}
                                                                disabled={Boolean(wavedMap[resident.id])}
                                                            >
                                                                {wavedMap[resident.id] ? (
                                                                    <span className="d-inline-flex align-items-center gap-1">
                                                                        <i className="fa-solid fa-check text-success"></i>
                                                                        <span className="d-none d-sm-inline">Waved</span>
                                                                    </span>
                                                                ) : (
                                                                    <span>👋 <span className="d-none d-sm-inline">Wave</span></span>
                                                                )}
                                                            </button>
                                                        ) : (
                                                            <span
                                                                className="badge rounded-pill px-2 py-0.5 fw-bold"
                                                                style={{
                                                                    backgroundColor: `${theme.tabActiveBg}18`,
                                                                    color: theme.tabActiveBg,
                                                                    border: `1px solid ${theme.tabActiveBg}35`,
                                                                    fontSize: '0.7rem',
                                                                    letterSpacing: '0.02em',
                                                                }}
                                                                title="This is your own resident profile"
                                                            >
                                                                ✨ You
                                                            </span>
                                                        )}
                                                        {resident.hasPublicPassport ? (
                                                            <button
                                                                type="button"
                                                                className="btn btn-xs rounded-pill px-2 py-0.5 fw-bold text-white shadow-2xs"
                                                                style={{
                                                                    backgroundColor: theme.tabActiveBg,
                                                                    border: 'none',
                                                                    fontSize: '0.72rem',
                                                                }}
                                                                onClick={() => {
                                                                    playChimeClick();
                                                                    setIsOpen(false);
                                                                    navigate(`/u/${resident.username}`);
                                                                }}
                                                            >
                                                                Passport
                                                            </button>
                                                        ) : (
                                                            <span className="tiny-text fst-italic d-none d-sm-inline" style={{ color: theme.mutedColor }}>
                                                                Private
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}

                            <p className="tiny-text mt-3 mb-0 text-center" style={{ color: theme.mutedColor }}>
                                Showing residents registered on ChoPaeng · Synced via {theme.telemetryTag}.
                            </p>
                        </div>
                    )}

                    {/* ════════════ TAB 2: HOW MANY IN THE ISLANDS (ISLAND OCCUPANCY) ════════════ */}
                    {activeTab === 'islands' && (
                        <div className="animate-fade-in">
                            {/* Hero Island Occupancy — reuses DAL flight-card aesthetics with theme styling */}
                            <div
                                className="rounded-4 overflow-hidden mb-3 mb-sm-4 border shadow-sm"
                                style={{
                                    backgroundColor: theme.cardBg,
                                    borderColor: theme.cardBorder,
                                }}
                            >
                                <div
                                    className="px-3 px-sm-4 py-2 py-sm-2.5 fw-bold text-white d-flex align-items-center justify-content-between text-uppercase font-monospace flex-wrap gap-1"
                                    style={{
                                        background: theme.flightCardHeader,
                                        borderBottom: `3px solid ${theme.flightCardHeaderBorder}`,
                                        fontSize: '0.76rem',
                                        letterSpacing: '0.06em',
                                    }}
                                >
                                    <span className="text-truncate">
                                        <i className="fa-solid fa-plane-departure me-1.5" />
                                        LIVE ISLAND OCCUPANCY
                                    </span>
                                    <span className="badge rounded-pill bg-white text-dark py-0.5 px-2 tiny-text fw-bold">
                                        RADAR SYNC
                                    </span>
                                </div>

                                <div className="p-3 p-sm-4" style={{ backgroundColor: theme.flightCardBody }}>
                                    <div className="d-flex align-items-center justify-content-between gap-2 mb-2.5">
                                        <div>
                                            <div className="tiny-text text-uppercase fw-bold font-monospace" style={{ color: theme.flightLabelColor }}>
                                                PLAYERS ON ISLANDS
                                            </div>
                                            <div className="fs-3 fs-sm-2 ac-font mb-0" style={{ color: theme.flightValueColor }}>
                                                {occupancy.totalVisitors} Passengers
                                            </div>
                                        </div>
                                        <div className="text-end">
                                            <div className="tiny-text text-uppercase fw-bold font-monospace" style={{ color: theme.flightLabelColor }}>
                                                CAPACITY
                                            </div>
                                            <div className="fs-3 fs-sm-2 ac-font mb-0" style={{ color: theme.flightValueColor }}>
                                                {occupancy.percentFull}%
                                            </div>
                                        </div>
                                    </div>

                                    {/* Runway Progress Meter */}
                                    <div
                                        className="progress rounded-pill overflow-hidden shadow-inset"
                                        style={{ height: 10, backgroundColor: theme.progressTrackBg }}
                                    >
                                        <div
                                            className="progress-bar progress-bar-striped progress-bar-animated"
                                            role="progressbar"
                                            style={{
                                                width: `${occupancy.percentFull}%`,
                                                backgroundColor: theme.progressBarBg,
                                            }}
                                            aria-valuenow={occupancy.percentFull}
                                            aria-valuemin={0}
                                            aria-valuemax={100}
                                        ></div>
                                    </div>

                                    <div className="d-flex justify-content-between tiny-text font-monospace mt-1.5" style={{ color: theme.flightLabelColor, fontSize: '0.72rem' }}>
                                        <span>0</span>
                                        <span>{occupancy.totalVisitors} / {occupancy.maxCapacity} Seats</span>
                                        <span>{occupancy.maxCapacity} Full</span>
                                    </div>
                                </div>

                                <div
                                    className="px-3 px-sm-4 py-1.5 tiny-text text-white d-flex align-items-center justify-content-between font-monospace"
                                    style={{ background: theme.flightFooterBg, fontSize: '0.72rem' }}
                                >
                                    <span>{occupancy.onlineIslandCount} GATES ACTIVE</span>
                                    <span>{occupancy.maxCapacity} SLOTS TOTAL</span>
                                </div>
                            </div>

                            {/* 4 Stat Metric Highlight Cards */}
                            <div className="row g-2 g-sm-3 mb-3 mb-sm-4">
                                <div className="col-6 col-md-3">
                                    <div
                                        className="p-2.5 p-sm-3 rounded-4 border text-center shadow-xs"
                                        style={{ backgroundColor: theme.statCardBg, borderColor: theme.statCardBorder }}
                                    >
                                        <div className="tiny-text fw-bold text-uppercase font-monospace text-truncate" style={{ color: theme.statLabelColor }}>
                                            Online Gates
                                        </div>
                                        <div className="fs-4 fs-sm-3 fw-black mt-0.5 mt-sm-1" style={{ color: theme.statusOnlineDot }}>
                                            {occupancy.onlineIslandCount}
                                        </div>
                                        <div className="tiny-text text-truncate" style={{ color: theme.mutedColor }}>Islands active</div>
                                    </div>
                                </div>

                                <div className="col-6 col-md-3">
                                    <div
                                        className="p-2.5 p-sm-3 rounded-4 border text-center shadow-xs"
                                        style={{ backgroundColor: theme.statCardBg, borderColor: theme.statCardBorder }}
                                    >
                                        <div className="tiny-text fw-bold text-uppercase font-monospace text-truncate" style={{ color: theme.statLabelColor }}>
                                            Public Visitors
                                        </div>
                                        <div className="fs-4 fs-sm-3 fw-black mt-0.5 mt-sm-1" style={{ color: '#38bdf8' }}>
                                            {occupancy.publicVisitors}
                                        </div>
                                        <div className="tiny-text text-truncate" style={{ color: theme.mutedColor }}>Free public gates</div>
                                    </div>
                                </div>

                                <div className="col-6 col-md-3">
                                    <div
                                        className="p-2.5 p-sm-3 rounded-4 border text-center shadow-xs"
                                        style={{ backgroundColor: theme.statCardBg, borderColor: theme.statCardBorder }}
                                    >
                                        <div className="tiny-text fw-bold text-uppercase font-monospace text-truncate" style={{ color: theme.statLabelColor }}>
                                            Sub Travelers
                                        </div>
                                        <div className="fs-4 fs-sm-3 fw-black mt-0.5 mt-sm-1" style={{ color: '#fbbf24' }}>
                                            {occupancy.memberVisitors}
                                        </div>
                                        <div className="tiny-text text-truncate" style={{ color: theme.mutedColor }}>Sub member islands</div>
                                    </div>
                                </div>

                                <div className="col-6 col-md-3">
                                    <div
                                        className="p-2.5 p-sm-3 rounded-4 border text-center shadow-xs"
                                        style={{ backgroundColor: theme.statCardBg, borderColor: theme.statCardBorder }}
                                    >
                                        <div className="tiny-text fw-bold text-uppercase font-monospace text-truncate" style={{ color: theme.statLabelColor }}>
                                            Refreshing
                                        </div>
                                        <div className="fs-4 fs-sm-3 fw-black mt-0.5 mt-sm-1" style={{ color: theme.mutedColor }}>
                                            {occupancy.refreshingCount}
                                        </div>
                                        <div className="tiny-text text-truncate" style={{ color: theme.mutedColor }}>Resetting Dodo</div>
                                    </div>
                                </div>
                            </div>

                            {/* Island-by-Island Passenger Roster */}
                            <div className="d-flex align-items-center justify-content-between mb-2.5 flex-wrap gap-2">
                                <h5 className="h6 ac-font mb-0" style={{ color: theme.textColor }}>
                                    <i className="fa-solid fa-list-check me-2" style={{ color: theme.statusOnlineDot }}></i>
                                    Island Flight Roster &amp; Gate Occupancy
                                </h5>
                                <button
                                    type="button"
                                    className="btn btn-xs btn-sm rounded-pill px-2.5 py-1 fw-bold border shadow-2xs"
                                    style={{
                                        backgroundColor: theme.cardBg,
                                        borderColor: theme.cardBorder,
                                        color: theme.textColor,
                                        fontSize: '0.74rem',
                                    }}
                                    onClick={() => {
                                        playChimeClick();
                                        setIsOpen(false);
                                        navigate('/islands');
                                    }}
                                >
                                    Open Board <i className="fa-solid fa-arrow-right ms-1"></i>
                                </button>
                            </div>

                            <div
                                className="rounded-4 p-2.5 p-sm-3 border shadow-xs"
                                style={{
                                    backgroundColor: theme.cardBg,
                                    borderColor: theme.cardBorder,
                                }}
                            >
                                {occupancy.busiestIslands.length === 0 ? (
                                    <div className="text-center py-4" style={{ color: theme.mutedColor }}>
                                        No live islands currently online.
                                    </div>
                                ) : (
                                    occupancy.busiestIslands.map((island) => {
                                        const isFull = island.visitors >= 7;

                                        return (
                                            <div key={island.name} className="radar-gate-row-themed">
                                                <div className="d-flex align-items-center gap-2.5 min-w-0 flex-grow-1">
                                                    <span
                                                        className="badge rounded-pill px-2 py-0.5 tiny-text fw-bold font-monospace flex-shrink-0"
                                                        style={{
                                                            backgroundColor: isFull
                                                                ? 'rgba(239, 68, 68, 0.18)'
                                                                : island.cat === 'member'
                                                                    ? 'rgba(245, 158, 11, 0.18)'
                                                                    : 'rgba(34, 197, 94, 0.18)',
                                                            color: isFull
                                                                ? '#ef4444'
                                                                : island.cat === 'member'
                                                                    ? '#f59e0b'
                                                                    : theme.statusOnlineDot,
                                                            border: `1px solid ${isFull ? '#ef4444' : island.cat === 'member' ? '#f59e0b' : theme.statusOnlineDot
                                                                }`,
                                                            fontSize: '0.68rem',
                                                        }}
                                                    >
                                                        {isFull ? 'FULL' : island.cat === 'member' ? 'SUB' : 'PUB'}
                                                    </span>
                                                    <div className="min-w-0">
                                                        <strong className="text-truncate d-block" style={{ color: theme.textColor, fontSize: '0.86rem' }}>{island.name}</strong>
                                                        <div className="tiny-text font-monospace text-truncate" style={{ color: theme.mutedColor, fontSize: '0.7rem' }}>
                                                            {isFull ? 'Gate full (7/7 seats)' : `${island.visitors}/7 seats taken`}
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className="d-flex align-items-center gap-2 flex-shrink-0">
                                                    {/* 7 Passenger Seat Indicator Dots */}
                                                    <div className="d-flex align-items-center gap-1" title={`${island.visitors}/7 Passengers`}>
                                                        {Array.from({ length: 7 }).map((_, i) => (
                                                            <span
                                                                key={i}
                                                                className="radar-seat-dot-themed"
                                                                style={{
                                                                    backgroundColor: i < island.visitors ? theme.seatFilledBg : theme.seatEmptyBg,
                                                                    boxShadow: i < island.visitors ? `0 0 5px ${theme.seatFilledGlow}` : 'none',
                                                                }}
                                                            ></span>
                                                        ))}
                                                    </div>

                                                    {/* Dodo Boarding Pass Ticket */}
                                                    {island.dodoCode && island.dodoCode !== "GETTIN'" && (
                                                        <button
                                                            type="button"
                                                            className="btn btn-xs rounded-pill px-2.5 py-0.5 fw-bold font-monospace border shadow-2xs"
                                                            style={{
                                                                backgroundColor: copiedDodo === island.dodoCode ? theme.tabActiveBg : theme.dodoTicketBg,
                                                                borderColor: copiedDodo === island.dodoCode ? theme.tabActiveBg : theme.dodoTicketBorder,
                                                                color: copiedDodo === island.dodoCode ? '#ffffff' : theme.dodoTicketCode,
                                                                fontSize: '0.74rem',
                                                            }}
                                                            onClick={() => handleCopyDodo(island.dodoCode!)}
                                                        >
                                                            {copiedDodo === island.dodoCode ? (
                                                                <>
                                                                    <i className="fa-solid fa-check me-1"></i>COPIED
                                                                </>
                                                            ) : (
                                                                <>
                                                                    <i className="fa-solid fa-copy me-1" style={{ opacity: 0.7 }}></i>
                                                                    {island.dodoCode}
                                                                </>
                                                            )}
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })
                                )}
                            </div>
                        </div>
                    )}

                    {/* ════════════ TAB 3: ALL-TIME WEBSITE VISITS ════════════ */}
                    {activeTab === 'visits' && (
                        <div className="animate-fade-in text-center">
                            {/* Odometer Window styled as a retro flight terminal readout */}
                            <div
                                className="rounded-4 overflow-hidden border shadow-sm mb-3 mb-sm-4 text-start"
                                style={{
                                    backgroundColor: theme.terminalBodyBg,
                                    borderColor: theme.terminalHeaderBg,
                                }}
                            >
                                <div
                                    className="px-3 py-2 d-flex align-items-center gap-2 border-bottom"
                                    style={{
                                        backgroundColor: theme.terminalHeaderBg,
                                        borderColor: 'rgba(255,255,255,0.08)',
                                    }}
                                >
                                    <span className="rounded-circle d-inline-block flex-shrink-0" style={{ width: 9, height: 9, backgroundColor: '#ef4444' }} />
                                    <span className="rounded-circle d-inline-block flex-shrink-0" style={{ width: 9, height: 9, backgroundColor: '#f59e0b' }} />
                                    <span className="rounded-circle d-inline-block flex-shrink-0" style={{ width: 9, height: 9, backgroundColor: '#22c55e' }} />
                                    <span className="tiny-text font-monospace text-white-50 ms-1 text-truncate">
                                        flights.log &middot; {theme.telemetryTag}
                                    </span>
                                </div>

                                <div className="p-3 p-sm-4 p-md-5 text-center">
                                    <div
                                        className="tiny-text fw-bold text-uppercase mb-1.5 font-monospace"
                                        style={{ color: theme.digitBoxColor, letterSpacing: '0.1em' }}
                                    >
                                        <i className="fa-solid fa-satellite-dish me-1.5"></i>
                                        LIFETIME FLIGHT DISPATCH TELEMETRY
                                    </div>
                                    <h4 className="fs-4 fs-sm-3 ac-font text-white mb-3">
                                        All-Time Community Flights &amp; Visits
                                    </h4>

                                    {/* Themed Odometer Digit Boxes */}
                                    <div className="radar-digit-boxes-container mb-3 mb-sm-4">
                                        {visitDigits.map((digit, idx) => (
                                            <div
                                                key={idx}
                                                className="radar-digit-box-themed"
                                                style={{
                                                    backgroundColor: theme.digitBoxBg,
                                                    color: theme.digitBoxColor,
                                                    border: `1.5px solid ${theme.digitBoxBorder}`,
                                                    textShadow: `0 0 10px ${theme.digitBoxGlow}`,
                                                }}
                                            >
                                                {digit}
                                            </div>
                                        ))}
                                    </div>

                                    <p className="tiny-text mb-0 mx-auto" style={{ color: 'rgba(255,255,255,0.7)', maxWidth: 460 }}>
                                        Every flight, inventory search, catalog lookup, and bot order worldwide.
                                    </p>
                                </div>
                            </div>

                            {/* Secondary Metrics: 3-column on all viewports */}
                            <div className="row g-2 g-sm-3 mb-3 mb-sm-4">
                                <div className="col-4">
                                    <div
                                        className="p-2.5 p-sm-3.5 rounded-4 border text-center shadow-xs"
                                        style={{ backgroundColor: theme.statCardBg, borderColor: theme.statCardBorder }}
                                    >
                                        <div className="tiny-text fw-bold text-uppercase font-monospace text-truncate" style={{ color: theme.statLabelColor }}>
                                            Today
                                        </div>
                                        <div className="fs-4 fs-sm-3 fw-black mt-0.5 mt-sm-1" style={{ color: theme.statusOnlineDot }}>
                                            {trafficStats.visitsToday.toLocaleString()}
                                        </div>
                                        <div className="tiny-text text-truncate d-none d-sm-block" style={{ color: theme.mutedColor }}>Logged today</div>
                                    </div>
                                </div>

                                <div className="col-4">
                                    <div
                                        className="p-2.5 p-sm-3.5 rounded-4 border text-center shadow-xs"
                                        style={{ backgroundColor: theme.statCardBg, borderColor: theme.statCardBorder }}
                                    >
                                        <div className="tiny-text fw-bold text-uppercase font-monospace text-truncate" style={{ color: theme.statLabelColor }}>
                                            This Week
                                        </div>
                                        <div className="fs-4 fs-sm-3 fw-black mt-0.5 mt-sm-1" style={{ color: '#38bdf8' }}>
                                            {trafficStats.visitsThisWeek.toLocaleString()}
                                        </div>
                                        <div className="tiny-text text-truncate d-none d-sm-block" style={{ color: theme.mutedColor }}>7-day traffic</div>
                                    </div>
                                </div>

                                <div className="col-4">
                                    <div
                                        className="p-2.5 p-sm-3.5 rounded-4 border text-center shadow-xs"
                                        style={{ backgroundColor: theme.statCardBg, borderColor: theme.statCardBorder }}
                                    >
                                        <div className="tiny-text fw-bold text-uppercase font-monospace text-truncate" style={{ color: theme.statLabelColor }}>
                                            Active
                                        </div>
                                        <div className="fs-4 fs-sm-3 fw-black mt-0.5 mt-sm-1" style={{ color: theme.digitBoxColor }}>
                                            {trafficStats.activeOnlineCount}
                                        </div>
                                        <div className="tiny-text text-truncate d-none d-sm-block" style={{ color: theme.mutedColor }}>Online now</div>
                                    </div>
                                </div>
                            </div>

                            {/* Community Achievements */}
                            <div className="row g-2 g-sm-3 text-start">
                                <div className="col-12 col-md-6">
                                    <div
                                        className="p-3 rounded-4 border shadow-xs d-flex align-items-start gap-2.5"
                                        style={{
                                            backgroundColor: theme.milestoneCardBg,
                                            borderColor: theme.milestoneCardBorder,
                                        }}
                                    >
                                        <div
                                            className="rounded-circle d-flex align-items-center justify-content-center flex-shrink-0"
                                            style={{
                                                width: 36,
                                                height: 36,
                                                backgroundColor: 'rgba(245, 158, 11, 0.18)',
                                                color: '#f59e0b',
                                                fontSize: '1.05rem',
                                            }}
                                        >
                                            <i className="fa-solid fa-trophy"></i>
                                        </div>
                                        <div className="min-w-0">
                                            <div className="fw-bold small text-truncate" style={{ color: theme.milestoneTitleColor }}>
                                                Over 2.8 Million Visits
                                            </div>
                                            <div className="tiny-text" style={{ color: theme.milestoneTextColor }}>
                                                ChoPaeng has served over 2.8 million flights, item searches, and orders!
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="col-12 col-md-6">
                                    <div
                                        className="p-3 rounded-4 border shadow-xs d-flex align-items-start gap-2.5"
                                        style={{
                                            backgroundColor: theme.milestoneCardBg,
                                            borderColor: theme.milestoneCardBorder,
                                        }}
                                    >
                                        <div
                                            className="rounded-circle d-flex align-items-center justify-content-center flex-shrink-0"
                                            style={{
                                                width: 36,
                                                height: 36,
                                                backgroundColor: 'rgba(56, 189, 248, 0.18)',
                                                color: '#38bdf8',
                                                fontSize: '1.05rem',
                                            }}
                                        >
                                            <i className="fa-solid fa-plane-departure"></i>
                                        </div>
                                        <div className="min-w-0">
                                            <div className="fw-bold small text-truncate" style={{ color: theme.milestoneTitleColor }}>
                                                24/7 Gate Telemetry
                                            </div>
                                            <div className="tiny-text" style={{ color: theme.milestoneTextColor }}>
                                                Near-zero delays with continuous automated Dodo code refreshing.
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* ── MODAL FOOTER ── */}
                <div
                    className="radar-modal-footer d-flex align-items-center justify-content-between flex-wrap gap-2"
                    style={{
                        backgroundColor: theme.footerBg,
                        borderTop: `1px solid ${theme.footerBorder}`,
                        color: theme.footerText,
                        transition: 'background-color 0.3s ease, border-color 0.3s ease',
                        flexShrink: 0,
                    }}
                >
                    <span className="tiny-text font-monospace d-flex align-items-center gap-1.5 text-truncate">
                        <span className="live-dot" style={{ width: 7, height: 7, backgroundColor: theme.statusOnlineDot }}></span>
                        <span className="text-truncate">{theme.telemetryTag} &middot; Live feed</span>
                    </span>
                    <button
                        type="button"
                        className="btn btn-sm rounded-pill px-3 py-1 tiny-text fw-bold border-0 shadow-2xs"
                        style={{
                            background: 'rgba(255,255,255,0.15)',
                            color: '#ffffff',
                        }}
                        onClick={() => setIsOpen(false)}
                    >
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
};

export default OnlineCommunityModal;