import { useEffect, useRef } from 'react';
import * as Cesium from 'cesium';
import 'cesium/Build/Cesium/Widgets/widgets.css';

interface CesiumMapProps {
  onLocationSelect: (lat: number, lng: number) => void;
  defaultLat?: number;
  defaultLng?: number;
}

export default function CesiumMap({ onLocationSelect, defaultLat = 41.0082, defaultLng = 28.9784 }: CesiumMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<Cesium.Viewer | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    // Initialize the Cesium Viewer
    const viewer = new Cesium.Viewer(containerRef.current, {
      animation: false,
      baseLayerPicker: true,
      fullscreenButton: false,
      vrButton: false,
      geocoder: true,
      homeButton: false,
      infoBox: false,
      sceneModePicker: false,
      selectionIndicator: false,
      timeline: false,
      navigationHelpButton: false,
      navigationInstructionsInitiallyVisible: false,
      scene3DOnly: true,
      shouldAnimate: false,
    });

    viewerRef.current = viewer;

    const creditContainer = viewer.bottomContainer;
    if (creditContainer) {
       (creditContainer as HTMLElement).style.display = "none";
    }

    // Go to default location
    viewer.camera.flyTo({
      destination: Cesium.Cartesian3.fromDegrees(defaultLng, defaultLat, 5000), // 5000m height
    });

    // Add a pin for the initial location
    const initialPos = Cesium.Cartesian3.fromDegrees(defaultLng, defaultLat);
    viewer.entities.add({
      position: initialPos,
      point: {
        pixelSize: 15,
        color: Cesium.Color.RED,
        outlineColor: Cesium.Color.WHITE,
        outlineWidth: 2
      },
    });

    // Handle clicks
    const handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);
    handler.setInputAction((click: any) => {
      const ellipsoid = viewer.scene.globe.ellipsoid;
      const cartesian = viewer.camera.pickEllipsoid(click.position, ellipsoid);
      if (cartesian) {
        const cartographic = ellipsoid.cartesianToCartographic(cartesian);
        const lng = Cesium.Math.toDegrees(cartographic.longitude);
        const lat = Cesium.Math.toDegrees(cartographic.latitude);
        
        onLocationSelect(lat, lng);

        // Update the pin
        viewer.entities.removeAll();
        viewer.entities.add({
          position: cartesian,
          point: {
            pixelSize: 15,
            color: Cesium.Color.RED,
            outlineColor: Cesium.Color.WHITE,
            outlineWidth: 2
          },
        });
      }
    }, Cesium.ScreenSpaceEventType.LEFT_CLICK);

    return () => {
      if (viewer && !viewer.isDestroyed()) {
        handler.destroy();
        viewer.destroy();
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only run once on mount

  return <div ref={containerRef} className="w-full h-full rounded-xl overflow-hidden" />;
}
