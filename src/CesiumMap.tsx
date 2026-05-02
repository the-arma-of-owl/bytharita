import { useEffect, useRef } from 'react';
import * as Cesium from 'cesium';
import 'cesium/Build/Cesium/Widgets/widgets.css';

interface CesiumMapProps {
  onLocationSelect?: (lat: number, lng: number) => void;
  onRadiusChange?: (index: number, newRadius: number) => void;
  defaultLat?: number;
  defaultLng?: number;
  settings?: any;
  isSettingsMode?: boolean;
}

function haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export default function CesiumMap({ 
  onLocationSelect, 
  onRadiusChange, 
  defaultLat = 41.0082, 
  defaultLng = 28.9784, 
  settings, 
  isSettingsMode = false 
}: CesiumMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<Cesium.Viewer | null>(null);
  const stateRef = useRef({
    isDragging: false,
    draggedIndex: -1,
    distRefs: {} as Record<number, number>
  });

  useEffect(() => {
    if (!containerRef.current) return;

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
      destination: Cesium.Cartesian3.fromDegrees(defaultLng, defaultLat, isSettingsMode ? 300 : 5000), 
    });

    const handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);

    handler.setInputAction((click: any) => {
      const pickedObject = viewer.scene.pick(click.position);
      if (isSettingsMode && Cesium.defined(pickedObject) && pickedObject.id && pickedObject.id.isThresholdHandle) {
        stateRef.current.isDragging = true;
        stateRef.current.draggedIndex = pickedObject.id.thresholdIndex;
        viewer.scene.screenSpaceCameraController.enableInputs = false; // Disable camera
      } else if (onLocationSelect && !isSettingsMode) {
        const ellipsoid = viewer.scene.globe.ellipsoid;
        const cartesian = viewer.camera.pickEllipsoid(click.position, ellipsoid);
        if (cartesian) {
          const cartographic = ellipsoid.cartesianToCartographic(cartesian);
          onLocationSelect(
            Cesium.Math.toDegrees(cartographic.latitude), 
            Cesium.Math.toDegrees(cartographic.longitude)
          );
        }
      }
    }, Cesium.ScreenSpaceEventType.LEFT_DOWN);

    handler.setInputAction((movement: any) => {
      if (stateRef.current.isDragging && stateRef.current.draggedIndex !== -1) {
        const ray = viewer.camera.getPickRay(movement.endPosition);
        if (ray) {
          const cartesian = viewer.scene.globe.pick(ray, viewer.scene);
          if (cartesian) {
            const ellipsoid = viewer.scene.globe.ellipsoid;
            const cartographic = ellipsoid.cartesianToCartographic(cartesian);
            const lat2 = Cesium.Math.toDegrees(cartographic.latitude);
            const lng2 = Cesium.Math.toDegrees(cartographic.longitude);
            const dist = haversineDistance(defaultLat, defaultLng, lat2, lng2);
            stateRef.current.distRefs[stateRef.current.draggedIndex] = Math.max(1, dist);
          }
        }
      }
    }, Cesium.ScreenSpaceEventType.MOUSE_MOVE);

    handler.setInputAction(() => {
      if (stateRef.current.isDragging) {
        if (onRadiusChange && stateRef.current.draggedIndex !== -1) {
          const finalDist = stateRef.current.distRefs[stateRef.current.draggedIndex];
          onRadiusChange(stateRef.current.draggedIndex, Math.round(finalDist));
        }
        stateRef.current.isDragging = false;
        stateRef.current.draggedIndex = -1;
        viewer.scene.screenSpaceCameraController.enableInputs = true;
      }
    }, Cesium.ScreenSpaceEventType.LEFT_UP);

    return () => {
      if (viewer && !viewer.isDestroyed()) {
        handler.destroy();
        viewer.destroy();
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); 

  // Update entities when settings or default location change
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer) return;

    viewer.entities.removeAll();

    const pos = Cesium.Cartesian3.fromDegrees(defaultLng, defaultLat);
    viewer.entities.add({
      position: pos,
      point: {
        pixelSize: 15,
        color: Cesium.Color.RED,
        outlineColor: Cesium.Color.WHITE,
        outlineWidth: 2
      },
    });

    if (settings?.thresholds) {
      settings.thresholds.forEach((t: any, i: number) => {
        stateRef.current.distRefs[i] = t.maxDistance;

        viewer.entities.add({
          position: pos,
          ellipse: {
            semiMinorAxis: new Cesium.CallbackProperty(() => stateRef.current.distRefs[i] || 1, false),
            semiMajorAxis: new Cesium.CallbackProperty(() => stateRef.current.distRefs[i] || 1, false),
            material: Cesium.Color.fromCssColorString(t.color).withAlpha(0.2),
            outline: true,
            outlineColor: Cesium.Color.fromCssColorString(t.color).withAlpha(0.8),
            outlineWidth: 2,
            height: 0
          }
        });

        if (isSettingsMode) {
          const handleEntity = viewer.entities.add({
            position: new Cesium.CallbackProperty(() => {
              const dist = stateRef.current.distRefs[i] || 1;
              const hc = Cesium.Cartographic.fromDegrees(defaultLng, defaultLat);
              hc.longitude += (dist / (111320 * Math.cos(defaultLat * Math.PI/180)));
              return Cesium.Cartographic.toCartesian(hc);
            }, false),
            point: {
              pixelSize: 20,
              color: Cesium.Color.YELLOW,
              outlineColor: Cesium.Color.BLACK,
              outlineWidth: 3,
              disableDepthTestDistance: Number.POSITIVE_INFINITY
            }
          });
          (handleEntity as any).isThresholdHandle = true;
          (handleEntity as any).thresholdIndex = i;
        }
      });
    }
  }, [defaultLat, defaultLng, settings, isSettingsMode]);

  return (
    <div className="relative w-full h-full rounded-xl overflow-hidden">
      <div ref={containerRef} className="w-full h-full" />
      {isSettingsMode && (
        <div className="absolute top-2 right-2 bg-black/80 px-3 py-2 rounded-lg text-sm text-yellow-400 pointer-events-none border border-yellow-700/50">
          Sarı noktalardan tutarak çapı ayarlayın
        </div>
      )}
    </div>
  );
}
