import React from "react";

interface IslandMapPolaroidProps {
    mapImageSrc: string;
    islandName: string;
    onClick: () => void;
}

export const IslandMapPolaroid: React.FC<IslandMapPolaroidProps> = ({ mapImageSrc, islandName, onClick }) => {
    return (
        <div className="polaroid-stack mb-3">
            <div className="map-polaroid cursor-pointer" onClick={onClick} role="button" tabIndex={0} title={`Click to launch ${islandName} Interactive Radar Map`}>
                <div className="tape-strip"></div>
                <div className="img-wrapper position-relative">
                    <img
                        src={mapImageSrc}
                        alt={islandName}
                        className="img-fluid"
                        loading="lazy"
                        decoding="async"
                        onError={(e) => {
                            const target = e.target as HTMLImageElement;
                            if (target.src.includes(".png")) target.src = target.src.replace(".png", ".jpg");
                            else if (target.src.endsWith(".jpg")) target.src = target.src.replace(".jpg", ".jpeg");
                            else target.src = "https://www.chopaeng.com/banner.png";
                        }}
                    />
                    {/* Floating Radar Tag */}
                    <div 
                        className="position-absolute top-0 end-0 m-2 badge rounded-pill px-2.5 py-1.5 shadow-sm d-flex align-items-center gap-1.5"
                        style={{
                            background: 'rgba(15, 23, 42, 0.85)',
                            backdropFilter: 'blur(8px)',
                            border: '1px solid rgba(74, 222, 128, 0.5)',
                            color: '#4ade80',
                            fontSize: '0.72rem',
                            letterSpacing: '0.03em',
                        }}
                    >
                        <span className="live-dot bg-success" style={{ width: 7, height: 7 }}></span>
                        <i className="fa-solid fa-satellite-dish"></i>
                        <span className="fw-bold">Interactive Radar</span>
                    </div>

                    <div className="zoom-indicator" title="Click to open interactive map">
                        <i className="fa-solid fa-expand"></i>
                    </div>
                </div>
                <div className="polaroid-caption d-flex align-items-center justify-content-between">
                    <div className="fw-bold text-dark">
                        <i className="fa-solid fa-map-location-dot me-1.5 text-warning"></i>
                        {islandName} Map
                    </div>
                    <span 
                        className="badge bg-success text-white rounded-pill px-2.5 py-1 shadow-2xs d-inline-flex align-items-center gap-1" 
                        style={{ fontSize: '0.72rem', letterSpacing: '0.02em' }}
                    >
                        <i className="fa-solid fa-crosshairs"></i>
                        <span>Scan Ground</span>
                    </span>
                </div>
            </div>
        </div>
    );
};
