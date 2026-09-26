import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Syncret",
    short_name: "Syncret",
    description: "Private realtime collaboration for developers.",
    start_url: "/",
    display: "standalone",
    background_color: "#090b11",
    theme_color: "#090b11",
    icons: [
      {
        src: "/syncret-logo.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
    ],
  };
}
