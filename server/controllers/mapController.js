import { v4 as uuidv4 } from "uuid";
import TopicMap from "../models/TopicMap.js";
import UserProgress from "../models/UserProgress.js";
import axios from "axios";
import { OPENROUTER_API_KEY } from "../config/env.js";

// ================= PROMPT =================
const buildKnowledgeMapPrompt = (topic) => `
You are an expert educator and curriculum designer. Topic: "${topic}"

Generate a complete knowledge map.

STRICT RULES:
- EXACTLY ONE root
- Max depth 4
- IDs must be unique
- parentId must exist
- No duplicates
- Return ONLY JSON array

Format:
[
  {
    "id": "unique-id",
    "label": "Concept",
    "description": "Short explanation",
    "parentId": null,
    "depth": 0
  }
]
`;

// ================= VALIDATION =================
function validateTree(nodes) {
  const ids = new Set();
  const parentIds = new Set();

  nodes.forEach((n) => {
    if (ids.has(n.id)) {
      throw new Error("Duplicate node ID found");
    }
    ids.add(n.id);

    if (n.parentId) parentIds.add(n.parentId);
  });

  for (let pid of parentIds) {
    if (!ids.has(pid)) {
      throw new Error("Invalid parentId");
    }
  }

  const roots = nodes.filter((n) => n.parentId === null);
  if (roots.length !== 1) {
    throw new Error("Must have exactly one root");
  }
}

// ================= GENERATE =================
export const generateMap = async (req, res, next) => {
  try {
    const { topic } = req.body;

    if (!topic || topic.trim().length === 0) {
      return res.status(400).json({ message: "Topic is required" });
    }

    if (topic.trim().length > 200) {
      return res.status(400).json({ message: "Topic too long" });
    }

    const normalizedTopic = topic.trim().toLowerCase();

    let topicMap = await TopicMap.findOne({ topic: normalizedTopic });

    // ===== CACHE HIT =====
    if (topicMap) {
      let progress = await UserProgress.findOne({
        user: req.user._id,
        topicMap: topicMap._id,
      });

      if (!progress) {
        progress = await UserProgress.create({
          user: req.user._id,
          topicMap: topicMap._id,
          nodeStatuses: {},
          stats: {
            total: topicMap.nodes.length,
            known: 0,
            partial: 0,
            unknown: topicMap.nodes.length,
          },
        });
      }

      return res.json({ topicMap, progress, cached: true });
    }

    // ===== AI CALL =====
    const response = await axios.post(
      "https://openrouter.ai/api/v1/chat/completions",
      {
        model: "openrouter/free", // ✅ FREE MODEL
        messages: [
          {
            role: "user",
            content: buildKnowledgeMapPrompt(normalizedTopic),
          },
        ],
        temperature: 0.3,
      },
      {
        headers: {
          Authorization: `Bearer ${OPENROUTER_API_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );

    const rawText = response.data.choices[0].message.content.trim();

    // ===== PARSE =====
    let nodes;
    try {
      nodes = JSON.parse(rawText);
    } catch {
      const match = rawText.match(/\[[\s\S]*\]/);
      if (!match) {
        return res.status(500).json({ message: "AI parse failed" });
      }
      nodes = JSON.parse(match[0]);
    }

    if (!Array.isArray(nodes) || nodes.length === 0) {
      return res.status(500).json({ message: "AI returned empty map" });
    }

    const sanitizedNodes = nodes.map((node) => ({
      id: node.id || uuidv4(),
      label: node.label || "Unnamed",
      description: node.description || "",
      parentId: node.parentId ?? null,
      depth: node.depth ?? 0,
    }));

    validateTree(sanitizedNodes);

    // ===== SAFE CREATE (HANDLE DUPLICATE) =====
    try {
      topicMap = await TopicMap.create({
        topic: normalizedTopic,
        nodes: sanitizedNodes,
      });
    } catch (err) {
      if (err.code === 11000) {
        topicMap = await TopicMap.findOne({ topic: normalizedTopic });
      } else {
        throw err;
      }
    }

    // ===== CREATE USER PROGRESS =====
    const progress = await UserProgress.create({
      user: req.user._id,
      topicMap: topicMap._id,
      nodeStatuses: {},
      stats: {
        total: sanitizedNodes.length,
        known: 0,
        partial: 0,
        unknown: sanitizedNodes.length,
      },
    });

    res.status(201).json({ topicMap, progress });
  } catch (err) {
    next(err);
  }
};

// ================= GET ALL =================
export const getMaps = async (req, res, next) => {
  try {
    const progress = await UserProgress.find({ user: req.user._id })
      .populate("topicMap", "topic")
      .sort({ updatedAt: -1 });

    res.json({ progress });
  } catch (err) {
    next(err);
  }
};

// ================= GET ONE =================
export const getMapById = async (req, res, next) => {
  try {
    const topicMap = await TopicMap.findById(req.params.id);

    if (!topicMap) {
      return res.status(404).json({ message: "Map not found" });
    }

    const progress = await UserProgress.findOne({
      user: req.user._id,
      topicMap: topicMap._id,
    });

    res.json({ topicMap, progress });
  } catch (err) {
    next(err);
  }
};

// ================= UPDATE =================
export const updateNodes = async (req, res, next) => {
  try {
    const { nodes } = req.body;

    const progress = await UserProgress.findOne({
      user: req.user._id,
      topicMap: req.params.id,
    });

    if (!progress) {
      return res.status(404).json({ message: "Progress not found" });
    }

    nodes.forEach((item) => {
      if (!item || !item.id) return;

      const { id, status } = item;

      if (["unknown", "partial", "known"].includes(status)) {
        progress.nodeStatuses.set(id, status);
      }
    });

    const topicMap = await TopicMap.findById(req.params.id);

    const stats = { total: 0, known: 0, partial: 0, unknown: 0 };

    topicMap.nodes.forEach((node) => {
      const status = progress.nodeStatuses.get(node.id) || "unknown";
      stats.total++;
      stats[status]++;
    });

    progress.stats = stats;

    await progress.save();

    res.json({ progress });
  } catch (err) {
    next(err);
  }
};

// ================= DELETE =================
export const deleteMap = async (req, res, next) => {
  try {
    const progress = await UserProgress.findOneAndDelete({
      user: req.user._id,
      topicMap: req.params.id,
    });

    if (!progress) {
      return res.status(404).json({ message: "Not found" });
    }

    res.json({ message: "Progress deleted" });
  } catch (err) {
    next(err);
  }
};