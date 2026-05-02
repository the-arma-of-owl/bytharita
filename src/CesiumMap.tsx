import { useEffect, useRef } from 'react';
import * as Cesium from 'cesium';
import 'cesium/Build/Cesium/Widgets/widgets.css';

interface CesiumMapProps {
  onLocationSelect: (lat: number, lng: number) => void;
  defaultLat?: number;
  defaultLng?: number;
  settings?: any; // To receive the settings object with thresholds
}

export default function CesiumMap({ onLocationSelect, defaultLat = 41.0082, defaultLng = 28.9784, settings }: CesiumMapProps) {
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

    // Function to draw circles based on settings
    const drawCircles = (lat: number, lng: number) => {
      // Remove all previous entities
      viewer.entities.removeAll();

      // Add the pin
      const pos = Cesium.Cartesian3.fromDegrees(lng, lat);
      viewer.entities.add({
        position: pos,
        point: {
          pixelSize: 15,
          color: Cesium.Color.RED,
          outlineColor: Cesium.Color.WHITE,
          outlineWidth: 2
        },
      });

      // Add threshold circles
      if (settings?.thresholds) {
        // Sort ascending by distance to draw largest first so they don't cover smaller ones
        // Actually, rendering order in Cesium 3D depends on height or depth test. Setting alpha helps.
        const sorted = [...settings.thresholds].sort((a: any, b: any) => b.maxDistance - a.maxDistance);
        sorted.forEach((t: any) => {
          viewer.entities.add({
            position: pos,
            ellipse: {
              semiMinorAxis: t.maxDistance,
              semiMajorAxis: t.maxDistance,
              material: Cesium.Color.fromCssColorString(t.color).withAlpha(0.2),
              outline: true,
              outlineColor: Cesium.Color.fromCssColorString(t.color).withAlpha(0.8),
              outlineWidth: 2,
              height: 0 // to ensure they stay on the ground
            }
          });
        });
      }
    };

    // Draw initial state
    drawCircles(defaultLat, defaultLng);

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

        // Update the pin and circles
        drawCircles(lat, lng);
      }
    }, Cesium.ScreenSpaceEventType.LEFT_CLICK);

    return () => {
      if (viewer && !viewer.isDestroyed()) {
        handler.destroy();
        viewer.destroy();
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings]); // Re-run if settings change so circles update

  return <div ref={containerRef} className="w-full h-full rounded-xl overflow-hidden" />;
}
