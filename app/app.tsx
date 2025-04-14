import React, { useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { Map } from 'react-map-gl/maplibre';
import { AmbientLight, PointLight, LightingEffect } from '@deck.gl/core';
import DeckGL from '@deck.gl/react';
import { PolygonLayer } from '@deck.gl/layers';
import { TripsLayer } from '@deck.gl/geo-layers';
import { animate } from 'popmotion';
import { WebMercatorViewport } from '@deck.gl/core';
import './animated_bicycle/animation.scss';

import type { Position, Color, Material, MapViewState } from '@deck.gl/core';

// Source data CSV
const DATA_URL = {
  BUILDINGS:
    'https://raw.githubusercontent.com/visgl/deck.gl-data/master/examples/trips/buildings.json', // eslint-disable-line
  TRIPS: './data.json' //https://raw.githubusercontent.com/visgl/deck.gl-data/master/examples/trips/trips-v7.json' // eslint-disable-line
};

const ambientLight = new AmbientLight({
  color: [255, 255, 255],
  intensity: 1.0
});

const pointLight = new PointLight({
  color: [255, 255, 255],
  intensity: 2.0,
  position: [-74.05, 40.7, 8000]
});

const lightingEffect = new LightingEffect({ ambientLight, pointLight });

type Theme = {
  buildingColor: Color;
  trailColor0: Color;
  trailColor1: Color;
  material: Material;
  effects: [LightingEffect];
};

const DEFAULT_THEME: Theme = {
  buildingColor: [74, 80, 87],
  trailColor0: [255, 0, 0], // Red for older paths
  trailColor1: [0, 255, 0], // Green for newer paths
  material: {
    ambient: 0.1,
    diffuse: 0.6,
    shininess: 32,
    specularColor: [60, 64, 70]
  },
  effects: [lightingEffect]
};

const INITIAL_VIEW_STATE: MapViewState = {
  longitude: 2.3446281,
  latitude: 48.854859,
  zoom: 12,
  pitch: 45,
  bearing: 15
};

const MAP_STYLE = 'https://basemaps.cartocdn.com/gl/dark-matter-nolabels-gl-style/style.json';

const landCover: Position[][] = [
  [
    [-74.0, 40.7],
    [-74.02, 40.7],
    [-74.02, 40.72],
    [-74.0, 40.72]
  ]
];

type Building = {
  polygon: Position[];
  height: number;
};

type Trip = {
  trackID: number;
  path: Position[];
  timestamps: number[];
  start: number;
  speeds: number[];
  max_speed: number;
  distances: number[];
  formatted_start_date: string;
};

// Speed Slider component
const SpeedSlider = ({ value, onChange }: { value: number, onChange: (value: number) => void }) => {
  return (
    <div
      style={{
        position: 'absolute',
        bottom: '30px',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 1,
        background: 'rgba(0, 0, 0, 0.7)',
        padding: '10px 20px',
        borderRadius: '8px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        color: 'white',
        width: '300px'
      }}
    >
      <div style={{ marginBottom: '5px', width: '100%', display: 'flex', justifyContent: 'space-between' }}>
        <span>Animation Speed: {value.toFixed(1)}x</span>
      </div>
      <input
        type="range"
        min="0.1"
        max="5"
        step="0.1"
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        style={{ width: '100%' }}
      />
    </div>
  );
};

// Date Range Selector component
const DateRangeSelector = ({
  startDate,
  endDate,
  onStartDateChange,
  onEndDateChange
}: {
  startDate: number;
  endDate: number;
  onStartDateChange: (date: number) => void;
  onEndDateChange: (date: number) => void;
}) => {
  const formatDate = (timestamp: number) => {
    return new Date(timestamp * 1000).toISOString().split('T')[0];
  };

  const parseDate = (dateString: string) => {
    return Math.floor(new Date(dateString).getTime() / 1000);
  };

  return (
    <div
      style={{
        position: 'absolute',
        top: '20px',
        left: '20px',
        zIndex: 1,
        background: 'rgba(0, 0, 0, 0.7)',
        padding: '10px 20px',
        borderRadius: '8px',
        color: 'white',
        display: 'flex',
        flexDirection: 'column',
        gap: '10px'
      }}
    >
      <div>
        <label style={{ display: 'block', marginBottom: '5px' }}>Start Date:</label>
        <input
          type="date"
          value={formatDate(startDate)}
          onChange={(e) => onStartDateChange(parseDate(e.target.value))}
          style={{ padding: '5px', borderRadius: '4px' }}
        />
      </div>
      <div>
        <label style={{ display: 'block', marginBottom: '5px' }}>End Date:</label>
        <input
          type="date"
          value={formatDate(endDate)}
          onChange={(e) => onEndDateChange(parseDate(e.target.value))}
          style={{ padding: '5px', borderRadius: '4px' }}
        />
      </div>
    </div>
  );
};

// Settings Menu component
const SettingsMenu = ({
  isOpen,
  onClose,
  animationSpeed,
  onAnimationSpeedChange,
  trailLength,
  onTrailLengthChange,
  startDate,
  endDate,
  onStartDateChange,
  onEndDateChange
}: {
  isOpen: boolean;
  onClose: () => void;
  animationSpeed: number;
  onAnimationSpeedChange: (value: number) => void;
  trailLength: number;
  onTrailLengthChange: (value: number) => void;
  startDate: number;
  endDate: number;
  onStartDateChange: (date: number) => void;
  onEndDateChange: (date: number) => void;
}) => {
  if (!isOpen) return null;

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp * 1000);
    return date.toISOString().split('T')[0];
  };

  const parseDate = (dateString: string) => {
    return Math.floor(new Date(dateString).getTime() / 1000);
  };

  return (
    <div
      style={{
        position: 'absolute',
        left: '20px',
        top: '80px',
        background: 'rgba(0, 0, 0, 0.7)',
        color: 'white',
        padding: '20px',
        borderRadius: '8px',
        minWidth: '300px',
        zIndex: 2,
        fontFamily: '"National Park", sans-serif'
      }}
    >
      <h2 style={{ margin: '0 0 20px 0', textAlign: 'center', fontFamily: '"National Park", sans-serif' }}>Settings</h2>

      <div style={{ marginBottom: '20px' }}>
        <h3 style={{ margin: '0 0 10px 0', fontFamily: '"National Park", sans-serif' }}>Date Range</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '5px', fontFamily: '"National Park", sans-serif' }}>Start Date:</label>
            <input
              type="date"
              value={formatDate(startDate)}
              onChange={(e) => onStartDateChange(parseDate(e.target.value))}
              style={{
                width: '100%',
                padding: '8px',
                borderRadius: '4px',
                border: 'none',
                background: 'rgba(255, 255, 255, 0.1)',
                color: 'white',
                fontFamily: '"National Park", sans-serif'
              }}
            />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '5px', fontFamily: '"National Park", sans-serif' }}>End Date:</label>
            <input
              type="date"
              value={formatDate(endDate)}
              onChange={(e) => onEndDateChange(parseDate(e.target.value))}
              style={{
                width: '100%',
                padding: '8px',
                borderRadius: '4px',
                border: 'none',
                background: 'rgba(255, 255, 255, 0.1)',
                color: 'white',
                fontFamily: '"National Park", sans-serif'
              }}
            />
          </div>
        </div>
      </div>

      <div style={{ marginBottom: '20px' }}>
        <h3 style={{ margin: '0 0 10px 0', fontFamily: '"National Park", sans-serif' }}>Animation</h3>
        <div style={{ marginBottom: '15px' }}>
          <label style={{ display: 'block', marginBottom: '5px', fontFamily: '"National Park", sans-serif' }}>
            Animation Speed: {animationSpeed.toFixed(1)}x
          </label>
          <input
            type="range"
            min="3"
            max="15"
            step="1"
            value={animationSpeed}
            onChange={(e) => onAnimationSpeedChange(parseFloat(e.target.value))}
            style={{ width: '100%' }}
          />
        </div>
        <div>
          <label style={{ display: 'block', marginBottom: '5px', fontFamily: '"National Park", sans-serif' }}>
            Trail Length: {trailLength}
          </label>
          <input
            type="range"
            min="100"
            max="2000"
            step="100"
            value={trailLength}
            onChange={(e) => onTrailLengthChange(parseInt(e.target.value))}
            style={{ width: '100%' }}
          />
        </div>
      </div>

      <button
        onClick={onClose}
        style={{
          width: '100%',
          padding: '10px',
          background: 'rgba(255, 255, 255, 0.1)',
          border: 'none',
          borderRadius: '4px',
          color: 'white',
          cursor: 'pointer',
          marginTop: '10px',
          fontFamily: '"National Park", sans-serif'
        }}
      >
        Close
      </button>
    </div>
  );
};

