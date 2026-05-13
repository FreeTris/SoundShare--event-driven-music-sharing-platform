import Fastify from "fastify";
import dotenv from "dotenv";
import { fetch } from "undici";
import pg from "pg";
import cors from "@fastify/cors";

dotenv.config({
  path: ".env",
});

const app = Fastify({
  logger: true,
});

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false,
  },
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

app.post("/songs/share", async (request, reply) => {
  try {
    const body = request.body as Omit<
      SharedSong,
      "sharedAt"
    >;

    const result = await pool.query(
      `
      insert into shared_songs (
        id,
        title,
        artists,
        album,
        album_image,
        spotify_url,
        shared_by,
        caption
      )
      values ($1, $2, $3, $4, $5, $6, $7, $8)
      returning
        id,
        title,
        artists,
        album,
        album_image as "albumImage",
        spotify_url as "spotifyUrl",
        shared_by as "sharedBy",
        caption,
        shared_at as "sharedAt";
      `,
      [
        body.id,
        body.title,
        body.artists,
        body.album,
        body.albumImage ?? null,
        body.spotifyUrl,
        body.sharedBy,
        body.caption ?? null,
      ]
    );

    return {
      success: true,
      song: result.rows[0],
    };
  } catch (error) {
    request.log.error(error);

    return reply.status(500).send({
      error: "Failed to share song",
      message:
        error instanceof Error
          ? error.message
          : "Unknown error",
    });
  }
});

app.get("/feed", async (request, reply) => {
  try {
    const result = await pool.query(
      `
      select
        id,
        title,
        artists,
        album,
        album_image as "albumImage",
        spotify_url as "spotifyUrl",
        shared_by as "sharedBy",
        caption,
        shared_at as "sharedAt"
      from shared_songs
      order by shared_at desc;
      `
    );

    return result.rows;
  } catch (error) {
    request.log.error(error);

    return reply.status(500).send({
      error: "Failed to load feed",
      message:
        error instanceof Error
          ? error.message
          : "Unknown error",
    });
  }
});

const start = async () => {
  try {
    await app.register(cors, {
      origin: "http://localhost:5173",
    });

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