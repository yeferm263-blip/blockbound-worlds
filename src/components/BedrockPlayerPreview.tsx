import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { buildPlayerModel } from "@/game/mobs";
import { getStoredCustomSkin } from "@/game/skinStorage";

interface BedrockPlayerPreviewProps {
  skinUrl?: string | null;
  interactive?: boolean;
  className?: string;
}

export function BedrockPlayerPreview({
  skinUrl,
  interactive = true,
  className = "",
}: BedrockPlayerPreviewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const headRef = useRef<THREE.Object3D | null>(null);
  const bodyRef = useRef<THREE.Object3D | null>(null);
  const leftArmRef = useRef<THREE.Object3D | null>(null);
  const rightArmRef = useRef<THREE.Object3D | null>(null);
  const rootRef = useRef<THREE.Group | null>(null);

  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef<{ x: number; rotY: number }>({ x: 0, rotY: 0 });
  const manualRotYRef = useRef(0);
  const mousePosRef = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      mousePosRef.current = { x: e.clientX, y: e.clientY };
      if (isDragging) {
        const dx = e.clientX - dragStartRef.current.x;
        manualRotYRef.current = dragStartRef.current.rotY + dx * 0.02;
      }
    };
    const onMouseUp = () => setIsDragging(false);

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, [isDragging]);

  const activeSkin = skinUrl !== undefined ? skinUrl : getStoredCustomSkin();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const renderer = new THREE.WebGLRenderer({
      canvas,
      alpha: true,
      antialias: true,
      powerPreference: "high-performance",
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(canvas.clientWidth || 220, canvas.clientHeight || 320, false);
    renderer.outputColorSpace = THREE.SRGBColorSpace;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(34, canvas.width / canvas.height, 0.1, 50);
    camera.position.set(0, 0.95, 3.4);
    camera.lookAt(0, 0.85, 0);

    const ambient = new THREE.AmbientLight(0xffffff, 1.9);
    const dir1 = new THREE.DirectionalLight(0xffffff, 1.8);
    dir1.position.set(2, 4, 3);
    const dir2 = new THREE.DirectionalLight(0xa5c4ff, 0.9);
    dir2.position.set(-2, 2, -2);
    scene.add(ambient, dir1, dir2);

    const player = buildPlayerModel(activeSkin || undefined);
    player.root.position.set(0, 0.05, 0);
    player.root.scale.setScalar(0.72);
    scene.add(player.root);

    headRef.current = player.head ?? null;
    bodyRef.current = player.body ?? null;
    leftArmRef.current = player.arms[0] ?? null;
    rightArmRef.current = player.arms[1] ?? null;
    rootRef.current = player.root;

    let animId = 0;
    let clock = 0;

    const animate = () => {
      animId = requestAnimationFrame(animate);
      clock += 0.035;

      // Subtle breathing motion
      const breath = Math.sin(clock) * 0.025;
      if (bodyRef.current) {
        bodyRef.current.scale.set(1 + breath * 0.4, 1 + breath * 0.2, 1 + breath * 0.4);
      }
      if (leftArmRef.current && rightArmRef.current) {
        leftArmRef.current.rotation.z = 0.06 + Math.sin(clock * 0.9) * 0.02;
        rightArmRef.current.rotation.z = -0.06 - Math.sin(clock * 0.9) * 0.02;
      }

      // Cursor tracking & manual rotation
      if (canvasRef.current && rootRef.current && headRef.current) {
        const rect = canvasRef.current.getBoundingClientRect();
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;

        const nx = (mousePosRef.current.x - cx) / (window.innerWidth * 0.5 || 1);
        const ny = (mousePosRef.current.y - cy) / (window.innerHeight * 0.5 || 1);

        const baseRotY = -0.25 + manualRotYRef.current;
        rootRef.current.rotation.y = baseRotY;

        // Head looks towards cursor
        const clampedYaw = Math.max(-0.45, Math.min(0.45, nx * 0.8));
        const clampedPitch = Math.max(-0.25, Math.min(0.25, ny * 0.5));
        headRef.current.rotation.y = clampedYaw;
        headRef.current.rotation.x = clampedPitch;
      }

      renderer.render(scene, camera);
    };

    animId = requestAnimationFrame(animate);

    const onResize = () => {
      if (!canvas) return;
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      if (w > 0 && h > 0) {
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        renderer.setSize(w, h, false);
      }
    };
    window.addEventListener("resize", onResize);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("resize", onResize);
      renderer.dispose();
      player.mats.forEach((m) => m.dispose());
    };
  }, [activeSkin]);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!interactive) return;
    setIsDragging(true);
    dragStartRef.current = {
      x: e.clientX,
      rotY: manualRotYRef.current,
    };
  };

  return (
    <div
      className={`relative select-none flex items-center justify-center ${className}`}
      onMouseDown={handleMouseDown}
      style={{ cursor: interactive ? (isDragging ? "grabbing" : "grab") : "default" }}
      title={interactive ? "Arrastra para rotar el personaje 360°" : undefined}
    >
      <canvas
        ref={canvasRef}
        className="w-full h-full block drop-shadow-[0_8px_16px_rgba(0,0,0,0.6)]"
      />
    </div>
  );
}
