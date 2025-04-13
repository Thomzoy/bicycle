import React, {useState, useEffect} from 'react';
import {createRoot} from 'react-dom/client';
import {Map} from 'react-map-gl/maplibre';
import {AmbientLight, PointLight, LightingEffect} from '@deck.gl/core';
import DeckGL from '@deck.gl/react';
import {PolygonLayer} from '@deck.gl/layers';
import {TripsLayer} from '@deck.gl/geo-layers';
import {animate} from 'popmotion';

import type {Position, Color, Material, MapViewState} from '@deck.gl/core';

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

const lightingEffect = new LightingEffect({ambientLight, pointLight});

type Theme = {
  buildingColor: Color;
  trailColor0: Color;
  trailColor1: Color;
  material: Material;
  effects: [LightingEffect];
};

const DEFAULT_THEME: Theme = {
  buildingColor: [74, 80, 87],
  trailColor0: [253, 128, 93],
  trailColor1: [23, 184, 190],
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
  vendor: number;
  path: Position[];
  timestamps: number[];
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

export default function App({
  buildings = DATA_URL.BUILDINGS,
  trips = DATA_URL.TRIPS,
  trailLength = 1800,
  initialViewState = INITIAL_VIEW_STATE,
  mapStyle = MAP_STYLE,
  theme = DEFAULT_THEME,
  loopLength = 1800, // unit corresponds to the timestamp in source data
  initialAnimationSpeed = 4,
}: {
  buildings?: string | Building[];
  trips?: string | Trip[];
  trailLength?: number;
  loopLength?: number;
  initialAnimationSpeed?: number;
  initialViewState?: MapViewState;
  mapStyle?: string;
  theme?: Theme;
}) {
  const [time, setTime] = useState(0);
  const [animationSpeed, setAnimationSpeed] = useState(initialAnimationSpeed);
  const [animation, setAnimation] = useState<any>(null);

  // Effect to handle animation
  useEffect(() => {
    // Stop any existing animation
    if (animation) {
      animation.stop();
    }

    // Create new animation with current speed
    const newAnimation = animate({
      from: 0,
      to: loopLength,
      duration: (loopLength * 60) / animationSpeed,
      repeat: Infinity,
      onUpdate: setTime
    });

    setAnimation(newAnimation);

    // Cleanup function
    return () => newAnimation.stop();
  }, [loopLength, animationSpeed]);

  const layers = [
    // This is only needed when using shadow effects
    new PolygonLayer<Position[]>({
      id: 'ground',
      data: landCover,
      getPolygon: f => f,
      stroked: false,
      getFillColor: [0, 0, 0, 0]
    }),
    new TripsLayer<Trip>({
      id: 'trips',
      data: trips,
      getPath: d => d.path,
      getTimestamps: d => d.timestamps,
      getColor: d => (d.vendor === 0 ? theme.trailColor0 : theme.trailColor1),
      opacity: 0.5,
      widthMinPixels: 2,
      rounded: true,
      trailLength,
      currentTime: time,
      shadowEnabled: false
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
      <SpeedSlider value={animationSpeed} onChange={setAnimationSpeed} />
    </>
  );
}

export function renderToDOM(container: HTMLDivElement) {
  createRoot(container).render(<App />);
}