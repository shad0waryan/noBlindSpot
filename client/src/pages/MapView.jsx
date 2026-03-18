import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { mapsAPI } from "../services/api";
import { Spinner, Alert, ProgressBar, StatusBadge } from "../components/ui";

const STATUS_CYCLE = ["unknown", "partial", "known"];

const STATUS_STYLES = {
  unknown: "border-slate-700 bg-surface-card hover:border-slate-500",
  partial: "border-amber-500/40 bg-amber-500/5 hover:border-amber-500/60",
  known:   "border-emerald-500/40 bg-emerald-500/5 hover:border-emerald-500/60",
};

const MapView = () => {
  const { id }   = useParams();
  const navigate = useNavigate();

  const [topicMap, setTopicMap]   = useState(null);
  const [nodes,    setNodes]      = useState([]);
  const [loading,  setLoading]    = useState(true);
  const [saving,   setSaving]     = useState(false);
  const [saved,    setSaved]      = useState(false);
  const [error,    setError]      = useState("");
  const [filter,   setFilter]     = useState("all"); // all | unknown | partial | known
  const [search,   setSearch]     = useState("");
  const [expanded, setExpanded]   = useState({}); // track which depth-0/1 nodes are collapsed

  useEffect(() => {
    fetchMap();
  }, [id]);

  const fetchMap = async () => {
    try {
      const { data } = await mapsAPI.getById(id);
      setTopicMap(data.topicMap);
      setNodes(data.topicMap.nodes);
    } catch {
      setError("Failed to load map.");
    } finally {
      setLoading(false);
    }
  };

  // Cycle through unknown → partial → known → unknown
  const cycleStatus = (nodeId) => {
    setSaved(false);
    setNodes((prev) =>
      prev.map((n) => {
        if (n.id !== nodeId) return n;
        const next = STATUS_CYCLE[(STATUS_CYCLE.indexOf(n.status) + 1) % STATUS_CYCLE.length];
        return { ...n, status: next };
      })
    );
  };

  const handleSave = async () => {
    setSaving(true);
    setError("");
    try {
      const payload = nodes.map(({ id, status }) => ({ id, status }));
      const { data } = await mapsAPI.updateNodes(id, payload);
      setTopicMap(data.topicMap);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch {
      setError("Failed to save progress.");
    } finally {
      setSaving(false);
    }
  };

  // Build tree structure
  const buildTree = useCallback(() => {
    const nodeMap = {};
    nodes.forEach((n) => { nodeMap[n.id] = { ...n, children: [] }; });
    const roots = [];
    nodes.forEach((n) => {
      if (n.parentId === null) roots.push(nodeMap[n.id]);
      else if (nodeMap[n.parentId]) nodeMap[n.parentId].children.push(nodeMap[n.id]);
    });
    return roots;
  }, [nodes]);

  const computeStats = () => {
    const total   = nodes.length;
    const known   = nodes.filter((n) => n.status === "known").length;
    const partial = nodes.filter((n) => n.status === "partial").length;
    const unknown = nodes.filter((n) => n.status === "unknown").length;
    return { total, known, partial, unknown };
  };

  // Flat filtered list for search/filter mode
  const filteredNodes = nodes.filter((n) => {
    const matchFilter = filter === "all" || n.status === filter;
    const matchSearch = n.label.toLowerCase().includes(search.toLowerCase()) ||
                        n.description.toLowerCase().includes(search.toLowerCase());
    return matchFilter && matchSearch;
  });

  const isSearching = search.trim().length > 0 || filter !== "all";

  const toggleExpand = (nodeId) =>
    setExpanded((prev) => ({ ...prev, [nodeId]: !prev[nodeId] }));

  // Recursive tree renderer
  const renderTree = (treeNodes, depth = 0) => {
    return treeNodes.map((node) => {
      const isCollapsed = expanded[node.id] === true; // default expanded
      const hasChildren = node.children?.length > 0;
      const indent = depth * 20;

      return (
        <div key={node.id}>
          <div
            className={`flex items-start gap-3 p-3 rounded-xl border transition-all duration-150 cursor-pointer mb-1.5 ${STATUS_STYLES[node.status]}`}
            style={{ marginLeft: `${indent}px` }}
            onClick={() => cycleStatus(node.id)}
          >
            {/* Expand/collapse for parent nodes */}
            {hasChildren && (
              <button
                onClick={(e) => { e.stopPropagation(); toggleExpand(node.id); }}
                className="mt-0.5 text-slate-500 hover:text-slate-300 transition-colors shrink-0"
              >
                <svg
                  className={`w-3.5 h-3.5 transition-transform ${isCollapsed ? "-rotate-90" : ""}`}
                  fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </button>
            )}
            {!hasChildren && <div className="w-3.5 shrink-0" />}

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`font-display font-medium text-sm ${
                  node.status === "known"   ? "text-emerald-300" :
                  node.status === "partial" ? "text-amber-300"   : "text-slate-200"
                }`}>
                  {node.label}
                </span>
                <StatusBadge status={node.status} />
              </div>
              {node.description && (
                <p className="text-xs text-slate-500 font-body mt-0.5 leading-relaxed">
                  {node.description}
                </p>
              )}
            </div>
          </div>

          {/* Children */}
          {hasChildren && !isCollapsed && (
            <div>{renderTree(node.children, depth + 1)}</div>
          )}
        </div>
      );
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-3">
          <Spinner size="lg" />
          <p className="text-slate-400 font-body text-sm">Loading your map...</p>
        </div>
      </div>
    );
  }

  if (error && !topicMap) {
    return (
      <div className="max-w-2xl mx-auto px-6 py-20 text-center">
        <Alert type="error" message={error} />
        <button onClick={() => navigate("/dashboard")} className="btn-ghost mt-4">
          ← Back to Dashboard
        </button>
      </div>
    );
  }

  const stats = computeStats();
  const tree  = buildTree();

  return (
    <div className="max-w-4xl mx-auto px-6 py-8">
      {/* Header */}
      <div className="mb-6 animate-fade-in">
        <button
          onClick={() => navigate("/dashboard")}
          className="text-slate-500 hover:text-slate-300 text-sm font-body flex items-center gap-1 mb-4 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          Dashboard
        </button>

        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="font-display font-bold text-2xl text-white mb-1">
              {topicMap?.topic}
            </h1>
            <p className="text-slate-400 font-body text-sm">
              Click any concept to cycle: Unknown → Partial → Known
            </p>
          </div>
          <button
            onClick={handleSave}
            disabled={saving}
            className={`btn-primary flex items-center gap-2 ${saved ? "bg-emerald-500 hover:bg-emerald-400" : ""}`}
          >
            {saving ? (
              <><Spinner size="sm" /> Saving...</>
            ) : saved ? (
              <>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
                Saved!
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                </svg>
                Save Progress
              </>
            )}
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="card p-5 mb-6 animate-slide-up">
        <ProgressBar known={stats.known} partial={stats.partial} total={stats.total} />
        <div className="grid grid-cols-3 gap-3 mt-4">
          {[
            { label: "Known",   count: stats.known,   color: "text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/20" },
            { label: "Partial", count: stats.partial, color: "text-amber-400",   bg: "bg-amber-500/10 border-amber-500/20" },
            { label: "Unknown", count: stats.unknown, color: "text-slate-400",   bg: "bg-slate-800 border-slate-700" },
          ].map(({ label, count, color, bg }) => (
            <div key={label} className={`rounded-xl border px-4 py-3 text-center ${bg}`}>
              <div className={`font-display font-bold text-2xl ${color}`}>{count}</div>
              <div className="text-xs text-slate-500 font-body mt-0.5">{label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Search + Filter */}
      <div className="flex gap-3 mb-4 flex-wrap animate-fade-in">
        <input
          type="text"
          className="input flex-1 min-w-48 py-2"
          placeholder="Search concepts..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <div className="flex gap-2">
          {["all", "unknown", "partial", "known"].map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`text-xs font-display font-medium px-3 py-2 rounded-lg border transition-all duration-150 capitalize ${
                filter === f
                  ? "bg-brand-500/20 border-brand-500/40 text-brand-300"
                  : "bg-surface-card border-surface-border text-slate-400 hover:border-slate-600"
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {error && <Alert type="error" message={error} />}

      {/* Node tree / filtered list */}
      <div className="animate-fade-in">
        {isSearching ? (
          filteredNodes.length === 0 ? (
            <div className="text-center py-12 text-slate-500 font-body">
              No concepts match your filter.
            </div>
          ) : (
            <div>
              {filteredNodes.map((node) => (
                <div
                  key={node.id}
                  className={`flex items-start gap-3 p-3 rounded-xl border transition-all duration-150 cursor-pointer mb-1.5 ${STATUS_STYLES[node.status]}`}
                  onClick={() => cycleStatus(node.id)}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`font-display font-medium text-sm ${
                        node.status === "known"   ? "text-emerald-300" :
                        node.status === "partial" ? "text-amber-300"   : "text-slate-200"
                      }`}>
                        {node.label}
                      </span>
                      <StatusBadge status={node.status} />
                    </div>
                    {node.description && (
                      <p className="text-xs text-slate-500 font-body mt-0.5">{node.description}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )
        ) : (
          <div>{renderTree(tree)}</div>
        )}
      </div>
    </div>
  );
};

export default MapView;
