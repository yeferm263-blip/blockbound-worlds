import { createFileRoute } from "@tanstack/react-router";
import { Game } from "@/components/Game";

export const Route = createFileRoute("/")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Blockbound Worlds — 3D Voxel Sandbox & Survival" },
      {
        name: "description",
        content:
          "Explora, pica, tala, construye y sobrevive a los mobs en un mundo de bloques 3D infinito.",
      },
      { property: "og:title", content: "Blockbound Worlds — 3D Voxel Sandbox & Survival" },
      {
        property: "og:description",
        content: "3D voxel sandbox and survival game built with Three.js and React",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Game,
});
