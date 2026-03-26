import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { mapsAPI } from "../services/api";
import { useAuth } from "../context/AuthContext";
import { Spinner, Alert, ProgressBar, EmptyState } from "../components/ui";
import { APP_CONFIG } from "../config/appConfig";

const Dashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [maps, setMaps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [topic, setTopic] = useState("");
  const [error, setError] = useState("");
  const [deleteId, setDeleteId] = useState(null);

  // 🔥 fetch maps
  const fetchMaps = async () => {
    try {
      const { data } = await mapsAPI.getAll();
      setMaps(data.progress || []);
    } catch {
      setError("Failed to load your maps.");
    } finally {
      setLoading(false);
    }
  };

  // 🔥 load + auto refresh on tab focus
  useEffect(() => {
    fetchMaps();

    const handleFocus = () => fetchMaps();
    window.addEventListener("focus", handleFocus);

    return () => window.removeEventListener("focus", handleFocus);
  }, []);

  // 🔥 generate map
  const handleGenerate = async (e) => {
    e.preventDefault();
    if (!topic.trim()) return;

    setError("");
    setGenerating(true);

    try {
      const { data } = await mapsAPI.generate(topic.trim());
      navigate(`/map/${data.topicMap._id}`);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to generate map.");
      setGenerating(false);
    }
  };

  // 🔥 delete map
  const handleDelete = async (id) => {
    try {
      await mapsAPI.delete(id);
      setMaps((prev) => prev.filter((m) => m.topicMap._id !== id));
    } catch {
      setError("Failed to delete map.");
    } finally {
      setDeleteId(null);
    }
  };

  const formatDate = (dateStr) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  return (
    <div className="max-w-6xl mx-auto px-6 py-10">
      {/* Header */}
      <div className="mb-10">
        <h1 className="text-3xl text-white capitalize font-semibold">
          Hey, {user?.name?.split(" ")[0]} 👋
        </h1>
        <p className="text-slate-400 mt-1">{APP_CONFIG.tagline}</p>
      </div>

      {/* Generate */}
      <div className="card p-6 mb-8">
        <h2 className="text-white font-semibold mb-3">
          Generate a Knowledge Map
        </h2>

        <Alert type="error" message={error} />

        <form onSubmit={handleGenerate} className="flex gap-3 mt-3">
          <input
            className="input flex-1"
            placeholder="e.g. React, DBMS, Machine Learning..."
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            disabled={generating}
            maxLength={200}
          />
          <button
          
            disabled={generating || !topic.trim()}
            className={`px-5 py-2.5 rounded-xl font-medium flex items-center gap-2 
    transition-all duration-200
    ${
      generating || !topic.trim()
        ? "bg-slate-700 text-slate-500 cursor-not-allowed"
        : "bg-brand-500 text-white hover:bg-brand-400 active:scale-95 shadow-md hover:shadow-[0_0_12px_rgba(59,130,246,0.4)]"
    }`}
          >
            {generating ? ( 
              <>
                <Spinner size="sm" />
                <span className="animate-pulse">
                  {topic.trim()
                    ? `Mapping "${topic.trim()}"...`
                    : "Generating..."}
                </span>
              </>
            ) : (
              <>
                <svg
                  className="w-4 h-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M13 10V3L4 14h7v7l9-11h-7z"
                  />
                </svg>
                Generate Map
              </>
            )}
          </button>
        </form>
      </div>

      {/* Maps */}
      <div>
        <h2 className="text-white text-lg mb-4 font-semibold">
          Your Maps ({maps.length})
        </h2>

        {loading ? (
          <div className="flex justify-center py-16">
            <Spinner size="lg" />
          </div>
        ) : maps.length === 0 ? (
          <EmptyState
            title="No maps yet"
            description="Generate your first knowledge map above."
          />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {maps.map((map) => (
              <div
                key={map._id}
                className="card p-5 cursor-pointer transition-all duration-200 hover:scale-[1.02] hover:shadow-xl hover:border-brand-500/40"
                onClick={() => navigate(`/map/${map.topicMap._id}`)}
              >
                {/* Title */}
                <h3 className="text-white font-semibold capitalize line-clamp-2 mb-2">
                  {map.topicMap?.topic}
                </h3>

                {/* Progress */}
                <ProgressBar
                  known={map.stats?.known || 0}
                  partial={map.stats?.partial || 0}
                  total={map.stats?.total || 0}
                />

                {/* Stats */}
                <div className="flex justify-between text-xs text-slate-500 mt-2">
                  <span>{map.stats?.known || 0} known</span>
                  <span>{map.stats?.partial || 0} partial</span>
                  <span>{map.stats?.unknown || 0} unknown</span>
                </div>

                {/* Date */}
                <div className="text-xs text-slate-500 mt-3">
                  {formatDate(map.updatedAt)}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Dashboard;
