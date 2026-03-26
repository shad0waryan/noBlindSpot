import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { mapsAPI } from "../services/api";
import { Spinner, Alert, ProgressBar } from "../components/ui";
import dagre from "dagre";

import ReactFlow, { Background, Controls } from "reactflow";
import "reactflow/dist/style.css";

const STATUSES = ["unknown", "partial", "known"];

const MapView = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  const [topicMap, setTopicMap] = useState(null);
  const [nodes, setNodes] = useState([]);
  const [progress, setProgress] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [viewMode, setViewMode] = useState("list"); // list | tree | graph

  useEffect(() => {
    fetchMap();
  }, [id]);

  const fetchMap = async () => {
    try {
      const { data } = await mapsAPI.getById(id);
      setTopicMap(data.topicMap);
      setNodes(data.topicMap.nodes);
      setProgress(data.progress);
    } catch {
      setError("Failed to load map");
    } finally {
      setLoading(false);
    }
  };

  // 🔥 UPDATE STATUS
  const updateStatus = (nodeId, status) => {
    setProgress((prev) => ({
      ...prev,
      nodeStatuses: {
        ...prev.nodeStatuses,
        [nodeId]: status,
      },
    }));
  };

  // 🔥 AUTO SAVE
  useEffect(() => {
    if (!progress) return;

    const timeout = setTimeout(async () => {
      try {
        setSaving(true);

        const payload = Object.entries(progress.nodeStatuses || {}).map(
          ([nodeId, status]) => ({ id: nodeId, status }),
        );

        await mapsAPI.updateNodes(id, payload);
      } catch {
        setError("Failed to save progress");
      } finally {
        setSaving(false);
      }
    }, 800);

    return () => clearTimeout(timeout);
  }, [progress]);

  // 🔥 DELETE
  const handleDelete = async () => {
    if (!confirm("Delete this map?")) return;
    await mapsAPI.delete(id);
    navigate("/dashboard");
  };

  // 🔥 STATS
  const computeStats = () => {
    let known = 0,
      partial = 0,
      unknown = 0;

    nodes.forEach((n) => {
      const status = progress?.nodeStatuses?.[n.id] || "unknown";
      if (status === "known") known++;
      else if (status === "partial") partial++;
      else unknown++;
    });

    return { total: nodes.length, known, partial, unknown };
  };

  // 🔥 TREE BUILD
  const buildTree = () => {
    const map = {};
    const roots = [];

    nodes.forEach((n) => {
      map[n.id] = { ...n, children: [] };
    });

    nodes.forEach((n) => {
      if (n.parentId === null) roots.push(map[n.id]);
      else if (map[n.parentId]) map[n.parentId].children.push(map[n.id]);
    });

    return roots;
  };

  // 🔥 TREE RENDER
  const renderTree = (treeNodes, depth = 0) => {
    return treeNodes.map((node) => {
      const status = progress.nodeStatuses?.[node.id] || "unknown";

      return (
        <div key={node.id}>
          <div
            className={`p-4 rounded-xl border mb-2 ${
              status === "known"
                ? "border-emerald-500/30 bg-emerald-500/5"
                : status === "partial"
                  ? "border-amber-500/30 bg-amber-500/5"
                  : "border-slate-700 bg-slate-800"
            }`}
            style={{ marginLeft: `${depth * 24}px` }}
          >
            <div className="text-white font-medium">{node.label}</div>

            <div className="flex gap-2 mt-2">
              {STATUSES.map((s) => (
                <button
                  key={s}
                  onClick={() => updateStatus(node.id, s)}
                  className={`px-2 py-1 text-xs rounded border ${
                    status === s
                      ? "bg-brand-500/20 text-white border-brand-500"
                      : "border-slate-600 text-slate-400"
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          {node.children.length > 0 && renderTree(node.children, depth + 1)}
        </div>
      );
    });
  };

  // 🔥 GRAPH BUILD

  const buildGraph = () => {
    const g = new dagre.graphlib.Graph();
    g.setDefaultEdgeLabel(() => ({}));

    g.setGraph({
      rankdir: "TB", // 🔥 Top to Bottom (change to LR if you want)
      nodesep: 80,
      ranksep: 120,
    });

    // Add nodes
    nodes.forEach((node) => {
      g.setNode(node.id, { width: 160, height: 50 });
    });

    // Add edges
    nodes.forEach((node) => {
      if (node.parentId) {
        g.setEdge(node.parentId, node.id);
      }
    });

    // Compute layout
    dagre.layout(g);

    const graphNodes = nodes.map((node) => {
      const pos = g.node(node.id);
      const status = progress.nodeStatuses?.[node.id] || "unknown";

      return {
        id: node.id,
        data: { label: node.label },
        position: {
          x: pos.x,
          y: pos.y,
        },
        style: {
          padding: 10,
          borderRadius: 8,
          border:
            status === "known"
              ? "2px solid #10b981"
              : status === "partial"
                ? "2px solid #f59e0b"
                : "2px solid #475569",
          background:
            status === "known"
              ? "#022c22"
              : status === "partial"
                ? "#3b2f05"
                : "#0f172a",
          color: "white",
          fontSize: "12px",
        },
      };
    });

    const graphEdges = nodes
      .filter((n) => n.parentId)
      .map((n) => ({
        id: `${n.parentId}-${n.id}`,
        source: n.parentId,
        target: n.id,
        animated: false,
      }));

    return { graphNodes, graphEdges };
  };

  if (loading || !progress) return <Spinner />;

  const stats = computeStats();
  const { graphNodes, graphEdges } = buildGraph();

  return (
    <div className="w-full h-screen flex flex-col p-20">
      {/* HEADER */}
      <div className="mb-8">
        {/* ROW 1 → BACK */}
        <div className="mb-4">
          <button
            onClick={() => navigate("/dashboard")}
            className="group flex items-center gap-2 px-4 py-2 rounded-xl 
             border border-slate-700 bg-slate-900/40 text-slate-300
             hover:border-slate-500 hover:bg-slate-800/60 hover:text-white
             active:scale-95
             transition-all duration-200 backdrop-blur-sm shadow-sm"
          >
            <span className="inline-block transform transition-transform duration-200 group-hover:-translate-x-1">
              ←
            </span>
            <span className="font-medium">Back</span>
          </button>
        </div>

        {/* ROW 2 → TITLE CENTER */}
        <div className="text-center mb-6">
          <h1 className="text-3xl font-semibold text-white capitalize">
            {topicMap.topic}
          </h1>
        </div>

        {/* ROW 3 → LEFT + RIGHT */}
        <div className="flex justify-between items-center">
          {/* LEFT → VIEW MODES */}
          <div className="flex gap-2">
            {["list", "tree", "graph"].map((mode) => (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                className={`px-4 py-1.5 rounded-lg border text-sm capitalize transition ${
                  viewMode === mode
                    ? "border-brand-500 text-white bg-brand-500/10"
                    : "border-slate-600 text-slate-400 hover:border-slate-400"
                }`}
              >
                {mode}
              </button>
            ))}
          </div>

          {/* RIGHT → DELETE */}
          <button
            onClick={handleDelete}
            className="px-4 py-1.5 rounded-lg border border-red-500/40 text-red-400 
                 hover:bg-red-500/10 hover:border-red-400 hover:text-red-300 
                 transition-all duration-200 text-sm font-medium"
          >
            Delete Map
          </button>
        </div>
      </div>
      <Alert type="error" message={error} />

      {/* PROGRESS */}
      <ProgressBar
        known={stats.known}
        partial={stats.partial}
        total={stats.total}
      />

      {/* SAVE INDICATOR */}
      <div className="text-xs text-slate-500 mt-2 mb-4">
        {saving ? "Saving..." : "Saved"}
      </div>

      {/* CONTENT */}
      {viewMode === "list" && (
        <div className="space-y-3 overflow-y-auto pr-2">
          {nodes.map((node) => {
            const status = progress.nodeStatuses?.[node.id] || "unknown";

            return (
              <div
                key={node.id}
                className={`p-4 rounded-xl border transition-all duration-200 hover:border-slate-500 ${
                  status === "known"
                    ? "border-emerald-500/30 bg-emerald-500/5"
                    : status === "partial"
                      ? "border-amber-500/30 bg-amber-500/5"
                      : "border-slate-700 bg-slate-800"
                }`}
              >
                {/* TITLE */}
                <div className="flex items-center justify-between">
                  <h3 className="text-white font-medium">{node.label}</h3>

                  {/* STATUS BADGE */}
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full capitalize ${
                      status === "known"
                        ? "bg-emerald-500/20 text-emerald-300"
                        : status === "partial"
                          ? "bg-amber-500/20 text-amber-300"
                          : "bg-slate-700 text-slate-400"
                    }`}
                  >
                    {status}
                  </span>
                </div>

                {/* BUTTON GROUP */}
                <div className="flex gap-2 mt-3">
                  {STATUSES.map((s) => (
                    <button
                      key={s}
                      onClick={() => updateStatus(node.id, s)}
                      className={`px-3 py-1 text-xs rounded-md border transition-all duration-150 capitalize ${
                        status === s
                          ? s === "known"
                            ? "bg-emerald-500/20 text-emerald-300 border-emerald-500"
                            : s === "partial"
                              ? "bg-amber-500/20 text-amber-300 border-amber-500"
                              : "bg-slate-700 text-slate-300 border-slate-500"
                          : "bg-transparent text-slate-500 border-slate-700 hover:border-slate-500"
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {viewMode === "tree" && renderTree(buildTree())}

      {viewMode === "graph" && (
        <div className="flex-1 w-full">
          <ReactFlow
            nodes={graphNodes}
            edges={graphEdges}
            fitView
            className="bg-[#020617]"
          >
            <Background />
            <Controls />
          </ReactFlow>
        </div>
      )}
    </div>
  );
};

export default MapView;
