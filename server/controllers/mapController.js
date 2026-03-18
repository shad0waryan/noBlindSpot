import { GoogleGenerativeAI } from "@google/generative-ai";
import { v4 as uuidv4 } from "uuid";
import TopicMap from "../models/TopicMap.js";
import UserProgress from "../models/UserProgress.js";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const buildKnowledgeMapPrompt = (topic) => `
You are an expert educator and curriculum designer. A student wants to learn about: "${topic}"

Your task is to generate a comprehensive knowledge map — a complete tree of ALL concepts required for mastery.

STRICT RULES:
- Cover FULL topic
- Max depth: 4
- Each node atomic
- EXACTLY ONE root node
- All parentIds must exist
- IDs must be unique
- NO duplicate labels
- Return ONLY valid JSON array

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

function validateTree(nodes) {
  const ids = new Set();
  const parentIds = new Set();

  nodes.forEach((n) => {
    ids.add(n.id);
    if (n.parentId) parentIds.add(n.parentId);
  });

  for (let pid of parentIds) {
    if (!ids.has(pid)) {
      throw new Error("Invalid AI response: parentId does not exist");
    }
  }

  const roots = nodes.filter((n) => n.parentId === null);
  if (roots.length !== 1) {
    throw new Error("Invalid AI response: must have exactly one root node");
  }
}

// ===================== GENERATE MAP =====================
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

    // ================= CACHE HIT =================
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

    // ================= AI CALL =================
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    const result = await model.generateContent(
      buildKnowledgeMapPrompt(normalizedTopic),
    );

    const rawText = result.response.text().trim();

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

    const sanitizedNodes = nodes.map((node) => ({
      id: node.id || uuidv4(),
      label: node.label || "Unnamed",
      description: node.description || "",
      parentId: node.parentId ?? null,
      depth: node.depth ?? 0,
    }));

    validateTree(sanitizedNodes);

    // ================= SAVE MAP =================
    topicMap = await TopicMap.create({
      topic: normalizedTopic,
      nodes: sanitizedNodes,
    });

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

// ================= GET SINGLE =================
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

// ================= UPDATE NODES =================
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

    nodes.forEach(({ id, status }) => {
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
