import { GoogleGenerativeAI } from "@google/generative-ai";
import { v4 as uuidv4 } from "uuid";
import TopicMap from "../models/TopicMap.js";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Build the prompt for Claude to generate a knowledge map
const buildKnowledgeMapPrompt = (topic) => `
You are an expert educator and curriculum designer. A student wants to learn about: "${topic}"

Your task is to generate a comprehensive knowledge map — a complete tree of ALL concepts, sub-topics, and skills that someone must understand to have full mastery of this topic.

Rules:
- Cover the FULL territory of the topic, including areas beginners commonly miss
- Organize into a tree: root topic → main areas → sub-topics → specific concepts
- Maximum depth: 4 levels
- Each node should be atomic (one clear concept)
- Be exhaustive — the goal is to reveal blind spots the learner doesn't even know exist
- Do NOT include learning resources or tips — only the knowledge map itself

Respond with ONLY a valid JSON array. No explanation, no markdown, no backticks.

JSON format:
[
  {
    "id": "unique-string-id",
    "label": "Concept Name",
    "description": "One sentence explaining what this concept covers",
    "parentId": null,
    "depth": 0
  },
  ...
]

The root node has parentId: null and depth: 0.
Children have parentId set to their parent's id.
Depth increments by 1 per level.
Generate between 30 and 60 nodes total for a thorough map.
`;

// @desc    Generate AI knowledge map for a topic
// @route   POST /api/maps/generate
// @access  Private
export const generateMap = async (req, res, next) => {
  try {
    const { topic } = req.body;

    if (!topic || topic.trim().length === 0) {
      return res.status(400).json({ message: "Topic is required" });
    }

    if (topic.trim().length > 200) {
      return res
        .status(400)
        .json({ message: "Topic is too long (max 200 chars)" });
    }

    // Call Claude API
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    const result = await model.generateContent(
      buildKnowledgeMapPrompt(topic.trim()),
    );
    const rawText = result.response.text().trim();

    // Parse JSON response
    let nodes;
    try {
      nodes = JSON.parse(rawText);
    } catch {
      // Try to extract JSON array if Claude added any extra text
      const jsonMatch = rawText.match(/\[[\s\S]*\]/);
      if (!jsonMatch) {
        return res
          .status(500)
          .json({ message: "Failed to parse AI response. Please try again." });
      }
      nodes = JSON.parse(jsonMatch[0]);
    }

    // Sanitize nodes — ensure all required fields exist
    const sanitizedNodes = nodes.map((node) => ({
      id: node.id || uuidv4(),
      label: node.label || "Unnamed Concept",
      description: node.description || "",
      parentId: node.parentId ?? null,
      depth: node.depth ?? 0,
      status: "unknown",
    }));

    // Save to DB
    const topicMap = await TopicMap.create({
      user: req.user._id,
      topic: topic.trim(),
      nodes: sanitizedNodes,
      stats: {
        total: sanitizedNodes.length,
        known: 0,
        partial: 0,
        unknown: sanitizedNodes.length,
      },
    });

    res.status(201).json({ topicMap });
  } catch (error) {
    next(error);
  }
};

// @desc    Get all topic maps for logged-in user
// @route   GET /api/maps
// @access  Private
export const getMaps = async (req, res, next) => {
  try {
    const maps = await TopicMap.find({ user: req.user._id })
      .select("topic stats createdAt updatedAt")
      .sort({ updatedAt: -1 });

    res.json({ maps });
  } catch (error) {
    next(error);
  }
};

// @desc    Get a single topic map by ID
// @route   GET /api/maps/:id
// @access  Private
export const getMapById = async (req, res, next) => {
  try {
    const map = await TopicMap.findOne({
      _id: req.params.id,
      user: req.user._id,
    });

    if (!map) {
      return res.status(404).json({ message: "Topic map not found" });
    }

    res.json({ topicMap: map });
  } catch (error) {
    next(error);
  }
};

// @desc    Update node statuses (self-assessment save)
// @route   PATCH /api/maps/:id/nodes
// @access  Private
export const updateNodes = async (req, res, next) => {
  try {
    const { nodes } = req.body; // array of { id, status }

    if (!Array.isArray(nodes)) {
      return res.status(400).json({ message: "nodes must be an array" });
    }

    const map = await TopicMap.findOne({
      _id: req.params.id,
      user: req.user._id,
    });

    if (!map) {
      return res.status(404).json({ message: "Topic map not found" });
    }

    // Build a status lookup map
    const statusUpdate = {};
    nodes.forEach(({ id, status }) => {
      if (["unknown", "partial", "known"].includes(status)) {
        statusUpdate[id] = status;
      }
    });

    // Apply updates
    map.nodes = map.nodes.map((node) => {
      if (statusUpdate[node.id] !== undefined) {
        node.status = statusUpdate[node.id];
      }
      return node;
    });

    // Recalculate stats
    const stats = { total: map.nodes.length, known: 0, partial: 0, unknown: 0 };
    map.nodes.forEach((n) => stats[n.status]++);
    map.stats = stats;

    await map.save();

    res.json({ topicMap: map });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete a topic map
// @route   DELETE /api/maps/:id
// @access  Private
export const deleteMap = async (req, res, next) => {
  try {
    const map = await TopicMap.findOneAndDelete({
      _id: req.params.id,
      user: req.user._id,
    });

    if (!map) {
      return res.status(404).json({ message: "Topic map not found" });
    }

    res.json({ message: "Topic map deleted successfully" });
  } catch (error) {
    next(error);
  }
};
