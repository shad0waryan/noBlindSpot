import mongoose from "mongoose";

// Each node in the knowledge map tree
const nodeSchema = new mongoose.Schema(
  {
    id: { type: String, required: true },
    label: { type: String, required: true },
    description: { type: String, default: "" },
    parentId: { type: String, default: null }, // null = root
    depth: { type: Number, default: 0 },
    status: {
      type: String,
      enum: ["unknown", "partial", "known"],
      default: "unknown",
    },
  },
  { _id: false }
);

const topicMapSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    topic: {
      type: String,
      required: [true, "Topic is required"],
      trim: true,
      maxlength: [200, "Topic cannot exceed 200 characters"],
    },
    nodes: [nodeSchema],

    // Snapshot stats (updated whenever user saves progress)
    stats: {
      total: { type: Number, default: 0 },
      known: { type: Number, default: 0 },
      partial: { type: Number, default: 0 },
      unknown: { type: Number, default: 0 },
    },
  },
  { timestamps: true }
);

const TopicMap = mongoose.model("TopicMap", topicMapSchema);
export default TopicMap;
