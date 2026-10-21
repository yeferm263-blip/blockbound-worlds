import { useEffect, useRef } from "react";
import * as THREE from "three";
import { buildPlayerModel } from "@/game/mobs";

export function PlayerPreview({ mouse }: { mouse: { x: number; y: number } }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const headRef = useRef<THREE.Object3D | null>(null);
  const rootRef = useRef<THREE.Group | null>(null);
  const mouseRef = useRef(mouse);
  mouseRef.current = mouse;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const renderer = new THREE.WebGLRenderer({
      canvas,
      alpha: true,
      antialias: true,
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(canvas.width, canvas.height, false);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(30, canvas.width / canvas.height, 0.1, 100);
    camera.position.set(0, 0.76, 2.75);
    camera.lookAt(0, 0.76, 0);

    const ambient = new THREE.AmbientLight(0xffffff, 1.8);
    const dirLight = new THREE.DirectionalLight(0xffffff, 1.6);
    dirLight.position.set(1.5, 3, 2.5);
    scene.add(ambient, dirLight);

    const player = buildPlayerModel();
    // Position and scale so Steve fits with clean margins inside the inventory frame
    player.root.position.set(0, 0.18, 0);
    player.root.scale.setScalar(0.58);
    // Base 3/4 perspective angle for the body
    player.root.rotation.y = -0.22;
    scene.add(player.root);

    headRef.current = player.head ?? null;
    rootRef.current = player.root;

    let animId = 0;
    const animate = () => {
      animId = requestAnimationFrame(animate);

      if (headRef.current && canvasRef.current && rootRef.current) {
        const rect = canvasRef.current.getBoundingClientRect();
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;
        const hasMoved = mouseRef.current.x > 0 || mouseRef.current.y > 0;

        if (hasMoved) {
          const dx = (mouseRef.current.x - cx) / Math.max(window.innerWidth * 0.35, 200);
          const dy = (mouseRef.current.y - cy) / Math.max(window.innerHeight * 0.35, 200);

          // Head looks toward cursor in world space (clamped so Steve always faces forward toward user)
          const targetHeadWorldYaw = THREE.MathUtils.clamp(dx * 0.6, -0.45, 0.45);
          const targetRootYaw = -0.22 + THREE.MathUtils.clamp(dx * 0.18, -0.12, 0.12);

          rootRef.current.rotation.y = targetRootYaw;
          // Counter-rotate head relative to root so total head world yaw matches targetHeadWorldYaw
          headRef.current.rotation.y = targetHeadWorldYaw - targetRootYaw;
          // Gentle pitch: looking down at inventory slots tilts face slightly downward, without hiding eyes
          headRef.current.rotation.x = THREE.MathUtils.clamp(dy * 0.3, -0.18, 0.22);
        } else {
          // Rest pose: body in 3/4 angle, head facing forward at player
          rootRef.current.rotation.y = -0.22;
          headRef.current.rotation.set(0, 0.22, 0);
        }
      }

      renderer.render(scene, camera);
    };
    animId = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(animId);
      renderer.dispose();
      player.mats.forEach((m) => m.dispose());
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      width={150}
      height={210}
      style={{ width: "100%", height: "100%", display: "block" }}
    />
  );
}