// Burger Menu Button component
const BurgerMenuButton = ({ onClick }: { onClick: () => void }) => {
  return (
    <button
      onClick={onClick}
      style={{
        position: 'absolute',
        top: '20px',
        left: '20px',
        background: 'rgba(0, 0, 0, 0.7)',
        border: 'none',
        borderRadius: '50%',
        width: '40px',
        height: '40px',
        cursor: 'pointer',
        //display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 2,
        padding: 0
      }}
    >
      <svg
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        stroke="white"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <line x1="3" y1="12" x2="21" y2="12" />
        <line x1="3" y1="6" x2="21" y2="6" />
        <line x1="3" y1="18" x2="21" y2="18" />
      </svg>
    </button>
  );
};

// StarIconButton component
const StarIconButton = ({ onClick }: { onClick: () => void }) => {
  return (
    <button
      onClick={onClick}
      style={{
        position: 'absolute',
        top: '70px',
        left: '20px',
        background: 'rgba(0, 0, 0, 0.7)',
        border: 'none',
        borderRadius: '50%',
        width: '40px',
        height: '40px',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 2,
        padding: 0
      }}
    >
      <svg
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        stroke="white"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
      </svg>
    </button>
  );
};

// StatisticsModal component
const StatisticsModal = ({
  isOpen,
  onClose,
  trips,
  activeTrips,
  allTrips
}: {
  isOpen: boolean;
  onClose: () => void;
  trips: Trip[];
  activeTrips: { [key: number]: { speed: number, distance: number } };
  allTrips: Trip[];
}) => {
  const [stats, setStats] = useState<{
    totalDistance: number;
    totalDuration: number;
    meanSpeed: number;
    maxSpeed: number;
    numberOfTrips: number;
    meanTripDuration: number;
  } | null>(null);
  const [showAllTrips, setShowAllTrips] = useState(false);

  // Compute statistics when modal opens or when showAllTrips changes
  useEffect(() => {
    if (isOpen) {
      const tripsToUse = showAllTrips ? allTrips : trips;

      // Get final values for each trip
      const tripStats = tripsToUse.map(trip => {
        const finalDistance = trip.distances[trip.distances.length - 1] || 0;
        const finalDuration = trip.timestamps[trip.timestamps.length - 1] / 60; // Convert seconds to minutes
        const finalSpeed = trip.speeds[trip.speeds.length - 1] || 0;
        const maxSpeed = trip.max_speed;
        return {
          distance: finalDistance,
          duration: finalDuration,
          speed: finalSpeed,
          max_speed: maxSpeed,
        };
      });

      const totalDistance = tripStats.reduce((sum, trip) => sum + trip.distance, 0);
      const totalDuration = tripStats.reduce((sum, trip) => sum + trip.duration, 0);
      const meanSpeed = totalDuration > 0 ? (totalDistance / totalDuration) * 60 : 0; // km/h
      const maxSpeed = Math.max(...tripStats.map(trip => trip.max_speed));
      const numberOfTrips = tripsToUse.length;
      const meanTripDuration = numberOfTrips > 0 ? totalDuration / numberOfTrips : 0;

      setStats({
        totalDistance,
        totalDuration,
        meanSpeed,
        maxSpeed,
        numberOfTrips,
        meanTripDuration
      });
    }
  }, [isOpen, trips, allTrips, showAllTrips]);

  // Reset stats when modal closes
  useEffect(() => {
    if (!isOpen) {
      setStats(null);
      setShowAllTrips(false);
    }
  }, [isOpen]);

  if (!isOpen || !stats) return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        background: 'rgba(0, 0, 0, 0.8)',
        color: 'white',
        padding: '30px',
        borderRadius: '8px',
        minWidth: '400px',
        maxHeight: '70vh',
        zIndex: 3,
        boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        fontFamily: '"National Park", sans-serif'
      }}
    >
      <h2 style={{ margin: '0 0 20px 0', textAlign: 'center', fontFamily: '"National Park", sans-serif' }}>Statistiques</h2>

      <div className="bicycle-animation" style={{
        marginBottom: '20px',
        width: '100%',
        display: 'flex',
        justifyContent: 'center'
      }}>
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 269 134.11"
          id="svg"
          style={{
            width: '200px',
            height: 'auto'
          }}
        >
          <g id="animationWheels" transform="rotate(0 101.5 92.61)" x="0" y="0">
            <animateTransform
              attributeName="transform"
              begin="0s"
              dur="1s"
              type="rotate"
              from="0 101.5 92.61"
              to="360 101.5 92.61"
              repeatCount="indefinite"
            />
            <path id="animateThis" className="cls-3" d="M79.21 113.77a34 34 0 1 1 46.56 12 34 34 0 0 1-46.56-12z" transform="translate(-7 -3.89)" />
          </g>
          <g id="parrot" transform="rotate(0 227.5 92.61)" x="0" y="0">
            <animateTransform
              attributeName="transform"
              begin="0s"
              dur="1s"
              type="rotate"
              from="0 227.5 92.61"
              to="360 227.5 92.61"
              repeatCount="indefinite"
            />
            <path id="animateThis2" className="cls-3" d="M268.5 96.5a34 34 0 1 1-34-34 34 34 0 0 1 34 34z" transform="translate(-7 -3.89)" />
          </g>

          <g id="wheels">
            <path className="cls-1" d="M161.85 93c2 0 3.82.61 4.34 1.16a3.46 3.46 0 0 1 .32 2c-.06 1.76-.42 2.85-1 3.24a6.25 6.25 0 0 1-3 .65h-.14L160 99.7l.23-1.08.46-2.12-.46-2.12-.23-1.11 1.82-.28m-.2-10H161l-13 2 2.5 11.5L148 108l13.25 2h1.22c3.54 0 13.6-1.1 14-13.55.47-12.69-11.83-13.45-14.82-13.45z" transform="translate(-7 -3.89)" />
            <circle id="outerwheel" className="cls-2" cx="101.5" cy="92.61" r="40" />
            <path className="cls-1" d="M108.51 60.44a36.06 36.06 0 0 1 .76 72.11h-.78a36.06 36.06 0 0 1-.76-72.11h.78m0-3h-.84a39.06 39.06 0 0 0 .82 78.11h.84a39.06 39.06 0 0 0-.82-78.11z" transform="translate(-7 -3.89)" />
            <circle id="outerwheel-2" data-name="outerwheel" className="cls-2" cx="227.5" cy="92.61" r="40" />
            <path className="cls-1" d="M234.5 60.44a36.06 36.06 0 1 1-36.06 36.06 36.11 36.11 0 0 1 36.06-36.06m0-3a39.06 39.06 0 1 0 39.06 39.06 39.1 39.1 0 0 0-39.06-39.06z" transform="translate(-7 -3.89)" /><circle id="centerwheel" className="cls-2" cx="227.5" cy="92.61" r="3" />
            <circle id="centerwheel-2" data-name="centerwheel" className="cls-2" cx="101.5" cy="92.61" r="3" />
          </g>

          <g id="body">
            <path id="cBody" className="cls-4" d="M156.5 92.61l-32-69-.19-.42" />
            <path id="cBody-2" data-name="cBody" className="cls-4" d="M156.5 92.61l53-57" />
            <path id="cBody-3" data-name="cBody" className="cls-4" d="M117 7.11l7.31 16.08" />
            <path id="cBody-4" data-name="cBody" className="cls-4" d="M124.5 22.61h84" />
            <path id="cBody-5" data-name="cBody" className="cls-4" d="M124.31 23.19L101.5 92.61" />
            <path id="cBody-6" data-name="cBody" className="cls-4" d="M101.5 92.61h55" />
            <path id="cBody-7" data-name="cBody" className="cls-4" d="M234.5 96.5c-16-19-19-70-19-70" transform="translate(-7 -3.89)" />
            <path id="cBody-8" data-name="cBody" className="cls-4" d="M224.5 10.61h-17l1 12" />
            <path id="ok" d="M140 11c-2.57-4.29-8-4-8-4h-9c-3 0-9-2-9-2-2-1-1.7-1.29-2-1-.78.75-.08 3.35 0 4 .16 1.34 1 4 2 5a4.52 4.52 0 0 0 5 1c1.7-.85 5-3.15 7-3 13 1 14 0 14 0" transform="translate(-7 -3.89)" fill="#4d4d4d" />
            <path id="ok-2" data-name="ok" d="M224.25 10.61a7 7 0 0 1 0 14" stroke="#4d4d4d" stroke-width="4" stroke-linecap="round" stroke-miterlimit="10" fill="none" />
            <path className="cls-1" d="M162.5 81A12.5 12.5 0 1 0 175 93.5 12.5 12.5 0 0 0 162.5 81z" transform="translate(-7 -3.89)" />
            <path id="ok-3" data-name="ok" className="cls-1" d="M149 86l4 9-3 6v-9c0-6-1-6-1-6z" transform="translate(-7 -3.89)" />
            <path id="ok-4" data-name="ok" className="cls-2" d="M162.5 81.5a14.86 14.86 0 0 0-4.5.69L107 92a4.53 4.53 0 0 0 0 9l51 9.81a14.86 14.86 0 0 0 4.5.69 15 15 0 0 0 0-30z" transform="translate(-7 -3.89)" />
            <path d="M108.5 91.5a5 5 0 1 0 5 5 5 5 0 0 0-5-5z" transform="translate(-7 -3.89)" fill="#333" /><path id="ok-5" data-name="ok" d="M155.5 77.61a14.86 14.86 0 0 0-4.5.69l-51 9.81a4.53 4.53 0 0 0 0 9l51 9.81a14.86 14.86 0 0 0 4.5.69 15 15 0 0 0 0-30z" fill="#b3b3b3" opacity=".5" stroke-width="3" stroke-miterlimit="10" stroke="#333" />
          </g>

          <g id="effects">
            <path id="effects10" stroke="#f2f2f2" fill="#998675" stroke-width="4" stroke-linejoin="round" stroke-linecap="round" d="M104.5 32.61h-63" />
            <path id="effects9" className="cls-10" d="M104 42.11H75" />
            <path id="effects8" className="cls-10" d="M68 127.11H22" />
            <path id="effects7" className="cls-10" d="M61 118.11H38" />
            <path id="effects6" className="cls-10" d="M54 108.11H25" />
            <path id="effects5" className="cls-10" d="M104 23.11H80" />
            <path id="effects4" className="cls-10" d="M80 51.11H66" />
            <path id="effects3" className="cls-10" d="M49 97.11H2" />
            <path id="effects2" className="cls-10" d="M195 127.11h-23" />
            <path id="effects1" data-name="effects" className="cls-10" d="M184 120.11h-33" />
          </g>
        </svg>
      </div>

      <div style={{
        display: 'flex',
        alignItems: 'center',
        marginBottom: '20px',
        gap: '10px',
        justifyContent: 'center'
      }}>
        <label style={{ cursor: 'pointer', fontFamily: '"National Park", sans-serif' }}>
          Depuis le début
        </label>
        <div
          style={{
            position: 'relative',
            width: '50px',
            height: '24px',
            borderRadius: '12px',
            background: showAllTrips ? '#4CAF50' : '#ccc',
            cursor: 'pointer',
            transition: 'background 0.3s ease'
          }}
          onClick={() => setShowAllTrips(!showAllTrips)}
        >
          <div
            style={{
              position: 'absolute',
              width: '20px',
              height: '20px',
              borderRadius: '10px',
              background: 'white',
              top: '2px',
              left: showAllTrips ? '28px' : '2px',
              transition: 'left 0.3s ease'
            }}
          />
        </div>
      </div>

      <div style={{
        display: 'grid',
        gap: '15px',
        width: '100%',
        overflowY: 'auto',
        maxHeight: 'calc(70vh - 250px)',
        paddingRight: '10px',
        scrollbarWidth: 'thin',
        scrollbarColor: 'rgba(255, 255, 255, 0.3) rgba(0, 0, 0, 0.1)'
      }}>
        <div style={{
          background: 'rgba(255, 255, 255, 0.1)',
          padding: '15px',
          borderRadius: '4px',
          textAlign: 'center',
          fontFamily: '"National Park", sans-serif'
        }}>
          <div style={{ fontWeight: 'bold', marginBottom: '5px' }}>Nombre de trajets: {stats.numberOfTrips}</div>
        </div>
        <div style={{
          background: 'rgba(255, 255, 255, 0.1)',
          padding: '15px',
          borderRadius: '4px',
          textAlign: 'center',
          fontFamily: '"National Park", sans-serif'
        }}>
          <div style={{ fontWeight: 'bold', marginBottom: '5px' }}>Distance totale: {stats.totalDistance.toFixed(1)} km</div>
        </div>
        <div style={{
          background: 'rgba(255, 255, 255, 0.1)',
          padding: '15px',
          borderRadius: '4px',
          textAlign: 'center',
          fontFamily: '"National Park", sans-serif'
        }}>
          <div style={{ fontWeight: 'bold', marginBottom: '5px' }}>Durée totale: {stats.totalDuration.toFixed(1)} minutes</div>
        </div>
        <div style={{
          background: 'rgba(255, 255, 255, 0.1)',
          padding: '15px',
          borderRadius: '4px',
          textAlign: 'center',
          fontFamily: '"National Park", sans-serif'
        }}>
          <div style={{ fontWeight: 'bold', marginBottom: '5px' }}>Durée moyenne par trajet: {stats.meanTripDuration.toFixed(1)} minutes</div>
        </div>
        <div style={{
          background: 'rgba(255, 255, 255, 0.1)',
          padding: '15px',
          borderRadius: '4px',
          textAlign: 'center',
          fontFamily: '"National Park", sans-serif'
        }}>
          <div style={{ fontWeight: 'bold', marginBottom: '5px' }}>Vitesse moyenne: {stats.meanSpeed.toFixed(1)} km/h</div>
        </div>
        <div style={{
          background: 'rgba(255, 255, 255, 0.1)',
          padding: '15px',
          borderRadius: '4px',
          textAlign: 'center',
          fontFamily: '"National Park", sans-serif'
        }}>
          <div style={{ fontWeight: 'bold', marginBottom: '5px' }}>Vitesse max: {stats.maxSpeed.toFixed(1)} km/h</div>
        </div>
      </div>

      <button
        onClick={onClose}
        style={{
          width: '100%',
          padding: '10px',
          background: 'rgba(255, 255, 255, 0.1)',
          border: 'none',
          borderRadius: '4px',
          color: 'white',
          cursor: 'pointer',
          marginTop: '20px',
          fontFamily: '"National Park", sans-serif'
        }}
      >
        Fermer
      </button>
    </div>
  );
};

