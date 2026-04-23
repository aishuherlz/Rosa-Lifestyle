import { Router, type IRouter } from "express";
import healthRouter from "./health";
import openaiRouter from "./openai";
import stripeRouter from "./stripe";
import foodVisionRouter from "./food-vision";
import outfitVisionRouter from "./outfit-vision";
import communityRouter from "./community";
import authRouter from "./auth";
import circlesRouter from "./circles";
import foundersRouter from "./founders";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/openai", openaiRouter);
router.use(stripeRouter);
router.use("/openai", foodVisionRouter);
router.use("/openai", outfitVisionRouter);
router.use(communityRouter);
router.use(authRouter);
router.use(circlesRouter);
router.use(foundersRouter);

export default router;
