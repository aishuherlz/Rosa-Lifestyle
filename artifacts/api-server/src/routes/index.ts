import { Router, type IRouter } from "express";
import healthRouter from "./health";
import openaiRouter from "./openai";
import stripeRouter from "./stripe";
import foodVisionRouter from "./food-vision";
import outfitVisionRouter from "./outfit-vision";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/openai", openaiRouter);
router.use(stripeRouter);
router.use("/openai", foodVisionRouter);
router.use("/openai", outfitVisionRouter);

export default router;