// TrackInfoPanel component
const TrackInfoPanel = ({ trips, activeTrips }: {
  trips: Trip[];
  activeTrips: { [key: number]: { speed: number, distance: number } };
}) => {
  return (
    <div
      style={{
        display: 'none', // TODO: remove this
        position: 'absolute',
        right: '20px',
        top: '20px',
        background: 'rgba(0, 0, 0, 0.7)',
        color: 'white',
        padding: '15px',
        borderRadius: '8px',
        fontSize: '14px',
        maxHeight: 'calc(100vh - 40px)',
        overflowY: 'auto',
        // minWidth: '300px',
        zIndex: 1,
        fontFamily: '"National Park", sans-serif'
      }}
    >
      <h3 style={{ margin: '0 0 15px 0', textAlign: 'center', fontFamily: '"National Park", sans-serif' }}>Track Information</h3>
      {trips.map(trip => {
        const info = activeTrips[trip.trackID] || { speed: 0, distance: 0 };
        return (
          <div
            key={trip.trackID}
            style={{
              marginBottom: '10px',
              padding: '8px',
              background: 'rgba(255, 255, 255, 0.1)',
              borderRadius: '4px',
              fontFamily: '"National Park", sans-serif'
            }}
          >
            <div style={{ fontWeight: 'bold' }}>Track ID: {trip.trackID}</div>
            <div>Start Date: {trip.formatted_start_date}</div>
            <div>Speed: {info.speed.toFixed(1)} km/h</div>
            <div>Distance: {info.distance.toFixed(1)} km</div>
          </div>
        );
      })}
    </div>
  );
};

