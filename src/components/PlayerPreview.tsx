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
    const camera = new THREE.PerspectiveCamera(34, canvas.width / canvas.height, 0.1, 100);
    camera.position.set(0, 0.82, 3.1);
    camera.lookAt(0, 0.78, 0);

    const ambient = new THREE.AmbientLight(0xffffff, 1.6);
    const dirLight = new THREE.DirectionalLight(0xffffff, 1.6);
    dirLight.position.set(1.5, 3, 2.5);
    scene.add(ambient, dirLight);

    const player = buildPlayerModel();
    // Position and scale so Steve fits perfectly inside the inventory frame without clipping
    player.root.position.set(0, 0.12, 0);
    player.root.scale.setScalar(0.66);
    // Stand in classic Minecraft inventory pose (slight 3D angle toward player)
    player.root.rotation.y = -0.25;
    scene.add(player.root);

    headRef.current = player.head ?? null;
    rootRef.current = player.root;

    let animId = 0;
    const animate = () => {
      animId = requestAnimationFrame(animate);

      if (headRef.current && canvasRef.current) {
        const rect = canvasRef.current.getBoundingClientRect();
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;
        const hasMoved = mouseRef.current.x > 0 || mouseRef.current.y > 0;

        if (hasMoved) {
          const dx = (mouseRef.current.x - cx) / Math.max(window.innerWidth * 0.35, 200);
          const dy = (mouseRef.current.y - cy) / Math.max(window.innerHeight * 0.35, 200);

          headRef.current.rotation.y = -0.25 + THREE.MathUtils.clamp(dx * 0.9, -0.65, 0.65);
          headRef.current.rotation.x = THREE.MathUtils.clamp(dy * 0.55, -0.35, 0.35);
          if (rootRef.current) {
            rootRef.current.rotation.y = -0.25 + THREE.MathUtils.clamp(dx * 0.3, -0.2, 0.2);
          }
        } else {
          headRef.current.rotation.set(0, -0.25, 0);
          if (rootRef.current) rootRef.current.rotation.y = -0.25;
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
