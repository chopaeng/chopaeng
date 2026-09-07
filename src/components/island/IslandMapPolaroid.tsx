import React from "react";

interface IslandMapPolaroidProps {
    mapImageSrc: string;
    islandName: string;
    onClick: () => void;
}

export const IslandMapPolaroid: React.FC<IslandMapPolaroidProps> = ({ mapImageSrc, islandName, onClick }) => {
    return (
        <div className="polaroid-stack mb-4">
            <div className="map-polaroid cursor-pointer" onClick={onClick}>
                <div className="tape-strip"></div>
                <div className="img-wrapper">
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
                    <div className="zoom-indicator">
                        <i className="fa-solid fa-expand"></i>
                    </div>
                </div>
                <div className="polaroid-caption d-flex align-items-center justify-content-between">
                    <div>
                        <i className="fa-solid fa-map-location-dot me-2 text-warning"></i>
                        {islandName} Map
                    </div>
                    <span className="badge bg-primary text-white rounded-pill px-2 py-1 shadow-2xs" style={{ fontSize: '0.7rem', letterSpacing: '0.02em' }}>
                        <i className="fa-solid fa-satellite-dish me-1"></i> Interactive Radar
                    </span>
                </div>
            </div>
        </div>
    );
};
