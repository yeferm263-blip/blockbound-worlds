import { useEffect, useRef } from "react";
import * as THREE from "three";

interface MenuPanoramaProps {
  blurred?: boolean;
}

export function MenuPanorama({ blurred = false }: MenuPanoramaProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: false,
      powerPreference: "high-performance",
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    renderer.setSize(window.innerWidth, window.innerHeight, false);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x8cbdf7);
    scene.fog = new THREE.FogExp2(0xa9ccf8, 0.012);

    const camera = new THREE.PerspectiveCamera(
      85,
      window.innerWidth / window.innerHeight,
      0.1,
      600,
    );
    // Position camera on a hilltop overlooking the panorama
    camera.position.set(0, 16, 0);

    // Lights
    const ambientLight = new THREE.AmbientLight(0xfff0dd, 1.4);
    const sunLight = new THREE.DirectionalLight(0xfff7e6, 2.0);
    sunLight.position.set(40, 60, -30);
    scene.add(ambientLight, sunLight);

    // Materials
    const grassTopMat = new THREE.MeshLambertMaterial({ color: 0x5b8e32 });
    const grassSideMat = new THREE.MeshLambertMaterial({ color: 0x6e5237 });
    const dirtMat = new THREE.MeshLambertMaterial({ color: 0x866043 });
    const woodMat = new THREE.MeshLambertMaterial({ color: 0x675135 });
    const leavesMat = new THREE.MeshLambertMaterial({
      color: 0x3d7023,
      transparent: true,
      opacity: 0.95,
    });
    const waterMat = new THREE.MeshLambertMaterial({
      color: 0x3f76e4,
      transparent: true,
      opacity: 0.8,
    });
    const sandMat = new THREE.MeshLambertMaterial({ color: 0xd8cb92 });
    const stoneMat = new THREE.MeshLambertMaterial({ color: 0x777777 });
    const cloudMat = new THREE.MeshLambertMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.82,
    });

    const boxGeo = new THREE.BoxGeometry(1, 1, 1);
    const sceneGroup = new THREE.Group();

    // 1. Procedural Voxel Terrain Ring (Minecraft Hills)
    // Instanced meshes for great performance
    const maxBlocks = 3500;
    const terrainInstanced = new THREE.InstancedMesh(boxGeo, grassTopMat, maxBlocks);
    const dummy = new THREE.Object3D();

    let blockIdx = 0;
    const radius = 48;
    const step = 2;

    for (let x = -radius; x <= radius; x += step) {
      for (let z = -radius; z <= radius; z += step) {
        const dist = Math.sqrt(x * x + z * z);
        if (dist > radius || dist < 4) continue;
        if (blockIdx >= maxBlocks) break;

        // Multi-frequency hill height
        const h1 = Math.sin(x * 0.08) * Math.cos(z * 0.08) * 7;
        const h2 = Math.sin(x * 0.15 + 1.2) * Math.cos(z * 0.15) * 3;
        const h3 = Math.sin(dist * 0.06) * 4;
        let y = Math.floor(h1 + h2 + h3 + 8);

        // Water basin in the center/forward
        if (y < 6 && dist < 32 && z > -15) {
          y = 5;
        }

        dummy.position.set(x, y, z);
        dummy.scale.set(step, 1.2, step);
        dummy.updateMatrix();
        terrainInstanced.setMatrixAt(blockIdx++, dummy.matrix);

        // Subsurface stone/dirt layer
        if (y > 9 && blockIdx < maxBlocks) {
          dummy.position.set(x, y - 1.2, z);
          dummy.scale.set(step, 1.2, step);
          dummy.updateMatrix();
          terrainInstanced.setMatrixAt(blockIdx++, dummy.matrix);
        }
      }
    }
    terrainInstanced.count = blockIdx;
    terrainInstanced.instanceMatrix.needsUpdate = true;
    sceneGroup.add(terrainInstanced);

    // 2. Water Lake
    const lakeGeo = new THREE.BoxGeometry(45, 0.4, 45);
    const lakeMesh = new THREE.Mesh(lakeGeo, waterMat);
    lakeMesh.position.set(10, 5.7, 10);
    sceneGroup.add(lakeMesh);

    // 3. Sand shoreline
    const sandGeo = new THREE.BoxGeometry(48, 0.3, 48);
    const sandMesh = new THREE.Mesh(sandGeo, sandMat);
    sandMesh.position.set(10, 5.5, 10);
    sceneGroup.add(sandMesh);

    // 4. Voxel Trees
    const addTree = (tx: number, tz: number, ty: number) => {
      const treeGroup = new THREE.Group();
      treeGroup.position.set(tx, ty, tz);

      // Trunk (wood logs)
      const trunk = new THREE.Mesh(new THREE.BoxGeometry(1.2, 5, 1.2), woodMat);
      trunk.position.y = 2.5;
      treeGroup.add(trunk);

      // Canopy layers
      const canopy1 = new THREE.Mesh(new THREE.BoxGeometry(4.2, 1.8, 4.2), leavesMat);
      canopy1.position.y = 4.2;
      const canopy2 = new THREE.Mesh(new THREE.BoxGeometry(3, 1.5, 3), leavesMat);
      canopy2.position.y = 5.5;
      const canopyTop = new THREE.Mesh(new THREE.BoxGeometry(1.8, 1.2, 1.8), leavesMat);
      canopyTop.position.y = 6.8;

      treeGroup.add(canopy1, canopy2, canopyTop);
      sceneGroup.add(treeGroup);
    };

    const treePositions = [
      [14, 18, 10],
      [-16, 22, 12],
      [-24, -14, 9],
      [22, -18, 11],
      [30, 8, 8],
      [-12, -26, 13],
      [18, -32, 9],
      [-28, 20, 11],
      [26, 24, 12],
      [-8, 30, 8],
    ];
    for (const [tx, tz, ty] of treePositions) {
      addTree(tx, tz, ty);
    }

    // 5. Fluffy Minecraft Cubic Clouds
    const cloudsGroup = new THREE.Group();
    cloudsGroup.position.y = 48;
    for (let i = 0; i < 28; i++) {
      const cw = 14 + (i % 5) * 6;
      const cd = 12 + (i % 4) * 8;
      const cloud = new THREE.Mesh(new THREE.BoxGeometry(cw, 3, cd), cloudMat);
      const angle = (i / 28) * Math.PI * 2;
      const r = 55 + (i % 3) * 20;
      cloud.position.set(Math.cos(angle) * r, (i % 2) * 2, Math.sin(angle) * r);
      cloudsGroup.add(cloud);
    }
    sceneGroup.add(cloudsGroup);

    // 6. Warm Sun & Celestial Horizon
    const sunPlane = new THREE.Mesh(
      new THREE.PlaneGeometry(18, 18),
      new THREE.MeshBasicMaterial({ color: 0xfffae0, transparent: true, opacity: 0.95 }),
    );
    sunPlane.position.set(110, 42, -90);
    sunPlane.lookAt(0, 16, 0);
    sceneGroup.add(sunPlane);

    scene.add(sceneGroup);

    // Continuous slow Bedrock rotation
    let rotY = 0;
    let animId = 0;

    const onResize = () => {
      if (!canvas) return;
      const width = window.innerWidth;
      const height = window.innerHeight;
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height, false);
    };
    window.addEventListener("resize", onResize);

    const animate = () => {
      animId = requestAnimationFrame(animate);

      // Bedrock-style continuous slow panoramic pan
      rotY += 0.0012;
      camera.rotation.set(0, rotY, 0);

      // Clouds slowly drift
      cloudsGroup.rotation.y += 0.0003;

      renderer.render(scene, camera);
    };

    animId = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("resize", onResize);
      renderer.dispose();
      boxGeo.dispose();
      lakeGeo.dispose();
      sandGeo.dispose();
      grassTopMat.dispose();
      grassSideMat.dispose();
      dirtMat.dispose();
      woodMat.dispose();
      leavesMat.dispose();
      waterMat.dispose();
      sandMat.dispose();
      stoneMat.dispose();
      cloudMat.dispose();
    };
  }, []);

  return (
    <div className="absolute inset-0 pointer-events-none select-none overflow-hidden z-0">
      <canvas
        ref={canvasRef}
        className={`w-full h-full block transition-all duration-500 ease-out ${
          blurred
            ? "filter blur-md brightness-60 scale-105"
            : "filter blur-none brightness-100 scale-100"
        }`}
      />
      {/* Subtle vignette for authentic Bedrock menu depth */}
      <div
        className={`absolute inset-0 pointer-events-none transition-opacity duration-500 ${
          blurred ? "bg-black/45" : "bg-radial from-transparent via-transparent to-black/30"
        }`}
      />
    </div>
  );
}
