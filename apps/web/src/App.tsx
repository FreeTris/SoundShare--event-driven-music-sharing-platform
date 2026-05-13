import { useEffect, useState } from "react";

type Song = {
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

type SpotifySearchResult = {
  id: string;
  title: string;
  artists: string[];
  album: string;
  albumImage?: string;
  spotifyUrl: string;
  previewUrl?: string | null;
};

export default function App() {
  const [feed, setFeed] = useState<Song[]>([]);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SpotifySearchResult[]>([]);
  const [loading, setLoading] = useState(false);

  async function searchSongs() {
    if (!query.trim()) return;

    setLoading(true);

    const response = await fetch(
      `http://localhost:3000/spotify/search?q=${encodeURIComponent(query)}`
    );

    const data = await response.json();

    setResults(data);
    setLoading(false);
  }

  async function loadFeed() {
    const response = await fetch("http://localhost:3000/feed");
    const data = await response.json();

    setFeed(data);
  }

  async function shareSong(song: SpotifySearchResult) {
    await fetch("http://localhost:3000/songs/share", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        id: song.id,
        title: song.title,
        artists: song.artists,
        album: song.album,
        albumImage: song.albumImage,
        spotifyUrl: song.spotifyUrl,
        sharedBy: "tristyn",
        caption: "shared from the React frontend",
      }),
    });

    await loadFeed();
  }

  useEffect(() => {
    loadFeed();
  }, []);

  return (
    <div className="min-h-screen bg-[#121212] text-white p-8">
      <div className="max-w-5xl mx-auto">
        <h1 className="text-6xl font-bold mb-8 text-green-500">
          SoundShare
        </h1>

        <div className="flex gap-3 mb-10">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search songs..."
            className="flex-1 bg-[#242424] rounded-lg px-4 py-3 text-white border border-transparent focus:outline-none focus:border-green-500"
          />

          <button
            onClick={searchSongs}
            className="bg-green-500 hover:bg-green-400 text-black font-bold px-6 rounded-lg"
          >
            Search
          </button>
        </div>

        {loading && <p className="text-gray-400 mb-6">Searching...</p>}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-16">
          {results.map((song) => (
            <div
              key={song.id}
              className="bg-[#181818] hover:bg-[#242424] transition rounded-xl p-4"
            >
              {song.albumImage && (
                <img
                  src={song.albumImage}
                  alt={song.title}
                  className="w-full rounded-lg mb-4"
                />
              )}

              <h2 className="font-bold text-lg">{song.title}</h2>

              <p className="text-gray-400 mb-4">
                {song.artists.join(", ")}
              </p>

              <button
                onClick={() => shareSong(song)}
                className="bg-green-500 hover:bg-green-400 text-black px-4 py-2 rounded-full font-bold"
              >
                Share
              </button>
            </div>
          ))}
        </div>

        <h2 className="text-3xl font-bold mb-6">Shared Feed</h2>

        <div className="space-y-4">
          {feed.map((song) => (
            <div
              key={song.id + song.sharedAt}
              className="bg-[#181818] rounded-xl p-4 flex gap-4 items-center"
            >
              {song.albumImage && (
                <img
                  src={song.albumImage}
                  alt={song.title}
                  className="w-20 h-20 rounded-lg object-cover"
                />
              )}

              <div>
                <h3 className="font-bold">{song.title}</h3>

                <p className="text-gray-400">
                  {song.artists.join(", ")}
                </p>

                <p className="text-sm text-green-500">
                  Shared by {song.sharedBy}
                </p>

                {song.caption && (
                  <p className="text-sm text-gray-300 mt-1">
                    "{song.caption}"
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}