import { createFileRoute } from "@tanstack/react-router";
import { Game } from "@/components/Game";

export const Route = createFileRoute("/")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "VoxelCraft — Mundo de bloques 3D" },
      { name: "description", content: "Explora, pica, tala, construye y sobrevive a los mobs en un mundo de bloques 3D infinito." },
      { property: "og:title", content: "VoxelCraft — Mundo de bloques 3D" },
      { property: "og:description", content: "Juego de supervivencia y construcción con bloques en tu navegador." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Game,
});
