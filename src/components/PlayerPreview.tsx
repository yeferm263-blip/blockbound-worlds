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
    const camera = new THREE.PerspectiveCamera(40, canvas.width / canvas.height, 0.1, 100);
    camera.position.set(0, 0.95, 3.4);
    camera.lookAt(0, 0.95, 0);

    const ambient = new THREE.AmbientLight(0xffffff, 1.2);
    const dirLight = new THREE.DirectionalLight(0xffffff, 1.6);
    dirLight.position.set(1.5, 3, 2.5);
    scene.add(ambient, dirLight);

    const player = buildPlayerModel();
    player.root.position.set(0, 0, 0);
    player.root.scale.setScalar(0.92);
    // Face forward towards camera with subtle angle
    player.root.rotation.y = -0.28;
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
        const dx = (mouseRef.current.x - cx) / (rect.width * 2);
        const dy = (mouseRef.current.y - cy) / (rect.height * 2);

        headRef.current.rotation.y = THREE.MathUtils.clamp(dx * 1.5, -0.9, 0.9);
        headRef.current.rotation.x = THREE.MathUtils.clamp(-dy * 1.2, -0.6, 0.6);
        if (rootRef.current) {
          rootRef.current.rotation.y =
            -0.28 + THREE.MathUtils.clamp(dx * 0.4, -0.35, 0.35);
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
      height={216}
      style={{ width: "100%", height: "100%", display: "block" }}
    />
  );
}