export default function App({
  buildings = DATA_URL.BUILDINGS,
  trips = DATA_URL.TRIPS,
  trailLength = 800,
  initialViewState = INITIAL_VIEW_STATE,
  mapStyle = MAP_STYLE,
  theme = DEFAULT_THEME,
  initialAnimationSpeed = 7,
}: {
  buildings?: string | Building[];
  trips?: string | Trip[];
  trailLength?: number;
  initialAnimationSpeed?: number;
  initialViewState?: MapViewState;
  mapStyle?: string;
  theme?: Theme;
}) {
  const [time, setTime] = useState(0);
  const [animationSpeed, setAnimationSpeed] = useState(initialAnimationSpeed);
  const [currentTrailLength, setCurrentTrailLength] = useState(trailLength);
  const [animation, setAnimation] = useState<any>(null);
  const [startDate, setStartDate] = useState(0);
  const [endDate, setEndDate] = useState(0);
  const [filteredTrips, setFilteredTrips] = useState<Trip[]>([]);
  const [allTrips, setAllTrips] = useState<Trip[]>([]);
  const [loopLength, setLoopLength] = useState(180);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isStatsOpen, setIsStatsOpen] = useState(false);
  const [activeTrips, setActiveTrips] = useState<{ [key: number]: { speed: number, distance: number } }>({});

  // Function to calculate color based on trip start time
  const getTripColor = (trip: Trip): Color => {
    const timeRange = endDate - startDate;
    const relativeTime = (trip.start - startDate) / timeRange;

    // Interpolate between red and green based on relative time
    const r = Math.floor(255 * (1 - relativeTime));
    const g = Math.floor(255 * relativeTime);
    const b = 0;

    return [r, g, b] as Color;
  };

  // Calculate maximum timestamp across all trips
  const calculateMaxTimestamp = (trips: Trip[]) => {
    if (trips.length === 0) return 180; // Default value if no trips
    return 200 + Math.max(...trips.map(trip => Math.max(...trip.timestamps)));
  };

  // Load and filter trips data
  useEffect(() => {
    if (typeof trips === 'string') {
      fetch(trips)
        .then(response => response.json())
        .then(data => {
          setAllTrips(data);

          // Find min and max start dates
          const minStartDate = Math.min(...data.map((trip: Trip) => trip.start));
          const maxStartDate = Math.max(...data.map((trip: Trip) => trip.start));

          // Set initial date range
          setStartDate(minStartDate);
          setEndDate(maxStartDate);

          // Filter trips for the initial date range
          const filtered = data.filter((trip: Trip) =>
            trip.start >= minStartDate && trip.start <= maxStartDate
          );
          setFilteredTrips(filtered);
          setLoopLength(calculateMaxTimestamp(filtered));
        });
    } else {
      setAllTrips(trips);

      // Find min and max start dates
      const minStartDate = Math.min(...trips.map(trip => trip.start));
      const maxStartDate = Math.max(...trips.map(trip => trip.start));

      // Set initial date range
      setStartDate(minStartDate);
      setEndDate(maxStartDate);

      // Filter trips for the initial date range
      const filtered = trips.filter(trip =>
        trip.start >= minStartDate && trip.start <= maxStartDate
      );
      setFilteredTrips(filtered);
      setLoopLength(calculateMaxTimestamp(filtered));
    }
  }, [trips]);

  // Update filtered trips when date range changes
  useEffect(() => {
    const filtered = allTrips.filter(trip =>
      trip.start >= startDate && trip.start <= endDate
    );
    setFilteredTrips(filtered);
    setLoopLength(calculateMaxTimestamp(filtered));
  }, [startDate, endDate, allTrips]);

  // Effect to handle animation
  useEffect(() => {
    if (animation) {
      animation.stop();
    }

    // Reset time when filtered trips change
    setTime(0);

    const newAnimation = animate({
      from: 0,
      to: loopLength,
      duration: (loopLength * 60) / animationSpeed,
      repeat: Infinity,
      onUpdate: setTime
    });

    setAnimation(newAnimation);

    return () => newAnimation.stop();
  }, [loopLength, animationSpeed, filteredTrips]);

  // Update active trips information based on current time
  useEffect(() => {
    if (filteredTrips.length === 0) return;

    const newActiveTrips: { [key: number]: { speed: number, distance: number } } = {};

    filteredTrips.forEach(trip => {
      const currentIndex = Math.min(
        Math.floor((time / loopLength) * trip.timestamps.length),
        trip.timestamps.length - 1
      );

      if (currentIndex >= 0 && currentIndex < trip.path.length) {
        const currentSpeed = trip.speeds[currentIndex] || 0;
        const currentDistance = trip.distances[currentIndex] || 0;

        newActiveTrips[trip.trackID] = {
          speed: currentSpeed,
          distance: currentDistance
        };
      }
    });

    setActiveTrips(newActiveTrips);
  }, [time, filteredTrips, loopLength]);

  const layers = [
    new PolygonLayer<Position[]>({
      id: 'ground',
      data: landCover,
      getPolygon: f => f,
      stroked: false,
      getFillColor: [0, 0, 0, 0]
    }),
    new TripsLayer<Trip>({
      id: 'trips',
      data: filteredTrips,
      getPath: d => d.path,
      getTimestamps: d => d.timestamps,
      getColor: d => getTripColor(d),
      opacity: 0.8,
      widthMinPixels: 2,
      rounded: true,
      trailLength: currentTrailLength,
      currentTime: time,
      pickable: false
    }),
    new PolygonLayer<Building>({
      id: 'buildings',
      data: buildings,
      extruded: true,
      wireframe: false,
      opacity: 0.5,
      getPolygon: f => f.polygon,
      getElevation: f => f.height,
      getFillColor: theme.buildingColor,
      material: theme.material
    })
  ];

  return (
    <>
      <DeckGL
        layers={layers}
        effects={theme.effects}
        initialViewState={initialViewState}
        controller={true}
      >
        <Map reuseMaps mapStyle={mapStyle} />
      </DeckGL>
      <BurgerMenuButton onClick={() => setIsSettingsOpen(true)} />
      <StarIconButton onClick={() => setIsStatsOpen(true)} />
      <SettingsMenu
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        animationSpeed={animationSpeed}
        onAnimationSpeedChange={setAnimationSpeed}
        trailLength={currentTrailLength}
        onTrailLengthChange={setCurrentTrailLength}
        startDate={startDate}
        endDate={endDate}
        onStartDateChange={setStartDate}
        onEndDateChange={setEndDate}
      />
      <StatisticsModal
        isOpen={isStatsOpen}
        onClose={() => setIsStatsOpen(false)}
        trips={filteredTrips}
        activeTrips={activeTrips}
        allTrips={allTrips}
      />
      <TrackInfoPanel trips={filteredTrips} activeTrips={activeTrips} />
    </>
  );
}

export function renderToDOM(container: HTMLDivElement) {
  createRoot(container).render(<App />);
}