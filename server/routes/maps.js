import express from "express";
import protect from "../middleware/auth.js";
import {
  generateMap,
  getMaps,
  getMapById,
  updateNodes,
  deleteMap,
} from "../controllers/mapController.js";

const router = express.Router();

// All map routes are protected
router.use(protect);

router.post("/generate", generateMap);
router.get("/", getMaps);
router.get("/:id", getMapById);
router.patch("/:id/nodes", updateNodes);
router.delete("/:id", deleteMap);

export default router;
