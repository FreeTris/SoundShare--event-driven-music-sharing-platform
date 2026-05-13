import Fastify from "fastify";
import dotenv from "dotenv";
import { fetch } from "undici";

dotenv.config({
  path: ".env",
});

const app = Fastify({
  logger: true,
});

type SharedSong = {
  id: string;
  title: string;
  artists: string[];
  album: string;
  albumImage?: string;
  spotifyUrl: string;
  sharedBy: string;
  caption?: string;
  sharedAt: string;
};

const sharedSongs: SharedSong[] = [];

app.get("/health", async () => {
  return {
    status: "ok",
    service: "soundshare-api",
  };
});

async function getSpotifyAccessToken() {
  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error("Missing Spotify credentials");
  }

  const authString = Buffer.from(
    `${clientId}:${clientSecret}`
  ).toString("base64");

  const response = await fetch(
    "https://accounts.spotify.com/api/token",
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${authString}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: "grant_type=client_credentials",
    }
  );

  const data = (await response.json()) as any;

  if (!response.ok) {
    throw new Error(
      `Spotify auth failed: ${JSON.stringify(data)}`
    );
  }

  return data.access_token;
}

app.get("/spotify/search", async (request, reply) => {
  try {
    const { q } = request.query as { q?: string };

    if (!q) {
      return reply.status(400).send({
        error: "Missing search query",
        example: "/spotify/search?q=nights",
      });
    }

    const accessToken = await getSpotifyAccessToken();

    const response = await fetch(
      `https://api.spotify.com/v1/search?q=${encodeURIComponent(
        q
      )}&type=track&limit=10`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    const data = (await response.json()) as any;

    if (!response.ok) {
      return reply.status(response.status).send({
        error: "Spotify search failed",
        details: data,
      });
    }

    if (!data.tracks?.items) {
      return reply.status(502).send({
        error: "Unexpected Spotify response",
        details: data,
      });
    }

    return data.tracks.items.map((track: any) => ({
      id: track.id,
      title: track.name,
      artists: track.artists.map(
        (artist: any) => artist.name
      ),
      album: track.album.name,
      albumImage: track.album.images[0]?.url,
      spotifyUrl: track.external_urls.spotify,
      previewUrl: track.preview_url,
    }));
  } catch (error) {
    request.log.error(error);

    return reply.status(500).send({
      error: "Internal Server Error",
      message:
        error instanceof Error
          ? error.message
          : "Unknown error",
    });
  }
});

app.post("/songs/share", async (request) => {
  const body = request.body as Omit<
    SharedSong,
    "sharedAt"
  >;

  const sharedSong: SharedSong = {
    ...body,
    sharedAt: new Date().toISOString(),
  };

  sharedSongs.unshift(sharedSong);

  return {
    success: true,
    song: sharedSong,
  };
});

app.get("/feed", async () => {
  return sharedSongs;
});

const start = async () => {
  try {
    await app.listen({
      port: 3000,
      host: "0.0.0.0",
    });

    console.log(
      "SoundShare API running on port 3000"
    );
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
};

start();