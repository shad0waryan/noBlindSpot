import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { mapsAPI } from "../services/api";
import { useAuth } from "../context/AuthContext";
import { Spinner, Alert, ProgressBar, EmptyState } from "../components/ui";
import { APP_CONFIG } from "../config/appConfig";

const Dashboard = () => {
  const { user }   = useAuth();
  const navigate   = useNavigate();

  const [maps,       setMaps]       = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [generating, setGenerating] = useState(false);
  const [topic,      setTopic]      = useState("");
  const [error,      setError]      = useState("");
  const [deleteId,   setDeleteId]   = useState(null);

  useEffect(() => {
    fetchMaps();
  }, []);

  const fetchMaps = async () => {
    try {
      const { data } = await mapsAPI.getAll();
      setMaps(data.maps);
    } catch {
      setError("Failed to load your maps.");
    } finally {
      setLoading(false);
    }
  };

  const handleGenerate = async (e) => {
    e.preventDefault();
    if (!topic.trim()) return;
    setError("");
    setGenerating(true);
    try {
      const { data } = await mapsAPI.generate(topic.trim());
      navigate(`/map/${data.topicMap._id}`);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to generate map. Please try again.");
      setGenerating(false);
    }
  };

  const handleDelete = async (id) => {
    try {
      await mapsAPI.delete(id);
      setMaps((prev) => prev.filter((m) => m._id !== id));
    } catch {
      setError("Failed to delete map.");
    } finally {
      setDeleteId(null);
    }
  };

  const formatDate = (dateStr) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  };

  return (
    <div className="max-w-6xl mx-auto px-6 py-10">
      {/* Welcome header */}
      <div className="mb-10 animate-fade-in">
        <h1 className="font-display font-bold text-3xl text-white mb-1">
          Hey, {user?.name?.split(" ")[0]} 👋
        </h1>
        <p className="text-slate-400 font-body">
          {APP_CONFIG.tagline}. Pick a topic to explore your blind spots.
        </p>
      </div>

      {/* Generate new map */}
      <div className="card p-6 mb-8 animate-slide-up">
        <h2 className="font-display font-semibold text-white text-lg mb-4">
          Generate a Knowledge Map
        </h2>
        <Alert type="error" message={error} />
        <form onSubmit={handleGenerate} className="flex gap-3 mt-3">
          <input
            type="text"
            className="input flex-1"
            placeholder="e.g. React hooks, Calculus, Machine Learning, DBMS..."
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            disabled={generating}
            maxLength={200}
          />
          <button
            type="submit"
            disabled={generating || !topic.trim()}
            className="btn-primary flex items-center gap-2 whitespace-nowrap"
          >
            {generating ? (
              <><Spinner size="sm" /> Generating...</>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                Generate
              </>
            )}
          </button>
        </form>
        {generating && (
          <p className="text-slate-500 text-sm font-body mt-3 animate-pulse">
            🧠 AI is mapping the full knowledge territory of "{topic}"...
          </p>
        )}
      </div>

      {/* Maps list */}
      <div>
        <h2 className="font-display font-semibold text-white text-lg mb-4">
          Your Maps
          {maps.length > 0 && (
            <span className="ml-2 text-sm font-body font-normal text-slate-500">
              ({maps.length})
            </span>
          )}
        </h2>

        {loading ? (
          <div className="flex justify-center py-16">
            <Spinner size="lg" />
          </div>
        ) : maps.length === 0 ? (
          <EmptyState
            icon="🗺️"
            title="No maps yet"
            description="Generate your first knowledge map above and discover what you don't know."
          />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {maps.map((map, i) => (
              <div
                key={map._id}
                className="card p-5 hover:border-brand-700 transition-all duration-200 group cursor-pointer animate-slide-up"
                style={{ animationDelay: `${i * 60}ms` }}
                onClick={() => navigate(`/map/${map._id}`)}
              >
                <div className="flex items-start justify-between mb-3">
                  <h3 className="font-display font-semibold text-white text-base leading-snug group-hover:text-brand-300 transition-colors line-clamp-2 flex-1 pr-2">
                    {map.topic}
                  </h3>
                  <button
                    onClick={(e) => { e.stopPropagation(); setDeleteId(map._id); }}
                    className="text-slate-600 hover:text-red-400 transition-colors p-1 rounded-lg hover:bg-red-500/10 shrink-0"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>

                <div className="mb-4">
                  <ProgressBar
                    known={map.stats.known}
                    partial={map.stats.partial}
                    total={map.stats.total}
                  />
                </div>

                <div className="flex items-center justify-between text-xs text-slate-500 font-body">
                  <span>{map.stats.total} concepts</span>
                  <span>{formatDate(map.updatedAt)}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Delete confirmation modal */}
      {deleteId && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 px-4">
          <div className="card p-6 max-w-sm w-full animate-slide-up">
            <h3 className="font-display font-semibold text-white text-lg mb-2">Delete map?</h3>
            <p className="text-slate-400 font-body text-sm mb-5">
              This will permanently delete the topic map and all your progress. This cannot be undone.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteId(null)} className="btn-ghost flex-1">
                Cancel
              </button>
              <button
                onClick={() => handleDelete(deleteId)}
                className="flex-1 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 font-display font-semibold px-5 py-2.5 rounded-xl transition-all duration-200"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
